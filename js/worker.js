const {ipcRenderer} = require('electron');
const fs = require('fs');
const wavefileReader = require('wavefile-reader');
const lamejs = require("lamejstmp");
const ID3Writer = require('browser-id3-writer');
const p = require('path');
let BATCH_SIZE = 12;
const adding_chirpity_additions = false;
let labels;
const sqlite3 = require('sqlite3').verbose();
const SunCalc = require('suncalc2');
const ffmpeg = require('fluent-ffmpeg');
const png = require('fast-png');
const {writeFile, mkdir} = require('node:fs/promises');
const {utimes} = require('utimes');
const stream = require("stream");
const {op} = require("@tensorflow/tfjs");
const file_cache = 'chirpity';
let TEMP, appPath;

const staticFfmpeg = require('ffmpeg-static-electron');
console.log(staticFfmpeg.path);
ffmpeg.setFfmpegPath(staticFfmpeg.path);


let predictionsRequested = 0, predictionsReceived = 0;

let diskDB, memoryDB, NOCMIG, latitude, longitude;

const createDB = (file) => {
    return new Promise((resolve, reject) => {
        const archiveMode = !!file;
        if (file) {
            fs.openSync(file, "w");
            diskDB = new sqlite3.Database(file);
            console.log("Created disk database", file);
        } else {
            memoryDB = new sqlite3.Database(':memory:');
            console.log("Created new in-memory database");
        }
        const db = archiveMode ? diskDB : memoryDB;
        db.serialize(() => {
            db.run(`CREATE TABLE species
                    (
                        id    INTEGER PRIMARY KEY,
                        sname TEXT,
                        cname TEXT
                    )`, function (createResult) {
                if (createResult) throw createResult;
            });
            db.run(`CREATE TABLE files
                    (
                        name      TEXT,
                        duration  REAL,
                        filestart INTEGER,
                        UNIQUE (name)
                    )`, function (createResult) {
                if (createResult) throw createResult;
            });
            db.run(`CREATE TABLE duration
                    (
                        day      INTEGER,
                        duration INTEGER,
                        fileID   INTEGER,
                        UNIQUE (day, fileID)
                    )`, function (createResult) {
                if (createResult) throw createResult;
            });

            db.run(`CREATE TABLE records
                    (
                        dateTime INTEGER,
                        birdID1  INTEGER,
                        birdID2  INTEGER,
                        birdID3  INTEGER,
                        conf1    REAL,
                        conf2    REAL,
                        conf3    REAL,
                        fileID   INTEGER,
                        position INTEGER,
                        label    TEXT,
                        comment  TEXT,
                        UNIQUE (dateTime, fileID)
                    )`, function (createResult) {
                if (createResult) throw createResult;
            });
            const stmt = db.prepare("INSERT INTO species VALUES (?, ?, ?)");
            for (let i = 0; i < labels.length; i++) {
                const [sname, cname] = labels[i].split('_')
                stmt.run(i, sname, cname);
            }
            stmt.finalize();
        });
    })
}

function loadDB(path) {
    let db = path ? diskDB : memoryDB;
    if (!db) {
        if (path) {
            const file = p.join(path, 'archive.sqlite')
            if (!fs.existsSync(file)) {
                createDB(file);
            } else {
                diskDB = new sqlite3.Database(file);
                console.log("Opened disk db " + file)
            }
        } else {
            createDB();
        }
    } else {
        console.log('Database loaded, nothing to do')
    }
}

let metadata = {};
let minConfidence, index = 0, AUDACITY = [], RESULTS = [], predictionStart;
let sampleRate = 24000;  // Value obtained from model.js CONFIG, however, need default here to permit file loading before model.js response
let predictWorker, predicting = false, predictionDone = false, aborted = false;

// Set up the audio context:
const audioCtx = new AudioContext({latencyHint: 'interactive', sampleRate: sampleRate});

let UI;
let FILE_QUEUE = [];

const clearCache = () => {
    return new Promise((resolve) => {
        // clear & recreate file cache folder
        fs.rmSync(p.join(TEMP, file_cache), {recursive: true, force: true});
        fs.mkdir(p.join(TEMP, file_cache), (err, path) => {
            resolve(path);
        })
    })
}

ipcRenderer.on('new-client', (event) => {
    [UI] = event.ports;
    UI.onmessage = async (e) => {
        const args = e.data;
        const action = args.action;
        console.log('message received ', action)
        switch (action) {
            case 'set-variables':
                latitude = args.lat, longitude = args.lon, TEMP = args.temp, appPath = args.path;
                break;
            case 'update-record':
                args.db = diskDB;
                await onUpdateRecord(args)
                break;
            case 'update-file-start':
                await onUpdateFileStart(args)
                break;
            case 'get-detected-species-list':
                getSpecies(diskDB);
                break;
            case 'create-dataset':
                saveResults2DataSet(RESULTS);
                break;
            case 'load-model':
                UI.postMessage({event: 'spawning'});
                BATCH_SIZE = parseInt(args.batchSize);
                if (predictWorker) predictWorker.terminate();
                spawnWorker(args.model, args.list, BATCH_SIZE, args.warmup);
                break;
            case 'init':
                latitude = args.lat;
                longitude = args.lon;
                TEMP = args.temp;
                appPath = args.path;
                await clearCache();
                break;
            case 'update-model':
                predictWorker.postMessage({message: 'list', list: args.list})
                break;
            case 'file-load-request':
                index = 0;
                if (predicting) onAbort(args);
                console.log('Worker received audio ' + args.file);
                predictionsRequested = 0;
                predictionsReceived = 0;
                await loadAudioFile(args);

                break;
            case 'update-buffer':
                await loadAudioFile(args);
                break;
            case 'filter':
                await sendResults2UI(args);
                break;
            case 'explore':
                args.db = diskDB;
                args.saveSummary = false;
                await sendResults2UI(args);
                break;
            case 'analyze':
                predictionsReceived = 0;
                predictionsRequested = 0;
                await onAnalyze(args);
                break;
            case 'save':
                console.log("file save requested")
                await saveMP3(args.file, args.start, args.end, args.filename, args.metadata);
                break;
            case 'post':
                await uploadOpus(args);
                break;
            case 'save2db':
                await onSave2DB(diskDB);
                break;
            case 'abort':
                onAbort(args);
                break;
            case 'chart':
                onChartRequest(args);
                break;
            default:
                UI.postMessage('Worker communication lines open')
        }
    }
})

// No need to pass through arguments object, so arrow function used.
const sendResults2UI = async ({
                                  saveSummary = false,
                                  db = memoryDB,
                                  species = undefined,
                                  range = undefined,
                                  filelist = undefined
                              }) => {
    // reset results table
    UI.postMessage({event: 'reset-results', saveSummary: saveSummary});
    // And clear results from memory

    RESULTS = [];
    let results = await getCachedResults({
        db: db,
        species: species,
        range: range,
        files: filelist
    });
    // No results? Try the archive
    if (!results.length) {
        console.log(`No results in ${db.filename.replace(/.*\//, '')}, trying the archive db.`);
        results = await getCachedResults({db: diskDB, species: species, range: range, files: filelist});
    }
    index = 0;
    results.forEach(result => {
        //format dates
        //result.timestamp = new Date(result.timestamp);
        //result.position = new Date(result.position);
        index++;
        UI.postMessage({
            event: 'prediction-ongoing',
            file: result.file,
            result: result,
            index: index,
            saveSummary: saveSummary
        });
        RESULTS.push(result);
    })
    // When in batch mode the 'prediction-done' event simply increments
    // the counter for the file being processed
    UI.postMessage({
        event: 'prediction-done',
        batchInProgress: false,
        filterSpecies: species,
        saveSummary: saveSummary
    });
}

// Not an arrow function. Async function has access to arguments - so we can pass them to processnextfile
async function onAnalyze({
                             files = [],
                             confidence = 0.5,
                             start = 0,
                             end = undefined,
                             resetResults = false,
                             lat = 51,
                             lon = -0.4,
                             nocmig = false
                         }) {
    console.log(`Worker received message: ${files}, ${confidence}, start: ${start}, end: ${end}`);
    // Analyze works on one file at a time
    const file = files[0];
    if (resetResults) {
        index = 0;
        AUDACITY = [];
        RESULTS = [];
        createDB();
    }
    latitude = lat;
    longitude = lon;
    // Set global var, for parsePredictions
    NOCMIG = nocmig;
    FILE_QUEUE.push(file);
    console.log(`Adding ${file} to the queue.`)
    // check if results for the file have been saved to the disk DB
    const cachedFile = await isDuplicate(file);
    if (cachedFile && resetResults) {
        //remove the file from the queue - wherever it sits, this prevents out of
        // sequence issues with batch analysis
        const place = FILE_QUEUE.indexOf(file);
        if (place > -1) { // only splice array when item is found
            FILE_QUEUE.splice(place, 1); // 2nd parameter means remove one item only
        }
        // Pull the results from the database
        const results = await getCachedResults({db: diskDB, files: [cachedFile], range: {}});
        UI.postMessage({event: 'update-audio-duration', value: metadata[cachedFile].duration});
        results.forEach(result => {
            //format dates
            result.timestamp = new Date(result.timestamp);
            //result.position = new Date(result.position);
            index++;
            UI.postMessage({
                event: 'prediction-ongoing',
                file: result.file,
                result: result,
                index: index,
                resetResults: false,
            });
            RESULTS.push(result);
        })
        console.log(`Pulling results for ${file} from the memory database`);
        // When in batch mode the 'prediction-done' event simply increments
        // the counter for the file being processed
        UI.postMessage({
            event: 'prediction-done',
            batchInProgress: false,
        });
        //if (FILE_QUEUE.length) await processNextFile();
    } else if (!predicting) {
        predicting = true;
        minConfidence = confidence;
        await processNextFile(arguments[0]);
    }
}

function onAbort({
                     model = 'efficientnet',
                     list = 'migrants',
                     warmup = true
                 }) {
    aborted = true;
    FILE_QUEUE = [];
    index = 0;
    console.log("abort received")
    if (predicting) {
        //restart the worker
        UI.postMessage({event: 'spawning'});
        predictWorker.terminate()
        spawnWorker(model, list, BATCH_SIZE, warmup)
    }
    predicting = false;
    predictionDone = true;
    UI.postMessage({event: 'prediction-done', audacityLabels: AUDACITY, batchInProgress: false});
}

const getDuration = async (src) => {
    let audio;
    return new Promise(function (resolve) {
        audio = new Audio();
        audio.src = src;
        audio.addEventListener("loadedmetadata", function () {
            const duration = audio.duration
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
        let totalTime;
        ffmpeg(file)
            .audioChannels(1)
            .audioFrequency(24000)
            .on('error', (err) => {
                console.log('An error occurred: ' + err.message);
                if (err) {
                    error(err.message);
                }
            })
            // Handle progress % being undefined
            .on('codecData', data => {
                // HERE YOU GET THE TOTAL TIME
                totalTime = parseInt(data.duration.replace(/:/g, ''))
            })
            .on('progress', (progress) => {
                // HERE IS THE CURRENT TIME
                const time = parseInt(progress.timemark.replace(/:/g, ''))

                // AND HERE IS THE CALCULATION
                const percent = (time / totalTime) * 100
                console.log('Processing: ' + percent + ' % converted');
                UI.postMessage({
                    event: 'progress',
                    text: 'Decompressing file',
                    progress: percent / 100
                })
            })
            .on('end', () => {
                UI.postMessage({event: 'progress', text: 'File decompressed', progress: 1.0})
                //if (finish) {
                resolve(destination)
                //}
            })
            .save(destination);
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
    if (metadata[file] && metadata[file].isComplete) return metadata[file].proxy;
    // find the file
    const source_file = await locateFile(file);
    if (!source_file) return false;
    let proxy = file;

    if (!source_file.endsWith('.wav')) {
        const pc = p.parse(source_file);
        const filename = pc.base.replace(pc.ext, '.wav');
        const destination = p.join(TEMP, file_cache, filename);
        if (fs.existsSync(destination)) {
            proxy = destination;
        } else {
            // get some metadata from the source file
            const statsObj = fs.statSync(source_file);
            const sourceMtime = statsObj.mtime;

            //console.log(Date.UTC(sourceMtime));

            proxy = await convertFileFormat(source_file, destination, statsObj.size,
                function (errorMessage) {
                    console.log(errorMessage);
                    return true;
                });
            // assign the source file's save time to the proxy file
            await utimes(proxy, sourceMtime.getTime());
        }
    }
    await getMetadata(file, proxy, source_file);
    return proxy;
}

/**
 * Function to return path to file searching for new extensions if original file has been compressed.
 * @param file
 * @returns {Promise<*>}
 */
async function locateFile(file) {
    const supported_files = ['.wav', '.m4a', '.mp3', '.mpga', '.ogg', '.opus', '.flac', '.aac', '.mpeg', '.mp4',
        '.WAV', '.M4A', '.MP3', '.MPGA', '.OGG', '.OPUS', '.FLAC', '.AAC', '.MPEG', '.MP4'];
    const dir = p.parse(file).dir, name = p.parse(file).name;
    let foundFile;
    const matchingFileExt = supported_files.find(ext => {
        foundFile = p.join(dir, name + ext);
        return fs.existsSync(foundFile)
    })
    if (!matchingFileExt) {
        UI.postMessage({
            event: 'generate-alert',
            message: `Unable to load source file with any supported file extension: ${file}`
        })
        return false;
    }
    return foundFile;
}

async function loadAudioFile({
                                 file = '',
                                 start = 0,
                                 end = 20,
                                 position = 0,
                                 region = false
                             }) {
    const found = await getWorkingFile(file);
    if (found) {
        await fetchAudioBuffer({file, start, end})
            .then((buffer) => {
                const length = buffer.length;
                const myArray = buffer.getChannelData(0);
                UI.postMessage({
                    event: 'worker-loaded-audio',
                    fileStart: metadata[file].fileStart,
                    sourceDuration: metadata[file].duration,
                    bufferBegin: start,
                    file: file,
                    position: position,
                    length: length,
                    contents: myArray,
                    region: region
                });
            })
            .catch(e => {
                console.log('e');
            })
    }
}


function addDays(date, days) {
    let result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

/**
 * Called by getWorkingFile, setStartEnd?, getFileStart?,
 * Assigns file metadata to a metadata cache object. file is the key, and is the source file
 * proxy is required if the source file is not a wav to populate the headers
 * @param file: the file name passed to the worker
 * @param proxy: the wav file to use for predictions
 * @param source_file: the file that exists ( will be different after compression)
 * @returns {Promise<unknown>}
 */
const getMetadata = (file, proxy, source_file) => {
    return new Promise(async (resolve) => {
        if (metadata[file] && metadata[file].isComplete) {
            resolve(metadata[file])
        } else {
            // If we have it already, no need to do any more
            if (!proxy) proxy = file;
            if (!source_file) source_file = file;
            let fileStart, fileEnd;
            metadata[file] = {proxy: proxy};

            // CHeck the database first, so we honour any manual update.
            const savedMeta = await getFileInfo(file);
            metadata[file].duration = savedMeta && savedMeta.duration ? savedMeta.duration : await getDuration(proxy);
            if (savedMeta && savedMeta.filestart) {
                fileStart = new Date(savedMeta.filestart);
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
                resolve(metadata[file]);
            });
            readStream.on('error', err => {
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
    chunk = Buffer.concat([header, chunk]);
    const audioBufferChunk = await audioCtx.decodeAudioData(chunk.buffer);
    const source = audioCtx.createBufferSource();
    source.buffer = audioBufferChunk;
    const duration = source.buffer.duration;
    const buffer = source.buffer;
    const offlineCtx = new OfflineAudioContext(1, sampleRate * duration, sampleRate);
    const offlineSource = offlineCtx.createBufferSource();
    offlineSource.buffer = buffer;
    offlineSource.connect(offlineCtx.destination);
    offlineSource.start();
    return offlineCtx;
}

const getAudioBuffer = (start, end, file) => {
    const byteStart = convertTimeToBytes(start, metadata[file]);
    const byteEnd = convertTimeToBytes(end, metadata[file]);
    const highWaterMark = metadata[file].bytesPerSec * BATCH_SIZE * 3;
    const proxy = metadata[file].proxy;

    const readStream = fs.createReadStream(proxy, {
        start: byteStart,
        end: byteEnd,
        highWaterMark: highWaterMark
    });

    readStream.on('data', async chunk => {
        // Ensure data is processed in order
        readStream.pause();
        return new Promise(async (resolve, reject) => {
            const offlineCtx = await setupCtx(chunk, metadata[file].header);
            offlineCtx.startRendering().then(
                (resampled) => {
                    resolve(resampled);
                    // Now the async stuff is done ==>
                    readStream.resume();
                }).catch((err) => {
                console.error(`PredictBuffer rendering failed: ${err}`);
                // Note: The promise should reject when startRendering is called a second time on an OfflineAudioContext
            });
        })
    })
    readStream.on('end', function () {
        readStream.close()
    })
    readStream.on('error', err => {
        console.log(`readstream error: ${err}, start: ${start}, , end: ${end}, duration: ${metadata[file].duration}`)
    })
}


const getPredictBuffers = async ({
                                     file = '',
                                     start = 0,
                                     end = undefined,
                                     resetResults = false
                                 }) => {
    //let start = args.start, end = args.end, resetResults = args.resetResults, file = args.file;
    let chunkLength = 72000;
    // Ensure max and min are within range
    start = Math.max(0, start);
    end = Math.min(metadata[file].duration, end);

    if (start > metadata[file].duration) {
        return
    }
    const byteStart = convertTimeToBytes(start, metadata[file]);
    const byteEnd = convertTimeToBytes(end, metadata[file]);
    // Match highWaterMark to batch size... so we efficiently read bytes to feed to model - 3 for 3 second chunks
    const highWaterMark = metadata[file].bytesPerSec * BATCH_SIZE * 3;
    const proxy = metadata[file].proxy;
    const readStream = fs.createReadStream(proxy, {
        start: byteStart,
        end: byteEnd,
        highWaterMark: highWaterMark
    });
    let chunkStart = start * sampleRate;
    //const fileDuration = end - start;
    readStream.on('data', async chunk => {
        // Ensure data is processed in order
        readStream.pause();
        if (chunk.length > 6000) { // 1/4 of a second
            const offlineCtx = await setupCtx(chunk, metadata[file].header);
            offlineCtx.startRendering().then(
                (resampled) => {
                    const myArray = resampled.getChannelData(0);
                    const samples = parseInt(((end - start) * sampleRate).toFixed(0));

                    const increment = samples < chunkLength ? samples : chunkLength;
                    feedChunksToModel(myArray, increment, chunkStart, file, end, resetResults);
                    chunkStart += 3 * BATCH_SIZE * sampleRate;
                    // Now the async stuff is done ==>
                    readStream.resume();
                }).catch((err) => {
                console.error(`PredictBuffer rendering failed: ${err}`);
                // Note: The promise should reject when startRendering is called a second time on an OfflineAudioContext
            });
        } else {
            console.log('Short chunk', chunk.length, 'skipping')
            readStream.resume();
        }
    })
    readStream.on('end', function () {
        readStream.close()
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
                                    file = '',
                                    start = 0,
                                    end = metadata[file].duration
                                }) => {
    if (end - start < 0.1) return  // prevents dataset creation barfing with  v. short buffers
    const proxy = await getWorkingFile(file);
    if (!proxy) return false
    return new Promise(async (resolve, reject) => {
        // Ensure max and min are within range
        //start = Math.max(0, start);
        // Handle no end supplied
        //end = Math.min(metadata[file].duration, end);

        const byteStart = convertTimeToBytes(start, metadata[file]);
        const byteEnd = convertTimeToBytes(end, metadata[file]);

        if (byteEnd < byteStart) {
            console.log(`!!!!!!!!!!!!! End < start encountered for ${file}, end was ${end} start is ${start}`)
        }
        // Match highWaterMark to batch size... so we efficiently read bytes to feed to model - 3 for 3 second chunks
        const highWaterMark = byteEnd - byteStart + 1;

        const readStream = fs.createReadStream(proxy, {
            start: byteStart,
            end: byteEnd,
            highWaterMark: highWaterMark
        });
        readStream.on('data', async chunk => {
            // Ensure data is processed in order
            readStream.pause();
            const offlineCtx = await setupCtx(chunk, metadata[file].header);

            offlineCtx.startRendering().then(resampled => {
                // `resampled` contains an AudioBuffer resampled at 24000Hz.
                // use resampled.getChannelData(x) to get an Float32Array for channel x.
                //readStream.close();
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

function sendMessageToWorker(chunkStart, chunks, file, duration, resetResults) {
    const objData = {
        message: 'predict',
        chunkStart: chunkStart,
        numberOfChunks: chunks.length,
        fileStart: metadata[file].fileStart,
        file: file,
        duration: duration,
        resetResults: resetResults
    }
    let chunkBuffers = [];
    for (let i = 0; i < chunks.length; i++) {
        objData['chunk' + i] = chunks[i];
        chunkBuffers.push(objData['chunk' + i].buffer)
    }
    predictWorker.postMessage(objData, chunkBuffers);
}

async function doPrediction({
                                file = '',
                                start = 0,
                                end = metadata[file].duration,
                                resetResults = false
                            }) {
    predictionDone = false;
    predictionStart = new Date();
    if (resetResults) {
        index = 0;
        AUDACITY = [];
        RESULTS = [];
    }
    predicting = true;
    await getPredictBuffers({file: file, start: start, end: end, resetResults: resetResults});
    UI.postMessage({event: 'update-audio-duration', value: metadata[file].duration});
}

function feedChunksToModel(channelData, increment, chunkStart, file, duration, resetResults) {
    let chunks = [];
    for (let i = 0; i < channelData.length; i += increment) {
        let chunk = channelData.slice(i, i + increment);
        // Batch predictions
        predictionsRequested++;
        chunks.push(chunk);
        if (chunks.length === BATCH_SIZE) {
            sendMessageToWorker(chunkStart, chunks, file, duration, resetResults);
            chunks = [];
            //chunkStart += 3 * BATCH_SIZE * sampleRate;
        }
    }
    //clear up remainder less than BATCH_SIZE
    if (chunks.length) sendMessageToWorker(chunkStart, chunks, file, duration, resetResults);
}


async function downloadMp3(buffer, filePath, metadata) {
    const MP3Blob = await analyzeAudioBuffer(buffer, metadata);
    const anchor = document.createElement('a');
    document.body.appendChild(anchor);
    anchor.style = 'display: none';
    const url = window.URL.createObjectURL(MP3Blob);
    anchor.href = url;
    anchor.download = filePath;
    anchor.click();
    window.URL.revokeObjectURL(url);
}

const speciesMatch = (path, sname) => {
    const pathElements = path.split(p.sep);
    const species = pathElements[pathElements.length - 2];
    sname = sname.replaceAll(' ', '_');
    return species.includes(sname)
}

const saveResults2DataSet = (results, rootDirectory) => {
    if (!rootDirectory) rootDirectory = '/home/matt/PycharmProjects/Data/Additions_png';
    let promise = Promise.resolve();
    let count = 0;
    const t0 = Date.now();
    let ambient, threshold, value;
    results.forEach(result => {
        // Check for level of ambient noise activation

        if (!adding_chirpity_additions) {
            ambient, threshold, value = 0.25;
            ambient = (result.sname2 === 'Ambient Noise' ? result.score2 : result.sname3 === 'Ambient Noise' ? result.score3 : false)
            console.log('Ambient', ambient)
            // If we have a high level of ambient noise activation, insist on a high threshold for species detection
            if (ambient && ambient > 0.2) {
                value = 0.7
            }
            // Check whether top predicted species matches folder (i.e. the searched for species)
            // species not matching the top prediction sets threshold to 2, effectively doing nothing with results
            // that don't match the searched for species
            threshold = speciesMatch(result.file, result.sname) ? value : 2.0;
        } else {
            threshold = 0;
        }
        promise = promise.then(async function (resolve) {
            if (result.score >= threshold) {
                const AudioBuffer = await fetchAudioBuffer({
                    start: result.start,
                    end: result.end,
                    file: result.file
                })
                if (AudioBuffer) {  // condition to prevent barfing when audio snippet is v short i.e. fetchAudioBUffer false when < 0.1s
                    // REALLY NEED to figure out why 0.4 seconds silence at start of exported mp3s leading to 3s clips being 3.024s long
                    const buffer = AudioBuffer.getChannelData(0);
                    const [_, folder] = p.dirname(result.file).match(/^.*\/(.*)$/)
                    // filename format: <source file>_<confidence>_<start>.png
                    const file = `${p.basename(result.file).replace(p.extname(result.file), '')}_${result['score'].toFixed(2)}_${result.start}-${result.end}.png`;
                    const filepath = p.join(rootDirectory, folder)
                    predictWorker.postMessage({
                        message: 'get-spectrogram',
                        filepath: filepath,
                        file: file,
                        buffer: buffer
                    })
                    count++;
                }
            }
            return new Promise(function (resolve) {
                setTimeout(resolve, 5);
            });
        })
    })
    promise.then(() => {
        console.log(`Dataset created. ${count} files saved in ${(Date.now() - t0) / 1000} seconds`);
    })
}

const onSpectrogram = async (filepath, file, width, height, data, channels) => {
    await mkdir(filepath, {recursive: true});
    let image = await png.encode({width: width, height: height, data: data, channels: channels})
    const file_to_save = p.join(filepath, file);
    await writeFile(file_to_save, image);
    console.log('saved:', file_to_save);
};

async function uploadOpus({file, start, defaultName, metadata, mode}) {
    const Blob = await bufferToAudio(file, start, metadata);
// Populate a form with the file (blob) and filename
    const formData = new FormData();
    //const timestamp = Date.now()
    formData.append("thefile", Blob, defaultName);
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

const bufferToAudio = (file, start, metadata) => {

    const bufferStream = new stream.PassThrough();
    let optionList = [];
    for (let [k, v] of Object.entries(metadata)) {
        if (typeof v === 'string') {
            v = v.replaceAll(' ', '_');
        }
        optionList.push('-metadata');
        optionList.push(`${k}=${v}`);
    }
    return new Promise(function (resolve) {
        const command = ffmpeg(file)
            .seekInput(start)
            .duration(3)
            .audioChannels(1)
            .audioFrequency(24000)
            .audioCodec('libopus')
            .format('opus')
            .outputOptions(optionList)
            .on('error', (err) => {
                console.log('An error occurred: ' + err.message);
            })
            .on('end', function () {
                console.log('Opus file rendered')
            })
            .writeToStream(bufferStream);

        const buffers = [];
        bufferStream.on('data', (buf) => {
            buffers.push(buf);
        })
        bufferStream.on('end', function () {
            const outputBuffer = Buffer.concat(buffers);
            let audio = [];
            audio.push(new Int8Array(outputBuffer))
            const blob = new Blob(audio, {type: 'audio/ogg'});
            resolve(blob);
        });
    })
}

async function analyzeAudioBuffer(aBuffer, metadata) {
    let numOfChan = aBuffer.numberOfChannels,
        btwLength = aBuffer.length * numOfChan * 2 + 44,
        btwArrBuff = new ArrayBuffer(btwLength),
        btwView = new DataView(btwArrBuff),
        btwChnls = [],
        btwIndex,
        btwSample,
        btwOffset = 0,
        btwPos = 0;
    setUint32(0x46464952); // "RIFF"
    setUint32(btwLength - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(aBuffer.sampleRate);
    setUint32(aBuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit
    setUint32(0x61746164); // "data" - chunk
    setUint32(btwLength - btwPos - 4); // chunk length

    for (btwIndex = 0; btwIndex < aBuffer.numberOfChannels; btwIndex++)
        btwChnls.push(aBuffer.getChannelData(btwIndex));

    while (btwPos < btwLength) {
        for (btwIndex = 0; btwIndex < numOfChan; btwIndex++) {
            // interleave btwChnls
            btwSample = Math.max(-1, Math.min(1, btwChnls[btwIndex][btwOffset])); // clamp
            btwSample = (0.5 + btwSample < 0 ? btwSample * 32768 : btwSample * 32767) | 0; // scale to 16-bit signed int
            btwView.setInt16(btwPos, btwSample, true); // write 16-bit sample
            btwPos += 2;
        }
        btwOffset++; // next source sample
    }

    let wavHdr = lamejs.WavHeader.readHeader(new DataView(btwArrBuff));

    //Stereo
    let data = new Int16Array(btwArrBuff, wavHdr.dataOffset, wavHdr.dataLen / 2);
    let leftData = [];
    let rightData = [];
    for (let i = 0; i < data.length; i += 2) {
        leftData.push(data[i]);
        rightData.push(data[i + 1]);
    }
    var left = new Int16Array(leftData);
    var right = new Int16Array(rightData);


    //STEREO
    if (wavHdr.channels === 2)
        return bufferToMp3(metadata, wavHdr.channels, wavHdr.sampleRate, left, right);
    //MONO
    else if (wavHdr.channels === 1)
        return bufferToMp3(metadata, wavHdr.channels, wavHdr.sampleRate, data);


    function setUint16(data) {
        btwView.setUint16(btwPos, data, true);
        btwPos += 2;
    }

    function setUint32(data) {
        btwView.setUint32(btwPos, data, true);
        btwPos += 4;
    }
}

function bufferToMp3(metadata, channels, sampleRate, left, right = null) {
    var buffer = [];
    var mp3enc = new lamejs.Mp3Encoder(channels, sampleRate, 192);
    var remaining = left.length;
    var samplesPerFrame = 1152;
    if (metadata) {
        //const ID3content = JSON.stringify(metadata)
        // Add metadata
        const writer = new ID3Writer(Buffer.alloc(0));
        writer.setFrame('TPE1', [metadata['cname']])  // Artist Name
            .setFrame('TIT3', metadata['sname'])
            .setFrame('TPE2', [metadata['cname2'], metadata['cname3']])  // Contributing Artists
            .setFrame('TCON', ['Nocmig']) // Genre
            .setFrame('TPUB', 'Chirpity Nocmig ' + metadata['version']) // Publisher
            .setFrame('TYER', new Date().getFullYear()) // Year
            .setFrame('TXXX', {
                description: 'ID Confidence',
                value: parseFloat(parseFloat(metadata['score']) * 100).toFixed(0) + '%'
            })
            .setFrame('TXXX', {
                description: 'Time of detection',
                value: metadata['date'] || metadata['timestamp']
            })
            .setFrame('TXXX', {
                description: 'Latitude',
                value: metadata['lat'] || '0.51'
            })
            .setFrame('TXXX', {
                description: 'Longitude',
                value: metadata['lon'] || '0.4'
            })
            .setFrame('TXXX', {
                description: '2nd',
                value: metadata['cname2'] + ' (' + parseFloat(parseFloat(metadata['score2']) * 100).toFixed(0) + '%)'
            })
            .setFrame('TXXX', {
                description: '3rd',
                value: metadata['cname3'] + ' (' + parseFloat(parseFloat(metadata['score']) * 100).toFixed(0) + '%)'
            })
            .setFrame('TXXX', {
                description: 'UUID',
                value: metadata['UUID'] || '001',
            });
        writer.addTag();
        buffer.push(writer.arrayBuffer)
    }
    for (let i = 0; remaining >= samplesPerFrame; i += samplesPerFrame) {
        let mp3buf
        if (!right) {
            var mono = left.subarray(i, i + samplesPerFrame);
            mp3buf = mp3enc.encodeBuffer(mono);
        } else {
            var leftChunk = left.subarray(i, i + samplesPerFrame);
            var rightChunk = right.subarray(i, i + samplesPerFrame);
            mp3buf = mp3enc.encodeBuffer(leftChunk, rightChunk);
        }
        if (mp3buf.length > 0) {
            buffer.push(mp3buf);//new Int8Array(mp3buf));
        }
        remaining -= samplesPerFrame;
    }
    var d = mp3enc.flush();
    if (d.length > 0) {
        buffer.push(new Int8Array(d));
    }
    return new Blob(buffer, {type: 'audio/mpeg'});

}

async function saveMP3(file, start, end, filename, metadata) {
    const buffer = await fetchAudioBuffer({file: file, start: start, end: end})
    downloadMp3(buffer, filename, metadata)
}

/// Workers  From the MDN example
function spawnWorker(model, list, batchSize, warmup) {
    console.log(`spawning worker with ${list}, ${batchSize}, ${warmup}`)
    predictWorker = new Worker('./js/model.js');
    //const modelPath = model === 'efficientnet' ? '../24000_B3/' : '../24000_v9/';
    const modelPath = model === 'efficientnet' ? '../test_big/' : '../24000_v9/';
    console.log(modelPath);
    // Now we've loaded a new model, clear the aborted flag
    aborted = false;
    predictWorker.postMessage(['load', modelPath, list, batchSize, warmup])
    predictWorker.onmessage = (e) => {
        parseMessage(e)
    }
}

const parsePredictions = (response) => {
    let file, batchInProgress = false;
    response['result'].forEach(prediction => {
        predictionsReceived++;
        const position = parseFloat(prediction[0]);
        const result = prediction[1];
        file = result.file
        const audacity = prediction[2];
        UI.postMessage({event: 'progress', progress: (position / metadata[file].duration)});
        //console.log('Prediction received from worker', result);
        if (result.score > minConfidence) {
            index++;
            UI.postMessage({
                event: 'prediction-ongoing',
                file: file,
                result: result,
                index: index,
                resetResults: response['resetResults'],
            });
            AUDACITY.push(audacity);
            RESULTS.push(result);
        }
        // 3.5 seconds subtracted because position is the beginning of a 3-second chunk and
        // the min fragment length is 0.5 seconds
        if (position.toFixed(0) >= (response.endpoint.toFixed(0) - 3.5)) {
            console.log(`Prediction done ${FILE_QUEUE.length} files to go`);
            console.log('Analysis took ' + (new Date() - predictionStart) / 1000 + ' seconds.');
            if (RESULTS.length === 0) {
                const result = "No predictions.";
                UI.postMessage({
                    event: 'prediction-ongoing',
                    file: file,
                    result: result,
                    index: 1,
                    resetResults: response['resetResults']
                });
            }
            UI.postMessage({event: 'progress', progress: 1.0});
            batchInProgress = FILE_QUEUE.length ? true : predictionsRequested - predictionsReceived;
            predictionDone = true;
        }
    })
    return [file, batchInProgress]
}

async function parseMessage(e) {
    const response = e.data;
    if (response['message'] === 'model-ready') {
        const chunkLength = response['chunkLength'];
        sampleRate = response['sampleRate'];
        const backend = response['backend'];
        console.log(backend);
        UI.postMessage({event: 'model-ready', message: 'ready', backend: backend, labels: labels})
    } else if (response['message'] === 'labels') {
        labels = response['labels'];
        // Now we have what we need to populate a database...
        const t0 = Date.now();
        // Create in-memory database
        loadDB();
        // Load the archive one too
        loadDB(appPath);
        console.log(`Databases loaded in ${(Date.now() - t0)} milliseconds.`);
    } else if (response['message'] === 'prediction' && !aborted) {
        // add filename to result for db purposes
        let [file, batchInProgress] = parsePredictions(response);
        if (predictionDone) {
            process.stdout.write(`FILE QUEUE: ${FILE_QUEUE.length}, Prediction requests ${predictionsRequested}, predictions received ${predictionsReceived}    \r`)
            if (predictionsReceived === predictionsRequested) {
                UI.postMessage({
                    event: 'prediction-done',
                    file: file,
                    audacityLabels: AUDACITY,
                    batchInProgress: batchInProgress
                })
            }
            processNextFile();
        }
    } else if (response['message'] === 'spectrogram') {
        await onSpectrogram(response['filepath'],
            response['file'],
            response['width'],
            response['height'],
            response['image'],
            response['channels'])
    }
}

// Optional Arguments
async function processNextFile({
                                   confidence = 0.5,
                                   start = undefined,
                                   end = undefined,
                                   resetResults = false,
                                   lat = 51,
                                   lon = -0.4,
                                   nocmig = NOCMIG
                               } = {}) {
    if (FILE_QUEUE.length) {
        let file = FILE_QUEUE.shift()
        const found = await getWorkingFile(file);
        if (found) {
            if (!start) [start, end] = await setStartEnd(file);
            if (start === 0 && end === 0) {
                // Nothing to do for this file
                const result = "No predictions.";
                if (!FILE_QUEUE.length) {
                    UI.postMessage({
                        event: 'prediction-ongoing',
                        file: file,
                        result: result,
                        index: -1,
                        resetResults: false,
                    });
                }
                UI.postMessage({
                    event: 'prediction-done',
                    file: file,
                    audacityLabels: AUDACITY,
                    batchInProgress: FILE_QUEUE.length
                });
                await processNextFile(arguments[0]);
            } else {
                await doPrediction({
                    start: start,
                    end: end,
                    file: file,
                    resetResults: resetResults,
                });
            }
        } else {
            await processNextFile(arguments[0]);
        }
    } else {
        predicting = false;
        await onSave2DB(memoryDB);
    }
}

async function setStartEnd(file) {
    const meta = metadata[file];
    let start, end;
    if (NOCMIG) {
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
        meta.fileStart < meta.dawn && fileEnd >= meta.dawn ?
            end = (meta.dawn - meta.fileStart) / 1000 :
            end = meta.duration;
    } else {
        start = 0;
        end = meta.duration;
    }
    return [start, end];
}

let t1, t0;

const getCachedResults = ({
                              db = undefined,
                              range = undefined,
                              files = [],
                              species = undefined,
                          }) => {
    let where = '';
    const dateRange = range;
    //if (args.file) where = ` WHERE files.name =  '${args.file.replace("'", "''")}'`;
    if (files.length) {
        where = 'WHERE files.name IN  (';
        // Format the file list
        files.forEach(file => {
            file = file.replaceAll("'", "''");
            where += `'${file}',`
        })
        // remove last comma
        where = where.slice(0, -1);
        where += ')';
    }
    if (species) where += `${files.length ? ' AND ' : ' WHERE '} s1.cname =  '${species.replace("'", "''")}'`;
    const when = dateRange && dateRange.start ? `AND datetime BETWEEN ${dateRange.start} AND ${dateRange.end}` : '';
    return new Promise(function (resolve, reject) {
        db.all(`SELECT dateTime AS timestamp, position AS position, 
            s1.cname as cname, s2.cname as cname2, s3.cname as cname3, 
            birdid1 as id_1, birdid2 as id_2, birdid3 as id_3, 
            position as
                start, position + 3 as
                end,  
                conf1 as score, conf2 as score2, conf3 as score3, 
                s1.sname as sname, s2.sname as sname2, s3.sname as sname3,
                files.duration, 
                files.name as file,
                comment,
                    label
                FROM records 
                LEFT JOIN species s1 on s1.id = birdid1 
                LEFT JOIN species s2 on s2.id = birdid2 
                LEFT JOIN species s3 on s3.id = birdid3 
                INNER JOIN files on files.rowid = records.fileid
                ${where}
                ${when}`,
            (err, rows) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(rows)
                }
            })
    })
}

const isDuplicate = async (file) => {
    const baseName = file.replace(/^(.*)\..*$/g, '$1').replace("'", "''");
    return new Promise(async (resolve) => {
        diskDB.get(`SELECT *
                    FROM files
                    WHERE name LIKE '${baseName}%'`, (err, row) => {
            if (row) {
                metadata[row.name] = {fileStart: row.filestart, duration: row.duration}
                resolve(row.name)
            } else resolve(false)
        })
    })
}

function getKeyByValue(object, value) {
    return Object.keys(object).find(key => object[key] === value);
}

const getFileInfo = async (file) => {
    // look for file in the disk DB, ignore extension
    const baseName = file.replace(/^(.*)\..*$/g, '$1').replace("'", "''");
    return new Promise(function (resolve, reject) {
        diskDB.get(`SELECT *
                    FROM files
                    WHERE name LIKE '${baseName}%'`, (err, row) => {
            if (err) console.log('There was an error ', err)
            else {
                resolve(row)
            }
        })
    })
}

const updateFileTables = async (db, file) => {
    if (!metadata[file] || !metadata[file].isComplete) await getWorkingFile(file);
    return new Promise(function (resolve) {
        const newFileStmt = db.prepare("INSERT INTO files VALUES (?,?,?)");
        const selectStmt = db.prepare('SELECT rowid FROM files WHERE name = (?)');
        const durationStmt = db.prepare("INSERT OR REPLACE INTO duration VALUES (?,?,?)");
        newFileStmt.run(file, metadata[file].duration, metadata[file].fileStart, (err, row) => {
            for (const [date, duration] of Object.entries(metadata[file].dateDuration)) {
                selectStmt.get(file, (err, row) => {
                    const fileid = row.rowid;
                    console.log('file table updated')
                    resolve(fileid);
                    durationStmt.run(date, Math.round(duration).toFixed(0), fileid);
                })
            }
        })
    })
}

const getFileIDs = (db) => {
    return new Promise(function (resolve, reject) {
        db.all('SELECT rowid, name FROM files',
            (err, rows) => {
                if (err) {
                    reject(err)
                } else {
                    let filemap = {};
                    rows.forEach(row => {
                        filemap[row.name] = row.rowid
                    })
                    resolve(filemap)
                }
            })
    })
}

const onSave2DB = async (db) => {
    t0 = performance.now();
    if (RESULTS.length) {
        let filemap = await getFileIDs(db)
        db.run('BEGIN TRANSACTION');
        const stmt = db.prepare("INSERT OR REPLACE INTO records VALUES (?,?,?,?,?,?,?,?,?,?,?)");
        for (let i = 0; i < RESULTS.length; i++) {
            const dateTime = new Date(RESULTS[i].timestamp).getTime();
            const birdID1 = RESULTS[i].id_1;
            const birdID2 = RESULTS[i].id_2;
            const birdID3 = RESULTS[i].id_3;
            const conf1 = RESULTS[i].score;
            const conf2 = RESULTS[i].score2;
            const conf3 = RESULTS[i].score3;
            const position = RESULTS[i].position;
            const file = RESULTS[i].file;
            const comment = RESULTS[i].comment;
            const label = RESULTS[i].label;
            if (!filemap[file]) filemap[file] = await updateFileTables(db, file);
            stmt.run(dateTime, birdID1, birdID2, birdID3, conf1, conf2, conf3, filemap[file], position, comment, label,
                (err, row) => {
                    UI.postMessage({event: 'progress', text: "Updating Database.", progress: i / RESULTS.length});
                    if (i === (RESULTS.length - 1)) {
                        db.run('COMMIT', (err, rows) => {
                            UI.postMessage({
                                event: 'generate-alert',
                                message: `${db.filename.replace(/.*\//, '')} database update complete, ${i + 1} records updated in ${((performance.now() - t0) / 1000).toFixed(3)} seconds`
                            })
                            UI.postMessage({event: 'progress', progress: 1.0});
                        });
                    }
                });
        }
    } else {
        console.log('No results to save')
    }
}

const getSeasonRecords = async (species, season) => {
    const seasonMonth = {spring: "< '07'", autumn: " > '06'"}
    return new Promise(function (resolve, reject) {
        const stmt = diskDB.prepare(`
            SELECT MAX(SUBSTR(DATE(records.dateTime/1000, 'unixepoch', 'localtime'), 6)) AS maxDate,
                   MIN(SUBSTR(DATE(records.dateTime/1000, 'unixepoch', 'localtime'), 6)) AS minDate
            FROM records
                     INNER JOIN species ON species.id = records.birdID1
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
}

const getMostCalls = (species) => {
    return new Promise(function (resolve, reject) {
        diskDB.get(`
            SELECT count(*) as count, 
            DATE(dateTime/1000, 'unixepoch', 'localtime') as date
            FROM records INNER JOIN species
            on species.id = records.birdID1
            WHERE species.cname = '${species}'
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
                            species = undefined,
                            range = {}
                        }) => {
    const dateRange = range;
    // Work out sensible aggregations from hours difference in daterange
    const hours_diff = dateRange.start ?
        Math.round((dateRange.end - dateRange.start) / (1000 * 60 * 60)) : 745;
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
                        INNER JOIN species
                    on species.id = birdid1
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


        diskDB.all(`select STRFTIME('%W', DATE(dateTime / 1000, 'unixepoch', 'localtime')) as week, count(*) as calls
                    from records
                             INNER JOIN species ON species.id = records.birdid1
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

const getSpecies = (db) => {
    db.all('SELECT DISTINCT cname, sname FROM records INNER JOIN species ON birdid1 = id ORDER BY cname',
        (err, rows) => {
            if (err) console.log(err);
            else {
                UI.postMessage({event: 'seen-species-list', list: rows})
            }
        })
}

const getFileStart = (db, file) => {
    return new Promise(function (resolve, reject) {
        db.get(`SELECT filestart
                FROM files
                WHERE name = '${file}'`, async (err, row) => {
            if (err) {
                reject(err)
            } else {
                if (row['filestart'] === null) {
                    // This should only be needed while we catch up with the new files schema
                    await getMetadata(file);
                    db.get(`UPDATE files
                            SET filestart = '${metadata[file].fileStart}'
                            WHERE name = '${file}'`,
                        (err, row) => {
                            if (err) {
                                console.log(err)
                            } else {
                                console.log(row)
                                row = metadata[file].fileStart;
                                resolve(row)
                            }
                        })

                } else {
                    resolve(row)
                }
            }
        })
    })
}

const onUpdateFileStart = async (args) => {
    let file = args.file;
    const newfileMtime = args.start + (metadata[file].duration * 1000);
    utimes(file, Math.round(newfileMtime));
    // update the metadata
    metadata[file].isComplete = false;
    //allow for this file to be compressed...
    await getWorkingFile(file);
    file = file.replace("'", "''");

    return new Promise(function (resolve, reject) {
        db.get(`SELECT rowid, filestart
                from files
                where name = '${file}'`, (err, row) => {
            if (err) {
                console.log(err)
            } else {
                if (row) {
                    let rowID = row.rowid;
                    db.get(`UPDATE files
                            SET filestart = '${args.start}'
                            where rowid = '${rowID}'`, (err, rows) => {
                        if (err) {
                            console.log(err)
                        } else {
                            let t0 = Date.now();
                            db.get(`UPDATE records
                                    set dateTime = position + ${args.start}
                                    where fileid = ${rowID}`, (err, rowz) => {
                                if (err) {
                                    console.log(err)
                                } else {
                                    console.log(`Updating record times took ${Date.now() - t0} seconds`);
                                    resolve(rowz)
                                }
                            })
                        }
                    })
                }
            }
        })
    })
}

async function onUpdateRecord({
                                  files = [],
                                  start = 0,
                                  value = '',
                                  db = diskDB,
                                  isBatch = false,
                                  from = '',
                                  what = 'birdID1',
                                  isReset = false,
                                  isFiltered = false,
                                  isExplore = false
                              }) {


    // Sanitize input: start is passed to the function in float seconds,
    // but we need a millisecond integer
    const startMilliseconds = (start * 1000).toFixed(0);

    // Construct the SQL
    if (what === 'ID' || what === 'birdID1') {
        // Map the field name to the one in the database
        what = 'birdID1';
        whatSQL = `birdID1 = (SELECT id FROM species WHERE cname = '${value}')`;
    } else if (what === 'label') {
        whatSQL = `label = '${value}'`;
    } else {
        whatSQL = `comment = '${value}'`;
    }

    if (isBatch) {
        //Batch update
        whereSQL = `WHERE birdID1 = (SELECT id FROM species WHERE cname = '${from}') `;
        if (files) {
            whereSQL += 'AND fileID IN (SELECT rowid from files WHERE name in (';
            // Format the file list
            files.forEach(file => {
                file = file.replaceAll("'", "''");
                whereSQL += `'${file}',`
            })
            // remove last comma
            whereSQL = whereSQL.slice(0, -1);
            whereSQL += '))';
        }
    } else {
        // Single record
        whereSQL = `WHERE datetime = (SELECT filestart FROM files WHERE name = '${files[0]}') + ${startMilliseconds}`
    }
    const t0 = Date.now();
    return new Promise((resolve, reject) => {
        db.run(`UPDATE records
                SET ${whatSQL} ${whereSQL}`, async function (err, row) {
            if (err) {
                reject(err)
            } else {
                if (this.changes) {
                    console.log(`Updated ${this.changes} records for ${what} in ${db.filename.replace(/.*\//, '')} database, setting them to ${value}`);
                    console.log(`Update without transaction took ${Date.now() - t0} milliseconds`);
                    const species = isFiltered || isExplore ? from : '';
                    if (isExplore) files = [];
                    sendResults2UI({db: db, filelist: files, species: species, saveSummary: isFiltered});
                    resolve(this.changes)
                } else {
                    console.log(`No records updated in ${db.filename.replace(/.*\//, '')}`)
                    // Not in diskDB, so update memoryDB
                    if (db === diskDB) {
                        await onUpdateRecord(
                            //because no access to this in arrow function, and regular function replaces arguments[0]
                            {
                                files: files,
                                start: start,
                                value: value,
                                db: memoryDB,
                                isBatch: isBatch,
                                from: from,
                                what: what,
                                isReset: isReset,
                                isFiltered: isFiltered
                            });
                        UI.postMessage({
                            event: 'generate-alert',
                            message: 'Remember to save your records to store this change'
                        })
                    }
                }
            }
        })
    })
}

async function onChartRequest(args) {
    console.log(`Getting chart for ${args.species} starting ${args.range[0]}`);
    // Escape apostrophes
    if (args.species) args.species = args.species.replace("'", "''");
    const dateRange = args.range;
    const dataRecords = {}, results = {};
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
            row ? dataRecords.mostDetections = [row.count, row.date] :
                dataRecords.mostDetections = ['N/A', 'Not detected'];
        }).catch((message) => {
            console.log(message)
        })

    console.log(`Most calls  chart generation took ${(Date.now() - t0) / 1000} seconds`)
    t0 = Date.now();
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
        event: 'chart-data',
        // Restore species name
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
