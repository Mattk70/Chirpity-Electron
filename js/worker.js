
const { ipcRenderer } = require('electron');
const fs = require('node:fs');
const p = require('node:path');
const { writeFile, mkdir, readdir, stat } = require('node:fs/promises');
const { PassThrough } = require('node:stream');
const wavefileReader = require('wavefile-reader');
const SunCalc = require('suncalc');
const ffmpeg = require('fluent-ffmpeg');
const png = require('fast-png');
const { utimesSync } = require('utimes');
const {writeToPath} = require('@fast-csv/format');
const merge = require('lodash.merge');
import { State } from './state.js';
import { sqlite3 } from './database.js';
import {trackEvent} from './tracking.js';


// Function to join Buffers and not use Buffer.concat() which leads to detached ArrayBuffers
function joinBuffers(buffer1, buffer2) {
    // Create a new buffer with the combined length
    const combinedBuffer = Buffer.alloc(buffer1.length + buffer2.length);

    // Copy buffer1 into the new buffer
    buffer1.copy(combinedBuffer, 0);

    // Copy buffer2 into the new buffer, starting from the end of buffer1
    buffer2.copy(combinedBuffer, buffer1.length);
    return combinedBuffer;
}

// Save console.warn and console.error functions
const originalWarn = console.warn;
const originalError = console.error;

function customURLEncode(str) {
    return encodeURIComponent(str)
      .replace(/[!'()*]/g, (c) => {
        // Replacing additional characters not handled by encodeURIComponent 
        return '%' + c.charCodeAt(0).toString(16).toUpperCase();
      })
      .replace(/%20/g, '+'); // Replace space with '+' instead of '%20'
  }

// Override console.warn to intercept and track warnings
console.warn = function(message) {
    // Call the original console.warn to maintain default behavior
    originalWarn.apply(console, arguments);
    
    // Track the warning message using your tracking function
    STATE.track && trackEvent(STATE.UUID, 'Worker Warning', arguments[0], customURLEncode(arguments[1]));
};

// Override console.error to intercept and track errors
console.error = function(message) {
    // Call the original console.error to maintain default behavior
    originalError.apply(console, arguments);
    
    // Track the error message using your tracking function
    STATE.track && trackEvent(STATE.UUID, 'Worker Handled Errors', arguments[0], customURLEncode(arguments[1]));
};
// Implement error handling in the worker
self.onerror = function(message, file, lineno, colno, error) {
    STATE.track && trackEvent(STATE.UUID, 'Unhandled Worker Error', message, customURLEncode(error?.stack));
    if (message.includes('dynamic link library')) UI.postMessage({event: 'generate-alert', message: 'There has been an error loading the model. This may be due to missing AVX support. Chirpity AI models require the AVX2 instructions set to run. If you have AVX2 enabled and still see this notice, please refer to <a href="https://github.com/Mattk70/Chirpity-Electron/issues/84" target="_blank">this issue</a> on Github.'})
    // Return false not to inhibit the default error handling
    return false;
    };

self.addEventListener('unhandledrejection', function(event) {
    // Extract the error message and stack trace from the event
    const errorMessage = event.reason?.message;
    const stackTrace = event.reason?.stack;
    
    // Track the unhandled promise rejection
    STATE.track && trackEvent(STATE.UUID, 'Unhandled Worker Promise Rejections', errorMessage, customURLEncode(stackTrace));
});

self.addEventListener('rejectionhandled', function(event) {
    // Extract the error message and stack trace from the event
    const errorMessage = event.reason?.message;
    const stackTrace = event.reason?.stack;
    
    // Track the unhandled promise rejection
    STATE.track && trackEvent(STATE.UUID, 'Handled Worker Promise Rejections', errorMessage, customURLEncode(stackTrace));
});

//Object will hold files in the diskDB, and the active timestamp from the most recent selection analysis.
const STATE = new State();


let WINDOW_SIZE = 3;

let NUM_WORKERS;
let workerInstance = 0;
let appPath, BATCH_SIZE, LABELS, batchChunksToSend = {};
let LIST_WORKER;
const DEBUG = false;

const DATASET = false;
const adding_chirpity_additions = true;
const dataset_database = DATASET;
const DATASET_SAVE_LOCATION = "E:/DATASETS/BirdNET_wavs";

// Adapted from https://stackoverflow.com/questions/6117814/get-week-of-year-in-javascript-like-in-php
Date.prototype.getWeekNumber = function(){
    var d = new Date(Date.UTC(this.getFullYear(), this.getMonth(), this.getDate()));
    var dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7 * (48/52))
};


const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path.replace('app.asar', 'app.asar.unpacked');
//ffmpeg.setFfmpegPath(staticFfmpeg.path.replace('app.asar', 'app.asar.unpacked'));
ffmpeg.setFfmpegPath(ffmpegPath);
let predictionsRequested = {}, predictionsReceived = {}, filesBeingProcessed = [];
let diskDB, memoryDB;

let t0; // Application profiler




const getSelectionRange = (file, start, end) => {
    return { start: (start * 1000) + metadata[file].fileStart, end: (end * 1000) + metadata[file].fileStart }
}
const createDB = async (file) => {
    const archiveMode = !!file;
    if (file) {
        fs.openSync(file, "w");
        diskDB = new sqlite3.Database(file);
        DEBUG && console.log("Created disk database", diskDB.filename);
    } else {
        memoryDB = new sqlite3.Database(':memory:');
        DEBUG && console.log("Created new in-memory database");
    }
    const db = archiveMode ? diskDB : memoryDB;
    await db.runAsync('BEGIN');
    await db.runAsync('CREATE TABLE species(id INTEGER PRIMARY KEY, sname TEXT NOT NULL, cname TEXT NOT NULL)');
    await db.runAsync(`CREATE TABLE files(id INTEGER PRIMARY KEY, name TEXT,duration  REAL,filestart INTEGER, locationID INTEGER, UNIQUE (name))`);
    await db.runAsync(`CREATE TABLE locations( id INTEGER PRIMARY KEY, lat REAL NOT NULL, lon  REAL NOT NULL, place TEXT NOT NULL, UNIQUE (lat, lon))`);
    // Ensure place names are unique too
    await db.runAsync('CREATE UNIQUE INDEX idx_unique_place ON locations(lat, lon)');
    await db.runAsync(`CREATE TABLE records( dateTime INTEGER, position INTEGER, fileID INTEGER, speciesID INTEGER, confidence INTEGER, label  TEXT,  comment  TEXT, end INTEGER, callCount INTEGER, isDaylight INTEGER, UNIQUE (dateTime, fileID, speciesID), CONSTRAINT fk_files FOREIGN KEY (fileID) REFERENCES files(id) ON DELETE CASCADE,  FOREIGN KEY (speciesID) REFERENCES species(id))`);
    await db.runAsync(`CREATE TABLE duration( day INTEGER, duration INTEGER, fileID INTEGER, UNIQUE (day, fileID), CONSTRAINT fk_files FOREIGN KEY (fileID) REFERENCES files(id) ON DELETE CASCADE)`);

    if (archiveMode) {
        for (let i = 0; i < LABELS.length; i++) {
            const [sname, cname] = LABELS[i].replaceAll("'", "''").split('_');
            await db.runAsync(`INSERT INTO species VALUES (${i}, '${sname}', '${cname}')`);
        }
    } else {
        const filename = diskDB.filename;
        let { code } = await db.runAsync(`ATTACH '${filename}' as disk`);
        // If the db is not ready
        while (code === "SQLITE_BUSY") {
            console.log("Disk DB busy")
            setTimeout(() => {}, 10);
            let response = await db.runAsync(`ATTACH '${filename}' as disk`);
            code = response.code;
        }
        let response = await db.runAsync('INSERT INTO files SELECT * FROM disk.files');
        DEBUG && console.log(response.changes + ' files added to memory database')
        response = await db.runAsync('INSERT INTO locations SELECT * FROM disk.locations');
        DEBUG && console.log(response.changes + ' locations added to memory database')
        response = await db.runAsync('INSERT INTO species SELECT * FROM disk.species');
        DEBUG && console.log(response.changes + ' species added to memory database')
    }
    await db.runAsync('END');
    return db
}


async function runMigration(path, num_labels){
    const dataset_file_path = p.join(path, `archive_dataset${num_labels}.sqlite`);
    const archive_file_path = p.join(path, `archive${num_labels}.sqlite`);
    //back-up the archive database
    fs.copyFileSync(archive_file_path, archive_file_path + '.bak');
    // Connect to the databases
    let datasetDB = new sqlite3.Database(dataset_file_path);
    const archiveDB = new sqlite3.Database(archive_file_path);

    // Get a list of tables in the source database
    const tables = await datasetDB.allAsync("SELECT name FROM sqlite_master WHERE type='table'").catch(err => console.log(err));
    await archiveDB.runAsync('BEGIN');
    // Loop through each table
    for (const table of tables)  {
        const tableName = table.name;
        if (tableName === 'species') continue; // Species are the same
        // Query the data from the current table
        const rows = await datasetDB.allAsync(`SELECT * FROM ${tableName}`).catch(err => console.log(err));
        // Insert the data into the destination database
        for (const row of rows) {
            const columns = Object.keys(row);
            const values = columns.map(col => row[col]);
            const placeholders = columns.map(() => '?').join(',');

            await archiveDB.runAsync(`INSERT OR IGNORE INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})`, ...values)
                .catch(err => console.log(err));
        };
    }
    await archiveDB.runAsync('END');
    // Close the database connections
    datasetDB.close(function (err){
        //back-up (rename) the dataset database file
        fs.rename(dataset_file_path, dataset_file_path + '.bak', function (err) {
            if (err){
                console.log(err)
            } else {
                console.log('Backup successful');
            }
        });
    });
    archiveDB.close((err) => {
        if (err) {
            console.error(err.message);
        }
    });
}

async function loadDB(path) {
    // We need to get the default labels from the config file
    DEBUG && console.log("Loading db " + path)
    let modelLabels;
    if (STATE.model === 'birdnet'){
        const labelFile = `labels/V2.4/BirdNET_GLOBAL_6K_V2.4_Labels_en.txt`; 
        await fetch(labelFile).then(response => {
            if (! response.ok) throw new Error('Network response was not ok');
            return response.text();
        }).then(filecontents => {
            modelLabels = filecontents.trim().split(/\r?\n/);
        }).catch( (error) =>{
            console.error('There was a problem fetching the label file:', error);
        })
    } else {
        const {labels} =  JSON.parse(fs.readFileSync(p.join(__dirname, `${STATE.model}_model_config.json`), "utf8"));
        modelLabels = labels;
    }
    
    // Add Unknown Sp.
    modelLabels.push("Unknown Sp._Unknown Sp.");
    const num_labels = modelLabels.length;
    LABELS = modelLabels; // these are the default english labels
    const file = dataset_database ? p.join(path, `archive_dataset${num_labels}.sqlite`) : p.join(path, `archive${num_labels}.sqlite`)
    // Migrate records from 1.6.8 if archive_dataset exists
    if (fs.existsSync(p.join(path, `archive_dataset${num_labels}.sqlite`) )){
        if (!fs.existsSync(p.join(path, `archive${num_labels}.sqlite`)) ){
            // there was only an archive_dataset database, so just rename it...
            fs.renameSync(p.join(path, `archive_dataset${num_labels}.sqlite`), p.join(path, `archive${num_labels}.sqlite`))
        } else {
            // copy data from dataset database to archive database
            await runMigration(path, num_labels)
        }
    }
    if (!fs.existsSync(file)) {
        await createDB(file);
    } else if (diskDB?.filename !== file) {
        diskDB = new sqlite3.Database(file);
        STATE.update({ db: diskDB });
        await diskDB.runAsync('VACUUM');
        await diskDB.runAsync('PRAGMA foreign_keys = ON');
        const { count } = await diskDB.getAsync('SELECT COUNT(*) as count FROM records')
        if (count) {
            UI.postMessage({ event: 'diskDB-has-records' })
        }
        // Get the labels from the DB. These will be in preferred locale
        DEBUG && console.log("Getting labels from disk db " + path)
        const res = await diskDB.allAsync("SELECT sname || '_' || cname AS labels FROM species ORDER BY id")
        LABELS = res.map(obj => obj.labels); // these are the labels in the preferred locale
        const sql = 'PRAGMA table_info(records)';
        const result = await  diskDB.allAsync(sql);
        // Update legacy tables
        const columnExists = result.some((column) => column.name === 'isDaylight');
        if (!columnExists) {
            await diskDB.runAsync('ALTER TABLE records ADD COLUMN isDaylight INTEGER')
            console.log('Added isDaylight column to records table')
        }
        DEBUG && console.log("Opened and cleaned disk db " + file)
    }
    UI.postMessage({event: 'labels', labels: LABELS})
    return true;
}


let metadata = {};
let index = 0, AUDACITY = {}, predictionStart;
let sampleRate; // Should really make this a property of the model
let predictWorkers = [], aborted = false;
let audioCtx;
// Set up the audio context:
function setAudioContext(rate) {
    audioCtx = new AudioContext({ latencyHint: 'interactive', sampleRate: sampleRate });
}


let UI;
let FILE_QUEUE = [];


const dirInfo = async ({ folder = undefined, recursive = false }) => {
    const files = await readdir(folder, { withFileTypes: true });
    const ctimes = [];
    const paths = files.map(async file => {
        const path = p.join(folder, file.name);
        if (file.isDirectory()) {
            if (recursive) {
                return await dirInfo({ folder: path, recursive: true })
            } else {
                return 0
            }
        }
        if (file.isFile() || file.isSymbolicLink()) {
            const { size, ctimeMs } = await stat(path);
            ctimes.push([path, ctimeMs, size]);
            return size
            
        }
        return 0;
    });
    const pathResults = await Promise.all(paths);
    const flattenedPaths = pathResults.flat(Infinity);
    const size = flattenedPaths.reduce((i, size) => i + size, 0);
    // Newest to oldest file, so we can pop the list (faster)
    ctimes.sort((a, b) => {
        return a[1] - b[1]
    })
    //console.table(ctimes);
    return [size, ctimes];
}

async function handleMessage(e) {
    const args = e.data;
    const action = args.action;
    DEBUG && console.log('message received', action)
    switch (action) {
        case "_init_": {
            let {model, batchSize, threads, backend, list} = args;
            const t0 = Date.now();
            STATE.detect.backend = backend;
            LIST_WORKER = await spawnListWorker(); // this can change the backend if tfjs-node isn't avaialble
            DEBUG && console.log('List worker took', Date.now() - t0, 'ms to load');
            await onLaunch({model: model, batchSize: batchSize, threads: threads, backend: STATE.detect.backend, list: list});
            break;
        }
        case "abort": {
            onAbort(args);
            break;
        }
        case "analyse": {
            predictionsReceived = {};
            predictionsRequested = {};
            await onAnalyse(args);
            break;
        }
        case "change-mode": {
            await onChangeMode(args.mode);
            break;
        }
        case "chart": {
            await onChartRequest(args);
            break;
        }
        case 'check-all-files-saved': {
            savedFileCheck(args.files);
            break;
        }
        case "convert-dataset": {convertSpecsFromExistingSpecs();
            break;
        }
        case "create-dataset": {
            args.included = await getIncludedIDs()
            saveResults2DataSet(args);
            break;
        }
        case "delete": {await onDelete(args);
            break;
        }
        case "delete-species": {await onDeleteSpecies(args);
            break;
        }
        case "export-results": {await getResults(args);
            break;
        }
        case "file-load-request": {index = 0;
            filesBeingProcessed.length && onAbort(args);
            DEBUG && console.log("Worker received audio " + args.file);
            await loadAudioFile(args);
            metadata[args.file]?.isSaved ? await onChangeMode("archive") : await onChangeMode("analyse");
            break;
        }
        case "filter": {
            if (STATE.db) {
                t0 = Date.now();
                await getResults(args);
                const t1 = Date.now();
                args.updateSummary && await getSummary(args);
                const t2 = Date.now();
                args.included = await getIncludedIDs(args.file);
                const [total, offset, species] = await getTotal(args);
                UI.postMessage({event: 'total-records', total: total, offset: offset, species: species})
                DEBUG && console.log("Filter took", (Date.now() - t0) / 1000, "seconds", "GetTotal took", (Date.now() - t2) / 1000, "seconds", "GetSummary took", (t2 - t1) / 1000, "seconds");
            }
            break;
        }
        case "get-detected-species-list": {getDetectedSpecies();
            break;
        }
        case "get-valid-species": {getValidSpecies(args.file);
            break;
        }
        case "get-locations": { getLocations({ db: STATE.db, file: args.file });
        break;
        }
        case "get-valid-files-list": { await getFiles(args.files);
            break;
        }
        case "insert-manual-record": { await onInsertManualRecord(args);
            break;
        }
        case "load-model": {
            if (filesBeingProcessed.length) {
                onAbort(args);
            }
            else {
                predictWorkers.length && terminateWorkers()
            };
            await onLaunch(args);
            break;
        }
        case "post": {await uploadOpus(args);
            break;
        }
        case "purge-file": {onFileDelete(args.fileName);
            break;
        }
        case "save": {DEBUG && console.log("file save requested");
            await saveAudio(args.file, args.start, args.end, args.filename, args.metadata);
            break;
        }
        case "save2db": {await onSave2DiskDB(args);
            break;
        }
        case "set-custom-file-location": {onSetCustomLocation(args);
            break;
        }
        case "update-buffer": {await loadAudioFile(args);
            break;
        }
        case "update-file-start": {await onUpdateFileStart(args);
            break;
        }
        case "update-list": {
            STATE.list = args.list;
            STATE.customList = args.list === 'custom' ? args.customList : STATE.customList;
            const {lat, lon, week} = STATE;
            // Clear the LIST_CACHE & STATE.included kesy to force list regeneration
            LIST_CACHE = {}; //[`${lat}-${lon}-${week}-${STATE.model}-${STATE.list}`];
            delete STATE.included?.[STATE.model]?.[STATE.list];
            LIST_WORKER && await setIncludedIDs(lat, lon, week )
            args.refreshResults && await Promise.all([getResults(), getSummary()]);
            break;
        }
        case 'update-locale': {
            await onUpdateLocale(args.locale, args.labels, args.refreshResults)
            break;
        }
        case "update-state": {
            appPath = args.path || appPath;
            // If we change the speciesThreshold, we need to invalidate any location caches
            if (args.speciesThreshold) {
                if (STATE.included?.['birdnet']?.['location'])  STATE.included.birdnet.location = {};
                if (STATE.included?.['chirpity']?.['location'])  STATE.included.chirpity.location = {};
            }
            // likewise, if we change the "use local birds" setting we need to flush the migrants cache"
            if (args.local !== undefined){
                if (STATE.included?.['birdnet']?.['nocturnal'])  delete STATE.included.birdnet.nocturnal;
            }
            STATE.update(args);
            break;
        }
        default: {UI.postMessage("Worker communication lines open");
        }
    }
}

ipcRenderer.on('new-client', async (event) => {
    [UI] = event.ports;
    UI.onmessage = handleMessage
})

function savedFileCheck(fileList) {
    if (diskDB){
        // Construct a parameterized query to count the matching files in the database
        const query = `SELECT COUNT(*) AS count FROM files WHERE name IN (${fileList.map(() => '?').join(',')})`;

        // Execute the query with the file list as parameters
        diskDB.get(query, fileList, (err, row) => {
            if (err) {
                console.error('Error querying database during savedFileCheck:', err);
            } else {
                const count = row.count;
                const result = count === fileList.length;
                UI.postMessage({event: 'all-files-saved-check-result', result: result});
            }
        });
    } else {
        UI.postMessage({event: 'generate-alert', message: 'The database has not finished loading. The saved file check was skipped'})
        return undefined
    }
}

async function onChangeMode(mode) {
    memoryDB || await createDB();
    UI.postMessage({ event: 'mode-changed', mode: mode })
    STATE.changeMode({
        mode: mode,
        disk: diskDB,
        memory: memoryDB
    });
}

const filtersApplied = (list) => list?.length && list.length < LABELS.length -1;

/**
* onLaunch called when Application is first opened or when model changed
*/

async function onLaunch({model = 'chirpity', batchSize = 32, threads = 1, backend = 'tensorflow', list = 'everything'}){
    SEEN_MODEL_READY = false;
    LIST_CACHE = {}
    sampleRate = model === "birdnet" ? 48_000 : 24_000;
    setAudioContext(sampleRate);
    UI.postMessage({event:'ready-for-tour'});
    STATE.detect.backend = backend;
    BATCH_SIZE = batchSize;
    STATE.update({ model: model });
    await loadDB(appPath); // load the diskdb
    await createDB(); // now make the memoryDB
    spawnPredictWorkers(model, list, batchSize, threads);
}


async function spawnListWorker() {
    const worker_1 = await new Promise((resolve, reject) => {
        const worker = new Worker('./js/listWorker.js', { type: 'module' });
        let backend = 'tensorflow';
        worker.onmessage = function (event) {
            // Resolve the promise once the worker sends a message indicating it's ready
            const message = event.data.message;
            
            if (message === 'list-model-ready') {
                return resolve(worker);
            } else if (message === "tfjs-node") {
                event.data.available || (STATE.detect.backend = 'webgpu');
                UI.postMessage({event: 'tfjs-node', hasNode: event.data.available})
            }
        };

        worker.onerror = function (error) {
            reject(error);
        };

        // Start the worker
        worker.postMessage('start');
    })
    return function listWorker(message_1) {
        return new Promise((resolve_1, reject_1) => {
            worker_1.onmessage = function (event_1) {
                resolve_1(event_1.data);
            };

            worker_1.onerror = function (error_1) {
                reject_1(error_1);
            };

            DEBUG && console.log('getting a list from the list worker');
            worker_1.postMessage(message_1);
        });
    };
}


/**
* Generates a list of supported audio files, recursively searching directories.
* Sends this list to the UI
* @param {*} files must be a list of file paths
*/
const getFiles = async (files, image) => {
    let file_list = [];
    for (let i = 0; i < files.length; i++) {
        const stats = fs.lstatSync(files[i])
        if (stats.isDirectory()) {
            const dirFiles = await getFilesInDirectory(files[i])
            file_list = [...file_list,...dirFiles]
        } else {
            file_list.push(files[i])
        }
    }
    // filter out unsupported files
    const supported_files = image ? ['.png'] :
    ['.wav', '.flac', '.opus', '.m4a', '.mp3', '.mpga', '.ogg', '.aac', '.mpeg', '.mp4'];
    
    file_list = file_list.filter((file) => {
        return supported_files.some(ext => file.toLowerCase().endsWith(ext))
    }
    )
    UI.postMessage({ event: 'files', filePaths: file_list });
    return file_list;
}


const getFilesInDirectory = async (dir) => {
    const files = [];
    const stack = [dir];
    
    while (stack.length) {
        const currentDir = stack.pop();
        const dirents = await readdir(currentDir, { withFileTypes: true });
        for (const dirent of dirents) {
            const path = p.join(currentDir, dirent.name);
            if (dirent.isDirectory()) {
                stack.push(path);
            } else {
                files.push(path);
            }
        }
    }
    
    return files;
};

const prepParams = (list) => list.map(item => '?').join(',');


const prepSummaryStatement = (included) => {
    const range = STATE.mode === 'explore' ? STATE.explore.range : undefined;
    const useRange = range?.start;
    const params = [STATE.detect.confidence];
    let summaryStatement = `
    WITH ranked_records AS (
        SELECT records.dateTime, records.confidence, files.name, cname, sname, COALESCE(callCount, 1) as callCount, speciesID, isDaylight,
        RANK() OVER (PARTITION BY fileID, dateTime ORDER BY records.confidence DESC) AS rank
        FROM records
        JOIN files ON files.id = records.fileID
        JOIN species ON species.id = records.speciesID
        WHERE confidence >=  ? `;
    // If you're using the memory db, you're either anlaysing one,  or all of the files
    if (['analyse'].includes(STATE.mode) && STATE.filesToAnalyse.length === 1) {
        summaryStatement += ` AND name IN  (${prepParams(STATE.filesToAnalyse)}) `;
        params.push(...STATE.filesToAnalyse);
    }
    else if (['archive'].includes(STATE.mode)) {
        summaryStatement += ` AND name IN  (${prepParams(STATE.filesToAnalyse)}) `;
        params.push(...STATE.filesToAnalyse);
    }
    else if (useRange) {
        summaryStatement += ' AND dateTime BETWEEN ? AND ? ';
        params.push(range.start, range.end);
    }
    
    if (filtersApplied(included)) {
        const includedParams = prepParams(included);
        summaryStatement += ` AND speciesID IN (${includedParams}) `;
        params.push(...included);
    }
    if (STATE.detect.nocmig){
        summaryStatement += ' AND COALESCE(isDaylight, 0) != 1 ';
    }
    
    if (STATE.locationID) {
        summaryStatement += ' AND locationID = ? ';
        params.push(STATE.locationID);
    }
    summaryStatement += `
    )
    SELECT speciesID, cname, sname, COUNT(cname) as count, SUM(callcount) as calls, ROUND(MAX(ranked_records.confidence) / 10.0, 0) as max
    FROM ranked_records
    WHERE ranked_records.rank <= ${STATE.topRankin}`;
    
    summaryStatement +=  ` GROUP BY speciesID  ORDER BY cname`;

    return [summaryStatement, params]
}
    

const getTotal = async ({species = undefined, offset = undefined, included = [], file = undefined}= {}) => {
    let params = [];
    const range = STATE.mode === 'explore' ? STATE.explore.range : undefined;
    offset = offset ?? (species !== undefined ? STATE.filteredOffset[species] : STATE.globalOffset);
    const useRange = range?.start;
    let SQL = ` WITH MaxConfidencePerDateTime AS (
        SELECT confidence,
        speciesID,
        RANK() OVER (PARTITION BY fileID, dateTime ORDER BY records.confidence DESC) AS rank
        FROM records 
        JOIN files ON records.fileID = files.id 
        WHERE confidence >= ${STATE.detect.confidence} `;
    if (file) {
        params.push(file)
        SQL += ' AND files.name = ? '
    }
    else if (filtersApplied(included)) SQL += ` AND speciesID IN (${included}) `;
    if (useRange) SQL += ` AND dateTime BETWEEN ${range.start} AND ${range.end} `;
    if (STATE.detect.nocmig) SQL += ' AND COALESCE(isDaylight, 0) != 1 ';
    if (STATE.locationID) SQL += ` AND locationID =  ${STATE.locationID}`;
    // If you're using the memory db, you're either anlaysing one,  or all of the files
    if (['analyse'].includes(STATE.mode) && STATE.filesToAnalyse.length === 1) {
        SQL += ` AND name IN  (${prepParams(STATE.filesToAnalyse)}) `;
        params.push(...STATE.filesToAnalyse);
    }
    else if (['archive'].includes(STATE.mode)) {
        SQL += ` AND name IN  (${prepParams(STATE.filesToAnalyse)}) `;
        params.push(...STATE.filesToAnalyse);
    }
    SQL += ' ) '
    SQL += `SELECT COUNT(confidence) AS total FROM MaxConfidencePerDateTime WHERE rank <= ${STATE.topRankin}`;
    
    if (species) {
        params.push(species);
        SQL += ' AND speciesID = (SELECT id from species WHERE cname = ?) '; 
    }
    const {total} = await STATE.db.getAsync(SQL, ...params)
    return [total, offset, species]
}

const prepResultsStatement = (species, noLimit, included, offset, topRankin) => {
    const params = [STATE.detect.confidence];
    let resultStatement = `
    WITH ranked_records AS (
        SELECT 
        records.dateTime, 
        files.duration, 
        files.filestart, 
        fileID,
        files.name,
        files.locationID,
        records.position, 
        records.speciesID,
        species.sname, 
        species.cname, 
        records.confidence as score, 
        records.label, 
        records.comment, 
        records.end,
        records.callCount,
        records.isDaylight,
        RANK() OVER (PARTITION BY fileID, dateTime ORDER BY records.confidence DESC) AS rank
        FROM records 
        JOIN species ON records.speciesID = species.id 
        JOIN files ON records.fileID = files.id 
        WHERE confidence >= ?
        `;
        
    // If you're using the memory db, you're either anlaysing one,  or all of the files
    if (['analyse'].includes(STATE.mode) && STATE.filesToAnalyse.length === 1) {
        resultStatement += ` AND name IN  (${prepParams(STATE.filesToAnalyse)}) `;
        params.push(...STATE.filesToAnalyse);
    }
    else if (['archive'].includes(STATE.mode)) {
        resultStatement += ` AND name IN  (${prepParams(STATE.filesToAnalyse)}) `;
        params.push(...STATE.filesToAnalyse);
    }
    // Prioritise selection ranges
    const range = STATE.selection?.start ? STATE.selection :
    STATE.mode === 'explore' ? STATE.explore.range : false;
    const useRange = range?.start;  
    if (useRange) {
        resultStatement += ` AND dateTime BETWEEN ${range.start} AND ${range.end} `;
    }

    else if (filtersApplied(included)) {
        resultStatement += ` AND speciesID IN (${prepParams(included)}) `;
        params.push(...included);
    }
    if (STATE.selection) {
        resultStatement += ` AND name = ? `;
        params.push(FILE_QUEUE[0])
    }
    if (STATE.locationID) {
        resultStatement += ` AND locationID = ? `;
        params.push(STATE.locationID)
    }
    if (STATE.detect.nocmig){
        resultStatement += ' AND COALESCE(isDaylight, 0) != 1 '; // Backward compatibility for < v0.9.
    }
    
    resultStatement += `)
    SELECT 
    dateTime as timestamp, 
    score,
    duration, 
    filestart, 
    name as file, 
    fileID,
    position, 
    speciesID,
    sname, 
    cname, 
    score, 
    label, 
    comment,
    end,
    callCount,
    rank
    FROM 
    ranked_records 
    WHERE rank <= ? `;
    params.push(topRankin);
    if (species){
        resultStatement+=  ` AND  cname = ? `;
        params.push(species);
    }
    const limitClause = noLimit ? '' : 'LIMIT ?  OFFSET ?';
    noLimit || params.push(STATE.limit, offset);

    resultStatement += ` ORDER BY ${STATE.sortOrder}, callCount DESC ${limitClause} `;
    
    return [resultStatement, params];
}


// Not an arrow function. Async function has access to arguments - so we can pass them to processnextfile
async function onAnalyse({
    filesInScope = [],
    start = 0,
    end = undefined,
    reanalyse = false,
    circleClicked = false
}) {
    // Now we've asked for a new analysis, clear the aborted flag
    aborted = false; //STATE.incrementor = 1;
    predictionStart = new Date();
    // Set the appropraite selection range if this is a selection analysis
    STATE.update({ selection: end ? getSelectionRange(filesInScope[0], start, end) : undefined });
    
    DEBUG && console.log(`Worker received message: ${filesInScope}, ${STATE.detect.confidence}, start: ${start}, end: ${end}`);
    //Reset GLOBAL variables
    index = 0;
    AUDACITY = {};
    batchChunksToSend = {};
    FILE_QUEUE = filesInScope;
    
    
    if (!STATE.selection) {
        // Clear records from the memory db
        await memoryDB.runAsync('DELETE FROM records; VACUUM');
        //create a copy of files in scope for state, as filesInScope is spliced
        STATE.setFiles([...filesInScope]);
    }
    
    let count = 0;
    if (DATASET  && !STATE.selection && !reanalyse) {
        for (let i = FILE_QUEUE.length - 1; i >= 0; i--) {
            let file = FILE_QUEUE[i];
            //STATE.db = diskDB;
            const result = await diskDB.getAsync('SELECT name FROM files WHERE name = ?', file);
            if (result && result.name !== FILE_QUEUE[0]) {
                DEBUG && console.log(`Skipping ${file}, already analysed`)
                FILE_QUEUE.splice(i, 1)
                count++
                continue;
            }
            DEBUG && console.log(`Adding ${file} to the queue.`)
        }
    }
    else {
        // check if results for the files are cached 
        // we only consider it cached if all files have been saved to the disk DB)
        // BECAUSE we want to change state.db to disk if they are
        let allCached = true;
        for (let i = 0; i < FILE_QUEUE.length; i++) {
            const file = FILE_QUEUE[i];
            const row = await getSavedFileInfo(file)
            if (row) {
                await setMetadata({file: file})
            } else {
                allCached = false;
                break;
            } 
        }
        const retrieveFromDatabase = ((allCached && !reanalyse && !STATE.selection) || circleClicked);
        if (retrieveFromDatabase) {
            filesBeingProcessed = [];
            if (circleClicked) {
                // handle circle here
                await getResults({ topRankin: 5 });
            } else {
                await onChangeMode('archive');
                FILE_QUEUE.forEach(file => UI.postMessage({ event: 'update-audio-duration', value: metadata[file].duration }));
                // Wierdness with promise all - list worker called 2x and no results returned
                //await Promise.all([getResults(), getSummary()] );
                await getResults();
                await getSummary();
            }
            return;
        }
        
    }
    DEBUG && console.log("FILE_QUEUE has", FILE_QUEUE.length, 'files', count, 'files ignored')
    STATE.selection || onChangeMode('analyse');
    
    filesBeingProcessed = [...FILE_QUEUE];
    for (let i=0;i<NUM_WORKERS;i++){
        processNextFile({ start: start, end: end, worker: i });
    }
}

function onAbort({
    model = STATE.model,
    list = 'nocturnal',
}) {
    aborted = true;
    FILE_QUEUE = [];
    index = 0;
    DEBUG && console.log("abort received")
    if (filesBeingProcessed.length) {
        //restart the workers
        terminateWorkers();
        spawnPredictWorkers(model, list, BATCH_SIZE, NUM_WORKERS)
    }
    predictQueue = [];
    filesBeingProcessed = [];
    predictionsReceived = {};
    predictionsRequested = {};
}

const getDuration = async (src) => {
    let audio;
    return new Promise(function (resolve, reject) {
        audio = new Audio();
        audio.src = src.replace(/#/g, '%23'); // allow hash in the path (https://github.com/Mattk70/Chirpity-Electron/issues/98)
        audio.addEventListener("loadedmetadata", function () {
            const duration = audio.duration;
            audio = undefined;
            // Tidy up - cloning removes event listeners
            const old_element = document.getElementById("audio");
            const new_element = old_element.cloneNode(true);
            old_element.parentNode.replaceChild(new_element, old_element);
            
            resolve(duration);
        });
        audio.addEventListener('error', (error) => {
            UI.postMessage({event: 'generate-alert', message: 'Unable to decode file metatada'})
            reject(error)
        })
    });
}


/**
* getWorkingFile's purpose is to locate a file and set its metadata. 
* @param file: full path to source file
* @returns {Promise<boolean|*>}
*/
async function getWorkingFile(file) {
    
    if (metadata[file]?.isComplete && metadata[file]?.proxy) return metadata[file].proxy;
    // find the file
    const source_file = fs.existsSync(file) ? file : await locateFile(file);
    if (!source_file) return false;
    let proxy = source_file;
    
    if (!metadata.file?.isComplete) {
        await setMetadata({ file: file, proxy: proxy, source_file: source_file });
    }
    return proxy;
}

/**
* Function to return path to file searching for new extensions if original file has been compressed.
* @param file
* @returns {Promise<*>}
*/
async function locateFile(file) {
    // Ordered from the highest likely quality to lowest
    const supported_files = ['.wav', '.flac', '.opus', '.m4a', '.mp3', '.mpga', '.ogg', '.aac', '.mpeg', '.mp4'];
    const dir = p.parse(file).dir, name = p.parse(file).name;
    // Check folder exists before trying to traverse it. If not, return empty list
    let [, folderInfo] = fs.existsSync(dir) ?
    await dirInfo({ folder: dir, recursive: false }) : ['', []];
    let filesInFolder = [];
    folderInfo.forEach(item => {
        filesInFolder.push(item[0])
    })
    let supportedVariants = []
    supported_files.forEach(ext => {
        supportedVariants.push(p.join(dir, name + ext))
    })
    const matchingFileExt = supportedVariants.find(variant => {
        const matching = (file) => variant.toLowerCase() === file.toLowerCase();
        return filesInFolder.some(matching)
    })
    if (!matchingFileExt) {
        notifyMissingFile(file)
        return false;
    }
    return matchingFileExt;
}

async function notifyMissingFile(file) {
    let missingFile;
    // Look for the file in te Archive
    const row = await diskDB.getAsync('SELECT * FROM FILES WHERE name = ?', file);
    if (row?.id) missingFile = file
    UI.postMessage({
        event: 'generate-alert',
        message: `Unable to locate source file with any supported file extension: ${file}`,
        file: missingFile
    })
}

async function loadAudioFile({
    file = '',
    start = 0,
    end = 20,
    position = 0,
    region = false,
    preserveResults = false,
    play = false,
    queued = false,
    goToRegion = true
}) {
    
    const found = metadata[file]?.proxy || await getWorkingFile(file);
    if (found) {
        await fetchAudioBuffer({ file, start, end })
        .then((buffer) => {
            let audioArray = buffer.getChannelData(0);
            UI.postMessage({
                event: 'worker-loaded-audio',
                location: metadata[file].locationID,
                start: metadata[file].fileStart,
                sourceDuration: metadata[file].duration,
                bufferBegin: start,
                file: file,
                position: position,
                contents: audioArray,
                fileRegion: region,
                preserveResults: preserveResults,
                play: play,
                queued: queued,
                goToRegion
            }, [audioArray.buffer]);
        })
        .catch( (error) => {
            console.log(error);
        })
        let week;
        if (STATE.list === 'location'){
            week = STATE.useWeek ? new Date(metadata[file].fileStart).getWeekNumber() : -1
            // Send the week number of the surrent file
            UI.postMessage({event: 'current-file-week', week: week})
        } else { UI.postMessage({event: 'current-file-week', week: undefined}) }
    }
}


function addDays(date, days) {
    let result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}



/**
* Called by getWorkingFile, setCustomLocation
* Assigns file metadata to a metadata cache object. file is the key, and is the source file
* proxy is required if the source file is not a wav to populate the headers
* @param file: the file name passed to the worker
* @param proxy: the wav file to use for predictions
* @param source_file: the file that exists ( will be different after compression)
* @returns {Promise<unknown>}
*/
const setMetadata = async ({ file, proxy = file, source_file = file }) => {
    metadata[file] ??= { proxy: proxy };
    metadata[file].proxy ??= proxy;
    // CHeck the database first, so we honour any manual updates.
    const savedMeta = await getSavedFileInfo(file);
    // If we have stored imfo about the file, set the saved flag;
    metadata[file].isSaved = !!savedMeta;
    // Latitude only provided when updating location
    // const latitude = savedMeta?.lat || STATE.lat;
    // const longitude = savedMeta?.lon || STATE.lon;
    // const row = await STATE.db.getAsync('SELECT id FROM locations WHERE lat = ? and lon = ?', latitude, longitude);
    
    // using the nullish coalescing operator
    metadata[file].locationID ??= savedMeta?.locationID;
    
    metadata[file].duration ??= savedMeta?.duration || await getDuration(file);
    
    return new Promise((resolve, reject) => {
        if (metadata[file].isComplete) {
            resolve(metadata[file])
        } else {
            let fileStart, fileEnd;
            
            if (savedMeta?.fileStart) {
                fileStart = new Date(savedMeta.fileStart);
                fileEnd = new Date(fileStart.getTime() + (metadata[file].duration * 1000));
            } else {
                metadata[file].stat = fs.statSync(source_file);
                fileEnd = new Date(metadata[file].stat.mtime);
                fileStart = new Date(metadata[file].stat.mtime - (metadata[file].duration * 1000));
            }
            
            // split  the duration of this file across any dates it spans
            metadata[file].dateDuration = {};
            const key = new Date(fileStart);
            key.setHours(0, 0, 0, 0);
            const keyCopy = addDays(key, 0).getTime();
            if (fileStart.getDate() === fileEnd.getDate()) {
                metadata[file].dateDuration[keyCopy] = metadata[file].duration;
            } else {
                const key2 = addDays(key, 1);
                
                const key2Copy = addDays(key2, 0).getTime();
                metadata[file].dateDuration[keyCopy] = (key2Copy - fileStart) / 1000;
                metadata[file].dateDuration[key2Copy] = metadata[file].duration - metadata[file].dateDuration[keyCopy];
            }
            // Now we have completed the date comparison above, we convert fileStart to millis
            fileStart = fileStart.getTime();
            metadata[file].fileStart = fileStart;
            return resolve(metadata[file]);
        }
    }).catch(error => console.warn(error))
}
            
function setupCtx(audio, rate, destination, file) {
    rate ??= sampleRate;
    // Deal with detached arraybuffer issue
    const useFilters = (STATE.filters.sendToModel && STATE.filters.active) || destination === 'UI';
    return audioCtx.decodeAudioData(audio.buffer)
    .then( audioBuffer => {
        const audioCtxSource = audioCtx.createBufferSource();
        audioCtxSource.buffer = audioBuffer;
        audioBuffer = null; //  release memory
        const duration = audioCtxSource.buffer.duration;
        const buffer = audioCtxSource.buffer;

        const offlineCtx = new OfflineAudioContext(1, rate * duration, rate);
        const offlineSource = offlineCtx.createBufferSource();
        offlineSource.buffer = buffer;
        let previousFilter = undefined;
        if (useFilters){
            if (STATE.filters.active) {
                if (STATE.filters.highPassFrequency) {
                    // Create a highpass filter to cut low-frequency noise
                    const highpassFilter = offlineCtx.createBiquadFilter();
                    highpassFilter.type = "highpass"; // Standard second-order resonant highpass filter with 12dB/octave rolloff. Frequencies below the cutoff are attenuated; frequencies above it pass through.
                    highpassFilter.frequency.value = STATE.filters.highPassFrequency; //frequency || 0; // This sets the cutoff frequency. 0 is off. 
                    highpassFilter.Q.value = 0; // Indicates how peaked the frequency is around the cutoff. The greater the value, the greater the peak.
                    offlineSource.connect(highpassFilter);
                    previousFilter = highpassFilter;
                }
                if (STATE.filters.lowShelfFrequency && STATE.filters.lowShelfAttenuation) {
                    // Create a lowshelf filter to attenuate low-frequency noise
                    const lowshelfFilter = offlineCtx.createBiquadFilter();
                    lowshelfFilter.type = 'lowshelf';
                    lowshelfFilter.frequency.value = STATE.filters.lowShelfFrequency; // This sets the cutoff frequency of the lowshelf filter to 1000 Hz
                    lowshelfFilter.gain.value = STATE.filters.lowShelfAttenuation; // This sets the boost or attenuation in decibels (dB)
                    previousFilter ? previousFilter.connect(lowshelfFilter) : offlineSource.connect(lowshelfFilter);
                    previousFilter = lowshelfFilter;
                }
            }      
        }
        if (STATE.audio.gain){
            var gainNode = offlineCtx.createGain();
            gainNode.gain.value = Math.pow(10, STATE.audio.gain / 20);
            previousFilter ? previousFilter.connect(gainNode) : offlineSource.connect(gainNode);
            gainNode.connect(offlineCtx.destination);
        } else {
            previousFilter ? previousFilter.connect(offlineCtx.destination) : offlineSource.connect(offlineCtx.destination);
        }
        offlineSource.start();
        return offlineCtx;
    })
    .catch(error => console.warn(error, file));    
};


function checkBacklog(stream) {
    return new Promise((resolve, reject) => {
        const backlog = sumObjectValues(predictionsRequested) - sumObjectValues(predictionsReceived);
        DEBUG && console.log('backlog:', backlog);
        
        if (backlog > 200) {
            // If queued value is above 100, wait and check again
            setTimeout(() => {
                checkBacklog(stream)
                    .then(resolve) // Resolve the promise when backlog is within limit
                    .catch(reject);
            }, 500); // Check every 0.5 seconds
        } else {
            resolve(stream.read()); // backlog ok then read the stream data
        }
    });
}


/**
*
* @param file
* @param start
* @param end
* @returns {Promise<void>}
*/

let predictQueue = [];

const getWavePredictBuffers = async ({
    file = '', start = 0, end = undefined
}) => {
    // Ensure max and min are within range
    start = Math.max(0, start);
    end = Math.min(metadata[file].duration, end);
    if (start > metadata[file].duration) {
        return
    }
    let meta = {};
    batchChunksToSend[file] = Math.ceil((end - start) / (BATCH_SIZE * WINDOW_SIZE));
    predictionsReceived[file] = 0;
    predictionsRequested[file] = 0;
    let readStream;
    if (! fs.existsSync(file)) {
        UI.postMessage({event: 'generate-alert', message: `The requested audio file cannot be found: ${file}`})
        return new Error('getWavePredictBuffers: Error extracting audio segment: File not found.');
    }
    // extract the header. With bext and iXML metadata, this can be up to 128k, hence 131072
    const headerStream = fs.createReadStream(file, {start: 0, end: 524288, highWaterMark: 524288});
    headerStream.on('readable',  () => {
        let chunk = headerStream.read();
        let wav = new wavefileReader.WaveFileReader();
        try {
            wav.fromBuffer(chunk);
        } catch (e) {
            UI.postMessage({event: 'generate-alert', message: `Cannot parse ${file}, it has an invalid wav header.`});
            headerStream.close();
            updateFilesBeingProcessed(file);
            return;
        }
        let headerEnd;
        wav.signature.subChunks.forEach(el => {
            if (el['chunkId'] === 'data') {
                headerEnd = el.chunkData.start;
            }
        });
        meta.header = chunk.subarray(0, headerEnd);
        const byteRate = wav.fmt.byteRate;
        const sample_rate = wav.fmt.sampleRate;
        meta.byteStart = Math.round((start * byteRate) / sample_rate) * sample_rate + headerEnd;
        meta.byteEnd = Math.round((end * byteRate) / sample_rate) * sample_rate + headerEnd;
        meta.highWaterMark = byteRate * BATCH_SIZE * WINDOW_SIZE;
        headerStream.destroy();
        DEBUG && console.log('Header extracted for ', file)


        readStream = fs.createReadStream(file, {
            start: meta.byteStart, end: meta.byteEnd, highWaterMark: meta.highWaterMark
        });

    
        let chunkStart = start * sampleRate;
        // Changed on.('data') handler because of:  https://stackoverflow.com/questions/32978094/nodejs-streams-and-premature-end
        readStream.on('readable', () => {
            if (aborted) {
                readStream.destroy();
                return
            }

            checkBacklog(readStream).then(chunk => {
                if (chunk === null || chunk.byteLength <= 1 ) {
                    // EOF
                    chunk?.byteLength && predictionsReceived[file]++;
                    readStream.destroy();
                } else {
                    const audio = joinBuffers(meta.header, chunk);
                    predictQueue.push([audio, file, end, chunkStart]);
                    chunkStart += WINDOW_SIZE * BATCH_SIZE * sampleRate;
                    processPredictQueue();
                }
            })
        })
        readStream.on('error', err => {
            console.log(`readstream error: ${err}, start: ${start}, , end: ${end}, duration: ${metadata[file].duration}`);
            err.code === 'ENOENT' && notifyMissingFile(file);
        })
    })    
}

function processPredictQueue(audio, file, end, chunkStart){

    if (! audio) [audio, file, end, chunkStart]  = predictQueue.shift(); // Dequeue chunk
    audio.length === 0 && console.warn('Shifted zero length audio from predict queue')
    setupCtx(audio, undefined, 'model', file).then(offlineCtx => {
        let worker;
        if (offlineCtx) {
            offlineCtx.startRendering().then((resampled) => {
                const myArray = resampled.getChannelData(0);
                workerInstance = ++workerInstance >= NUM_WORKERS ? 0 : workerInstance;
                worker = workerInstance;
                feedChunksToModel(myArray, chunkStart, file, end, worker);
                return
            }).catch((error) => {
                console.error(`PredictBuffer rendering failed: ${error}, file ${file}`);
                updateFilesBeingProcessed(file);
                return
            });
        } else {
            console.log('Short chunk', audio.length, 'padding');
            let chunkLength = STATE.model === 'birdnet' ? 144_000 : 72_000;
            workerInstance = ++workerInstance >= NUM_WORKERS ? 0 : workerInstance;
            worker = workerInstance;
            const myArray = new Float32Array(Array.from({ length: chunkLength }).fill(0));
            feedChunksToModel(myArray, chunkStart, file, end);
        }}).catch(error => { console.warn(file, error) })
}

const getPredictBuffers = async ({
    file = '', start = 0, end = undefined
}) => {
    // Ensure max and min are within range
    start = Math.max(0, start);
    end = Math.min(metadata[file].duration, end);
    if (start > metadata[file].duration) {
        return
    }
    let header, shortFile = true;
    const MINIMUM_AUDIO_LENGTH = 0.05; // below this value doesn't generate another chunk
    batchChunksToSend[file] = Math.ceil((end - start - MINIMUM_AUDIO_LENGTH) / (BATCH_SIZE * WINDOW_SIZE));
    predictionsReceived[file] = 0;
    predictionsRequested[file] = 0;
    let highWaterMark =  2 * sampleRate * BATCH_SIZE * WINDOW_SIZE; 
    

    let chunkStart = start * sampleRate;
    return new Promise((resolve, reject) => {
        if (! fs.existsSync(file)) {
            UI.postMessage({event: 'generate-alert', message: `The requested audio file cannot be found: ${file}`})
            return reject(new Error('getPredictBuffers: Error extracting audio segment: File not found.'));
        }
        let concatenatedBuffer = Buffer.alloc(0);
        const command = ffmpeg(file)
            .seekInput(start)
            .duration(end - start)
            .format('wav')
            .audioChannels(1) // Set to mono
            .audioFrequency(sampleRate) // Set sample rate 

        command.on('error', (error, stdout, stderr) => {
            updateFilesBeingProcessed(file)
            if (error.message.includes('SIGKILL')) console.log('FFMPEG process shut down at user request')
            else {
                error.message = error.message + '|' + error.stack;
            }
            console.log('Ffmpeg error in file:\n', file, 'stderr:\n', error)
            reject(console.warn('getPredictBuffers: Error in ffmpeg extracting audio segment:', error));
        });
        command.on('start', function (commandLine) {
            DEBUG && console.log('FFmpeg command: ' + commandLine);
        })

        const STREAM = command.pipe();
        STREAM.on('readable', () => {           
            if (aborted) {
                STREAM.end();
                return
            }
            const chunk = STREAM.read();
            if (chunk === null) {
                //EOF: deal with part-full buffers
                if (shortFile) highWaterMark -= header.length;
                if (concatenatedBuffer.byteLength){
                    header || console.warn('no header for ' + file)
                    let noHeader;
                    if (concatenatedBuffer.length < header.length) noHeader = true;
                    else noHeader = concatenatedBuffer.compare(header, 0, header.length, 0, header.length)
                    const audio = noHeader ? joinBuffers(header, concatenatedBuffer) : concatenatedBuffer;
                    processPredictQueue(audio, file, end, chunkStart);
                } else {
                    updateFilesBeingProcessed(file)
                }
                DEBUG && console.log('All chunks sent for ', file);
                //STREAM.end();
                resolve('finished')
            }
            else {
                concatenatedBuffer = concatenatedBuffer.length ? joinBuffers(concatenatedBuffer, chunk) : chunk;
                if (!header) {
                    header = lookForHeader(concatenatedBuffer);
                    // First chunk sent to model is short because it contains the header
                    // Highwatermark is the length of audio alone
                    // Initally, the highwatermark needs to add the header length to get the correct length of audio
                    if (header) highWaterMark += header.length;
                }
                

                // if we have a full buffer
                if (concatenatedBuffer.length > highWaterMark) {     
                    const audio_chunk = Buffer.allocUnsafeSlow(highWaterMark);
                    concatenatedBuffer.copy(audio_chunk, 0, 0, highWaterMark);
                    const remainder = Buffer.allocUnsafeSlow(concatenatedBuffer.length - highWaterMark);
                    concatenatedBuffer.copy(remainder, 0, highWaterMark);
                    const noHeader = audio_chunk.compare(header, 0, header.length, 0, header.length)
                    const audio = noHeader ? joinBuffers(header, audio_chunk) : audio_chunk;
                    // If we *do* have a header, we need to reset highwatermark because subsequent chunks *won't* have it
                    if (! noHeader) {
                        highWaterMark -= header.length;
                        shortFile = false;
                    }
                    processPredictQueue(audio, file, end, chunkStart);
                    chunkStart += WINDOW_SIZE * BATCH_SIZE * sampleRate
                    concatenatedBuffer = remainder;

                }
            }
        });

        STREAM.on('error', err => {
            console.log('stream error: ', err);
            err.code === 'ENOENT' && notifyMissingFile(file);
        })

    }).catch(error => console.log(error));
}

function lookForHeader(buffer){
    //if (buffer.length < 4096) return undefined
    try {
        const wav = new wavefileReader.WaveFileReader();
        wav.fromBuffer(buffer);
        let headerEnd;
        wav.signature.subChunks.forEach(el => {
            if (el['chunkId'] === 'data') {
                headerEnd = el.chunkData.start;
            }
        });
        return buffer.subarray(0, headerEnd);
    } catch (e) {
        DEBUG && console.log(e)
        return undefined
    }
}

/**
*  Called when file first loaded, when result clicked and when saving or sending file snippets
* @param args
* @returns {Promise<unknown>}
*/
const fetchAudioBuffer = async ({
    file = '', start = 0, end = undefined
}) => {
    metadata[file].duration || await setMetadata({file:file});
    end ??= metadata[file].duration; 
    let concatenatedBuffer = Buffer.alloc(0);
    let header;
    // Ensure start is a minimum 0.1 seconds from the end of the file, and >= 0
    start = metadata[file].duration < 0.1 ? 0 : Math.min(metadata[file].duration - 0.1, start)
    end = Math.min(end, metadata[file].duration);
    // Use ffmpeg to extract the specified audio segment
    return new Promise((resolve, reject) => {
        if (! fs.existsSync(file)) {
            const missingFile = STATE.mode === 'archive' ? file : undefined;
            UI.postMessage({event: 'generate-alert', message: `The requested audio file cannot be found: ${file}`, file: missingFile})
            return reject(new Error('fetchAudioBuffer: Error extracting audio segment: File not found.'));
        }
        let command = ffmpeg(file)
            .seekInput(start)
            .duration(end - start)
            .format('wav')
            .audioChannels(1) // Set to mono
            .audioFrequency(24_000) // Set sample rate to 24000 Hz (always - this is for wavesurfer)
            if (STATE.filters.active) {
                if (STATE.filters.lowShelfAttenuation && STATE.filters.lowShelfFrequency){
                    command.audioFilters({
                        filter: 'lowshelf',
                        options: `gain=${STATE.filters.lowShelfAttenuation}:f=${STATE.filters.lowShelfFrequency}`
                    })
                }
                if (STATE.filters.highPassFrequency){
                    command.audioFilters({
                        filter: 'highpass',
                        options: `f=${STATE.filters.highPassFrequency}:poles=1`
                    })
                }
            }
            if (STATE.audio.normalise){
                command.audioFilters(
                    {
                        filter: 'loudnorm',
                        options: "I=-16:LRA=11:TP=-1.5"
                    }
                )
            }
        const stream = command.pipe();
        
        command.on('error', error => {
            UI.postMessage({event: 'generate-alert', message: error})
            reject(new Error('fetchAudioBuffer: Error extracting audio segment:', error));
        });
        command.on('start', function (commandLine) {
            DEBUG && console.log('FFmpeg command: ' + commandLine);
        })

        stream.on('readable', () => {
            const chunk = stream.read();
            if (chunk === null){
                // Last chunk
                const audio = concatenatedBuffer;
                setupCtx(audio, sampleRate, 'UI', file).then(offlineCtx => {
                    offlineCtx.startRendering().then(resampled => {
                        resolve(resampled);
                    }).catch((error) => {
                        console.error(`FetchAudio rendering failed: ${error}`);
                    });
                }).catch( (error) => {
                    reject(error.message)
                });  
                stream.destroy();
            } else {
                concatenatedBuffer = concatenatedBuffer.length ?  joinBuffers(concatenatedBuffer, chunk) : chunk;
            }
        })
    });
}

// Helper function to check if a given time is within daylight hours
function isDuringDaylight(datetime, lat, lon) {
    const date = new Date(datetime);
    const { dawn, dusk } = SunCalc.getTimes(date, lat, lon);
    return datetime >= dawn && datetime <= dusk;
}

async function feedChunksToModel(channelData, chunkStart, file, end, worker) {
    predictionsRequested[file]++;
    if (worker === undefined) {
        // pick a worker - this method is faster than looking for avialable workers
        worker = ++workerInstance >= NUM_WORKERS ? 0 : workerInstance
    }
    const objData = {
        message: 'predict',
        worker: worker,
        fileStart: metadata[file].fileStart,
        file: file,
        start: chunkStart,
        duration: end,
        resetResults: !STATE.selection,
        snr: STATE.filters.SNR,
        context: STATE.detect.contextAware,
        confidence: STATE.detect.confidence,
        chunks: channelData
    };
    if (predictWorkers[worker]) predictWorkers[worker].isAvailable = false;
    predictWorkers[worker]?.postMessage(objData, [channelData.buffer]);
}

async function doPrediction({
    file = '',
    start = 0,
    end = metadata[file].duration,
}) {
    if (file.toLowerCase().endsWith('.wav')){
        await getWavePredictBuffers({ file: file, start: start, end: end }).catch( (error) => console.warn(error));
    } else {
        await getPredictBuffers({ file: file, start: start, end: end }).catch( (error) => console.warn(error));
    }
    
    UI.postMessage({ event: 'update-audio-duration', value: metadata[file].duration });
}

const speciesMatch = (path, sname) => {
    const pathElements = path.split(p.sep);
    const species = pathElements[pathElements.length - 2];
    sname = sname.replace(/ /g, '_');
    return species.includes(sname)
}

const convertSpecsFromExistingSpecs = async (path) => {
    path ??= '/mnt/608E21D98E21A88C/Users/simpo/PycharmProjects/Data/New_Dataset';
    const file_list = await getFiles([path], true);
    for (let i = 0; i < file_list.length; i++) {
        const parts = p.parse(file_list[i]);
        let species = parts.dir.split(p.sep);
        species = species[species.length - 1];
        const [filename, time] = parts.name.split('_');
        const [start, end] = time.split('-');
        const path_to_save = path.replace('New_Dataset', 'New_Dataset_Converted') + p.sep + species;
        const file_to_save = p.join(path_to_save, parts.base);
        if (fs.existsSync(file_to_save)) {
            DEBUG && console.log("skipping file as it is already saved")
        } else {
            const file_to_analyse = parts.dir.replace('New_Dataset', 'XC_ALL_mp3') + p.sep + filename + '.mp3';
            const AudioBuffer = await fetchAudioBuffer({
                start: parseFloat(start), end: parseFloat(end), file: file_to_analyse
            })
            if (AudioBuffer) {  // condition to prevent barfing when audio snippet is v short i.e. fetchAudioBUffer false when < 0.1s
                if (++workerInstance === NUM_WORKERS) {
                    workerInstance = 0;
                }
                const buffer = AudioBuffer.getChannelData(0);
                predictWorkers[workerInstance].postMessage({
                    message: 'get-spectrogram',
                    filepath: path_to_save,
                    file: parts.base,
                    buffer: buffer,
                    height: 256,
                    width: 384,
                    worker: workerInstance
                }, [buffer.buffer]);
            }
        }
    }
}
            
const saveResults2DataSet = ({species, included}) => {
    const exportType = 'audio';
    const rootDirectory = DATASET_SAVE_LOCATION;
    sampleRate = STATE.model === 'birdnet' ? 48_000 : 24_000;
    const height = 256, width = 384;
    let t0 = Date.now()
    let promise = Promise.resolve();
    let promises = [];
    let count = 0;
    let db2ResultSQL = `SELECT dateTime AS timestamp, 
    files.duration, 
    files.filestart,
    files.name AS file, 
    position,
    species.sname, 
    species.cname, 
    confidence AS score, 
    label, 
    comment
    FROM records
    JOIN species
    ON species.id = records.speciesID
    JOIN files ON records.fileID = files.id
    WHERE confidence >= ${STATE.detect.confidence}`;
    db2ResultSQL += filtersApplied(included) ? ` AND speciesID IN (${prepParams(included)}` : '';
    
    let params = filtersApplied(included) ? included : [];
    if (species) {
        db2ResultSQL += ` AND species.cname = ?`;
        params.push(species)
    }
    STATE.db.each(db2ResultSQL, ...params, async (err, result) => {
        // Check for level of ambient noise activation
        let ambient, threshold, value = STATE.detect.confidence;
        // adding_chirpity_additions is a flag for curated files, if true we assume every detection is correct
        if (!adding_chirpity_additions) {
            //     ambient = (result.sname2 === 'Ambient Noise' ? result.score2 : result.sname3 === 'Ambient Noise' ? result.score3 : false)
            //     console.log('Ambient', ambient)
            //     // If we have a high level of ambient noise activation, insist on a high threshold for species detection
            //     if (ambient && ambient > 0.2) {
            //         value = 0.7
            //     }
            // Check whether top predicted species matches folder (i.e. the searched for species)
            // species not matching the top prediction sets threshold to 2000, effectively limiting treatment to manual records
            threshold = speciesMatch(result.file, result.sname) ? value : 2000;
        } else {
            //threshold = result.sname === "Ambient_Noise" ? 0 : 2000;
            threshold = result.sname === "Ambient_Noise" ? 0 : 0;
        }
        promise = promise.then(async function () {
            let score = result.score;
            if (score >= threshold) {
                const folders = p.dirname(result.file).split(p.sep);
                species = result.cname.replaceAll(' ', '_');
                const sname = result.sname.replaceAll(' ', '_');
                // score 2000 when manual id. if manual ID when doing  additions put it in the species folder
                const folder = adding_chirpity_additions && score !== 2000 ? 'No_call' : `${sname}~${species}`;
                // get start and end from timestamp
                const start = result.position;
                let end = start + 3;
                
                // filename format: <source file>_<confidence>_<start>.png
                const file = `${p.basename(result.file).replace(p.extname(result.file), '')}_${start}-${end}.png`;
                const filepath = p.join(rootDirectory, folder)
                const file_to_save = p.join(filepath, file)
                if (fs.existsSync(file_to_save)) {
                    DEBUG && console.log("skipping file as it is already saved")
                } else {
                    end = Math.min(end, result.duration);
                    if (exportType === 'audio') saveAudio(result.file, start, end, file.replace('.png', '.wav'), {Artist: 'Chirpity'}, filepath)
                    else {
                        const AudioBuffer = await fetchAudioBuffer({
                            start: start, end: end, file: result.file
                        })
                        if (AudioBuffer) {  // condition to prevent barfing when audio snippet is v short i.e. fetchAudioBUffer false when < 0.1s
                            if (++workerInstance === NUM_WORKERS) {
                                workerInstance = 0;
                            }
                            
                            const buffer = AudioBuffer.getChannelData(0);
                            predictWorkers[workerInstance].postMessage({
                                message: 'get-spectrogram',
                                filepath: filepath,
                                file: file,
                                buffer: buffer,
                                height: height,
                                width: width,
                                worker: workerInstance
                            }, [buffer.buffer]);
                        }
                    }
                    count++;
                }
            }
            return new Promise(function (resolve) {
                setTimeout(resolve, 0.1);
            });
        })
        promises.push(promise)
    }, (err) => {
        if (err) return console.log(err);
        Promise.all(promises).then(() => console.log(`Dataset created. ${count} files saved in ${(Date.now() - t0) / 1000} seconds`))
    })
    
}
            
const onSpectrogram = async (filepath, file, width, height, data, channels) => {
    await mkdir(filepath, { recursive: true });
    let image = await png.encode({ width: 384, height: 256, data: data, channels: channels })
    const file_to_save = p.join(filepath, file);
    await writeFile(file_to_save, image);
    DEBUG && console.log('saved:', file_to_save);
};
            
async function uploadOpus({ file, start, end, defaultName, metadata, mode }) {
    const blob = await bufferToAudio({ file: file, start: start, end: end, format: 'opus', meta: metadata });
    // Populate a form with the file (blob) and filename
    const formData = new FormData();
    //const timestamp = Date.now()
    formData.append("thefile", blob, defaultName);
    // Was the prediction a correct one?
    formData.append("Chirpity_assessment", mode);
    // post form data
    const xhr = new XMLHttpRequest();
    xhr.responseType = 'text';
    // log response
    xhr.onload = () => {
        DEBUG && console.log(xhr.response);
    };
    // create and send the reqeust
    xhr.open('POST', 'https://birds.mattkirkland.co.uk/upload');
    xhr.send(formData);
}
            
const bufferToAudio = async ({
    file = '', start = 0, end = 3, meta = {}, format = undefined
}) => {
    let audioCodec, mimeType, soundFormat;
    let padding = STATE.audio.padding;
    let fade = STATE.audio.fade;
    let bitrate = STATE.audio.bitrate;
    let quality = parseInt(STATE.audio.quality);
    let downmix = STATE.audio.downmix;
    format ??= STATE.audio.format;
    const bitrateMap = { 24_000: '24k', 16_000: '16k', 12_000: '12k', 8000: '8k', 44_100: '44k', 22_050: '22k', 11_025: '11k' };
    if (format === 'mp3') {
        audioCodec = 'libmp3lame';
        soundFormat = 'mp3';
        mimeType = 'audio/mpeg'
    } else if (format === 'wav') {
        audioCodec = 'pcm_s16le';
        soundFormat = 'wav';
        mimeType = 'audio/wav'
    } else if (format === 'flac') {
        audioCodec = 'flac';
        soundFormat = 'flac';
        mimeType = 'audio/flac'
        // Static binary is missing the aac encoder
        // } else if (format === 'm4a') {
        //     audioCodec = 'aac';
        //     soundFormat = 'aac';
        //     mimeType = 'audio/mp4'
    } else if (format === 'opus') {
        audioCodec = 'libopus';
        soundFormat = 'opus'
        mimeType = 'audio/ogg'
    }
    
    let optionList = [];
    for (let [k, v] of Object.entries(meta)) {
        if (typeof v === 'string') {
            v = v.replaceAll(' ', '_');
        }
        optionList.push('-metadata');
        optionList.push(`${k}=${v}`);
    }
    metadata[file] || await getWorkingFile(file);
    if (padding) {
        start -= padding;
        end += padding;
        start = Math.max(0, start);
        end = Math.min(end, metadata[file].duration);
    }
    
    return new Promise(function (resolve, reject) {
        const bufferStream = new PassThrough();
        if (! fs.existsSync(file)) {
            UI.postMessage({event: 'generate-alert', message: `The requested audio file cannot be found: ${file}`})
            return reject(new Error('bufferToAudio: Error extracting audio segment: File not found.'));
        }
        let ffmpgCommand = ffmpeg(file)
        .toFormat(soundFormat)
        .seekInput(start)
        .duration(end - start)
        .audioChannels(downmix ? 1 : -1)
        // I can't get this to work with Opus
        // .audioFrequency(metadata[file].sampleRate)
        .audioCodec(audioCodec)
        .addOutputOptions(...optionList)
        
        if (['mp3', 'm4a', 'opus'].includes(format)) {
            //if (format === 'opus') bitrate *= 1000;
            ffmpgCommand = ffmpgCommand.audioBitrate(bitrate)
        } else if (['flac'].includes(format)) {
            ffmpgCommand = ffmpgCommand.audioQuality(quality)
        }
        if (STATE.filters.active) {
            if (STATE.filters.lowShelfFrequency > 0){
                ffmpgCommand = ffmpgCommand.audioFilters(
                    {
                        filter: 'lowshelf',
                        options: `gain=${STATE.filters.lowShelfAttenuation}:f=${STATE.filters.lowShelfFrequency}`
                    }
                )
            }
            if (STATE.filters.highPassFrequency > 0){
                ffmpgCommand = ffmpgCommand.audioFilters(
                    {
                        filter: 'highpass',
                        options: `f=${STATE.filters.highPassFrequency}:poles=1`
                    }
                )
            }
            if (STATE.audio.normalise){
                ffmpgCommand = ffmpgCommand.audioFilters(
                    {
                        filter: 'loudnorm',
                        options: "I=-16:LRA=11:TP=-1.5" //:offset=" + STATE.audio.gain
                    }
                )
            }
        }
        if (fade && padding) {
            const duration = end - start;
            if (start >= 1 && end <= metadata[file].duration - 1) {
                ffmpgCommand = ffmpgCommand.audioFilters(
                    {
                        filter: 'afade',
                        options: `t=in:ss=${start}:d=1`
                    },
                    {
                        filter: 'afade',
                        options: `t=out:st=${duration - 1}:d=1`
                    }
                )}
        }


        ffmpgCommand.on('start', function (commandLine) {
            DEBUG && console.log('FFmpeg command: ' + commandLine);
        })
        ffmpgCommand.on('error', (err) => {
            console.log('An error occurred: ' + err.message);
        })
        ffmpgCommand.on('end', function () {
            DEBUG && console.log(format + " file rendered")
        })
        ffmpgCommand.writeToStream(bufferStream);
        
        let concatenatedBuffer = Buffer.alloc(0);
        bufferStream.on('readable', () => {
            const chunk = bufferStream.read();
            if (chunk === null){
                let audio = [];
                audio.push(new Int8Array(concatenatedBuffer))
                const blob = new Blob(audio, { type: mimeType });
                resolve(blob);    
            } else {
                concatenatedBuffer = concatenatedBuffer.length ?  joinBuffers(concatenatedBuffer, chunk) : chunk;
            }
        });
    })
};
                
async function saveAudio(file, start, end, filename, metadata, folder) {
    const thisBlob = await bufferToAudio({
        file: file, start: start, end: end, meta: metadata
    });
    if (folder) {
        const buffer = Buffer.from(await thisBlob.arrayBuffer());
        if (! fs.existsSync(folder)) fs.mkdirSync(folder, {recursive: true});
        fs.writeFile(p.join(folder, filename), buffer, {flag: 'w+'}, err => {
            if (err) console.log(err) ;
            else if (DEBUG) console.log('Audio file saved') });
    }
    else {
        UI.postMessage({event:'audio-file-to-save', file: thisBlob, filename: filename})
    }
}

// Create a flag to indicate if parseMessage is currently being executed
let isParsing = false;

// Create a queue to hold messages while parseMessage is executing
const messageQueue = [];

// Function to process the message queue
const processQueue = async () => {
    if (!isParsing && messageQueue.length > 0) {
        // Set isParsing to true to prevent concurrent executions
        isParsing = true;
        
        // Get the first message from the queue
        const message = messageQueue.shift();

        // Parse the message
        await parseMessage(message).catch( (error) => {
            console.warn("Parse message error", error, 'message was', message);
        });
        // Dial down the getSummary calls if the queue length starts growing
        // if (messageQueue.length > NUM_WORKERS * 2 )  {
        //     STATE.incrementor = Math.min(STATE.incrementor *= 2, 256);
        //     console.log('increased incrementor to ', STATE.incrementor)
        // }

        
        // Set isParsing to false to allow the next message to be processed
        isParsing = false;
        
        // Process the next message in the queue
        processQueue();
    }
};

               
/// Workers  From the MDN example5
function spawnPredictWorkers(model, list, batchSize, threads) {
    NUM_WORKERS = threads;
    // And be ready to receive the list:
    for (let i = 0; i < threads; i++) {
        const workerSrc = model === 'v3' ? 'BirdNet' : model === 'birdnet' ? 'BirdNet2.4' : 'model';
        const worker = new Worker(`./js/${workerSrc}.js`, { type: 'module' });
        worker.isAvailable = true;
        worker.isReady = false;
        predictWorkers.push(worker)
        DEBUG && console.log('loading a worker')
        worker.postMessage({
            message: 'load',
            model: model,
            list: list,
            batchSize: batchSize,
            backend: STATE.detect.backend,
            lat: STATE.lat,
            lon: STATE.lon,
            week: STATE.week,
            threshold: STATE.speciesThreshold,
            worker: i
        })

        // Web worker message event handler
        worker.onmessage = (e) => {
            // Push the message to the queue
            messageQueue.push(e);
            // Process the queue
            processQueue();
        };
        worker.onerror = (e) => {
            console.warn(`Worker ${i} is suffering, shutting it down. THe error was:`, e.message)
            predictWorkers.splice(i, 1);
            worker.terminate();
        }
    }
}

const terminateWorkers = () => {
    predictWorkers.forEach(worker => {
        worker.postMessage({ message: 'abort' })
        worker.terminate()
    })
    predictWorkers = [];
}

async function batchInsertRecords(cname, label, files, originalCname) {
    const db = STATE.db;
    let params = [originalCname, STATE.detect.confidence];
    t0 = Date.now();
    let query = `SELECT * FROM records WHERE speciesID = (SELECT id FROM species WHERE cname = ?) AND confidence >= ? `;
    if (STATE.mode !== 'explore') {
        query += ` AND fileID in (SELECT id FROM files WHERE name IN (${files.map(() => '?').join(', ')}))`
        params.push(...files);
    } else if (STATE.explore.range.start) {
        query += ` AND dateTime BETWEEN ${STATE.explore.range.start} AND ${STATE.explore.range.end}`;
    }
    const records = await STATE.db.allAsync(query, ...params);
    const updatedID = db.getAsync('SELECT id FROM species WHERE cname = ?', cname);
    let count = 0;
    await db.runAsync('BEGIN');
    for (let i = 0; i< records.length; i++) {
        const item = records[i];
        const { dateTime, speciesID, fileID, position, end, comment, callCount } = item;
        const { name } = await STATE.db.getAsync('SELECT name FROM files WHERE id = ?', fileID)
        // Delete existing record
        const changes = await db.runAsync('DELETE FROM records WHERE datetime = ? AND speciesID = ? AND fileID = ?', dateTime, speciesID, fileID)
        count += await onInsertManualRecord({
            cname: cname,
            start: position,
            end: end,
            comment: comment,
            count: callCount,
            file: name,
            label: label,
            batch: false,
            originalCname: undefined,
            updateResults: i === records.length -1 // trigger a UI update after the last item
        })
    }
    await db.runAsync('END');
    DEBUG && console.log(`Batch record update took ${(Date.now() - t0) / 1000} seconds`)
}
                        
const onInsertManualRecord = async ({ cname, start, end, comment, count, file, label, batch, originalCname, confidence, speciesFiltered, updateResults = true }) => {
    if (batch) return batchInsertRecords(cname, label, file, originalCname)
    start = parseFloat(start), end = parseFloat(end);
    const startMilliseconds = Math.round(start * 1000);
    let changes = 0, fileID, fileStart;
    const db = STATE.db;
    const { speciesID } = await db.getAsync(`SELECT id as speciesID FROM species WHERE cname = ?`, cname);
    let res = await db.getAsync(`SELECT id,filestart FROM files WHERE name = ?`, file);

    if (!res) { 
        // Manual records can be added off the bat, so there may be no record of the file in either db
        fileStart = metadata[file].fileStart;
        res = await db.runAsync('INSERT OR IGNORE INTO files VALUES ( ?,?,?,?,? )',
        fileID, file, metadata[file].duration, fileStart, undefined);
        fileID = res.lastID;
        changes = 1;
        let durationSQL = Object.entries(metadata[file].dateDuration)
        .map(entry => `(${entry.toString()},${fileID})`).join(',');
        await db.runAsync(`INSERT OR IGNORE INTO duration VALUES ${durationSQL}`);
    } else {
        fileID = res.id;
        fileStart = res.filestart;
    }
    
    const dateTime = fileStart + startMilliseconds;
    const isDaylight = isDuringDaylight(dateTime, STATE.lat, STATE.lon);
    confidence = confidence || 2000;
    // Delete an existing record if it exists
    const result = await db.getAsync(`SELECT id as originalSpeciesID FROM species WHERE cname = ?`, originalCname);
    result?.originalSpeciesID && await db.runAsync('DELETE FROM records WHERE datetime = ? AND speciesID = ? AND fileID = ?', dateTime, result.originalSpeciesID, fileID)
    const response = await db.runAsync('INSERT OR REPLACE INTO records VALUES ( ?,?,?,?,?,?,?,?,?,?)',
    dateTime, start, fileID, speciesID, confidence, label, comment, end, parseInt(count), isDaylight);
    
    if (response.changes){
        STATE.db === diskDB ? UI.postMessage({ event: 'diskDB-has-records' }) : UI.postMessage({event: 'unsaved-records'});
    }
    if (updateResults){
        const select =  {start: start, dateTime: dateTime};
        await getResults({species:speciesFiltered, select: select});
        await getSummary({species: speciesFiltered});
    }
    return changes;
}
                        
const generateInsertQuery = async (latestResult, file) => {
    const db = STATE.db;              
    await db.runAsync('BEGIN');              
    let insertQuery = 'INSERT OR IGNORE INTO records VALUES ';
    let fileID, changes;
    let res = await db.getAsync('SELECT id FROM files WHERE name = ?', file);
    if (!res) {
        res = await db.runAsync('INSERT OR IGNORE INTO files VALUES ( ?,?,?,?,? )',
        undefined, file, metadata[file].duration, metadata[file].fileStart, undefined);
        fileID = res.lastID;
        changes = 1;
    } else {
        fileID = res.id;
    }
    if (changes) {
        const durationSQL = Object.entries(metadata[file].dateDuration)
        .map(entry => `(${entry.toString()},${fileID})`).join(',');
        // No "OR IGNORE" in this statement because it should only run when the file is new
        await db.runAsync(`INSERT OR IGNORE INTO duration VALUES ${durationSQL}`);
    }
    let [keysArray, speciesIDBatch, confidenceBatch] = latestResult;
    for (let i = 0; i < keysArray.length; i++) {
        const key = parseFloat(keysArray[i]);
        const timestamp = metadata[file].fileStart + key * 1000;
        const isDaylight = isDuringDaylight(timestamp, STATE.lat, STATE.lon);
        const confidenceArray = confidenceBatch[i];
        const speciesIDArray = speciesIDBatch[i];
        for (let j = 0; j < confidenceArray.length; j++) {
            const confidence = Math.round(confidenceArray[j] * 1000);
            if (confidence < 50) break;
            const speciesID = speciesIDArray[j];
            insertQuery += `(${timestamp}, ${key}, ${fileID}, ${speciesID}, ${confidence}, null, null, ${key + 3}, null, ${isDaylight}), `;
        }
    }
    // Remove the trailing comma and space
    insertQuery = insertQuery.slice(0, -2);
    //DEBUG && console.log(insertQuery);
    // Make sure we have some values to INSERT
    insertQuery.endsWith(')') && await db.runAsync(insertQuery)
        .catch( (error) => console.log("Database error:", error))
    await db.runAsync('END');
    return fileID
}

const parsePredictions = async (response) => {
    let file = response.file;
    const included = await getIncludedIDs(file).catch( (error) => console.log('Error getting included IDs', error));
    const latestResult = response.result, db = STATE.db;
    DEBUG && console.log('worker being used:', response.worker);
    if (! STATE.selection) await generateInsertQuery(latestResult, file).catch(error => console.warn('Error generating insert query', error));
    let [keysArray, speciesIDBatch, confidenceBatch] = latestResult;
    for (let i = 0; i < keysArray.length; i++) {
        let updateUI = false;
        let key = parseFloat(keysArray[i]);
        const timestamp = metadata[file].fileStart + key * 1000;
        const confidenceArray = confidenceBatch[i];
        const speciesIDArray = speciesIDBatch[i];
        for (let j = 0; j < confidenceArray.length; j++) {
            let confidence = confidenceArray[j];
            if (confidence < 0.05) break;
            confidence*=1000;
            let speciesID = speciesIDArray[j];
            updateUI = (confidence > STATE.detect.confidence && (! included.length || included.includes(speciesID)));
            if (STATE.selection || updateUI) {
                let end, confidenceRequired;
                if (STATE.selection) {
                    const duration = (STATE.selection.end - STATE.selection.start) / 1000;
                    end = key + duration;
                    confidenceRequired = STATE.userSettingsInSelection ?
                    STATE.detect.confidence : 50;
                } else {
                    end = key + 3;
                    confidenceRequired = STATE.detect.confidence;
                }
                if (confidence >= confidenceRequired) {
                    const { cname, sname } = await memoryDB.getAsync(`SELECT cname, sname FROM species WHERE id = ${speciesID}`).catch(error => console.warn('Error getting species name', error));
                    const result = {
                        timestamp: timestamp,
                        position: key,
                        end: end,
                        file: file,
                        cname: cname,
                        sname: sname,
                        score: confidence
                    }
                    sendResult(++index, result, false);
                    // Only show the highest confidence detection, unless it's a selection analysis
                    if (! STATE.selection) break;
                };
            }
        }
    } 
    
    predictionsReceived[file]++;
    const received = sumObjectValues(predictionsReceived);
    const total = sumObjectValues(batchChunksToSend);
    const progress = received / total;
    const fileProgress = predictionsReceived[file] / batchChunksToSend[file];
    UI.postMessage({ event: 'progress', progress: progress, file: file });
    if (fileProgress === 1) {
        if (index === 0 ) {
            const result = `No detections found in ${file}. Searched for records using the ${STATE.list} list and having a minimum confidence of ${STATE.detect.confidence/10}%`
                        UI.postMessage({
                event: 'new-result',
                file: file,
                result: result,
                index: index,
                selection: STATE.selection
            });  
        } 
        updateFilesBeingProcessed(response.file)
        DEBUG && console.log(`File ${file} processed after ${(new Date() - predictionStart) / 1000} seconds: ${filesBeingProcessed.length} files to go`);
    }
    !STATE.selection && (STATE.increment() === 0) && getSummary({ interim: true });
    return response.worker
}
                        
let SEEN_MODEL_READY = false;
async function parseMessage(e) {
    const response = e.data;
    // Update this worker's avaialability
    predictWorkers[response.worker].isAvailable = true;
    
    switch (response['message']) {
        case "model-ready": {
            predictWorkers[response.worker].isReady = true;
            if ( !SEEN_MODEL_READY) {
                SEEN_MODEL_READY = true;
                sampleRate = response["sampleRate"];
                const backend = response["backend"];
                console.log(backend);
                UI.postMessage({
                    event: "model-ready",
                    message: "ready",
                    backend: backend,
                    sampleRate: sampleRate
                });
        }
        break;
        }
        case "prediction": {
            if ( !aborted) {
                predictWorkers[response.worker].isAvailable = true;
                let worker = await parsePredictions(response).catch( (error) =>  console.log('Error parsing predictions', error));
                DEBUG && console.log('predictions left for', response.file, batchChunksToSend[response.file] - predictionsReceived[response.file])
                const remaining = predictionsReceived[response.file] - batchChunksToSend[response.file]
                if (remaining === 0) {
                    if (filesBeingProcessed.length) {
                        processNextFile({ worker: worker });
                    } 
                }
            }
        break;
        }
        case "spectrogram": {onSpectrogram(response["filepath"], response["file"], response["width"], response["height"], response["image"], response["channels"]);
        break;
    }}
}
        
/**
* Called when a files processing is finished
* @param {*} file 
*/
function updateFilesBeingProcessed(file) {
    // This method to determine batch complete
    const fileIndex = filesBeingProcessed.indexOf(file);
    if (fileIndex !== -1) {
        filesBeingProcessed.splice(fileIndex, 1)
        DEBUG && console.log('filesbeingprocessed updated length now :', filesBeingProcessed.length)
    }
    if (!filesBeingProcessed.length) {
        if (!STATE.selection) getSummary();
        // Need this here in case last file is not sent for analysis (e.g. nocmig mode)
        UI.postMessage({event: 'analysis-complete'})
        // // refresh the webgpu backend
        // if (STATE.detect.backend === 'webgpu' ) {
        //     terminateWorkers();
        //     spawnPredictWorkers(STATE.model, STATE.list, BATCH_SIZE, NUM_WORKERS)
        // }
    }
}
        
        
// Optional Arguments
async function processNextFile({
    start = undefined, end = undefined, worker = undefined
} = {}) { 
    if (FILE_QUEUE.length) {
        let file = FILE_QUEUE.shift()
        const found = await getWorkingFile(file).catch(error => console.warn('Error in getWorkingFile', JSON.stringify(error)));
        if (found) {
            if (end) {}
            let boundaries = [];
            if (!start) boundaries = await setStartEnd(file).catch( (error) => console.warn('Error in setStartEnd', error));
            else boundaries.push({ start: start, end: end });
            for (let i = 0; i < boundaries.length; i++) {
                const { start, end } = boundaries[i];
                if (start === end) {
                    // Nothing to do for this file
                    
                    updateFilesBeingProcessed(file);
                    const result = `No detections. ${file} has no period within it where predictions would be given. <b>Tip:</b> To see detections in this file, disable nocmig mode and run the analysis again.`;
                    
                    UI.postMessage({
                        event: 'new-result', file: file, result: result, index: index
                    });
                    
                    DEBUG && console.log('Recursion: start = end')
                    await processNextFile(arguments[0]).catch(error => console.warn('Error in processNextFile call', error));
                    
                } else {
                    if (!sumObjectValues(predictionsReceived)) {
                        UI.postMessage({
                            event: 'progress',
                            text: "<span class='loading text-nowrap'>Awaiting detections</span>",
                            file: file
                        });
                    }
                    await doPrediction({
                        start: start, end: end, file: file, worker: worker
                    }).catch( (error) => console.warn('Error in doPrediction', error, 'file', file, 'start', start, 'end', end));
                }
            }
        } else {
            DEBUG && console.log('Recursion: file not found')
            await processNextFile(arguments[0]).catch(error => console.warn('Error in recursive processNextFile call', error));
        }
    }
}

function sumObjectValues(obj) {
    return Object.values(obj).reduce((total, value) => total + value, 0);
}

function onSameDay(timestamp1, timestamp2) {
    const date1Str = new Date(timestamp1).toLocaleDateString();
    const date2Str = new Date(timestamp2).toLocaleDateString();
    return date1Str === date2Str;
}


// Function to calculate the active intervals for an audio file in nocmig mode

function calculateNighttimeBoundaries(fileStart, fileEnd, latitude, longitude) {
    const activeIntervals = [];
    const maxFileOffset = (fileEnd - fileStart) / 1000;
    const dayNightBoundaries = [];
    //testing
    const startTime = new Date(fileStart);
    //needed
    const endTime = new Date(fileEnd);
    endTime.setHours(23, 59, 59, 999);
    for (let currentDay = new Date(fileStart);
    currentDay <= endTime;
    currentDay.setDate(currentDay.getDate() + 1)) {
        const { dawn, dusk } = SunCalc.getTimes(currentDay, latitude, longitude)
        dayNightBoundaries.push(dawn.getTime(), dusk.getTime())
    }
    
    for (let i = 0; i < dayNightBoundaries.length; i++) {
        const offset = (dayNightBoundaries[i] - fileStart) / 1000;
        // negative offsets are boundaries before the file starts.
        // If the file starts during daylight, we move on
        if (offset < 0) {
            if (!isDuringDaylight(fileStart, latitude, longitude) && i > 0) {
                activeIntervals.push({ start: 0 })
            }
            continue;
        }
        // Now handle 'all daylight' files
        if (offset >= maxFileOffset) {
            if (isDuringDaylight(fileEnd, latitude, longitude)) {
                if (!activeIntervals.length) {
                    activeIntervals.push({ start: 0, end: 0 })
                    return activeIntervals
                }
            }
        }
        // The list pattern is [dawn, dusk, dawn, dusk,...]
        // So every second item is a start trigger
        if (i % 2 !== 0) {
            if (offset > maxFileOffset) break;
            activeIntervals.push({ start: Math.max(offset, 0) });
            // and the others are a stop trigger
        } else {
            activeIntervals.length || activeIntervals.push({ start: 0 })
            activeIntervals[activeIntervals.length - 1].end = Math.min(offset, maxFileOffset);
        }
    }
    activeIntervals[activeIntervals.length - 1].end ??= maxFileOffset;
    return activeIntervals;
}

async function setStartEnd(file) {
    const meta = metadata[file];
    let boundaries;
    //let start, end;
    if (STATE.detect.nocmig) {
        const fileEnd = meta.fileStart + (meta.duration * 1000);
        const sameDay = onSameDay(fileEnd, meta.fileStart);
        const result = await STATE.db.getAsync('SELECT * FROM locations WHERE id = ?', meta.locationID);
        const { lat, lon } = result ? { lat: result.lat, lon: result.lon } : { lat: STATE.lat, lon: STATE.lon };
        boundaries = calculateNighttimeBoundaries(meta.fileStart, fileEnd, lat, lon);
    } else {
        boundaries = [{ start: 0, end: meta.duration }];
    }
    return boundaries;
}


const getSummary = async ({
    species = undefined,
    active = undefined,
    interim = false,
    action = undefined,
} = {}) => {
    const db = STATE.db;
    const included = STATE.selection ? [] : await getIncludedIDs();
    const [sql, params] = prepSummaryStatement(included);
    const offset = species ? STATE.filteredOffset[species] : STATE.globalOffset;

    t0 = Date.now();
    const summary = await STATE.db.allAsync(sql, ...params);
    const event = interim ? 'update-summary' : 'summary-complate';
    UI.postMessage({
        event: event,
        summary: summary,
        offset: offset,
        audacityLabels: AUDACITY,
        filterSpecies: species,
        active: active,
        action: action
    })
};


const getPosition = async ({species = undefined, dateTime = undefined, included = []} = {}) => {
    const params = [STATE.detect.confidence];
    let positionStmt = `      
    WITH ranked_records AS (
        SELECT 
        dateTime,
        cname,
        RANK() OVER (PARTITION BY fileID, dateTime ORDER BY records.confidence DESC) AS rank
        FROM records 
        JOIN species ON records.speciesID = species.id 
        JOIN files ON records.fileID = files.id 
        WHERE confidence >= ?
        `;
    // If you're using the memory db, you're either anlaysing one,  or all of the files
    if (['analyse'].includes(STATE.mode) && STATE.filesToAnalyse.length === 1) {
        positionStmt += ` AND name IN  (${prepParams(STATE.filesToAnalyse)}) `;
        params.push(...STATE.filesToAnalyse);
    }
    else if (['archive'].includes(STATE.mode)) {
        positionStmt += ` AND name IN  (${prepParams(STATE.filesToAnalyse)}) `;
        params.push(...STATE.filesToAnalyse);
    }
        // Prioritise selection ranges
        const range = STATE.selection?.start ? STATE.selection :
        STATE.mode === 'explore' ? STATE.explore.range : false;
        const useRange = range?.start;  
        if (useRange) {
            positionStmt += ' AND dateTime BETWEEN ? AND ? ';
            params.push(range.start,range.end)
        }    
        if (filtersApplied(included)){
                const included = await getIncludedIDs();
                positionStmt += ` AND speciesID IN (${prepParams(included)}) `;
                params.push(...included)
        }
        if (STATE.locationID) {
            positionStmt += ` AND locationID = ? `;
            params.push(STATE.locationID)
        }
        if (STATE.detect.nocmig){
            positionStmt += ' AND COALESCE(isDaylight, 0) != 1 '; // Backward compatibility for < v0.9.
        }
        
        positionStmt += `)
        SELECT 
        count(*) as count, dateTime
        FROM ranked_records
        WHERE rank <= ? AND dateTime < ?`;
        params.push(STATE.topRankin, dateTime);
        if (species) {
            positionStmt+=  ` AND  cname = ? `;
            params.push(species)
        };
    const {count} = await STATE.db.getAsync(positionStmt, ...params);
    return count
}

/**
*
* @param files: files to query for detections
* @param species: filter for SQL query
* @param limit: the pagination limit per page
* @param offset: is the SQL query offset to use
* @param topRankin: return results >= to this rank for each datetime
* @param directory: if set, will export audio of the returned results to this folder
* @param format: whether to export audio or text
*
* @returns {Promise<integer> } A count of the records retrieved
*/
const getResults = async ({
    species = undefined,
    limit = STATE.limit,
    offset = undefined,
    topRankin = STATE.topRankin,
    directory = undefined,
    format = undefined,
    active = undefined,
    select = undefined
} = {}) => {
    let confidence = STATE.detect.confidence;
    const included = STATE.selection ? [] : await getIncludedIDs();
    if (select) {
        const position = await getPosition({species: species, dateTime: select.dateTime, included: included});
        offset = Math.floor(position/limit) * limit;
        // update the pagination
        const [total, , ] = await getTotal({species: species, offset: offset, included: included})
        UI.postMessage({event: 'total-records', total: total, offset: offset, species: species})
    }
    offset = offset ?? (species ? (STATE.filteredOffset[species] ?? 0) : STATE.globalOffset);
    if (species) STATE.filteredOffset[species] = offset;
    else STATE.update({ globalOffset: offset });
    
    
    let index = offset;
    AUDACITY = {};
    //const params = getResultsParams(species, confidence, offset, limit, topRankin, included);
    const [sql, params] = prepResultsStatement(species, limit === Infinity, included, offset, topRankin);
    
    const result = await STATE.db.allAsync(sql, ...params);
    let formattedValues;
    if (format === 'text' || format === 'eBird'){
        // CSV export. Format the values
        formattedValues = await Promise.all(result.map(async (item) => {
            return format === 'text' ? await formatCSVValues(item) : await formateBirdValues(item) 

        }));
        if (format === 'eBird'){
            // Group the data by "Start Time", "Common name", and "Species" and calculate total species count for each group
            const summary = formattedValues.reduce((acc, curr) => {
                const key = `${curr["Start Time"]}_${curr["Common name"]}_${curr["Species"]}`;
                if (!acc[key]) {
                    acc[key] = {
                        "Common name": curr["Common name"],
                        // Include other fields from the original data
                        "Genus": curr["Genus"],
                        "Species": curr["Species"],
                        "Species Count": 0,
                        "Species Comments": curr["Species Comments"],
                        "Location Name": curr["Location Name"],
                        "Latitude": curr["Latitude"],
                        "Longitude": curr["Longitude"],
                        "Date": curr["Date"],
                        "Start Time": curr["Start Time"],
                        "State/Province": curr["State/Province"],
                        "Country": curr["Country"],
                        "Protocol": curr["Protocol"],
                        "Number of observers": curr["Number of observers"],
                        "Duration": curr["Duration"],
                        "All observations reported?": curr["All observations reported?"],
                        "Distance covered": curr["Distance covered"],
                        "Area covered": curr["Area covered"],
                        "Submission Comments": curr["Submission Comments"]
                    };
                }
                // Increment total species count for the group
                acc[key]["Species Count"] += curr["Species Count"];
                return acc;
            }, {});
            // Convert summary object into an array of objects
            formattedValues = Object.values(summary);

        }
        // Create a write stream for the CSV file
        let filename = species || 'All';
        filename += '_detections.csv';
        const filePath = p.join(directory, filename);
        writeToPath(filePath, formattedValues, {headers: true})
        .on('error', err => UI.postMessage({event: 'generate-alert', message: `Cannot save file ${filePath}\nbecause it is open in another application`}))
        .on('finish', () => {
            UI.postMessage({event: 'generate-alert', message: filePath + ' has been written successfully.'});
        });
    }
    else {
        for (let i = 0; i < result.length; i++) {
            const r = result[i];
            if (format === 'audio') {
                if (limit){
                    // Audio export. Format date to YYYY-MM-DD-HH-MM-ss
                    const dateString = new Date(r.timestamp).toISOString().replace(/[TZ]/g, ' ').replace(/\.\d{3}/, '').replace(/[-:]/g, '-').trim();
                    const filename = `${r.cname}-${dateString}.${STATE.audio.format}`
                    DEBUG && console.log(`Exporting from ${r.file}, position ${r.position}, into folder ${directory}`)
                    saveAudio(r.file, r.position, r.position + 3, filename, metadata, directory)
                    i === result.length - 1 && UI.postMessage({ event: 'generate-alert', message: `${result.length} files saved` })
                } 
            }
            else if (species && STATE.mode !== 'explore') {
                // get a number for the circle
                const { count } = await STATE.db.getAsync(`SELECT COUNT(*) as count FROM records WHERE dateTime = ?
                AND confidence >= ? and fileID = ?`, r.timestamp, confidence, r.fileID);
                r.count = count;
                sendResult(++index, r, true);
            } else {
                sendResult(++index, r, true)
            }
           if (i === result.length -1) UI.postMessage({event: 'processing-complete'})
        }
        if (!result.length) {
            if (STATE.selection) {
                // No more detections in the selection
                sendResult(++index, 'No detections found in the selection', true)
            } else {
                species = species || '';
                const nocmig = STATE.detect.nocmig ? '<b>nocturnal</b>' : ''
                sendResult(++index, `No ${nocmig} ${species} detections found using the ${STATE.list} list.`, true)
            }
        }
    }
    STATE.selection || UI.postMessage({event: 'database-results-complete', active: active, select: select?.start});
};

// Function to format the CSV export
async function formatCSVValues(obj) {
    // Create a copy of the original object to avoid modifying it directly
    const modifiedObj = { ...obj };
    // Get lat and lon
    const result = await STATE.db.getAsync(`
        SELECT lat, lon, place 
        FROM files JOIN locations on locations.id = files.locationID 
        WHERE files.name = ? `, modifiedObj.file);
    const latitude =  result?.lat || STATE.lat;
    const longitude =  result?.lon || STATE.lon;
    const place =  result?.place || STATE.place;
    modifiedObj.score /= 1000;
    modifiedObj.score = modifiedObj.score.toString().replace(/^2$/, 'confirmed');
    // Step 2: Multiply 'end' by 1000 and add 'timestamp'
    modifiedObj.end = (modifiedObj.end - modifiedObj.position) * 1000  + modifiedObj.timestamp;
    
    // Step 3: Convert 'timestamp' and 'end' to a formatted string
    modifiedObj.timestamp = formatDate(modifiedObj.timestamp)
    modifiedObj.end = formatDate(modifiedObj.end);
    // Create a new object with the right headers
    const newObj = {};
    newObj['File'] = modifiedObj.file
    newObj['Detection start'] = modifiedObj.timestamp
    newObj['Detection end'] = modifiedObj.end
    newObj['Common name'] = modifiedObj.cname
    newObj['Latin name'] = modifiedObj.sname
    newObj['Confidence'] = modifiedObj.score
    newObj['Label'] = modifiedObj.label
    newObj['Comment'] = modifiedObj.comment
    newObj['Call count'] = modifiedObj.callCount
    newObj['File offset'] = secondsToHHMMSS(modifiedObj.position)
    newObj['Latitude'] = latitude;
    newObj['Longitude'] = longitude;
    newObj['Place'] = place;
    return newObj;
}

// Function to format the eBird export
async function formateBirdValues(obj) {
    // Create a copy of the original object to avoid modifying it directly
    const modifiedObj = { ...obj };
    // Get lat and lon
    const result = await STATE.db.getAsync(`
        SELECT lat, lon, place 
        FROM files JOIN locations on locations.id = files.locationID 
        WHERE files.name = ? `, modifiedObj.file);
    const latitude =  result?.lat || STATE.lat;
    const longitude =  result?.lon || STATE.lon;
    const place =  result?.place || STATE.place;
    modifiedObj.timestamp = formatDate(modifiedObj.filestart);
    let [date, time] = modifiedObj.timestamp.split(' ');
    const [year, month, day] = date.split('-');
    date = `${month}/${day}/${year}`;
    const [hours, minutes] = time.split(':')
    time = `${hours}:${minutes}`;
    if (STATE.model === 'chirpity'){
        // Regular expression to match the words inside parentheses
        const regex = /\(([^)]+)\)/;
        const matches = modifiedObj.cname.match(regex);
        // Splitting the input string based on the regular expression match
        const [name, calltype] = modifiedObj.cname.split(regex);
        modifiedObj.cname = name.trim(); // Output: "words words"
        modifiedObj.comment ??= calltype;
    }
    const [genus, species] = modifiedObj.sname.split(' ');
    // Create a new object with the right keys
    const newObj = {};
    newObj['Common name'] = modifiedObj.cname;
    newObj['Genus'] = genus;
    newObj['Species'] = species;
    newObj['Species Count'] = modifiedObj.callCount || 1;
    newObj['Species Comments'] = modifiedObj.comment?.replace(/\r?\n/g, ' ');
    newObj['Location Name'] = place;
    newObj['Latitude'] = latitude;
    newObj['Longitude'] = longitude;
    newObj['Date'] = date;
    newObj['Start Time'] = time;
    newObj['State/Province'] = '';
    newObj['Country'] = '';
    newObj['Protocol'] = 'Stationary';
    newObj['Number of observers'] = '1';
    newObj['Duration'] = Math.ceil(modifiedObj.duration / 60);
    newObj['All observations reported?'] = 'N';
    newObj['Distance covered'] = '';
    newObj['Area covered'] = '';
    newObj['Submission Comments'] = 'Submission initially generated from Chirpity';
    return newObj;
}

function secondsToHHMMSS(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    const HH = String(hours).padStart(2, '0');
    const MM = String(minutes).padStart(2, '0');
    const SS = String(remainingSeconds).padStart(2, '0');
    
    return `${HH}:${MM}:${SS}`;
}

const formatDate = (timestamp) =>{
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

const sendResult = (index, result, fromDBQuery) => {
    const file = result.file;
    if (typeof result === 'object') {
        // Convert confidence back to % value
        result.score = (result.score / 10).toFixed(0)
        // Recreate Audacity labels (will create filtered view of labels if filtered)
        const audacity = {
            timestamp: `${result.position}\t${result.position + WINDOW_SIZE}`,
            cname: result.cname,
            score: Number(result.score) / 100
        };
        AUDACITY[file] ??= [];
        AUDACITY[file].push(audacity);
    }
    UI.postMessage({
        event: 'new-result',
        file: file,
        result: result,
        index: index,
        isFromDB: fromDBQuery,
        selection: STATE.selection
    });
};


const getSavedFileInfo = async (file) => {
    if (diskDB){
        // look for file in the disk DB, ignore extension        
        let row = await diskDB.getAsync('SELECT * FROM files LEFT JOIN locations ON files.locationID = locations.id WHERE name = ?',file);
        if (!row) {
            const baseName = file.replace(/^(.*)\..*$/g, '$1%');
            row = await diskDB.getAsync('SELECT * FROM files LEFT JOIN locations ON files.locationID = locations.id WHERE name LIKE  (?)',baseName);
        } 
        return row
    } else {
        UI.postMessage({event: 'generate-alert', message: 'The database has not finished loading. The check for the presence of the file in the archive has been skipped'})
        return undefined
    }
};


/**
*  Transfers data in memoryDB to diskDB
* @returns {Promise<unknown>}
*/
const onSave2DiskDB = async ({file}) => {
    t0 = Date.now();
    if (STATE.db === diskDB) {
        UI.postMessage({
            event: 'generate-alert',
            message: `Records already saved, nothing to do`
        })
        return // nothing to do. Also will crash if trying to update disk from disk.
    }
    const included = await getIncludedIDs(file);
    let filterClause = filtersApplied(included) ? `AND speciesID IN (${included} )` : '';
    if (STATE.detect.nocmig) filterClause += ' AND isDaylight = TRUE ';
    await memoryDB.runAsync('BEGIN');
    await memoryDB.runAsync(`INSERT OR IGNORE INTO disk.files SELECT * FROM files`);
    await memoryDB.runAsync(`INSERT OR IGNORE INTO disk.locations SELECT * FROM locations`);
    // Set the saved flag on files' metadata
    for (let file in metadata) {
        metadata[file].isSaved = true
    }
    // Update the duration table
    let response = await memoryDB.runAsync('INSERT OR IGNORE INTO disk.duration SELECT * FROM duration');
    DEBUG && console.log(response.changes + ' date durations added to disk database');
    // now update records
    response = await memoryDB.runAsync(`
    INSERT OR IGNORE INTO disk.records 
    SELECT * FROM records
    WHERE confidence >= ${STATE.detect.confidence} ${filterClause} `);
    DEBUG && console.log(response?.changes + ' records added to disk database');
    await memoryDB.runAsync('END');
    DEBUG && console.log("transaction ended");
    if (response?.changes) {
        UI.postMessage({ event: 'diskDB-has-records' });
        if (!DATASET) {
            
            // Now we have saved the records, set state to DiskDB
            await onChangeMode('archive');
            getLocations({ db: STATE.db, file: file });
            UI.postMessage({
                event: 'generate-alert',
                message: `Database update complete, ${response.changes} records added to the archive in ${((Date.now() - t0) / 1000)} seconds`,
                updateFilenamePanel: true
            })
        }
    }
};

const filterLocation = () => STATE.locationID ? ` AND files.locationID = ${STATE.locationID}` : '';

const getSeasonRecords = async (species, season) => {
    // Add Location filter
    const locationFilter = filterLocation();
    // Because we're using stmt.prepare, we need to unescape quotes
    const seasonMonth = { spring: "< '07'", autumn: " > '06'" }
    return new Promise(function (resolve, reject) {
        const stmt = diskDB.prepare(`
        SELECT MAX(SUBSTR(DATE(records.dateTime/1000, 'unixepoch', 'localtime'), 6)) AS maxDate,
        MIN(SUBSTR(DATE(records.dateTime/1000, 'unixepoch', 'localtime'), 6)) AS minDate
        FROM records
        JOIN species ON species.id = records.speciesID
        JOIN files ON files.id = records.fileID
        WHERE species.cname = (?) ${locationFilter}
        AND STRFTIME('%m',
        DATETIME(records.dateTime / 1000, 'unixepoch', 'localtime'))
        ${seasonMonth[season]}`);
        stmt.get(species, (err, row) => {
            if (err) {
                reject(err)
            } else {
                resolve(row)
            }
        })
    })
};

const getMostCalls = (species) => {
    return new Promise(function (resolve, reject) {
        // Add Location filter
        const locationFilter = filterLocation();
        diskDB.get(`
        SELECT COUNT(*) as count, 
        DATE(dateTime/1000, 'unixepoch', 'localtime') as date
        FROM records 
        JOIN species on species.id = records.speciesID
        JOIN files ON files.id = records.fileID
        WHERE species.cname = '${prepSQL(species)}' ${locationFilter}
        GROUP BY STRFTIME('%Y', DATETIME(dateTime/1000, 'unixepoch', 'localtime')),
        STRFTIME('%W', DATETIME(dateTime/1000, 'unixepoch', 'localtime')),
        STRFTIME('%d', DATETIME(dateTime/1000, 'unixepoch', 'localtime'))
        ORDER BY count DESC LIMIT 1`, (err, row) => {
            if (err) {
                reject(err)
            } else {
                resolve(row)
            }
        })
    })
}

const getChartTotals = ({
    species = undefined, range = {}, aggregation = 'Week'
}) => {
    // Add Location filter
    const locationFilter = filterLocation();
    const dateRange = range;
    
    // Work out sensible aggregations from hours difference in date range
    const hours_diff = dateRange.start ? Math.round((dateRange.end - dateRange.start) / (1000 * 60 * 60)) : 745;
    DEBUG && console.log(hours_diff, "difference in hours")
    
    const dateFilter = dateRange.start ? ` AND dateTime BETWEEN ${dateRange.start} AND ${dateRange.end} ` : '';
    
    // Default values for grouping
    let groupBy = "Year, Week";
    let orderBy = 'Year';
    let dataPoints = Math.max(52, Math.round(hours_diff / 24 / 7));
    let startDay = 0;
    
    // Update grouping based on aggregation parameter
    if (aggregation === 'Day') {
        groupBy += ", Day";
        orderBy = 'Year, Week';
        dataPoints = Math.round(hours_diff / 24);
        const date = dateRange.start !== undefined ? new Date(dateRange.start) : new Date(Date.UTC(2020, 0, 0, 0, 0, 0));
        startDay = Math.floor((date - new Date(date.getFullYear(), 0, 0, 0, 0, 0)) / 1000 / 60 / 60 / 24);
    } else if (aggregation === 'Hour') {
        groupBy = "Hour";
        orderBy = 'CASE WHEN Hour >= 12 THEN Hour - 12 ELSE Hour + 12 END';
        dataPoints = 24;
        const date = dateRange.start !== undefined ? new Date(dateRange.start) : new Date(Date.UTC(2020, 0, 0, 0, 0, 0));
        startDay = Math.floor((date - new Date(date.getFullYear(), 0, 0, 0, 0, 0)) / 1000 / 60 / 60 / 24);
    }
    
    return new Promise(function (resolve, reject) {
        diskDB.all(`SELECT CAST(STRFTIME('%Y', DATETIME(dateTime / 1000, 'unixepoch', 'localtime')) AS INTEGER) AS Year, 
        CAST(STRFTIME('%W', DATETIME(dateTime/1000, 'unixepoch', 'localtime')) AS INTEGER) AS Week,
        CAST(STRFTIME('%j', DATETIME(dateTime/1000, 'unixepoch', 'localtime')) AS INTEGER) AS Day, 
        CAST(STRFTIME('%H', DATETIME(dateTime/1000, 'unixepoch', 'localtime')) AS INTEGER) AS Hour,    
        COUNT(*) as count
        FROM records
        JOIN species ON species.id = speciesID
        JOIN files ON files.id = fileID
        WHERE species.cname = '${species}' ${dateFilter} ${locationFilter}
        GROUP BY ${groupBy}
        ORDER BY ${orderBy};`, (err, rows) => {
            if (err) {
                reject(err)
            } else {
                resolve([rows, dataPoints, aggregation, startDay])
            }
        })
    })
}
        
const getRate = (species) => {
    return new Promise(function (resolve, reject) {
        const calls = Array.from({length: 52}).fill(0);
        const total = Array.from({length: 52}).fill(0);
        // Add Location filter
        const locationFilter = filterLocation();
        
        diskDB.all(`select STRFTIME('%W', DATE(dateTime / 1000, 'unixepoch', 'localtime')) as week, COUNT(*) as calls
        from records
        JOIN species ON species.id = records.speciesID
        JOIN files ON files.id = records.fileID
        WHERE species.cname = '${species}' ${locationFilter}
        group by week;`, (err, rows) => {
            for (let i = 0; i < rows.length; i++) {
                calls[parseInt(rows[i].week) - 1] = rows[i].calls;
            }
            diskDB.all("select STRFTIME('%W', DATE(duration.day / 1000, 'unixepoch', 'localtime')) as week, cast(sum(duration) as real)/3600  as total from duration group by week;", (err, rows) => {
                for (let i = 0; i < rows.length; i++) {
                    // Round the total to 2 dp
                    total[parseInt(rows[i].week) - 1] = Math.round(rows[i].total * 100) / 100;
                }
                let rate = [];
                for (let i = 0; i < calls.length; i++) {
                    total[i] > 0 ? rate[i] = Math.round((calls[i] / total[i]) * 100) / 100 : rate[i] = 0;
                }
                if (err) {
                    reject(err)
                } else {
                    resolve([total, rate])
                }
            })
        })
    })
}

/**
 * getDetectedSpecies generates a list of species to use in dropdowns for chart and explore mode filters
 * It doesn't really make sense to use location specific filtering here, as there is a location filter in the 
 * page. For now, I'm just going skip the included IDs filter if location mode is selected
 */
const getDetectedSpecies = () => {
    const range = STATE.explore.range;
    const confidence = STATE.detect.confidence;
    let sql = `SELECT cname, locationID
    FROM records
    JOIN species ON species.id = records.speciesID 
    JOIN files on records.fileID = files.id`;
    
    if (STATE.mode === 'explore') sql += ` WHERE confidence >= ${confidence}`;
    if (STATE.list !== 'location' && filtersApplied(STATE.included)) {
        sql += ` AND speciesID IN (${STATE.included.join(',')})`;
    }
    if (range?.start) sql += ` AND datetime BETWEEN ${range.start} AND ${range.end}`;
    sql += filterLocation();
    sql += ' GROUP BY cname ORDER BY cname';
    diskDB.all(sql, (err, rows) => {
        err ? console.log(err) : UI.postMessage({ event: 'seen-species-list', list: rows })
    })
};

/**
 *  getValidSpecies generates a list of species included/excluded based on settings
 *  For week specific lists, we need the file
 * @returns Promise <void>
 */
const getValidSpecies = async (file) => {
    const included = await getIncludedIDs(file);
    let excludedSpecies, includedSpecies;
    let sql = `SELECT cname, sname FROM species`;
    // We'll ignore Unknown Sp. here, hence length < (LABELS.length *-1*)

    if (filtersApplied(included)) {
        sql += ` WHERE id IN (${included.join(',')})`;
    }
    sql += ' GROUP BY cname ORDER BY cname';
    includedSpecies = await diskDB.allAsync(sql)
    
    if (filtersApplied(included)){
        sql = sql.replace('IN', 'NOT IN');
        excludedSpecies = await diskDB.allAsync(sql);
    }
    UI.postMessage({ event: 'valid-species-list', included: includedSpecies, excluded: excludedSpecies })
};

const onUpdateFileStart = async (args) => {
    let file = args.file;
    const newfileMtime = Math.round(args.start + (metadata[file].duration * 1000));
    utimesSync(file, newfileMtime);
    metadata[file].fileStart = args.start;
    let db = STATE.db;
    let row = await db.getAsync('SELECT id from files where name = ?', file);
    let result;
    if (!row) {
        DEBUG && console.log('File not found in database, adding.');
        await db.runAsync('INSERT INTO files (id, name, duration, filestart) values (?, ?, ?, ?)', undefined, file, metadata[file].duration, args.start);
        // If no file, no records, so we're done.
    }
    else {
        const id = row.id;
        const { changes } = await db.runAsync('UPDATE files SET filestart = ? where id = ?', args.start, id);
        DEBUG && console.log(changes ? `Changed ${file}` : `No changes made`);
        // Fill with new values
        result = await db.runAsync('UPDATE records set dateTime = (position * 1000) + ? WHERE fileID = ?', args.start, id);
    }
};


const prepSQL = (string) => string.replaceAll("''", "'").replaceAll("'", "''");


async function onDelete({
    file,
    start,
    end,
    species,
    active,
    // need speciesfiltered because species triggers getSummary to highlight it
    speciesFiltered
}) {
    const db = STATE.db;
    const { id, filestart } = await db.getAsync('SELECT id, filestart from files WHERE name = ?', file);
    const datetime = filestart + (parseFloat(start) * 1000);
    end = parseFloat(end);
    const params = [id, datetime, end];
    let sql = 'DELETE FROM records WHERE fileID = ? AND datetime = ? AND end = ?';
    if (species) {
        sql += ' AND speciesID = (SELECT id FROM species WHERE cname = ?)'
        params.push(species);
    }
    // let test = await db.allAsync('SELECT * from records WHERE speciesID = (SELECT id FROM species WHERE cname = ?)', species)
    // console.log('After insert: ',JSON.stringify(test));
    let { changes } = await db.runAsync(sql, ...params);
    if (changes) {
        if (STATE.mode !== 'selection') {
            // Update the summary table
            if (speciesFiltered === false) {
                delete arguments[0].species
            }
            await getSummary(arguments[0]);
        }
        // Update the seen species list
        if (db === diskDB) {
            getDetectedSpecies();
        } else {
            UI.postMessage({event: 'unsaved-records'});
        }
    }
}

async function onDeleteSpecies({
    species,
    // need speciesfiltered because species triggers getSummary to highlight it
    speciesFiltered
}) {
    const db = STATE.db;
    const params = [species];
    let SQL = `DELETE FROM records 
    WHERE speciesID = (SELECT id FROM species WHERE cname = ?)`;
    if (STATE.mode === 'analyse') {
        const rows = await db.allAsync(`SELECT id FROM files WHERE NAME IN (${prepParams(STATE.filesToAnalyse)})`, ...STATE.filesToAnalyse);
        const ids = rows.map(row => row.id).join(',');
        SQL += ` AND fileID in (${ids})`;
    }
    else if (STATE.mode === 'explore') {
        const { start, end } = STATE.explore.range;
        if (start) SQL += ` AND dateTime BETWEEN ${start} AND ${end}`
    }
    let { changes } = await db.runAsync(SQL, ...params);
    if (changes) {
        if (db === diskDB) {
            // Update the seen species list
            getDetectedSpecies();
        } else {
            UI.postMessage({event: 'unsaved-records'});
        }
    }
}


async function onChartRequest(args) {
    DEBUG && console.log(`Getting chart for ${args.species} starting ${args.range.start}`);
    const dateRange = args.range, results = {}, dataRecords = {};
    // Escape apostrophes
    if (args.species) {
        t0 = Date.now();
        await getSeasonRecords(args.species, 'spring')
        .then((result) => {
            dataRecords.earliestSpring = result['minDate'];
            dataRecords.latestSpring = result['maxDate'];
        }).catch((error) => {
            console.log(error)
        })
        
        await getSeasonRecords(args.species, 'autumn')
        .then((result) => {
            dataRecords.earliestAutumn = result['minDate'];
            dataRecords.latestAutumn = result['maxDate'];
        }).catch((error) => {
            console.log(error)
        })
        
        DEBUG && console.log(`Season chart generation took ${(Date.now() - t0) / 1000} seconds`)
        t0 = Date.now();
        await getMostCalls(args.species)
        .then((row) => {
            row ? dataRecords.mostDetections = [row.count, row.date] : dataRecords.mostDetections = ['N/A', 'Not detected'];
        }).catch((error) => {
            console.log(error)
        })
        
        DEBUG && console.log(`Most calls  chart generation took ${(Date.now() - t0) / 1000} seconds`)
        t0 = Date.now();
        args.species = prepSQL(args.species);
    }
    const [dataPoints, aggregation] = await getChartTotals(args)
    .then(([rows, dataPoints, aggregation, startDay]) => {
        for (let i = 0; i < rows.length; i++) {
            const year = rows[i].Year;
            const week = rows[i].Week;
            const day = rows[i].Day;
            const hour = rows[i].Hour;
            const count = rows[i].count;
            // stack years
            if (!(year in results)) {
                results[year] = Array.from({length: dataPoints}).fill(0);
            }
            if (aggregation === 'Week') {
                results[year][parseInt(week) - 1] = count;
            } else if (aggregation === 'Day') {
                results[year][parseInt(day) - startDay] = count;
            } else {
                // const d = new Date(dateRange.start);
                // const hoursOffset = d.getHours();
                // const index = ((parseInt(day) - startDay) * 24) + (parseInt(hour) - hoursOffset);
                results[year][hour] = count;
            }
        }
        return [dataPoints, aggregation]
    }).catch((error) => {
        console.log(error)
    })
    
    DEBUG && console.log(`Chart series generation took ${(Date.now() - t0) / 1000} seconds`)
    t0 = Date.now();
    // If we have a years worth of data add total recording duration and rate
    let total, rate;
    if (dataPoints === 52) [total, rate] = await getRate(args.species)
    DEBUG && console.log(`Chart rate generation took ${(Date.now() - t0) / 1000} seconds`)
    const pointStart = dateRange.start ??= Date.UTC(2020, 0, 0, 0, 0, 0);
    UI.postMessage({
        event: 'chart-data', // Restore species name
        species: args.species ? args.species.replace("''", "'") : undefined,
        results: results,
        rate: rate,
        total: total,
        records: dataRecords,
        dataPoints: dataPoints,
        pointStart: pointStart,
        aggregation: aggregation
    })
}

const onFileDelete = async (fileName) => {
    const result = await diskDB.runAsync('DELETE FROM files WHERE name = ?', fileName);
    if (result.changes) {
        //await onChangeMode('analyse');
        getDetectedSpecies();
        UI.postMessage({
            event: 'generate-alert',
            message: `${fileName} 
            and its associated records were deleted successfully`,
            updateFilenamePanel: true
        });
        await Promise.all([getResults(), getSummary()] );
    } else {
        UI.postMessage({
            event: 'generate-alert', message: `${fileName} 
            was not found in the Archve databasse.`
        });
    }
}
    
async function onUpdateLocale(locale, labels, refreshResults){
    let t0 = performance.now();
    await diskDB.runAsync('BEGIN');
    await memoryDB.runAsync('BEGIN');
    if (STATE.model === 'birdnet'){
        for (let i = 0; i < labels.length; i++){
            const [sname, cname] = labels[i].trim().split('_');
            await diskDB.runAsync('UPDATE species SET cname = ? WHERE sname = ?', cname, sname);
            await memoryDB.runAsync('UPDATE species SET cname = ? WHERE sname = ?', cname, sname);
        }
    } else {
        for (let i = 0; i < labels.length; i++) {
            const [sname, newCname] = labels[i].split('_');
            // For chirpity, we check if the existing cname ends with a <call type> in brackets
            const existingCnameResult = await memoryDB.allAsync('SELECT cname FROM species WHERE sname = ?', sname);
            if (existingCnameResult.length) {
                for (let i = 0; i < existingCnameResult.length; i++){
                    const {cname} = existingCnameResult[i];
                    const existingCname = cname;
                    const existingCnameMatch = existingCname.match(/\(([^)]+)\)$/); // Regex to match word(s) within brackets at the end of the string
                    const newCnameMatch = newCname.match(/\(([^)]+)\)$/);
                    // Do we have a spcific call type to match?
                    if (newCnameMatch){
                        // then only update the database where existing and new call types match
                        if (newCnameMatch[0] === existingCnameMatch[0]){
                            const callTypeMatch = '%' + newCnameMatch[0] + '%' ;
                            await diskDB.runAsync("UPDATE species SET cname = ? WHERE sname = ? AND cname LIKE ?", newCname, sname, callTypeMatch);
                            await memoryDB.runAsync("UPDATE species SET cname = ? WHERE sname = ? AND cname LIKE ?", newCname, sname, callTypeMatch);
                        }
                    } else { // No (<call type>) in the new label - so we add the new name to all the species call types in the database
                        let appendedCname = newCname, bracketedWord;
                        if (existingCnameMatch) {
                            bracketedWord = existingCnameMatch[0];
                            appendedCname += ` ${bracketedWord}`; // Append the bracketed word to the new cname (for each of the existingCnameResults)
                            const callTypeMatch = '%' + bracketedWord + '%';
                            await diskDB.runAsync("UPDATE species SET cname = ? WHERE sname = ? AND cname LIKE ?", appendedCname, sname, callTypeMatch);
                            await memoryDB.runAsync("UPDATE species SET cname = ? WHERE sname = ? AND cname LIKE ?", appendedCname, sname, callTypeMatch);
                        } else {
                            await diskDB.runAsync("UPDATE species SET cname = ? WHERE sname = ?", appendedCname, sname);
                            await memoryDB.runAsync("UPDATE species SET cname = ? WHERE sname = ?", appendedCname, sname);
                        }
                    }
                }
            }
        }
    }
    await diskDB.runAsync('END');
    await memoryDB.runAsync('END');
    STATE.update({locale: locale});
    if (refreshResults) await Promise.all([getResults(), getSummary()])
}
    
async function onSetCustomLocation({ lat, lon, place, files, db = STATE.db }) {
    if (!place) {
        const { id } = await db.getAsync(`SELECT id FROM locations WHERE lat = ? AND lon = ?`, lat, lon);
        const result = await db.runAsync(`DELETE FROM locations WHERE lat = ? AND lon = ?`, lat, lon);
        if (result.changes) {
            await db.runAsync(`UPDATE files SET locationID = null WHERE locationID = ?`, id);
        }
        if (db === memoryDB) {
            onSetCustomLocation({lat: lat, lon: lon, place: undefined, files: undefined, db: diskDB})
        }
    } else {
        const result = await db.runAsync(`
        INSERT INTO locations VALUES (?, ?, ?, ?)
        ON CONFLICT(lat,lon) DO UPDATE SET place = excluded.place`, undefined, lat, lon, place);
        const { id } = await db.getAsync(`SELECT ID FROM locations WHERE lat = ? AND lon = ?`, lat, lon);
        for (const file of files) {
            await db.runAsync('UPDATE files SET locationID = ? WHERE name = ?', id, file);
            // we may not have set the metadata for the file
            if (metadata[file]) {
                metadata[file].locationID = id; 
            } else {
                metadata[file] = {}
                metadata[file].locationID = id;
                metadata[file].isComplete = false;
            }
            // tell the UI the file has a location id
            UI.postMessage({ event: 'file-location-id', file: file, id: id });
            // state.db is set onAnalyse, so check if the file is saved
            if (db === memoryDB) {
                const fileSaved = await getSavedFileInfo(file)
                if (fileSaved) {
                    onSetCustomLocation({lat: lat, lon: lon, place: place, files: [file], db: diskDB})
                }
            }
        }
    }
    await getLocations({ db: db, file: files[0] });
}
    
async function getLocations({ db = STATE.db, file }) {
    const locations = await db.allAsync('SELECT * FROM locations ORDER BY place')
    UI.postMessage({ event: 'location-list', locations: locations, currentLocation: metadata[file]?.locationID })
}
    
/**
 * getIncludedIDs
 * Helper function to provide a list of valid species for the filter. 
 * Will look for a list in the STATE.included cache, and if not present, 
 * will call setIncludedIDs to generate a new list
 * @param {*} file 
 * @returns a list of IDs included in filtered results
 */
async function getIncludedIDs(file){
    t0 = Date.now();
    let lat, lon, week, hitOrMiss = 'hit';
    if (STATE.list === 'location' || (STATE.list === 'nocturnal' && STATE.local)){
        if (file){
            file = metadata[file];
            week = STATE.useWeek ? new Date(file.fileStart).getWeekNumber() : "-1";
            lat = file.lat || STATE.lat;
            lon = file.lon || STATE.lon;
            STATE.week = week;
        } else {
            // summary context: use the week, lat & lon from the first file??
            lat = STATE.lat, lon = STATE.lon;
            week = STATE.useWeek ? STATE.week : "-1";
        }
        const location = lat.toString() + lon.toString();
        if (STATE.included?.[STATE.model]?.[STATE.list]?.[week]?.[location] === undefined ) {
            // Cache miss
            const list = await setIncludedIDs(lat,lon,week)
            hitOrMiss = 'miss';
        } 
        //DEBUG && console.log(`Cache ${hitOrMiss}: setting the ${STATE.list} list took ${Date.now() -t0}ms`)
        return STATE.included[STATE.model][STATE.list][week][location];
        
    } else {
        if (STATE.included?.[STATE.model]?.[STATE.list] === undefined) {
            // The object lacks the week / location
            LIST_WORKER && await setIncludedIDs();
            hitOrMiss = 'miss';
        }
        //DEBUG && console.log(`Cache ${hitOrMiss}: setting the ${STATE.list} list took ${Date.now() -t0}ms`)
        return STATE.included[STATE.model][STATE.list];
    }
}

/**
 * setIncludedIDs
 * Calls list_worker for a new list, checks to see if a pending promise already exists
 * @param {*} lat 
 * @param {*} lon 
 * @param {*} week 
 * @returns 
 */

let LIST_CACHE = {};

async function setIncludedIDs(lat, lon, week) {
    const key = `${lat}-${lon}-${week}-${STATE.model}-${STATE.list}`;
    if (LIST_CACHE[key]) {
        // If a promise is in the cache, return it
        return await LIST_CACHE[key];
    }
    console.log('calling for a new list')
    // Store the promise in the cache immediately
    LIST_CACHE[key] = (async () => {
        const { result, messages } = await LIST_WORKER({
            message: 'get-list',
            model: STATE.model,
            listType: STATE.list,
            customList: STATE.customList,
            lat: lat || STATE.lat,
            lon: lon || STATE.lon,
            week: week || STATE.week,
            useWeek: STATE.useWeek,
            localBirdsOnly: STATE.local,
            threshold: STATE.speciesThreshold
        });
        // Add the index of "Unknown Sp." to all lists
        STATE.list !== 'everything' && result.push(LABELS.length - 1)
        
        let includedObject = {};
        if (STATE.list === 'location' || (STATE.list === 'nocturnal' && STATE.local)){
            const location = lat.toString() + lon.toString();
            includedObject = {
                [STATE.model]: {
                    [STATE.list]: {
                        [week]: {
                            [location]: result
                        }
                    }
                }
            };
        } else {
            includedObject = {
                [STATE.model]: {
                    [STATE.list]: result
                }
            };
        }

        if (STATE.included === undefined) STATE.included = {}
        STATE.included = merge(STATE.included, includedObject);
        messages.forEach(message => UI.postMessage({event: 'generate-alert', message: message} ))
        return STATE.included;
    })();

    // Await the promise
    return await LIST_CACHE[key];
}
