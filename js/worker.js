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
        for (let i = start; i < end; i += increment) {
            // If we're at the end of a file and we haven't got a full chunk, scroll back to fit
            //if (i + model.chunkLength > end && end >= model.chunkLength) i = end - model.chunkLength;

            let chunk = audioBuffer.slice(i, i + increment);
            let [result, audacity] = await model.predictChunk(chunk, i, isRegion)
            if (result) {
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
                const offlineSource = offlineCtx.createBufferSource();
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