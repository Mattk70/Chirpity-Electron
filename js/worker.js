const {ipcRenderer} = require('electron');
const AudioBufferSlice = require('./js/AudioBufferSlice.js');
let appPath = '../24000_v9/';

// We might get multiple clients, for instance if there are multiple windows,
// or if the main window reloads.
let UI;
ipcRenderer.on('new-client', (event) => {
    [UI] = event.ports;
    UI.onmessage = async (e) => {
        const args = e.data;
        const action = args.action;
        console.log('message received ', action)
        switch (action) {
            case 'load-model':
                spawnWorker(args.useWhitelist)
                break;
            case 'file-load-request':
                const currentFile = args.message;
                console.log('Worker received audio ' + args.message);
                controller = new AbortController();
                signal = controller.signal;
                await loadAudioFile(currentFile);
                break;
            case 'analyze':
                console.log(`Worker received message: ${args.confidence}, start: ${args.start},  
                    end: ${args.end},  fstart: ${args.fileStart}`);
                console.log(audioBuffer.duration);

                minConfidence = args.confidence;
                const fileStart = args.fileStart;
                const bufferLength = audioBuffer.length;
                selection = false;
                let start, end;
                if (args.start === undefined) {
                    start = 0;
                    end = bufferLength;
                } else {
                    start = args.start * sampleRate;
                    end = args.end * sampleRate;
                    selection = true;

                }
                predicting = true;
                await doPrediction(start, end, fileStart)
                break;
            case 'save':
                console.log("file save requested")
                await saveMP3(args.start, args.end, args.filepath, args.metadata);
                break;
            case 'post':
                await postMP3(args.start, args.end, args.filepath, args.metadata, args.mode)
                break;
            case 'abort':
                console.log("abort received")
                if (controller) {
                    controller.abort()
                }
                if (predicting) {
                    //restart the worker
                    predictWorker.terminate()
                    spawnWorker(useWhitelist)
                }
                if (args.sendLabels) {
                    UI.postMessage({event: 'prediction-done', labels: AUDACITY});
                }
                break;
            default:
                UI.postMessage('Worker communication lines open')
        }
    }
})

const lamejs = require("lamejstmp");
const ID3Writer = require('browser-id3-writer');
const BATCH_SIZE = 12;
console.log(appPath);

let audioBuffer;
let chunkLength, minConfidence, index, end, AUDACITY, RESULTS, predictionStart;
let t0, t1;
let sampleRate = 24000;  // Value obtained from model.js CONFIG, however, need default here to permit file loading before model.js response

let predictWorker, predicting = false;
let selection = false;
let controller = new AbortController();
let signal = controller.signal;
let useWhitelist = true;

// function processAudio(){
//     console.log('Processing audio')
// }
//
// function onEncoderError(e){
//     console.log('Encoder error: ', e);
// }

// async function fetchAudioStream(filePath) {
//     let data = [];
//     const fd = await fs.promises.open(filePath);
//     const readStream = fd.createReadStream();
//     const ad = new AudioDecoder({
//         output: processAudio,
//         error: onEncoderError,
//     })
//     ad.configure({ codec: 'mp4a.40.2', sampleRate: 24000, numberOfChannels: 1 });
//
//     readStream.on('data', chunk => {
//         console.log('---------------------------------');
//         console.log(chunk);
//         data.push(chunk);
//         ad.decode(chunk)
//         console.log('---------------------------------');
//     });
//
//     readStream.on('open', () => {
//         console.log('Stream opened...');
//     });
//
//     readStream.on('end', () => {
//         console.log('Stream Closed...');
//     });
//     return data
// }



function sendMessageToWorker(chunkStart, chunks, fileStart, lastKey) {
    const objData = {
        message: 'predict',
        chunkStart: chunkStart,
        numberOfChunks: chunks.length,
        fileStart: fileStart,
        lastKey: lastKey,
    }
    let chunkBuffers = [];
    for (let i = 0; i < chunks.length; i++) {
        objData['chunk' + i] = chunks[i];
        chunkBuffers.push(objData['chunk' + i].buffer)
    }
    predictWorker.postMessage(objData, chunkBuffers);
}

async function doPrediction(start, end, fileStart) {
    AUDACITY = [];
    RESULTS = [];
    predictionStart = new Date();
    // position of the last key in seconds
    const lastKey = (end - chunkLength) / sampleRate;
    index = 0;
    let increment;
    end - start < chunkLength ? increment = end - start : increment = chunkLength;
    let channelData = audioBuffer.getChannelData(0);
    let chunks = [];
    let i;
    for (i = start; i < end; i += increment) {
        let chunk = channelData.slice(i, i + increment);
        // Batch predictions
        chunks.push(chunk);
        if (chunks.length === BATCH_SIZE) {
            const chunkStart = i - ((chunks.length - 1) * increment);
            sendMessageToWorker(chunkStart, chunks, fileStart, lastKey);
            chunks = [];
        }
    }
    //clear up remainder less than BATCH_SIZE, by *padding the batch*
    if (chunks.length > 0) {
        const chunkStart = i - ((chunks.length) * increment);
        sendMessageToWorker(chunkStart, chunks, fileStart, lastKey);
    }
}

// TODO: extract and modularise fetch Audio functions across worker and ui
const audioCtx = new AudioContext({latencyHint: 'interactive', sampleRate: sampleRate});

const loadAudioFile = (filePath) =>
    fetch(filePath, {signal})
        .then((res => res.arrayBuffer()))
        .then((arrayBuffer) => audioCtx.decodeAudioData(arrayBuffer))
        .then((buffer) => {
            if (!controller.signal.aborted) {
                let source = audioCtx.createBufferSource();
                source.buffer = buffer;
                const duration = source.buffer.duration;
                const offlineCtx = new OfflineAudioContext(1, sampleRate * duration, sampleRate);
                const offlineSource = offlineCtx.createBufferSource();
                offlineSource.buffer = buffer;
                offlineSource.connect(offlineCtx.destination);
                offlineSource.start();
                offlineCtx.startRendering().then(function (resampled) {
                    // `resampled` contains an AudioBuffer resampled at 24000Hz.
                    // use resampled.getChannelData(x) to get an Float32Array for channel x.
                    audioBuffer = resampled;
                    console.log('Rendering completed successfully');
                    UI.postMessage({event: 'worker-loaded-audio', message: filePath});
                })
            } else {
                throw new DOMException('Rendering cancelled at user request', "AbortError")
            }
        })
        .catch(function (e) {
            console.log("Error with decoding audio data " + e);
            if (e.name === "AbortError") {
                // We know it's been canceled!
                console.log('Worker fetch aborted')
            }
            else {console.log("Another error", e)}
        })

function downloadMp3(buffer, filepath, metadata) {
    const MP3Blob = analyzeAudioBuffer(buffer, metadata);
    const anchor = document.createElement('a');
    document.body.appendChild(anchor);
    anchor.style = 'display: none';
    const url = window.URL.createObjectURL(MP3Blob);
    anchor.href = url;
    anchor.download = filepath;
    anchor.click();
    window.URL.revokeObjectURL(url);
}

function uploadMp3(buffer, filepath, metadata, mode) {
    const MP3Blob = analyzeAudioBuffer(buffer, metadata);
// Populate a form with the file (blob) and filename
    var formData = new FormData();
    //const timestamp = Date.now()
    formData.append("thefile", MP3Blob, metadata.filename);
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
        const ID3content = JSON.stringify(metadata)
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

        if (!right) {
            var mono = left.subarray(i, i + samplesPerFrame);
            var mp3buf = mp3enc.encodeBuffer(mono);
        } else {
            var leftChunk = left.subarray(i, i + samplesPerFrame);
            var rightChunk = right.subarray(i, i + samplesPerFrame);
            var mp3buf = mp3enc.encodeBuffer(leftChunk, rightChunk);
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

async function saveMP3(start, end, filepath, metadata) {
    AudioBufferSlice(audioBuffer, start, end, async function (error, slicedAudioBuffer) {
        if (error) {
            console.error(error);
        } else {
            downloadMp3(slicedAudioBuffer, filepath, metadata)
        }
    })
}


async function postMP3(start, end, filepath, metadata, mode) {
    AudioBufferSlice(audioBuffer, start, end, async function (error, slicedAudioBuffer) {
        if (error) {
            console.error(error);
        } else {
            uploadMp3(slicedAudioBuffer, filepath, metadata, mode)
        }
    })
}


/// Workers  From the MDN example
function spawnWorker(useWhitelist) {
    console.log('spawning worker')
    predictWorker = new Worker('./js/model.js');
    predictWorker.postMessage(['load', appPath, useWhitelist, BATCH_SIZE])

    predictWorker.onmessage = (e) => {
        parsePredictions(e)
    }
}

function parsePredictions(e) {
    const response = e.data;
    if (response['message'] === 'model-ready') {
        chunkLength = response['chunkLength'];
        sampleRate = response['sampleRate'];
        const backend = response['backend'];
        console.log(backend);
        UI.postMessage({event: 'model-ready', message: 'ready', backend: backend})
    } else if (response['message'] === 'prediction') {
        const lastKey = response['end'];
        //t1 = performance.now();
        //console.log(`post from worker took: ${t1 - response['time']} milliseconds`)
        //console.log(`post to receive took: ${t1 - t0} milliseconds`)
        response['result'].forEach(prediction => {
            const position = parseFloat(prediction[0]);
            const result = prediction[1];
            const audacity = prediction[2];
            UI.postMessage({event: 'progress', progress: (position / lastKey)});
            //console.log('Prediction received from worker', result);
            if (result.score > minConfidence) {
                index++;
                UI.postMessage({event: 'prediction-ongoing', result: result, index: index, selection: selection});
                AUDACITY.push(audacity);
                RESULTS.push(result);
            }
            //console.log(`Position is ${position}, end is ${lastKey}`)
            if (position >= lastKey) {
                console.log('Prediction done');
                console.log('Analysis took ' + (new Date() - predictionStart) / 1000 + ' seconds.');
                if (RESULTS.length === 0) {
                    const result = "No detections found.";
                    UI.postMessage({event: 'prediction-ongoing', result: result, index: 1, selection: selection});
                }
                UI.postMessage({event: 'progress', progress: 1});
                UI.postMessage({event: 'prediction-done', labels: AUDACITY});
                predicting = false;
            }
        })
    }
}
