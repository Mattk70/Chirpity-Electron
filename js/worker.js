const {ipcRenderer} = require('electron');
const Model = require('./js/model.js');
const fs = require("fs");
const AudioBufferSlice = require('./js/AudioBufferSlice.js');
const appPath = '';
const lamejs = require("lamejstmp");
const ID3Writer = require('browser-id3-writer');
const path = require("path");
//const appPath = process.resourcesPath;

console.log(appPath);
// console.log(process.resourcesPath);

let audioBuffer;
const model = new Model(path.join(appPath, '256x384_model/'));

(async () => {
    await model.loadModel();
    await model.warmUp();
    ipcRenderer.send('model-ready', {message: 'ready'})

})();


ipcRenderer.on('file-loaded', async (event, arg) => {
    const currentFile = arg.message;
    console.log('Worker received audio ' + arg.message);
    loadAudioFile(currentFile);
    event.sender.send('worker-loaded', {message: currentFile});
});

ipcRenderer.on('analyze', async (event, arg) => {
    console.log('Worker received message: ' + arg.confidence + ' start: ' + arg.start + ' end: ' + arg.end);
    console.log(audioBuffer.length);
    const minConfidence = arg.confidence;
    const bufferLength = audioBuffer.length;
    let start;
    let end;
    let isRegion = false;
    if (arg.start === undefined) {
        start = 0;
        end = bufferLength;
    } else {
        start = arg.start * model.config.sampleRate;
        end = arg.end * model.config.sampleRate;
        isRegion = true
    }
    model.RESULTS = [];
    model.AUDACITY = [];
    const funcStart = new Date();
    let index = 0;
    let increment;
    end - start < model.chunkLength ? increment = end - start : increment = model.chunkLength;
    let channelData = audioBuffer.getChannelData(0);
    for (let i = start; i < end; i += increment) {
        // If we're at the end of a file and we haven't got a full chunk, scroll back to fit
        //if (i + model.chunkLength > end && end >= model.chunkLength) i = end - model.chunkLength;

        let chunk = channelData.slice(i, i + increment);
        let [result, audacity] = await model.predictChunk(chunk, i, isRegion)
        if (result.score > minConfidence) {
            index++;
            model.RESULTS.push(result);
            model.AUDACITY.push(audacity);
            event.sender.send('prediction-ongoing', {result, 'index': index});
        }
        event.sender.send('progress', {'progress': i / end});
    }
    if (model.RESULTS.length === 0) {
        const result = "No detections found.";
        event.sender.send('prediction-ongoing', {result, 'index': 1});
    }
    const timenow = new Date();
    console.log('Analysis took ' + (timenow - funcStart) / 1000 + ' seconds.')
    event.sender.send('progress', {'progress': 1});
    event.sender.send('prediction-done', {'labels': model.AUDACITY});
});


function loadAudioFile(filePath) {
    // create an audio context object and load file into it
    const audioCtx = new AudioContext();
    let source = audioCtx.createBufferSource();
    fs.readFile(filePath, function (err, data) {
        if (err) {
            reject(err)
        } else {
            audioCtx.decodeAudioData(data.buffer).then(function (buffer) {
                source.buffer = buffer;
                const duration = source.buffer.duration;
                const sampleRate = model.config.sampleRate;
                const offlineCtx = new OfflineAudioContext(1, sampleRate * duration, sampleRate);
                const offlineSource = offlineCtx.createBufferSource();
                offlineSource.buffer = buffer;
                offlineSource.connect(offlineCtx.destination);
                offlineSource.start();
                offlineCtx.startRendering().then(function (resampled) {
                    console.log('Rendering completed successfully');
                    // `resampled` contains an AudioBuffer resampled at 48000Hz.
                    // use resampled.getChannelData(x) to get an Float32Array for channel x.
                    audioBuffer = resampled;

                })
            }).catch(function (e) {
                console.log("Error with decoding audio data" + e.err);
            })
        }

    })

}

ipcRenderer.on('save', async (event, arg) => {
    await saveMP3(arg.start, arg.end, arg.filepath, arg.metadata)
})


function downloadMp3(buffer, filepath, metadata) {
    const MP3Blob = analyzeAudioBuffer(buffer, metadata);

//
//     var formData = new FormData();
//     formData.append("thefile", MP3Blob);
//
// // post form data
//     const xhr = new XMLHttpRequest();
//     xhr.responseType = 'text';
//
// // log response
//     xhr.onload = () => {
//         console.log(xhr.response);
//     };
//
// // create and send the reqeust
//     xhr.open('POST', 'https://birds.mattkirkland.co.uk/upload');
//     xhr.send(formData);
//

    const anchor = document.createElement('a');
    document.body.appendChild(anchor);
    anchor.style = 'display: none';
    const url = window.URL.createObjectURL(MP3Blob);
    anchor.href = url;
    anchor.download = filepath;
    anchor.click();
    window.URL.revokeObjectURL(url);
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
        writer.setFrame('TIT2', metadata['cname'])  // Title
            .setFrame('TIT3', metadata['sname'])
            .setFrame('TPE1', [metadata['cname2'], metadata['cname3']])  // Contributing Artists
            .setFrame('TCON', ['Nocmig']) // Album
            .setFrame('TPUB', 'Chirpity Nocmig') // Publisher
            .setFrame('TYER', new Date().getFullYear()) // Year
            .setFrame('COMM', {description: 'Metadata', 'text': ID3content}) // Album
            .setFrame('TXXX', {
                description: 'ID Confidence',
                value: parseFloat(parseFloat(metadata['score']) * 100).toFixed(0) + '%'
            })
            .setFrame('TXXX', {
                description: '2nd',
                value: metadata['cname2'] + ' (' + metadata['score2'] + ')'
            })
            .setFrame('TXXX', {
                description: '3rd',
                value: metadata['cname3'] + ' (' + metadata['score3'] + ')'
            })
            .setFrame('TXXX', {
                description: 'UUID',
                value: metadata['UUID'],
            });
        writer.addTag();
        buffer.push(writer.arrayBuffer)
    }
    for (var i = 0; remaining >= samplesPerFrame; i += samplesPerFrame) {

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
