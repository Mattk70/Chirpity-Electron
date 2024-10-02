import {trackVisit, trackEvent} from './tracking.js';

let seenTheDarkness = false, shownDaylightBanner = false, LOCATIONS, locationID = undefined, loadingTimeout;
const startTime = performance.now();
let LABELS = [], DELETE_HISTORY = [];
// Save console.warn and console.error functions
const originalWarn = console.warn;
const originalError = console.error;

function customURLEncode(str) {
    return encodeURIComponent(str)
      .replace(/[!'()*]/g, (c) => {
        // Replacing additional characters not handled by encodeURIComponent 
        return '%' + c.charCodeAt(0).toString(16).toUpperCase();
      })
      .replace(/%20/g, '+'); // Replace space with '+' instead of '%20'
  }

// Override console.warn to intercept and track warnings
console.warn = function(message) {
    // Call the original console.warn to maintain default behavior
    originalWarn.apply(console, arguments);
    
    // Track the warning message using your tracking function
    config.track && trackEvent(config.UUID, 'Warnings', arguments[0], customURLEncode(arguments[1]));
};

// Override console.error to intercept and track errors
console.error = function(message) {
    // Call the original console.error to maintain default behavior
    originalError.apply(console, arguments);
    
    // Track the error message using your tracking function
    config.track && trackEvent(config.UUID, 'Errors', arguments[0], customURLEncode(arguments[1]));
};


window.addEventListener('unhandledrejection', function(event) {
    // Extract the error message and stack trace from the event
    const errorMessage = event.reason.message;
    const stackTrace = event.reason.stack;
    
    // Track the unhandled promise rejection
    config.track && trackEvent(config.UUID, 'Unhandled UI Promise Rejection', errorMessage, customURLEncode(stackTrace));
});

window.addEventListener('rejectionhandled', function(event) {
    // Extract the error message and stack trace from the event
    const errorMessage = event.reason.message;
    const stackTrace = event.reason.stack;
    
    // Track the unhandled promise rejection
    config.track && trackEvent(config.UUID, 'Handled UI Promise Rejection', errorMessage, customURLEncode(stackTrace));
});

const STATE = {
    mode: 'analyse',
    analysisDone: false,
    openFiles: [],
    chart: {
        aggregation: 'Week',
        species: undefined,
        range: { start: undefined, end: undefined },
    },
    explore: {
        species: undefined,
        range: { start: undefined, end: undefined }
    },
    sortOrder: 'timestamp',
    birdList: { lastSelectedSpecies: undefined }, // Used to put the last selected species at the top of the all-species list
    selection: { start: undefined, end: undefined }
}

// Batch size map for slider
const BATCH_SIZE_LIST = [4, 8, 16, 32, 48, 64, 96];

// Get the modules loaded in preload.js
const fs = window.module.fs;
const colormap = window.module.colormap;
const p = window.module.p;
const SunCalc = window.module.SunCalc;
const uuidv4 = window.module.uuidv4;
const os = window.module.os;

function hexToRgb(hex) {
    // Remove the '#' character if present
    hex = hex.replace(/^#/, '');

    // Parse the hex string into individual RGB components
    var r = parseInt(hex.substring(0, 2), 16);
    var g = parseInt(hex.substring(2, 4), 16);
    var b = parseInt(hex.substring(4, 6), 16);

    // Return the RGB components as an array
    return [r, g, b];
}
function createColormap(){
    const map = config.colormap === 'custom' ? [
        {index: 0, rgb: hexToRgb(config.customColormap.quiet)},
        {index: config.customColormap.threshold, rgb: hexToRgb(config.customColormap.mid)},
        {index: 1, rgb: hexToRgb(config.customColormap.loud)}
    ] : config.colormap;
    return colormap({ colormap: map, nshades:256, format: 'float' });
}


let worker;

/// Set up communication channel between UI and worker window
const establishMessageChannel =
new Promise((resolve) => {
    window.onmessage = (event) => {
        // event.source === window means the message is coming from the preload
        // script, as opposed to from an <iframe> or other source.
        if (event.source === window) {
            if (event.data === 'provide-worker-channel') {
                [worker] = event.ports;
                worker.postMessage({ action: 'create message port' });
                // Once we have the port, we can communicate directly with the worker
                // process.
                worker.onmessage = e => {
                    resolve(e.data);
                }
            }
        }
    }
}).then((value) => {
    console.log(value);
}, error => {
    console.log(error);
});


async function getPaths() {
    const appPath = await window.electron.getPath();
    const tempPath = await window.electron.getTemp();
    console.log('path is', appPath, 'temp is', tempPath);
    return [appPath, tempPath];
}

let VERSION;
let DIAGNOSTICS = {};

window.electron.getVersion()
.then((appVersion) => {
    VERSION = appVersion;
    console.log('App version:', appVersion);
    DIAGNOSTICS['Chirpity Version'] = VERSION;
})
.catch(error => {
    console.log('Error getting app version:', error)
});

let modelReady = false, fileLoaded = false, currentFile;
let PREDICTING = false, t0;
let region, AUDACITY_LABELS = {}, wavesurfer;
// fileList is all open files, analyseList is the subset that have been analysed;
let fileList = [], analyseList = [];
let fileStart, bufferStartTime, fileEnd;

let zero = new Date(Date.UTC(0, 0, 0, 0, 0, 0));
// set up some DOM element hamdles
const bodyElement = document.body;
let specElement, waveElement, specCanvasElement, specWaveElement;
let waveCanvasElement, waveWaveElement;
const DOM = {
    fromSlider: document.getElementById('fromSlider'),
    toSlider: document.getElementById('toSlider'),
    fromInput: document.getElementById('fromInput'),
    toInput: document.getElementById('toInput'),
     audioBitrate: document.getElementById('bitrate'),
     audioBitrateContainer: document.getElementById('bitrate-container'),
     audioDownmix: document.getElementById('downmix'),
     audioFade: document.getElementById('fade'),
     audioFiltersIcon: document.getElementById('audioFiltersIcon'),
     audioFormat: document.getElementById('format'),
     audioPadding: document.getElementById('padding'),
     audioQuality: document.getElementById('quality'),
     audioQualityContainer: document.getElementById('quality-container'),
     sendFilteredAudio: document.getElementById('send-filtered-audio-to-model'),
     audioNotification: document.getElementById('audio-notification'),
     batchSizeSlider: document.getElementById('batch-size'),
     batchSizeValue: document.getElementById('batch-size-value'),
     colourmap: document.getElementById('colourmap'),
     contentWrapperElement: document.getElementById('contentWrapper'),
     controlsWrapper: document.getElementById('controlsWrapper'),
     contextAware: document.getElementById('context'),
     contextAwareIcon: document.getElementById('context-mode'),
     debugMode: document.getElementById('debug-mode'),
     defaultLat: document.getElementById('latitude'),
     defaultLon: document.getElementById('longitude'),
     fileNumber: document.getElementById('fileNumber'),
     gain: document.getElementById('gain'),
     gainAdjustment: document.getElementById('gain-adjustment'),
     normalise: document.getElementById('normalise'),
     listToUse: document.getElementById('list-to-use'),
     listIcon: document.getElementById('list-icon'),
     speciesThresholdEl: document.getElementById('species-threshold-el'),
     speciesThreshold: document.getElementById('species-frequency-threshold'),
     customListFile: document.getElementById('custom-list-location'),
     customListSelector: document.getElementById('list-file-selector'),
     customListContainer: document.getElementById('choose-file-container'),
     localSwitch: document.getElementById('local'),
     localSwitchContainer: document.getElementById('use-location-container'),
     modelToUse: document.getElementById('model-to-use'),
     nocmig: document.getElementById('nocmig'),
     nocmigButton: document.getElementById('nocmigMode'),
     numberOfThreads: document.getElementById('threads-value'),
     progressDiv: document.getElementById('progressDiv'),
     progressBar: document.getElementById('progress-bar'),
     resultTableElement: document.getElementById('resultTableContainer'),
     spectrogramWrapper: document.getElementById('spectrogramWrapper'),
     spectrogram: document.getElementById('spectrogram'),
     specLabels: document.getElementById('spec-labels'),
     summaryTable: document.getElementById('summaryTable'),
     resultHeader: document.getElementById('resultsHead'),
     threadSlider: document.getElementById('thread-slider'),
     timelineSetting: document.getElementById('timelineSetting')
}
let activeRow;
let predictions = {},
clickedIndex, currentFileDuration;

let currentBuffer, bufferBegin = 0, windowLength = 20;  // seconds
// Set content container height
DOM.contentWrapperElement.style.height = (bodyElement.clientHeight - 80) + 'px';

// Mouse down event to start dragging
DOM.controlsWrapper.addEventListener('mousedown', (e) => {
    if (e.target.tagName !== 'DIV' ) return
    const startY = e.clientY;
    const initialHeight = DOM.spectrogram.offsetHeight;
    let debounceTimer;
    const onMouseMove = (e) => {
        clearTimeout(debounceTimer);
        // Calculate the delta y (drag distance)
        const newHeight = initialHeight + e.clientY - startY;
    
        // Adjust the spectrogram dimensions accordingly
        debounceTimer = setTimeout(() => {
            adjustSpecDims(true,  wavesurfer.spectrogram.fftSamples, newHeight);
        }, 5);
    }
    
    // Remove event listeners on mouseup
    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
    // Attach event listeners for mousemove and mouseup
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
});



// Set default Options
let config;
let sampleRate = 24_000;

/** Collect DIAGNOSTICS Information
DIAGNOSTICS keys:
GPUx - name of GPU(s)
backend: tensorflow backend in use
warmup: time to warm up model (seconds)
"Analysis Duration": time on detections (seconds)
"Audio Duration": length of audio (seconds)
"Chirpity Version": app version
"Model": model in use
"Tensorflow Backend"
Analysis Rate: x real time performance
*/
// Timers
let t0_warmup, t1_warmup, t0_analysis, t1_analysis;
DIAGNOSTICS['CPU'] = os.cpus()[0].model;
DIAGNOSTICS['Cores'] = os.cpus().length;
DIAGNOSTICS['System Memory'] = (os.totalmem() / (1024 ** 2 * 1000)).toFixed(0) + ' GB';

function resetResults({clearSummary = true, clearPagination = true, clearResults = true} = {}) {
    if (clearSummary) summaryTable.textContent = '';
    
    clearPagination && pagination.forEach(item => item.classList.add('d-none'));
    const resultTable = document.getElementById('resultTableBody');
    resultsBuffer = resultTable.cloneNode(false)
    if (clearResults) {
        resultTable.textContent = '';
        DOM.resultHeader.textContent = '';
    }
    predictions = {};
    seenTheDarkness = false;
    shownDaylightBanner = false;
    DOM.progressDiv.classList.add('d-none');
    updateProgress(0)
}

/***
*
* @param val: float between 0 and 100
*/
function updateProgress(val) {
    if (val) {
        DOM.progressBar.value = val;
        val = val.toString();
        DOM.progressBar.textContent = val + '%';
    }
    else {
        DOM.progressBar.removeAttribute('value');
    }
    
}

/**
* LoadAudiofile: Called when user opens a file (just opens first file in multiple files)
* and when clicking on filename in list of open files.
* 
* @param {*} filePath: full path to file
* @param {*} preserveResults: whether to clear results when opening file (i.e. don't clear results when clicking file in list of open files)
*  
*/
async function loadAudioFile({ filePath = '', preserveResults = false }) {
    fileLoaded = false; locationID = undefined;
    //if (!preserveResults) worker.postMessage({ action: 'change-mode', mode: 'analyse' })
    worker.postMessage({
        action: 'file-load-request',
        file: filePath,
        preserveResults: preserveResults,
        position: 0,
        list: config.list, // list and warmup are passed to enable abort if file loaderd during predictions
        warmup: config.warmup
    });
}


function updateSpec({ buffer, play = false, position = 0, resetSpec = false }) {
    showElement(['spectrogramWrapper'], false);
    wavesurfer.loadDecodedBuffer(buffer);
    wavesurfer.seekTo(position);
    play ? wavesurfer.play() : wavesurfer.pause();
    resetSpec && adjustSpecDims(true);
    showElement(['fullscreen']);
}

function createTimeline() {
    wavesurfer.addPlugin(WaveSurfer.timeline.create({
        container: '#timeline',
        formatTimeCallback: formatTimeCallback,
        timeInterval: timeInterval,
        primaryLabelInterval: primaryLabelInterval,
        secondaryLabelInterval: secondaryLabelInterval,
        primaryColor: 'white',
        secondaryColor: 'white',
        primaryFontColor: 'white',
        secondaryFontColor: 'white',
        fontSize: 14
    })).initPlugin('timeline');
}

const resetRegions = () => {
    if (wavesurfer) wavesurfer.clearRegions();
    region = undefined;
    const orphanedRegions = document.querySelectorAll('wave>region');
    // Sometimes, there is a region that is not attached the the wavesurfer regions list
    orphanedRegions?.length && orphanedRegions.forEach(region => region.remove());
    disableMenuItem(['analyseSelection', 'export-audio']);
    if (fileLoaded) enableMenuItem(['analyse']);
}

function clearActive() {
    resetRegions();
    STATE.selection = false;
    worker.postMessage({ action: 'update-state', selection: false })
    activeRow?.classList.remove('table-active');
    activeRow = undefined;
}

const initWavesurfer = ({
    audio = undefined,
    height = 0
}) => {
    
    if (wavesurfer) {
        wavesurfer.pause();
    }
    const audioCtx = new AudioContext({ latencyHint: 'interactive', sampleRate: sampleRate });
    // Setup waveform and spec views
    wavesurfer = WaveSurfer.create({
        container: document.querySelector('#waveform'),
        audioContext: audioCtx,
        backend: 'WebAudio',
        // make waveform transparent
        backgroundColor: 'rgba(0,0,0,0)',
        waveColor: 'rgba(109,41,164,0)',
        progressColor: 'rgba(109,41,16,0)',
        // but keep the playhead
        cursorColor: config.colormap === 'custom' ? config.customColormap.loud : '#fff',
        cursorWidth: 2,
        skipLength: 0.1,
        partialRender: true,
        scrollParent: false,
        fillParent: true,
        responsive: true,
        height: height,
    });
    wavesurfer.bufferRequested = false;
    initRegion();
    initSpectrogram();
    createTimeline();
    if (audio) wavesurfer.loadDecodedBuffer(audio);
    DOM.colourmap.value = config.colormap;
    // Set click event that removes all regions
    

    // Enable analyse selection when region created
    wavesurfer.on('region-created', function (e) {
        region = e;
        enableMenuItem(['export-audio']);
        if (modelReady && !PREDICTING) {
            enableMenuItem(['analyseSelection']);
        }
    });
    // Clear label on modifying region
    wavesurfer.on('region-updated', function (e) {
        region = e;
        region.attributes.label = '';
    });
    
    // Queue up next audio window while playing
    wavesurfer.on('audioprocess', function () {
        
        const currentTime = wavesurfer.getCurrentTime();
        const duration = wavesurfer.getDuration();
        const playedPart = currentTime / duration;
        
        if (playedPart > 0.5) {
            
            if (!wavesurfer.bufferRequested && currentFileDuration > bufferBegin + windowLength) {
                const begin = bufferBegin + windowLength;
                postBufferUpdate({ begin: begin, play: false, queued: true })
                wavesurfer.bufferRequested = true;
            }
        }
    });
    wavesurfer.on('finish', function () {
        if (currentFileDuration > bufferBegin + windowLength) {
            wavesurfer.stop()
            if (NEXT_BUFFER) {
                onWorkerLoadedAudio(NEXT_BUFFER)
            } else {
                postBufferUpdate({ begin: bufferBegin, play: true })
            }
            bufferBegin += windowLength;
        }
    });
    
    // Show controls
    showElement(['controlsWrapper']);
    updateElementCache();
    // Resize canvas of spec and labels
    adjustSpecDims(false);
    // remove the tooltip
    const oldTip = document.getElementById('tooltip')
    oldTip && oldTip.parentNode.removeChild(oldTip);

    const tooltip = document.createElement('div');
    tooltip.id = 'tooltip';
    document.body.appendChild(tooltip);
    // Add event listener for the gesture events
    waveElement.removeEventListener('wheel', handleGesture);
    waveElement.addEventListener('wheel', handleGesture, false);

    waveElement.removeEventListener('mousedown', resetRegions);
    waveElement.removeEventListener('mousemove', specTooltip);
    waveElement.removeEventListener('mouseout', hideTooltip)

    waveElement.addEventListener('mousemove', specTooltip); 
    waveElement.addEventListener('mousedown', resetRegions);
    waveElement.addEventListener('mouseout', hideTooltip);
}

function updateElementCache() {
    t0 = Date.now();
    // Update element caches
    waveElement = document.getElementById('waveform')
    specElement = document.getElementById('spectrogram');
    specCanvasElement = document.querySelector('#spectrogram canvas');
    waveCanvasElement = document.querySelector('#waveform canvas');
    waveWaveElement = document.querySelector('#waveform wave');
    specWaveElement = document.querySelector('#spectrogram wave');
}

function increaseFFT(){
    if (wavesurfer.spectrogram.fftSamples <= 4096) {
        wavesurfer.spectrogram.fftSamples *= 2;
        const position = clamp(wavesurfer.getCurrentTime() / windowLength, 0, 1);
        postBufferUpdate({ begin: bufferBegin, position: position, region: getRegion(), goToRegion: false })
        console.log(wavesurfer.spectrogram.fftSamples);
    }
}

function reduceFFT(){
    if (wavesurfer.spectrogram.fftSamples > 64) {
        wavesurfer.spectrogram.fftSamples /= 2;
        const position = clamp(wavesurfer.getCurrentTime() / windowLength, 0, 1);
        postBufferUpdate({ begin: bufferBegin, position: position, region: getRegion(), goToRegion: false })
        console.log(wavesurfer.spectrogram.fftSamples);
    }
}

function zoomSpec(direction) {
    if (fileLoaded) {
        if (typeof direction !== 'string') { // then it's an event
            direction = direction.target.closest('button').id
        }
        let offsetSeconds = wavesurfer.getCurrentTime();
        let position = offsetSeconds / windowLength;
        let timeNow = bufferBegin + offsetSeconds;
        const oldBufferBegin = bufferBegin;
        if (direction === 'zoomIn') {
            if (windowLength < 1.5) return;
            windowLength /= 2;
            bufferBegin += windowLength * position;
        } else {
            if (windowLength > 100 || windowLength === currentFileDuration) return;
            bufferBegin -= windowLength * position;
            windowLength = Math.min(currentFileDuration, windowLength * 2);
            
            if (bufferBegin < 0) {
                bufferBegin = 0;
            } else if (bufferBegin + windowLength > currentFileDuration) {
                bufferBegin = currentFileDuration - windowLength
                
            }
        }
        // Keep playhead at same time in file
        position = clamp((timeNow - bufferBegin) / windowLength, 0, 1);
        // adjust region start time to new window start time
        let region = getRegion();
        if (region) {
            const duration = region.end - region.start;
            region.start = region.start + (oldBufferBegin - bufferBegin);
            region.end = region.start + duration;
            const {start, end} = region;
            if (start < 0 || start > windowLength || end > windowLength) region = undefined;
            
        }
        postBufferUpdate({ begin: bufferBegin, position: position, region: region, goToRegion: false })
    }
}

async function showOpenDialog(fileOrFolder) {
    const files = await window.electron.openDialog('showOpenDialog', {type: 'audio', fileOrFolder: fileOrFolder, multi: 'multiSelections'});
    if (!files.canceled) {
        if (fileOrFolder === 'openFiles'){
            await onOpenFiles({ filePaths: files.filePaths });
        } else {
            filterValidFiles({ filePaths: files.filePaths })
        }
    }
}

function powerSave(on) {
    return window.electron.powerSaveBlocker(on);
}

const openFileInList = async (e) => {
    if (!PREDICTING && e.target.tagName === 'A') {
        await loadAudioFile({ filePath: e.target.id, preserveResults: true })
    }
}

const buildFileMenu = (e) => {
    //e.preventDefault();
    e.stopImmediatePropagation();
    const menu = document.getElementById('context-menu');
    menu.innerHTML = `
    <a class="dropdown-item" id="setCustomLocation"><span
    class="material-symbols-outlined align-bottom pointer">edit_location_alt</span> Amend File Recording Location</a>
    <a class="dropdown-item" id="setFileStart"><span
    class="material-symbols-outlined align-bottom pointer">edit_calendar</span> Amend File Start Time
    `;
    positionMenu(menu, e);
}

function getDatetimeLocalFromEpoch(date) {
    // Assuming you have a Date object, for example:
    const myDate = new Date(date);
    let datePart = myDate.toLocaleDateString('en-GB', {year:"numeric", month:"2-digit", day:"2-digit"});
    datePart = datePart.split('/').reverse().join('-');
    const timePart = myDate.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit" }).replace(/\s.M$/, '');
    // Combine date and time parts in the format expected by datetime-local input
    const isoDate = datePart + 'T' + timePart;
    return isoDate;
}

function showDatePicker() {
    // Create a form element
    const form = document.createElement("form");
    form.classList.add("mt-3", "mb-3", "p-3", "rounded", "text-bg-light", 'position-relative');
    form.style.zIndex = "1000";
    // Create a label for the datetime-local input
    const label = document.createElement("label");
    label.innerHTML = "Select New Date and Time:";
    label.classList.add("form-label");
    form.appendChild(label);
    
    // Create the datetime-local input
    const datetimeInput = document.createElement("input");
    datetimeInput.setAttribute("type", "datetime-local");
    datetimeInput.setAttribute("id", "fileStart");
    datetimeInput.setAttribute("value", getDatetimeLocalFromEpoch(fileStart));
    datetimeInput.setAttribute("max", getDatetimeLocalFromEpoch(new Date()));
    datetimeInput.classList.add("form-control");
    form.appendChild(datetimeInput);
    
    // Create a submit button
    const submitButton = document.createElement("button");
    submitButton.innerHTML = "Submit";
    submitButton.classList.add("btn", "btn-primary", "mt-2");
    form.appendChild(submitButton);
    
    // Create a cancel button
    var cancelButton = document.createElement("button");
    cancelButton.innerHTML = "Cancel";
    cancelButton.classList.add("btn", "btn-secondary", "mt-2", "ms-2");
    form.appendChild(cancelButton);
    
    // Append the form to the filename element
    const domElement = document.getElementById("filename");
    domElement.appendChild(form);
    // Add submit event listener to the form
    form.addEventListener("submit", function (event) {
        event.preventDefault();
        
        // Get the datetime-local value
        const newStart = document.getElementById("fileStart").value;
        // Convert the datetime-local value to milliseconds
        const timestamp = new Date(newStart).getTime();
        
        // Send the data to the worker
        worker.postMessage({ action: 'update-file-start', file: currentFile, start: timestamp });
        resetResults();
        fileStart = timestamp;
        // update the timeline
        postBufferUpdate({ file: currentFile, begin: bufferBegin })
        // Remove the form from the DOM
        form.remove();
    });
    // Add click event listener to the cancel button
    cancelButton.addEventListener("click", function () {
        // Remove the form from the DOM
        form.remove();
    });
    toggleKeyDownForFormInputs()
}

const filename = document.getElementById('filename');
filename.addEventListener('click', openFileInList);
filename.addEventListener('contextmenu', buildFileMenu);

function extractFileNameAndFolder(path) {
    const regex = /[\\/]?([^\\/]+)[\\/]?([^\\/]+)$/; // Regular expression to match the parent folder and file name
    
    const match = path.match(regex);
    
    if (match) {
        const parentFolder = match[1];
        const fileName = match[2];
        return { parentFolder, fileName };
    } else {
        // Return a default value or handle the case where the path doesn't match the pattern
        return { parentFolder: '', fileName: '' };
    }
}

function renderFilenamePanel() {
    if (!currentFile) return;
    const openfile = currentFile;
    const files = fileList;
    let filenameElement = document.getElementById('filename');
    filenameElement.innerHTML = '';
    //let label = openfile.replace(/^.*[\\\/]/, "");
    const {parentFolder, fileName}  = extractFileNameAndFolder(openfile)
    const label = `${parentFolder}/${fileName}`;
    let appendStr;
    const isSaved = ['archive', 'explore'].includes(STATE.mode) ? 'text-info' : 'text-warning';
    if (files.length > 1) {
        appendStr = `<div id="fileContainer" class="btn-group dropup">
        <span class="filename ${isSaved}">${label}</span>
        </button>
        <button class="btn btn-dark dropdown-toggle dropdown-toggle-split" type="button" 
        data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">+${files.length -1}
        <span class="visually-hidden">Toggle Dropdown</span>
        </button>
        <div class="dropdown-menu dropdown-menu-dark" aria-labelledby="dropdownMenuButton">`;
        files.forEach(item => {
            if (item !== openfile) {
                const label = item.replace(/^.*[\\/]/, "");
                appendStr += `<a id="${item}" class="dropdown-item openFiles" href="#">
                <span class="material-symbols-outlined align-bottom">audio_file</span>${label}</a>`;
            }
        });
        appendStr += `</div></div>`;
    } else {
        appendStr = `<div id="fileContainer">
        <button class="btn btn-dark" type="button" id="dropdownMenuButton">
        <span class="filename ${isSaved}">${label}</span>
        </button></div>`;
    }
    
    filenameElement.innerHTML = appendStr;
    // Adapt menu
    customiseAnalysisMenu(isSaved === 'text-info');
}


function customAnalysisAllMenu(saved){
    const analyseAllMenu = document.getElementById('analyseAll');
    const modifier = isMac ? '⌘' : 'Ctrl';
    if (saved) {
        analyseAllMenu.innerHTML = `<span class="material-symbols-outlined">upload_file</span> Get Results for All Open Files
        <span class="shortcut float-end">${modifier}+Shift+A</span>`;
        enableMenuItem(['reanalyseAll']);
    } else {
        analyseAllMenu.innerHTML = `<span class="material-symbols-outlined">search</span> Analyse All Open Files
        <span class="shortcut float-end">${modifier}+Shift+A</span>`;
        disableMenuItem(['reanalyseAll']);
    }   
}

function customiseAnalysisMenu(saved) {
    const modifier = isMac ? '⌘' : 'Ctrl';
    const analyseMenu = document.getElementById('analyse');
    if (saved) {
        analyseMenu.innerHTML = `<span class="material-symbols-outlined">upload_file</span> Get Results for Current File
        <span class="shortcut float-end">${modifier}+A</span>`;
        enableMenuItem(['reanalyse']);
    } else {
        analyseMenu.innerHTML = `<span class="material-symbols-outlined">search</span> Analyse File
        <span class="shortcut float-end">${modifier}+A</span>`;
        disableMenuItem(['reanalyse']);
    }
}


async function generateLocationList(id) {
    const defaultText = id === 'savedLocations' ? '(Default)' : 'All';
    const el = document.getElementById(id);
    LOCATIONS = undefined;
    worker.postMessage({ action: 'get-locations', file: currentFile });
    await waitForLocations();
    el.innerHTML = `<option value="">${defaultText}</option>`; // clear options
    LOCATIONS.forEach(loc => {
        const option = document.createElement('option')
        option.value = loc.id;
        option.textContent = loc.place;
        el.appendChild(option);
    })
    return el;
}

const FILE_LOCATION_MAP = {};
const onFileLocationID = ({ file, id }) => FILE_LOCATION_MAP[file] = id;
const locationModalDiv = document.getElementById('locationModal');
locationModalDiv.addEventListener('shown.bs.modal', () =>{
    placeMap('customLocationMap')
})
//document

// showLocation: Show the currently selected location in the form inputs
const showLocation = async (fromSelect) => {
    let newLocation;
    const latEl = document.getElementById('customLat');
    const lonEl = document.getElementById('customLon');
    const customPlaceEl = document.getElementById('customPlace');
    const locationSelect = document.getElementById('savedLocations');
    // Check if currentfile has a location id
    const id = fromSelect ? parseInt(locationSelect.value) : FILE_LOCATION_MAP[currentFile];
    
    if (id) {
        newLocation = LOCATIONS.find(obj => obj.id === id);
        //locationSelect.value = id;
        if (newLocation){
            latEl.value = newLocation.lat, lonEl.value = newLocation.lon, customPlaceEl.value = newLocation.place;
        } else {
            latEl.value = config.latitude, lonEl.value = config.longitude, customPlaceEl.value = config.location;
        }
    }
    else {  //Default location
        const savedLocationSelect = await generateLocationList('savedLocations');
        latEl.value = config.latitude, lonEl.value = config.longitude, customPlaceEl.value = config.location;
    }
    // make sure the  map is initialised
    if (!map) placeMap('customLocationMap')
    updateMap(latEl.value, lonEl.value)
}

const displayLocationAddress = async (where) => {
    const custom = where.includes('custom');
    let latEl, lonEl, placeEl, address;
    if (custom){
        latEl = document.getElementById('customLat');
        lonEl = document.getElementById('customLon');
        placeEl = document.getElementById('customPlace');
        address = await fetchLocationAddress(latEl.value, lonEl.value, false);
        if (address === false) return
        placeEl.value = address || 'Location not available';
    } else {
        latEl = document.getElementById('latitude');
        lonEl = document.getElementById('longitude');
        placeEl = document.getElementById('place');
        address = await fetchLocationAddress(latEl.value, lonEl.value, false);
        if (address === false) return
        const content = '<span class="material-symbols-outlined">fmd_good</span> ' + address;
        placeEl.innerHTML = content;
        const button = document.getElementById('apply-location')
        button.classList.add('btn-danger');
        button.textContent = 'Apply';
    }
}

const cancelDefaultLocation = () => {
    const latEl = document.getElementById('latitude');
    const lonEl = document.getElementById('longitude');
    const placeEl = document.getElementById('place');
    latEl.value = config.latitude;
    lonEl.value = config.longitude;
    placeEl.innerHTML = '<span class="material-symbols-outlined">fmd_good</span> ' + config.location;
    updateMap(latEl.value, lonEl.value)
    const button = document.getElementById('apply-location')
    button.classList.remove('btn-danger');
    button.innerHTML = 'Set <span class="material-symbols-outlined">done</span>';
}

const setDefaultLocation = () => {
    config.latitude = parseFloat(DOM.defaultLat.value).toFixed(4);
    config.longitude = parseFloat(parseFloat(DOM.defaultLon.value)).toFixed(4);
    config.location = document.getElementById('place').textContent.replace('fmd_good', '');
    updateMap(parseFloat(DOM.defaultLat.value), parseFloat(DOM.defaultLon.value));
    updatePrefs('config.json', config)
    worker.postMessage({
        action: 'update-state',
        lat: config.latitude,
        lon: config.longitude,
        place: config.location
    });
    // Initially, so changes to the default location are immediately reflected in subsequent analyses
    // We will switch to location filtering when the default location is changed.
    config.list = 'location';
    DOM.speciesThresholdEl.classList.remove('d-none');
    
    updateListIcon();
    DOM.listToUse.value = config.list;
    resetResults();
    worker.postMessage({
        action: 'update-list',
        list: 'location'
    });
    const button = document.getElementById('apply-location')
    button.classList.remove('btn-danger');
    button.innerHTML = 'Set <span class="material-symbols-outlined">done</span>';
}


async function setCustomLocation() {
    const savedLocationSelect = await generateLocationList('savedLocations');
    const latEl = document.getElementById('customLat');
    const lonEl = document.getElementById('customLon');
    const customPlaceEl = document.getElementById('customPlace');
    const locationAdd = document.getElementById('set-location');
    const batchWrapper = document.getElementById('location-batch-wrapper');
    fileList.length > 1 ? batchWrapper.classList.remove('d-none') : batchWrapper.classList.add('d-none');
    // Use the current file location for lat, lon, place or use defaults
    showLocation(false);
    savedLocationSelect.addEventListener('change', function (e) {
        showLocation(true);
    })
    const addOrDelete = () => {
        if (customPlaceEl.value) {
            locationAdd.textContent = 'Set Location'
            locationAdd.classList.remove('btn-danger');
            locationAdd.classList.add('button-primary');
        } else {
            locationAdd.textContent = 'Delete Location'
            locationAdd.classList.add('btn-danger');
            locationAdd.classList.remove('button-primary');
        }
    }
    // Highlight delete
    customPlaceEl.addEventListener('keyup', addOrDelete);
    addOrDelete();
    const locationModal = new bootstrap.Modal(locationModalDiv);
    locationModal.show();
    
    
    // Submit action
    const locationForm = document.getElementById('locationForm');
    
    
    const addLocation = () => {
        locationID = savedLocationSelect.value;
        const batch = document.getElementById('batchLocations').checked;
        const files = batch ? STATE.openFiles : [currentFile];
        worker.postMessage({ action: 'set-custom-file-location', lat: latEl.value, lon: lonEl.value, place: customPlaceEl.value, files: files })
        locationModal.hide();
    }
    locationAdd.addEventListener('click', addLocation)
    const onModalDismiss = () => {
        locationForm.reset();
        locationAdd.removeEventListener('click', addLocation);
        locationModalDiv.removeEventListener('hide.bs.modal', onModalDismiss);
        if (showLocation) savedLocationSelect.removeEventListener('change', setCustomLocation)
    }
    locationModalDiv.addEventListener('hide.bs.modal', onModalDismiss);
}

/**
* We post the list to the worker as it has node and that allows it easier access to the
* required filesystem routines, returns valid audio file list
* @param filePaths
*/
const filterValidFiles = ({ filePaths }) => {
    worker.postMessage({ action: 'get-valid-files-list', files: filePaths })
}

async function onOpenFiles(args) {
    hideAll();
    showElement(['spectrogramWrapper'], false);
    resetResults({clearSummary: true, clearPagination: true, clearResults: true});
    resetDiagnostics();
    // Store the file list and Load First audio file
    fileList = args.filePaths;
    fileList.length > 1 && fileList.length < 25_000 && worker.postMessage({action: 'check-all-files-saved', files: fileList});
    STATE.openFiles = args.filePaths;
    // Sort file by time created (the oldest first):
    if (fileList.length > 1) {
        if (modelReady) enableMenuItem(['analyseAll', 'reanalyseAll'])
        fileList = fileList.map(fileName => ({
            name: fileName,
            time: fs.statSync(fileName).mtime.getTime(),
        }))
        .sort((a, b) => a.time - b.time)
        .map(file => file.name);
    } else {
        disableMenuItem(['analyseAll', 'reanalyseAll'])
    }
    // Reset analysis status
    STATE.analysisDone = false;
    await loadAudioFile({ filePath: fileList[0] });
    disableMenuItem(['analyseSelection', 'analyse', 'analyseAll', 'reanalyse', 'reanalyseAll', 'export2audio', 'save2db'])
    // Clear unsaved records warning
    window.electron.unsavedRecords(false);
    document.getElementById('unsaved-icon').classList.add('d-none');
    // Reset the buffer playhead and zoom:
    bufferBegin = 0;
    windowLength = 20;
}


/**
*
*
* @returns {Promise<void>}
*/
async function showSaveDialog() {
    await window.electron.saveFile({ currentFile: currentFile, labels: AUDACITY_LABELS[currentFile] });
}

function resetDiagnostics() {
    delete DIAGNOSTICS['Audio Duration'];
    delete DIAGNOSTICS['Analysis Rate'];
    delete DIAGNOSTICS['Analysis Duration'];
    //reset delete history too
    DELETE_HISTORY = [];
}

// Worker listeners
function analyseReset() {
    clearActive();
    DOM.fileNumber.textContent = '';
    if (STATE.mode === 'analyse') PREDICTING = true;
    resetDiagnostics();
    AUDACITY_LABELS = {};
    DOM.progressDiv.classList.remove('d-none');
}

function isEmptyObject(obj) {
    for (const i in obj) return false;
    return true
}

function refreshResultsView() {
    
    if (fileLoaded) {
        hideAll();
        showElement(['spectrogramWrapper', 'fullscreen'], false);
        if (!isEmptyObject(predictions)) {
            showElement(['resultTableContainer', 'resultsHead'], false);
        }
    } else if (!fileList.length) {
        hideAll();
    }
}

// fromDB is requested when circle clicked
const getSelectionResults = (fromDB) => {
    if (fromDB instanceof PointerEvent) fromDB = false;
    let start = region.start + bufferBegin;
    // Remove small amount of region to avoid pulling in results from 'end'
    let end = region.end + bufferBegin - 0.001;
    STATE.selection = {};
    STATE['selection']['start'] = start.toFixed(3);
    STATE['selection']['end'] = end.toFixed(3);
    
    postAnalyseMessage({
        filesInScope: [currentFile],
        start: STATE['selection']['start'],
        end: STATE['selection']['end'],
        offset: 0,
        fromDB: fromDB
    });
}


function postAnalyseMessage(args) {
    if (!PREDICTING) {
        // Start a timer
        t0_analysis = Date.now();
        disableMenuItem(['analyseSelection']);
        const selection = !!args.end;
        const filesInScope = args.filesInScope;
        //updateProgress(0);
        if (!selection) {
            analyseReset();
            refreshResultsView();
            resetResults({clearSummary: true, clearPagination: true, clearResults: true});
            // change result header to indicate deactivation
            DOM.resultHeader.classList.add('text-bg-secondary');
            DOM.resultHeader.classList.remove('text-bg-dark');
        }
        worker.postMessage({
            action: 'analyse',
            start: args.start,
            end: args.end,
            filesInScope: filesInScope,
            reanalyse: args.reanalyse,
            SNR: config.filters.SNR,
            circleClicked: args.fromDB
        });
    } else {
        generateToast({message: 'An analysis is underway. Press <b>Esc</b> to cancel it before running a new analysis.'})
    }
}


function fetchLocationAddress(lat, lon) {
    if (isNaN(lat) || isNaN(lon)  || !lat || !lon){
        generateToast({ message:'Both lat and lon values need to be numbers between 180 and -180'})
        return false
    }
    return new Promise((resolve, reject) => {
        if (!LOCATIONS) {
            worker.postMessage({ action: 'get-locations', file: currentFile });
            waitForLocations();
        }
        const storedLocation = LOCATIONS?.find(obj => obj.lat === lat && obj.lon === lon);
        if (storedLocation) return resolve(storedLocation.place);
        
        fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=14`)
        .then(response => {
            if (!response.ok) {
                console.warn('Network error: ', response.status, response.url );
                
            }
            return response.json()
        })
        .then(data => {
            let address;
            if (data.error) {
                address = "No location found for this map point";
            } else {
                // Just take the first two elements of the address
                address = data.display_name.split(',').slice(0,2).join(", ");
                
                LOCATIONS.push({ id: LOCATIONS.length + 1, lat: lat, lon: lon, place: address })
            }
            resolve(address);
        })
        .catch(error => {
            console.log("A location for this point could not be retrieved from OpenStreetMap")
            reject(error);
        })
    })
}


// Menu bar functions

function exitApplication() {
    window.close()
}

function enableMenuItem(id_list) {
    id_list.forEach(id => {
        document.getElementById(id).classList.remove('disabled');
    })
}

function disableMenuItem(id_list) {
    id_list.forEach(id => {
        document.getElementById(id).classList.add('disabled');
    })
}


function setHeight(el, val) {
    if (typeof val === 'function') val = val();
    if (typeof val === 'string') el.style.height = val;
    else el.style.height = val + 'px';
}

function showElement(id_list, makeFlex = true, empty = false) {
    id_list.forEach(id => {
        const thisElement = document.getElementById(id);
        thisElement.classList.remove('d-none');
        if (makeFlex) thisElement.classList.add('d-flex');
        if (empty) {
            setHeight(thisElement, 0);
            thisElement.replaceChildren(); // empty
        }
    })
}

function hideElement(id_list) {
    id_list.forEach(id => {
        const thisElement = document.getElementById(id);
        thisElement.classList.remove('d-flex');
        thisElement.classList.add('d-none');
    })
}

function hideAll() {
    // File hint div,  Waveform, timeline and spec, controls and result table
    hideElement(['exploreWrapper',
    'spectrogramWrapper', 'resultTableContainer', 'recordsContainer', 'fullscreen', 'resultsHead']);
}


async function batchExportAudio() {
    const species = isSpeciesViewFiltered(true); 
    species ? exportData('audio', species, 1000) : generateToast({message: "Filter results by species to export audio files"});
}

const export2CSV = ()  => exportData('text', isSpeciesViewFiltered(true), Infinity);
const exporteBird = ()  => exportData('eBird', isSpeciesViewFiltered(true), Infinity);
const exportRaven = ()  => exportData('Raven', isSpeciesViewFiltered(true), Infinity);

async function exportData(format, species, limit, duration){
    const response = await window.electron.selectDirectory('selectDirectory');
    if (!response.canceled) {
        const directory = response.filePaths[0];
        worker.postMessage({
            action: 'export-results',
            directory: directory,
            format: format,
            duration: duration,
            species: species,
            files: isExplore() ? [] : fileList,
            explore: isExplore(),
            limit: limit,
            range: isExplore() ? STATE.explore.range : undefined
        })
    } 
}

const chartsLink = document.getElementById('charts');
chartsLink.addEventListener('click', async () => {
    // Tell the worker we are in Chart mode
    worker.postMessage({ action: 'change-mode', mode: 'chart' });
    // Disable analyse file links
    disableMenuItem(['analyse', 'analyseSelection', 'analyseAll', 'reanalyse', 'reanalyseAll'])
    worker.postMessage({ action: 'get-detected-species-list', range: STATE.chart.range });
    const locationFilter = await generateLocationList('chart-locations');
    locationFilter.addEventListener('change', handleLocationFilterChange);
    hideAll();
    showElement(['recordsContainer']);
    worker.postMessage({ action: 'chart', species: undefined, range: STATE.chart.range });
});

const handleLocationFilterChange = (e) => {
    const location = e.target.value || undefined;
    worker.postMessage({ action: 'update-state', locationID: location });
    // Update the seen species list
    worker.postMessage({ action: 'get-detected-species-list' })
    worker.postMessage({ action: 'update-state', globalOffset: 0, filteredOffset: {}});
    if (STATE.mode === 'explore') filterResults() 
}

const exploreLink = document.getElementById('explore');
exploreLink.addEventListener('click', async () => {
    // Tell the worker we are in Explore mode
    worker.postMessage({ action: 'change-mode', mode: 'explore' });
    worker.postMessage({ action: 'get-detected-species-list', range: STATE.explore.range });
    const locationFilter = await generateLocationList('explore-locations');
    locationFilter.addEventListener('change', handleLocationFilterChange);
    hideAll();
    showElement(['exploreWrapper'], false);
    enableMenuItem(['saveCSV', 'save-eBird', 'save-Raven']);
    worker.postMessage({ action: 'update-state', globalOffset: 0, filteredOffset: {}});
    // Analysis is done
    STATE.analysisDone = true;
    filterResults({species: undefined, range: STATE.explore.range});
    resetResults({clearSummary: true, clearPagination: true, clearResults: true});
});

const restoreLink = document.getElementById('restore');
restoreLink.addEventListener('click', async () => {
    // Todo: Placeholder for results restore
    worker.postMessage({ action: 'change-mode', mode: 'analyse' });
    hideAll();
    showElement(['spectrogramWrapper', 'resultTableContainer', 'fullscreen']);
    worker.postMessage({ action: 'filter', updateSummary: true });
});

// const datasetLink = document.getElementById('dataset');
// datasetLink.addEventListener('click', async () => {
//     worker.postMessage({ action: 'create-dataset', species: isSpeciesViewFiltered(true) });
// });

const checkWidth = (text) => {
    // Create a temporary element to measure the width of the text
    const tempElement = document.createElement('span');
    tempElement.style.position = 'absolute';
    tempElement.style.visibility = 'hidden';
    tempElement.textContent = text;
    document.body.appendChild(tempElement);
    
    // Get the width of the text
    const textWidth = tempElement.clientWidth;
    
    // Remove the temporary element from the document
    document.body.removeChild(tempElement);
    return textWidth + 5
}


function createRegion(start, end, label, goToRegion) {
    wavesurfer.pause();
    resetRegions();
    wavesurfer.addRegion({
        start: start,
        end: end,
        color: "rgba(255, 255, 255, 0.1)",
        attributes: {
            label: label || '',
            
        },
    });
    const region = document.getElementsByTagName('region')[0];
    const text = region.attributes['data-region-label'].value;
    if (region.clientWidth <= checkWidth(text)) {
        region.style.writingMode = 'vertical-rl';
    }
    if (goToRegion) {
        const progress = start / wavesurfer.getDuration();
        wavesurfer.seekAndCenter(progress);
    }
}

// We add the handler to the whole table as the body gets replaced and the handlers on it would be wiped
const results = document.getElementById('results');
results.addEventListener('click', resultClick);
const selectionTable = document.getElementById('selectionResultTableBody');
selectionTable.addEventListener('click', resultClick);

async function resultClick(e) {
    let row = e.target.closest('tr');
    if (!row || row.classList.length === 0 || row.classList.contains('table-active')) { 
        // 1. clicked and dragged, 2 no detections in file row, 3. already selected this row
        return
    }
    // Search for results rows
    while (!(row.classList.contains('nighttime') ||
    row.classList.contains('daytime'))) {
        row = row.previousElementSibling
        if (!row) return;
    }
    if (activeRow) activeRow.classList.remove('table-active');
    row.classList.add('table-active');
    activeRow = row;
    const [file, start, end, sname, label] = row.getAttribute('name').split('|');
    loadResultRegion({ file, start, end, label });
    if (e.target.classList.contains('circle')) {
        await waitForFileLoad();
        getSelectionResults(true);
    }
}

function clamp(value, min, max){
    return Math.min(Math.max(value, min), max);
}

const loadResultRegion = ({ file = '', start = 0, end = 3, label = '' } = {}) => {
    start = parseFloat(start);
    end = parseFloat(end);
    // ensure region doesn't spread across the whole window
    if (windowLength <= 3.5) windowLength = 6;
    bufferBegin = Math.max(0, start - (windowLength / 2) + 1.5)
    const region = { start: Math.max(start - bufferBegin, 0), end: end - bufferBegin, label: label };
    const position = clamp(wavesurfer.getCurrentTime() / windowLength, 0, 1);
    postBufferUpdate({ file: file, begin: bufferBegin, position: position, region: region })
}

/**
*
* @param redraw boolean, whether to re-render the spectrogram
* @param fftSamples: Optional, the number of fftsamples to use for rendering. Must be a factor of 2
*/

function adjustSpecDims(redraw, fftSamples, newHeight) {
    const footerHeight = document.getElementById('footer').offsetHeight;
    const navHeight = document.getElementById('navPadding').clientHeight;
    newHeight ??= 0;
    //Contentwrapper starts below navbar (66px) and ends above footer (30px). Hence - 96
    const contentWrapper = document.getElementById('contentWrapper');
    contentWrapper.style.height = (bodyElement.clientHeight - footerHeight - navHeight) + 'px';
    const contentHeight = contentWrapper.offsetHeight;
    // + 2 for padding
    const formOffset = document.getElementById('exploreWrapper').offsetHeight;
    let specOffset;
    const spectrogramWrapper = document.getElementById('spectrogramWrapper')
    if (!spectrogramWrapper.classList.contains('d-none')) {
        // Expand up to 512px unless fullscreen
        const controlsHeight = DOM.controlsWrapper.offsetHeight;
        const timelineHeight = 22 ; //document.getElementById('timeline').offsetHeight; // This is unset when there is no wavesurfer, so hard-coding
        const specHeight = config.fullscreen ? contentHeight - timelineHeight - formOffset - controlsHeight : newHeight || config.specMaxHeight;
        if (newHeight !== 0) {
            config.specMaxHeight = specHeight;
            scheduler.postTask(() => updatePrefs('config.json', config), {priority: 'background'});
        }
        if (currentFile) {
            // give the wrapper space for the transport controls and element padding/margins
            if (!wavesurfer) {
                initWavesurfer({
                    audio: currentBuffer,
                    height: specHeight,
                });
            } else {
                wavesurfer.setHeight(specHeight);
                initSpectrogram(specHeight, fftSamples);
            }
            specCanvasElement.style.width = '100%';
            specElement.style.zIndex = 0;
            //document.querySelector('.spec-labels').style.width = '55px';
        }
        if (wavesurfer && redraw) {
            specOffset = spectrogramWrapper.offsetHeight;
        }
            } else {
        specOffset = 0
    }
    const resultTableElement = document.getElementById('resultTableContainer');
    resultTableElement.style.height = (contentHeight - specOffset - formOffset) + 'px';
}

///////////////// Font functions ////////////////
    // Function to set the font size scale
    function setFontSizeScale() {
        document.documentElement.style.setProperty('--font-size-scale', config.fontScale);
        const decreaseBtn = document.getElementById('decreaseFont');
        const increaseBtn = document.getElementById('increaseFont');
        
        decreaseBtn.classList.toggle('disabled', config.fontScale === 0.7);
        increaseBtn.classList.toggle('disabled', config.fontScale === 1.1);

        updatePrefs('config.json', config)
    }





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


function formatRegionTooltip(start, end) {
    const length = end - start;
    if (length === 3) {
        return `${formatTimeCallback(start)} -  ${formatTimeCallback(end)}`;
    } else if (length < 1) return `Region length: ${(length * 1000).toFixed(0)}ms`
    else {
        return `Region length: ${length.toFixed(3)}s`
    }
}

function formatTimeCallback(secs) {
    secs = secs.toFixed(2);
    const now = new Date(bufferStartTime.getTime() + (secs * 1000))
    const milliSeconds = now.getMilliseconds();
    let seconds = now.getSeconds();
    const minutes = now.getMinutes();
    const hours = now.getHours();
    
    // fill up seconds with zeroes
    let secondsStr;
    if (windowLength >= 5) {
        secondsStr = (seconds + milliSeconds / 1000).toFixed(2);
        secondsStr = secondsStr.replace(/\.?0+$/, ''); // remove trailing zeroes
    } else {
        let fraction = Math.round(milliSeconds / 100);
        if (fraction === 10) {
            seconds += 1;
            fraction = 0;
        }
        secondsStr = seconds.toString() + '.' + fraction.toString();
    }
    if (hours > 0 || minutes > 0 || config.timeOfDay) {
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
    const mulFactor = window.devicePixelRatio || 1;
    const threshold = pxPerSec / mulFactor;
    if (threshold >= 2500) {
        retval = 0.01;
    } else if (threshold >= 1000) {
        retval = 0.025;
    } else if (threshold >= 250) {
        retval = 0.1;
    } else if (threshold >= 100) {
        retval = 0.25;
    } else if (threshold >= 25) {
        retval = 5;
    } else if (threshold >= 5) {
        retval = 10;
    } else if (threshold >= 2) {
        retval = 15;
    } else {
        retval = Math.ceil(0.5 / threshold) * 60;
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
    let retval;
    const mulFactor = window.devicePixelRatio || 1;
    const threshold = pxPerSec / mulFactor;
    if (threshold >= 2500) {
        retval = 10;
    } else if (threshold >= 1000) {
        retval = 4;
    } else if (threshold >= 250) {
        retval = 10;
    } else if (threshold >= 100) {
        retval = 4;
    } else if (threshold >= 20) {
        retval = 1;
    } else if (threshold >= 5) {
        retval = 5;
    } else if (threshold >= 2) {
        retval = 15;
    } else {
        retval = Math.ceil(0.5 / threshold) * 60;
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
    const mulFactor = window.devicePixelRatio || 1;
    const threshold = pxPerSec / mulFactor;
    // draw one every 1s as an example
    return Math.floor(1 / timeInterval(threshold));
}

////////// Store preferences //////////

function updatePrefs(file, data) {
    try {
        fs.writeFileSync(p.join(appPath, file), JSON.stringify(data))
    } catch (error) {
        console.log(error)
    }
}

function fillDefaults(config, defaultConfig) {
    Object.keys(defaultConfig).forEach(key => {
        if (!(key in config)) {
            config[key] = defaultConfig[key];
        } else if (typeof config[key] === 'object' && typeof defaultConfig[key] === 'object') {
            // Recursively fill in defaults for nested objects
            fillDefaults(config[key], defaultConfig[key]);
        }
    });
}
/////////////////////////  Window Handlers ////////////////////////////
// Set config defaults
const defaultConfig = {
    fontScale: 1,
    seenTour: false,
    lastUpdateCheck: 0,
    UUID: uuidv4(),
    colormap: 'inferno',
    specMaxHeight: 512,
    specLabels: true,
    customColormap: {'loud': "#00f5d8", 'mid': "#000000", 'quiet': "#000000", 'threshold': 0.5, 'windowFn': 'hann'},
    timeOfDay: true,
    list: 'birds',
    customListFile: {birdnet: '', chirpity: ''},
    local: true,
    speciesThreshold: 0.03,
    useWeek: false,
    model: 'chirpity',
    chirpity: {locale: 'en_uk', backend: 'tensorflow'},
    birdnet: {locale: 'en', backend: 'tensorflow'},
    latitude: 52.87,
    longitude: 0.89, 
    location: 'Great Snoring, North Norfolk',
    detect: { nocmig: false, contextAware: false, confidence: 45 },
    filters: { active: false, highPassFrequency: 0, lowShelfFrequency: 0, lowShelfAttenuation: 0, SNR: 0, sendToModel: false },
    warmup: true,
    hasNode: false,
    tensorflow: { threads: DIAGNOSTICS['Cores'], batchSize: 32 },
    webgpu: { threads: 2, batchSize: 8 },
    webgl: { threads: 2, batchSize: 32 },
    audio: { gain: 0, format: 'mp3', bitrate: 192, quality: 5, downmix: false, padding: false, 
        fade: false, notification: true, normalise: false, minFrequency: 0, maxFrequency: 11950 },
    limit: 500,
    track: true,
    debug: false,
    VERSION: VERSION,
    powerSaveBlocker: false
};
let appPath, tempPath, isMac;
window.onload = async () => {
    window.electron.requestWorkerChannel();
    isMac = await window.electron.isMac();
    replaceCtrlWithCommand()
    DOM.contentWrapperElement.classList.add('loaded');
    
    // Load preferences and override defaults
    [appPath, tempPath] = await getPaths();
    // establish the message channel
    setUpWorkerMessaging()

    // Set footer year
    document.getElementById('year').textContent = new Date().getFullYear();

    await fs.readFile(p.join(appPath, 'config.json'), 'utf8', (err, data) => {
        if (err) {
            console.log('JSON parse error ' + err);
            // Use defaults
            config = defaultConfig;
        } else {
            config = JSON.parse(data);
        }
        
        // Attach an error event listener to the window object
        window.onerror = function(message, file, lineno, colno, error) {
            config.track && trackEvent(config.UUID, 'Error', error.message, encodeURIComponent(error.stack));
            // Return false not to inhibit the default error handling
            return false;
            };
        //fill in defaults - after updates add new items
        fillDefaults(config, defaultConfig);
        // Reset defaults for webgpu
            if (config.webgpu.batchSize === 32 && config.webgpu.threads === 2) 
                config.webgpu = {threads: 2, batchSize: 4};

        // switch off fullscreen mode - we don't want to persist that setting
        config.fullscreen = false;
        // set version
        config.VERSION = VERSION;
        // switch off debug mode we don't want this to be remembered
        // Initialize Spectrogram
        initWavesurfer({});
        // Set UI option state
        // Fontsize
        config.fontScale === 1 || setFontSizeScale();
        // Map slider value to batch size
        DOM.batchSizeSlider.value = BATCH_SIZE_LIST.indexOf(config[config[config.model].backend].batchSize);
        DOM.batchSizeSlider.max = (BATCH_SIZE_LIST.length - 1).toString();
        DOM.batchSizeValue.textContent = config[config[config.model].backend].batchSize;
        DOM.modelToUse.value = config.model;
        const backendEL = document.getElementById(config[config.model].backend);
        backendEL.checked = true;
        // Show time of day in results?
        setTimelinePreferences();
        // Show the list in use
        DOM.listToUse.value = config.list;
        DOM.localSwitch.checked = config.local;

        // Show Locale
        document.getElementById('locale').value = config[config.model].locale;
        // remember audio notification setting
        DOM.audioNotification.checked = config.audio.notification;
        
        // List appearance in settings 
        DOM.speciesThreshold.value = config.speciesThreshold;
        document.getElementById('species-week').checked = config.useWeek;
        DOM.customListFile.value = config.customListFile[config.model];
        if (DOM.customListFile.value)  LIST_MAP.custom = 'Using a custom list';
        // And update the icon
        updateListIcon();
        // timeline
        DOM.timelineSetting.value = config.timeOfDay ? 'timeOfDay' : 'timecode';
        // Spectrogram colour
        DOM.colourmap.value = config.colormap;
        // Spectrogram labels
        DOM.specLabels.checked = config.specLabels;
        // Spectrogram frequencies
        DOM.fromInput.value = config.audio.minFrequency;
        DOM.fromSlider.value = config.audio.minFrequency;
        DOM.toInput.value = config.audio.maxFrequency;
        DOM.toSlider.value = config.audio.maxFrequency;
        fillSlider(DOM.fromInput, DOM.toInput,  '#C6C6C6', '#0d6efd', DOM.toSlider)
        checkFilteredFrequency();
        // Window function & colormap
        document.getElementById('window-function').value = config.customColormap.windowFn;
        config.colormap === 'custom' && document.getElementById('colormap-fieldset').classList.remove('d-none');
        document.getElementById('color-threshold').textContent = config.customColormap.threshold;
        document.getElementById('loud-color').value = config.customColormap.loud;
        document.getElementById('mid-color').value = config.customColormap.mid;
        document.getElementById('quiet-color').value = config.customColormap.quiet;
        document.getElementById('color-threshold-slider').value = config.customColormap.threshold;
        // Audio preferences:
        DOM.gain.value = config.audio.gain;
        DOM.gainAdjustment.textContent = config.audio.gain + 'dB';
        DOM.normalise.checked = config.audio.normalise;
        DOM.audioFormat.value = config.audio.format;
        DOM.audioBitrate.value = config.audio.bitrate;
        DOM.audioQuality.value = config.audio.quality;
        showRelevantAudioQuality();
        DOM.audioFade.checked = config.audio.fade;
        DOM.audioPadding.checked = config.audio.padding;
        DOM.audioFade.disabled = !DOM.audioPadding.checked;
        DOM.audioDownmix.checked = config.audio.downmix;
        setNocmig(config.detect.nocmig);
        modelSettingsDisplay();
        // Block powersave? 
        document.getElementById('power-save-block').checked = config.powerSaveBlocker;
        powerSave(config.powerSaveBlocker);

        contextAwareIconDisplay();
        DOM.debugMode.checked = config.debug;
        showThreshold(config.detect.confidence);
        SNRSlider.value = config.filters.SNR;
        SNRThreshold.textContent = config.filters.SNR;
        if (config[config.model].backend === 'webgl' || config[config.model].backend === 'webgpu') {
            SNRSlider.disabled = true;
        };
        
        
        // Filters
        HPThreshold.textContent = config.filters.highPassFrequency + 'Hz';
        HPSlider.value = config.filters.highPassFrequency;
        LowShelfSlider.value = config.filters.lowShelfFrequency;
        LowShelfThreshold.textContent = config.filters.lowShelfFrequency + 'Hz';
        lowShelfAttenuation.value = -config.filters.lowShelfAttenuation;
        lowShelfAttenuationThreshold.textContent = lowShelfAttenuation.value + 'dB';
        DOM.sendFilteredAudio.checked = config.filters.sendToModel;
        filterIconDisplay();
        
        DOM.threadSlider.max = DIAGNOSTICS['Cores'];
        DOM.threadSlider.value = config[config[config.model].backend].threads;
        DOM.numberOfThreads.textContent = config[config[config.model].backend].threads;
        DOM.defaultLat.value = config.latitude;
        DOM.defaultLon.value = config.longitude;
        place.innerHTML = '<span class="material-symbols-outlined">fmd_good</span>' + config.location;
        //setListUIState(config.list);
        worker.postMessage({
            action: 'update-state',
            path: appPath,
            temp: tempPath, 
            lat: config.latitude,
            lon: config.longitude,
            place: config.location,
            detect: config.detect,
            filters: config.filters,
            audio: config.audio,
            limit: config.limit,
            locale: config[config.model].locale,
            speciesThreshold: config.speciesThreshold,
            list: config.list,
            useWeek: config.useWeek,
            local: config.local,
            UUID: config.UUID,
            track: config.track
        });
        const {model, backend, list} = config;
        t0_warmup = Date.now();
        worker.postMessage({action: '_init_', model: model, batchSize: config[backend].batchSize, threads: config[backend].threads, backend: backend, list: list})
        // Enable popovers
        const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]')
        const popoverList = [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl))
        

        // check for new version on mac platform. pkg containers are not an auto-updatable target
        // https://www.electron.build/auto-update#auto-updatable-targets
        isMac && checkForMacUpdates();
        const doNotTrack = document.getElementById('do-not-track')
        doNotTrack.checked = !config.track;
        // Add cpu model to config
        config.CPU = DIAGNOSTICS['CPU'];
        config.track && trackVisit(config);
    })
}


let MISSING_FILE;

const setUpWorkerMessaging = () => {
    establishMessageChannel.then(() => {
        worker.addEventListener('message', function (e) {
            const args = e.data;
            const event = args.event;
            switch (event) {
                case 'all-files-saved-check-result': {
                    customAnalysisAllMenu(args.result)
                    break;
                }
                case "analysis-complete": {onAnalysisComplete();
                    break;
                }
                case "audio-file-to-save": {onSaveAudio(args);
                    break;
                }
                case "chart-data": {onChartData(args);
                    break;
                }
                case "current-file-week": { 
                    STATE.week = args.week
                    break;
                }
                case "diskDB-has-records": {
                    chartsLink.classList.remove("disabled");
                    exploreLink.classList.remove("disabled");
                    break;
                }
                case "file-location-id": {onFileLocationID(args);
                    break;
                }
                case "files": {onOpenFiles(args);
                    break;
                }
                case "generate-alert": {
                    if (args.updateFilenamePanel) {
                        renderFilenamePanel();
                        window.electron.unsavedRecords(false);
                        document.getElementById("unsaved-icon").classList.add("d-none");
                    }
                    if (args.file){
                        MISSING_FILE = args.file;
                        args.message += `
                            <div class="d-flex justify-content-center mt-2">
                                <button id="locate-missing-file" class="btn btn-secondary border-dark text-nowrap" style="--bs-btn-padding-y: .25rem;" type="button">
                                    Locate File
                                </button>
                                <button id="purge-from-toast" class="ms-3 btn btn-danger text-nowrap" style="--bs-btn-padding-y: .25rem;" type="button">
                                    Delete File
                                </button>
                            </div>
                            `
                    }
                    generateToast({ message: args.message});
                break;
                }
                // Called when last result is returned from a database query
                case "database-results-complete": {onResultsComplete(args);
                    break;
                }
                case "labels": { 
                    LABELS = args.labels; 
                    // Read a custom list if applicable
                    config.list === 'custom' && setListUIState(config.list);
                    break }
                case "location-list": {LOCATIONS = args.locations;
                    locationID = args.currentLocation;
                    break;
                }
                case "model-ready": {onModelReady(args);
                    break;
                }
                case "mode-changed": {
                    const mode = args.mode;
                    STATE.mode = mode;
                    renderFilenamePanel();
                    config.debug && console.log("Mode changed to: " + mode);
                    if (mode === 'archive' || mode === 'explore') {
                        enableMenuItem(['purge-file']);
                        // change header to indicate activation
                        DOM.resultHeader.classList.remove('text-bg-secondary');
                        DOM.resultHeader.classList.add('text-bg-dark');
                        // PREDICTING = false;
                        // STATE.analysisDone = true;
                    } else {
                        disableMenuItem(['purge-file']);
                        // change header to indicate deactivation
                        DOM.resultHeader.classList.add('text-bg-secondary');
                        DOM.resultHeader.classList.remove('text-bg-dark');   
                    }
                    break;
                }
                case "summary-complate": {onSummaryComplete(args);
                    break;
                }
                case "new-result": {renderResult(args);
                    break;
                }
                case "progress": {onProgress(args);
                    break;
                }
                // called when an analysis ends, or when the filesbeingprocessed list is empty
                case "processing-complete": {
                    STATE.analysisDone = true;
                    //PREDICTING = false;
                    //DOM.progressDiv.classList.add('d-none');
                    break;
                }
                case 'ready-for-tour':{
                    // New users - show the tour
                    if (!config.seenTour) {
                        config.seenTour = true;
                        setTimeout(prepTour, 1500);
                    }
                    break;
                }
                case "seen-species-list": {generateBirdList("seenSpecies", args.list);
                break;
                }
                case 'tfjs-node': {
                    // Have we gone from a no-node setting to a node one?
                    const changedEnv = config.hasNode !== args.hasNode;
                    if (changedEnv && args.hasNode) {
                        // Let's switch to the tensorflow backend because this is generally faster under Node
                        handleBackendChange('tensorflow');
                    }
                    config.hasNode = args.hasNode;
                    if (!config.hasNode && config[config.model].backend !== 'webgpu'){
                        // No node? Not using webgpu? Force webgpu
                        handleBackendChange('webgpu');
                        generateToast({ message: 'The standard backend could not be loaded on this machine. An experimental backend (webGPU) has been used instead.'});
                        console.warn('tfjs-node could not be loaded, webGPU backend forced. CPU is', DIAGNOSTICS['CPU'])
                    }
                    modelSettingsDisplay();
                    break;
                }
                case "valid-species-list": {populateSpeciesModal(args.included, args.excluded);
                    break;
                }
                case "total-records": {updatePagination(args.total, args.offset);
                    break;
                }
                case "unsaved-records": {window.electron.unsavedRecords(true);
                    document.getElementById("unsaved-icon").classList.remove("d-none");
                    break;
                }
                case "update-audio-duration": {DIAGNOSTICS["Audio Duration"] ??= 0;
                    DIAGNOSTICS["Audio Duration"] += args.value;
                    break;
                }
                case "update-summary": {updateSummary(args);
                    break;
                }
                case "worker-loaded-audio": {
                    onWorkerLoadedAudio(args);
                    break;
                }
                default: {generateToast({ message:`Unrecognised message from worker:${args.event}`});
                }
            }
        })
    })
}

function generateBirdList(store, rows) {
    const chart = document.getElementById('chart-list');
    const explore = document.getElementById('explore-list');
    const listHTML = generateBirdOptionList({ store, rows });
    chart.innerHTML = listHTML;
    explore.innerHTML = listHTML;
}



function generateBirdOptionList({ store, rows, selected }) {
    let listHTML = '';
    if (store === 'allSpecies') {
        let sortedList = LABELS.map(label => label.split('_')[1]);
        
        // International language sorting, recommended for large arrays - 'en_uk' not valid, but same as 'en'
        sortedList.sort(new Intl.Collator(config[config.model].locale.replace('_uk', '')).compare);
        // Check if we have prepared this before
        const all = document.getElementById('allSpecies');
        const lastSelectedSpecies = selected || STATE.birdList.lastSelectedSpecies;
        listHTML += '<div class="form-floating"><select spellcheck="false" id="bird-list-all" class="input form-select mb-3" aria-label=".form-select" required>';
        listHTML += '<option value="">All</option>';
        for (const item in sortedList) {
            //const [sname, cname] = labels[item].split('_');
            if (sortedList[item] !== lastSelectedSpecies) {
                listHTML += `<option value="${sortedList[item]}">${sortedList[item]}</option>`;
            } else {
                listHTML += `<option value="${sortedList[item]}" selected>${sortedList[item]}</option>`;
            }
        }
        listHTML += '</select><label for="bird-list-all">Species</label></div>';
    } else {
        listHTML += '<select id="bird-list-seen" class="form-select"><option value="">All</option>';
        for (const item in rows) {
            const isSelected = rows[item].cname === STATE.chart.species ? 'selected' : '';
            listHTML += `<option value="${rows[item].cname}" ${isSelected}>${rows[item].cname}</option>`;
        }
        listHTML += '</select><label for="bird-list-seen">Species</label>';
    }
    
    return listHTML;
}

function generateBirdIDList(rows) {
    let listHTML = '';
    for (const item in rows) {
        listHTML += `   <tr><td>${rows[item].cname}</td> <td><i>${rows[item].sname}</i></td></tr>\n`;
    }
    return listHTML;
}

const getActiveRowID = () => activeRow?.rowIndex - 1;

const isSpeciesViewFiltered = (sendSpecies) => {
    const filtered = document.querySelector('#speciesFilter tr.text-warning');
    const species = filtered ? getSpecies(filtered) : undefined;
    return sendSpecies ? species : filtered !== null;
}



function unpackNameAttr(el, cname) {
    const currentRow = el.closest("tr");
    let [file, start, end, sname, commonName] = currentRow.getAttribute('name').split('|');
    if (cname) commonName = cname;
    currentRow.attributes[0].value = [file, start, end, sname, commonName].join('|');
    return [file, parseFloat(start), parseFloat(end), currentRow];
}


function getSpecies(target) {
    const row = target.closest('tr');
    const speciesCell = row.querySelector('.cname .cname');
    const species = speciesCell.textContent.split('\n')[0];
    return species;
}


function handleGesture(event) {
    waitForFinalEvent( () => {
        const key = event.deltaX > 0 ? 'PageDown'  : 'PageUp';
        const pageEvent = new KeyboardEvent('keydown', {
            code: key,
            bubbles: true,
            cancelable: true // The event is cancelable
        });

        // Dispatch the event on the document or a specific element
        document.dispatchEvent(pageEvent);
    }, 10, 'id2');
    
}




document.addEventListener('change', function (e) {
    const target = e.target;
    const context = target.parentNode.classList.contains('chart') ? 'chart' : 'explore';
    if (target.closest('#bird-list-seen')){
        // Clear the results table
        // const resultTable = document.getElementById('resultTableBody');
        // resultTable.textContent = '';
        const cname = target.value;
        let pickerEl = context + 'Range';
        t0 = Date.now();
        let action, explore;
        if (context === 'chart') {
            STATE.chart.species = cname;
            action = 'chart';
        } else {
            action = 'filter';
            resetResults({clearSummary: false, clearPagination: true, clearResults: false});
        }
        worker.postMessage({ action: action, species: cname, range: STATE[context].range, updateSummary: true });
    }
    else if (target.closest('#chart-aggregation')){
        STATE.chart.aggregation = target.value;
        worker.postMessage({ 
            action: 'chart', 
            aggregation: STATE.chart.aggregation, 
            species: STATE.chart.species, 
            range: STATE[context].range
        });
    }
})

// Save audio clip
function onSaveAudio({file, filename}){
    const anchor = document.createElement('a');
    document.body.appendChild(anchor);
    anchor.style = 'display: none';
    const url = window.URL.createObjectURL(file);
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.URL.revokeObjectURL(url);
    anchor.remove()
}


// Chart functions
function getDateOfISOWeek(w) {
    const options = { month: 'long', day: 'numeric' };
    const y = new Date().getFullYear();
    const simple = new Date(y, 0, 1 + (w - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4)
    ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else
    ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    return ISOweekStart.toLocaleDateString('en-GB', options);
}

function onChartData(args) {
    const genTime = Date.now() - t0;
    const genTimeElement = document.getElementById('genTime');
    genTimeElement.textContent = (genTime / 1000).toFixed(1) + ' seconds';
    if (args.species) {
        showElement(['recordsTableBody'], false);
        const title = document.getElementById('speciesName');
        title.textContent = args.species;
    } else {
        hideElement(['recordsTableBody']);
    }
    // Destroy the existing charts (if any)
    const chartInstances = Object.values(Chart.instances);
    chartInstances.forEach(chartInstance => {
        chartInstance.destroy();
    });
    
    // Get the Chart.js canvas
    const chartCanvas = document.getElementById('chart-week');
    
    const records = args.records;
    for (const [key, value] of Object.entries(records)) {
        const element = document.getElementById(key);
        if (value?.constructor === Array) {
            if (isNaN(value[0])) element.textContent = 'N/A';
            else {
                element.textContent = value[0].toString() + ' on ' +
                new Date(value[1]).toLocaleDateString(undefined, { dateStyle: "short" });
            }
        } else {
            element.textContent = value ? new Date(value).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric"
            }) : 'No Records';
        }
    }
    
    const aggregation = args.aggregation;
    const results = args.results;
    const rate = args.rate;
    const total = args.total;
    const dataPoints = args.dataPoints;
    // start hourly charts at midday if no filter applied
    const pointStart = STATE.chart.range.start || aggregation !== 'Hour' ? args.pointStart : args.pointStart + (12 * 60 * 60 * 1000); 
    const dateLabels = generateDateLabels(aggregation, dataPoints, pointStart);
    
    // Initialize Chart.js
    const plugin = {
        id: 'customCanvasBackgroundColor',
        beforeDraw: (chart, args, options) => {
            const {ctx} = chart;
            ctx.save();
            ctx.globalCompositeOperation = 'destination-over';
            ctx.fillStyle = options.color || '#99ffff';
            ctx.fillRect(0, 0, chart.width, chart.height);
            ctx.restore();
        }
    };
    const chartOptions = {
        type: 'bar',
        data: {
            labels: dateLabels,
            datasets: Object.entries(results).map(([year, data]) => ({
                label: year,
                //shift data to midday - midday rahter than nidnight to midnight if hourly chart and filter not set
                data: aggregation !== 'Hour' ? data :  data.slice(12).join(data.slice(0, 12)),
                //backgroundColor: 'rgba(255, 0, 64, 0.5)',
                borderWidth: 1,
                //borderColor: 'rgba(255, 0, 64, 0.9)',
                borderSkipped: 'bottom' // Lines will appear to rise from the bottom
            }))
        },
        options: {
            scales: {
                y: {
                    min:0,
                    ticks: {
                        // Force integers on the Y-axis
                        precision: 0,
                        
                    }
                }
            },
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: args.species ? `${args.species} Detections` : ""
                },
                customCanvasBackgroundColor: {
                    color: "GhostWhite"
                }
            }
        },
        plugins: [plugin],
    }
    if (total) {
        chartOptions.data.datasets.unshift({
            label: 'Hours Recorded', 
            type: 'line', 
            data: total,
            fill: true,
            //backgroundColor: 'rgba(0, 0, 64, 0.2)',
            borderWidth: 0,
            pointRadius: 0,
            yAxisID: 'y1',
            cubicInterpolationMode: 'monotone', // Use monotone cubic interpolation for a spline effect
            borderSkipped: 'bottom' // Lines will appear to rise from the bottom
        })
        chartOptions.options.scales['y1'] = {position: 'right', title: {display: true, text: 'Hours of Recordings'} }
        chartOptions.options.scales.x = {max: 53, title: {display: true, text: 'Week in Year'}} 
    }
    new Chart(
        chartCanvas,
        chartOptions
        );
    }
    
    
    function generateDateLabels(aggregation, datapoints, pointstart) {
        const dateLabels = [];
        const startDate = new Date(pointstart);
        
        for (let i = 0; i < datapoints; i++) {
            // Push the formatted date label to the array
            dateLabels.push(formatDate(startDate, aggregation));
            
            // Increment the startDate based on the aggregation
            if (aggregation === 'Hour') {
                startDate.setTime(startDate.getTime() + 60 * 60 * 1000); // Add 1 hour
            } else if (aggregation === 'Day') {
                startDate.setDate(startDate.getDate() + 1); // Add 1 day
            } else if (aggregation === 'Week') {
                startDate.setDate(startDate.getDate() + 7); // Add 7 days (1 week)
            }
        }
        
        return dateLabels;
    }
    
    // Helper function to format the date as desired
    function formatDate(date, aggregation) {
        
        const options = {};
        let formattedDate = '';
        if (aggregation === 'Week'){
            // Add 1 day to the startDate
            date.setHours(date.getDate() + 1);
            const year = date.getFullYear();
            const oneJan = new Date(year, 0, 1);
            const weekNumber = Math.ceil(((date - oneJan) / (24 * 60 * 60 * 1000) + oneJan.getDay() + 1) / 7);
            return weekNumber;
        }
        else if (aggregation === 'Day') {
            options.day = 'numeric';
            options.weekday = 'short';
            options.month = 'short';
        }
        else if (aggregation === 'Hour') {
            const hour = date.getHours();
            const period = hour >= 12 ? 'PM' : 'AM';
            const formattedHour = hour % 12 || 12; // Convert 0 to 12
            return `${formattedHour}${period}`;
        }
        
        return formattedDate + date.toLocaleDateString('en-GB', options);
    }
    function setChartOptions(species, total, rate, results, dataPoints, aggregation, pointStart) {
        let chartOptions = {};
        //chartOptions.plugins = [ChartDataLabels];
        
        chartOptions.data = {
            labels: dataPoints, // Assuming dataPoints is an array of labels
            datasets: [
                {
                    label: 'Hours of recordings',
                    data: total,
                    borderColor: "#003",
                    backgroundColor: "rgba(0, 51, 0, 0.2)",
                    fill: true,
                    yAxisID: 'y-axis-0'
                },
                // Add other datasets as needed
            ]
        };
        
        chartOptions.options = {
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: aggregation.toLowerCase(), // Assuming aggregation is 'Week', 'Day', or 'Hour'
                        displayFormats: {
                            day: 'ddd D MMM',
                            week: 'MMM D',
                            hour: 'hA'
                        }
                    }
                },
                y: [
                    {
                        id: 'y-axis-0',
                        type: 'linear',
                        position: 'left',
                        title: {
                            text: 'Hours recorded'
                        }
                    },
                    // Add other y-axes as needed
                ]
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false,
                    position: 'nearest',
                    callbacks: {
                        title: function (tooltipItems) {
                            const timestamp = tooltipItems[0].parsed.x;
                            const date = new Date(timestamp);
                            return getTooltipTitle(date, aggregation);
                        },
                        label: function (tooltipItem) {
                            return `${tooltipItem.dataset.label}: ${tooltipItem.formattedValue}`;
                        }
                    }
                },
                datalabels: {
                    display: true,
                    color: 'white',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    borderRadius: 3,
                    padding: {
                        top: 2
                    },
                    formatter: function (value, context) {
                        return value; // Customize the displayed value as needed
                    }
                }
            }
        };
        
        return chartOptions;
    }
    
    function getTooltipTitle(date, aggregation) {
        if (aggregation === 'Week') {
            // Customize for week view
            return `Week ${getISOWeek(date)} (${getDateOfISOWeek(getISOWeek(date))} - ${getDateOfISOWeek(getISOWeek(date) + 1)})`;
        } else if (aggregation === 'Day') {
            // Customize for day view
            return date.toLocaleDateString('en-GB', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
            });
        } else {
            // Customize for hour view
            return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }) +
            ', ' +
            date.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
        }
    }
    
    
    const waitForFinalEvent = (function () {
        let timers = {};
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
    
    window.addEventListener('resize', function () {
        waitForFinalEvent(function () {
            WindowResize();
        }, 250, 'id1');
    });
    
    function WindowResize() {
        adjustSpecDims(true);
    }
    
    const contextMenu = document.getElementById('context-menu')
    
    function handleKeyDownDeBounce(e) {
        e.preventDefault();
        waitForFinalEvent(function () {
            handleKeyDown(e);
        }, 100, 'keyhandler');
    }
    
    function handleKeyDown(e) {
        let action = e.key;
        config.debug && console.log(`${action} key pressed`);
        if (action in GLOBAL_ACTIONS) {
            contextMenu.classList.add("d-none");
            if (document === e.target || document.body === e.target || e.target.attributes["data-action"]) {}
            const modifier = e.shiftKey ? 'Shift' : e.ctrlKey ? 'Control' : e.metaKey ? 'Alt' : 'no';
            trackEvent(config.UUID, 'KeyPress', action, modifier );
            GLOBAL_ACTIONS[action](e);
        }
        
        [].forEach.call(document.querySelectorAll('[data-action]'), function (el) {
            el.addEventListener('click', function (e) {
                let action = e.currentTarget.dataset.action;
                if (action in GLOBAL_ACTIONS) {
                    e.preventDefault();
                    GLOBAL_ACTIONS[action](e);
                }
            });
        });
    }
    
    
    
    ///////////// Nav bar Option handlers //////////////
    
    function initRegion() {
        if (wavesurfer.regions) wavesurfer.destroyPlugin('regions');
        wavesurfer.addPlugin(WaveSurfer.regions.create({
            formatTimeCallback: () => '',
            dragSelection: true,
            maxRegions: 1,
            // Region length bug (likely mine) means I don't trust leangths > 60 seconds
            maxLength: config[config[config.model].backend].batchSize * 3,
            slop: null,
            color: "rgba(255, 255, 255, 0.2)"
        })
        ).initPlugin('regions')
    }
    
    function initSpectrogram(height, fftSamples) {
        config.debug && console.log("initializing spectrogram")
        if (!fftSamples) {
            if (windowLength < 5) {
                fftSamples = 256;
            } else if (windowLength <= 15) {
                fftSamples = 512;
            } else {
                fftSamples = 1024;
            }
        }
        if (!height) {
            height = fftSamples / 2
        }
        if (wavesurfer.spectrogram) wavesurfer.destroyPlugin('spectrogram');
        // set colormap
        const colors = createColormap() ;
        wavesurfer.addPlugin(WaveSurfer.spectrogram.create({
            //deferInit: false,
            wavesurfer: wavesurfer,
            container: "#spectrogram",
            scrollParent: false,
            fillParent: true,
            windowFunc: config.customColormap.windowFn,
            frequencyMin: config.audio.minFrequency,
            frequencyMax: config.audio.maxFrequency,
            normalize: false,
            hideScrollbar: true,
            labels: config.specLabels,
            height: height,
            fftSamples: fftSamples, 
            colorMap: colors
        })).initPlugin('spectrogram')
        updateElementCache();
    }
    
    function hideTooltip() {
        tooltip.style.visibility = 'hidden';
    };
    function specTooltip(event) {
        const waveElement = event.target;
        const specDimensions = waveElement.getBoundingClientRect();
        const frequencyRange = Number(config.audio.maxFrequency) - Number(config.audio.minFrequency);
        const yPosition = Math.round((specDimensions.bottom - event.clientY) * (frequencyRange / specDimensions.height)) + Number(config.audio.minFrequency);
        tooltip.textContent = `Frequency: ${yPosition}Hz`;
        if (region) tooltip.innerHTML += "<br>" + formatRegionTooltip(region.start, region.end)
        tooltip.style.top = `${event.clientY}px`;
        tooltip.style.left = `${event.clientX + 15}px`; // Adjust tooltip position
        tooltip.style.display = 'block';
        tooltip.style.visibility = 'visible';
    }


    const LIST_MAP = {
        location: 'Searching for birds in your region',
        nocturnal: 'Searching for nocturnal birds',
        birds: 'Searching for all birds',
        everything: 'Searching for everything'
    };

    const updateListIcon = () => {
        DOM.listIcon.innerHTML = config.list === 'custom' ?
            `<span class="material-symbols-outlined mt-1" title="${LIST_MAP[config.list]}" style="width: 30px">fact_check</span>` :
            `<img class="icon" src="img/${config.list}.png" alt="${config.list}"  title="${LIST_MAP[config.list]}">`;

    }
    DOM.listIcon.addEventListener('click', () => {
        // todo: skip custom list if custom list not set
        const keys = Object.keys(LIST_MAP);
        const currentListIndex = keys.indexOf(config.list);
        const next = (currentListIndex === keys.length - 1) ? 0 : currentListIndex + 1;
        config.list = keys[next];
        DOM.listToUse.value = config.list;
        updateListIcon();
        updatePrefs('config.json', config)
        resetResults({clearSummary: true, clearPagination: true, clearResults: true});
        setListUIState(config.list)
        worker.postMessage({ action: 'update-list', list: config.list, refreshResults: STATE.analysisDone })
    })
    
    DOM.customListSelector.addEventListener('click', async () =>{
        const files = await window.electron.openDialog('showOpenDialog', {type: 'text'});
        if (! files.canceled) {
            DOM.customListSelector.classList.remove('btn-outline-danger');
            const customListFile = files.filePaths[0];
            config.customListFile[config.model] = customListFile;
            DOM.customListFile.value = customListFile;
            readLabels(config.customListFile[config.model], 'list');
            LIST_MAP.custom = 'Using a custom list';
            updatePrefs('config.json', config)
        }
    })
    
    const loadModel = ()  => {
        t0_warmup = Date.now();
        worker.postMessage({
            action: 'load-model',
            model: config.model,
            list: config.list,
            batchSize: config[config[config.model].backend].batchSize,
            warmup: config.warmup,
            threads: config[config[config.model].backend].threads,
            backend: config[config.model].backend
        });
        
    }
    
    const handleBackendChange = (backend) => {
        config[config.model].backend = backend instanceof Event ? backend.target.value : backend;
        const backendEL = document.getElementById(config[config.model].backend);
        backendEL.checked = true;
        if (config[config.model].backend === 'webgl' || config[config.model].backend === 'webgpu') {
            SNRSlider.disabled = true;
            config.filters.SNR = 0;
        } else {
            DOM.contextAware.disabled = false;
            if (DOM.contextAware.checked) {
                config.detect.contextAware = true;
                SNRSlider.disabled = true;
                config.filters.SNR = 0;
            } else {
                SNRSlider.disabled = false;
                config.filters.SNR = parseFloat(SNRSlider.value);
                if (config.filters.SNR) {
                    DOM.contextAware.disabed = true;
                    config.detect.contextAware = false;
                    contextAwareIconDisplay();
                }
            }
            PREDICTING = false;
            STATE.analysisDone = true;
        }
        // Update threads and batch Size in UI
        DOM.threadSlider.value = config[config[config.model].backend].threads;
        DOM.numberOfThreads.textContent = config[config[config.model].backend].threads;
        DOM.batchSizeSlider.value = BATCH_SIZE_LIST.indexOf(config[config[config.model].backend].batchSize);
        DOM.batchSizeValue.textContent = BATCH_SIZE_LIST[DOM.batchSizeSlider.value].toString();
        updatePrefs('config.json', config)
        // restart wavesurfer regions to set new maxLength
        initRegion();
        loadModel();
    }
    
    const backend = document.getElementsByName('backend');
    for (let i = 0; i < backend.length; i++) {
        backend[i].addEventListener('click', handleBackendChange)
    }
    
    
    const setTimelinePreferences = () => {
        const timestampFields = document.querySelectorAll('.timestamp');
        const timeOfDayFields = document.querySelectorAll('.timeOfDay');
        timestampFields.forEach(time => {
            config.timeOfDay ? time.classList.add('d-none') :
            time.classList.remove('d-none');
        });
        timeOfDayFields.forEach(time => {
            config.timeOfDay ? time.classList.remove('d-none') :
            time.classList.add('d-none');
        });
    }
    
    const timelineToggle = (fromKeys) => {
        if (fromKeys === true) {
            DOM.timelineSetting.value === 'timeOfDay' ? DOM.timelineSetting.value = 'timecode' : DOM.timelineSetting.value = 'timeOfDay'
        }
        config.timeOfDay = DOM.timelineSetting.value === 'timeOfDay'; //toggle setting
        setTimelinePreferences();
        if (fileLoaded) {
            // Reload wavesurfer with the new timeline
            const position = clamp(wavesurfer.getCurrentTime() / windowLength, 0, 1);
            postBufferUpdate({ begin: bufferBegin, position: position })
        }
        updatePrefs('config.json', config)
    };
    //document.getElementById('timelineSetting').addEventListener('change', timelineToggle);
    
    /////////// Keyboard Shortcuts  ////////////
      
    const GLOBAL_ACTIONS = { // eslint-disable-line
        a: function (e) { ( e.ctrlKey || e.metaKey) && currentFile && document.getElementById('analyse').click()},
        A: function (e) { ( e.ctrlKey || e.metaKey) && currentFile && document.getElementById('analyseAll').click()},
        c: function (e) {
            // Center window on playhead
            if (( e.ctrlKey || e.metaKey) && currentBuffer) {
                const saveBufferBegin = bufferBegin;
                const middle = bufferBegin + wavesurfer.getCurrentTime();
                bufferBegin = middle - windowLength / 2;
                bufferBegin = Math.max(0, bufferBegin);
                bufferBegin = Math.min(bufferBegin, currentFileDuration - windowLength)
                // Move the region if needed
                let region = getRegion();
                if (region){
                    const shift = saveBufferBegin - bufferBegin;
                    region.start += shift;
                    region.end += shift;
                    if (region.start < 0 || region.end > windowLength) region = undefined;
                }
                postBufferUpdate({ begin: bufferBegin, position: 0.5, region: region, goToRegion: false})
            }
        },
        // D: function (e) {
        //     if (( e.ctrlKey || e.metaKey)) worker.postMessage({ action: 'create-dataset' });
        // },
        e: function (e) {
            if (( e.ctrlKey || e.metaKey) && region) exportAudio();
        },
        f: function (e) {
            if ( e.ctrlKey || e.metaKey) toggleFullscreen();
        },
        g: function (e) {
            if ( e.ctrlKey || e.metaKey) showGoToPosition();
        },
        o: async function (e) {
            if ( e.ctrlKey || e.metaKey) await showOpenDialog('openFile');
        },
        p: function () {
            (typeof region !== 'undefined') ? region.play() : console.log('Region undefined')
        },
        q: function (e) {
            e.metaKey && isMac && window.electron.exitApplication()
        },
        s: function (e) {
            if ( e.ctrlKey || e.metaKey) {
                worker.postMessage({ action: 'save2db', file: currentFile});
            }
        },
        t: function (e) {
            if ( e.ctrlKey || e.metaKey) timelineToggle(true);
        },
        v: function(e) {
            if (activeRow && (e.ctrlKey || e.metaKey)) {
                const nameAttribute = activeRow.getAttribute('name');
                const [file, start, end, sname, label] = nameAttribute.split('|');
                const cname = label.replace('?', '');
                insertManualRecord(cname, parseFloat(start), parseFloat(end), "", "", "", "Update", false, cname)
            }
        },
        z: function (e) {
            if (( e.ctrlKey || e.metaKey) && DELETE_HISTORY.length) insertManualRecord(...DELETE_HISTORY.pop());
        },
        Escape: function (e) {
            if (PREDICTING) {
                console.log('Operation aborted');
                PREDICTING = false;
                STATE.analysisDone = true;
                worker.postMessage({
                    action: 'abort',
                    model: config.model,
                    threads: config[config[config.model].backend].threads,
                    list: config.list
                });
                generateToast({ message:'Operation cancelled'});
                DOM.progressDiv.classList.add('d-none');
            }
        },
        Home: function () {
            if (currentBuffer) {
                bufferBegin = 0;
                postBufferUpdate({})
            }
        },
        End: function () {
            if (currentBuffer) {
                bufferBegin = currentFileDuration - windowLength;
                postBufferUpdate({ begin: bufferBegin, position: 1 })
            }
        },
        PageUp: function () {
            if (currentBuffer) {
                const position = clamp(wavesurfer.getCurrentTime() / windowLength, 0, 1);
                bufferBegin = Math.max(0, bufferBegin - windowLength);
                postBufferUpdate({ begin: bufferBegin, position: position })
            }
        },
        ArrowUp: function () {
            if (activeRow) {
                activeRow.classList.remove('table-active')
                activeRow = activeRow.previousSibling || activeRow;
                activeRow.classList.add('table-active')
                activeRow.focus();
                if (!activeRow.classList.contains('text-bg-dark')) activeRow.click();
            }
        },
        PageDown: function () {
            if (currentBuffer) {
                const position = clamp(wavesurfer.getCurrentTime() / windowLength, 0, 1);
                bufferBegin = Math.min(bufferBegin + windowLength, currentFileDuration - windowLength);
                postBufferUpdate({ begin: bufferBegin, position: position })
            }
        },
        ArrowDown: function () {
            if (activeRow) {
                activeRow.classList.remove('table-active')
                activeRow = activeRow.nextSibling || activeRow;
                activeRow.classList.add('table-active')
                activeRow.focus();
                if (!activeRow.classList.contains('text-bg-dark')) activeRow.click();
            }
        },
        ArrowLeft: function () {
            const skip = windowLength / 100;
            if (currentBuffer) {
                wavesurfer.skipBackward(skip);
                const position = clamp(wavesurfer.getCurrentTime() / windowLength, 0, 1);
                if (wavesurfer.getCurrentTime() < skip && bufferBegin > 0) {
                    bufferBegin -= skip;
                    postBufferUpdate({ begin: bufferBegin, position: position })
                }
            }
        },
        ArrowRight: function () {
            const skip = windowLength / 100;
            if (wavesurfer) {
                wavesurfer.skipForward(skip);
                const position = clamp(wavesurfer.getCurrentTime() / windowLength, 0, 1);
                if (wavesurfer.getCurrentTime() > windowLength - skip) {
                    bufferBegin = Math.min(currentFileDuration - windowLength, bufferBegin += skip)
                    postBufferUpdate({ begin: bufferBegin, position: position })
                }
            }
        },
        '=': function (e) {e.metaKey || e.ctrlKey ? reduceFFT() : zoomSpec('zoomIn')},
        '+': function (e) {e.metaKey || e.ctrlKey ? reduceFFT() : zoomSpec('zoomIn')},
        '-': function (e) {e.metaKey || e.ctrlKey ? increaseFFT() : zoomSpec('zoomOut')},
        ' ': function () { wavesurfer && wavesurfer.playPause() },
        Tab: function (e) {
            if (activeRow) {
                activeRow.classList.remove('table-active')
                if (e.shiftKey) {
                    activeRow = activeRow.previousSibling || activeRow;
                } else {
                    activeRow = activeRow.nextSibling || activeRow;
                }
                activeRow.focus();
                if (!activeRow.classList.contains('text-bg-dark')) activeRow.click();
            }
        },
        Delete: function () {activeRow && deleteRecord(activeRow)},
        Backspace: function () {activeRow && deleteRecord(activeRow)}
    };
    
    //returns a region object with the start and end of the region supplied
    function getRegion(){
        return region ? {
            start: region.start,
            end: region.end,
            label: region.attributes?.label
        } : undefined;
    }
    
    const postBufferUpdate = ({
        file = currentFile,
        begin = 0,
        position = 0,
        play = false,
        resetSpec = false,
        region = undefined,
        goToRegion = true,
        queued = false
    }) => {
        fileLoaded = false;
        worker.postMessage({
            action: 'update-buffer',
            file: file,
            position: position,
            start: begin,
            end: begin + windowLength,
            play: play,
            resetSpec: resetSpec,
            region: region,
            goToRegion: goToRegion,
            queued: queued
        });
        // In case it takes a while:
        if (!queued){
            loadingTimeout = setTimeout(() => {
                const loading = document.getElementById('loadingOverlay');
                loading.querySelector('#loadingText').textContent = 'Loading file...';
                loading.classList.remove('d-none')}, 500)
        }
    }
    
    // Go to position
    const goto = new bootstrap.Modal(document.getElementById('gotoModal'));
    const showGoToPosition = () => {
        if (currentFile) {
            goto.show();
        }
    }
    
    const gotoModal = document.getElementById('gotoModal')
    //gotoModal.addEventListener('hidden.bs.modal', enableKeyDownEvent)
    
    gotoModal.addEventListener('shown.bs.modal', () => {
        const timeInput = document.getElementById('timeInput')
        timeInput.value  = '';
        timeInput.focus()
    })
    
    
    const gotoTime = (e) => {
        if (currentFile) {
            e.preventDefault();
            let hours = 0, minutes = 0, seconds = 0;
            const time = document.getElementById('timeInput').value;
            let timeArray = time.split(':');
            if (timeArray.length === 1 && !isNaN(parseFloat(timeArray[0]))) {
                seconds = parseFloat(timeArray[0]);
            } else if (timeArray.length === 2 && !isNaN(parseInt(timeArray[0])) && !isNaN(parseInt(timeArray[1]))) {
                // Case 2: Input is two numbers separated by a colon, take as minutes and seconds
                minutes = Math.min(parseInt(timeArray[0]), 59);
                seconds = Math.min(parseFloat(timeArray[1]), 59.999);
            } else if (timeArray.length === 3 && !isNaN(parseInt(timeArray[0])) && !isNaN(parseInt(timeArray[1])) && !isNaN(parseInt(timeArray[2]))) {
                // Case 3: Input is three numbers separated by colons, take as hours, minutes, and seconds
                hours = Math.min(parseInt(timeArray[0]), 23);
                minutes = Math.min(parseInt(timeArray[1]), 59);
                seconds = Math.min(parseFloat(timeArray[2]), 59.999);
            } else {
                // Invalid input
                generateToast({ message:'Invalid time format. Please enter time in one of the following formats: \n1. Float (for seconds) \n2. Two numbers separated by a colon (for minutes and seconds) \n3. Three numbers separated by colons (for hours, minutes, and seconds)'});
                return;
            }
            let start = hours * 3600 + minutes * 60 + seconds;
            windowLength = 20;
            bufferBegin = Math.max(start - windowLength / 2, 0);
            const position = bufferBegin === 0 ? start / windowLength : 0.5;
            postBufferUpdate({ begin: bufferBegin, position: position })
            // Close the modal
            goto.hide()
        }
    }
    
    const gotoForm = document.getElementById('gotoForm')
    gotoForm.addEventListener('submit', gotoTime)
    
    // Electron Message handling
    //const warmupText = document.getElementById('warmup');
    
    // function displayWarmUpMessage() {
    //     disableMenuItem(['analyse', 'analyseAll', 'reanalyse', 'reanalyseAll', 'analyseSelection', 'export2audio', 'save2db']);
    //     warmupText.classList.remove('d-none');
    // }
    
    function onModelReady(args) {
        modelReady = true;
        sampleRate = args.sampleRate;
        if (fileLoaded) {
            enableMenuItem(['analyse'])
            if (fileList.length > 1) enableMenuItem(['analyseAll', 'reanalyseAll'])
        }
        if (region) enableMenuItem(['analyseSelection'])
        t1_warmup = Date.now();
        DIAGNOSTICS['Warm Up'] = ((t1_warmup - t0_warmup) / 1000).toFixed(2) + ' seconds';
    }
    
    
    /***
    *  Called when a new file or buffer is loaded by the worker
    * @param fileStart  Unix epoch in ms for the start of the file
    * @param sourceDuration a float: number of seconds audio in the file
    * @param bufferBegin a float: the start position of the file in seconds
    * @param file full path to the audio file
    * @param position the position to place the play head: between  0-1
    * @param contents the audio buffer
    * @param fileRegion an object {start, end} with the positions in seconds from the beginning of the buffer
    * @param preserveResults boolean determines whether to clear the result table
    * @param play whether to auto-play the audio
    * @returns {Promise<void>}
    */
    let NEXT_BUFFER;
    async function onWorkerLoadedAudio({
        location,
        start = 0,
        sourceDuration = 0,
        bufferBegin = 0,
        file = '',
        position = 0,
        buffer = undefined,
        contents = undefined,
        fileRegion = undefined,
        play = false,
        queued = false,
        goToRegion = true
    }) {
        fileLoaded = true, locationID = location;
        clearTimeout(loadingTimeout)
        // Clear the loading animation
        const loading = document.getElementById('loadingOverlay')
        loading.classList.add('d-none');
        const resetSpec = !currentFile;
        currentFileDuration = sourceDuration;
        //if (preserveResults) completeDiv.hide();
        console.log(`UI received worker-loaded-audio: ${file}, buffered: ${contents === undefined}`);
        if (contents) {
            currentBuffer = new AudioBuffer({ length: contents.length, numberOfChannels: 1, sampleRate: sampleRate });
            currentBuffer.copyToChannel(contents, 0);
        } else {
            currentBuffer = buffer;
        }
        if (queued) {
            // Prepare arguments to call this function with
            NEXT_BUFFER = {
                start: start, sourceDuration: sourceDuration, bufferBegin: bufferBegin, file: file,
                buffer: currentBuffer, play: true, resetSpec: false, queued: false
            }
        } else {
            NEXT_BUFFER = undefined;
            if (currentFile !== file) {
                currentFile = file;
                renderFilenamePanel();
                fileStart = start;
                fileEnd = new Date(fileStart + (currentFileDuration * 1000));
            }
            if (config.timeOfDay) {
                bufferStartTime = new Date(fileStart + (bufferBegin * 1000))
            } else {
                bufferStartTime = new Date(zero.getTime() + (bufferBegin * 1000))
            }
            if (windowLength > currentFileDuration) windowLength = currentFileDuration;
            
            
            updateSpec({ buffer: currentBuffer, position: position, play: play, resetSpec: resetSpec });
            wavesurfer.bufferRequested = false;
            if (modelReady) {
                enableMenuItem(['analyse']);
                if (fileList.length > 1) enableMenuItem(['analyseAll'])
            }
            if (fileRegion) {
                createRegion(fileRegion.start, fileRegion.end, fileRegion.label, goToRegion);
                if (fileRegion.play) {
                    region.play()
                }
            } else {
                clearActive();
            }
            fileLoaded = true;
            //if (activeRow) activeRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
    
    function onProgress(args) {
        DOM.progressDiv.classList.remove('d-none');
        if (args.text) {
            DOM.fileNumber.innerHTML = args.text;
        } else {
            DOM.progressDiv.classList.remove('d-none');
            const count = fileList.indexOf(args.file) + 1;
            DOM.fileNumber.textContent = `File ${count} of ${fileList.length}`;
        }
        if (args.progress) {
            let progress = Math.round(args.progress * 1000) / 10;
            updateProgress(progress);
        } else {
            DOM.progressDiv.classList.remove('d-none');
        }
    }
    
    function updatePagination(total, offset) {
        //Pagination
        total > config.limit ? addPagination(total, offset) : pagination.forEach(item => item.classList.add('d-none'));
    }
    
    const updateSummary = ({ summary = [], filterSpecies = '' }) => {
        let total, summaryHTML = `<table id="resultSummary" class="table table-dark p-1"><thead>
        <tr>
        <th class="col-3" scope="col">Max</th>
        <th class="col-5" scope="col">Species</th>
        <th class="col-1 text-end" scope="col">Detections</th>
        <th class="col-1 text-end" scope="col">Calls</th>
        </tr>
        </thead><tbody id="speciesFilter">`;
        
        for (let i = 0; i < summary.length; i++) {
            const item = summary[i];
            const selected = item.cname === filterSpecies ? ' text-warning' : '';
            summaryHTML += `<tr tabindex="-1" class="${selected}">
            <td class="max">${iconizeScore(item.max)}</td>
            <td class="cname">
            <span class="cname">${item.cname}</span> <br><i>${item.sname}</i>
            </td>
            <td class="text-end">${item.count}</td>
            <td class="text-end">${item.calls}</td>
            </tr>`;
            
        }
        summaryHTML += '</tbody></table>';
        // Get rid of flicker...
        const old_summary = summaryTable;
        const buffer = old_summary.cloneNode();
        buffer.innerHTML = summaryHTML;
        old_summary.replaceWith(buffer);
        const currentFilter = document.querySelector('#speciesFilter tr.text-warning');
        if (currentFilter) currentFilter.focus();
    }
    
    /*
    onResultsComplete is called when the last result is sent from the database
    */
    function onResultsComplete({active = undefined, select = undefined} = {}){
        let table = document.getElementById('resultTableBody');
        table.replaceWith(resultsBuffer);
        table = document.getElementById('resultTableBody');

        // Set active Row        
        if (active) {
            // Refresh node and scroll to active row:
            activeRow = table.rows[active];
            if (! activeRow) { // because: after an edit the active row may not exist
                const rows = table.querySelectorAll('tr.daytime, tr.nighttime')
                if (rows.length) {
                    activeRow = rows[rows.length - 1];
                }
            } else {
                activeRow.classList.add('table-active');
            }
        } else if (select) {
            const row = getRowFromStart(table, select)
            activeRow = table.rows[row];
        }
        else { // if (STATE.mode === 'analyse') {
            activeRow = table.querySelector('.table-active');
            if (!activeRow) {
                // Select the first row
                activeRow = table.querySelector('tr:first-child');
            }
        }
        
        if (activeRow) {
            activeRow.focus();
            activeRow.click();
        }
        // hide progress div
        DOM.progressDiv.classList.add('d-none');
        
    }

    function getRowFromStart(table, start){
        for (var i = 0; i < table.rows.length; i++) {
            const row = table.rows[i];
            // Get the value of the name attribute and split it on '|'
            // Start time is the second value in the name string
            const nameAttr = row.getAttribute('name')
            // no nameAttr for start civil twilight row
            const startTime = nameAttr ? nameAttr.split('|')[1] : 0;
            
            // Check if the second value matches the 'select' variable
            if (parseFloat(startTime) === start) {
                return i; 
            }
        }
    }
    
    function onAnalysisComplete(){
        PREDICTING = false;
        STATE.analysisDone = true;
        DOM.progressDiv.classList.add('d-none');
        // DIAGNOSTICS:
        t1_analysis = Date.now();
        const analysisTime = ((t1_analysis - t0_analysis) / 1000).toFixed(2);
        const duration = STATE.selection ? STATE.selection.end - STATE.selection.start : DIAGNOSTICS['Audio Duration'];
        const rate = duration / analysisTime;
        
        trackEvent(config.UUID, `${config.model}-${config[config.model].backend}`, 'Audio Duration', config[config.model].backend, Math.round(duration));
        trackEvent(config.UUID, `${config.model}-${config[config.model].backend}`, 'Analysis Duration', config[config.model].backend, parseInt(analysisTime));
        trackEvent(config.UUID, `${config.model}-${config[config.model].backend}`, 'Analysis Rate', config[config.model].backend, parseInt(rate));
        
        if (! STATE.selection){
            DIAGNOSTICS['Analysis Duration'] = analysisTime + ' seconds';
            DIAGNOSTICS['Analysis Rate'] = rate.toFixed(0) + 'x faster than real time performance.';
            generateToast({ message:'Analysis complete.'});
            activateResultFilters();
        }
    }
    
    /* 
    onSummaryComplete is called when getSummary finishes.
    */
    function onSummaryComplete({
        filterSpecies = undefined,
        audacityLabels = {},
        summary = [],
        active = undefined,
    }) {
        updateSummary({ summary: summary, filterSpecies: filterSpecies });
        if (! PREDICTING  || STATE.mode !== 'analyse') activateResultFilters();
        // Why do we do audacity labels here?
        AUDACITY_LABELS = audacityLabels;
        if (! isEmptyObject(AUDACITY_LABELS)) {
            enableMenuItem(['saveLabels', 'saveCSV', 'save-eBird', 'save-Raven', 'save2db', 'export2audio']);
        } else {
            disableMenuItem(['saveLabels', 'saveCSV', 'save-eBird', 'save-Raven']);
        }
        if (currentFile) enableMenuItem(['analyse'])
    }
    
    
    const pagination = document.querySelectorAll('.pagination');
    pagination.forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.tagName === 'A') { // Did we click a link in the list?
                let clicked = e.target.textContent;
                let currentPage = pagination[0].querySelector('.active');
                currentPage = parseInt(currentPage.textContent);
                if (clicked === 'Previous') {
                    clicked = currentPage - 1
                } else if (clicked === 'Next') {
                    clicked = currentPage + 1
                } else {
                    clicked = parseInt(clicked)
                }
                const limit = config.limit;
                const offset = (clicked - 1) * limit;
                // Tell the worker about the new offset
                const species = isSpeciesViewFiltered(true);
                species ? worker.postMessage({action:'update-state', filteredOffset: {[species]: offset} }) :
                    worker.postMessage({action:'update-state', globalOffset: offset });
                filterResults({offset: offset, limit:limit})
                resetResults({clearSummary: false, clearPagination: false, clearResults: false});
            }
        })
    })
    
    const addPagination = (total, offset) => {
        const limit = config.limit;
        const pages = Math.ceil(total / limit);
        const currentPage = (offset / limit) + 1;
        let list = '';
        for (let i = 1; i <= pages; i++) {
            if (i === 1) {
                list += i === currentPage ? '<li class="page-item disabled"><span class="page-link" href="#">Previous</span></li>'
                : '<li class="page-item"><a class="page-link" href="#">Previous</a></li>';
            }
            if (i <= 2 || i > pages - 2 || (i >= currentPage - 2 && i <= currentPage + 2)) {
                list += i === currentPage ? '<li class="page-item active" aria-current="page"><span class="page-link" href="#">' + i + '</span></li>' :
                '<li class="page-item"><a class="page-link" href="#">' + i + '</a></li>';
            } else if (i === 3 || i === pages - 3) {
                list += '<li class="page-item disabled"><span class="page-link" href="#">...</span></li>';
            }
            if (i === pages) {
                list += i === currentPage ? '<li class="page-item disabled"><span class="page-link" href="#">Next</span></li>'
                : '<li class="page-item"><a class="page-link" href="#">Next</a></li>';
            }
        }
        pagination.forEach(item => {
            item.classList.remove('d-none');
            item.innerHTML = list;
        })
    }
    
    const summary = document.getElementById('summary');
    // summary.addEventListener('click', speciesFilter);
    
    function speciesFilter(e) {
        if (PREDICTING || ['TBODY', 'TH', 'DIV'].includes(e.target.tagName)) return; // on Drag or clicked header
        clearActive();
        let species, range;
        // Am I trying to unfilter?
        if (e.target.closest('tr').classList.contains('text-warning')) {
            e.target.closest('tr').classList.remove('text-warning');
        } else {
            //Clear any highlighted rows
            const tableRows = summary.querySelectorAll('tr');
            tableRows.forEach(row => row.classList.remove('text-warning'))
            // Add a highlight to the current row
            e.target.closest('tr').classList.add('text-warning');
            // Clicked on unfiltered species
            species = getSpecies(e.target)
        }
        if (isExplore()) {
            range = STATE.explore.range;
            const list = document.getElementById('bird-list-seen');
            list.value = species || '';
        }
        filterResults()
        resetResults({clearSummary: false, clearPagination: false, clearResults: false});
    }
    
    
    // const checkDayNight = (timestamp) => {
    //     let astro = SunCalc.getTimes(timestamp, config.latitude, config.longitude);
    //     return (astro.dawn.setMilliseconds(0) < timestamp && astro.dusk.setMilliseconds(0) > timestamp) ? 'daytime' : 'nighttime';
    // }
    
    // TODO: show every detection in the spec window as a region on the spectrogram
    
    async function renderResult({
        index = 1,
        result = {},
        file = undefined,
        isFromDB = false,
        selection = false
    }) {

        let tr = '';
        if (typeof (result) === 'string') {
            // const nocturnal = config.detect.nocmig ? '<b>during the night</b>' : '';
            generateToast({ message: result});
            return
        }
        if (index <= 1) {
            if (selection) {
                const selectionTable = document.getElementById('selectionResultTableBody');
                selectionTable.textContent = '';
            }
            else {
                adjustSpecDims(true); 
                if (isFromDB) PREDICTING = false;
                
                DOM.resultHeader.innerHTML =`
                <tr>
                    <th id="sort-time" class="time-sort col text-start timeOfDay" title="Sort results by detection time"><span class="text-muted material-symbols-outlined time-sort-icon d-none">sort</span> Time</th>
                    <th id="sort-position" class="time-sort text-start timestamp" title="Sort results by detection time"><span class="text-muted material-symbols-outlined time-sort-icon d-none">sort</span> Position</th>
                    <th id="confidence-sort" class="text-start" title="Sort results by detection confidence"><span class="text-muted material-symbols-outlined species-sort-icon d-none">sort</span> Species</th>
                    <th class="text-end">Calls</th>
                    <th class="col">Label</th>
                    <th class="col text-end">Notes</th>
                </tr>`;
                setTimelinePreferences();
                //showSortIcon();
                showElement(['resultTableContainer', 'resultsHead'], false);
            }
        }  else if (!isFromDB && index % (config.limit + 1) === 0) {
            addPagination(index, 0)
        }
        if (!isFromDB && index > config.limit) {
            return
        } else {
            const {
                timestamp,
                position,
                active,
                sname,
                cname,
                score,
                label,
                comment,
                end,
                count,
                callCount,
                isDaylight
            } = result;
            const dayNight = isDaylight ? 'daytime' : 'nighttime'; // checkDayNight(timestamp);
            if (dayNight === 'nighttime') seenTheDarkness = true;
            // Todo: move this logic so pre dark sections of file are not even analysed
            if (config.detect.nocmig && !selection && dayNight === 'daytime') return
            
            // Show twilight indicator when  nocmig mode off (except when analysing a selection)
            if (shownDaylightBanner === false && dayNight === 'daytime') {
                // Only do this if change starts midway through a file
                if ((index - 1) % config.limit !== 0) {
                    // Show the twilight start bar
                    tr += `<tr class="text-bg-dark"><td colspan="20" class="text-center text-white">
                    Start of civil twilight <span class="material-symbols-outlined text-warning align-bottom">wb_twilight</span>
                    </td></tr>`;
                }
                shownDaylightBanner = true;
            }
            const commentHTML = comment ?
            `<span title="${comment.replaceAll('"', '&quot;')}" class='material-symbols-outlined pointer'>comment</span>` : '';
            const isUncertain = score < 65 ? '&#63;' : '';
            // store result for feedback function to use
            predictions[index] = result;
            // Format date and position for  UI
            const tsArray = new Date(timestamp).toString().split(' ');
            const UI_timestamp = `${tsArray[2]} ${tsArray[1]} ${tsArray[3].substring(2)}<br/>${tsArray[4]}`;
            const spliceStart = position < 3600 ? 14 : 11;
            const UI_position = new Date(position * 1000).toISOString().substring(spliceStart, 19);
            const showTimeOfDay = config.timeOfDay ? '' : 'd-none';
            const showTimestamp = config.timeOfDay ? 'd-none' : '';
            const activeTable = active ? 'table-active' : '';
            const labelHTML = label ? tags[label] : '';
            const hide = selection ? 'd-none' : '';
            const countIcon = count > 1 ? `<span class="circle pointer" title="Click to view the ${count} detections at this timecode">${count}</span>` : '';
            const XC_type = cname.includes('(song)') ? "song" : "nocturnal flight call";
            tr += `<tr tabindex="-1" id="result${index}" name="${file}|${position}|${end || position + 3}|${sname}|${cname}${isUncertain}" class='${activeTable} border-top border-2 border-secondary ${dayNight}'>
            <td class='text-start text-nowrap timeOfDay ${showTimeOfDay}'>${UI_timestamp}</td>
            <td class="text-start timestamp ${showTimestamp}">${UI_position} </td>
            <td name="${cname}" class='text-start cname'>
            <span class="cname">${cname}</span> ${countIcon} ${iconizeScore(score)}
            </td>
            <td class="text-end call-count ${hide}">${callCount || 'Present'} </td>
            
            <td class="label ${hide}">${labelHTML}</td>
            <td class="comment text-end ${hide}">${commentHTML}</td>
            
            </tr>`;
        }
        updateResultTable(tr, isFromDB, selection);
    }
    
    
    let resultsBuffer = document.getElementById('resultTableBody').cloneNode(false), detectionsModal;
    const detectionsModalDiv = document.getElementById('detectionsModal')
    
    detectionsModalDiv.addEventListener('hide.bs.modal', (e) => {
        worker.postMessage({ action: 'update-state', selection: undefined });
    });
    
    
    const updateResultTable = (row, isFromDB, isSelection) => {
        const table = isSelection ? document.getElementById('selectionResultTableBody')
        : document.getElementById('resultTableBody');
        if (isFromDB && !isSelection) {
            //if (!resultsBuffer) resultsBuffer = table.cloneNode();
            resultsBuffer.lastElementChild ?
            resultsBuffer.lastElementChild.insertAdjacentHTML('afterend', row) :
            resultsBuffer.innerHTML = row;
            
        } else {
            if (isSelection) {
                if (!detectionsModal || !detectionsModal._isShown) {
                    detectionsModal = new bootstrap.Modal('#detectionsModal', { backdrop: 'static' });
                    detectionsModal.show();
                }
            }
            table.lastElementChild ? table.lastElementChild.insertAdjacentHTML('afterend', row) :
            table.innerHTML = row;
        }
    };
    
    const isExplore = () => {
        return STATE.mode === 'explore';
    };
    
    
    
    const tags = {
        Local: '<span class="badge bg-success rounded-pill">Local</span>',
        Nocmig: '<span class="badge bg-dark rounded-pill">Nocmig</span>',
    }
    
    // Results event handlers
    
    function setClickedIndex(target) {
        const clickedNode = target.closest('tr');
        clickedIndex = clickedNode.rowIndex;
    }
    
    const deleteRecord = (target) => {
        if (target === activeRow) {}
        else if (target instanceof PointerEvent) target = activeRow;
        else {
            //I'm not sure what triggers this
            target.forEach(position => {
                const [start, end] = position;
                worker.postMessage({
                    action: 'delete',
                    file: currentFile,
                    start: start,
                    end: end,
                    active: getActiveRowID(),
                })
            })
            activeRow = undefined;
            return
        }
        if (target.childElementCount === 2) return; // No detections found in selection
        
        setClickedIndex(target);
        // prepare the undelete record
        const [file, start, end,] = unpackNameAttr(target);
        const setting = target.closest('table');
        if (setting){
            const row = target.closest('tr');
            let cname = target.querySelector('.cname').innerText;
            let [species, confidence] = cname.split('\n');
            // confirmed records don't have a confidence bar
            if (!confidence) {
                species =  species.slice(0, -9); // remove ' verified'
                confidence = 2000;
            } else { confidence = parseInt(confidence.replace('%', '')) * 10 }
            const comment = target.querySelector('.comment').innerText;
            const label = target.querySelector('.label').innerText;
            let callCount = target.querySelector('.call-count').innerText;
            callCount = callCount.replace('Present', '');
            DELETE_HISTORY.push([species, start, end, comment, callCount, label, undefined, undefined, undefined, confidence])
            
            worker.postMessage({
                action: 'delete',
                file: file,
                start: start,
                end: end,
                species: getSpecies(target),
                speciesFiltered: isSpeciesViewFiltered()
            })
            // Clear the record in the UI
            const index = row.rowIndex
            // there may be no records remaining (no index)
            index > -1 && setting.deleteRow(index);
            setting.rows[index]?.click()
        }
    }
    
    const deleteSpecies = (target) => {
        worker.postMessage({
            action: 'delete-species',
            species: getSpecies(target),
            speciesFiltered: isSpeciesViewFiltered()
        })
        // Clear the record in the UI
        const row = target.closest('tr');
        const table = document.getElementById('resultSummary')
        const rowClicked = row.rowIndex;
        table.deleteRow(rowClicked);
        const resultTable = document.getElementById('resultTableBody');
        resultTable.innerHTML = '';
        // Highlight the next row
        const newRow = table.rows[rowClicked]
        newRow?.click();
    }
    
    function sendFile(mode, result) {
        let start, end, filename;
        if (result) {
            start = result.position;
            end = result.end || start + 3;
            const dateArray = new Date(result.timestamp).toString().split(' ');
            const datetime = dateArray.slice(0, 5).join(' ');
            filename = `${result.cname}_${datetime}.${config.audio.format}`;
        } else if (start === undefined) {
            if (region.start) {
                start = region.start + bufferBegin;
                end = region.end + bufferBegin;
            } else {
                start = 0;
                end = currentBuffer.duration;
            }
            const dateArray = new Date(fileStart + (start * 1000)).toString().split(' ');
            const dateString = dateArray.slice(0, 5).join(' ');
            filename = dateString + '.' + config.audio.format;
        }
        
        let metadata = {
            lat: config.latitude,
            lon: config.longitude,
            Artist: 'Chirpity',
            date: new Date().getFullYear(),
            version: VERSION
        };
        if (result) {
            metadata = {
                ...metadata,
                UUID: config.UUID,
                start: start,
                end: end,
                filename: result.filename,
                cname: result.cname,
                sname: result.sname,
                score: result.score,
                date: result.date
            };
        }
        
        if (mode === 'save') {
            worker.postMessage({
                action: 'save',
                start: start, file: currentFile, end: end, filename: filename, metadata: metadata
            })
        } else {
            if (!config.seenThanks) {
                generateToast({ message:'Thank you, your feedback helps improve Chirpity predictions'});
                config.seenThanks = true;
                updatePrefs('config.json', config)
            }
            worker.postMessage({
                action: 'post',
                start: start, file: currentFile, end: end, defaultName: filename, metadata: metadata, mode: mode
            })
        }
    }
    
    const iconDict = {
        guess: '<span class="confidence-row"><span class="confidence bar" style="flex-basis: --%; background: grey">--%</span></span>',
        low: '<span class="confidence-row"><span class="confidence bar" style="flex-basis: --%; background: rgba(255,0,0,0.5)">--%</span></span>',
        medium: '<span class="confidence-row"><span class="confidence bar" style="flex-basis: --%; background: #fd7e14">--%</span></span>',
        high: '<span class="confidence-row"><span class="confidence bar" style="flex-basis: --%; background: #198754">--%</span></span>',
        confirmed: '<span class="material-symbols-outlined" title="Confirmed Record">verified</span>',
    }
    
    
    const iconizeScore = (score) => {
        const tooltip = score.toString();
        if (score < 50) return iconDict['guess'].replaceAll('--', tooltip);
        else if (score < 65) return iconDict['low'].replaceAll('--', tooltip);
        else if (score < 85) return iconDict['medium'].replaceAll('--', tooltip);
        else if (score <= 100) return iconDict['high'].replaceAll('--', tooltip);
        else return iconDict['confirmed']
    }
    
    // File menu handling
    
    const exportAudio = () => {
        let result;
        if (region.attributes.label) {
            setClickedIndex(activeRow);
            result = predictions[clickedIndex]
        }
        sendFile('save', result)
    }
    

    const populateHelpModal = async (file, label) => {
        document.getElementById('helpModalLabel').textContent = label;
        const response = await fetch(file);
        document.getElementById('helpModalBody').innerHTML = await response.text();
        const help = new bootstrap.Modal(document.getElementById('helpModal'));
        help.show();
        document.addEventListener('shown.bs.modal', replaceCtrlWithCommand)
    }
    function replaceTextInTitleAttributes() {
        // Select all elements with title attribute in the body of the web page
        const elementsWithTitle = document.querySelectorAll('[title]');
        
        // Iterate over each element with title attribute
        elementsWithTitle.forEach(element => {
            // Replace 'Ctrl' with ⌘ in the title attribute value
            element.title = element.title.replaceAll('Ctrl', '⌘');
        });
    }
    
    function replaceTextInTextNode(node) {
        node.nodeValue = node.nodeValue.replaceAll('Ctrl', '⌘');
    }
    
    function replaceCtrlWithCommand() {
        if (isMac){
            // Select all text nodes in the body of the web page
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
            const nodes = [];
            let node;
            
            // Iterate over each text node
            while ((node = walker.nextNode())) {
                nodes.push(node);
            }
            
            // Replace 'Ctrl' with ⌘ in each text node
            nodes.forEach(node => replaceTextInTextNode(node));
            
            // Replace 'Ctrl' with ⌘ in title attributes of elements
            replaceTextInTitleAttributes();
        }
    }
    
    const populateSpeciesModal = async (included, excluded) => {
        const count = included.length;
        const current_file_text =  STATE.week !== -1 && STATE.week ? `. The current file was saved in week <b>${STATE.week}</b>` : '';
        const model = config.model === 'birdnet' ? 'BirdNET' : 'Chirpity';
        const localBirdsOnly = config.local && config.model === 'birdnet' && config.list === 'nocturnal' ? ' limited to <b>local birds</b>' : '';
        const species_filter_text = config.useWeek && config.list === 'location' ? `week-specific species filter threshold of <b>${config.speciesThreshold}</b>` : config.list === 'location' ? `species filter threshold of <b>${config.speciesThreshold}</b>` : '';  
        const location_filter_text = config.list === 'location' ? ` focused on <b>${place.textContent.replace('fmd_good', '')}</b>, with a ${species_filter_text}${current_file_text}` : '';
        let includedContent = `<br/><p>The number of species detected depends on the model, the list being used and in the case of the location filter, the species filter threshold and possibly the week in which the recording was made.<p>
        You are using the <b>${model}</b> model and the <b>${config.list}</b> list${localBirdsOnly}${location_filter_text}. With these settings, Chirpity will display detections for ${config.useWeek && config.list === 'location' && (STATE.week === -1 || !STATE.week ) ? 'up to' : ''} 
        <b>${count}</b> classes${config.useWeek && config.list === 'location' && (STATE.week === -1 || !STATE.week ) ? ', depending on the date of the file you analyse' : ''}:</p>`;
        includedContent += '<table class="table table-striped"><thead class="sticky-top text-bg-dark"><tr><th>Common Name</th><th>Scientific Name</th></tr></thead><tbody>\n';
        includedContent += generateBirdIDList(included);
        includedContent += '</tbody></table>\n';
        let excludedContent = '', disable = '';
        if (excluded){
            excludedContent += `<br/><p>Conversely, the application will not display detections among the following ${excluded.length} classes:</p><table class="table table-striped"><thead class="sticky-top text-bg-dark"><tr><th>Common Name</th><th>Scientific Name</th></tr></thead><tbody>\n`;
            excludedContent += generateBirdIDList(excluded);
            excludedContent += '</tbody></table>\n';
        } else {
            disable = ' disabled'
        }
        let modalContent =  `
        <ul class="nav nav-tabs" id="myTab" role="tablist">
        <li class="nav-item" role="presentation">
        <button class="nav-link active" id="included-tab" data-bs-toggle="tab" data-bs-target="#included-tab-pane" type="button" role="tab" aria-controls="included-tab-pane" aria-selected="true">Included</button>
        </li>
        <li class="nav-item" role="presentation">
        <button class="nav-link" id="excluded-tab" data-bs-toggle="tab" data-bs-target="#excluded-tab-pane" type="button" role="tab" aria-controls="excluded-tab-pane" aria-selected="false" ${disable}>Excluded</button>
        </li>
        </ul>
        <div class="tab-content" id="myTabContent">
        <div class="tab-pane fade show active" id="included-tab-pane" role="tabpanel" aria-labelledby="included-tab" tabindex="0" style="max-height: 50vh;overflow: auto">${includedContent}</div>
        <div class="tab-pane fade" id="excluded-tab-pane" role="tabpanel" aria-labelledby="excluded-tab" tabindex="0" style="max-height: 50vh;overflow: auto">${excludedContent}</div>
        </div>
        `;
        document.getElementById('speciesModalBody').innerHTML = modalContent;
        const species = new bootstrap.Modal(document.getElementById('speciesModal'));
        species.show();
        STATE.includedList = included;
    }


    // exporting a list
    function exportSpeciesList() {
        const included = STATE.includedList;
        // Create a blob containing the content of included array
        const content = included.map(item => `${item.sname}_${item.cname}`).join('\n');
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "species_list.txt";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    function setNocmig(on) {
        if (on) {
            DOM.nocmigButton.textContent = 'nights_stay';
            DOM.nocmigButton.title = 'Nocmig mode on';
            DOM.nocmigButton.classList.add('text-info');
        } else {
            DOM.nocmigButton.textContent = 'bedtime_off';
            DOM.nocmigButton.title = 'Nocmig mode off';
            DOM.nocmigButton.classList.remove('text-info');
        }
        DOM.nocmig.checked = config.detect.nocmig;
    }
    
    const changeNocmigMode = () => {
        config.detect.nocmig = !config.detect.nocmig;
        setNocmig(config.detect.nocmig);
        worker.postMessage({
            action: 'update-state',
            detect: { nocmig: config.detect.nocmig },
            globalOffset: 0, filteredOffset: {}
        });
        updatePrefs('config.json', config)
        if (STATE.analysisDone){
        resetResults({clearSummary: true, clearPagination: true, clearResults: false});
        filterResults()
        }
    }
    
    function filterResults({species = isSpeciesViewFiltered(true), updateSummary = true, offset = undefined, limit = 500, range = undefined} = {}){
        STATE.analysisDone && worker.postMessage({
            action: 'filter',
            species: species,
            updateSummary: updateSummary,
            offset: offset,
            limit: limit,
            range: range
        })
    }
    const modelSettingsDisplay = () => {
        const chirpityOnly = document.querySelectorAll('.chirpity-only');
        const noMac = document.querySelectorAll('.no-mac');
        const nodeOnly = document.querySelectorAll('.node-only');
        if (config.model === 'birdnet'){
            // hide chirpity-only features
            chirpityOnly.forEach(element => element.classList.add('d-none'));
            if (config.list === 'nocturnal')  {
                DOM.localSwitchContainer.classList.remove('d-none');
            }
            DOM.contextAware.checked = false;
            DOM.contextAware.disabed = true;
            config.detect.contextAware = false;
            SNRSlider.disabled = true;
            config.filters.SNR = 0;
        } else {
            // show chirpity-only features
            chirpityOnly.forEach(element => element.classList.remove('d-none'));
            // Remove GPU option on Mac
            isMac && noMac.forEach(element => element.classList.add('d-none'));
            DOM.contextAware.checked = config.detect.contextAware;
            DOM.localSwitchContainer.classList.add('d-none');
            SNRSlider.disabled = false;
            if (config.hasNode){
                nodeOnly.forEach(element => element.classList.remove('d-none'));
            } else {
                nodeOnly.forEach(element => element.classList.add('d-none'));
            }
        }
    }

    const contextAwareIconDisplay = () => {
        if (config.detect.contextAware) {
            DOM.contextAwareIcon.classList.add('text-warning');
            DOM.contextAwareIcon.title = "Context aware mode enabled";
        } else {
            DOM.contextAwareIcon.classList.remove('text-warning');
            DOM.contextAwareIcon.title = "Context aware mode disabled";
        }
    };
    
    const toggleFilters = () => {
        config.filters.active = !config.filters.active;
        worker.postMessage({
            action: 'update-state',
            filters: { active: config.filters.active },
        });
        updatePrefs('config.json', config)
        showFilterEffect();
        filterIconDisplay();
    }
    
    // DOM.audioFiltersIcon.addEventListener('click', toggleFilters);
    
    const toggleContextAwareMode = () => {
        if (config.model !== 'birdnet') config.detect.contextAware = !config.detect.contextAware;
        DOM.contextAware.checked = config.detect.contextAware;
        contextAwareIconDisplay();
        if (config.detect.contextAware) {
            SNRSlider.disabled = true;
            config.filters.SNR = 0;
        } else if (config[config.model].backend !== 'webgl'  && config.model !== 'birdnet') {
            SNRSlider.disabled = false;
            config.filters.SNR = parseFloat(SNRSlider.value);
        }
        worker.postMessage({
            action: 'update-state',
            detect: { contextAware: config.detect.contextAware },
            filters: { SNR: config.filters.SNR },
        });
        updatePrefs('config.json', config)
    }
    //DOM.contextAwareIcon.addEventListener('click', toggleContextAwareMode)
    
    DOM.debugMode.addEventListener('click', () =>{
        config.debug = !config.debug;
        DOM.debugMode.checked = config.debug;
        updatePrefs('config.json', config)
    })
    
    //DOM.nocmigButton.addEventListener('click', changeNocmigMode);
    //const fullscreen = document.getElementById('fullscreen');
    
    const toggleFullscreen = () => {
        if (config.fullscreen) {
            config.fullscreen = false;
            fullscreen.textContent = 'fullscreen';
        } else {
            config.fullscreen = true;
            fullscreen.textContent = 'fullscreen_exit';
        }
        updatePrefs('config.json', config)
        adjustSpecDims(true, 512);
    }
    
    //fullscreen.addEventListener('click', toggleFullscreen);
    
    
    const diagnosticMenu = document.getElementById('diagnostics');
    diagnosticMenu.addEventListener('click', async function () {
        DIAGNOSTICS['Model'] = DOM.modelToUse.options[DOM.modelToUse.selectedIndex].text;
        DIAGNOSTICS['Backend'] = config[config.model].backend;
        DIAGNOSTICS['Batch size'] = config[config[config.model].backend].batchSize;
        DIAGNOSTICS['Threads'] = config[config[config.model].backend].threads;
        DIAGNOSTICS['Context'] = config.detect.contextAware;
        DIAGNOSTICS['SNR'] = config.filters.SNR;
        DIAGNOSTICS['List'] = config.list;
        let diagnosticTable = "<table class='table-hover table-striped p-2 w-100'>";
        for (let [key, value] of Object.entries(DIAGNOSTICS)) {
            if (key === 'Audio Duration') { // Format duration as days, hours,minutes, etc.
                if (value < 3600) {
                    value = new Date(value * 1000).toISOString().substring(14, 19);
                    value = value.replace(':', ' minutes ').concat(' seconds');
                } else if (value < 86400) {
                    value = new Date(value * 1000).toISOString().substring(11, 19)
                    value = value.replace(':', ' hours ').replace(':', ' minutes ').concat(' seconds')
                } else {
                    value = new Date(value * 1000).toISOString().substring(8, 19);
                    const day = parseInt(value.slice(0, 2)) - 1;
                    const daysString = day === 1 ? '1 day ' : day.toString() + ' days ';
                    const dateString = daysString + value.slice(3);
                    value = dateString.replace(':', ' hours ').replace(':', ' minutes ').concat(' seconds');
                }
            }
            diagnosticTable += `<tr><th scope="row">${key}</th><td>${value}</td></tr>`;
        }
        diagnosticTable += "</table>";
        document.getElementById('diagnosticsModalBody').innerHTML = diagnosticTable;
        const testModal = new bootstrap.Modal(document.getElementById('diagnosticsModal'));
        testModal.show();
    });
    

    
    function activateResultFilters() {
        const timeHeadings = document.getElementsByClassName('time-sort-icon');
        const speciesHeadings = document.getElementsByClassName('species-sort-icon');
        
        const sortOrderScore = STATE.sortOrder.includes('score');
        
        [...timeHeadings].forEach(heading => {
            heading.classList.toggle('d-none', sortOrderScore);
            heading.parentNode.classList.add('pointer');
        });
        
        [...speciesHeadings].forEach(heading => {
            heading.classList.toggle('d-none', !sortOrderScore);
            heading.parentNode.classList.add('pointer');
            if (sortOrderScore && STATE.sortOrder.includes('ASC')){
                // Flip the sort icon
                heading.classList.add('flipped')
            } else {
                heading.classList.remove('flipped')
            }
        });
        // Add pointer icon to species summaries
        const summarySpecies = document.getElementById('summary').querySelectorAll('.cname');
        summarySpecies.forEach(row => row.classList.add('pointer'))
        // change results header to indicate activation
        DOM.resultHeader.classList.remove('text-bg-secondary');
        DOM.resultHeader.classList.add('text-bg-dark');
        // Add a hover to summary to indicate activation
        const summary = document.getElementById('resultSummary');
        // If there were no results, there'll be no summary
        summary?.classList.add('table-hover');
    }
    
    const setSortOrder = (order) => {
        STATE.sortOrder = order;
        worker.postMessage({ action: 'update-state', sortOrder: order })
        resetResults({clearSummary: false, clearPagination: false, clearResults: true});
        filterResults();
    }
    // Drag file to app window to open
    document.addEventListener('dragover', (event) => {
        event.preventDefault();
        event.stopPropagation();
    });
    
    document.addEventListener('drop', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        let filelist = [];
        for (const f of event.dataTransfer.files) {
            // Using the path attribute to get absolute file path
            filelist.push(f.path);
        }
        if (filelist.length) filterValidFiles({ filePaths: filelist })
        trackEvent(config.UUID, 'UI', 'Drop', 'Open Folder(s)', filelist.length);
    });
    
    
    // Prevent drag for UI elements
    document.body.addEventListener('dragstart', e => {
        e.preventDefault()
    });
    
    // Make modals draggable
    document.querySelectorAll('.modal-header').forEach(header => {
        header.removeEventListener('mousedown',makeDraggable);
        makeDraggable(header)
    });
    
    function makeDraggable(header){
        header.addEventListener('mousedown', function (mousedownEvt) {
            const draggable = this;
            const modalContent = draggable.closest('.modal-content');
            const initialLeft = parseFloat(getComputedStyle(modalContent).left);
            const initialTop = parseFloat(getComputedStyle(modalContent).top);
            const x = mousedownEvt.pageX - initialLeft,
                  y = mousedownEvt.pageY - initialTop;
            
            function handleDrag(moveEvt) {
                draggable.closest('.modal-content').style.left = moveEvt.pageX - x + 'px';
                draggable.closest('.modal-content').style.top = moveEvt.pageY - y + 'px';
            }
            
            function stopDrag() {
                document.body.removeEventListener('mousemove', handleDrag);
                document.body.removeEventListener('mouseup', stopDrag);
                draggable.closest('.modal').removeEventListener('hide.bs.modal', stopDrag);
            }
            
            document.body.addEventListener('mousemove', handleDrag);
            document.body.addEventListener('mouseup', stopDrag);
            draggable.closest('.modal').addEventListener('hide.bs.modal', stopDrag);
        });
    }
    ////////// Date Picker ///////////////
    
    function initialiseDatePicker() {
        const currentDate = new Date();
        
        const thisYear = () => {
            const d1 = new Date(currentDate.getFullYear(), 0, 1);
            return [d1, currentDate]
        }
        const lastYear = () => {
            const d1 = new Date(currentDate.getFullYear() -1, 0, 1);
            const d2 = new Date(currentDate.getFullYear() -1, 11, 31, 23, 59, 59, 999);
            return [d1, d2]
        }
        const thisMonth = () => {
            const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            return [startOfMonth, currentDate];
        };
        
        const lastMonth = () => {
            const startOfLastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
            const endOfLastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0, 23, 59, 59, 999);
            
            return [startOfLastMonth, endOfLastMonth];
        };
        const thisWeek = () => {
            const today = currentDate.getDay(); // 0 (Sunday) to 6 (Saturday)
            const startOfWeek = new Date(currentDate);
            startOfWeek.setDate(currentDate.getDate() - today); // Move to the beginning of the week (Sunday)
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6); // Move to the end of the week (Saturday)
            return [startOfWeek, currentDate];
        };
        
        const lastWeek = () => {
            const today = currentDate.getDay(); // 0 (Sunday) to 6 (Saturday)
            const startOfLastWeek = new Date(currentDate);
            startOfLastWeek.setDate(currentDate.getDate() - today - 7); // Move to the beginning of the last week (Sunday)
            const endOfLastWeek = new Date(startOfLastWeek);
            endOfLastWeek.setDate(startOfLastWeek.getDate() + 6); // Move to the end of the last week (Saturday)
            return [startOfLastWeek, endOfLastWeek];
        };
        const lastNight = () => {
            const middayYesterday = new Date(currentDate);
            middayYesterday.setDate(currentDate.getDate() -1);
            middayYesterday.setHours(12, 0, 0, 0); // Set to midday yesterday
            const middayToday = new Date(currentDate);
            middayToday.setHours(12, 0, 0, 0); // Set to midday today
            return [middayYesterday, middayToday];
        };
        ['chartRange', 'exploreRange'].forEach(function(element) {
            element = document.getElementById(element);
            const picker = new easepick.create({
                element: element,
                css: [
                    './node_modules/@easepick/bundle/dist/index.css',
                ],
                format: 'H:mm MMM D, YYYY',
                zIndex: 10,
                calendars: 1,
                autoApply: false,
                plugins: [
                    "RangePlugin",
                    "PresetPlugin",
                    "KbdPlugin",
                    "TimePlugin"
                ],
                PresetPlugin: {
                    customPreset: {
                        'Last Night': lastNight(),
                        'This Week': thisWeek(),
                        'Last Week': lastWeek(),
                        'This Month': thisMonth(),
                        'Last Month': lastMonth(),
                        'This Year': thisYear(),
                        'Last Year': lastYear()
                    }
                },
                TimePlugin: {
                    format: 'HH:mm',
                },
            });
            picker.on('select', (e) =>{
                const {start, end} = e.detail;
                console.log('Range Selected!', JSON.stringify(e.detail))
                if (element.id === 'chartRange') {
                    STATE.chart.range = {start: start.getTime(), end: end.getTime()};
                    worker.postMessage({ action: 'update-state', chart: STATE.chart })
                    t0 = Date.now();
                    worker.postMessage({
                        action: 'chart',
                        species: STATE.chart.species,
                        range: STATE.chart.range,
                        aggregation: STATE.chart.aggregation
                    });
                } else if (element.id === 'exploreRange') {
                    STATE.explore.range = {start: start.getTime(), end: end.getTime()};
                    resetResults({clearSummary: true, clearPagination: true, clearResults: false});
                    worker.postMessage({ action: 'update-state', globalOffset: 0, filteredOffset: {}, explore: STATE.explore}); 
                    filterResults({range:STATE.explore.range})
                }
                
                // Update the seen species list
                worker.postMessage({ action: 'get-detected-species-list' })
            })
            picker.on('clear', (e) =>{
                console.log('Range Cleared!', JSON.stringify(e.detail));
                if (element.id === 'chartRange') {
                    STATE.chart.range = {start: undefined, end: undefined};
                    worker.postMessage({ action: 'update-state', chart: STATE.chart })
                    t0 = Date.now();
                    worker.postMessage({
                        action: 'chart',
                        species: STATE.chart.species,
                        range: STATE.chart.range,
                        aggregation: STATE.chart.aggregation
                    });
                } else if (element.id === 'exploreRange') {
                    STATE.explore.range = {start: undefined, end: undefined};
                    worker.postMessage({ action: 'update-state', globalOffset: 0, filteredOffset: {}, explore: STATE.explore}); 
                    resetResults({clearSummary: true, clearPagination: true, clearResults: false});
                    filterResults({species:STATE.explore.species, range:STATE.explore.range});
                }
            })
            picker.on('click', (e) =>{
                if (e.target.classList.contains('cancel-button')){
                    console.log('cancelled')
                    //element.innerHTML = savedContent;
                }
            })
            picker.on('show', (e) =>{
                picker.setStartTime('12:00')
                picker.setEndTime('12:00')
                
            })
            picker.on('hide', (e) =>{
                const id = STATE.mode === 'chart' ? 'chartRange' : 'exploreRange';
                const element = document.getElementById(id);
                if (! element.textContent){
                    // It's blank
                    element.innerHTML = '<span class="material-symbols-outlined align-bottom">date_range</span><span>Apply a date filter</span> <span class="material-symbols-outlined float-end">expand_more</span>';
                } else if ( ! element.textContent.includes('Apply a date filter')){
                    createDateClearButton(element, picker);
                }
            })
        })
        
    }
    
    function createDateClearButton(element, picker){
        const span = document.createElement('span');
        span.classList.add('material-symbols-outlined', 'text-secondary', 'ps-2')
        element.appendChild(span);
        span.textContent = 'cancel';
        span.title = 'Clear date filter';
        span.id = element.id + '-clear';
        span.addEventListener('click', (e) =>{
            e.stopImmediatePropagation();
            picker.clear();
            element.innerHTML = '<span class="material-symbols-outlined align-bottom">date_range</span><span>Apply a date filter</span> <span class="material-symbols-outlined float-end">expand_more</span>';
        })
    }
    
    
    function toggleKeyDownForFormInputs(){
        const formFields = document.querySelectorAll("input, textarea, select");
        // Disable keyboard shortcuts when any form field gets focus
        formFields.forEach((formField) => {
            formField.addEventListener("focus", () => {
                document.removeEventListener("keydown", handleKeyDownDeBounce, true);
            });
            
            formField.addEventListener("blur", () => {
                document.addEventListener("keydown", handleKeyDownDeBounce, true);
            });
        });
    }
    
    document.addEventListener("DOMContentLoaded", function () {
        document.addEventListener("keydown", handleKeyDownDeBounce, true);
        toggleKeyDownForFormInputs();
        // make menu an accordion for smaller screens
        if (window.innerWidth < 768) {
            
            // close all inner dropdowns when parent is closed
            document.querySelectorAll('.navbar .dropdown').forEach(function (everydropdown) {
                everydropdown.addEventListener('hidden.bs.dropdown', function () {
                    // after dropdown is hidden, then find all submenus
                    this.querySelectorAll('.submenu').forEach(function (everysubmenu) {
                        // hide every submenu as well
                        everysubmenu.style.display = 'none';
                    });
                })
            });
            
            document.querySelectorAll('.dropdown-menu a').forEach(function (element) {
                element.addEventListener('click', function (e) {
                    let nextEl = this.nextElementSibling;
                    if (nextEl?.classList.contains('submenu')) {
                        // prevent opening link if link needs to open dropdown
                        e.preventDefault();
                        if (nextEl.style.display === 'block') {
                            nextEl.style.display = 'none';
                        } else {
                            nextEl.style.display = 'block';
                        }
                        
                    }
                });
            })
        }
        initialiseDatePicker();
    });
    
    
    // Confidence thresholds
    const filterPanelThresholdDisplay = document.getElementById('threshold-value'); // confidence % display in panel
    const settingsPanelThresholdDisplay = document.getElementById('confidence-value');  // confidence % display in settings
    const confidenceSliderDisplay = document.getElementById('confidenceSliderContainer'); // confidence span for slider in panel - show-hide
    const filterPanelRangeInput = document.getElementById('confidenceValue'); // panel range input 
    const settingsPanelRangeInput = document.getElementById('confidence'); // confidence range input in settings
    
    const setConfidence = (e) => {
        //settingsPanelRangeInput.value = e.target.value;
        handleThresholdChange(e);
    }
    
    filterPanelThresholdDisplay.addEventListener('click', (e) => {
        e.stopPropagation();
        filterPanelRangeInput.autofucus = true
        confidenceSliderDisplay.classList.toggle('d-none');
        
    })
    filterPanelRangeInput.addEventListener('click', (e) => {
        e.stopPropagation();
    })

    
    const hideConfidenceSlider = () => {
        confidenceSliderDisplay.classList.add('d-none');
    }
    
    
    function showThreshold(e) {
        const threshold = e instanceof Event ? e.target.valueAsNumber : e;
        filterPanelThresholdDisplay.innerHTML = `<b>${threshold}%</b>`;
        settingsPanelThresholdDisplay.innerHTML = `<b>${threshold}%</b>`;
        filterPanelRangeInput.value = threshold;
        settingsPanelRangeInput.value = threshold;
    }
    settingsPanelRangeInput.addEventListener('input', showThreshold);
    filterPanelRangeInput.addEventListener('input', showThreshold);
    
    const handleThresholdChange = (e) => {
        const threshold = e.target.valueAsNumber;
        config.detect.confidence = threshold;
        updatePrefs('config.json', config)
        worker.postMessage({
            action: 'update-state',
            detect: { confidence: config.detect.confidence }
        });
        if (STATE.mode == 'explore') {
            // Update the seen species list
            worker.postMessage({ action: 'get-detected-species-list' })
        }
        if (!PREDICTING && !DOM.resultTableElement.classList.contains('d-none')) {
            worker.postMessage({ action: 'update-state', globalOffset: 0, filteredOffset: {}});
            resetResults({clearSummary: true, clearPagination: true, clearResults: false});
            filterResults();
        }
    }

    // Filter handling
    const filterIconDisplay = () => {
        if (config.filters.active && (config.filters.highPassFrequency || (config.filters.lowShelfAttenuation && config.filters.lowShelfFrequency) || config.filters.SNR)) {
            DOM.audioFiltersIcon.classList.add('text-warning');
            DOM.audioFiltersIcon.title = 'Experimental audio filters applied';
        } else {
            DOM.audioFiltersIcon.classList.remove('text-warning')
            DOM.audioFiltersIcon.title = 'No audio filters applied';
        }
    }
    // High pass threshold
    const showFilterEffect = () => {
        if (fileLoaded) {
            const position = clamp(wavesurfer.getCurrentTime() / windowLength, 0, 1);
            postBufferUpdate({ begin: bufferBegin, position: position, region: getRegion() })
        }
    }
    
    // SNR
    const handleSNRchange = () => {
        config.filters.SNR = parseFloat(SNRSlider.value);
        if (config.filters.SNR > 0) {
            config.detect.contextAware = false;
            DOM.contextAware.disabled = true;
        } else {
            config.detect.contextAware = DOM.contextAware.checked;
            DOM.contextAware.disabled = false;
        }
        worker.postMessage({ action: 'update-state', filters: { SNR: config.filters.SNR } })
        filterIconDisplay();
    }
    
    
    const SNRThreshold = document.getElementById('SNR-threshold');
    const SNRSlider = document.getElementById('snrValue');
    SNRSlider.addEventListener('input', () => {
        SNRThreshold.textContent = SNRSlider.value;
    });

    const colorMapThreshhold = document.getElementById('color-threshold');
    const colorMapSlider = document.getElementById('color-threshold-slider');
    colorMapSlider.addEventListener('input', () => {
        colorMapThreshhold.textContent = colorMapSlider.value;
    });
    
    const handleHPchange = () => {
        config.filters.highPassFrequency = HPSlider.valueAsNumber;
        config.filters.active || toggleFilters();
        worker.postMessage({ action: 'update-state', filters: { highPassFrequency: config.filters.highPassFrequency } })
        showFilterEffect();
        filterIconDisplay();
    }
    
    const HPThreshold = document.getElementById('HP-threshold');
    const HPSlider = document.getElementById('HighPassFrequency');
    HPSlider.addEventListener('input', () => {
        HPThreshold.textContent = HPSlider.value + 'Hz';
    });
    
    // Low shelf threshold
    const handleLowShelfchange = () => {
        config.filters.lowShelfFrequency = LowShelfSlider.valueAsNumber;
        config.filters.active || toggleFilters();
        worker.postMessage({ action: 'update-state', filters: { lowShelfFrequency: config.filters.lowShelfFrequency } })
        showFilterEffect();
        filterIconDisplay();
    }
    
    const LowShelfThreshold = document.getElementById('LowShelf-threshold');
    const LowShelfSlider = document.getElementById('lowShelfFrequency');
    LowShelfSlider.addEventListener('input', () => {
        LowShelfThreshold.textContent = LowShelfSlider.value + 'Hz';
    });
    
    // Low shelf gain
    const handleAttenuationchange = () => {
        config.filters.lowShelfAttenuation = - lowShelfAttenuation.valueAsNumber;
        config.filters.active = true;
        worker.postMessage({ action: 'update-state', filters: { lowShelfAttenuation: config.filters.lowShelfAttenuation } })
        showFilterEffect();
        filterIconDisplay();
    }
    
    const lowShelfAttenuation = document.getElementById('attenuation');
    const lowShelfAttenuationThreshold = document.getElementById('attenuation-threshold');
    
    lowShelfAttenuation.addEventListener('input', () => {
        lowShelfAttenuationThreshold.textContent = lowShelfAttenuation.value + 'dB';
    });
  
// Show batch size / threads as user moves slider
DOM.batchSizeSlider.addEventListener('input', () => {
    DOM.batchSizeValue.textContent = BATCH_SIZE_LIST[DOM.batchSizeSlider.value]
})

DOM.threadSlider.addEventListener('input', () => {
    DOM.numberOfThreads.textContent = DOM.threadSlider.value;
})
  
DOM.gain.addEventListener('input', () => {
    DOM.gainAdjustment.textContent = DOM.gain.value + 'dB';
})
    
    // Audio preferences:
    
    const showRelevantAudioQuality = () => {
        if (['mp3', 'opus'].includes(config.audio.format)) {
            DOM.audioBitrateContainer.classList.remove('d-none');
            DOM.audioQualityContainer.classList.add('d-none');
        } else if (config.audio.format === 'flac') {
            DOM.audioQualityContainer.classList.remove('d-none');
            DOM.audioBitrateContainer.classList.add('d-none');
        } else {
            DOM.audioQualityContainer.classList.add('d-none');
            DOM.audioBitrateContainer.classList.add('d-none');
        }
    }

    
    document.addEventListener('click', function (e) {
        const target = e.target.closest('[id]')?.id;
        switch (target)
        {
            case 'open-file': { showOpenDialog('openFile'); break }
            case 'open-folder': { showOpenDialog('openDirectory'); break }
            case 'saveLabels': { showSaveDialog(); break }
            case 'saveCSV': { export2CSV(); break }
            case 'save-eBird': { exporteBird(); break }
            case 'save-Raven': { exportRaven(); break }
            case 'export-audio': { exportAudio(); break }
            case 'exit': { exitApplication(); break }

            case 'save2db': { worker.postMessage({ action: 'save2db', file: currentFile }); break }
            case 'export2audio': { batchExportAudio(); break }
            case 'dataset': { worker.postMessage({ action: 'create-dataset', species: isSpeciesViewFiltered(true) }); break }

            case 'analyse': {postAnalyseMessage({ filesInScope: [currentFile] }); break }
            case 'analyseSelection': {getSelectionResults(); break }
            case 'analyseAll': {postAnalyseMessage({ filesInScope: fileList }); break }
            case 'reanalyse': {postAnalyseMessage({ filesInScope: [currentFile], reanalyse: true }); break }
            case 'reanalyseAll': {postAnalyseMessage({ filesInScope: fileList, reanalyse: true }); break }
            
            case 'purge-from-toast': { deleteFile(MISSING_FILE); break }
            case 'locate-missing-file': {
                (async () => await locateFile(MISSING_FILE))(); 
                break }
            case 'purge-file': { deleteFile(currentFile); break }

            case 'keyboardHelp': { (async () => await populateHelpModal('Help/keyboard.html', 'Keyboard shortcuts'))(); break }
            case 'settingsHelp': { (async () => await populateHelpModal('Help/settings.html', 'Settings Help'))(); break }
            case 'usage': { (async () => await populateHelpModal('Help/usage.html', 'Usage Guide'))(); break }
            case 'bugs': { (async () => await populateHelpModal('Help/bugs.html', 'Join the Chirpity Users community'))(); break }
            case 'species': { worker.postMessage({action: 'get-valid-species', file: currentFile}); break }
            case 'startTour': { prepTour(); break }
            case 'eBird': { (async () => await populateHelpModal('Help/ebird.html', 'eBird Record FAQ'))(); break }

            case 'export-list': { exportSpeciesList(); break }

            case 'sort-position':
            case 'sort-time': {
                if (! PREDICTING){
                    setSortOrder('timestamp')
                }
                break;
            }
            case 'confidence-sort': {
                if (! PREDICTING){
                    const sortBy = STATE.sortOrder === 'score DESC ' ? 'score ASC ' : 'score DESC ';
                    setSortOrder(sortBy);
                }
                break;
            }
            case 'reset-defaults': {
                if (confirm('Are you sure you want to revert to the default settings? You will need to relaunch Chirpity to see the changes.')){
                    config = defaultConfig;
                    updatePrefs('config.json', config);
                }
                break;
            }
            case 'reset-spec-frequency': {
                config.audio.minFrequency = 0;
                config.audio.maxFrequency = 11950;
                DOM.fromInput.value = config.audio.minFrequency;
                DOM.fromSlider.value = config.audio.minFrequency;
                DOM.toInput.value = config.audio.maxFrequency;
                DOM.toSlider.value = config.audio.maxFrequency;
                fillSlider(DOM.fromInput, DOM.toInput,  '#C6C6C6', '#0d6efd', DOM.toSlider)
                checkFilteredFrequency();
                worker.postMessage({action: 'update-state', audio: config.audio});
                const fftSamples = wavesurfer.spectrogram.fftSamples;
                wavesurfer.destroy();
                wavesurfer = undefined;
                adjustSpecDims(true, fftSamples);
                document.getElementById('frequency-range').classList.remove('text-warning');
                updatePrefs('config.json', config);
                break;
            }
            case 'increaseFont': {
                const fontScale = parseFloat(Math.min(1.1, config.fontScale + 0.1).toFixed(1)); // Don't let it go above 1.1
                config.fontScale = fontScale;
                setFontSizeScale();
                break;
            }
            case 'decreaseFont': {
                const fontScale = parseFloat(Math.max(0.7, config.fontScale - 0.1).toFixed(1)); // Don't let it go below 0.7
                config.fontScale = fontScale;
                setFontSizeScale();
                break
            }
            case 'speciesFilter': { speciesFilter(e); break}
            case 'context-menu': { 
                e.target.closest('.play') && typeof region !== 'undefined' ? region.play() : console.log('Region undefined')
                break;
            }
            case 'audioFiltersIcon': { toggleFilters(); break }
            case 'context-mode': { toggleContextAwareMode(); break }
            case 'frequency-range': { 
                document.getElementById('frequency-range-panel').classList.toggle('d-none');
                document.getElementById('frequency-range').classList.toggle('active');
                break }
            case 'nocmigMode': { changeNocmigMode(); break }
            case 'fullscreen': { toggleFullscreen(); break}

            case 'apply-location': {setDefaultLocation(); break }
            case 'cancel-location': {cancelDefaultLocation(); break }

            case 'zoomIn':
            case 'zoomOut': {
                zoomSpec(e)
                break;
            }
            case 'cmpZoomIn':
            case 'cmpZoomOut': {
                let minPxPerSec = ws.params.minPxPerSec;
                minPxPerSec = target === 'cmpZoomOut' ? Math.max(minPxPerSec /= 2, 195) : Math.min(minPxPerSec *= 2, 780) ;
                ws.zoom(minPxPerSec);
                ws.spectrogram.init();
                document.querySelector("#recordings .tab-pane.active .carousel-item.active spectrogram > canvas").width = `${ws.drawer.width / ws.params.pixelRatio}px`;
                break;
            }
            case 'clear-call-cache': {
                const data = fs.rm(p.join(appPath, 'XCcache.json'), err =>{
                    if (err) generateToast({message: 'No call cache was found.'}) && config.debug && console.log('No XC cache found', err);
                    else generateToast({message: 'The call cache was successfully cleared.'})
                })
                break;
            }
            case 'playToggle': {
                (async () => await wavesurfer.playPause())()
                break;
            }
            case 'setCustomLocation': { setCustomLocation(); break }
            case 'setFileStart': { showDatePicker(); break }

            // XC API calls (no await)
            case 'context-xc': { getXCComparisons(); break}
        }
        contextMenu.classList.add("d-none");
        if (target !=  'frequency-range' && !e.target.closest('#frequency-range-panel')){
            document.getElementById('frequency-range-panel').classList.add('d-none');
            document.getElementById('frequency-range').classList.remove('active');
        } 
        hideConfidenceSlider();
        config.debug && console.log('clicked', target);
        target && target !== 'result1' && trackEvent(config.UUID, 'UI', 'Click', target);
    })
    
    
    
    // Beginnings of the all-powerful document 'change' listener
    // One listener to rule them all!
    document.addEventListener('change', function (e) {
        const element = e.target.closest('[id]');
        if (element){
            const target = element.id;
            config.debug && console.log('Change target:', target)
            switch (target) {
                case 'species-frequency-threshold' : {
                    if (isNaN(element.value) || element.value === '') {
                        generateToast({ message:'The threshold must be a number between 0.001 and 1'});
                        return false
                    }
                    config.speciesThreshold = element.value;
                    worker.postMessage({ action: 'update-state', speciesThreshold: element.value });
                    worker.postMessage({ action: 'update-list', list: config.list, refreshResults: STATE.analysisDone});
                    break;
                }
                case 'timelineSetting': {
                    timelineToggle(e);
                    break;
                }
                case 'nocmig': {
                    changeNocmigMode(e);
                    break;
                }
                case 'confidenceValue':
                case 'confidence': {
                    handleThresholdChange(e);
                    break;
                }
                case 'context' : {
                    toggleContextAwareMode(e);
                    break;
                }
                case 'attenuation': {
                    handleAttenuationchange(e);
                    break;
                }
                case 'do-not-track': {
                    config.track = !element.checked;
                    worker.postMessage({ action: 'update-state', track: config.track })
                    break;
                }
                case 'lowShelfFrequency': {
                    handleLowShelfchange(e);
                    break;
                }
                case 'HighPassFrequency' : {
                    handleHPchange(e);
                    break;
                }
                case 'snrValue' : {
                    handleSNRchange(e);
                    break;
                }
                case 'audio-notification': {
                    config.audio.notification = element.checked;
                    break;
                }
                case 'power-save-block': {
                    config.powerSaveBlocker = element.checked;
                    powerSave(config.powerSaveBlocker);
                    break;
                }
                case 'species-week': {
                    config.useWeek = element.checked;

                    if (! config.useWeek) STATE.week = -1;
                    worker.postMessage({action:'update-state', useWeek: config.useWeek});
                    worker.postMessage({ action: 'update-list', list: config.list, refreshResults: STATE.analysisDone});
                    break;
                }
                case 'list-to-use': {
                    setListUIState(element.value)
                    config.list = element.value;
                    updateListIcon();
                    resetResults({clearSummary: true, clearPagination: true, clearResults: true});
                    worker.postMessage({ action: 'update-list', list: config.list, refreshResults: STATE.analysisDone});
                    break;
                }
                case 'locale': {
                    let labelFile;
                    if (element.value === 'custom'){
                        labelFile = config.customListFile[config.model];
                        if (! labelFile) {
                             generateToast({message: 'You must select a label file in the list settings to use the custom language option.'});
                            return;
                        }
                    } else {
                        const chirpity = element.value === 'en_uk' && config.model !== 'birdnet' ? 'chirpity' : '';
                        labelFile = `labels/V2.4/BirdNET_GLOBAL_6K_V2.4_${chirpity}Labels_${element.value}.txt`; 
                    }
                    config[config.model].locale = element.value;
                    readLabels(labelFile, 'locale');
                    break;
                }
                case 'local': {
                    config.local = element.checked;
                    worker.postMessage({action: 'update-state', local: config.local })
                    worker.postMessage({ action: 'update-list', list: config.list });
                    break;
                }
                case 'model-to-use': {
                    config.model = element.value;
                    modelSettingsDisplay();
                    DOM.customListFile.value = config.customListFile[config.model];
                    DOM.customListFile.value ? LIST_MAP.custom = 'Using a custom list' : delete LIST_MAP.custom;
                    document.getElementById('locale').value = config[config.model].locale;
                    //config[config.model].backend = config.hasNode ? 'tensorflow' : 'webgpu';
                    document.getElementById(config[config.model].backend).checked = true;
                    handleBackendChange(config[config.model].backend);
                    setListUIState(config.list)
                    break;
                }
                case 'thread-slider': {
                        // number of threads
                    DOM.numberOfThreads.textContent = DOM.threadSlider.value;
                    config[config[config.model].backend].threads = DOM.threadSlider.valueAsNumber;
                    loadModel();
                    break;
                }
                case 'batch-size': {
                    DOM.batchSizeValue.textContent = BATCH_SIZE_LIST[DOM.batchSizeSlider.value].toString();
                    config[config[config.model].backend].batchSize = BATCH_SIZE_LIST[element.value];
                    loadModel();
                    // Reset region maxLength
                    initRegion();
                    break;
                }
                case 'colourmap': {
                    config.colormap = element.value;
                    const colorMapFieldset = document.getElementById('colormap-fieldset')
                    if (config.colormap === 'custom'){
                        colorMapFieldset.classList.remove('d-none')
                    } else {
                        colorMapFieldset.classList.add('d-none')
                    }
                    if (wavesurfer && currentFile) {

                        // refresh caches
                        updateElementCache()
                        const fftSamples = wavesurfer.spectrogram.fftSamples;
                        wavesurfer.destroy();
                        wavesurfer = undefined;
                        adjustSpecDims(true, fftSamples)
                    }
                    break;
                }
                case 'window-function':
                case 'loud-color':
                case 'mid-color':
                case 'quiet-color':
                case 'color-threshold-slider': {
                    const windowFn = document.getElementById('window-function').value;
                    const loud = document.getElementById('loud-color').value;
                    const mid = document.getElementById('mid-color').value;
                    const quiet = document.getElementById('quiet-color').value;
                    const threshold = document.getElementById('color-threshold-slider').valueAsNumber;
                    document.getElementById('color-threshold').textContent = threshold;
                    config.customColormap = {'loud': loud, 'mid': mid, 'quiet': quiet, 'threshold': threshold, 'windowFn': windowFn};
                    if (wavesurfer && currentFile) {
                        // refresh caches
                        updateElementCache()
                        const fftSamples = wavesurfer.spectrogram.fftSamples;
                        wavesurfer.destroy();
                        wavesurfer = undefined;
                        adjustSpecDims(true, fftSamples)
                    }
                    break;
                }
                case 'gain': {
                    DOM.gainAdjustment.textContent = element.value + 'dB'; //.toString();
                    config.audio.gain = element.value;
                    worker.postMessage({action:'update-state', audio: config.audio})
                    const position = clamp(wavesurfer.getCurrentTime() / windowLength, 0, 1);
                    fileLoaded &&
                        postBufferUpdate({ begin: bufferBegin, position: position, region: getRegion(), goToRegion: false })
                    break;
                }
                case 'spec-labels': {
                    config.specLabels = element.checked;                    
                    if (wavesurfer && currentFile) {
                        // refresh caches
                        updateElementCache()
                        const fftSamples = wavesurfer.spectrogram.fftSamples;
                        wavesurfer.destroy();
                        wavesurfer = undefined;
                        adjustSpecDims(true, fftSamples)
                    }
                    break;
                }
                case 'fromInput':
                case 'fromSlider': {
                    config.audio.minFrequency = Math.max(element.valueAsNumber, 0);
                    DOM.fromInput.value = config.audio.minFrequency;
                    DOM.fromSlider.value = config.audio.minFrequency;
                    const fftSamples = wavesurfer.spectrogram.fftSamples;
                    wavesurfer.destroy();
                    wavesurfer = undefined;
                    adjustSpecDims(true, fftSamples);
                    checkFilteredFrequency();
                    worker.postMessage({action: 'update-state', audio: config.audio});
                    break;
                }
                case 'toInput':
                case 'toSlider': {
                    config.audio.maxFrequency = Math.min(element.valueAsNumber, 11950);
                    DOM.toInput.value = config.audio.maxFrequency;
                    DOM.toSlider.value = config.audio.maxFrequency;
                    const fftSamples = wavesurfer.spectrogram.fftSamples;
                    wavesurfer.destroy();
                    wavesurfer = undefined;
                    adjustSpecDims(true, fftSamples);
                    checkFilteredFrequency();
                    worker.postMessage({action: 'update-state', audio: config.audio});
                    break;
                }
                case 'normalise': {
                    config.audio.normalise = element.checked;
                    worker.postMessage({action:'update-state', audio: config.audio})
                    const position = clamp(wavesurfer.getCurrentTime() / windowLength, 0, 1);
                    fileLoaded &&
                        postBufferUpdate({ begin: bufferBegin, position: position, region: getRegion(), goToRegion: false })
                    break;
                }
                case 'send-filtered-audio-to-model': {
                    config.filters.sendToModel = element.checked;
                    worker.postMessage({ action: 'update-state', filters: config.filters })
                    break;
                }

                case 'format': {
                    config.audio.format = element.value;
                    showRelevantAudioQuality();
                    worker.postMessage({ action: 'update-state', audio: config.audio })
                    break;
                };
                
                case 'bitrate': {
                    config.audio.bitrate = e.target.value;
                    worker.postMessage({ action: 'update-state', audio: config.audio })
                    break;
                };
                
                case 'quality': {
                    config.audio.quality = element.value;
                    worker.postMessage({ action: 'update-state', audio: config.audio })
                    break;
                };
                
                case 'fade': {
                    config.audio.fade = element.checked;
                    worker.postMessage({ action: 'update-state', audio: config.audio })
                    break;
                };
                
                case 'padding': {
                    config.audio.padding = e.target.checked;
                    DOM.audioFade.disabled = !DOM.audioPadding.checked;;
                    worker.postMessage({ action: 'update-state', audio: config.audio })
                    break;
                };
                
                case 'downmix': {
                    config.audio.downmix = e.target.checked;
                    worker.postMessage({ action: 'update-state', audio: config.audio })
                    break;
                };
            }
            updatePrefs('config.json', config)
            const value = element.type === "checkbox" ? element.checked : element.value;
            trackEvent(config.UUID, 'Settings Change', target, value);
        }
    })
    
function setListUIState(list){
    DOM.customListContainer.classList.add('d-none');  
    DOM.localSwitchContainer.classList.add('d-none')
    DOM.speciesThresholdEl.classList.add('d-none'); 
    if (list === 'location') {
        DOM.speciesThresholdEl.classList.remove('d-none');
    } else if (list === 'nocturnal' && config.model === 'birdnet'){
        DOM.localSwitchContainer.classList.remove('d-none')
    } else if (list === 'custom') {
        DOM.customListContainer.classList.remove('d-none');  
        if (!config.customListFile[config.model]) {
            generateToast({message: 'You need to upload a custom list for the model before using the custom list option.'})
            return
        }
        readLabels(config.customListFile[config.model], 'list');
    } 
}

async function readLabels(labelFile, updating){
    fetch(labelFile).then(response => {
        if (! response.ok) throw new Error('Network response was not ok');
        return response.text();
    }).catch(error =>{
        if (error.message === 'Failed to fetch') {
            generateToast({message: 'The custom list could not be found, <b class="text-danger">no detections will be shown</b>.'})
            DOM.customListSelector.classList.add('btn-outline-danger');
            document.getElementById('navbarSettings').click();
            document.getElementById('list-file-selector').focus();
            return
        }
        else {console.error('There was a problem reading the label file:', error)}
    }).then(filecontents => {
        LABELS = filecontents.trim().split(/\r?\n/);
        // Add unknown species
        LABELS.push('Unknown Sp._Unknown Sp.');
        
        if (updating === 'list'){
            worker.postMessage({ action: 'update-list', list: config.list, customList: LABELS, refreshResults: STATE.analysisDone});
            trackEvent(config.UUID, 'UI', 'Create', 'Custom list', LABELS.length)
        } else {
            worker.postMessage({action: 'update-locale', locale: config[config.model].locale, labels: LABELS, refreshResults: STATE.analysisDone})
        }

    }).catch(error =>{
        console.error('There was a problem reading the label file:', error)
    })
}

    
    async function createContextMenu(e) {
        const target = e.target;
        if (target.classList.contains('circle') || target.closest('thead')) return;
        let hideInSummary = '', hideInSelection = '',
        plural = '', contextDelete;
        const inSummary = target.closest('#speciesFilter')
        const resultContext = !target.closest('#summaryTable');
        if (inSummary) {
            hideInSummary = 'd-none';
            plural = 's';
        } else if (target.closest('#selectionResultTableBody')) {
            hideInSelection = 'd-none';
        }
        
        // If we haven't clicked the active row or we cleared the region, load the row we clicked
        if (resultContext || hideInSelection || hideInSummary) {
            // Lets check if the summary needs to be filtered
            if (!(inSummary && target.closest('tr').classList.contains('text-warning'))) {
                target.click(); // Wait for file to load
                await waitForFileLoad();
            }
        }
        if (region === undefined && ! inSummary) return;
        const createOrEdit = ((region?.attributes.label || target.closest('#summary'))) ? 'Edit' : 'Create';
        
        contextMenu.innerHTML = `
        <a class="dropdown-item play ${hideInSummary}"><span class='material-symbols-outlined'>play_circle</span> Play</a>
        <a class="dropdown-item ${hideInSummary} ${hideInSelection}" href="#" id="context-analyse-selection">
        <span class="material-symbols-outlined">search</span> Analyse
        </a>
        <div class="dropdown-divider ${hideInSummary}"></div>
        <a class="dropdown-item" id="create-manual-record" href="#">
        <span class="material-symbols-outlined">edit_document</span> ${createOrEdit} Record${plural}
        </a>
        <a class="dropdown-item" id="context-create-clip" href="#">
        <span class="material-symbols-outlined">music_note</span> Export Audio Clip${plural}
        </a>
        <span class="dropdown-item" id="context-xc" href='#' target="xc">
        <img src='img/logo/XC.png' alt='' style="filter:grayscale(100%);height: 1.5em"> Compare with Reference Calls
        </span>
        <div class="dropdown-divider ${hideInSelection}"></div>
        <a class="dropdown-item ${hideInSelection}" id="context-delete" href="#">
        <span class='delete material-symbols-outlined'>delete_forever</span> Delete Record${plural}
        </a>
        `;
        const modalTitle = document.getElementById('record-entry-modal-label');
        modalTitle.textContent = `${createOrEdit} Record`;
        if (!hideInSelection) {
            const contextAnalyseSelectionLink = document.getElementById('context-analyse-selection');
            contextAnalyseSelectionLink.addEventListener('click', getSelectionResults);
            contextDelete = document.getElementById('context-delete');
            resultContext ? contextDelete.addEventListener('click', deleteRecord) :
            contextDelete.addEventListener('click', function () {
                deleteSpecies(target);
            });
        }
        // Add event Handlers
        const exporLink = document.getElementById('context-create-clip');
        hideInSummary ? exporLink.addEventListener('click', batchExportAudio) :
        exporLink.addEventListener('click', exportAudio);
        if (!hideInSelection) {
            document.getElementById('create-manual-record').addEventListener('click', function (e) {
                if (e.target.textContent.includes('Edit')) {
                    showRecordEntryForm('Update', !!hideInSummary);
                } else {
                    showRecordEntryForm('Add', !!hideInSummary);
                }
            })
        }
        if (activeRow && (region?.attributes.label || hideInSummary)) {}
        else {
            const xc = document.getElementById('context-xc');
            xc.classList.add('d-none');
            contextDelete.classList.add('d-none');
        }
        positionMenu(contextMenu, e);
    }
    
    function positionMenu(menu, event) {
        menu.classList.remove("d-none");
        // Calculate menu positioning:
        const menuWidth = menu.clientWidth;
        const menuHeight = menu.clientHeight;
        let top = event.pageY - 50;
        let left = event.pageX;
        // Check if the menu would be displayed partially off-screen on the right
        if (left + menuWidth > window.innerWidth) {
            left = window.innerWidth - menuWidth - 15;
        }
        
        // Check if the menu would be displayed partially off-screen on the bottom
        if (top + menuHeight > window.innerHeight - 90) {
            top = window.innerHeight - menuHeight - 90;
        }
        
        menu.style.display = 'block';
        menu.style.top =  top + 'px';
        menu.style.left =  left + 'px';
    }
    
    [DOM.spectrogramWrapper, DOM.resultTableElement, selectionTable].forEach(el =>{
        el.addEventListener('contextmenu', createContextMenu)
    })

    
    const recordEntryModalDiv = document.getElementById('record-entry-modal')
    const recordEntryModal = new bootstrap.Modal(recordEntryModalDiv, { backdrop: 'static' });
    
    
    const recordEntryForm = document.getElementById('record-entry-form');
    let focusBirdList;
    
    async function showRecordEntryForm(mode, batch) {
        const cname = batch ? document.querySelector('#speciesFilter .text-warning .cname .cname').textContent : region.attributes.label.replace('?', '');
        let callCount = '', typeIndex = '', commentText = '';
        if (cname && activeRow) {
            // Populate the form with existing values
            commentText = activeRow.querySelector('.comment > span')?.title || '';
            callCount = activeRow.querySelector('.call-count').textContent.replace('Present', '');
            typeIndex = ['Local', 'Nocmig', ''].indexOf(activeRow.querySelector('.label').textContent);
        }
        const recordEntryBirdList = recordEntryForm.querySelector('#record-entry-birdlist');
        focusBirdList = () => {
            const allBirdList = document.getElementById('bird-list-all')
            allBirdList.focus()
        }
        recordEntryBirdList.innerHTML = generateBirdOptionList({ store: 'allSpecies', rows: undefined, selected: cname });
        const batchHide = recordEntryForm.querySelectorAll('.hide-in-batch');
        batchHide.forEach(el => batch ? el.classList.add('d-none') : el.classList.remove('d-none'));
        recordEntryForm.querySelector('#call-count').value = callCount;
        recordEntryForm.querySelector('#record-comment').value = commentText;
        recordEntryForm.querySelector('#DBmode').value = mode;
        recordEntryForm.querySelector('#batch-mode').value = batch;
        recordEntryForm.querySelector('#original-id').value = cname;
        recordEntryForm.querySelector('#record-add').textContent = mode;
        if (typeIndex) recordEntryForm.querySelectorAll('input[name="record-label"]')[typeIndex].checked = true;
        recordEntryModalDiv.addEventListener('shown.bs.modal', focusBirdList)
        toggleKeyDownForFormInputs()
        recordEntryModal.show();
    }
    
    recordEntryForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const action = document.getElementById('DBmode').value;
        // cast boolstring to boolean
        const batch = document.getElementById('batch-mode').value === 'true';
        const cname = document.getElementById('bird-list-all').value;
        let start, end;
        if (region) {
            start = bufferBegin + region.start;
            end = bufferBegin + region.end;
            region.attributes.label = cname;
        }
        const originalCname = document.getElementById('original-id').value;
        // Update the region label
        const count = document.getElementById('call-count')?.value;
        const comment = document.getElementById('record-comment')?.value;
        const label = document.querySelector('input[name="record-label"]:checked')?.value || '';
        
        recordEntryModal.hide();
        insertManualRecord(cname, start, end, comment, count, label, action, batch, originalCname)
    })
    
    
    const insertManualRecord = (cname, start, end, comment, count, label, action, batch, originalCname, confidence) => {
        const files = batch ? fileList : currentFile;
        worker.postMessage({
            action: 'insert-manual-record',
            cname: cname,
            originalCname: originalCname,
            start: start?.toFixed(3),
            end: end?.toFixed(3),
            comment: comment,
            count: count || undefined,
            file: files,
            label: label,
            DBaction: action,
            batch: batch,
            confidence: confidence,
            position: {row: activeRow?.rowIndex - 1, page: getCurrentPage()}, //  have to account for the header row
            speciesFiltered: isSpeciesViewFiltered(true)
        })
        resetResults({clearPagination: false})
    }

    function checkFilteredFrequency(){
        const resetButton = document.getElementById('reset-spec-frequency');
        if (config.audio.minFrequency > 0 || config.audio.maxFrequency < 11950) {
            document.getElementById('frequency-range').classList.add('text-warning');
            resetButton.classList.add('btn-warning');
            resetButton.classList.remove('btn-secondary', 'disabled');
        } else {
            document.getElementById('frequency-range').classList.remove('text-warning');
            resetButton.classList.remove('btn-warning');
            resetButton.classList.add('btn-secondary', 'disabled');
        }
    }

    function getCurrentPage(){
        let currentPage = pagination[0].querySelector('.active');
        currentPage = currentPage ? parseInt(currentPage.textContent) : 1;
        return currentPage;
    }

    async function locateFile(file) {       
        const files = await window.electron.openDialog('showOpenDialog', 
            {type: 'audio', 
                fileOrFolder: 'openFile', 
                buttonLabel: 'Select File', 
                title: `Select the file to replace ${file}`});
        if (!files.canceled) {
            worker.postMessage({
                action: 'relocated-file',
                originalFile: file,
                updatedFile: files.filePaths[0]
            })
            renderFilenamePanel();
        }
}

    function deleteFile(file) {
        // EventHandler caller 
        if (typeof file === 'object' && file instanceof Event) {
            file = currentFile;
        }
        if (file) {
            if (confirm(`This will remove ${file} and all the associated detections from the database archive. Proceed?`)) {
                worker.postMessage({
                    action: 'purge-file',
                    fileName: file
                })
                resetResults();
            }
            renderFilenamePanel()
        }
    }
    // Utility functions to wait for file to load
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    async function waitForFileLoad() {
        while (!fileLoaded) {
            await delay(100); // Wait for 100 milliseconds before checking again
        }
    }
    
    async function waitForLocations() {
        while (!LOCATIONS) {
            await delay(100); // Wait for 100 milliseconds before checking again
        }
        return;
    }
    
    // TOUR functions
    const tourModal = document.getElementById('tourModal');
    // Initialize the Bootstrap modal
    
    // Function to start the tour
    function startTour() {
        var modal = new bootstrap.Modal(tourModal, {
            backdrop: 'static', // Prevent closing by clicking outside the modal
            keyboard: false      // Prevent closing by pressing Esc key
        });
        modal.show();
    }
    
    // Function to highlight an element on the page
    function highlightElement(selector) {
        // Remove any previous highlights
        var highlightedElements = document.querySelectorAll('.highlighted');
        highlightedElements.forEach(function (element) {
            element.classList.remove('highlighted');
        });
        // Add a highlight class to the selected element
        var selectedElement = document.querySelector(selector);
        if (selectedElement) {
            selectedElement.classList.add('highlighted');
        }
    }
    
    // Event handler for when the carousel slides
    document.getElementById('carouselExample').addEventListener('slid.bs.carousel', function () {
        // Get the active carousel item
        var activeItem = document.querySelector('#carouselExample .carousel-inner .carousel-item.active');
        // Get the element selector associated with the current step
        var elementSelector = activeItem.dataset.elementSelector;
        // Highlight the corresponding element on the page
        highlightElement(elementSelector);
        
        if (elementSelector === "#fileContainer") {
            // Create and dispatch a new 'contextmenu' event
            var element = document.getElementById('filename');
            var contextMenuEvent = new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                clientY: element.offsetTop + (2 * element.offsetHeight),
                clientX: 20
            });
            buildFileMenu(contextMenuEvent);
        } else {
            document.getElementById("context-menu").classList.remove("show");
        }
    });
    
    // Event handler for closing the modal
    tourModal.addEventListener('hidden.bs.modal', function () {
        // Remove any highlights when the modal is closed
        var highlightedElements = document.querySelectorAll('.highlighted');
        highlightedElements.forEach(function (element) {
            element.classList.remove('highlighted');
        });
        config.seenTour = true;
        updatePrefs('config.json', config)
    });
    
    // Event handler for starting the tour
    const prepTour = async () => {
        if (!fileLoaded) {
            const example_file = await window.electron.getAudio();
            // create a canvas for the audio spec
            showElement(['spectrogramWrapper'], false);
            await loadAudioFile({ filePath: example_file });
        }
        startTour();
    }
    

    
    // Function to display update download progress
    const tracking = document.getElementById('update-progress');
    const updateProgressBar = document.getElementById('update-progress-bar');
    window.electron.onDownloadProgress((_event, progressObj) => {
        tracking.classList.remove('d-none')
        // Update your UI with the progress information
        updateProgressBar.value = progressObj.percent;
        if (progressObj.percent > 99) tracking.classList.add('d-none')
    });
    
    // CI functions
    const getFileLoaded = () => fileLoaded;
    const donePredicting = () => !PREDICTING;
    const getAudacityLabels = () => AUDACITY_LABELS[currentFile];
    
    
    // Update checking for Mac 
    
    function checkForMacUpdates() {
        // Do this at most daily
        const latestCheck = Date.now();
        const checkDue = (latestCheck - config.lastUpdateCheck) > 86_400_000;
        if (checkDue){
            fetch('https://api.github.com/repos/Mattk70/Chirpity-Electron/releases/latest')
            .then(response => response.json())
            .then(data => {
                const latestVersion = data.tag_name;
                const latest = parseSemVer(latestVersion);
                const current = parseSemVer(VERSION);
                
                if (isNewVersion(latest, current)) {
                    const alertPlaceholder = document.getElementById('updateAlert')
                    const alert = (message, type) => {
                        const wrapper = document.createElement('div')
                        wrapper.innerHTML = [
                            `<div class="alert alert-${type} alert-dismissible" role="alert">`,
                            `   <div>${message}</div>`,
                            '   <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>',
                            '</div>'
                        ].join('')
                        alertPlaceholder.append(wrapper)
                    }
                    alert(`
                    <svg class="bi flex-shrink-0 me-2" width="20" height="20" role="img" aria-label="Info:"><use xlink:href="#info-fill"/></svg>
                    There's a new version of Chirpity available! <a href="https://chirpity.mattkirkland.co.uk?fromVersion=${VERSION}" target="_blacnk">Check the website</a> for more information`,
                    'warning')
                }
                config.lastUpdateCheck = latestCheck;
                updatePrefs('config.json', config)
            })
            .catch(error => {
                console.warn('Error checking for updates:', error);
            });
        }
    }
    
    function generateToast({message}) {
        const domEl = document.getElementById('toastContainer');
        
        const wrapper = document.createElement('div');
        // Add toast attributes
        wrapper.setAttribute("class", "toast");
        wrapper.setAttribute("role", "alert");
        wrapper.setAttribute("aria-live", "assertive");
        wrapper.setAttribute("aria-atomic", "true");
        
        wrapper.innerHTML = `
            <div class="toast-header">
                <svg class="bi flex-shrink-0 me-2 text-primary" width="20" height="20" role="img" aria-label="Info:"><use xlink:href="#info-fill"/></svg>
                <strong class="me-auto">Notice</strong>
                <small class="text-muted">just now</small>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>`
        
        domEl.appendChild(wrapper)
        const toast = new bootstrap.Toast(wrapper)
        toast.show()
        if (message === 'Analysis complete.'){
            const duration = parseFloat(DIAGNOSTICS['Analysis Duration'].replace(' seconds', ''));
            if (config.audio.notification && duration > 30){
                if (Notification.permission === "granted") {
                    // Check whether notification permissions have already been granted;
                    // if so, create a notification
                    const notification = new Notification(`Analysis completed in ${duration.toFixed(0)} seconds`, {requireInteraction: true, icon: 'img/icon/chirpity_logo2.png'});
                } else if (Notification.permission !== "denied") {
                    // We need to ask the user for permission
                    Notification.requestPermission().then((permission) => {
                    // If the user accepts, let's create a notification
                    if (permission === "granted") {
                        const notification = new Notification(`Analysis completed in ${duration.toFixed(0)} seconds`, {requireInteraction: true, icon: 'img/icon/chirpity_logo2.png'});
                    }
                    });
                } else {
                    notificationSound = document.getElementById('notification');
                    notificationSound.play()
                }
            }
        }
    }

    function parseSemVer(versionString) {
        const semVerRegex = /^[vV]?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-.]+))?(?:\+([0-9A-Za-z-.]+))?$/;
        const matches = versionString.match(semVerRegex);
        if (!matches) {
            throw new Error('Invalid SemVer version string');
        }
        
        const [, major, minor, patch, preRelease, buildMetadata] = matches;
        
        return {
            major: parseInt(major),
            minor: parseInt(minor),
            patch: parseInt(patch),
            preRelease: preRelease || null,
            buildMetadata: buildMetadata || null
        };
    }
    
    function isNewVersion(latest, current) {
        if (latest.major > current.major) {
            return true;
        } else if (latest.major === current.major) {
            if (latest.minor > current.minor) {
                return true;
            } else if (latest.minor === current.minor) {
                if (latest.patch > current.patch) {
                    return true;
                }
            }
        }
        return false;
    }

    // Not Harlem, but Fisher-Yates shuffle
    function shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
    
async function getXCComparisons(){
    const xc = document.getElementById('context-xc');
    let [,,,sname,cname] = activeRow.getAttribute('name').split('|');
    const XC_type = cname.includes('(song)') ? "song" :
    cname.includes('call)') ? "call" : "";
    let XCcache;
    try {
        const data = await fs.promises.readFile(p.join(appPath, 'XCcache.json'), 'utf8');
        XCcache = JSON.parse(data);
    } catch (err) {
        config.debug && console.log('No XC cache found', err);
        XCcache = {}; // Set XCcache as an empty object
    }
    
    if (XCcache[sname]) renderComparisons(XCcache[sname], cname);
    else {
        const loading = document.getElementById('loadingOverlay')
        loading.querySelector('#loadingText').textContent = 'Loading Xeno-Canto data...';
        loading.classList.remove('d-none');
        const quality = '+q:%22>C%22';
        const length = '+len:3-15';
        fetch(`https://xeno-canto.org/api/2/recordings?query=${sname}${quality}${length}`)
        .then(response =>{
            if (! response.ok) {
                loading.classList.add('d-none');
                return generateToast({message: 'The Xeno-canto API is not responding'})
            }
            return response.json()
        })
        .then(data => {
            // Hide loading
            loading.classList.add('d-none');
            // Extract the first 10 items from the recordings array
            const recordings = data.recordings.map(record => ({
                file: record.file, // media file
                rec: record.rec, // recordist
                url: record.url, // URL on XC
                type: record.type, // call type
                smp: record.smp, // sample rate
                licence: record.lic //// licence
              }));

            // Shuffle recordings so new cache returns a different set
            shuffle(recordings);

            // Initialize an object to store the lists
            const filteredLists = {
              'nocturnal flight call': [],
              'flight call': [],
              'call': [],
              'song': [],
            };
            
            // Counters to track the number of items added to each list
            let songCount = 0;
            let callCount = 0;
            let flightCallCount = 0;
            let nocturnalFlightCallCount = 0;
            
            // Iterate over the recordings array and filter items
            recordings.forEach(record => {
              if (record.type === 'song' && songCount < 10) {
                filteredLists.song.push(record);
                songCount++;
              } else if (record.type === 'nocturnal flight call' && nocturnalFlightCallCount < 10) {
                filteredLists['nocturnal flight call'].push(record);
                nocturnalFlightCallCount++;
              } else if (record.type === 'flight call' && flightCallCount < 10) {
                filteredLists['flight call'].push(record);
                flightCallCount++;
              } else if (record.type === 'call' && callCount < 10) {
                filteredLists.call.push(record);
                callCount++;
              }
            });
            if (songCount === 0 && callCount === 0 && flightCallCount === 0 && nocturnalFlightCallCount === 0) {
                generateToast({message: 'The Xeno-canto site has no comparisons available'})
                return
              } else {
                // Let's cache the result, 'cos the XC API is quite slow
                XCcache[sname] = filteredLists;
                updatePrefs('XCcache.json', XCcache); // TODO: separate the caches, add expiry - a week?
                console.log('XC response', filteredLists)
                renderComparisons(filteredLists, cname)
              }
        })
        .catch(error => {
            loading.classList.add('d-none');
            console.warn('Error getting XC data', error)
        })
    }
}

function capitalizeEachWord(str) {
    return str.replace(/\b\w/g, function(char) {
      return char.toUpperCase();
    });
  }
function renderComparisons(lists, cname){
    cname = cname.replace(/\(.*\)/, '').replace('?', '');
    const compareDiv = document.createElement('div');
    compareDiv.classList.add('modal', 'modal-fade', 'model-lg')
    compareDiv.id = "compareModal";
    compareDiv.tabIndex = -1;
    compareDiv.setAttribute('aria-labelledby', "compareModalLabel");
    compareDiv.setAttribute('aria-hidden', "true");
    compareDiv.setAttribute( "data-bs-backdrop", "static")
    const compareHTML = `
        <div class="modal-dialog modal-lg modal-dialog-bottom w-100">
            <div class="modal-content">
                <div class="modal-header pt-1 pb-0 bg-dark bg-opacity-25"><h5>${cname}</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
                    <div class="modal-body pt-0 pb-1">
                        <ul class="nav nav-tabs navbar navbar-expand p-0 pt-1" id="callTypeHeader" role="tablist"></ul>
                        <div class="tab-content" id="recordings"></div>
                        <div class="modal-footer justify-content-center pb-0">
                            <button id="playComparison" class="p-1 pe-2 btn btn-outline-secondary" title="Play / Pause (SpaceBar)">
                                <span class="material-symbols-outlined ">play_circle</span><span
                                class="align-middle d-none d-lg-inline"> Play </span>
                                /
                                <span class="material-symbols-outlined">pause</span><span
                                class="align-middle d-none d-lg-inline-block">Pause</span>
                            </button>
                            <div class="btn-group" role="group">
                                <button id="cmpZoomIn" title="Zoom into the spectrogram" class="btn btn-outline-secondary p-0">
                                <span class="material-symbols-outlined zoom">zoom_in</span>
                                </button>
                                <button id="cmpZoomOut" title="Zoom out of the spectrogram" class="btn btn-outline-secondary p-0"
                                style="max-width: 70px"><span class="material-symbols-outlined zoom align-middle">zoom_out</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    compareDiv.innerHTML = compareHTML;
    const indicatorList = compareDiv.querySelector('.carousel-indicators');
    const callTypeHeader = compareDiv.querySelector('#callTypeHeader');
    const recordings = compareDiv.querySelector('#recordings');
    let count = 0;
    Object.keys(lists).forEach(callType =>{
        const active = count === 0 ? 'active' : '';
        const callTypePrefix = callType.replaceAll(' ','-');
        if (lists[callType].length){
            // tab headings
            const tabHeading = document.createElement('li');
            tabHeading.classList.add('nav-item')
            tabHeading.setAttribute('role', 'presentation');
            const button = `<button class="nav-link text-nowrap ${active}" id="${callTypePrefix}-tab" data-bs-toggle="tab" data-bs-target="#${callTypePrefix}-tab-pane" type="button" role="tab" aria-controls="${callTypePrefix}-tab-pane" aria-selected="${count === 0}">${capitalizeEachWord(callType)}</button>`;
            tabHeading.innerHTML = button;
            callTypeHeader.appendChild(tabHeading);

            // Tab pane for each call type
            const tabContentPane = document.createElement('div');
            tabContentPane.classList.add('tab-pane', 'fade');
            count === 0 && tabContentPane.classList.add('show', 'active');
            tabContentPane.id = callTypePrefix + '-tab-pane';
            tabContentPane.setAttribute('role', 'tabpanel');
            tabContentPane.setAttribute('aria-labelled-by', callTypePrefix + '-tab');
            recordings.appendChild(tabContentPane);
            // Content carousels in each tab-pane
            const carousel = document.createElement('div');
            carousel.classList.add('carousel', 'carousel-dark', 'slide');
            carousel.id = `${callTypePrefix}-comparisons`;
            carousel.setAttribute('data-bs-ride', 'false');
            carousel.setAttribute('data-bs-wrap', 'true'); 
            //carousel indicators
            carousel.innerHTML = `<div class="carousel-inner"></div><div class="carousel-indicators position-relative mt-3"></div> `;
            tabContentPane.appendChild(carousel);
            //carousel items for each recording in the list
            const carouselIndicators = carousel.querySelector('.carousel-indicators');
            const examples = lists[callType];
            const carouselInner = carousel.querySelector('.carousel-inner');
            for (let i=0; i < examples.length; i++){
                const recording = examples[i];
                const carouselItem = document.createElement('div');
                const indicatorItem = document.createElement('button');
                indicatorItem.setAttribute('data-bs-target', `#${callTypePrefix}-comparisons`);
                indicatorItem.setAttribute('data-bs-slide-to', `${i}`);
                carouselItem.classList.add('carousel-item');
                i === 0 && carouselItem.classList.add('active');
                i === 0 && indicatorItem.classList.add('active');
                // create div for wavesurfer
                const mediaDiv = document.createElement('div');
                mediaDiv.id = `${callType}-${i}`;
                const specDiv = document.createElement('div');
                specDiv.id = `${callTypePrefix}-${i}-compareSpec`;
                mediaDiv.setAttribute('name', `${specDiv.id}|${recording.file}`)
                mediaDiv.appendChild(specDiv);
                const creditContainer = document.createElement('div');
                creditContainer.classList.add('text-end');
                creditContainer.style.width = "100%";
                const creditText = document.createElement('div');
                creditText.style.zIndex = 1;
                creditText.classList.add('float-end', 'w-100', 'position-absolute', 'pe-1');
                const creditLink = document.createElement('a');
                creditLink.classList.add('xc-link');
                creditText.appendChild(creditLink);
                creditContainer.appendChild(creditText);
                carouselItem.appendChild(creditContainer);
                carouselItem.appendChild(mediaDiv);
                creditLink.setAttribute('href', 'https:' + recording.url);
                creditLink.setAttribute('target', '_blank');
                creditLink.innerHTML = 'Source: Xeno-Canto &copy; ' + recording.rec;
                carouselInner.appendChild(carouselItem)

                carouselIndicators.appendChild(indicatorItem);
            }
            const innerHTML = `
                <!-- Carousel navigation controls -->
                <button class="carousel-control-prev" href="#${callTypePrefix}-comparisons" role="button" data-bs-slide="prev">
                    <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                    <span class="visually-hidden">Previous</span>
                </button>
                <button class="carousel-control-next" href="#${callTypePrefix}-comparisons" role="button" data-bs-slide="next">
                    <span class="carousel-control-next-icon" aria-hidden="true"></span>
                    <span class="visually-hidden">Next</span>
                </button>
            `;
            const controls = document.createElement('div');
            controls.innerHTML = innerHTML;
            carouselIndicators.appendChild(controls);
            count++;
        }
    })

    document.body.appendChild(compareDiv)
    const header = compareDiv.querySelector('.modal-header');
    makeDraggable(header);
    const navTabs = document.getElementById('callTypeHeader');
    callTypeHeader.addEventListener('click', showCompareSpec)
    const comparisonModal = new bootstrap.Modal(compareDiv);
    compareDiv.addEventListener('hidden.bs.modal', () => compareDiv.remove())
    compareDiv.addEventListener('slid.bs.carousel', () => showCompareSpec())
    compareDiv.addEventListener('shown.bs.modal', () => showCompareSpec())
    comparisonModal.show()
}

let ws;
const playComparison = () => {ws.playPause()}

function showCompareSpec() {
    if (ws) ws.destroy()
    const activeCarouselItem = document.querySelector('#recordings .tab-pane.active .carousel-item.active');
    const mediaContainer = activeCarouselItem.lastChild;
    // need to prevent accumulation, and find event for show/hide loading
    let loading = document.getElementById('loadingOverlay')
    loading = loading.cloneNode(true);
    loading.classList.remove('d-none', 'text-white');
    loading.firstElementChild.textContent = 'Loading audio from Xeno-Canto...'
    mediaContainer.appendChild(loading);
    //console.log("id is ", mediaContainer.id)
    const [specContainer, file] = mediaContainer.getAttribute('name').split('|');
    // Create an instance of WaveSurfer
    const audioCtx = new AudioContext({ latencyHint: 'interactive', sampleRate: sampleRate });
    // Setup waveform and spec views
    ws = WaveSurfer.create({
        container: mediaContainer,
        audioContext: audioCtx,
        backend: 'WebAudio',
        // make waveform transparent
        backgroundColor: 'rgba(0,0,0,0)',
        waveColor: 'rgba(109,41,164,0)',
        progressColor: 'rgba(109,41,16,0)',
        // but keep the playhead
        cursorColor: '#fff',
        cursorWidth: 2,
        partialRender: false,
        scrollParent: true,
        fillParent: true,
        responsive: false,
        normalize: true,
        height: 250,
        minPxPerSec: 195
    });
    // set colormap
    const colors = createColormap() ;
    ws.addPlugin(WaveSurfer.spectrogram.create({
        //deferInit: false,
        wavesurfer: ws,
        container: "#" + specContainer,
        windowFunc: 'hann',
        frequencyMin: 0,
        frequencyMax: 11_950,
        hideScrollbar: false,
        labels: true,
        fftSamples: 512,
        height: 250,
        colorMap: colors
    })).initPlugin('spectrogram')


    ws.on('ready', function () {
        console.log('ws ready');
        mediaContainer.removeChild(loading);
    })


    ws.load(file)
    const playButton = document.getElementById('playComparison')
    // prevent listener accumulation
    playButton.removeEventListener('click', playComparison)
    playButton.addEventListener('click', playComparison)

}

// Make config, LOCATIONS and displayLocationAddress and toasts available to the map script in index.html
export { config, displayLocationAddress, LOCATIONS, generateToast };
