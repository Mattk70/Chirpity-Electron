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
})();


ipcRenderer.on('file-loaded', async (event, arg) => {
    const currentFile = arg.message;
    console.log('Worker received audio ' + arg.message);
    await loadAudioFile(currentFile);
    event.sender.send('worker-loaded', {message: currentFile});
});

ipcRenderer.on('analyze', async (event, arg) => {
    const message = arg.message;
    console.log('Worker received message: ' + arg.message);
    let results = await model.makePrediction(audioBuffer)
    event.sender.send('prediction-done', {results});
});

ipcRenderer.on('analyzeSelection', async (event, arg) => {
    const message = arg.message;
    console.log('Worker received message: ' + arg.message);
    let results = await model.makePrediction(audioBuffer, arg.start, arg.end)
    event.sender.send('prediction-done', {results});
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