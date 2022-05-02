const {ipcRenderer} = require('electron');
//const AudioBufferSlice = require('./js/AudioBufferSlice.js');
let appPath = '../24000_v9/';
const fs = require('fs');
const wavefileReader = require('wavefile-reader');
const lamejs = require("lamejstmp");
const ID3Writer = require('browser-id3-writer');
let BATCH_SIZE = 12;
console.log(appPath);


let metadata = {};
let fileStart, chunkStart, chunkLength, minConfidence, index = 0, AUDACITY = [], RESULTS = [], predictionStart;
let sampleRate = 24000;  // Value obtained from model.js CONFIG, however, need default here to permit file loading before model.js response
let predictWorker, predicting = false, predictionDone = false, aborted = false;
let useWhitelist = true;
// We might get multiple clients, for instance if there are multiple windows,
// or if the main window reloads.
let UI;
let FILE_QUEUE = [];
ipcRenderer.on('new-client', (event) => {
    [UI] = event.ports;
    UI.onmessage = async (e) => {
        const args = e.data;
        const action = args.action;
        console.log('message received ', action)
        switch (action) {
            case 'load-model':
                UI.postMessage({event: 'spawning'});
                BATCH_SIZE = args.batchSize;
                if (predictWorker) predictWorker.terminate();
                spawnWorker(args.useWhitelist, BATCH_SIZE);
                break;
            case 'file-load-request':
                index = 0;
                if (predicting) onAbort(args);
                console.log('Worker received audio ' + args.filePath);
                await loadAudioFile(args);

                break;
            case 'update-buffer':
                const buffer = await fetchAudioBuffer(args);
                const length = buffer.length;
                const myArray = buffer.getChannelData(0);
                UI.postMessage({
                    event: 'worker-loaded-audio',
                    fileStart: fileStart,
                    sourceDuration: metadata[args.file].duration,
                    sourceOffset: 0,
                    file: args.file,
                    position: args.position,
                    length: length,
                    contents: myArray,
                    region: args.region
                })

                break;
            case 'analyze':
                console.log(`Worker received message: ${args.confidence}, start: ${args.start}, end: ${args.end},  fstart ${fileStart}`);
                if (predicting) {
                    FILE_QUEUE.push(args.filePath);
                    console.log(`Adding ${args.filePath} to the queue.`)
                } else {
                    predicting = true;
                    minConfidence = args.confidence;
                    selection = false;
                    let start, end;
                    if (args.start === undefined) {
                        start = null;
                        end = Infinity;
                    } else {
                        start = args.start;
                        end = args.end;
                        selection = true;
                    }
                    //await loadAudioFile(args);
                    await doPrediction({start: start, end: end, file: args.filePath, selection: selection});
                }
                break;
            case 'save':
                console.log("file save requested")
                await saveMP3(args.file, args.start, args.end, args.filename, args.metadata);
                break;
            case 'post':
                await postMP3(args)
                break;
            case 'abort':
                onAbort(args);
                break;
            default:
                UI.postMessage('Worker communication lines open')
        }
    }
})

function onAbort(args) {
    aborted = true;
    FILE_QUEUE = [];
    index = 0;
    console.log("abort received")
    if (predicting) {
        //restart the worker
        UI.postMessage({event: 'spawning'});
        predictWorker.terminate()
        spawnWorker(useWhitelist, BATCH_SIZE)
        predicting = false;
    }
    if (args.sendLabels) {
        UI.postMessage({event: 'prediction-done', labels: AUDACITY, batchInProgress: false});
    }
}

const getDuration = (src) => {
    return new Promise(function (resolve) {
        const audio = new Audio();
        audio.addEventListener("loadedmetadata", function () {
            resolve(audio.duration);
        });
        audio.src = src;
    });
}

//
// function toArrayBuffer(buf) {
//     const ab = new ArrayBuffer(buf.length);
//     const view = new Uint8Array(ab);
//     for (let i = 0; i < buf.length; ++i) {
//         view[i] = buf[i];
//     }
//     return ab;
// }

const audioCtx = new AudioContext({latencyHint: 'interactive', sampleRate: sampleRate});

async function loadAudioFile(args) {
    const file = args.filePath;
    if (!metadata[file]) {
        metadata[file] = await getMetadata(file)
    }
    const buffer = await fetchAudioBuffer({file: file, start: 0, end: 20, position: 0})
    const length = buffer.length;
    const myArray = buffer.getChannelData(0);
    UI.postMessage({
        event: 'worker-loaded-audio',
        fileStart: fileStart,
        sourceDuration: metadata[file].duration,
        sourceOffset: 0,
        file: file,
        position: 0,
        length: length,
        contents: myArray,
    })
}


const getMetadata = async (file) => {
    metadata[file] = {};
    metadata[file].duration = await getDuration(file);
    return new Promise((resolve) => {
        const readStream = fs.createReadStream(file);
        fs.stat(file, (error, stats) => {
            if (error) console.log("Stat error: ", error)
            else {
                metadata[file].stat = stats;
                fileStart = new Date(metadata[file].stat.mtime - (metadata[file].duration * 1000));
            }
        });
        readStream.on('data', async chunk => {
            let wav = new wavefileReader.WaveFileReader();
            wav.fromBuffer(chunk);
            // Extract Header
            let headerEnd;
            wav.signature.subChunks.forEach(el => {
                if (el['chunkId'] === 'data') {
                    headerEnd = el.chunkData.start;
                }
            })
            // Update relevant file properties
            metadata[file].head = headerEnd;
            metadata[file].header = chunk.slice(0, headerEnd);
            metadata[file].bytesPerSec = wav.fmt.byteRate;
            metadata[file].numChannels = wav.fmt.numChannels;
            metadata[file].sampleRate = wav.fmt.sampleRate;
            metadata[file].bitsPerSample = wav.fmt.bitsPerSample
            metadata[file].fileStart = fileStart;
            readStream.close()
            resolve(metadata[file]);
        })
    })
}

async function getPredictBuffers(args) {
    let start = args.start, end = args.end, selection = args.selection
    const file = args.file
    // Ensure max and min are within range
    start = Math.max(0, start);
    // Handle no end supplied
    end = Math.min(metadata[file].duration, end);
    let bytesPerSample = metadata[file].bitsPerSample / 8;
    // Ensure we have a range with valid samples 16bit = 2 bytes, 24bit = 3 bytes
    let byteStart = Math.round(start / bytesPerSample) * bytesPerSample * metadata[file].bytesPerSec;
    let byteEnd = Math.round(end / bytesPerSample) * bytesPerSample * metadata[file].bytesPerSec;
    //clear the header
    byteStart += metadata[file].head;
    byteEnd += metadata[file].head;
    // Match highWaterMark to batch size... so we efficiently read bytes to feed to model - 3 for 3 second chunks
    const highWaterMark = metadata[file].bytesPerSec * BATCH_SIZE * 3;
    const readStream = fs.createReadStream(file, {
        start: byteStart,
        end: byteEnd,
        highWaterMark: highWaterMark
    });
    chunkStart = start * sampleRate;
    const fileDuration = end - start;
    await readStream.on('data', async chunk => {
        // Ensure data is processed in order
        readStream.pause();
        chunk = Buffer.concat([metadata[file].header, chunk]);
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
        offlineCtx.startRendering().then(resampled => {
            const myArray = resampled.getChannelData(0);
            const samples = (end - start) * sampleRate;
            const increment = samples < chunkLength ? samples : chunkLength;
            feedChunksToModel(myArray, increment, chunkStart, file, fileDuration, selection);
            chunkStart += 3 * BATCH_SIZE * sampleRate;
            // Now the async stuff is done ==>
            readStream.resume();
        })
    })
    readStream.on('end', function () {
        readStream.close()
    })
}


const fetchAudioBuffer = (args) => {
    return new Promise((resolve) => {
        let start = args.start, end = args.end, file = args.file
        // Ensure max and min are within range
        start = Math.max(0, start);
        // Handle no end supplied
        end = Math.min(metadata[file].duration, end);
        let bytesPerSample = metadata[file].bitsPerSample / 8;
        // Ensure we have a range with valid samples 16bit = 2 bytes, 24bit = 3 bytes
        let byteStart = Math.round(start * bytesPerSample) / bytesPerSample * metadata[file].bytesPerSec;
        let byteEnd = Math.round(end * bytesPerSample) / bytesPerSample * metadata[file].bytesPerSec;
        //clear the header
        byteStart += metadata[file].head;
        byteEnd += metadata[file].head;
        //if (isNaN(byteEnd)) byteEnd = Infinity;
        // Match highWaterMark to batch size... so we efficiently read bytes to feed to model - 3 for 3 second chunks
        const highWaterMark = byteEnd - byteStart + 1;
        const readStream = fs.createReadStream(file, {
            start: byteStart,
            end: byteEnd,
            highWaterMark: highWaterMark
        });
        readStream.on('data', async chunk => {
            // Ensure data is processed in order
            readStream.pause();
            chunk = Buffer.concat([metadata[file].header, chunk]);
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
            offlineCtx.startRendering().then(resampled => {
                // `resampled` contains an AudioBuffer resampled at 24000Hz.
                // use resampled.getChannelData(x) to get an Float32Array for channel x.
                //readStream.close();
                readStream.resume();
                resolve(resampled);
            })
        })
        readStream.on('end', function () {
            readStream.close()
        })
    });
}

async function sendMessageToWorker(chunkStart, chunks, file, duration, selection) {
    const objData = {
        message: 'predict',
        chunkStart: chunkStart,
        numberOfChunks: chunks.length,
        fileStart: fileStart,
        file: file,
        duration: duration,
        selection: selection
    }
    let chunkBuffers = [];
    for (let i = 0; i < chunks.length; i++) {
        objData['chunk' + i] = chunks[i];
        chunkBuffers.push(objData['chunk' + i].buffer)
    }
    predictWorker.postMessage(objData, chunkBuffers);
}

async function doPrediction(args) {
    const start = args.start, end = args.end, file = args.file, selection = args.selection;
    aborted = false;
    predictionDone = false;
    predictionStart = new Date();
    if (!predicting) {
        index = 0;
        AUDACITY = [];
        RESULTS = [];
    }
    predicting = true;
    await getPredictBuffers({file: file, start: start, end: end, selection: selection});
    UI.postMessage({event: 'update-audio-duration', value: metadata[file].duration});
}

async function feedChunksToModel(channelData, increment, chunkStart, file, duration, selection) {
    let chunks = [];
    for (let i = 0; i < channelData.length; i += increment) {
        let chunk = channelData.slice(i, i + increment);
        // Batch predictions
        chunks.push(chunk);
        if (chunks.length === BATCH_SIZE) {
            await sendMessageToWorker(chunkStart, chunks, file, duration, selection);
            chunks = [];
        }
    }
    //clear up remainder less than BATCH_SIZE
    if (chunks.length > 0) await sendMessageToWorker(chunkStart, chunks, file, duration, selection);
}


function downloadMp3(buffer, filePath, metadata) {
    const MP3Blob = analyzeAudioBuffer(buffer, metadata);
    const anchor = document.createElement('a');
    document.body.appendChild(anchor);
    anchor.style = 'display: none';
    const url = window.URL.createObjectURL(MP3Blob);
    anchor.href = url;
    anchor.download = filePath;
    anchor.click();
    window.URL.revokeObjectURL(url);
}

function uploadMp3(buffer, defaultName, metadata, mode) {
    const MP3Blob = analyzeAudioBuffer(buffer, metadata);
// Populate a form with the file (blob) and filename
    var formData = new FormData();
    //const timestamp = Date.now()
    formData.append("thefile", MP3Blob, defaultName);
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

function analyzeAudioBuffer(aBuffer, metadata) {
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
                value: metadata['date']
            })
            .setFrame('TXXX', {
                description: 'Latitude',
                value: metadata['lat']
            })
            .setFrame('TXXX', {
                description: 'Longitude',
                value: metadata['lon']
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
                value: metadata['UUID'],
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


async function postMP3(args) {
    const file = args.file, defaultName = args.defaultName, start = args.start , end = args.end, metadata = args.metadata, mode = args.mode;
    const buffer = await fetchAudioBuffer({file: file, start: start, end: end});
    uploadMp3(buffer, defaultName, metadata, mode)
}


/// Workers  From the MDN example
function spawnWorker(useWhitelist, batchSize) {
    console.log('spawning worker')
    predictWorker = new Worker('./js/model.js');
    predictWorker.postMessage(['load', appPath, useWhitelist, batchSize])
    predictWorker.onmessage = (e) => {
        parsePredictions(e)
    }
}

async function parsePredictions(e) {
    const response = e.data;
    const file = response.file;
    if (response['message'] === 'model-ready') {
        chunkLength = response['chunkLength'];
        sampleRate = response['sampleRate'];
        const backend = response['backend'];
        console.log(backend);
        UI.postMessage({event: 'model-ready', message: 'ready', backend: backend})
    } else if (response['message'] === 'prediction' && !aborted) {

        //t1 = performance.now();
        //console.log(`post from worker took: ${t1 - response['time']} milliseconds`)
        //console.log(`post to receive took: ${t1 - t0} milliseconds`)
        response['result'].forEach(prediction => {
            const position = parseFloat(prediction[0]);
            const result = prediction[1];
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
                    selection: selection,
                });
                AUDACITY.push(audacity);
                RESULTS.push(result);
            }
            if (position.toFixed(0) >= (response.endpoint.toFixed(0) - 4)) {
                console.log('Prediction done');
                console.log('Analysis took ' + (new Date() - predictionStart) / 1000 + ' seconds.');
                if (RESULTS.length === 0) {
                    const result = "No detections found.";
                    UI.postMessage({
                        event: 'prediction-ongoing',
                        file: file,
                        result: result,
                        index: 1,
                        selection: selection
                    });
                }
                UI.postMessage({event: 'progress', progress: 1});
                UI.postMessage({
                    event: 'prediction-done',
                    labels: AUDACITY,
                    batchInProgress: FILE_QUEUE.length,
                    duration: metadata[file].duration
                });
                predictionDone = true;
            }
        })
    }
    if (predictionDone) {
        if (FILE_QUEUE.length) {
            const file = FILE_QUEUE.shift()
            const metadata = await getMetadata(file);
            await doPrediction({start: 0, end: metadata.duration, file: file});
        } else {
            predicting = false;
        }
    }
}