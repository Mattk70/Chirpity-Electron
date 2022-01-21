// Imports
const tf = require('@tensorflow/tfjs');
//const load = require('audio-loader')
//const resampler = require('audio-resampler');
//const colormap = require('colormap')
//const WaveSurfer = require('wavesurfer.js')
//const SpectrogramPlugin = require('wavesurfer.js/dist/plugin/wavesurfer.spectrogram.min.js');
//const SpecTimeline = require('wavesurfer.js/dist/plugin/wavesurfer.timeline.min.js');
//const Regions = require('wavesurfer.js/dist/plugin/wavesurfer.regions.min.js');
const CONFIG = {

    sampleRate: 48000, specLength: 3, sigmoid: 1.0, minConfidence: 0.3,

}

/*let AUDIO_DATA = [];
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

 */
async function predict(audioData, model, start, end) {
    start === undefined ? start = 0 : start = start * CONFIG.sampleRate;
    const audioTensor = tf.tensor1d(audioData);
    RESULTS = [];
    AUDACITY_LABELS = [];

    // Slice and expand
    const chunkLength = CONFIG.sampleRate * CONFIG.specLength;
    // pad clips < 3 seconds
    if (audioTensor.shape[0] < chunkLength) {
        console.log(audioData.shape[0])
    }
    for (let i = start; i < audioTensor.shape[0] - chunkLength; i += chunkLength) {
        if (end !== undefined && i >= end * CONFIG.sampleRate) break;
        if (i + chunkLength > audioTensor.shape[0]) i = audioTensor.shape[0] - chunkLength;
        let chunkTensor = audioTensor.slice(i, chunkLength); //.expandDims(0);

        // Make prediction
        const prediction = await model.makePrediction(chunkTensor);
        //console.log(prediction.dataSync())
        // Get label
        const {indices, values} = prediction.topk(3);
        const [primary, secondary, tertiary] = indices.dataSync();
        const [score, score2, score3] = values.dataSync();

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
        //specCanvasElement.width(waveCanvasElement.width())
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
    //wavesurfer.spectrogram.render()
    console.log(wavesurfer)
}

function zoomSpecOut() {

    WS_ZOOM -= 50;
    wavesurfer.zoom(WS_ZOOM);
    adjustSpecHeight(true)
    //wavesurfer.spectrogram.render()
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
        tr += "<td><span class='material-icons rotate' onclick='toggleAlternates(&quot;.subrow" + i + "&quot;)'>expand_more</span></td>";
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
    $(".material-icons").click(function () {
        $(this).toggleClass("down");
    })
    enableMenuItem('saveLabels')
}

function timestampFromSeconds(seconds) {

    const date = new Date(1970, 0, 1);
    date.setSeconds(seconds);
    return date.toTimeString().replace(/.*(\d{2}:\d{2}).*/, "$1");

}
