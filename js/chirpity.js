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

// set up some  for caching
let bodyElement = null;
let dummyElement = null;
let specElement = null;
let waveElement = null;
let specCanvasElement = null;
let specWaveElement = null
let waveCanvasElement = null;
let waveWaveElement = null

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
        showElement('modelWarmUpText', true, false);
        //warmUp(MODEL);

        hideElement('modelWarmUpText');
        console.log('....done warming up model!');
    }

}

/*
Parking this as worker won't accept model object and JSON stringify barfs about circular object
? Try without passing model --> MODEL not defined
let worker = new Worker(
        `data:text/javascript,
        function warmUp(msg) {
            const warmupResult =  MODEL.predict(tf.zeros([1, 256, 384, 1]));
            warmupResult.dataSync();
            warmupResult.dispose();
        }
        onmessage = function(){    //This will be called when worker.postMessage is called in the outside code.
            warmUp();    //Find the result. This will take long time but it doesn't matter since it's called in the worker.
            postMessage('Model Warmed Up');    //Send the result to the outside code.
        };
    `
);
*/

async function warmUp(model) {
    const warmupResult = model.predict(tf.zeros([1, 256, 384, 1]));
    warmupResult.dataSync();
    warmupResult.dispose();
}

function normalize_and_fix_shape(spec) {
    spec = spec.slice(253, 256);
    // Normalize to 0-255
    const spec_max = tf.max(spec);
    spec = spec.mul(255);
    spec = spec.div(spec_max);
    return spec;
}

async function predict(audioData, model, start, end) {
    start === undefined ? start = 0 : start = start * CONFIG.sampleRate;
    const audioTensor = tf.tensor1d(audioData);
    RESULTS = [];
    AUDACITY_LABELS = [];

    // Slice and expand
    const chunkLength = CONFIG.sampleRate * CONFIG.specLength;
    for (let i = start; i < audioTensor.shape[0] - chunkLength; i += chunkLength) {
        if (end !== undefined && i >= end * CONFIG.sampleRate) break;
        if (i + chunkLength > audioTensor.shape[0]) i = audioTensor.shape[0] - chunkLength;
        let chunkTensor = audioTensor.slice(i, chunkLength); //.expandDims(0);

        const frame_length = 1024;
        const frame_step = 373;
        // Perform STFT
        let spec = tf.signal.stft(chunkTensor.squeeze(), frame_length, frame_step,);
        // Memory management ?
        chunkTensor.dispose();
        // Cast from complex to float
        spec = tf.cast(spec, 'float32');

        // Swap axes to fit output shape
        spec = tf.transpose(spec);
        spec = tf.reverse(spec, [0]);
        spec = tf.abs(spec);
        // Fix Spectrogram shape
        spec = normalize_and_fix_shape(spec);
        // Add channel axis
        spec = tf.expandDims(spec, -1);

        // Add batch axis
        spec = tf.expandDims(spec, 0);

        // Make prediction
        const prediction = model.predict(spec);
        //console.log(prediction.dataSync())
        // Get label
        const {indices, values} = prediction.topk(3);
        console.log(indices.dataSync())
        console.log(values.dataSync())
        const [primary, secondary, tertiary] = indices.dataSync();
        const [score, score2, score3] = values.dataSync();

        // Memory management ?
        spec.dispose();
        prediction.dispose();

        console.log(primary, CONFIG.labels[primary], score);
        if (score >= CONFIG.minConfidence) {
            RESULTS.push({
                start: i / CONFIG.sampleRate,
                end: (i + chunkLength) / CONFIG.sampleRate,
                timestamp: timestampFromSeconds(i / CONFIG.sampleRate) + ' - ' + timestampFromSeconds((i + chunkLength) / CONFIG.sampleRate),
                sname: CONFIG.labels[primary].split('_')[0],
                cname: CONFIG.labels[primary].split('_')[1],
                score: score,
                sname2: CONFIG.labels[secondary].split('_')[0],
                cname2: CONFIG.labels[secondary].split('_')[1],
                score2: score2,
                sname3: CONFIG.labels[tertiary].split('_')[0],
                cname3: CONFIG.labels[tertiary].split('_')[1],
                score3: score3,

            });
            // Update results one by one
            //let start = RESULTS.length
            //start === 1 ? showResults() : appendResults(start)
            AUDACITY_LABELS.push({
                timestamp: (i / CONFIG.sampleRate).toFixed(1) + '\t' + ((i + chunkLength) / CONFIG.sampleRate).toFixed(1),
                cname: CONFIG.labels[primary].split('_')[1],
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
        backend: 'WebAudio',
        // make waveform transparent
        backgroundColor: 'rgba(0,0,0,0)',
        waveColor: 'rgba(0,0,0,0)',
        progressColor: 'rgba(0,0,0,0)',
        // but keep the playhead
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
                regionsMinLength: 2,
                dragSelection: {
                    slop: 5,

                },
                color: "rgba(255, 255, 255, 0.2)"
            })]
    })

    // Load audio file
    wavesurfer.loadDecodedBuffer(CURRENT_AUDIO_BUFFER)
    bodyElement = $('body');
    dummyElement = $('#dummy');
    specElement = $('spectrogram')
    waveElement = $('#waveform')
    specCanvasElement = $('#spectrogram canvas')
    waveCanvasElement = $('#waveform canvas')
    waveWaveElement = $('#waveform wave')
    specWaveElement = $('#spectrogram wave')

    // Set click event that removes all regions
    waveElement.mousedown(function (e) {
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

function createRegion(start, end) {
    wavesurfer.clearRegions();
    wavesurfer.addRegion({start: start, end: end, color: "rgba(255, 255, 255, 0.2)"});
    const progress = start / wavesurfer.getDuration()
    wavesurfer.seekAndCenter(progress)
}

function adjustSpecHeight(redraw) {
    if (redraw && wavesurfer != null) {
        wavesurfer.drawBuffer();

        //$('#dummy, #waveform wave, spectrogram, #spectrogram canvas, #waveform canvas').each(function () {
        $.each([dummyElement, waveWaveElement, specElement, specCanvasElement, waveCanvasElement], function () {
            $(this).height(bodyElement.height() * 0.4)
            //$(this).css('width','100%')

        });
        //let canvasWidth = 0
        //console.log("canvas width " + JSON.stringify(waveCanvasElements))
        //for (let i = 0; i < waveCanvasElements.length; i++){
        specCanvasElement.width(waveCanvasElement.width())
        //}
        //console.log("canvas width " + canvasWidth)

        //specCanvasElement.width(canvasWidth)
        specElement.css('z-index', 0)

        //$('#timeline').height(20);

        $('#resultTableContainer').height($('#contentWrapper').height() - $('#dummy').height() - $('#controlsWrapper').height() - 47);
        //$('#resultTableContainer').height($('#contentWrapper').height() - $('#spectrogram').height() - $('#controlsWrapper').height() - $('#waveform').height() - 47);
    }
}

function zoomSpecIn() {

    WS_ZOOM += 50;
    wavesurfer.zoom(WS_ZOOM);
    adjustSpecHeight(true)
}

function zoomSpecOut() {

    WS_ZOOM -= 50;
    wavesurfer.zoom(WS_ZOOM);
    adjustSpecHeight(true)
}

function toggleAlternates(row) {
    $(row).toggle()
}

function showResults() {
    //console.log(RESULTS);
    showElement('resultTableContainer');

    // Remove old results
    $('#resultTableBody').empty();

    // Add new results
    for (let i = 0; i < RESULTS.length; i++) {

        let tr = "<tr onclick='createRegion(" + RESULTS[i].start + " , " + RESULTS[i].end + " )'><th scope='row'>" + (i + 1) + "</th>";
        tr += "<td>" + RESULTS[i].timestamp + "</td>";
        tr += "<td>" + RESULTS[i].cname + "</td>";
        tr += "<td>" + RESULTS[i].sname + "</td>";
        tr += "<td>" + (parseFloat(RESULTS[i].score) * 100).toFixed(0) + "%" + "</td>";
        tr += "<td><span class='material-icons' onclick='toggleAlternates(&quot;.subrow" + i + "&quot;)'>expand_more</span></td>";
        tr += "</tr>";

        tr += "<tr  class='subrow" + i + "'  style='display: none' onclick='createRegion(" + RESULTS[i].start + " , " + RESULTS[i].end + " )' style='font-size: 10px;'><th scope='row'> </th>";
        tr += "<td> </td>";
        tr += "<td>" + RESULTS[i].cname2 + "</td>";
        tr += "<td>" + RESULTS[i].sname2 + "</td>";
        tr += "<td>" + (parseFloat(RESULTS[i].score2) * 100).toFixed(0) + "%" + "</td>";
        tr += "<td> </td>";
        tr += "</tr>";

        tr += "<tr  class='subrow" + i + "'  style='display: none' onclick='createRegion(" + RESULTS[i].start + " , " + RESULTS[i].end + " )'  style='font-size: 10px;'><th scope='row'> </th>";
        tr += "<td> </td>";
        tr += "<td>" + RESULTS[i].cname3 + "</td>";
        tr += "<td>" + RESULTS[i].sname3 + "</td>";
        tr += "<td>" + (parseFloat(RESULTS[i].score3) * 100).toFixed(0) + "%" + "</td>";
        tr += "<td> </td>"
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
