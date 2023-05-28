const { ipcRenderer } = require('electron');
const fs = require('fs');
const wavefileReader = require('wavefile-reader');
const p = require('path');
const SunCalc = require('suncalc2');
const ffmpeg = require('fluent-ffmpeg');
const png = require('fast-png');
const { writeFile, mkdir, readdir } = require('node:fs/promises');
const { utimes } = require('utimes');
const stream = require("stream");
const staticFfmpeg = require('ffmpeg-static-electron');
const { stat } = require("fs/promises");

import { State } from './state.js';
import { sqlite3 } from './database.js';

let WINDOW_SIZE = 3;
let NUM_WORKERS;
let workerInstance = 0;
let TEMP, appPath, CACHE_LOCATION, BATCH_SIZE, LABELS, BACKEND, batchChunksToSend = {};
let SEEN_LIST_UPDATE = false // Prevents  list updates from every worker on every change

const DEBUG = true;

const DATASET = false;
const adding_chirpity_additions = true;
const dataset_database = DATASET;


console.log(staticFfmpeg.path);
ffmpeg.setFfmpegPath(staticFfmpeg.path.replace('app.asar', 'app.asar.unpacked'));

let predictionsRequested = {}, predictionsReceived = {}
let COMPLETED = [], PENDING_FILES = [];
let diskDB, memoryDB, latitude, longitude;

let t0; // Application profiler

//Object will hold files in the diskDB, and the active timestamp from the most recent selection analysis.
const STATE = new State();


const getSelectionRange = (file, start, end) => {
    return { start: (start * 1000) + metadata[file].fileStart, end: (end * 1000) + metadata[file].fileStart }
}
const createDB = async (file) => {
    const archiveMode = !!file;
    if (file) {
        fs.openSync(file, "w");
        diskDB = new sqlite3.Database(file);
        console.log("Created disk database", diskDB.filename);
    } else {
        memoryDB = new sqlite3.Database(':memory:');
        console.log("Created new in-memory database");
    }
    const db = archiveMode ? diskDB : memoryDB;
    await db.runAsync('BEGIN');
    await db.runAsync('CREATE TABLE species(id INTEGER PRIMARY KEY, sname TEXT, cname TEXT)');
    await db.runAsync(`CREATE TABLE files(
        id INTEGER PRIMARY KEY,
        name TEXT,duration  REAL,filestart INTEGER, 
        UNIQUE (name))`);
    await db.runAsync(`CREATE TABLE records(
        dateTime INTEGER, position INTEGER, fileID INTEGER, 
        speciesID INTEGER, confidence INTEGER, label  TEXT, 
        comment  TEXT, end INTEGER, callCount INTEGER,
        UNIQUE (dateTime, fileID, speciesID),
        CONSTRAINT fk_files
            FOREIGN KEY (fileID) REFERENCES files(id) ON DELETE CASCADE, 
        FOREIGN KEY (speciesID) REFERENCES species(id))`);
    await db.runAsync(`CREATE TABLE duration(
        day INTEGER, duration INTEGER, fileID INTEGER,
        UNIQUE (day, fileID),
        CONSTRAINT fk_files
            FOREIGN KEY (fileID) REFERENCES files(id) ON DELETE CASCADE)`);
    await db.runAsync('CREATE INDEX idx_datetime ON records(dateTime)');
    if (archiveMode) {
        for (let i = 0; i < LABELS.length; i++) {
            const [sname, cname] = LABELS[i].replaceAll("'", "''").split('_');
            await db.runAsync(`INSERT INTO species
                               VALUES (${i}, '${sname}', '${cname}')`);
        }
    } else {
        const filename = diskDB.filename;
        let { code } = await db.runAsync(`ATTACH '${filename}' as disk`);
        // If the db is not ready
        while (code === "SQLITE_BUSY") {
            console.log("Disk DB busy")
            setTimeout(() => {
            }, 10);
            let response = await db.runAsync(`ATTACH '${filename}' as disk`);
            code = response.code;
        }
        let response = await db.runAsync('INSERT INTO files SELECT * FROM disk.files');
        console.log(response.changes + ' files added to memory database')
        response = await db.runAsync('INSERT INTO species SELECT * FROM disk.species');
        console.log(response.changes + ' species added to memory database')
    }
    await db.runAsync('END');
    return db
}

async function loadDB(path) {
    if (path) {
        const file = dataset_database ? p.join(path, `archive_dataset${LABELS.length}.sqlite`) : p.join(path, `archive${LABELS.length}.sqlite`)
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
            console.log("Opened and cleaned disk db " + file)
        }
    } else {
        const db = await createDB();
    }
    return true
}


let metadata = {};
let index = 0, AUDACITY = {}, predictionStart;
let sampleRate = 24000;  // Value obtained from model.js CONFIG, however, need default here to permit file loading before model.js response
let predictWorkers = [], predictionDone = true, aborted = false;

// Set up the audio context:
const audioCtx = new AudioContext({ latencyHint: 'interactive', sampleRate: sampleRate });

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
    const size = (await Promise.all(paths)).flat(Infinity).reduce((i, size) => i + size, 0);
    // Newest to oldest file, so we can pop the list (faster)
    ctimes.sort((a, b) => {
        return a[1] - b[1]
    })
    //console.table(ctimes);
    return [size, ctimes];
}

const clearCache = async (fileCache, sizeLimitInGB) => {
    // Cache size
    let [size,] = await dirInfo({ folder: fileCache });
    const requiredSpace = sizeLimitInGB * 1024 ** 3;
    // If Full, clear at least 25% of cache, so we're not doing this too frequently
    if (size > requiredSpace) {
        // while (size > requiredSpace && COMPLETED.length) {
        while (COMPLETED.length > 1) {
            const file = COMPLETED.shift();
            const proxy = metadata[file].proxy;
            // Make sure we don't delete original files!
            if (proxy !== file) {
                const stat = fs.lstatSync(proxy);
                // Remove tmp file from metadata
                fs.rmSync(proxy, { force: true });
                // Delete the metadata
                delete metadata[file];
                console.log(`removed ${file} from cache`);
                size -= stat.size;
            }
        }
        if (!COMPLETED.length) {
            console.log('All completed files removed from cache')
            // Cache still full?
            if (size > requiredSpace) {
                console.log('Cache still full')
            }
        }
        return true
    }
    return false
}




ipcRenderer.on('new-client', (event) => {
    [UI] = event.ports;
    UI.onmessage = async (e) => {
        const args = e.data;
        const action = args.action;
        console.log('message received ', action)
        switch (action) {
            case 'update-state':
                // This pattern to only update variables that have values
                latitude = args.lat || latitude;
                longitude = args.lon || longitude;
                TEMP = args.temp || TEMP;
                appPath = args.path || appPath;
                STATE.update(args);
                // Need to recompile prepared sql if changeing sortOrder
                if (args.sortOrder) prepStatements();
                break;
            case 'clear-cache':
                CACHE_LOCATION = p.join(TEMP, 'chirpity');
                if (!fs.existsSync(CACHE_LOCATION)) fs.mkdirSync(CACHE_LOCATION);
                await clearCache(CACHE_LOCATION, 0);  // belt and braces - in dev mode, ctrl-c in console will prevent cache clear on exit
                break;
            case 'open-files':
                await getFiles(args.files)
                break;
            case 'update-record':
                await onUpdateRecord(args)
                break;
            case 'delete':
                await onDelete(args)
                break;
            case 'delete-species':
                await onDeleteSpecies(args)
                break;
            case 'update-file-start':
                await onUpdateFileStart(args)
                break;
            case 'get-detected-species-list':

                getSpecies(args.range);
                break;
            case 'create-dataset':
                saveResults2DataSet();
                break;
            case 'convert-dataset':
                convertSpecsFromExistingSpecs();
                break;
            case 'load-model':
                UI.postMessage({ event: 'spawning' });
                BATCH_SIZE = parseInt(args.batchSize);
                BACKEND = args.backend;
                STATE.update({ model: args.model });
                if (predictWorkers.length) terminateWorkers();
                spawnWorkers(args.model, args.list, BATCH_SIZE, args.threads);
                break;
            case 'update-list':
                SEEN_LIST_UPDATE = false;
                predictWorkers.forEach(worker =>
                    worker.postMessage({ message: 'list', list: args.list }))
                break;
            case 'file-load-request':
                index = 0;
                if (!predictionDone) onAbort(args);
                if (!memoryDB) await createDB();
                STATE.update({ db: memoryDB });
                console.log('Worker received audio ' + args.file);
                await loadAudioFile(args);
                break;
            case 'update-buffer':
                await loadAudioFile(args);
                break;
            case 'filter':
                if (STATE.db) {
                    prepStatements();
                    await getResults(args);
                    await getSummary(args);
                }
                break;
            case 'export-results':
                await getResults(args);
                break;
            case 'insert-manual-record':
                await onInsertManualRecord(args);
                break;
            case 'change-mode':
                if (!memoryDB)  await createDB();
                STATE.changeMode({
                    mode: args.mode,
                    disk: diskDB,
                    memory: memoryDB
                });
                // PREPARE SQL STATEMENTS
                prepStatements();
                break;
            case 'analyse':
                // Create a new memory db if one doesn't exist, or wipe it if one does,
                // unless we're looking at a selection
                if (!memoryDB || !args.end) {
                    await createDB();
                }
                predictionsReceived = {};
                predictionsRequested = {};
                await onAnalyse(args);
                break;
            case 'save':
                console.log("file save requested")
                await saveAudio(args.file, args.start, args.end, args.filename, args.metadata);
                break;
            case 'post':
                await uploadOpus(args);
                break;
            case 'save2db':
                await onSave2DiskDB();
                break;
            case 'abort':
                onAbort(args);
                break;
            case 'chart':
                await onChartRequest(args);
                break;
            case 'purge-file':
                onFileDelete(args.fileName);
                break;
            default:
                UI.postMessage('Worker communication lines open')
        }
    }
})

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
            file_list = file_list.concat(dirFiles)
        } else {
            file_list.push(files[i])
        }
    }
    // filter out unsupported files
    const supported_files = image ? ['.png'] :
        ['.wav', '.flac', '.opus', '.m4a', '.mp3', '.mpga', '.ogg', '.aac', '.mpeg', '.mp4'];

    file_list = file_list.filter((file) => {
        return supported_files.some(ext => file.endsWith(ext))
    }
    )
    UI.postMessage({ event: 'files', filePaths: file_list });
    return file_list;
}

// Get a list of files in a folder and subfolders
// const getFilesInDirectory = async dir => {
//     const files = await readdir(dir, { withFileTypes: true });
//     let file_map = files.map(async file => {
//         const path = p.join(dir, file.name);
//         if (file.isDirectory()) return await getFilesInDirectory(path);
//         if (file.isFile() || file.isSymbolicLink()) {
//             return path
//         }
//         return 0;
//     });
//     file_map = (await Promise.all(file_map)).flat(Infinity)
//     return file_map
// }

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

const prepParams = (list) =>  list.map(item => '?').join(',');


const getResultsParams = (species, confidence, offset, limit, topRankin) => {
    const blocked = (STATE.blocked.length && (STATE.userSettingsInSelection || ! STATE.selection)) ?
        STATE.blocked : [];
    const params = [];
    params.push(...blocked);

    params.push(topRankin, confidence, species);
    if (STATE.mode !== 'explore' && !STATE.selection) {
        params.push(...STATE.filesToAnalyse);
    }
    if (STATE.selection) params.push(STATE.selection.start, STATE.selection.end);
    else if (STATE.explore.range.start !== undefined){
        params.push(STATE.explore.range.start, STATE.explore.range.end);
    }
    params.push(limit, offset);
    return params
}

const getSummaryParams = (species) => {
    const blocked = STATE.blocked.length && ! STATE.selection ? STATE.blocked : [];
    const useRange = (STATE.mode === 'explore' && STATE.explore.range.start !== undefined ) 
                    || STATE.selection;
    const params = [STATE.detect.confidence];
    const extraParams = [];
    if (STATE.mode !== 'explore') {
        extraParams.push(...STATE.filesToAnalyse);
    }
    if (STATE.selection) params.push(STATE.selection.start, STATE.selection.end);
    else if (STATE.explore.range.start !== undefined){
        extraParams.push(STATE.explore.range.start, STATE.explore.range.end);
    }
    extraParams.push(...blocked);
    params.push(...extraParams);
    params.push(STATE.detect.confidence, species);
    params.push(...extraParams);
    return params
}

const prepSummaryStatement = () => {
    const blocked = STATE.blocked.length && ! STATE.selection ? STATE.blocked : [];
    const useRange = (STATE.mode === 'explore' && STATE.explore.range.start !== undefined ) 
                    || STATE.selection;
    let summaryStatement = `
    WITH ranked_records AS (
        SELECT records.dateTime, records.speciesID, records.confidence, records.fileID, cname, sname,
          RANK() OVER (PARTITION BY records.dateTime ORDER BY records.confidence DESC) AS rank
        FROM records
        JOIN files ON files.id = records.fileID
        JOIN species ON species.id = records.speciesID
        WHERE confidence >=  ? `;
    let extraClause = '';
    if (STATE.mode !== 'explore') {
        extraClause += ` AND name IN  (${prepParams(STATE.filesToAnalyse)}) `;
    }
    if (useRange) {
        extraClause += ' AND dateTime BETWEEN ? AND ? ';
    }
    const excluded = prepParams(STATE.blocked);
    extraClause += ` AND speciesID NOT IN (${excluded}) `;

    summaryStatement += extraClause;
    summaryStatement +=  `
    )
    SELECT cname, sname, COUNT(*) as count, ROUND(MAX(ranked_records.confidence) / 10.0, 0) as max
      FROM ranked_records
      WHERE ranked_records.rank <= ${STATE.topRankin}
      GROUP BY speciesID
    UNION ALL
    SELECT
        'Total' AS sname,
        cname as cname,
        COUNT(*) AS count,
        ROUND(MAX(ranked_records.confidence) / 10.0, 0) AS max
      FROM
        ranked_records
        JOIN files ON files.id = ranked_records.fileID
    WHERE confidence >= ? AND cname LIKE ? AND ranked_records.rank <= ${STATE.topRankin} `;
    summaryStatement += extraClause;
    summaryStatement += 'ORDER BY count DESC, max DESC';
    STATE.GET_SUMMARY_SQL = STATE.db.prepare(summaryStatement);
    //console.log('Summary SQL statement:\n' + summaryStatement)
}

const prepResultsStatement = () => {
    let resultStatement = `
    WITH ranked_records AS (
        SELECT 
          records.dateTime, 
          files.duration, 
          files.filestart, 
          files.name,
          records.position, 
          records.speciesID,
          species.sname, 
          species.cname, 
          records.confidence, 
          records.label, 
          records.comment, 
          records.end,
          records.callCount,
          RANK() OVER (PARTITION BY records.dateTime, records.fileID ORDER BY records.confidence DESC) AS confidence_rank
        FROM records 
          JOIN species ON records.speciesID = species.id 
          JOIN files ON records.fileID = files.id `;

    const blocked = (STATE.blocked.length && (STATE.userSettingsInSelection || ! STATE.selection)) ?
        STATE.blocked : [];
    resultStatement += ` AND speciesID NOT IN (${prepParams(blocked)}) `


    resultStatement += `
    )
      SELECT 
        dateTime as timestamp, 
        duration, 
        filestart, 
        name as file, 
        position, 
        speciesID,
        sname, 
        cname, 
        confidence as score, 
        label, 
        comment,
        end,
        callCount,
        confidence_rank
      FROM 
        ranked_records 
        WHERE confidence_rank <= ? AND confidence >= ? AND cname LIKE ? `;

    if (!(STATE.mode === 'explore'  || STATE.selection)) {
        resultStatement += ` AND name IN  (${prepParams(STATE.filesToAnalyse)}) `;
    }
    if (( STATE.mode === 'explore' && STATE.explore.range.start !== undefined ) 
        || STATE.selection) {
            resultStatement += ' AND dateTime BETWEEN ? AND ? ';
    }
    resultStatement +=  `ORDER BY ${STATE.sortOrder}, confidence DESC, callCount DESC LIMIT ? OFFSET ?`;
    STATE.GET_RESULT_SQL = STATE.db.prepare(resultStatement);
    //console.log('Results SQL statement:\n' + resultStatement)
}

const prepStatements = (species) => {
    prepResultsStatement(species);
    prepSummaryStatement(species);
};

// Not an arrow function. Async function has access to arguments - so we can pass them to processnextfile
async function onAnalyse({
    filesInScope = [],
    start = 0,
    end = undefined,
    reanalyse = false,
}) {
    // Now we've asked for a new analysis, clear the aborted flag
    aborted = false;
    // set to memory database. If end was passed, this is a selection
    if (!end) STATE.update({ db: memoryDB })
    STATE.update({ selection: end ? getSelectionRange(filesInScope[0], start, end) : undefined});

    console.log(`Worker received message: ${filesInScope}, ${STATE.detect.confidence}, start: ${start}, end: ${end}`);
    //Set global filesInScope for summary to use
    PENDING_FILES = filesInScope;
    index = 0;
    AUDACITY = {};
    COMPLETED = [];
    FILE_QUEUE = filesInScope;

    // If we are analsing a selection, don't change the db
    // Otherwise, all new analyses go to the memory db
    if (!STATE.selection) {
        //create a copy of files in scope for state, as filesInScope is spliced
        STATE.setFiles([...filesInScope]);
    }

    let count = 0;
    if (DATASET) {
        for (let i = FILE_QUEUE.length - 1; i >= 0; i--) {
            let file = FILE_QUEUE[i];
            //STATE.db = diskDB;
            const result = await diskDB.getAsync('SELECT name FROM files WHERE name = ?', file);
            if (result) {
                console.log(`Skipping ${file.name}, already analysed`)
                FILE_QUEUE.splice(i, 1)
                count++
                continue;
            }
            console.log(`Adding ${file} to the queue.`)
        } 
    }
    else {
        // check if results for the files are cached 
        // we only consider it cached if all files have been saved to the disk DB)
        // BECAUSE we want to change state.db to disk if they are
        let allCached = true;
        for (let i = 0; i < FILE_QUEUE.length; i++) {
            if (!await getSavedFileInfo(FILE_QUEUE[i])) {
                allCached = false;
                break;
            }
        }
        if (allCached && !reanalyse && !STATE.selection) {
            STATE.update({ db: diskDB });
            prepStatements();
            await getResults();
            await getSummary();
            return
        }
    }


    
    // PREPARE SQL STATEMENTS
    prepStatements();

    console.log("FILE_QUEUE has ", FILE_QUEUE.length, 'files', count, 'files ignored')
    for (let i = 0; i < NUM_WORKERS; i++) {
        processNextFile({ start: start, end: end, resetResults: STATE.selection === undefined, worker: i });
    }
}

function onAbort({
    model = STATE.model,
    list = 'migrants',
}) {
    aborted = true;
    FILE_QUEUE = [];
    index = 0;
    console.log("abort received")
    if (!predictionDone) {
        //restart the worker
        UI.postMessage({ event: 'spawning' });
        terminateWorkers();
        spawnWorkers(model, list, BATCH_SIZE, NUM_WORKERS)
    }
    predictionDone = true;
    predictionsReceived = {};
    predictionsRequested = {};
    UI.postMessage({ event: 'prediction-done', batchInProgress: true });
}

const getDuration = async (src) => {
    let audio;
    return new Promise(function (resolve) {
        audio = new Audio();
        audio.src = src;
        audio.addEventListener("loadedmetadata", function () {
            const duration = audio.duration;
            audio = null;
            // Tidy up - cloning removes event listeners
            const old_element = document.getElementById("audio");
            const new_element = old_element.cloneNode(true);
            old_element.parentNode.replaceChild(new_element, old_element);

            resolve(duration);
        });
    });
}

const convertFileFormat = (file, destination, size, error) => {
    return new Promise(function (resolve) {
        const sampleRate = 24000, channels = 1;
        let totalTime;
        ffmpeg(file)
            .audioChannels(channels)
            .audioFrequency(sampleRate)
            // .audioFilters(
            //     {
            //       filter: 'dynaudnorm',
            //       options: 'f=500:p=0.95:g=3'
            //     }
            // )
            .on('error', (err) => {
                console.log('An error occurred: ' + err.message);
                if (err) {
                    error(err.message);
                }
            })
            // Handle progress % being undefined
            .on('codecData', async data => {
                // HERE YOU GET THE TOTAL TIME
                const a = data.duration.split(':');
                totalTime = parseInt(a[0]) * 3600 + parseInt(a[1]) * 60 + parseFloat(a[2]);
                //totalTime = parseInt(data.duration.replace(/:/g, ''))
            })
            .on('progress', (progress) => {
                // HERE IS THE CURRENT TIME
                //const time = parseInt(progress.timemark.replace(/:/g, ''))
                const a = progress.timemark.split(':');
                const time = parseInt(a[0]) * 3600 + parseInt(a[1]) * 60 + parseFloat(a[2]);
                // AND HERE IS THE CALCULATION
                const extractionProgress = time / totalTime;
                process.stdout.write(`Processing: ${((time / totalTime) * 100).toFixed(0)}% converted\r`);
                UI.postMessage({
                    event: 'progress', text: 'Extracting file', progress: extractionProgress
                })
            })
            .on('end', () => {
                UI.postMessage({ event: 'progress', text: 'File decompressed', progress: 1.0 })
                resolve(destination)
            })
            .save(destination)
    });
}

/**
 * getWorkingFile called by loadAudioFile, getPredictBuffers, fetchAudioBuffer and processNextFile
 * purpose is to create a wav file from the source file and set its metadata. If the file *is* a wav file, it returns
 * that file, else it checks for a temp wav file, if not found it calls convertFileFormat to extract
 * and create a wav file in the users temp folder and returns that file's path. The flag for this file is set in the
 * metadata object as metadata[file].proxy
 *
 * @param file: full path to source file
 * @returns {Promise<boolean|*>}
 */
async function getWorkingFile(file) {
    if (metadata[file]?.isComplete && metadata[file]?.proxy) return metadata[file].proxy;
    // find the file
    const source_file = fs.existsSync(file) ? file : await locateFile(file);
    if (!source_file) return false;
    let proxy = source_file;

    if (!source_file.endsWith('.wav')) {
        const pc = p.parse(source_file);
        const filename = pc.base + '.wav';
        const destination = p.join(CACHE_LOCATION, filename);
        if (fs.existsSync(destination)) {
            proxy = destination;
        } else {
            // get some metadata from the source file
            const statsObj = fs.statSync(source_file);
            const sourceMtime = statsObj.mtime;

            //console.log(Date.UTC(sourceMtime));

            proxy = await convertFileFormat(source_file, destination, statsObj.size, function (errorMessage) {
                console.log(errorMessage);
                return true;
            });
            // assign the source file's save time to the proxy file
            await utimes(proxy, sourceMtime.getTime());
        }
    }
    if (!metadata[file] || !metadata[file].isComplete) {
        await getMetadata({ file: file, proxy: proxy, source_file: source_file });
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
        UI.postMessage({
            event: 'generate-alert', message: `Unable to load source file with any supported file extension: ${file}`
        })
        return false;
    }
    return matchingFileExt;
}

async function loadAudioFile({
    file = '',
    start = 0,
    end = 20,
    position = 0,
    region = false,
    preserveResults = false,
    play = false,
    queued = false
}) {
    const found = await getWorkingFile(file);
    if (found) {
        await fetchAudioBuffer({ file, start, end })
            .then((buffer) => {
                let audioArray = buffer.getChannelData(0);
                UI.postMessage({
                    event: 'worker-loaded-audio',
                    start: metadata[file].fileStart,
                    sourceDuration: metadata[file].duration,
                    bufferBegin: start,
                    file: file,
                    position: position,
                    contents: audioArray,
                    fileRegion: region,
                    preserveResults: preserveResults,
                    play: play,
                    queued: queued
                }, [audioArray.buffer]);
            })
            .catch(e => {
                console.log(e);
            })
    }
}


function addDays(date, days) {
    let result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

/**
 * Called by getWorkingFile, setStartEnd??,
 * Assigns file metadata to a metadata cache object. file is the key, and is the source file
 * proxy is required if the source file is not a wav to populate the headers
 * @param file: the file name passed to the worker
 * @param proxy: the wav file to use for predictions
 * @param source_file: the file that exists ( will be different after compression)
 * @returns {Promise<unknown>}
 */
const getMetadata = async ({ file, proxy = file, source_file = file }) => {
    metadata[file] = { proxy: proxy };
    // CHeck the database first, so we honour any manual update.
    const savedMeta = await getSavedFileInfo(file);
    metadata[file].duration = savedMeta?.duration || await getDuration(proxy);

    return new Promise((resolve) => {
        if (metadata[file]?.isComplete) {
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
            // Add dawn and dusk for the file to the metadata
            let astro = SunCalc.getTimes(fileStart, latitude, longitude);
            metadata[file].dusk = astro.dusk.getTime();
            // If file starts after dark, dawn is next day
            if (fileStart > astro.dusk.getTime()) {
                astro = SunCalc.getTimes(fileStart + 8.47e+7, latitude, longitude);
                metadata[file].dawn = astro.dawn.getTime();
            } else {
                metadata[file].dawn = astro.dawn.getTime();
            }
            // We use proxy here as the file *must* be a wav file
            const readStream = fs.createReadStream(proxy);
            readStream.on('data', async chunk => {
                let wav = new wavefileReader.WaveFileReader();
                wav.fromBuffer(chunk);
                // Extract Header
                let headerEnd;
                wav.signature.subChunks.forEach(el => {
                    if (el['chunkId'] === 'data') {
                        headerEnd = el.chunkData.start;
                    }
                });
                // Update relevant file properties
                metadata[file].head = headerEnd;
                metadata[file].header = chunk.slice(0, headerEnd)
                metadata[file].bytesPerSec = wav.fmt.byteRate;
                metadata[file].numChannels = wav.fmt.numChannels;
                metadata[file].sampleRate = wav.fmt.sampleRate;
                metadata[file].bitsPerSample = wav.fmt.bitsPerSample
                metadata[file].fileStart = fileStart;
                // Set complete flag
                metadata[file].isComplete = true;
                readStream.close()
                return resolve(metadata[file]);
            });
            readStream.on('error', err => {
                UI.postMessage({
                    event: 'generate-alert',
                    message: `Error reading file: ` + file
                })
                console.log('readstream error:' + err)
            })
        }
    })
}

const convertTimeToBytes = (time, metadata) => {
    const bytesPerSample = metadata.bitsPerSample / 8;
    // get the nearest sample start - they can be 2,3 or 4 bytes representations. Then add the header offest
    return (Math.round((time * metadata.bytesPerSec) / bytesPerSample) * bytesPerSample) + metadata.head;
}


async function setupCtx(chunk, header) {
    // Deal with detached arraybuffer issue
    let audioBufferChunk;
    try {
        chunk = Buffer.concat([header, chunk]);
        audioBufferChunk = await audioCtx.decodeAudioData(chunk.buffer);
    } catch {
        return false
    }

    const audioCtxSource = audioCtx.createBufferSource();
    audioCtxSource.buffer = audioBufferChunk;
    const duration = audioCtxSource.buffer.duration;
    const buffer = audioCtxSource.buffer;
    const offlineCtx = new OfflineAudioContext(1, sampleRate * duration, sampleRate);
    const offlineSource = offlineCtx.createBufferSource();
    offlineSource.buffer = buffer;
    let previousFilter = undefined;
    if (STATE.filters.highPassFrequency) {
        // Create a highpass filter to attenuate the noise
        const highpassFilter = offlineCtx.createBiquadFilter();
        highpassFilter.type = "highpass"; // Standard second-order resonant highpass filter with 12dB/octave rolloff. Frequencies below the cutoff are attenuated; frequencies above it pass through.
        highpassFilter.frequency.value = STATE.filters.highPassFrequency //frequency || 0; // This sets the cutoff frequency. 0 is off. 
        highpassFilter.Q.value = 0; // Indicates how peaked the frequency is around the cutoff. The greater the value, the greater the peak.
        offlineSource.connect(highpassFilter);
        previousFilter = highpassFilter;
    }
    if (STATE.filters.lowShelfFrequency && STATE.filters.lowShelfAttenuation) {
        // Create a lowshelf filter to boost or attenuate low-frequency content
        const lowshelfFilter = offlineCtx.createBiquadFilter();
        lowshelfFilter.type = 'lowshelf';
        lowshelfFilter.frequency.value = STATE.filters.lowShelfFrequency; // This sets the cutoff frequency of the lowshelf filter to 1000 Hz
        lowshelfFilter.gain.value = STATE.filters.lowShelfAttenuation; // This sets the boost or attenuation in decibels (dB)
        previousFilter ? previousFilter.connect(lowshelfFilter) : offlineSource.connect(lowshelfFilter);
        previousFilter = lowshelfFilter;
    }
    // // Create a compressor node
    // const compressor = new DynamicsCompressorNode(offlineCtx, {
    //     threshold: -30,
    //     knee: 6,
    //     ratio: 6,
    //     attack: 0,
    //     release: 0,
    //   });
    // previousFilter = offlineSource.connect(compressor) ;
    previousFilter ? previousFilter.connect(offlineCtx.destination) : offlineSource.connect(offlineCtx.destination);


    // // Create a highshelf filter to boost or attenuate high-frequency content
    // const highshelfFilter = offlineCtx.createBiquadFilter();
    // highshelfFilter.type = 'highshelf';
    // highshelfFilter.frequency.value = STATE.highPassFrequency || 0; // This sets the cutoff frequency of the highshelf filter to 3000 Hz
    // highshelfFilter.gain.value = 0; // This sets the boost or attenuation in decibels (dB)


    // await offlineCtx.audioWorklet.addModule('js/audio_normalizer.js');
    // const normalizerNode = new AudioWorkletNode(offlineCtx, 'audio-normalizer', {
    //     processorOptions: {
    //         cutoff: STATE.highPassFrequency,
    //         frequency: 100,
    //     }
    // });

    // offlineSource.connect(normalizerNode);
    // highshelfFilter.connect(offlineCtx.destination);
    // normalizerNode.connect(offlineCtx.destination);

    // // Create a gain node to adjust the audio level
    // const gainNode = offlineCtx.createGain();
    // const maxLevel = 0.5; // This sets the maximum audio level to 0.5 (50% of maximum)
    // const minLevel = 0.05; // This sets the minimum audio level to 0.05 (5% of maximum)
    // const scriptNode = offlineCtx.createScriptProcessor(4096, 1, 1); // This sets the buffer size to 4096 samples
    // highshelfFilter.connect(scriptNode);

    // scriptNode.connect(gainNode);
    // gainNode.connect(offlineCtx.destination);
    // // Analyze the audio levels in real-time
    // scriptNode.onaudioprocess = function (event) {
    //     const inputBuffer = event.inputBuffer.getChannelData(0);
    //     let max = 0;
    //     for (let i = 0; i < inputBuffer.length; i++) {
    //         const absValue = Math.abs(inputBuffer[i]);
    //         if (absValue > max) {
    //             max = absValue;
    //         }
    //     }
    //     const level = max.toFixed(2); // Round the level to two decimal places
    //     gainNode.gain.value = level >= maxLevel ? 1 : (level <= minLevel ? 0 : (level - minLevel) / (maxLevel - minLevel));
    // };
    offlineSource.start();
    return offlineCtx;
};

/**
 *
 * @param file
 * @param start
 * @param end
 * @param resetResults
 * @returns {Promise<void>}
 */

function getWorker(){
    return new Promise((resolve) => {
        for (var i = 0; i < predictWorkers.length; i++) {
            if (predictWorkers[i].isAvailable) {
            resolve(i); // Found an available worker, return its position
            }
        }
    
        // No available workers found, wait for a delay and check again
        setTimeout(() => { resolve(getWorker())}, 100);
    })

}

const getPredictBuffers = async ({
    file = '', start = 0, end = undefined, resetResults = false, worker = undefined
}) => {
    //let start = args.start, end = args.end, resetResults = args.resetResults, file = args.file;
    let chunkLength = 72000;
    // Ensure max and min are within range
    start = Math.max(0, start);
    end = Math.min(metadata[file].duration, end);
    if (start > metadata[file].duration) {
        return
    }
    batchChunksToSend[file] = Math.ceil((end - start) / (BATCH_SIZE * WINDOW_SIZE));
    predictionsReceived[file] = 0;
    predictionsRequested[file] = 0;
    const byteStart = convertTimeToBytes(start, metadata[file]);
    const byteEnd = convertTimeToBytes(end, metadata[file]);
    // Match highWaterMark to batch size... so we efficiently read bytes to feed to model - 3 for WINDOW_SIZE second chunks
    const highWaterMark = metadata[file].bytesPerSec * BATCH_SIZE * WINDOW_SIZE;
    const proxy = metadata[file].proxy;
    const readStream = fs.createReadStream(proxy, {
        start: byteStart, end: byteEnd, highWaterMark: highWaterMark
    });
    let chunkStart = start * sampleRate;
    readStream.on('data', async chunk => {
        // Ensure data is processed in order
        readStream.pause();
        if (aborted) {
            readStream.close()
            return
        }
        const offlineCtx = await setupCtx(chunk, metadata[file].header);
        if (offlineCtx) {
            offlineCtx.startRendering().then((resampled) => {
                const myArray = resampled.getChannelData(0);

                // if (++workerInstance >= NUM_WORKERS) {
                //     workerInstance = 0;
                // }

                getWorker().then(worker => { //workerInstance;
                    feedChunksToModel(myArray, chunkStart, file, end, resetResults, worker);
                    chunkStart += WINDOW_SIZE * BATCH_SIZE * sampleRate;
                    // Now the async stuff is done ==>
                    readStream.resume();
                })
            }).catch((err) => {
                console.error(`PredictBuffer rendering failed: ${err}`);
                // Note: The promise should reject when startRendering is called a second time on an OfflineAudioContext
            });
        } else {
            console.log('Short chunk', chunk.length, 'skipping')
            if (worker === undefined) {
                // if (++workerInstance >= NUM_WORKERS) {
                //     workerInstance = 0;
                // }
                worker = await getWorker() //workerInstance;
            }
            // Create array with 0's (short segment of silence that will trigger the finalChunk flag
            const myArray = new Float32Array(new Array(chunkLength).fill(0));
            feedChunksToModel(myArray, chunkStart, file, end, resetResults, worker);
            readStream.resume();
        }
    })
    readStream.on('end', function () {
        readStream.close();
        // processNextFile();
    })
    readStream.on('error', err => {
        console.log(`readstream error: ${err}, start: ${start}, , end: ${end}, duration: ${metadata[file].duration}`)
    })
}

/**
 *  Called when file first loaded, when result clicked and when saving or sending file snippets
 * @param args
 * @returns {Promise<unknown>}
 */
const fetchAudioBuffer = async ({
    file = '', start = 0, end = metadata[file].duration
}) => {
    if (end - start < 0.1) return  // prevents dataset creation barfing with  v. short buffers
    const proxy = await getWorkingFile(file);
    if (!proxy) return false
    return new Promise(async (resolve) => {
        const byteStart = convertTimeToBytes(start, metadata[file]);
        const byteEnd = convertTimeToBytes(end, metadata[file]);

        if (byteEnd < byteStart) {
            console.log(`!!!!!!!!!!!!! End < start encountered for ${file}, end was ${end} start is ${start}`)
        }
        // Match highWaterMark to batch size... so we efficiently read bytes to feed to model - 3 for 3 second chunks
        const highWaterMark = byteEnd - byteStart + 1;

        const readStream = fs.createReadStream(proxy, {
            start: byteStart, end: byteEnd, highWaterMark: highWaterMark
        });
        readStream.on('data', async chunk => {
            // Ensure data is processed in order
            readStream.pause();
            const offlineCtx = await setupCtx(chunk, metadata[file].header);

            offlineCtx.startRendering().then(resampled => {
                // `resampled` contains an AudioBuffer resampled at 24000Hz.
                // use resampled.getChannelData(x) to get an Float32Array for channel x.
                readStream.resume();
                resolve(resampled);
            }).catch((err) => {
                console.error(`FetchAudio rendering failed: ${err}`);
                // Note: The promise should reject when startRendering is called a second time on an OfflineAudioContext
            });
        })

        readStream.on('end', function () {
            readStream.close()
        })
        readStream.on('error', err => {
            console.log(`readstream error: ${err}, start: ${start}, , end: ${end}, duration: ${metadata[file].duration}`)
        })
    });
}

async function feedChunksToModel(channelData, chunkStart, file, end, resetResults, worker) {
    predictionsRequested[file]++;
    if (worker === undefined) {
        // pick a worker
        worker = await getWorker()
        //worker = ++workerInstance >= NUM_WORKERS ? 0 : workerInstance;
    }
    const objData = {
        message: 'predict',
        worker: worker,
        fileStart: metadata[file].fileStart,
        file: file,
        start: chunkStart,
        duration: end,
        resetResults: resetResults,
        snr: STATE.filters.SNR,
        context: STATE.detect.contextAware,
        confidence: STATE.detect.confidence,
        chunks: channelData
    };
    predictWorkers[worker].isAvailable = false;
    predictWorkers[worker].postMessage(objData, [channelData.buffer]);
}

async function doPrediction({
    file = '',
    start = 0,
    end = metadata[file].duration,
    resetResults = false,
    worker = undefined
}) {
    predictionDone = false;
    predictionStart = new Date();
    await getPredictBuffers({ file: file, start: start, end: end, resetResults: resetResults, worker: undefined });
    UI.postMessage({ event: 'update-audio-duration', value: metadata[file].duration });
}

const speciesMatch = (path, sname) => {
    const pathElements = path.split(p.sep);
    const species = pathElements[pathElements.length - 2];
    sname = sname.replaceAll(' ', '_');
    return species.includes(sname)
    //return sname.includes('Anthus')
}

const convertSpecsFromExistingSpecs = async (path) => {
    if (!path) path = '/mnt/608E21D98E21A88C/Users/simpo/PycharmProjects/Data/New_Dataset';
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
            console.log("skipping file as it is already saved")
        } else {
            const file_to_analyse = parts.dir.replace('New_Dataset', 'XC_ALL_mp3') + p.sep + filename + '.mp3';
            const AudioBuffer = await fetchAudioBuffer({
                start: parseFloat(start), end: parseFloat(end), file: file_to_analyse
            })
            if (AudioBuffer) {  // condition to prevent barfing when audio snippet is v short i.e. fetchAudioBUffer false when < 0.1s
                // if (++workerInstance === NUM_WORKERS) {
                //     workerInstance = 0;
                // }
                workerInstance = await getWorker();
                const buffer = AudioBuffer.getChannelData(0);
                predictWorkers[workerInstance].postMessage({
                    message: 'get-spectrogram',
                    filepath: path_to_save,
                    file: parts.base,
                    buffer: buffer,
                    height: 256,
                    width: 384
                }, [buffer.buffer]);
            }
        }
    }
}

const saveResults2DataSet = (rootDirectory) => {
    if (!rootDirectory) rootDirectory = '/mnt/608E21D98E21A88C/Users/simpo/PycharmProjects/Data/test';
    const height = 256, width = 384;
    let t0 = Date.now()
    let promise = Promise.resolve();
    let promises = [];
    let count = 0;


    memoryDB.each(`${db2ResultSQL}`, async (err, result) => {
        // Check for level of ambient noise activation
        let ambient, threshold, value = 50;
        // adding_chirpity_additions is a flag for curated files, if true we assume every detection is correct
        if (!adding_chirpity_additions) {
            //     ambient = (result.sname2 === 'Ambient Noise' ? result.score2 : result.sname3 === 'Ambient Noise' ? result.score3 : false)
            //     console.log('Ambient', ambient)
            //     // If we have a high level of ambient noise activation, insist on a high threshold for species detection
            //     if (ambient && ambient > 0.2) {
            //         value = 0.7
            //     }
            // Check whether top predicted species matches folder (i.e. the searched for species)
            // species not matching the top prediction sets threshold to 2, effectively doing nothing with results
            // that don't match the searched for species
            threshold = speciesMatch(result.file, result.sname) ? value : 200;
        } else {
            threshold = 0;
        }
        promise = promise.then(async function () {
            let score = result.score;
            if (score >= threshold) {
                const [_, folder] = p.dirname(result.file).match(/^.*\/(.*)$/)
                // get start and end from timestamp
                const start = (result.timestamp - result.filestart) / 1000;
                let end = start + 3;

                // filename format: <source file>_<confidence>_<start>.png
                const file = `${p.basename(result.file).replace(p.extname(result.file), '')}_${start}-${end}.png`;
                const filepath = p.join(rootDirectory, folder)
                const file_to_save = p.join(filepath, file)
                if (fs.existsSync(file_to_save)) {
                    console.log("skipping file as it is already saved")
                } else {
                    end = Math.min(end, result.duration);
                    const AudioBuffer = await fetchAudioBuffer({
                        start: start, end: end, file: result.file
                    })
                    if (AudioBuffer) {  // condition to prevent barfing when audio snippet is v short i.e. fetchAudioBUffer false when < 0.1s
                        // if (++workerInstance === NUM_WORKERS) {
                        //     workerInstance = 0;
                        // }
                        workerInstance = await await getWorker();
                        const buffer = AudioBuffer.getChannelData(0);
                        predictWorkers[workerInstance].postMessage({
                            message: 'get-spectrogram',
                            filepath: filepath,
                            file: file,
                            buffer: buffer,
                            height: height,
                            width: width
                        }, [buffer.buffer]);
                        count++;
                    }
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
    console.log('saved:', file_to_save);
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
        console.log(xhr.response);
    };
    // create and send the reqeust
    xhr.open('POST', 'https://birds.mattkirkland.co.uk/upload');
    xhr.send(formData);
}

const bufferToAudio = ({
    file = '', start = 0, end = 3, meta = {}, format = undefined
}) => {
    let audioCodec, mimeType, soundFormat;
    let padding = STATE.audio.padding;
    let fade = STATE.audio.fade;
    let bitrate = STATE.audio.bitrate;
    let quality = parseInt(STATE.audio.quality);
    let downmix = STATE.audio.downmix;
    if (!format) format = STATE.audio.format;
    const bitrateMap = { 24000: '24k', 16000: '16k', 12000: '12k', 8000: '8k', 44100: '44k', 22050: '22k', 11025: '11k' };
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

    if (padding) {
        start -= padding;
        end += padding;
        start = Math.max(0, start);
        end = Math.min(end, metadata[file].duration);
    }

    return new Promise(function (resolve) {
        const bufferStream = new stream.PassThrough();
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
                )
            }
        }
        ffmpgCommand.on('start', function (commandLine) {
            if (DEBUG) console.log('FFmpeg command: ' + commandLine);
        })
        ffmpgCommand.on('error', (err) => {
            console.log('An error occurred: ' + err.message);
        })
        ffmpgCommand.on('end', function () {
            console.log(format + " file rendered")
        })
        ffmpgCommand.writeToStream(bufferStream);

        const buffers = [];
        bufferStream.on('data', (buf) => {
            buffers.push(buf);
        });
        bufferStream.on('end', function () {
            const outputBuffer = Buffer.concat(buffers);
            let audio = [];
            audio.push(new Int8Array(outputBuffer))
            const blob = new Blob(audio, { type: mimeType });
            resolve(blob);
        });
    })
};

async function saveAudio(file, start, end, filename, metadata, folder) {
    const thisBlob = await bufferToAudio({
        file: file, start: start, end: end, meta: metadata
    });
    if (folder) {
        const buffer = Buffer.from(await thisBlob.arrayBuffer());
        fs.writeFile(p.join(folder, filename), buffer, () => { if (DEBUG) console.log('Audio file saved') });
    }
    else {
        const anchor = document.createElement('a');
        document.body.appendChild(anchor);
        anchor.style = 'display: none';
        const url = window.URL.createObjectURL(thisBlob);
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        window.URL.revokeObjectURL(url);
    }
}


/// Workers  From the MDN example
function spawnWorkers(model, list, batchSize, threads) {
    NUM_WORKERS = threads;
    // And be ready to receive the list:
    SEEN_LIST_UPDATE = false;
    for (let i = 0; i < threads; i++) {
        const worker = new Worker('./js/model.js', { type: 'module' });
        worker.isAvailable = true;
        predictWorkers.push(worker)
        console.log('loading a worker')
        worker.postMessage({
            message: 'load',
            model: model,
            list: list,
            batchSize: batchSize,
            backend: BACKEND
        })
        worker.onmessage = async (e) => {
            await parseMessage(e)
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

const insertRecord = async (key, speciesID, confidence, file) => {
    const offset = key * 1000;
    let changes, fileID;
    confidence = Math.round(confidence);
    const db =  memoryDB; //STATE.db;
    let res = await db.getAsync('SELECT id FROM files WHERE name = ?', file);
    if (!res) {
        res = await db.runAsync('INSERT OR IGNORE INTO files VALUES ( ?,?,?,? )', 
            null, file, metadata[file].duration, metadata[file].fileStart);
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
    await db.runAsync('INSERT OR REPLACE INTO records VALUES (?,?,?,?,?,?,?,?,?)',
        metadata[file].fileStart + offset, key, fileID, speciesID, confidence,
        null, null, key + 3, 0);
}

const onInsertManualRecord = async ({ cname, start, end, comment, count, file, label, toDisk }) => {
    start = parseFloat(start), end = parseFloat(end);
    const startMilliseconds = Math.round(start * 1000);
    let changes, fileID;
    const db = toDisk ? diskDB : memoryDB;
    const { speciesID } = await db.getAsync(`SELECT id as speciesID FROM species
                                        WHERE cname = ?`, cname);
    let res = await db.getAsync(`SELECT id FROM files WHERE name = ?`, file);
    if (!res) {
        res = await db.runAsync('INSERT OR IGNORE INTO files VALUES ( ?,?,?,? )',
            null, file, metadata[file].duration, metadata[file].fileStart);
        fileID = res.lastID;
        changes = 1;
    } else {
        fileID = res.id;
    }
    if (changes) {
        const durationSQL = Object.entries(metadata[file].dateDuration)
            .map(entry => `(${entry.toString()},${fileID})`).join(',');
        await db.runAsync(`INSERT OR IGNORE INTO duration VALUES ${durationSQL}`);
    }
    let response;
    const dateTime = metadata[file].fileStart + startMilliseconds;
    response = await db.runAsync('INSERT OR REPLACE INTO records VALUES ( ?,?,?,?,?,?,?,?,? )',
        dateTime, start, fileID, speciesID, 2000, label, comment, end, parseInt(count));

    if (response.changes && toDisk) {
        UI.postMessage({ event: 'diskDB-has-records' });
    }
    if (STATE.mode !== 'explore' && toDisk) UI.postMessage({ event: 'generate-alert', message: `A ${cname} record has been saved to the archive.` })
}

const parsePredictions = async (response) => {
    let file = response.file, batchInProgress = false;
    const latestResult = response.result, db = STATE.db;
    if (DEBUG) console.log('worker being used:', response.worker);


    let [keysArray, speciesIDBatch, confidenceBatch] = latestResult;
    for (let i = 0; i < keysArray.length; i++){
        let updateUI = false;
        let key = parseFloat(keysArray[i]);
        const timestamp = metadata[file].fileStart + key * 1000;
        const confidenceArray = confidenceBatch[i]; 
        const speciesIDArray = speciesIDBatch[i];
        for (let j = 0; j < confidenceArray.length; j++){
            let confidence = confidenceArray[j];
            if (confidence < 0.05) break;
            let speciesID = speciesIDArray[j];
            confidence *= 1000;
            updateUI = (confidence > STATE.detect.confidence && 
                STATE.blocked.indexOf(speciesID) === -1);
            if (STATE.selection && updateUI) {
                const confidenceRequired = STATE.userSettingsInSelection ?
                    STATE.detect.confidence : 50;
                if (confidence >= confidenceRequired){
                    const {cname} = await memoryDB.getAsync(`SELECT cname FROM species WHERE id = ${speciesID}`);
                    const duration = (STATE.selection.end - STATE.selection.start) / 1000;
                    const result = {
                        timestamp: timestamp, 
                        position: key,
                        end: key + duration,
                        file: file,
                        cname: cname, 
                        score: confidence}
                    sendResult(++index, result, false)
                }
            }
            //save all results to  db, regardless of confidence
            else {await insertRecord(key, speciesID, confidence, file)}
        }
        if (updateUI && ! STATE.selection) {
            const blocked_condiiion = STATE.blocked.length ?
                `AND species.id NOT IN (${STATE.blocked})` : '';
            //query the db for sname, cname, start and end
            const speciesList = await memoryDB.allAsync(`
                SELECT species.cname, species.sname, records.confidence, callCount, records.end
                FROM species
                        JOIN records ON species.id = records.speciesID
                WHERE records.dateTime = ${timestamp}
                AND confidence > ${STATE.detect.confidence}
                ${blocked_condiiion}
                ORDER BY records.confidence DESC`);
            speciesList.forEach(species => {
                const result = {
                    timestamp: timestamp,
                    position: key,
                    end: species.end,
                    file: file,
                    cname: species.cname,
                    sname: species.sname,
                    score: species.confidence,
                    callCount: species.callCount
                }
                sendResult(++index, result, false)
            })
        }
    }
    STATE.userSettingsInSelection = false;

    const progress = ++predictionsReceived[file] / batchChunksToSend[file];
    UI.postMessage({ event: 'progress', progress: progress, file: file });
    if ( ! STATE.selection){
        if (progress === 1) {
            COMPLETED.push(file);
            db.getAsync('SELECT id FROM files WHERE name = ?', file)
                .then(row => {
                    if (!row) {
                        const result = `No predictions found in ${file}`;
                        UI.postMessage({
                            event: 'prediction-ongoing',
                            file: file,
                            result: result,
                            index: index,
                            selection: STATE.selection
                        });
                    }
                })
            console.log(`Prediction done ${FILE_QUEUE.length} files to go`);
            console.log('Analysis took ' + (new Date() - predictionStart) / 1000 + ' seconds.');
            UI.postMessage({ event: 'progress', progress: 1.0, text: '...' });
            batchInProgress = FILE_QUEUE.length;
            predictionDone = true;
        } else if (STATE.increment() === 0) {
            getSummary({ interim: true});
        }
    }
    return [file, batchInProgress, response.worker]
}


async function parseMessage(e) {
    const response = e.data;
    switch (response['message']) {
        case 'update-list':
            if (!SEEN_LIST_UPDATE) {
                SEEN_LIST_UPDATE = true;
                STATE.update({ blocked: response.blocked, globalOffset: 0 });
                // PREPARE SQL STATEMENTS
                prepStatements();
                if (response['updateResults'] && STATE.db) {
                    // update-results called after setting migrants list, so DB may not be initialized
                    await getResults();
                    await getSummary();
                }
            }
            break;
        case 'model-ready':
            sampleRate = response['sampleRate'];
            const backend = response['backend'];
            console.log(backend);
            UI.postMessage({ event: 'model-ready', message: 'ready', backend: backend, labels: LABELS })
            break;
        case 'labels':
            t0 = Date.now();
            LABELS = response['labels'];
            // Now we have what we need to populate a database...
            // Load the archive db
            await loadDB(appPath);
            break;
        case 'prediction':
            if (!aborted) {
                predictWorkers[response.worker].isAvailable = true;
                let [, batchInProgress, worker] = await parsePredictions(response);
                //if (response['finished']) {

                process.stdout.write(`FILE QUEUE: ${FILE_QUEUE.length}, ${response.file},  Prediction requests ${predictionsRequested[response.file]}, predictions received ${predictionsReceived[response.file]}    \n`)
                if (predictionsReceived[response.file] === predictionsRequested[response.file]) {
                    const limit = 10;
                    clearCache(CACHE_LOCATION, limit);
                    if (batchInProgress) {
                        UI.postMessage({
                            event: 'prediction-done', batchInProgress: true,
                        })
                        processNextFile(worker);
                    } else if (! STATE.selection) {
                        getSummary();
                    }
                }
            }
            break;
        case 'spectrogram':
            onSpectrogram(response['filepath'], response['file'], response['width'], response['height'], response['image'], response['channels'])
            break;
    }
}

// Optional Arguments
async function processNextFile({
    start = undefined, end = undefined, resetResults = false, worker = undefined
} = {}) {
    if (FILE_QUEUE.length) {
        predictionDone = false;

        let file = FILE_QUEUE.shift()
        if (DATASET && FILE_QUEUE.length % 100 === 0) {
            await onSave2DiskDB();
            console.log("Saved results to disk db", FILE_QUEUE.length, "files remaining")
        }
        const found = await getWorkingFile(file);
        if (found) {
            if (end) {
                // If we have an end value already, we're analysing a selection
            }
            if (!start) [start, end] = await setStartEnd(file);
            if (start === end) {
                // Nothing to do for this file
                COMPLETED.push(file);
                const result = `No detections in ${file}. It has no period within it where predictions would be given`;
                index++;
                UI.postMessage({
                    event: 'prediction-ongoing', file: file, result: result, index: index
                });
                if (!FILE_QUEUE.length) {
                    await getSummary();
                    predictionDone = true;
                }
                UI.postMessage({
                    event: 'prediction-done',
                    file: file,
                    audacityLabels: AUDACITY,
                    batchInProgress: FILE_QUEUE.length
                });
                await processNextFile(arguments[0]);

            } else {
                UI.postMessage({
                    event: 'progress',
                    text: "<span class='loading'>Scanning</span>",
                    file: file
                });
                await doPrediction({
                    start: start, end: end, file: file, resetResults: resetResults, worker: worker
                });
            }
        } else {
            await processNextFile(arguments[0]);
        }
    } else {
        predictionDone = true;
    }
}

async function setStartEnd(file) {
    const meta = metadata[file];
    let start, end;
    if (STATE.detect.nocmig) {
        const fileEnd = meta.fileStart + (meta.duration * 1000);
        // If it's dark at the file start, start at 0 ...otherwise start at dusk
        if (meta.fileStart < meta.dawn || meta.fileStart > meta.dusk) {
            start = 0;
        } else {
            // not dark at start, is it still light at the end?
            if (fileEnd <= meta.dusk) {
                // No? skip this file
                return [0, 0];
            } else {
                // So, it *is* dark by the end of the file
                start = (meta.dusk - meta.fileStart) / 1000;
            }
        }
        // Now set the end
        meta.fileStart < meta.dawn && fileEnd >= meta.dawn ? end = (meta.dawn - meta.fileStart) / 1000 : end = meta.duration;
    } else {
        start = 0;
        end = meta.duration;
    }
    return [start, end];
}


const setWhereWhen = ({ dateRange, species, files, context }) => {
    let excluded_species_ids = -1;
    if (!STATE.selection && STATE.blocked.length) {
        excluded_species_ids = `${STATE.blocked}`;
    }
    // NOT the same as a dateRange - this is for analyzing a selection
    const confidence = STATE.selection && ! STATE.userSettingsInSelection ? 50 : STATE.detect.confidence;
    let where = `${confidence}`;
    if (files?.length) {
        const name = context === 'summary' ? 'files.name' : 'name';
        const filesSQL = files.map(file => `'${prepSQL(file)}'`).join(',');
        where += ` AND ${name} IN  (${filesSQL})`;
    }

    //const cname = context === 'summary' ? 'cname' : 's1.cname';
    if (species) where += ` AND cname =  '${prepSQL(species)}'`;
    const when = dateRange?.start ? ` AND dateTime BETWEEN ${dateRange.start} AND ${dateRange.end}` : '';
    return [where, when, excluded_species_ids]
};




const getSummary = async ({
    species = undefined,
    active = undefined,
    interim = false,
    action = undefined,
    topRankin = STATE.topRankin
} = {}) => {
    const db = STATE.db;
    const offset = species ? STATE.filteredOffset[species] : STATE.globalOffset;
    let range, files = [];
    if ( ['explore', 'chart'].includes(STATE.mode)) {
        range = STATE[STATE.mode].range;
    } else {
        files = STATE.filesToAnalyse;
    }

    t0 = Date.now();
    const speciesForSTMT = species || '%';
    const params = getSummaryParams(speciesForSTMT);
    const summary = await STATE.GET_SUMMARY_SQL.allAsync(...params);

    if (DEBUG) console.log("Get Summary took", (Date.now() - t0) / 1000, " seconds");
    const event = interim ? 'update-summary' : 'prediction-done';
    UI.postMessage({
        event: event,
        summary: summary,
        offset: offset,
        audacityLabels: AUDACITY,
        filterSpecies: species,
        active: active,
        batchInProgress: false,
        action: action
    })
};


/**
 *
 * @param files: files to query for detections
 * @param species: filter for SQL query
 * @param context: can be 'results', 'resultSummary' or 'selectionResults'
 * @param limit: the pagination limit per page
 * @param offset: is the SQL query offset to use
 * @param topRankin: return results >= to this rank for each datetime
 * @param exportTo: if set, will export audio of the returned results to this folder
 *
 * @returns {Promise<integer> } A count of the records retrieved
 */
const getResults = async ({
    species = undefined,
    context = 'results',
    limit = 500,
    offset = undefined,
    topRankin = STATE.topRankin,
    exportTo = undefined
} = {}) => {
    const { db, sortOrder, mode, filesToAnalyse } = STATE;
    const range = STATE.selection || STATE[mode]?.range;
    const files = mode === 'explore' ? [] : filesToAnalyse;
    let confidence = STATE.detect.confidence;
    if (STATE.selection && ! STATE.userSettingsInSelection) {
        offset = 0;
        confidence = 50;
        topRankin = 5;
    } else if (offset === undefined) { // Get offset state
        if (species) {
            if (!STATE.filteredOffset[species]) STATE.filteredOffset[species] = 0;
            offset = STATE.filteredOffset[species];
        } else {
            offset = STATE.globalOffset;
        }
    } else { // Set offset state
        if (species) STATE.filteredOffset[species] = offset;
        else STATE.update({ globalOffset: offset });
    }

    let index = offset;
    AUDACITY = {};
    let t0 = Date.now();
    const speciesForSTMT = species || '%';
    const params = getResultsParams(speciesForSTMT, confidence, offset, limit, topRankin);
    const result = await STATE.GET_RESULT_SQL.allAsync(...params);

    for (let i = 0; i < result.length; i++) {
        const r = result[i];
        if (exportTo) {
            // Format date to YYYY-MM-DD-HH-MM-ss
            const dateString = new Date(r.timestamp).toISOString().replace(/[TZ]/g, ' ').replace(/\.\d{3}/, '').replace(/[-:]/g, '-').trim();
            const filename = `${r.cname}-${dateString}.${STATE.audio.format}`
            console.log(`Exporting from ${r.file}, position ${r.position}, into folder ${exportTo}`)
            saveAudio(r.file, r.position, r.position + 3, filename, metadata, exportTo)
            if (i === result.length - 1) UI.postMessage({ event: 'generate-alert', message: `${result.length} files saved` })
        }
        else if (species && context !== 'explore') {

            const { count } = await db.getAsync(`SELECT COUNT(*) as count FROM records WHERE dateTime = ?
                                                 AND confidence >= ?`, r.timestamp, confidence);
            r.count = count;
            sendResult(++index, r, true);
        } else {
            sendResult(++index, r, true)
        }
    }
    console.log("Get Results took", (Date.now() - t0) / 1000, " seconds");
    if (!result.length) {
        if (STATE.selection) {
            // No more detections in the selection
            sendResult(++index, 'No detections found in the selection', true)
        } else {
            species = species || '';
            sendResult(++index, `No ${species} detections found.`, true)
        }
    }
};

const sendResult = (index, result, fromDBQuery) => {
    const file = result.file;
    if (typeof result === 'object') {
        // Convert confidence back to % value
        result.score = (result.score / 10).toFixed(0)

        // Recreate Audacity labels
        const audacity = {
            timestamp: `${result.position}\t${result.position + WINDOW_SIZE}`,
            cname: result.cname,
            score: Number(result.score) / 100
        };
        AUDACITY[file] ? AUDACITY[file].push(audacity) : AUDACITY[file] = [audacity];
    }
    UI.postMessage({
        event: 'prediction-ongoing',
        file: file,
        result: result,
        index: index,
        isFromDB: fromDBQuery,
        selection: STATE.selection
    });
};


const getSavedFileInfo = async (file) => {
    // look for file in the disk DB, ignore extension
    return new Promise(function (resolve) {
        const baseName = file.replace(/^(.*)\..*$/g, '$1%');
        const stmt = diskDB.prepare('SELECT * FROM files WHERE name LIKE  (?)');
        stmt.get(baseName, (err, row) => {
            if (err) {
                console.log('There was an error ', err)
            } else {
                resolve(row)
            }
        })
    })
};


/**
 *  Transfers data in memoryDB to diskDB
 * @returns {Promise<unknown>}
 */
const onSave2DiskDB = async () => {
    t0 = Date.now();
    memoryDB.runAsync('BEGIN');
    let response = await memoryDB.runAsync(`INSERT OR IGNORE INTO disk.files (id, name, duration, filestart) 
                                            SELECT id, name, duration, filestart FROM files`);
    console.log(response.changes + ' files added to disk database')
    // Update the duration table
    response = await memoryDB.runAsync('INSERT OR IGNORE INTO disk.duration SELECT * FROM duration');
    console.log(response.changes + ' date durations added to disk database')
    response = await memoryDB.runAsync(`INSERT OR IGNORE INTO disk.records 
        SELECT * FROM records
        WHERE confidence >= ${STATE.detect.confidence} AND speciesID NOT IN (${STATE.blocked})`);
    console.log(response.changes + ' records added to disk database')
    if (response.changes) {
        UI.postMessage({ event: 'diskDB-has-records' });
    }
    await memoryDB.runAsync('END');

    if (!DATASET) {

        // Now we have saved the records, set state to DiskDB
        STATE.update({ db: diskDB });
        UI.postMessage({
            event: 'generate-alert',
            message: `Database update complete, ${response.changes} records added to the archive in ${((Date.now() - t0) / 1000)} seconds`
        })
    }
};

const getSeasonRecords = async (species, season) => {
    // Because we're using stmt.prepare, we need to unescape quotes
    const seasonMonth = { spring: "< '07'", autumn: " > '06'" }
    return new Promise(function (resolve, reject) {
        const stmt = diskDB.prepare(`
            SELECT MAX(SUBSTR(DATE(records.dateTime/1000, 'unixepoch', 'localtime'), 6)) AS maxDate,
                   MIN(SUBSTR(DATE(records.dateTime/1000, 'unixepoch', 'localtime'), 6)) AS minDate
            FROM records
                     JOIN species ON species.id = records.speciesID
            WHERE species.cname = (?)
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
        diskDB.get(`
            SELECT COUNT(*) as count, 
            DATE(dateTime/1000, 'unixepoch', 'localtime') as date
            FROM records JOIN species
            on species.id = records.speciesID
            WHERE species.cname = '${prepSQL(species)}'
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
    species = undefined, range = {}
}) => {
    const dateRange = range;
    // Work out sensible aggregations from hours difference in daterange
    const hours_diff = dateRange.start ? Math.round((dateRange.end - dateRange.start) / (1000 * 60 * 60)) : 745;
    console.log(hours_diff, "difference in hours")
    const dateFilter = dateRange.start ? ` AND dateTime BETWEEN ${dateRange.start} AND ${dateRange.end} ` : '';
    // default to group by Week
    let dataPoints = Math.max(52, Math.round(hours_diff / 24 / 7));
    let groupBy = "Year, Week";
    let orderBy = 'Year'
    let aggregation = 'Week';
    let startDay = 0;
    if (hours_diff <= 744) {
        //31 days or less: group by Day
        groupBy += ", Day";
        orderBy = 'Year, Week';
        dataPoints = Math.round(hours_diff / 24);
        aggregation = 'Day';
        const date = dateRange.start ? new Date(dateRange.start) : Date.UTC(2020, 0, 0, 0, 0, 0);
        startDay = Math.floor((date - new Date(date.getFullYear(), 0, 0, 0, 0, 0)) / 1000 / 60 / 60 / 24);
    }
    if (hours_diff <= 72) {
        // 3 days or less, group by Hour of Day
        groupBy += ", Hour";
        orderBy = 'Day, Hour';
        dataPoints = hours_diff;
        aggregation = 'Hour';
    }

    return new Promise(function (resolve, reject) {
        diskDB.all(`SELECT STRFTIME('%Y', DATETIME(dateTime / 1000, 'unixepoch', 'localtime')) AS Year, 
            STRFTIME('%W', DATETIME(dateTime/1000, 'unixepoch', 'localtime')) AS Week,
            STRFTIME('%j', DATETIME(dateTime/1000, 'unixepoch', 'localtime')) AS Day, 
            STRFTIME('%H', DATETIME(dateTime/1000, 'unixepoch', 'localtime')) AS Hour,    
            COUNT(*) as count
                    FROM records
                        JOIN species
                    ON species.id = speciesID
                    WHERE species.cname = '${species}' ${dateFilter}
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
        const calls = new Array(52).fill(0);
        const total = new Array(52).fill(0);


        diskDB.all(`select STRFTIME('%W', DATE(dateTime / 1000, 'unixepoch', 'localtime')) as week, COUNT(*) as calls
                    from records
                             JOIN species ON species.id = records.speciesID
                    WHERE species.cname = '${species}'
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

const getSpecies = () => {
    const range = STATE.explore.range;
    const [where, when] = setWhereWhen({ dateRange: range });
    diskDB.all(`SELECT DISTINCT cname, sname, COUNT(cname) as count
                FROM records
                    JOIN species
                ON speciesID = id AND confidence >= ${where} ${when}
                GROUP BY cname
                ORDER BY cname`, (err, rows) => {
        if (err) console.log(err); else {
            UI.postMessage({ event: 'seen-species-list', list: rows })
        }
    })
    return true
};


const onUpdateFileStart = async (args) => {
    let file = args.file;
    const newfileMtime = args.start + (metadata[file].duration * 1000);
    await utimes(file, Math.round(newfileMtime));
    // update the metadata
    metadata[file].isComplete = false;
    //allow for this file to be compressed...
    await getWorkingFile(file);
    let db = STATE.db;
    db.runAsync('BEGIN');
    let { id } = await db.getAsync('SELECT id from files where name = ?', file);
    const { changes } = await db.runAsync('UPDATE files SET filestart = ? where id = ?', args.start, id);
    console.log(changes ? `Changed ${file}` : `No changes made`);
    let result = await db.runAsync('UPDATE records set dateTime = (position * 1000) + ? where fileid = ?', args.start, id);
    db.runAsync('END');
    console.log(`Changed ${result.changes} records associated with  ${file}`);
};


const prepSQL = (string) => string.replaceAll("''", "'").replaceAll("'", "''");


async function onDelete({
    file,
    start,
    end,
    species,
    // need speciesfiltered because species triggers getSummary to highlight it
    speciesFiltered
}) {
    const db = STATE.db;
    const { filestart } = await db.getAsync('SELECT filestart from files WHERE name = ?', file);
    start = filestart + (parseFloat(start) * 1000);
    end = filestart + (parseFloat(end) * 1000);
    const params = [start, end];
    let sql = 'DELETE FROM records WHERE datetime = ? AND end = ?';
    if (species) {
        sql += ' AND speciesID = (SELECT id FROM species WHERE cname = ?)'
        params.push(species);
    }
    let { changes } = await db.runAsync( sql, ...params);
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
            getSpecies();
        }
    }
}

async function onDeleteSpecies({
    species,
    // need speciesfiltered because species triggers getSummary to highlight it
    speciesFiltered
}) {
    const db = STATE.db;
    const speciesSQL = prepSQL(species);
    let SQL = `DELETE FROM records 
            WHERE speciesID = (SELECT id FROM species WHERE cname = '${speciesSQL}')`;
    if (STATE.mode === 'analyse'){
        const filesSQL = STATE.filesToAnalyse.map(file => `'${prepSQL(file)}'`).join(',');
        const rows = await db.allAsync(`SELECT id FROM files WHERE NAME IN (${filesSQL})`);
        const ids = rows.map(row => row.id).join(',');
        SQL += ` AND fileID in (${ids})`;
    }
    if (STATE.mode === 'explore'){
        const {start, end} = STATE.explore.range;
        if (start) SQL += ` AND dateTime BETWEEN ${start} AND ${end}`
    }
    let { changes } = await db.runAsync(SQL);
    if (changes) {
        if (STATE.mode !== 'selection') {
        // Update the summary table
            if (speciesFiltered === false) {
                delete arguments[0].species
            }
            await getSummary(arguments[0]);
        }
        if (db === diskDB) {
        // Update the seen species list
            getSpecies();
        }
    }
}


async function onChartRequest(args) {
    console.log(`Getting chart for ${args.species} starting ${args.range.start}`);
    const dateRange = args.range, results = {}, dataRecords = {};
    // Escape apostrophes
    if (args.species) {
        args.species = prepSQL(args.species);
        t0 = Date.now();
        await getSeasonRecords(args.species, 'spring')
            .then((result) => {
                dataRecords.earliestSpring = result['minDate'];
                dataRecords.latestSpring = result['maxDate'];
            }).catch((message) => {
                console.log(message)
            })

        await getSeasonRecords(args.species, 'autumn')
            .then((result) => {
                dataRecords.earliestAutumn = result['minDate'];
                dataRecords.latestAutumn = result['maxDate'];
            }).catch((message) => {
                console.log(message)
            })

        console.log(`Season chart generation took ${(Date.now() - t0) / 1000} seconds`)
        t0 = Date.now();
        await getMostCalls(args.species)
            .then((row) => {
                row ? dataRecords.mostDetections = [row.count, row.date] : dataRecords.mostDetections = ['N/A', 'Not detected'];
            }).catch((message) => {
                console.log(message)
            })

        console.log(`Most calls  chart generation took ${(Date.now() - t0) / 1000} seconds`)
        t0 = Date.now();
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
                    results[year] = new Array(dataPoints).fill(0);
                }
                if (aggregation === 'Week') {
                    results[year][parseInt(week) - 1] = count;
                } else if (aggregation === 'Day') {
                    results[year][parseInt(day) - startDay] = count;
                } else {
                    const d = new Date(dateRange.start);
                    const hoursOffset = d.getHours();
                    const index = ((parseInt(day) - startDay) * 24) + (parseInt(hour) - hoursOffset);
                    results[year][index] = count;
                }
            }
            return [dataPoints, aggregation]
        }).catch((message) => {
            console.log(message)
        })

    console.log(`Chart series generation took ${(Date.now() - t0) / 1000} seconds`)
    t0 = Date.now();
    // If we have a years worth of data add total recording duration and rate
    let total, rate;
    if (dataPoints === 52) [total, rate] = await getRate(args.species)
    console.log(`Chart rate generation took ${(Date.now() - t0) / 1000} seconds`)
    const pointStart = dateRange.start ? dateRange.start : Date.UTC(2020, 0, 0, 0, 0, 0);
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
        getSpecies();
        UI.postMessage({
            event: 'generate-alert', message: `${fileName} 
and its associated records were deleted successfully`});
    } else {
        UI.postMessage({
            event: 'generate-alert', message: `${fileName} 
was not found in the Archve databasse.`});
    }
}

// const db2ResultSQL = `SELECT DISTINCT dateTime AS timestamp, 
//   files.duration, 
//   files.filestart,
//   files.name AS file, 
//   position,
//   species.sname, 
//   species.cname, 
//   confidence AS score, 
//   label, 
//   comment
//                       FROM records
//                           JOIN species
//                       ON species.id = records.speciesID
//                           JOIN files ON records.fileID = files.id`;



/*
todo: bugs
    ***when analysing second batch of results, the first results linger.
    ***manual records entry doesn't preserve species in explore mode
    ***save records to db doesn't work with updaterecord!
    ***AUDACITY results for multiple files doesn't work well, as it puts labels in by position only. Need to make audacity an object,
        and return the result for the current file only #######
    ***In explore, editID doesn't change the label of the region to the new species
    ***Analyse selection returns just the file in which the selection is requested
    Reported region duration tooltip incorrect 

Todo: Database
     Database delete: records, files (and all associated records). Use when reanalysing
     Database file path update, batch update - so we can move files around after analysis
     ***Compatibility with updates, esp. when num classes change
        -Create a new database for each model with appropriate num classes?

Todo: Location.
     Associate lat lon with files, expose lat lon settings in UI. Allow for editing once saved. Filter Explore by location

Todo cache:
    Set cache location
    Control cache size in settings

Todo: manual entry
    ***check creation of manual entries
    ***indicate manual entry/confirmed entry
    save entire selected range as one entry. By default or as an option?
    ***get entry to appear in position among existing detections and centre on it

Todo: UI
    Better tooltips, for all options
    Sort summary by headers (click on species or header)
    ***Have a panel for all analyse settings, not just nocmig mode
    Align the label on the spec to the right to minimize overlap with axis labels


Todo: Charts
    Allow better control of aggregation (e.g) hourly over a week
    Permit inclusion of hours recorded in other date ranges
    Allow choice of chart type
    Rip out highcharts, use chart.js.
    Allow multiple species comparison, e.g. compare Song Thrush and Redwing peak migration periods

Todo: Explore
    ***Make summary range aware
    ***Make seen species list range aware

Todo: Performance
    ***Smaller model faster - but retaining accuracy? Read up on Knowledge distillation
    *** Spawn several prediction workers

Todo: model.
     Improve accuracy, accuracy accuracy!
        - refine training
        - ***(look at snr for false positives impact
     Establish classes protocol. What's in, what name to give it
     Speed - knowledge distillation??

Todo: Releases
     Limit features for free users
     Premium features are??
     Upsell premium features
     Automatic updates
     Implement version protocol
     ***Better way to link js model to checkpoint model: USE same folder names

Todo: IDs
    Search by label,
    Search for comment

Todo: Tests & code quality
    Order / group functions semantically
    Investigate unit tests
    Investigate coverage
    Integrate with commit?
    Document code, jsdoc?
    Use de-referencing on all args parameters
    Shorten functions
    Review all global vars: set global var policy. Capitalise all globals
    Make use of const functions / arrow vs. normal ones consistent.
    **Review use of async functions
    **Make Locatefile() case insensitive
 */