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
let modelReady = false, fileLoaded = false, currentFile, fileList, resultHistory = {};
let region, AUDACITY_LABELS, wavesurfer, summary = {};
let fileStart, startTime, ctime;

// set up some DOM element caches
let bodyElement = $('body');
let dummyElement, specElement, waveElement, specCanvasElement, specWaveElement;
let waveCanvasElement, waveWaveElement, resultTableElement = $('#resultTableContainer');
let contentWrapperElement = $('#contentWrapper');
let controlsWrapperElement = $('#controlsWrapper');
let completeDiv = $('.complete');
const resultTable = $('#resultTableBody')

let currentBuffer, bufferBegin = 0, windowLength = 20;  // seconds

// Set default Options
let config;
const sampleRate = 48000;
let controller = new AbortController();
let signal = controller.signal;

const audioCtx = new AudioContext({latencyHint: 'interactive', sampleRate: sampleRate});
const fetchAudioFile = (filePath, cb) =>
    fetch(filePath, {signal})
        .then((res => res.arrayBuffer()))
        .then((arrayBuffer) => audioCtx.decodeAudioData(arrayBuffer))
        .then((buffer) => {
            let source = audioCtx.createBufferSource();
            source.buffer = buffer;
            const duration = source.buffer.duration;

            // set fileStart time
            if (config.timeOfDay) {
                fileStart = new Date(ctime - (duration * 1000))
            } else {
                fileStart = new Date();
                fileStart.setHours(0, 0, 0, 0)
            }

            const offlineCtx = new OfflineAudioContext(1, sampleRate * duration, sampleRate);
            const offlineSource = offlineCtx.createBufferSource();
            offlineSource.buffer = buffer;
            offlineSource.connect(offlineCtx.destination);
            offlineSource.start();
            offlineCtx.startRendering().then(function (resampled) {
                console.log('Rendering completed successfully');
                // `resampled` contains an AudioBuffer resampled at 48000Hz.
                // use resampled.getChannelData(x) to get an Float32Array for channel x.
                currentBuffer = resampled;
                loadBufferSegment(resampled, bufferBegin)
            })
        })
        .catch(function (e) {
            console.log("Error with decoding audio data " + e.message);
            if (e.name === "AbortError") {
                // We know it's been canceled!
                console.warn('Fetch aborted sending massage to worker')
                hideAll();
                disableMenuItem('analyze')
                disableMenuItem('analyzeSelection');
                showElement('loadFileHint');
                showElement('loadFileHintText', false);
            }
        })
        .then(cb)


async function loadAudioFile(filePath) {
    ipcRenderer.send('file-loaded', {message: filePath});
    summary = {};
    // Hide load hint and show spinnner
    if (wavesurfer) {
        wavesurfer.destroy();
        wavesurfer = undefined;
    }
    // set file creation time
    ctime = fs.statSync(filePath).ctime


    hideAll();
    disableMenuItem('analyze')
    showElement('loadFileHint');
    showElement('loadFileHintSpinner');
    showElement('loadFileHintLog');
    console.log('loadFileHintLog', 'Loading file...');
    // Reset the buffer playhead and zoom:
    bufferBegin = 0;
    windowLength = 20;
    if (config.spectrogram) {
        controller = new AbortController();
        signal = controller.signal;
        await fetchAudioFile(filePath, console.log('finished'))
    } else {
        // remove the file hint stuff
        hideAll();
        // Show controls
        showElement('controlsWrapper');
        $('.specFeature').hide()
    }
    fileLoaded = true;
    completeDiv.hide();
    const filename = filePath.replace(/^.*[\\\/]/, '')
    let filenameElement = document.getElementById('filename');
    filenameElement.innerHTML = '';

    //
    let count = 0
    let appendstr = '<div id="fileContainer" class="bg-dark pr-3">';
    fileList.forEach(item => {
        if (count === 0) {
            if (fileList.length > 1) {
                appendstr += '<span class="revealFiles visible pointer" id="filename_' + count + '">'
                appendstr += '<span class="material-icons-two-tone pointer">library_music</span>'
            } else {
                appendstr += '<span class="material-icons-two-tone">audio_file</span>'
            }
        } else {
            appendstr += '<span class="openFiles pointer" id="filename_' + count + '"><span class="material-icons-two-tone">audio_file</span>'
        }
        appendstr += item.replace(/^.*[\\\/]/, "") + '<br></span>';
        count += 1;
    })
    filenameElement.innerHTML += appendstr + '</div>';

}

$(document).on("click", ".openFiles", function (e) {
    const openFiles = $('.openFiles')
    openFiles.removeClass('visible')
    this.classList.add('visible')
    if (openFiles.length > 1) this.firstChild.innerHTML = "library_music"
    this.classList.remove('openFiles')
    this.classList.add('revealFiles')
    e.stopImmediatePropagation()
});

$(document).on("click", ".revealFiles", function (e) {
    this.classList.remove('revealFiles')
    this.classList.add('openFiles')
    this.firstChild.innerHTML = "audio_file"
    const openFiles = $('.openFiles');
    openFiles.addClass('visible');
    e.stopImmediatePropagation()
});


function loadBufferSegment(buffer, begin, saveRegion) {
    if (begin < 0) begin = 0;
    if (begin + windowLength > buffer.duration) {
        begin = Math.max(0, buffer.duration - windowLength);
    }
    bufferBegin = begin;
    startTime = new Date(fileStart.getTime() + (bufferBegin * 1000))
    AudioBufferSlice(buffer, begin, begin + windowLength, function (error, slicedAudioBuffer) {
        if (error) {
            console.log(error);
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
                if (!saveRegion) {
                    wavesurfer.clearRegions();
                }
                updateSpec(slicedAudioBuffer)
            }
        }
    })
}

function updateSpec(buffer) {
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
        height: 1024,
        fftSamples: 1024,
        windowFunc: 'hamming',
        minPxPerSec: 10,
        hideScrollbar: true,
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
    waveElement.mousedown(function () {
        wavesurfer.clearRegions();
        disableMenuItem('analyzeSelection');
        enableMenuItem('analyze');
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
    updateElementCache()
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
    loadBufferSegment(currentBuffer, bufferBegin, true);
    //WS_ZOOM += 50;
    //wavesurfer.zoom(WS_ZOOM);
    adjustSpecDims(true)
    //wavesurfer.spectrogram.render()
}

function zoomSpecOut() {
    if (windowLength > 100) return;
    windowLength *= 2;
    loadBufferSegment(currentBuffer, bufferBegin, true);
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
        properties: ['openFile', 'multiSelections']
    });

    // Load First audio file
    if (fileDialog.filePaths.length > 0) {
        fileList = fileDialog.filePaths
        loadAudioFile(fileDialog.filePaths[0]);
        currentFile = fileDialog.filePaths[0];
    }
}


async function showSaveDialog() {
    // Show file dialog to save Audacity label file
    currentFile = currentFile.substr(0, currentFile.lastIndexOf(".")) + ".txt";
    await dialog.showSaveDialog({
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
    disableMenuItem('analyze')
    disableMenuItem('analyzeSelection');
    ipcRenderer.send('analyze', {confidence: config.minConfidence});
    analyzeLink.disabled = true;
});

const analyzeSelectionLink = document.getElementById('analyzeSelection');

analyzeSelectionLink.addEventListener('click', async () => {
    completeDiv.hide();
    disableMenuItem('analyze')
    disableMenuItem('analyzeSelection');
    let start;
    let end;
    if (region.start) {
        start = region.start + bufferBegin;
        end = region.end + bufferBegin;
    }
    // Add current buffer's beginning offset to region start / end tags
    ipcRenderer.send('analyze', {confidence: 0.1, start: start, end: end});
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
    $(row).toggle('slow');
    return false
}

function showElement(id, makeFlex = true, empty = false) {
    const thisElement = $('#' + id);
    thisElement.removeClass('d-none');
    if (makeFlex) thisElement.addClass('d-flex');
    if (empty) {
        thisElement.height(0);
        thisElement.empty()
    }
}

function hideElement(id) {
    const thisElement = $('#' + id);
    thisElement.removeClass('d-flex');
    thisElement.addClass('d-none');

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
        // Expand up to 512px
        $(this).height(Math.min(bodyElement.height() * 0.4, 512))
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


function formatTimeCallback(secs) {
    secs = Number(secs);
    const now = new Date(startTime.getTime() + (secs * 1000))
    const milliSeconds = now.getMilliseconds();
    const seconds = now.getSeconds();
    const minutes = now.getMinutes();
    const hours = now.getHours();

    // fill up seconds with zeroes
    let secondsStr;
    if (windowLength >= 5) {
        secondsStr = seconds.toString();
    } else {
        secondsStr = seconds.toString() + '.' + Math.round(milliSeconds / 100).toString();
    }
    if (minutes > 0 || config.timeOfDay) {
        if (seconds < 10) {
            secondsStr = '0' + secondsStr;
        }
    } else if (!config.timeOfDay) {
        return secondsStr;
    }
    let minutesStr = minutes.toString();
    if (config.timeOfDay || hours > 0) {
        if (minutes < 10) {
            minutesStr = '0' + minutesStr;
        }
    } else if (!config.timeOfDay) {
        return `${minutes}:${secondsStr}`
    }
    if (hours < 10 && config.timeOfDay) {
        let hoursStr = '0' + hours.toString();
        return `${hoursStr}:${minutesStr}:${secondsStr}`
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
    let retval;
    if (pxPerSec >= 25 * 100) {
        retval = 0.01;
    } else if (pxPerSec >= 25 * 40) {
        retval = 0.025;
    } else if (pxPerSec >= 25 * 10) {
        retval = 0.1;
    } else if (pxPerSec >= 25 * 4) {
        retval = 0.25;
    } else if (pxPerSec >= 25) {
        retval = 5;
    } else if (pxPerSec * 5 >= 25) {
        retval = 10;
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
    var retval;
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
    // draw one every 1s as an example
    return Math.floor(1 / timeInterval(pxPerSec));
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
        config = {
            'spectrogram': true,
            'colormap': 'inferno',
            'timeline': true,
            'minConfidence': 0.5,
            'timeOfDay': false
        }
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
    if (config.timeOfDay) {
        $('#timecode .tick').hide()
        $('#timeOfDay .tick').show()
    } else {
        $('#timecode .tick').show()
        $('#timeOfDay .tick').hide()
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
    updateElementCache();
    adjustSpecDims(true);
}

$(document).on('click', '.play', function () {
    region.play()
})


document.addEventListener('DOMContentLoaded', function () {

    document.addEventListener('keydown', function (e) {
        let action = e.code;
        if (action in GLOBAL_ACTIONS) {
            e.preventDefault();
            if (document === e.target || document.body === e.target || e.target.attributes["data-action"]) {

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

$(document).on('click', '#loadSpectrogram', function () {
    if (config.spectrogram) {
        config.spectrogram = false;
        $('#loadSpectrogram .tick').hide()
        $('.specFeature').hide()
        hideElement('dummy');
        hideElement('timeline');
        hideElement('waveform');
        hideElement('spectrogram');
        $('.speccolor .timeline').addClass('disabled');
        //adjustSpecDims(true);
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
    adjustSpecDims(true)
    updatePrefs();
})


$(document).on('click', '.timeline', function () {
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
        adjustSpecDims(true)
        updatePrefs();
    }
})

$(document).on('click', '#timeOfDay', function () {
    // set file creation time
    config.timeOfDay = true
    $('#timecode .tick').hide()
    $('#timeOfDay .tick').show()
    fileStart = ctime
    loadBufferSegment(currentBuffer, bufferBegin);
    updatePrefs();
})
$(document).on('click', '#timecode', function () {
    config.timeOfDay = false
    $('#timeOfDay .tick').hide()
    $('#timecode .tick').show()
    //start at zero
    fileStart = new Date();
    fileStart.setHours(0, 0, 0, 0);
    loadBufferSegment(currentBuffer, bufferBegin);
    updatePrefs();
})

/////////// Keyboard Shortcuts  ////////////

const GLOBAL_ACTIONS = { // eslint-disable-line
    Space: function () {
        wavesurfer.playPause();
    },
    KeyO: function (e) {
        if (e.ctrlKey) showOpenDialog();
    },
    KeyS: function () {
        if (AUDACITY_LABELS.length > 0) {
            if (e.ctrlKey) showSaveDialog();
        }
    },
    Escape: function () {
        controller.abort();
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
            bufferBegin -= windowLength
            // Set new date for timeline
            const playhead = bufferBegin + wavesurfer.getCurrentTime()
            loadBufferSegment(currentBuffer, bufferBegin)
            playhead <= 0 ? wavesurfer.seekAndCenter(0) : wavesurfer.seekAndCenter(position);
            wavesurfer.pause()
        }
    },
    PageDown: function () {
        if (wavesurfer) {
            const position = wavesurfer.getCurrentTime() / windowLength;
            bufferBegin += windowLength
            // Set new date for timeline
            const playhead = bufferBegin + wavesurfer.getCurrentTime()
            loadBufferSegment(currentBuffer, bufferBegin)
            playhead >= currentBuffer.duration ? wavesurfer.seekAndCenter(1) : wavesurfer.seekAndCenter(position);
            wavesurfer.pause()
        }
    },
    ArrowLeft: function () {
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
    ArrowRight: function () {
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


ipcRenderer.on('model-ready', async () => {
    modelReady = true;
})

ipcRenderer.on('worker-loaded', async (event, arg) => {
    console.log('UI received worker-loaded: ' + arg.message)
    enableMenuItem('analyze')
    if (!loadSpectrogram) {
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
    if (AUDACITY_LABELS.length > 0) {
        enableMenuItem('saveLabels');
        $('.download').removeClass('disabled');
    } else {
        disableMenuItem('saveLabels');
    }
    // Save the results for this file to the history
    resultHistory[currentFile] = resultTable[0].innerHTML
    console.table(summary);

});

ipcRenderer.on('prediction-ongoing', async (event, arg) => {
    completeDiv.hide();
    const result = arg.result;
    const index = arg.index;
    if (index === 1) {
        // Remove old results
        resultTable.empty()

    }
    let tr;
    showElement('resultTableContainer');
    if (result === "No detections found.") {
        tr = "<tr><td>" + result + "</td></tr>";
    } else {
        if (result.cname in summary) {
            summary[result.cname] += 1
        } else {
            summary[result.cname] = 1
        }

        const regex = /:/g;
        const start = result.start, end = result.end;
        const filename = result.cname.replace(/'/g, "\\'") + ' ' + result.timestamp.replace(regex, '.') + '.mp3';
        tr = "<tr  onmousedown='loadResultRegion(" + start + " , " + end + " )' class='border-top border-secondary top-row'><th scope='row'>" + index + "</th>";
        tr += "<td><span class='material-icons rotate text-right pointer' onclick='toggleAlternates(&quot;.subrow" + index + "&quot;)'>expand_more</span></td>";
        tr += "<td>" + result.timestamp + "</td>";
        tr += "<td>" + result.cname + "</td>";
        tr += "<td><i>" + result.sname + "</i></td>";
        tr += "<td class='text-center'>" + iconizeScore(result.score) + "</td>";
        tr += "<td class='specFeature text-center'><span class='material-icons-two-tone play pointer'>play_circle_filled</span></td>";
        tr += `<td class='specFeature text-center'><a href='https://xeno-canto.org/explore?query=${result.sname}%20type:nocturnal' target="_blank"><img src='img/logo/XC.png' alt='Search on Xeno Canto'></a></td>`

        tr += `<td class='specFeature text-center'><span class='material-icons-outlined pointer disabled download' 
            onclick="sendFile(${start} , ${end}, '${filename}', 
             '${result.cname.replace(/'/g, "\\'")}', '${result.sname}', '${result.score}',
             '${result.cname2.replace(/'/g, "\\'")}', '${result.sname2}','${result.score2}',
             '${result.cname3.replace(/'/g, "\\'")}', '${result.sname3}', '${result.score3}',
             'save')">
            file_download</span></td>`;
        tr += `<td class='text-center'> <span class='material-icons-two-tone text-success pointer' 
            onclick="if (confirm('Submit this correct prediction?')) sendFile(${start} , ${end}, '${filename}', 
             '${result.cname.replace(/'/g, "\\'")}', '${result.sname}', '${result.score}',
             '${result.cname2.replace(/'/g, "\\'")}', '${result.sname2}','${result.score2}',
             '${result.cname3.replace(/'/g, "\\'")}', '${result.sname3}', '${result.score3}',
             'correct')">thumb_up_alt</span> <span class='material-icons-two-tone text-danger pointer'
             onclick="if (confirm('Submit this prediction as incorrect?')) sendFile(${start} , ${end}, '${filename}', 
             '${result.cname.replace(/'/g, "\\'")}', '${result.sname}', '${result.score}',
             '${result.cname2.replace(/'/g, "\\'")}', '${result.sname2}','${result.score2}',
             '${result.cname3.replace(/'/g, "\\'")}', '${result.sname3}', '${result.score3}',
             'incorrect')">thumb_down_alt</span></td>`;
        tr += "</tr>";

        tr += "<tr class='subrow" + index + "'  onclick='loadResultRegion(" + start + " , " + end + " )'><th scope='row'> </th>";
        tr += "<td> </td>";
        tr += "<td> </td>";
        tr += "<td>" + result.cname2 + "</td>";
        tr += "<td><i>" + result.sname2 + "</i></td>";
        tr += "<td class='text-center'>" + iconizeScore(result.score2) + "</td>";
        tr += "<td> </td>";
        tr += "<td> </td>";
        tr += "</tr>";

        tr += "<tr class='subrow" + index + "'  onclick='loadResultRegion(" + start + " , " + end + " )' ><th scope='row'> </th>";
        tr += "<td> </td>";
        tr += "<td> </td>";
        tr += "<td>" + result.cname3 + "</td>";
        tr += "<td><i>" + result.sname3 + "</i></td>";
        tr += "<td class='text-center'>" + iconizeScore(result.score3) + "</td>";
        tr += "<td> </td>";
        tr += "<td> </td>";
        tr += "</tr>";
    }
    resultTable.append(tr);

    if (!config.spectrogram) $('.specFeature').hide();
    $(".material-icons").click(function () {
        $(this).toggleClass("down");
    })

    const toprow = $('.top-row')

    toprow.click(function () {
        toprow.each(function () {
            $(this).removeClass('table-active')
        })
        $(this).addClass("table-active");
    })
});

function sendFile(start, end, filename, cname, sname, score, cname2, sname2, score2, cname3, sname3, score3, action) {
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
    if (action === 'save') {
        ipcRenderer.send('save', {
            'start': start, 'end': end, 'filepath': filename, 'metadata': metadata
        })
    } else {
        if (!config.seenThanks) {
            alert('Thank you, your feedback helps improve Chirpity predictions');
            config.seenThanks = true;
            updatePrefs()
        }
        ipcRenderer.send('post', {
            'start': start, 'end': end, 'filepath': filename, 'metadata': metadata, 'action': action
        })
    }
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