// Imports
const tf = require('@tensorflow/tfjs');
const load = require('audio-loader')
const resampler = require('audio-resampler');
// const normalize = require('array-normalize')
const colormap = require('colormap')
const {norm} = require("@tensorflow/tfjs");

const MODEL_JSON = './model/model.json'
const CONFIG = {

    sampleRate: 48000,
    specLength: 3,
    sigmoid: 1.0,
    minConfidence: 0.3,

}

let MODEL = null;
let AUDIO_DATA = [];
let RESULTS = [];

let WAVESURFER = null;
let CURRENT_AUDIO_BUFFER = null;
let WS_ZOOM = 0;


async function loadModel() {

    // Load model
    if (MODEL == null) {
        console.log('Loading model...');
        MODEL = await tf.loadGraphModel(MODEL_JSON);
        //CONFIG.labels = MODEL.getLayer('SIGMOID').config.labels;
        CONFIG.labels = LABELS;
        console.log('...done loading model!');
        // Warmup the model before using real data.
        //console.log('warming up model!');
        //showElement('modelWarmUpText')
        //const warmupResult = MODEL.predict(tf.zeros([1,256,384,1]));
        //hideElement('modelWarmUpText')
        //warmupResult.dataSync();
        //warmupResult.dispose();
        //console.log('....done warming up model!');
    }

}

function normalize_and_fix_shape(spec) {
    spec = spec.slice(253, 256);
    // Normalize to 0-255
    const spec_max = tf.max(spec)
    spec = spec.mul(255);
    spec = spec.div(spec_max)
    return spec
}

function tensor2int16(data) {
    return tf.mul(data, 32767)
}

async function predict(audioData, model) {
    const audioTensor = tf.tensor1d(audioData)
    RESULTS = [];

    // Slice and expand
    const chunkLength = CONFIG.sampleRate * CONFIG.specLength;
    for (let i = 0; i < audioTensor.shape[0] - chunkLength; i += chunkLength) {

        if (i + chunkLength > audioTensor.shape[0]) i = audioTensor.shape[0] - chunkLength;
        let chunkTensor = audioTensor.slice(i, chunkLength) //.expandDims(0);
        // For now, let's work with hard coded values to avoid strange errors when reading the config
        // const spec_shape = [257, 384];
        //chunkTensor = tensor2int16(chunkTensor)
        const frame_length = 1024;
        const frame_step = 373;
        // Perform STFT
        let spec = tf.signal.stft(chunkTensor.squeeze(),
            frame_length,
            frame_step,
        )

        // Cast from complex to float
        spec = tf.cast(spec, 'float32');

        // Swap axes to fit output shape
        spec = tf.transpose(spec);
        spec = tf.reverse(spec, [0])
        spec = tf.abs(spec);
        // Fix Spectrogram shape
        spec = normalize_and_fix_shape(spec);
        // Add channel axis
        spec = tf.expandDims(spec, -1);

        // Add batch axis
        spec = tf.expandDims(spec, 0);

        // Make prediction
        const prediction = model.predict(spec);

        // Get label
        const index = prediction.argMax(1).dataSync()[0];
        const score = prediction.dataSync()[index];

        console.log(index, CONFIG.labels[index], score);

        if (score >= CONFIG.minConfidence) {
            RESULTS.push({

                timestamp: timestampFromSeconds(i / CONFIG.sampleRate) + ' - ' + timestampFromSeconds((i + chunkLength) / CONFIG.sampleRate),
                sname: CONFIG.labels[index].split('_')[0],
                cname: CONFIG.labels[index].split('_')[1],
                score: score

            });
        }
    }
    audioTensor.dispose()
}


function loadAudioFile(filePath) {

    // Hide load hint and show spinnner
    hideAll();
    showElement('loadFileHint');
    showElement('loadFileHintSpinner');
    showElement('loadFileHintLog');

    // load one file
    console.log('loadFileHintLog', 'Loading file...');
    load(filePath).then(function (buffer) {
        // Resample
        console.log('loadFileHintLog', 'Analyzing...');
        resampler(buffer, CONFIG.sampleRate, async function (event) {

            // Get raw audio data
            AUDIO_DATA = event.getAudioBuffer().getChannelData(0);

            // Normalize audio data
            // AUDIO_DATA = normalize(AUDIO_DATA)

            // Predict
            predict(AUDIO_DATA, MODEL);

            //Hide center div when done
            hideElement('loadFileHint');

            // Draw and show spectrogram
            drawSpectrogram(buffer);

            // Show results
            showResults();

        });

    });

}

function drawSpectrogram(audioBuffer) {

    // Set global buffer
    CURRENT_AUDIO_BUFFER = audioBuffer;

    // Show waveform container
    showElement('specContainer', false, true);
    showElement('specTimeline', false, true);

    // Setup waveform and spec views
    const options = {
        container: '#specContainer',
        backgroundColor: '#363a40',
        waveColor: '#fff',
        cursorColor: '#fff',
        progressColor: '#4b79fa',
        partialRender: true,
        splitChannels: true,
        splitChannelsOptions: {filterChannels: [1]},
        cursorWidth: 2,
        normalize: true,
        fillParent: true,
        responsive: true,
        height: 512,
        fftSamples: 1024,
        windowFunc: 'hamming',
        minPxPerSec: 50,
        labels: true,
        colorMap: colormap({
            colormap: 'inferno',
            nshades: 256,
            format: 'rgb',
            alpha: 1
        }),
        hideScrollbar: false,
        visualization: 'spectrogram',
        plugins: []
    };

    // Create wavesurfer object
    WAVESURFER = WaveSurfer.create(options);
    WAVESURFER.enableDragSelection({});

    // Load audio file
    WAVESURFER.loadDecodedBuffer(CURRENT_AUDIO_BUFFER);

    // Set initial zoom level
    WS_ZOOM = $('#specContainer').width() / WAVESURFER.getDuration();
    //console.log('ws zoom' + WS_ZOOM)
    // Set click event that removes all regions
    $('#specContainer').mousedown(function (e) {
        WAVESURFER.clearRegions();
    });

    // Resize canvas of spec and labels
    adjustSpecHeight(true);

    // Show controls
    showElement('controlsWrapper');

}

function adjustSpecHeight(redraw) {

    if (redraw && WAVESURFER != null) WAVESURFER.drawBuffer();

    $('#specContainer wave, canvas').each(function () {
        $(this).height($('body').height() * 0.40);
    });

    $('#resultTableContainer').height($('#contentWrapper').height() - $('#specContainer').height() - $('#controlsWrapper').height() - 47);

}

function zoomSpecIn() {

    WS_ZOOM += 50;
    WAVESURFER.zoom(WS_ZOOM);
    console.log('zoom is ' + WS_ZOOM)
}

function zoomSpecOut() {

    WS_ZOOM -= 50;
    WAVESURFER.zoom(WS_ZOOM);

}

function showResults() {

    console.log(RESULTS);
    showElement('resultTableContainer');

    // Remove old results
    $('#resultTableBody').empty();

    // Add new results
    for (let i = 0; i < RESULTS.length; i++) {

        let tr = "<tr><th scope='row'>" + (i + 1) + "</th>";
        tr += "<td>" + RESULTS[i].timestamp + "</td>";
        tr += "<td>" + RESULTS[i].cname + "</td>";
        tr += "<td>" + RESULTS[i].sname + "</td>";
        tr += "<td>" + (parseFloat(RESULTS[i].score) * 100).toFixed(0) + "%" + "</td>";
        tr += "</tr>";

        $('#resultTableBody').append(tr);

    }

}

function timestampFromSeconds(seconds) {

    const date = new Date(1970, 0, 1);
    date.setSeconds(seconds);
    return date.toTimeString().replace(/.*(\d{2}:\d{2}).*/, "$1");

}


