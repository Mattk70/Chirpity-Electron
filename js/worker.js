const {ipcRenderer} = require('electron');
const Model = require('./js/model.js');

const {app} = require('electron').remote; // use main modules from the renderer process

const appPath = app.getAppPath();
//const appPath = process.resourcesPath;

console.log(appPath);
// console.log(process.resourcesPath);


const model = new Model(appPath);

(async () => {
    await model.loadModel();
})();


ipcRenderer.on('analyze', async (event, arg) => {
    const audioBuffer = arg.audio;
    console.log('Worker received audio ' + arg.audio)
    let results = await model.makePrediction(audioBuffer)
    event.sender.send('prediction-done', {results});
});