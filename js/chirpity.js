// Imports
const tf = require('@tensorflow/tfjs');
const load = require('audio-loader')
const resampler = require('audio-resampler');
const colormap = require('colormap')
const WaveSurfer = require('wavesurfer.js')
const SpectrogramPlugin = require('wavesurfer.js/dist/plugin/wavesurfer.spectrogram.min.js');
const SpecTimeline = require('wavesurfer.js/dist/plugin/wavesurfer.timeline.min.js');
const Regions = require('wavesurfer.js/dist/plugin/wavesurfer.regions.min.js');
const MODEL_JSON = './model/model.json'
const CONFIG = {

    sampleRate: 48000, specLength: 3, sigmoid: 1.0, minConfidence: 0.3,

}

let MODEL = null;
let AUDIO_DATA = [];
let RESULTS = [];
let AUDACITY_LABELS = [];

let wavesurfer = null;
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
        console.log('warming up model!');
        showElement('modelWarmUpText')
        const warmupResult = await MODEL.predict(tf.zeros([1, 256, 384, 1]));
        hideElement('modelWarmUpText')
        warmupResult.dataSync();
        warmupResult.dispose();
        console.log('....done warming up model!');
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

async function predict(audioData, model, start, end) {
    start === undefined ? start = 0 : start = start * CONFIG.sampleRate;
    const audioTensor = tf.tensor1d(audioData);
    RESULTS = [];
    AUDACITY_LABELS = [];

    // Slice and expand
    const chunkLength = CONFIG.sampleRate * CONFIG.specLength;
    for (let i = start; i < audioTensor.shape[0] - chunkLength; i += chunkLength) {
        if (end !== undefined && i >= end * CONFIG.sampleRate) break
        if (i + chunkLength > audioTensor.shape[0]) i = audioTensor.shape[0] - chunkLength;
        let chunkTensor = audioTensor.slice(i, chunkLength) //.expandDims(0);

        const frame_length = 1024;
        const frame_step = 373;
        // Perform STFT
        let spec = tf.signal.stft(chunkTensor.squeeze(), frame_length, frame_step,)
        // Memory management ?
        chunkTensor.dispose();
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

        // Memory management ?
        spec.dispose();

        console.log(index, CONFIG.labels[index], score);
        if (score >= CONFIG.minConfidence) {
            RESULTS.push({
                timestamp: timestampFromSeconds(i / CONFIG.sampleRate) + ' - ' + timestampFromSeconds((i + chunkLength) / CONFIG.sampleRate),
                sname: CONFIG.labels[index].split('_')[0],
                cname: CONFIG.labels[index].split('_')[1],
                score: score

            });
            // Update results one by one
            //let start = RESULTS.length
            //start === 1 ? showResults() : appendResults(start)
            AUDACITY_LABELS.push({
                timestamp: (i / CONFIG.sampleRate).toFixed(1) + '\t' + ((i + chunkLength) / CONFIG.sampleRate).toFixed(1),
                cname: CONFIG.labels[index].split('_')[1],
                score: score

            });
        }
    }
    showResults();
}

function specColor(color) {
    console.log(colormap)

}

function loadAudioFile(filePath) {

    // Hide load hint and show spinnner
    hideAll();
    showElement('loadFileHint');
    showElement('loadFileHintSpinner');
    showElement('loadFileHintLog');
    let start = new Date()
    // load one file
    console.log('loadFileHintLog', 'Loading file...');
    load(filePath).then(function (buffer) {
        // Resample
        let timeNow = new Date() - start
        console.log('loading took ' + timeNow / 1000 + ' seconds');
        console.log('loadFileHintLog', 'Analyzing...');
        start = new Date()
        resampler(buffer, CONFIG.sampleRate, async function (event) {
            timeNow = new Date() - start;
            console.log('resampling took ' + timeNow / 1000 + ' seconds');

            // Get raw audio data
            AUDIO_DATA = event.getAudioBuffer().getChannelData(0);

            // Normalize audio data
            // AUDIO_DATA = normalize(AUDIO_DATA)

            //// Predict
            //start = new Date()
            //predict(AUDIO_DATA, MODEL);
            //timeNow = new Date() - start;
            //console.log('prediction took ' + timeNow / 1000 + ' seconds');
            //Hide center div when done
            hideElement('loadFileHint');

            // Draw and show spectrogram
            drawSpectrogram(buffer);

            // Show results
            //showResults();

        });

    });

}

function drawSpectrogram(audioBuffer) {

    // Set global buffer
    CURRENT_AUDIO_BUFFER = audioBuffer;

    // Show spec and timecode containers
    showElement('waveform', false, true);
    showElement('spectrogram', false, true);


    // Setup waveform and spec views
    wavesurfer = WaveSurfer.create({
        //options
        container: '#waveform',
        backend: 'WebAudio', // make waveform transparent
        backgroundColor: 'hsla(400, 100%, 30%, 0.0)',
        waveColor: 'hsla(400, 100%, 30%, 0.0)',
        progressColor: 'hsla(400, 100%, 30%, 0.0)', // but keep the playhead
        cursorColor: '#fff',
        cursorWidth: 2,
        normalize: true,
        scrollParent: true,
        responsive: true,
        height: 512,
        fftSamples: 1024,
        windowFunc: 'hamming',
        minPxPerSec: 50,
        hideScrollbar: false,
        plugins: [SpectrogramPlugin.create({
            wavesurfer: wavesurfer, container: "#spectrogram", scrollParent: true, labels: false, colorMap: colormap({
                colormap: 'inferno', nshades: 256, format: 'float'
            }),
        }), /* SpecTimeline.create({
                 container: "#timeline"

             }), */
            Regions.create({
                regionsMinLength: 2, dragSelection: {
                    slop: 5
                }
            })]
    })

    // Load audio file
    wavesurfer.loadDecodedBuffer(CURRENT_AUDIO_BUFFER);

    // Set click event that removes all regions
    $('#waveform').mousedown(function (e) {
        wavesurfer.clearRegions();
        disableMenuItem('analyzeSelection');
    });
    // Enable analyse selection when region created
    wavesurfer.on('region-created', function (e) {
        // console.log(wavesurfer.regions.list)
        region = e
        enableMenuItem('analyzeSelection');
    });


    // Set initial zoom level
    //WS_ZOOM = $('#waveform').width() / wavesurfer.getDuration();

    // Resize canvas of spec and labels
    adjustSpecHeight(true);

    // Hide waveform
    //hideElement('waveform')
    // Show controls
    showElement('controlsWrapper');
    $('#SpecDropdown').show()
    //showElement('timeline', false, true);

}

function adjustSpecHeight(redraw) {

    if (redraw && wavesurfer != null) wavesurfer.drawBuffer();

    $('#waveform wave, #waveform canvas, #spectrogram wave, #spectrogram canvas').each(function () {
        $(this).height($('body').height() * 0.4);
        $(this).width
    });
    $('#dummy').css('width', '100%');
    $('#dummy').height($('body').height() * 0.4);
    $('#spectrogram').css('z-index', 0);
    $('#timeline').height(20);

    $('#resultTableContainer').height($('#contentWrapper').height() - $('#dummy').height() - $('#controlsWrapper').height() - 47);
    //$('#resultTableContainer').height($('#contentWrapper').height() - $('#spectrogram').height() - $('#controlsWrapper').height() - $('#waveform').height() - 47);

}

function zoomSpecIn() {

    WS_ZOOM += 50;
    wavesurfer.zoom(WS_ZOOM);
}

function zoomSpecOut() {

    WS_ZOOM -= 50;
    wavesurfer.zoom(WS_ZOOM);

}

function appendResults(start) {
    // Add new results
    for (let i = start; i < RESULTS.length; i++) {
        let tr = "<tr>><td>" + RESULTS[i].timestamp + "</td>";
        tr += "<td>" + RESULTS[i].cname + "</td>";
        tr += "<td>" + RESULTS[i].sname + "</td>";
        tr += "<td>" + (parseFloat(RESULTS[i].score) * 100).toFixed(0) + "%" + "</td>";
        tr += "</tr>";
        $('#resultTableBody').append(tr);
    }
}


function showResults() {
    //console.log(RESULTS);
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
    enableMenuItem('saveLabels')
}

function timestampFromSeconds(seconds) {

    const date = new Date(1970, 0, 1);
    date.setSeconds(seconds);
    return date.toTimeString().replace(/.*(\d{2}:\d{2}).*/, "$1");

}
