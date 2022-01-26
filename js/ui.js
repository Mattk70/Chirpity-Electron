const {ipcRenderer} = require('electron');
const {dialog} = require('electron').remote;
const remote = require('electron').remote;
const fs = require('fs');
const load = require("audio-loader");
const audio_buffer_from = require('audio-buffer-from');
const WaveSurfer = require("wavesurfer.js");
const SpectrogramPlugin = require('wavesurfer.js/dist/plugin/wavesurfer.spectrogram.min.js');
const SpecTimeline = require('wavesurfer.js/dist/plugin/wavesurfer.timeline.min.js');
const Regions = require('wavesurfer.js/dist/plugin/wavesurfer.regions.min.js');
const colormap = require("colormap");
const $ = require('jquery');
const resampler = require("audio-resampler");

let modelReady = false;
let fileLoaded = false;
let currentFile;
let region;
let AUDIO_DATA;
let AUDACITY_LABELS;
let wavesurfer;
let WS_ZOOM = 0;

// set up some  for caching
let bodyElement;
let dummyElement;
let specElement;
let waveElement;
let specCanvasElement;
let specWaveElement;
let waveCanvasElement;
let waveWaveElement;
let resultTableElement = $('#resultTableContainer');
let contentWrapperElement = $('#contentWrapper');
let controlsWrapperElement = $('#controlsWrapper');
let completeDiv = $('.complete');

function loadAudioFile(filePath) {
    // Hide load hint and show spinnner
    hideAll();
    disableMenuItem('analyze')
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
        // if mp3
        let sampleRate = 48000;
        if (filePath.endsWith('.mp3')) sampleRate = sampleRate / buffer.numberOfChannels;
        resampler(buffer, sampleRate, async function (event) {
            timeNow = new Date() - start;
            console.log('resampling took ' + timeNow / 1000 + ' seconds');
            // Get raw audio data for one channel
            AUDIO_DATA = event.getAudioBuffer().getChannelData(0);
            //Hide center div when done
            hideElement('loadFileHint');
            // Draw and show spectrogram
            let duration = event.getAudioBuffer().duration
            if (duration < 300) {
                drawSpec({'audio': buffer, 'backend': 'WebAudio', 'alpha': 0, 'spectrogram': true});
            } else {
                drawSpec({'audio': filePath, 'backend': 'MediaElementWebAudio', 'alpha': 1, 'spectrogram': false});
            }
            ipcRenderer.send('file-loaded', {message: currentFile});
            fileLoaded = true;
            completeDiv.hide();
            if (modelReady) enableMenuItem('analyze')
        });

    });
}

function drawSpec(args) {
    // Show spec and timecode containers
    showElement('waveform', false, true);
    showElement('spectrogram', false, true);
    if (wavesurfer !== undefined) wavesurfer.pause();
    if (args.spectrogram) {
        // Setup waveform and spec views
        wavesurfer = WaveSurfer.create({
            //options
            container: '#waveform',
            backend: args.backend, // 'MediaElementWebAudio',
            // make waveform transparent
            backgroundColor: 'rgba(0,0,0,0)',
            waveColor: 'rgba(109,41,164,' + args.alpha + ')',
            progressColor: 'rgba(109,41,164,' + args.alpha + ')',
            // but keep the playhead
            cursorColor: '#fff',
            cursorWidth: 2,
            normalize: true,
            partialRender: true,
            scrollParent: true,
            responsive: true,
            height: 512,
            fftSamples: 1024,
            windowFunc: 'hamming',
            minPxPerSec: 50,
            hideScrollbar: false,
            plugins: [
                SpectrogramPlugin.create({
                    wavesurfer: wavesurfer,
                    container: "#spectrogram",
                    scrollParent: true,
                    labels: false,
                    colorMap: colormap({
                        colormap: 'inferno', nshades: 256, format: 'float'
                    }),
                }), SpecTimeline.create({
                    container: "#timeline"

                }),
                Regions.create({
                    regionsMinLength: 2,
                    dragSelection: {
                        slop: 5,

                    },
                    color: "rgba(255, 255, 255, 0.2)"
                })]
        })
        wavesurfer.loadDecodedBuffer(args.audio);
    } else {
        // Setup waveform and spec views
        wavesurfer = WaveSurfer.create({
            //options
            container: '#waveform',
            backend: args.backend, // 'MediaElementWebAudio',
            // make waveform transparent
            backgroundColor: 'rgba(0,0,0,0)',
            waveColor: 'rgba(109,41,164,' + args.alpha + ')',
            progressColor: 'rgba(109,41,164,' + args.alpha + ')',
            // but keep the playhead
            cursorColor: '#fff',
            cursorWidth: 2,
            normalize: true,
            partialRender: true,
            scrollParent: true,
            responsive: true,
            height: 512,
            fftSamples: 1024,
            windowFunc: 'hamming',
            minPxPerSec: 50,
            hideScrollbar: false,
            plugins: [
                SpecTimeline.create({
                    container: "#timeline"

                }),
                Regions.create({
                    regionsMinLength: 2,
                    dragSelection: {
                        slop: 5,

                    },
                    color: "rgba(255, 255, 255, 0.2)"
                })]
        })
        let audio = document.createElement('audio');
        audio.src = currentFile;
        //Set crossOrigin to anonymous to avoid CORS restrictions
        audio.crossOrigin = 'anonymous';
        wavesurfer.load(args.audio)
    }


    bodyElement = $('body');
    dummyElement = $('#dummy');
    waveElement = $('#waveform')

    specElement = $('spectrogram')
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
    $('#SpecDropdown').show();
//showElement('timeline', false, true);

}

function zoomSpecIn() {
    WS_ZOOM += 50;
    wavesurfer.zoom(WS_ZOOM);
    adjustSpecHeight(true)
    //wavesurfer.spectrogram.render()
}

function zoomSpecOut() {
    WS_ZOOM -= 50;
    wavesurfer.zoom(WS_ZOOM);
    adjustSpecHeight(true)
    //wavesurfer.spectrogram.render()
}

async function showOpenDialog() {

    // Show file dialog to select audio file
    const fileDialog = await dialog.showOpenDialog({

        filters: [{name: 'Audio Files', extensions: ['mp3', 'wav']}], // , 'ogg', 'aac', 'flac']}],
        properties: ['openFile']
    });

    // Load audio file
    if (fileDialog.filePaths.length > 0) {
        loadAudioFile(fileDialog.filePaths[0]);
        currentFile = fileDialog.filePaths[0];
    }


}


async function showSaveDialog() {
    // Show file dialog to save Audacity label file
    currentFile = currentFile.substr(0, currentFile.lastIndexOf(".")) + ".txt";
    const fileDialog = await dialog.showSaveDialog({
        filters: [{name: 'Text Files', extensions: ['txt']}],
        defaultPath: currentFile
    }).then(file => {
        // Stating whether dialog operation was cancelled or not.
        console.log(file.canceled);
        if (!file.canceled) {
            console.log(file.filePath.toString());
            let str = ""
            // Format results

            for (let i = 0; i < AUDACITY_LABELS.length; i++) {
                str += AUDACITY_LABELS[i].timestamp + "\t";
                str += " " + AUDACITY_LABELS[i].cname;
                // str += " " + AUDACITY_LABELS[i].sname ;
                str += " " + (parseFloat(AUDACITY_LABELS[i].score) * 100).toFixed(0) + "%\r\n";
            }

            fs.writeFile(file.filePath.toString(),
                str, function (err) {
                    if (err) throw err;
                    console.log('Saved!');
                });
        }
    }).catch(err => {
        console.log(err)
    });
}

// Worker listeners

const analyzeLink = document.getElementById('analyze');

analyzeLink.addEventListener('click', async () => {
    completeDiv.hide();
    ipcRenderer.send('analyze', {message: 'go'});
    analyzeLink.disabled = true;
});

const analyzeSelectionLink = document.getElementById('analyzeSelection');

analyzeSelectionLink.addEventListener('click', async () => {
    completeDiv.hide();
    ipcRenderer.send('analyze', {message: 'go', start: region.start, end: region.end});
    analyzeLink.disabled = true;
});

ipcRenderer.on('model-ready', async (event, arg) => {
    modelReady = true;
    if (fileLoaded) {
        enableMenuItem('analyze')
    }
})

// Menu bar functions

function exitApplication() {
    remote.app.quit()
}

function enableMenuItem(id) {
    $('#' + id).removeClass('disabled');
}

function disableMenuItem(id) {
    $('#' + id).addClass('disabled');
}

function saveLabelFile(path) {

}

function toggleAlternates(row) {

    $(row).toggle('slow')
}

function showElement(id, makeFlex = true, empty = false) {
    $('#' + id).removeClass('d-none');
    if (makeFlex) $('#' + id).addClass('d-flex');
    if (empty) $('#' + id).empty();
}

function hideElement(id) {
    $('#' + id).removeClass('d-flex');
    $('#' + id).addClass('d-none');

}

function hideAll() {

    // File hint div
    hideElement('loadFileHint');
    hideElement('loadFileHintText');
    hideElement('loadFileHintSpinner');
    hideElement('loadFileHintLog')

    // Waveform and spec
    hideElement('waveform');
    hideElement('spectrogram');

    // Controls    
    hideElement('controlsWrapper');

    // Result table
    hideElement('resultTableContainer');

}


/////////////////////////  DO AFTER LOAD ////////////////////////////
window.onload = function () {

    // Set footer year
    $('#year').textContent = new Date().getFullYear().toString();
    // Load model
    //loadModel()

};

//window.addEventListener('resize', WindowResize);

const waitForFinalEvent = (function () {
    var timers = {};
    return function (callback, ms, uniqueId) {
        if (!uniqueId) {
            uniqueId = "Don't call this twice without a uniqueId";
        }
        if (timers[uniqueId]) {
            clearTimeout(timers[uniqueId]);
        }
        timers[uniqueId] = setTimeout(callback, ms);
    };
})();

$(window).resize(function () {
    waitForFinalEvent(function () {

        WindowResize();
    }, 500, 'id1');
});

function WindowResize() {
    adjustSpecHeight(true);
}

const GLOBAL_ACTIONS = { // eslint-disable-line
    Space: function () {
        wavesurfer.playPause();
    },
    ArrowLeft: function () {
        wavesurfer.skipBackward();
    },
    ArrowRight: function () {
        wavesurfer.skipForward();
    },
    KeyO: function () {
        showOpenDialog();
    },
    KeyS: function () {
        if (RESULTS.length > 0) {
            showSaveDialog();
        }
    },
    Home: function () {
        wavesurfer.seekAndCenter(0);
        wavesurfer.pause()
    },
    End: function () {
        wavesurfer.seekAndCenter(1);
        wavesurfer.pause()
    },
    KeyP: function () {
        (typeof region !== 'undefined') ? region.play() : console.log('Region undefined')
    }
};

// Bind actions to buttons and keypresses
document.addEventListener('DOMContentLoaded', function () {
    document.addEventListener('keydown', function (e) {
        let action = e.code;
        if (action in GLOBAL_ACTIONS) {
            if (document == e.target || document.body == e.target || e.target.attributes["data-action"]) {
                e.preventDefault();
            }
            GLOBAL_ACTIONS[action](e);
        }
    });

    [].forEach.call(document.querySelectorAll('[data-action]'), function (el) {
        el.addEventListener('click', function (e) {
            let action = e.currentTarget.dataset.action;
            if (action in GLOBAL_ACTIONS) {
                e.preventDefault();
                GLOBAL_ACTIONS[action](e);
            }
        });
    });
});

ipcRenderer.on('prediction-ongoing', async (event, arg) => {
    completeDiv.hide();
    const result = arg.result;
    const index = arg.index;
    if (index === 1) {
        // Remove old results
        $('#resultTableBody').empty();
    }
    let tr;
    showElement('resultTableContainer');

    if (result === "No detections found.") {
        tr = "<tr><td colspan='6'>" + result + "</td></tr>";
    } else {

        tr = "<tr onclick='createRegion(" + result.start + " , " + result.end + " )'><th scope='row'>" + index + "</th>";
        tr += "<td>" + result.timestamp + "</td>";
        tr += "<td>" + result.cname + "</td>";
        tr += "<td>" + result.sname + "</td>";
        tr += "<td>" + (parseFloat(result.score) * 100).toFixed(0) + "%" + "</td>";
        tr += "<td><span class='material-icons rotate' onclick='toggleAlternates(&quot;.subrow" + index + "&quot;)'>expand_more</span></td>";
        tr += "</tr>";

        tr += "<tr  class='subrow" + index + "'  onclick='createRegion(" + result.start + " , " + result.end + " )'><th scope='row'> </th>";
        tr += "<td> </td>";
        tr += "<td>" + result.cname2 + "</td>";
        tr += "<td>" + result.sname2 + "</td>";
        tr += "<td>" + (parseFloat(result.score2) * 100).toFixed(0) + "%" + "</td>";
        tr += "<td> </td>";
        tr += "</tr>";

        tr += "<tr  class='subrow" + index + "'  onclick='createRegion(" + result.start + " , " + result.end + " )' ><th scope='row'> </th>";
        tr += "<td> </td>";
        tr += "<td>" + result.cname3 + "</td>";
        tr += "<td>" + result.sname3 + "</td>";
        tr += "<td>" + (parseFloat(result.score3) * 100).toFixed(0) + "%" + "</td>";
        tr += "<td> </td>";
        tr += "</tr>";

    }
    $('#resultTableBody').append(tr);

    $(".material-icons").click(function () {
        $(this).toggleClass("down");
    })
});
let progressDiv = $('.progressDiv');

let progressBar = $('.progress .progress-bar');
ipcRenderer.on('progress', async (event, arg) => {
    progressDiv.show();
    let progress = (arg.progress * 100).toFixed(1);
    console.log('progress update: ' + progress);
    progressBar.width(progress + '%');
    progressBar.attr('aria-valuenow', progress);
    progressBar.html(progress + '%');
});

ipcRenderer.on('prediction-done', async (event, arg) => {
    AUDACITY_LABELS = arg.labels;
    progressDiv.hide();
    progressBar.width(0 + '%');
    progressBar.attr('aria-valuenow', 0);
    progressBar.html(0 + '%');
    completeDiv.show();
    enableMenuItem('saveLabels');
});

function createRegion(start, end) {
    wavesurfer.pause();
    wavesurfer.clearRegions();
    wavesurfer.addRegion({start: start, end: end, color: "rgba(255, 255, 255, 0.2)"});
    const progress = start / wavesurfer.getDuration();
    wavesurfer.seekAndCenter(progress);
}

function adjustSpecHeight(redraw) {
    if (redraw && wavesurfer != null) {
        wavesurfer.drawBuffer();
    }
    //wavesurfer.spectrogram.render();

    //$('#dummy, #waveform wave, spectrogram, #spectrogram canvas, #waveform canvas').each(function () {
    $.each([dummyElement, waveWaveElement, specElement, specCanvasElement, waveCanvasElement], function () {
        $(this).height(bodyElement.height() * 0.4)

        waveCanvasElement = $('#waveform canvas')
        let specWidth = 0;
        for (let i = 0; i < waveCanvasElement.length; i++) {
            specWidth += waveCanvasElement[i].width
            console.log('wavecanvaselement ' + i + 'width is ' + waveCanvasElement[i].width + ' ' + specWidth)
        }
        console.log('specwidth  is ' + specWidth)
        specCanvasElement.width(specWidth);
        //console.log("canvas width " + canvasWidth)

        specElement.css('z-index', 0)

        resultTableElement.height(contentWrapperElement.height() - dummyElement.height() - controlsWrapperElement.height() - 47);
    })
}