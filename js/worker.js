const {ipcRenderer} = require('electron');
const Model = require('./js/model.js');
const fs = require("fs");
const AudioBufferSlice = require('./js/AudioBufferSlice.js');
const lamejs = require("lamejstmp");

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
    let channelData = audioBuffer.getChannelData(0);
    for (let i = start; i < end; i += increment) {
        // If we're at the end of a file and we haven't got a full chunk, scroll back to fit
        //if (i + model.chunkLength > end && end >= model.chunkLength) i = end - model.chunkLength;

        let chunk = channelData.slice(i, i + increment);
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
                    audioBuffer = resampled;

                })
            }).catch(function (e) {
                console.log("Error with decoding audio data" + e.err);
            })
        }

    })

}

ipcRenderer.on('save', async (event, arg) => {
    await saveMP3(arg.start, arg.end, arg.filepath)
})

async function saveMP3(start, end, filepath, metadata) {


    let mp3Data = [];
    AudioBufferSlice(audioBuffer, start, end, function (error, slicedAudioBuffer) {
        if (error) {
            console.error(error);
        } else {
            const mp3encoder = new lamejs.Mp3Encoder(1, 48000, 192);
            const samples = FloatArray2Int16(slicedAudioBuffer) //one second of silence replace that with your own samples
            const sampleBlockSize = 1152; //can be anything but make it a multiple of 576 to make encoders life easier

            var mp3Data = [];
            for (let i = 0; i < samples.length; i += sampleBlockSize) {
                const sampleChunk = samples.slice(i, i + sampleBlockSize);
                var mp3buf = mp3encoder.encodeBuffer(sampleChunk);
                if (mp3buf.length > 0) {
                    mp3Data.push(mp3buf);
                }
            }
            mp3buf = mp3encoder.flush();   //finish writing mp3

            if (mp3buf.length > 0) {
                mp3Data.push(new Int8Array(mp3buf));
            }
            //fs.writeFile(filepath, slicedAudioBuffer, function (err) {
                fs.writeFile(filepath, Buffer.from(mp3Data), function (err) {
                if (err) {
                    console.log(err);
                } else {
                    console.log(mp3Data.length);
                }
            });
            console.log('saved mp3 file');
        }
    })
}

function FloatArray2Int16(floatbuffer) {
    const int16Buffer = new Int16Array(floatbuffer.length);
    for (let i = 0, len = floatbuffer.length; i < len; i++) {
        if (floatbuffer[i] < 0) {
            int16Buffer[i] = 0x8000 * floatbuffer[i];
        } else {
            int16Buffer[i] = 0x7FFF * floatbuffer[i];
        }
    }
    return int16Buffer;
}