const {ipcRenderer} = require('electron');
const Model = require('./js/model.js');
const fs = require("fs");
const appPath = '';
//const appPath = process.resourcesPath;

console.log(appPath);
// console.log(process.resourcesPath);

let audioBuffer;
const model = new Model(appPath);

(async () => {
    await model.loadModel();
    await model.warmUp();
    ipcRenderer.send('model-ready', {message: 'ready'})

})();


ipcRenderer.on('file-loaded', async (event, arg) => {
    const currentFile = arg.message;
    console.log('Worker received audio ' + arg.message);
    await loadAudioFile(currentFile);
    event.sender.send('worker-loaded', {message: currentFile});
});

ipcRenderer.on('analyze', async (event, arg) => {
    console.log('Worker received message: ' + arg.message + ' start: ' + arg.start + ' end: ' + arg.end);
    console.log(audioBuffer.length);
    const bufferLength = audioBuffer.length;
    let isRegion = false;
    if (arg.start === undefined) {
        arg.start = 0
    } else {
        arg.start = arg.start * model.config.sampleRate;
        isRegion = true
    }
    model.RESULTS = [];
    model.AUDACITY = [];
    let index = 0;
    for (let i = arg.start; i < bufferLength - model.chunkLength; i += model.chunkLength) {
        if (arg.end !== undefined && i >= arg.end * model.config.sampleRate) break; // maybe pad here
        if (i + model.chunkLength > bufferLength) i = bufferLength - model.chunkLength;
        let chunk = audioBuffer.slice(i, i + model.chunkLength);
        let [result, audacity] = await model.predictChunk(chunk, i, isRegion)
        if (result) {
            index++;
            model.RESULTS.push(result);
            model.AUDACITY.push(audacity);
            event.sender.send('prediction-ongoing', {result, 'index': index});
        }
        event.sender.send('progress', {'progress': i / bufferLength});
    }
    if (model.RESULTS.length === 0) {
        const result = "No detections found.";
        event.sender.send('prediction-ongoing', {result, 'index': 1});
    }
    event.sender.send('progress', {'progress': 1});
    event.sender.send('prediction-done', {'labels': model.AUDACITY});
});


async function loadAudioFile(filePath) {
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
                const  offlineSource = offlineCtx.createBufferSource();
                offlineSource.buffer = buffer;
                offlineSource.connect(offlineCtx.destination);
                offlineSource.start();
                offlineCtx.startRendering().then(function (resampled) {
                    console.log('Rendering completed successfully');
                    // `resampled` contains an AudioBuffer resampled at 48000Hz.
                    // use resampled.getChannelData(x) to get an Float32Array for channel x.
                    audioBuffer = resampled.getChannelData(0);

                })
            }).catch(function (e) {
                console.log("Error with decoding audio data" + e.err);
            })
        }

    })

}