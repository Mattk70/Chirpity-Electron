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
const p = require('path');

let appPath = remote.app.getPath('userData');

let modelReady = false;
let fileLoaded = false;
let currentFile;
let region;
let AUDACITY_LABELS;
let wavesurfer;

// set up some DOM element caches
let bodyElement = $('body');
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

// Set default Options
let config;


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
    // Reset the buffer playhead and zoom:
    bufferBegin = 0;
    windowLength = 10;
    if (config.spectrogram) {
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
    } else {
        // remove the file hint stuff
        hideAll();
        // Show controls
        showElement('controlsWrapper');
        $('.specFeature').hide()
    }
    ipcRenderer.send('file-loaded', {message: filePath});
    fileLoaded = true;
    completeDiv.hide();
    const filename = filePath.replace(/^.*[\\\/]/, '')
    $('#filename').html('<span class="material-icons-two-tone">audio_file</span> ' + filename);
    // show the spec

    if (modelReady) enableMenuItem('analyze')
}

function loadBufferSegment(buffer, begin, end) {
    if (!end) end = windowLength;
    if (begin < 0) begin = 0;
    if (begin + end > buffer.duration) begin = Math.max(0, buffer.duration - end);
    bufferBegin = begin;
    AudioBufferSlice(buffer, begin, begin + end, function (error, slicedAudioBuffer) {
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

function updateSpec(buffer, upDown) {
    // Show spec and timecode containers
    //wavesurfer.timeline.params.offset = -bufferBegin;
    wavesurfer.loadDecodedBuffer(buffer);
    specCanvasElement.width('100%');
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
        container: '#waveform',
        backend: args.backend, // 'MediaElementWebAudio',
        // make waveform transparent
        backgroundColor: 'rgba(0,0,0,0)',
        waveColor: 'rgba(109,41,164,' + args.alpha + ')',
        progressColor: 'rgba(109,41,164,' + args.alpha + ')',
        // but keep the playhead
        cursorColor: '#fff',
        cursorWidth: 2,
        skipLength: 0.1,
        normalize: true,
        partialRender: true,
        scrollParent: true,
        responsive: true,
        height: 384,
        fftSamples: 1024,
        windowFunc: 'hamming',
        minPxPerSec: 10,
        hideScrollbar: false,
        plugins: [
            SpectrogramPlugin.create({
                wavesurfer: wavesurfer,
                container: "#spectrogram",
                scrollParent: true,
                labels: false,
                colorMap: colormap({
                    colormap: config.colormap, nshades: 256, format: 'float'
                }),
            }),
            Regions.create({
                dragSelection: {
                    slop: 5,

                },
                color: "rgba(255, 255, 255, 0.2)"
            })]
    })
    if (config.timeline) {
        wavesurfer.addPlugin(SpecTimeline.create({
            container: '#timeline',
            formatTimeCallback: formatTimeCallback,
            timeInterval: timeInterval,
            primaryLabelInterval: primaryLabelInterval,
            secondaryLabelInterval: secondaryLabelInterval,
            primaryColor: 'black',
            secondaryColor: 'grey',
            primaryFontColor: 'black',
            secondaryFontColor: 'grey'

        })).initPlugin('timeline');
    }
    wavesurfer.loadDecodedBuffer(args.audio);
    updateElementCache()
    $('.speccolor').removeClass('disabled');
    showElement(config.colormap + ' .tick', false);
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
        enableMenuItem('exportMP3');
    });

    wavesurfer.on('finish', function () {
        if (currentBuffer.duration > bufferBegin + windowLength) {
            bufferBegin += windowLength;
            loadBufferSegment(currentBuffer, bufferBegin);
            wavesurfer.play()
        }
    })
    // Show controls
    showElement('controlsWrapper');

    // Resize canvas of spec and labels
    adjustSpecDims(false);
}

function updateElementCache() {
    // Update element caches
    dummyElement = $('#dummy');
    waveElement = $('#waveform')

    specElement = $('spectrogram')
    specCanvasElement = $('#spectrogram canvas')
    waveCanvasElement = $('#waveform canvas')
    waveWaveElement = $('#waveform wave')
    specWaveElement = $('#spectrogram wave')
}

function zoomSpecIn() {
    if (windowLength < 2) return;
    windowLength /= 2;
    if (windowLength < 2) {
        wavesurfer.params.fftSamples = 512
        wavesurfer.spectrogram.render()
    } else if (wavesurfer.params.fftSamples !== 1024) {
        wavesurfer.params.fftSamples = 1024
        wavesurfer.spectrogram.render()
    }
    loadBufferSegment(currentBuffer, bufferBegin);
    //WS_ZOOM += 50;
    //wavesurfer.zoom(WS_ZOOM);
    adjustSpecDims(true)
    //wavesurfer.spectrogram.render()
}

function zoomSpecOut() {
    if (windowLength > 100) return;
    windowLength *= 2;
    loadBufferSegment(currentBuffer, bufferBegin);
    //WS_ZOOM -= 50;
    //wavesurfer.zoom(WS_ZOOM);
    adjustSpecDims(true)
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

let progressDiv = $('.progressDiv');

let progressBar = $('.progress .progress-bar');


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

function adjustSpecDims(redraw) {
    $.each([dummyElement, waveWaveElement, specElement, specCanvasElement, waveCanvasElement], function () {
        $(this).height(bodyElement.height() * 0.4)
    })
    if (loadSpectrogram) {
        specElement.css('z-index', 0)
        resultTableElement.height(contentWrapperElement.height()
            - dummyElement.height()
            - controlsWrapperElement.height()
            - $('#timeline').height()
            - 65);
        if (redraw && wavesurfer != null) {
            wavesurfer.drawBuffer();
        }
        specCanvasElement.width('100%');
    } else {
        resultTableElement.height(contentWrapperElement.height()
            - controlsWrapperElement.height()

            - 98);
    }
}

// Fix table head
function tableFixHead(e) {
    const el = e.target,
        sT = el.scrollTop;
    el.querySelectorAll("thead th").forEach(th =>
        th.style.transform = `translateY(${sT}px)`
    );
}

document.querySelectorAll(".tableFixHead").forEach(el =>
    el.addEventListener("scroll", tableFixHead)
);


///////////////////////// Timeline Callbacks /////////////////////////

/**
 * Use formatTimeCallback to style the notch labels as you wish, such
 * as with more detail as the number of pixels per second increases.
 *
 * Here we format as M:SS.frac, with M suppressed for times < 1 minute,
 * and frac having 0, 1, or 2 digits as the zoom increases.
 *
 * Note that if you override the default function, you'll almost
 * certainly want to override timeInterval, primaryLabelInterval and/or
 * secondaryLabelInterval so they all work together.
 *
 * @param: seconds
 * @param: pxPerSec
 */
function formatTimeCallback(seconds, pxPerSec) {
    seconds = Number(seconds);
    seconds += Math.floor(bufferBegin);
    let minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    let timeStr;
    seconds = seconds % 60;

    // fill up seconds with zeroes
    let secondsStr;
    if (windowLength >= 5) {
        secondsStr = Math.round(seconds).toString();
    } else {
        secondsStr = seconds.toFixed(1).toString();
    }
    if (minutes > 0) {
        if (seconds < 10) {
            secondsStr = '0' + secondsStr;
        }
    } else {
        return secondsStr;
    }
    minutes = minutes % 60;
    let minutesStr = Math.round(minutes).toString();
    if (hours > 0) {
        if (minutes < 10) {
            minutesStr = '0' + minutesStr;
        }
    } else {
        return `${minutes}:${secondsStr}`
    }
    return `${hours}:${minutesStr}:${secondsStr}`
}

/**
 * Use timeInterval to set the period between notches, in seconds,
 * adding notches as the number of pixels per second increases.
 *
 * Note that if you override the default function, you'll almost
 * certainly want to override formatTimeCallback, primaryLabelInterval
 * and/or secondaryLabelInterval so they all work together.
 *
 * @param: pxPerSec
 */
function timeInterval(pxPerSec) {
    var retval = 1;
    if (pxPerSec >= 25 * 100) {
        retval = 0.01;
    } else if (pxPerSec >= 25 * 40) {
        retval = 0.025;
    } else if (pxPerSec >= 25 * 10) {
        retval = 0.1;
    } else if (pxPerSec >= 25 * 4) {
        retval = 0.25;
    } else if (pxPerSec >= 25) {
        retval = 1;
    } else if (pxPerSec * 5 >= 25) {
        retval = 5;
    } else if (pxPerSec * 15 >= 25) {
        retval = 15;
    } else {
        retval = Math.ceil(0.5 / pxPerSec) * 60;
    }
    return retval;
}

/**
 * Return the cadence of notches that get labels in the primary color.
 * EG, return 2 if every 2nd notch should be labeled,
 * return 10 if every 10th notch should be labeled, etc.
 *
 * Note that if you override the default function, you'll almost
 * certainly want to override formatTimeCallback, primaryLabelInterval
 * and/or secondaryLabelInterval so they all work together.
 *
 * @param pxPerSec
 */
function primaryLabelInterval(pxPerSec) {
    var retval = 1;
    if (pxPerSec >= 25 * 100) {
        retval = 10;
    } else if (pxPerSec >= 25 * 40) {
        retval = 4;
    } else if (pxPerSec >= 25 * 10) {
        retval = 10;
    } else if (pxPerSec >= 25 * 4) {
        retval = 4;
    } else if (pxPerSec >= 25) {
        retval = 1;
    } else if (pxPerSec * 5 >= 25) {
        retval = 5;
    } else if (pxPerSec * 15 >= 25) {
        retval = 15;
    } else {
        retval = Math.ceil(0.5 / pxPerSec) * 60;
    }
    return retval;
}

/**
 * Return the cadence of notches to get labels in the secondary color.
 * EG, return 2 if every 2nd notch should be labeled,
 * return 10 if every 10th notch should be labeled, etc.
 *
 * Secondary labels are drawn after primary labels, so if
 * you want to have labels every 10 seconds and another color labels
 * every 60 seconds, the 60 second labels should be the secondaries.
 *
 * Note that if you override the default function, you'll almost
 * certainly want to override formatTimeCallback, primaryLabelInterval
 * and/or secondaryLabelInterval so they all work together.
 *
 * @param pxPerSec
 */
function secondaryLabelInterval(pxPerSec) {
    // draw one every 10s as an example
    return Math.floor(10 / timeInterval(pxPerSec));
}

////////// Store preferences //////////

function updatePrefs() {
    try {
        fs.writeFileSync(p.join(appPath, 'config.json'), JSON.stringify(config))
    } catch (e) {
        console.log(e)
    }
}

/////////////////////////  Window Handlers ////////////////////////////

window.onload = function () {
    try {

        config = JSON.parse(fs.readFileSync(p.join(appPath, 'config.json')))
        if (!config.UUID) {
            const {v4: uuidv4} = require('uuid');
            config.UUID = uuidv4()
            updatePrefs()
        }
    } catch {
        // If file read error, use defaults
        config = {'spectrogram': true, 'colormap': 'inferno', 'timeline': true}
        const {v4: uuidv4} = require('uuid');
        config.UUID = uuidv4()
        updatePrefs()
    }
    // Set menu option state
    if (!config.spectrogram) {
        $('#loadSpectrogram .tick').hide()

    }
    if (!config.timeline) {
        $('#loadTimeline .tick').hide()
    }
    showElement(config.colormap + 'span', true)

    // Set footer year
    $('#year').text(new Date().getFullYear());
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
    adjustSpecDims(true);
}

$(document).on('click', '.play', function (e) {
    region.play()
})


document.addEventListener('DOMContentLoaded', function () {
    document.addEventListener('keydown', function (e) {
        let action = e.code;
        if (action in GLOBAL_ACTIONS) {
            e.preventDefault();
            if (document == e.target || document.body == e.target || e.target.attributes["data-action"]) {

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

///////////// Nav bar Option handlers //////////////

$(document).on('click', '#loadSpectrogram', function (e) {
    if (config.spectrogram) {
        config.spectrogram = false;
        $('#loadSpectrogram .tick').hide()
        $('.specFeature').hide()
        hideElement('dummy');
        hideElement('timeline');
        hideElement('waveform');
        hideElement('spectrogram');
        $('.speccolor .timeline').addClass('disabled');
        //adjustSpecHeight(true);
        updatePrefs();
    } else {
        config.spectrogram = true;
        $('#loadSpectrogram .tick').show()
        $('.specFeature').show()
        if (wavesurfer && wavesurfer.isReady) {
            $('.speccolor .timeline').removeClass('disabled');
            showElement('dummy', false);
            showElement('timeline', false);
            showElement('waveform', false, false);
            showElement('spectrogram', false, false);
        } else {
            loadAudioFile(currentFile);
        }
        updatePrefs();
    }
})

$(document).on('click', '.speccolor', function (e) {
    wavesurfer.destroyPlugin('spectrogram');
    config.colormap = e.target.id;
    wavesurfer.addPlugin(SpectrogramPlugin.create({
        wavesurfer: wavesurfer,
        container: "#spectrogram",
        scrollParent: true,
        labels: false,
        colorMap: colormap({
            colormap: config.colormap, nshades: 256, format: 'float'
        })
    })).initPlugin('spectrogram');
    // set tick
    $('.speccolor .tick').addClass('d-none');
    $(this).children('span').removeClass('d-none');
    // refresh caches
    updateElementCache()
    adjustSpecHeight(true)
    updatePrefs();
})


$(document).on('click', '.timeline', function (e) {
    if (wavesurfer.timeline && wavesurfer.timeline.wrapper !== null) {
        wavesurfer.destroyPlugin('timeline');
        $('#loadTimeline .tick').hide()
        config.timeline = false;
        updatePrefs();
    } else {
        config.timeline = true;
        wavesurfer.addPlugin(SpecTimeline.create({
            wavesurfer: wavesurfer,
            container: "#timeline",
            formatTimeCallback: formatTimeCallback,
            timeInterval: timeInterval,
            primaryLabelInterval: primaryLabelInterval,
            secondaryLabelInterval: secondaryLabelInterval,
            primaryColor: 'black',
            secondaryColor: 'grey',
            primaryFontColor: 'black',
            secondaryFontColor: 'grey'
        })).initPlugin('timeline');
        $('#loadTimeline .tick').show()
        // refresh caches
        updateElementCache()
        adjustSpecHeight(true)
        updatePrefs();
    }
})

/////////// Keyboard Shortcuts  ////////////

const GLOBAL_ACTIONS = { // eslint-disable-line
    Space: function () {
        wavesurfer.playPause();
    },
    KeyO: function () {
        showOpenDialog();
    },
    KeyS: function () {
        if (AUDACITY_LABELS.length > 0) {
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
    ArrowLeft: function (e) {
        if (wavesurfer) {
            wavesurfer.skipBackward(0.1);
            const position = wavesurfer.getCurrentTime();
            if (position < 0.1 && bufferBegin > 0) {
                loadBufferSegment(currentBuffer, bufferBegin -= 0.1)
                wavesurfer.seekAndCenter(0);
                wavesurfer.pause()
            }
        }
    },
    ArrowRight: function (e) {
        if (wavesurfer) {
            wavesurfer.skipForward(0.1);
            const position = wavesurfer.getCurrentTime();
            if (position > windowLength - 0.1) {
                loadBufferSegment(currentBuffer, bufferBegin += 0.1)
                wavesurfer.seekAndCenter(1);
                wavesurfer.pause()
            }
        }
    },
    KeyP: function () {
        (typeof region !== 'undefined') ? region.play() : console.log('Region undefined')
    }
};


// Electron Message handling

ipcRenderer.on('model-ready', async (event, arg) => {
    modelReady = true;
    if (fileLoaded) {
        enableMenuItem('analyze')
    }
})

ipcRenderer.on('worker-loaded', async (event, arg) => {
    if (!loadSpectrogram) {
        console.log('UI received worker-loaded: ' + arg.message)
        enableMenuItem('analyze')
        hideAll();
        showElement('controlsWrapper');
        hideElement('transport-controls');
        const filename = arg.message.replace(/^.*[\\\/]/, '')
        $('#filename').html('<span class="material-icons">description</span> ' + filename);
    }
})

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
        tr = "<tr><td>" + result + "</td></tr>";
    } else {
        const regex = /:/g;
        const start = result.start, end = result.end;
        const filename = result.cname + ' ' + result.timestamp.replace(regex, '.') + '.mp3'
        tr = "<tr  onmousedown='loadResultRegion(" + start + " , " + end + " )' class='border-top border-secondary'><th scope='row'>" + index + "</th>";
        tr += "<td><span class='material-icons rotate text-right' onclick='toggleAlternates(&quot;.subrow" + index + "&quot;)'>expand_more</span></td>";
        tr += "<td>" + result.timestamp + "</td>";
        tr += "<td>" + result.cname + "</td>";
        tr += "<td><i>" + result.sname + "</i></td>";
        tr += "<td class='text-center'>" + iconizeScore(result.score) + "</td>";
        tr += "<td class='specFeature text-center'><span class='material-icons-two-tone play'>play_circle_filled</span></td>";

        tr += `<td class='specFeature text-center'><span id='download' class='material-icons-outlined ' 
            onclick="sendSaveFile(${start} , ${end}, '${filename}', 
             '${result.cname}', '${result.sname}', '${result.score}',
             '${result.cname2}', '${result.sname2}','${result.score2}',
             '${result.cname3}', '${result.sname3}', '${result.score3}')">
            file_download</span></td>`;
        tr += "<td class='text-center'> <span class='material-icons-two-tone text-success'>thumb_up</span> <span class='material-icons-two-tone text-danger'>thumb_down</span></td>";
        tr += "</tr>";

        tr += "<tr  class='subrow" + index + "'  onclick='loadResultRegion(" + start + " , " + end + " )'><th scope='row'> </th>";
        tr += "<td> </td>";
        tr += "<td> </td>";
        tr += "<td>" + result.cname2 + "</td>";
        tr += "<td><i>" + result.sname2 + "</i></td>";
        tr += "<td class='text-center'>" + iconizeScore(result.score2) + "</td>";
        tr += "<td> </td>";
        tr += "<td> </td>";
        tr += "</tr>";

        tr += "<tr  class='subrow" + index + "'  onclick='loadResultRegion(" + start + " , " + end + " )' ><th scope='row'> </th>";
        tr += "<td> </td>";
        tr += "<td> </td>";
        tr += "<td>" + result.cname3 + "</td>";
        tr += "<td><i>" + result.sname3 + "</i></td>";
        tr += "<td class='text-center'>" + iconizeScore(result.score3) + "</td>";
        tr += "<td> </td>";
        tr += "<td> </td>";
        tr += "</tr>";

    }
    $('#resultTableBody').append(tr);
    if (!config.spectrogram) $('.specFeature').hide();
    $(".material-icons").click(function () {
        $(this).toggleClass("down");
    })
});

function sendSaveFile(start, end, filename, cname, sname, score, cname2, sname2, score2, cname3, sname3, score3) {
    if (!start && start !== 0) {
        if (!wavesurfer.regions.list === {}) {
            start = 0;
            end = currentBuffer.duration;
        } else {
            start = region.start + bufferBegin;
            end = region.end + bufferBegin;
        }
        filename = 'export.mp3'
    }

    let metadata;
    if (cname) {
        metadata = {
            'UUID': config.UUID,
            'start': start,
            'end': end,
            'filename': filename,
            'cname': cname,
            'sname': sname,
            'score': score,
            'cname2': cname2,
            'sname2': sname2,
            'score2': score2,
            'cname3': cname3,
            'sname3': sname3,
            'score3': score3
        };
    }
    ipcRenderer.send('save', {'start': start, 'end': end, 'filepath': filename, 'metadata': metadata})
}

// create a dict mapping score to icon
const iconDict = {
    'low': '<span class="material-icons text-danger border border-secondary rounded" title="--%">signal_cellular_alt_1_bar</span>',
    'medium': '<span class="material-icons text-warning border border-secondary rounded" title="--%">signal_cellular_alt_2_bar</span>',
    'high': '<span class="material-icons text-success border border-secondary rounded" title="--%">signal_cellular_alt</span>',
}

function iconizeScore(score) {
    const tooltip = (parseFloat(score) * 100).toFixed(0).toString()
    if (parseFloat(score) < 0.65) return iconDict['low'].replace('--', tooltip)
    else if (parseFloat(score) < 0.85) return iconDict['medium'].replace('--', tooltip)
    else return iconDict['high'].replace('--', tooltip)
}