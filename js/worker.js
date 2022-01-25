const {ipcRenderer} = require('electron');
const load = require("audio-loader");
const resampler = require("audio-resampler");

const {app} = require('electron').remote; // use main modules from the renderer process
const Model = require('./js/model.js');
const appPath = app.getAppPath();
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

/*
ipcRenderer.on('analyze', async (event, arg) => {
    const message = arg.message;
    console.log('Worker received message: ' + arg.message + ' start: ' + arg.start + ' end: ' + arg.end);
    let results = await model.predictFile(audioBuffer, arg.start, arg.end)
    event.sender.send('prediction-done', {results});
});

 */

ipcRenderer.on('analyze', async (event, arg) => {
    const message = arg.message;
    console.log('Worker received message: ' + arg.message + ' start: ' + arg.start + ' end: ' + arg.end);
    console.log(audioBuffer.length);
    const bufferLength = audioBuffer.length;
    arg.start === undefined ? arg.start = 0 : arg.start = arg.start * model.config.sampleRate;
    model.RESULTS = [];
    let index = 0;
    for (let i = arg.start; i < bufferLength - model.chunkLength; i += model.chunkLength) {

        if (arg.end !== undefined && i >= arg.end * model.config.sampleRate) break; // maybe pad here
        if (i + model.chunkLength > bufferLength) i = bufferLength - model.chunkLength;
        let chunk = audioBuffer.slice(i, i + model.chunkLength);
        let result = (await model.predictChunk(chunk, i));
        if (result) {
            index++;
            model.RESULTS.push(result);
            event.sender.send('prediction-ongoing', {result, 'index': index});
        }
    }
    event.sender.send('prediction-done', {'results': model.RESULTS});
});


async function loadAudioFile(filePath) {
    // load one file
    try {
        load(filePath).then(function (buffer) {
            // Resample
            resampler(buffer, 48000, async function (event) {
                // Get raw audio data
                audioBuffer = await event.getAudioBuffer().getChannelData(0);
            });

        })
    } catch (error) {
        console.log(error)
    }

}