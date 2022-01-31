const {ipcRenderer} = require('electron');
const {dialog} = require('electron').remote;
const remote = require('electron').remote;
const fs = require('fs');
const WaveSurfer = require("wavesurfer.js");
const SpectrogramPlugin = require('wavesurfer.js/dist/plugin/wavesurfer.spectrogram.min.js');
const SpecTimeline = require('wavesurfer.js/dist/plugin/wavesurfer.timeline.min.js');
const Regions = require('wavesurfer.js/dist/plugin/wavesurfer.regions.min.js');
const colormap = require("colormap");
const $ = require('jquery');
const AudioBufferSlice = require('./js/AudioBufferSlice.js');

let modelReady = false;
let fileLoaded = false;
let currentFile;
let region;
let AUDACITY_LABELS;
let wavesurfer;
let WS_ZOOM = 0;

// set up some DOM element caches
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

let currentBuffer;
let bufferBegin = 0;
let windowLength = 10;  // seconds


async function loadAudioFile(filePath) {
    // Hide load hint and show spinnner
    if (wavesurfer) {
        wavesurfer.destroy();
        wavesurfer = undefined;
    }
    hideAll();
    disableMenuItem('analyze')
    showElement('loadFileHint');
    showElement('loadFileHintSpinner');
    showElement('loadFileHintLog');
    console.log('loadFileHintLog', 'Loading file...');
    // Reset the buffer playhead:
    bufferBegin = 0;
    // create an audio context object and load file into it
    const audioCtx = new AudioContext();
    let source = audioCtx.createBufferSource();
    fs.readFile(filePath, function (err, data) {
            if (err) {
                reject(err)
            } else {
                audioCtx.decodeAudioData(data.buffer).then(function (buffer) {
                    const myBuffer = buffer;
                    source.buffer = myBuffer;
                    const duration = source.buffer.duration;
                    const sampleRate = source.buffer.sampleRate;
                    const offlineCtx = new OfflineAudioContext(1, 48000 * duration, 48000);
                    const offlineSource = offlineCtx.createBufferSource();
                    offlineSource.buffer = buffer;
                    offlineSource.connect(offlineCtx.destination);
                    offlineSource.start();
                    offlineCtx.startRendering().then(function (resampled) {
                        currentBuffer = resampled;
                        console.log('Rendering completed successfully');
                        // `resampled` contains an AudioBuffer down-mixed to mono and resampled at 48000Hz.
                        // use resampled.getChannelData(x) to get an Float32Array for channel x.
                        loadBufferSegment(resampled, bufferBegin, bufferBegin + windowLength)
                    })
                }).catch(function (e) {
                    console.log("Error with decoding audio data" + e.err);
                })
            }
        }
    )
    //hideElement('loadFileHint');
    ipcRenderer.send('file-loaded', {message: filePath});
    fileLoaded = true;
    completeDiv.hide();
    $('#filename').text(filePath);
    // show the spec

    if (modelReady) enableMenuItem('analyze')
}

function loadBufferSegment(buffer, begin) {
    if (begin < 0) begin = 0;
    if (begin + windowLength > buffer.duration) begin = buffer.duration - windowLength;
    bufferBegin = begin;
    AudioBufferSlice(buffer, begin, begin + windowLength, function (error, slicedAudioBuffer) {
        if (error) {
            console.error(error);
        } else {
            if (!wavesurfer) {
                initSpec({
                    'audio': slicedAudioBuffer,
                    'backend': 'WebAudio',
                    'alpha': 0,
                    'context': null,
                    'spectrogram': true
                });
            } else {
                wavesurfer.clearRegions();
                updateSpec(slicedAudioBuffer)
            }
        }
    })
}

function updateSpec(buffer) {
    // Show spec and timecode containers
    wavesurfer.timeline.params.offset = -bufferBegin;
    wavesurfer.loadDecodedBuffer(buffer);
}

function initSpec(args) {
    // Show spec and timecode containers
    hideAll();
    showElement('dummy', false);
    showElement('timeline', false);
    showElement('waveform', false, false);
    showElement('spectrogram', false, false);
    if (wavesurfer !== undefined) wavesurfer.pause();
    // Setup waveform and spec views
    wavesurfer = WaveSurfer.create({
        //options
        container: '#waveform',
        //audioContext: args.context,
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
        height: 256,
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

    if (args.spectrogram) {
        wavesurfer.addPlugin(SpectrogramPlugin.create({
            wavesurfer: wavesurfer,
            container: "#spectrogram",
            scrollParent: true,
            labels: false,
            colorMap: colormap({
                colormap: 'inferno', nshades: 256, format: 'float'
            })
        })).initPlugin('spectrogram');
        wavesurfer.loadDecodedBuffer(args.audio);

    } else {
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

    wavesurfer.on('finish', function () {
        if (currentBuffer.duration > bufferBegin + windowLength) {
            loadBufferSegment(currentBuffer, bufferBegin += windowLength);
            wavesurfer.play()
        }
    })


    // Set initial zoom level
    //WS_ZOOM = $('#waveform').width() / wavesurfer.getDuration();

    // Resize canvas of spec and labels
    adjustSpecHeight(false);

    // Hide waveform
    //hideElement('waveform')
    // Show controls
    showElement('controlsWrapper');
    $('#OptionsDropdown').hide()
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
        filters: [{
            name: 'Audio Files',
            extensions: ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'mpga', 'mpeg']
        }],
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
    let start;
    let end;
    if (region.start) {
        start = region.start + bufferBegin;
        end = region.end + bufferBegin;
    }
    // Add current buffer's beginning offset to region start / end tags
    ipcRenderer.send('analyze', {message: 'go', start: start, end: end});
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

    // Waveform, timeline and spec
    hideElement('timeline');
    hideElement('waveform');
    hideElement('spectrogram');
    hideElement('dummy');

    // Controls
    hideElement('controlsWrapper');

    // Result table
    hideElement('resultTableContainer');

}


/////////////////////////  DO AFTER LOAD ////////////////////////////
window.onload = function () {

    // Set footer year
    $('#year').text(new Date().getFullYear());
    // Load model
    //loadModel()

};


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

$(document).on('click', '.play', function (e) {
        region.play()
})

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
    Escape: function () {
        console.log('Operation aborted');
        ipcRenderer.send('abort', {'abort': true})
    },
    Home: function () {
        if (currentBuffer) {
            loadBufferSegment(currentBuffer, 0)
            wavesurfer.seekAndCenter(0);
            wavesurfer.pause()
        }
    },
    End: function () {
        if (currentBuffer) {
            loadBufferSegment(currentBuffer, currentBuffer.duration - windowLength)
            wavesurfer.seekAndCenter(1);
            wavesurfer.pause()
        }
    },
    PageUp: function () {
        if (wavesurfer) {
            const position = wavesurfer.getCurrentTime() / windowLength;
            loadBufferSegment(currentBuffer, bufferBegin -= windowLength)
            wavesurfer.seekAndCenter(position);
            wavesurfer.pause()
        }
    },
    PageDown: function () {
        if (wavesurfer) {
            const position = wavesurfer.getCurrentTime() / windowLength;
            loadBufferSegment(currentBuffer, bufferBegin += windowLength)
            wavesurfer.seekAndCenter(position);
            wavesurfer.pause()
        }
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

        tr = "<tr  onmousedown='loadResultRegion(" + result.start + " , " + result.end + " )'><th scope='row'>" + index + "</th>";
        tr += "<td>" + result.timestamp + "</td>";
        tr += "<td>" + result.cname + "</td>";
        tr += "<td>" + result.sname + "</td>";
        tr += "<td>" + (parseFloat(result.score) * 100).toFixed(0) + "%" + "</td>";
        tr += "<td><span class='material-icons play' >play_circle_filled</span></td>";
        tr += "<td><span class='material-icons rotate' onclick='toggleAlternates(&quot;.subrow" + index + "&quot;)'>expand_more</span></td>";
        tr += "</tr>";

        tr += "<tr  class='subrow" + index + "'  onclick='loadResultRegion(" + result.start + " , " + result.end + " )'><th scope='row'> </th>";
        tr += "<td> </td>";
        tr += "<td>" + result.cname2 + "</td>";
        tr += "<td>" + result.sname2 + "</td>";
        tr += "<td>" + (parseFloat(result.score2) * 100).toFixed(0) + "%" + "</td>";
        tr += "<td> </td>";
        tr += "</tr>";

        tr += "<tr  class='subrow" + index + "'  onclick='loadResultRegion(" + result.start + " , " + result.end + " )' ><th scope='row'> </th>";
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

function loadResultRegion(start, end) {
    // Accepts global start and end timecodes from model detections
    // Need to find and centre a view of the detection in the spectrogram
    // 3 second detections
    bufferBegin = start - (windowLength / 2) + 1.5
    loadBufferSegment(currentBuffer, bufferBegin)
    createRegion(start - bufferBegin, end - bufferBegin)
}

function adjustSpecHeight(redraw) {
    //wavesurfer.spectrogram.render();
    specElement = $('spectrogram');
    specCanvasElement = $('spectrogram canvas')
    //$('#dummy, #waveform wave, spectrogram, #spectrogram canvas, #waveform canvas').each(function () {
    $.each([dummyElement, waveWaveElement, specElement, specCanvasElement, waveCanvasElement], function () {
        $(this).height(bodyElement.height() * 0.4)

        waveCanvasElement = $('#waveform canvas')
        let specWidth = 0;
        for (let i = 0; i < waveCanvasElement.length; i++) {
            specWidth += waveCanvasElement[i].width
        }
        specCanvasElement.width(specWidth);
        $('spectrogram').css('z-index', 0)
        resultTableElement.height(contentWrapperElement.height() - dummyElement.height() - controlsWrapperElement.height() - 47);
        console.log('specwidth  is ' + specWidth)
    })
    if (redraw && wavesurfer != null) {
        wavesurfer.drawBuffer();
    }
}