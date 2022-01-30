const {ipcRenderer} = require('electron');
const load = require("audio-loader");
const Model = require('./js/model.js');
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
    // load one file
    try {
        load(filePath).then(function (buffer) {
            // Resample
            // if mp3
            let sampleRate = model.config.sampleRate;
            if (filePath.endsWith('.mp3')) sampleRate /= buffer.numberOfChannels;
            const offlineCtx = new OfflineAudioContext(1,
                buffer.duration * 48000,
                48000);
            const offlineSource = offlineCtx.createBufferSource();
            offlineSource.buffer = buffer;
            offlineSource.connect(offlineCtx.destination);
            offlineSource.start();
            offlineCtx.startRendering().then((resampled) => {
                // `resampled` contains an AudioBuffer resampled at 48000Hz.
                // use resampled.getChannelData(x) to get an Float32Array for channel x.
                console.log("model received file of duration: " + resampled.duration)
                audioBuffer = resampled.getChannelData(0);
            });
        })
    } catch (error) {
        console.log(error)
    }
}