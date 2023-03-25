let seenTheDarkness = false, shownDaylightBanner = false;
let labels = [];

const STATE = {
    chart: {
        species: undefined,
        range: {start: undefined, end: undefined}
    },
    explore: {
        species: undefined,
        order: 'dateTime',
        range: {start: undefined, end: undefined}
    },
    birdList: {lastSelectedSpecies: undefined},
    selection: {start: undefined, end: undefined},
    mode: 'analyse'
}

// Batch size map for slider
const BATCH_SIZE_LIST = [1, 2, 4, 8, 16, 32, 36, 48, 64, 128];

// Get the modules loaded in preload.js
const fs = window.module.fs;
const colormap = window.module.colormap;
const p = window.module.p;
const SunCalc = window.module.SunCalc;
const uuidv4 = window.module.uuidv4;
const os = window.module.os;

/// Set up communication channel between UI and worker window

let worker;

const establishMessageChannel =
    new Promise((resolve) => {
        window.onmessage = (event) => {
            // event.source === window means the message is coming from the preload
            // script, as opposed to from an <iframe> or other source.
            if (event.source === window) {
                if (event.data === 'provide-worker-channel') {
                    [worker] = event.ports;
                    worker.postMessage({action: 'create message port'});
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
    }, reason => {
        console.log(reason);
    });


async function getPaths() {
    const pathPromise = window.electron.getPath();
    const tempPromise = window.electron.getTemp();
    const appPath = await pathPromise;
    const tempPath = await tempPromise;
    console.log('path is ', appPath, 'temp is ', tempPath);
    return [appPath, tempPath];
}


let version;
let diagnostics = {};

window.electron.getVersion()
    .then((appVersion) => {
        version = appVersion;
        console.log('App version: ', appVersion);
        diagnostics['Chirpity Version'] = version;
    })
    .catch(e => {
        console.log('Error getting app version:', e)
    });

let modelReady = false, fileLoaded = false, currentFile;
let PREDICTING = false, t0;
let region, AUDACITY_LABELS = {}, wavesurfer;
// fileList is all open files, analyseList is the subset that have been analysed;
let fileList = [], analyseList = [];
let fileStart, bufferStartTime, fileEnd;

let zero = new Date(Date.UTC(0, 0, 0, 0, 0, 0));
// set up some DOM element caches
const bodyElement = $('body');
let spectrogramWrapper = $('#spectrogramWrapper'), specElement, waveElement, specCanvasElement, specWaveElement;
let waveCanvasElement, waveWaveElement,
    resultTableElement = $('#resultTableContainer');
resultTableElement.animate({scrollTop: '300px'}, 400, 'swing');
const contentWrapperElement = $('#contentWrapper');
//const completeDiv = $('#complete');
let resultTable = document.getElementById('resultTableBody');
const selectionTable = document.getElementById('selectionResultTableBody');
const nocmigButton = document.getElementById('nocmigMode');
const summaryTable = $('#summaryTable');
const progressDiv = $('#progressDiv');
const progressBar = document.getElementById('progress-bar');
const fileNumber = document.getElementById('fileNumber');
const timelineSetting = document.getElementById('timelineSetting');
const colourmap = document.getElementById('colourmap');
const thresholdLink = document.getElementById('threshold');
const batchSizeValue = document.getElementById('batch-size-value');


let batchInProgress = false;
let activeRow;
let predictions = {}, speciesListItems,
    clickedIndex, currentFileDuration;

let currentBuffer, bufferBegin = 0, windowLength = 20;  // seconds
let workerHasLoadedFile = false;
// Set content container height
contentWrapperElement.height(bodyElement.height() - 80);


// Set default Options
let config;
const sampleRate = 24000;
const audioCtx = new AudioContext({latencyHint: 'interactive', sampleRate: sampleRate});


/** Collect Diagnostics Information
 Diagnostics keys:
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

diagnostics['CPU'] = os.cpus()[0].model;
diagnostics['Cores'] = os.cpus().length;
diagnostics['System Memory'] = (os.totalmem() / (1024 ** 2 * 1000)).toFixed(0) + ' GB';

function resetResults() {
    summaryTable.empty();
    pagination.forEach(item => item.classList.add('d-none'));
    resultTable = document.getElementById('resultTableBody');
    resultTable.innerHTML = '';
    predictions = {};
    seenTheDarkness = false;
    shownDaylightBanner = false;
    progressDiv.hide();
    updateProgress(0)
}

/***
 *
 * @param val: float between 0 and 1
 */
function updateProgress(val) {
    val = val.toString();
    progressBar.value = val;
    progressBar.innerText = val + '%';
}

async function loadAudioFile(args) {
    let filePath = args.filePath, originalFileEnd = args.originalFileEnd;
    workerHasLoadedFile = false;
    try {
        fileEnd = fs.statSync(filePath).mtime;
        worker.postMessage({
            action: 'file-load-request',
            file: filePath,
            preserveResults: args.preserveResults,
            position: 0,
            list: config.list,
            warmup: config.warmup
        });
    } catch (e) {
        const supported_files = ['.mp3', '.wav', '.mpga', '.ogg', '.opus', '.flac', '.m4a', '.aac', '.mpeg', '.mp4'];
        const dir = p.parse(filePath).dir;
        const name = p.parse(filePath).name;
        let file;
        supported_files.some(ext => {
            try {
                file = p.join(dir, name + ext);
                fileEnd = fs.statSync(file).mtime;
            } catch (e) {
                // Try the next extension
            }
            return fileEnd;
        });
        if (fileEnd) {
            if (file) {
                filePath = file;
            }
            if (originalFileEnd) {
                fileEnd = originalFileEnd;
            }
            worker.postMessage({
                action: 'file-load-request',
                file: filePath,
                preserveResults: args.preserveResults,
                position: 0,
                warmup: config.warmup,
                list: config.list
            });
        } else {
            alert("Unable to load source file with any supported file extension: " + filePath)
        }
    }
}


function updateSpec({buffer, play = false, resetSpec = false}) {
    updateElementCache();
    wavesurfer.loadDecodedBuffer(buffer);
    waveCanvasElement.width('100%');
    specCanvasElement.width('100%');
    $('.spec-labels').width('55px');
    if (resetSpec) adjustSpecDims(true);
    showElement(['fullscreen']);
    if (play) wavesurfer.play()
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
    disableMenuItem(['analyseSelection', 'exportMP3']);
    if (workerHasLoadedFile) enableMenuItem(['analyse']);
}

const initWavesurfer = ({
                            audio = undefined,
                            height = 0
                        }) => {
    // if (reset) {
    //     // Show spec and timecode containers
    //     hideAll();
    //     showElement(['spectrogramWrapper', 'fullscreen'], false);
    // }
    if (wavesurfer) {
        wavesurfer.pause();
    }
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
        cursorColor: '#fff',
        cursorWidth: 2,
        skipLength: 0.1,
        partialRender: true,
        scrollParent: false,
        fillParent: true,
        responsive: true,
        height: height,
        plugins: [
            WaveSurfer.regions.create({
                formatTimeCallback: formatRegionTooltip,
                dragSelection: true,
                slop: 5,
                color: "rgba(255, 255, 255, 0.2)"
            })
        ]
    });
    initSpectrogram();
    createTimeline();
    if (audio) wavesurfer.loadDecodedBuffer(audio);
    colourmap.value = config.colormap === 'greys' ? 'greys' : 'inferno';
    // Set click event that removes all regions

    waveElement.mousedown(function () {
        resetRegions()
    });
    // Enable analyse selection when region created
    wavesurfer.on('region-created', function (e) {
        region = e;
        // region.on('contextmenu', function () {
        //     const menu = new bootstrap.Menu('#demo1Box', {
        //         actions: [{
        //             name: 'Action',
        //             onClick: function () {
        //                 console.log("Action' clicked!");
        //             }
        //         }, {
        //             name: 'Another action',
        //             onClick: function () {
        //                 console.log("Another action' clicked!");
        //             }
        //         }, {
        //             name: 'A third action',
        //             onClick: function () {
        //                 console.log("A third action' clicked!");
        //             }
        //         }]
        //     });
        // })
        enableMenuItem(['exportMP3']);
        if (modelReady) {
            enableMenuItem(['analyseSelection']);
        }
    });

    wavesurfer.on('finish', function () {
        if (currentFileDuration > bufferBegin + windowLength) {
            bufferBegin += windowLength;
            postBufferUpdate({begin: bufferBegin, play: true})
        }
    });

    // Show controls
    showElement(['controlsWrapper']);
    updateElementCache();
    // Resize canvas of spec and labels
    adjustSpecDims(false);
}

function updateElementCache() {
    t0 = Date.now();
    // Update element caches
    waveElement = $('#waveform');
    specElement = $('spectrogram');
    specCanvasElement = $('#spectrogram canvas');
    waveCanvasElement = $('#waveform canvas');
    waveWaveElement = $('#waveform wave');
    specWaveElement = $('#spectrogram wave')
}

function zoomSpec(direction) {
    if (typeof direction !== 'string') { // then it's an event
        direction = direction.target.closest('button').id
    }
    let offsetSeconds = wavesurfer.getCurrentTime();
    let position = offsetSeconds / windowLength;
    let timeNow = bufferBegin + offsetSeconds;
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
    position = (timeNow - bufferBegin) / windowLength;
    postBufferUpdate({begin: bufferBegin, position: position})
}

async function showOpenDialog() {
    const files = await window.electron.openDialog('showOpenDialog');
    if (!files.canceled) await onOpenFiles({filePaths: files.filePaths});
}

function powerSave(on) {
    return window.electron.powerSaveBlocker(on);
}

const openFileInList = async (e) => {
    if (!PREDICTING && e.target.type !== 'button') {
        await loadAudioFile({filePath: e.target.id, preserveResults: true})
    }
}
const filename = document.getElementById('filename');
filename.addEventListener('click', openFileInList);

function updateFileName(files, openfile) {
    let filenameElement = document.getElementById('filename');
    filenameElement.innerHTML = '';
    let label = openfile.replace(/^.*[\\\/]/, "");
    let appendStr;
    if (files.length > 1) {
        appendStr = `<div id="fileContainer" class="btn-group dropup">
        <button type="button" class="btn btn-dark" id="dropdownMenuButton"><span id="setFileStart" title="Amend recording start time"
                  class="material-icons-two-tone align-bottom pointer">edit_calendar</span> ${label}
        </button>
        <button class="btn btn-dark dropdown-toggle dropdown-toggle-split" type="button" 
                data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
            <span class="visually-hidden">Toggle Dropdown</span>
        </button>
        <div class="dropdown-menu dropdown-menu-dark" aria-labelledby="dropdownMenuButton">`;
        files.forEach(item => {
            if (item !== openfile) {
                const label = item.replace(/^.*[\\\/]/, "");
                appendStr += `<a id="${item}" class="dropdown-item openFiles" href="#">
                <span class="material-icons-two-tone align-bottom">audio_file</span>${label}</a>`;
            }
        })
        appendStr += `</div></div>`;
    } else {
        appendStr = `<div id="fileContainer">
        <button class="btn btn-dark" type="button" id="dropdownMenuButton">
        <span id="setFileStart" title="Amend recording start time"
                  class="material-icons-two-tone align-bottom pointer">edit_calendar</span> ${label}
        </button></div>`;
    }

    filenameElement.innerHTML = appendStr;
    //remove filename picker so they don't accumulate!
    const pickers = document.getElementsByClassName('opensright');
    while (pickers.length > 0) {
        pickers[0].parentNode.removeChild(pickers[0]);
    }
    //Before adding this one
    $(function () {
        $('#setFileStart').daterangepicker({
            singleDatePicker: true,
            showDropdowns: true,
            startDate: moment(fileStart),
            minYear: 2015,
            maxDate: moment(),
            maxYear: parseInt(moment().format('YYYY')),
            timePicker: true,
            timePicker24Hour: true,
            locale: {
                applyLabel: 'Set Recording Start Time'
            }
        }, function (start, end, label) {
            fileStart = start.toDate().getTime();
            worker.postMessage({action: 'update-file-start', file: currentFile, start: fileStart});
        });
    })
}


/**
 * We post the list to the worker as it has node and that allows it easier access to the
 * required filesystem routines
 * @param filePaths
 */
const openFiles = ({filePaths}) => {
    worker.postMessage({action: 'open-files', files: filePaths})
}

async function onOpenFiles(args) {
    hideAll();
    showElement(['spectrogramWrapper'], false);
    resetResults();
    //completeDiv.hide();
    // Store the file list and Load First audio file
    fileList = args.filePaths;
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

    await loadAudioFile({filePath: fileList[0]});
    updateFileName(fileList, fileList[0]);

    disableMenuItem(['analyseSelection', 'analyse', 'analyseAll', 'reanalyse', 'reanalyseAll'])
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
    await window.electron.saveFile({currentFile: currentFile, labels: AUDACITY_LABELS[currentFile]});
}

// Worker listeners
function analyseReset() {
    fileNumber.innerText = '';
    PREDICTING = true;
    delete diagnostics['Audio Duration'];
    AUDACITY_LABELS = {};
    progressDiv.show();
    // Diagnostics
    t0_analysis = Date.now();
}

function isEmptyObject(obj) {
    for (const i in obj) return false;
    return true
}

function refreshResultsView() {
    hideAll();
    if (fileLoaded) {
        showElement(['spectrogramWrapper', 'fullscreen'], false);
        if (!isEmptyObject(predictions)) {
            showElement(['resultTableContainer'], false);
        }
    } else {
        showElement(['loadFileHint', 'loadFileHintText'], true);
    }
    //adjustSpecDims(true);
}

const navbarAnalysis = document.getElementById('navbarAnalysis');
navbarAnalysis.addEventListener('click', async () => {
    refreshResultsView();
    STATE.mode = 'analyse';
});

const analyseLink = document.getElementById('analyse');
analyseLink.addEventListener('click', async () => {
    analyseList = [currentFile];
    postAnalyseMessage({confidence: config.minConfidence, resetResults: true, currentFile: currentFile});
});

const reanalyseLink = document.getElementById('reanalyse');
reanalyseLink.addEventListener('click', async () => {
    analyseList = [currentFile];
    postAnalyseMessage({
        confidence: config.minConfidence,
        resetResults: true,
        currentFile: currentFile,
        reanalyse: true
    });
});

const analyseAllLink = document.getElementById('analyseAll');
analyseAllLink.addEventListener('click', async () => {
    analyseList = undefined;
    postAnalyseMessage({confidence: config.minConfidence, resetResults: true, files: fileList});
});

const reanalyseAllLink = document.getElementById('reanalyseAll');
reanalyseAllLink.addEventListener('click', async () => {
    analyseList = undefined;
    postAnalyseMessage({confidence: config.minConfidence, resetResults: true, files: fileList, reanalyse: true});
});

const getSelectionResults = () => {
    STATE.mode = 'analyse';
    analyseList = [currentFile];
    try {
        let start = region.start + bufferBegin;
        // Remove small amount of region to avoid pulling in results from 'end'
        let end = region.end + bufferBegin - 0.001;
        if (end - start < 0.5) {
            region.end = region.start + 0.5;
            end = start + 0.5
        }
        STATE['selection']['start'] = start.toFixed(3);
        STATE['selection']['end'] = end.toFixed(3);
        postAnalyseMessage({
            confidence: config.minConfidence,
            resetResults: false,
            currentFile: currentFile,
            start: STATE['selection']['start'],
            end: STATE['selection']['end'],
        });
    } catch (err) {
        // Was too fast. Give worker chance to response and try again
        setTimeout(getSelectionResults, 100)
    }
}

const analyseSelectionLink = document.getElementById('analyseSelection');
analyseSelectionLink.addEventListener('click', getSelectionResults);

function postAnalyseMessage(args) {

    if (args.resetResults) {
        analyseReset();
        resetResults();
    } else {
        progressDiv.show();
        updateProgress(0);
        delete diagnostics['Audio Duration'];
    }
    worker.postMessage({
        action: 'analyse',
        confidence: args.confidence,
        resetResults: args.resetResults,
        start: args.start,
        end: args.end,
        currentFile: args.currentFile,
        filesInScope: analyseList || fileList,
        reanalyse: args.reanalyse,
        snr: config.snr
    });
    if (!args.currentFile) {
        batchInProgress = true;
    }
}


// Menu bar functions

function exitApplication() {
    window.close()
}

function enableMenuItem(id_list) {
    id_list.forEach(id => {
        $('#' + id).removeClass('disabled');
    })
}

function disableMenuItem(id_list) {
    id_list.forEach(id => {
        $('#' + id).addClass('disabled');
    })
}


function setHeight(el, val) {
    if (typeof val === 'function') val = val();
    if (typeof val === 'string') el.style.height = val;
    else el.style.height = val + 'px';
}

function showElement(id_list, makeFlex = true, empty = false) {
    id_list.forEach(id => {
        //const thisElement = $('#' + id);
        const thisElement = document.getElementById(id);
        //thisElement.show();
        //thisElement.removeClass('d-none');
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
        const thisElement = $('#' + id);
        thisElement.removeClass('d-flex');
        thisElement.addClass('d-none');
    })
}

function hideAll() {
    // File hint div,  Waveform, timeline and spec, controls and result table
    hideElement(['loadFileHint', 'loadFileHintText', 'loadFileHintSpinner', 'exploreWrapper',
        'spectrogramWrapper', 'resultTableContainer', 'recordsContainer', 'fullscreen']);
}

const save2dbLink = document.getElementById('save2db');
save2dbLink.addEventListener('click', async () => {
    worker.postMessage({action: 'save2db'})
});


const chartsLink = document.getElementById('charts');
chartsLink.addEventListener('click', async () => {
    STATE.mode = 'chart';
    worker.postMessage({action: 'get-detected-species-list', range: STATE.chart.range});
    hideAll();
    showElement(['recordsContainer']);
    worker.postMessage({action: 'chart', species: undefined, range: {start: undefined, end: undefined}});
});


const exploreLink = document.getElementById('explore');
exploreLink.addEventListener('click', async () => {
    analyseList = undefined;
    STATE.mode = 'explore';
    worker.postMessage({action: 'get-detected-species-list', range: STATE.explore.range});
    hideAll();
    showElement(['exploreWrapper', 'spectrogramWrapper'], false);
});

const datasetLink = document.getElementById('dataset');
datasetLink.addEventListener('click', async () => {
    worker.postMessage({action: 'create-dataset'});
});


// thresholdLink.addEventListener('keypress', handleThresholdChange );


function createRegion(start, end, label) {
    wavesurfer.pause();
    resetRegions();
    wavesurfer.addRegion({
        start: start,
        end: end,
        color: "rgba(255, 255, 255, 0.2)",
        attributes: {
            label: label || ''
        }
    });
    const progress = start / wavesurfer.getDuration();
    wavesurfer.seekAndCenter(progress);
}

// We add the handler to the whole table as the body gets replaced and the handlers on it would be wiped
const results = document.getElementById('results');
results.addEventListener('click', resultClick);
selectionTable.addEventListener('click', resultClick);

function resultClick(e) {
    let row = e.target.closest('tr');
    if (!row || row.classList.length === 0) { // 1. clicked and dragged, 2 no detections in file row
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
    const params = row.attributes[2].value.split('|');
    if (e.target.classList.contains('play')) params.push('true')
    loadResultRegion(params);
    if (e.target.classList.contains('circle')) {
        getSelectionResults()
    }
}

function loadResultRegion(params) {
    // Accepts global start and end timecodes from model detections
    // Need to find and centre a view of the detection in the spectrogram
    // 3 second detections
    let [file, start, end, label, play] = params;
    start = parseFloat(start);
    end = parseFloat(end);
    // ensure region doesn't spread across the whole window
    if (windowLength <= 3.5) windowLength = 6;
    bufferBegin = Math.max(0, start - (windowLength / 2) + 1.5)
    const position = wavesurfer.getCurrentTime() / windowLength;
    const region = {start: Math.max(start - bufferBegin, 0), end: end - bufferBegin, label: label, play: play};
    postBufferUpdate({file: file, begin: bufferBegin, position: position, region: region})
}

/**
 *
 * @param redraw boolean, whether to re-render the spectrogram
 * @param fftSamples: Optional, the number of fftsamples to use for rendering. Must be a factor of 2
 */
function adjustSpecDims(redraw, fftSamples) {
    //Contentwrapper starts below navbar (66px) and ends above footer (30px). Hence - 96
    contentWrapperElement.height(bodyElement.height() - 96);
    const contentHeight = contentWrapperElement.outerHeight(true);
    // + 2 for padding
    const formOffset = $('#exploreWrapper').outerHeight(true);
    const specWrapperElement = document.getElementById('spectrogramWrapper');
    let specOffset;
    if (!spectrogramWrapper.hasClass('d-none')) {
        // Expand up to 512px unless fullscreen
        const controlsHeight = $('#controlsWrapper').outerHeight(true);
        const timelineHeight = $('#timeline').outerHeight(true);
        const specHeight = config.fullscreen ? contentHeight - timelineHeight - formOffset - controlsHeight : Math.min(contentHeight * 0.4, 512);
        if (currentFile) {
            // give the wrapper space for the transport controls and element padding/margins
            if (!wavesurfer) {
                initWavesurfer({
                    audio: currentBuffer,
                    backend: 'WebAudio',
                    alpha: 0,
                    height: specHeight,
                    reset: false
                });
            } else {
                wavesurfer.setHeight(specHeight);
            }
            initSpectrogram(specHeight, fftSamples);
            specCanvasElement.width('100%');
            specElement.css('z-index', 0);
            $('.spec-labels').width('55px')
        }
        if (wavesurfer && redraw) wavesurfer.drawBuffer();
        specOffset = specWrapperElement.offsetHeight;
    } else {
        specOffset = 0
    }
    resultTableElement.height(contentHeight - specOffset - formOffset);
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
    } else if (length < 1) return `Region length: ${(length * 1000).toFixed(0)} ms`
    else {
        return `Region length: ${length.toFixed(3)} seconds`
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
        secondsStr = seconds.toString();
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

function updatePrefs() {
    try {
        fs.writeFileSync(p.join(appPath, 'config.json'), JSON.stringify(config))
    } catch (e) {
        console.log(e)
    }
}


/////////////////////////  Window Handlers ////////////////////////////
let appPath, tempPath;
window.onload = async () => {
    // Set config defaults
    const defaultConfig = {
        UUID: uuidv4(),
        colormap: 'inferno',
        minConfidence: 45,
        timeOfDay: false,
        list: 'migrants',
        model: 'efficientnet',
        latitude: 51.9,
        longitude: -0.4,
        nocmig: false,
        snr: 0,
        warmup: true,
        backend: 'tensorflow',
        tensorflow: {threads: diagnostics['Cores'], batchSize: 4},
        webgl: {threads: 1, batchSize: 4},
        limit: 500,
        fullscreen: false
    };
// Load preferences and override defaults
    [appPath, tempPath] = await getPaths();
    await fs.readFile(p.join(appPath, 'config.json'), 'utf8', (err, data) => {
            if (err) {
                console.log('JSON parse error ' + err);
                // Use defaults
                config = defaultConfig;
            } else {
                config = JSON.parse(data);
            }

            //fill in defaults
            Object.keys(defaultConfig).forEach(key => {
                if (!(key in config)) {
                    config[key] = defaultConfig[key];
                }
            });

            // Initialize Spectrogram
            initWavesurfer({});
            // Set UI option state
            const batchSizeSlider = document.getElementById('batch-size');
            // Map slider value to batch size
            batchSizeSlider.value = BATCH_SIZE_LIST.indexOf(config[config.backend].batchSize);
            batchSizeSlider.max = (BATCH_SIZE_LIST.length - 1).toString();
            batchSizeValue.innerText = config[config.backend].batchSize;
            diagnostics['Batch size'] = config[config.backend].batchSize;
            const modelToUse = document.getElementById('model-to-use');
            modelToUse.value = config.model;
            diagnostics['Model'] = config.model;
            const backend = document.getElementById(config.backend);
            backend.checked = true;
            // Show time of day in results?
            const timestamp = document.querySelectorAll('.timestamp');
            if (!config.timeOfDay) {
                timestamp.forEach(el => {
                    el.classList.add('d-none')
                })
            }
            // Show the list in use
            document.getElementById('list-to-use').value = config.list;
            // And update the icon
            updateListIcon();
            timelineSetting.value = config.timeOfDay ? 'timeOfDay' : 'timecode';
            // Spectrogram colour
            colourmap.value = config.colormap === 'greys' ? 'greys' : 'inferno';
            // Nocmig mode state
            console.log('nocmig mode is ' + config.nocmig)
            nocmigButton.innerText = config.nocmig ? 'bedtime' : 'bedtime_off';
            nocmigButton.title = config.nocmig ? 'Nocmig mode on' : 'Nocmig mode off';
            confidenceRange.value = config.minConfidence;
            thresholdDisplay.innerHTML = `<b>${config.minConfidence}%</b>`;
            confidenceSlider.value = config.minConfidence;
            confidenceDisplay.innerText = config.minConfidence;
            confidenceRange.value = config.minConfidence;
            SNRSlider.value = config.snr;
            SNRThreshold.innerText = config.snr;
            SNRSlider.disabled = config.backend === 'webgl';
            ThreadSlider.max = diagnostics['Cores'];
            ThreadSlider.value = config[config.backend].threads;
            numberOfThreads.innerText = config[config.backend].threads;
            //showElement([config.colormap], true)
            worker.postMessage({
                action: 'set-variables',
                path: appPath,
                temp: tempPath,
                lat: config.latitude,
                lon: config.longitude,
                confidence: config.minConfidence,
                nocmig: config.nocmig
            });
            loadModel();
            worker.postMessage({action: 'clear-cache'})
        }
    )
// establish the message channel
    setUpWorkerMessaging()

// Set footer year
    $('#year').text(new Date().getFullYear());
//Cache list elements
    speciesListItems = $('#bird-list li span');
}


const setUpWorkerMessaging = () => {
    establishMessageChannel.then(() => {
        worker.addEventListener('message', function (e) {
            const args = e.data;
            const event = args.event;
            switch (event) {
                case 'model-ready':
                    onModelReady(args);
                    break;
                case 'update-summary':
                    updateSummary(args);
                    break;
                case 'files':
                    onOpenFiles(args);
                    break;
                case 'seen-species-list':
                    generateBirdList('seenSpecies', args.list);
                    break;
                case 'prediction-done':
                    onPredictionDone(args);
                    break;
                case 'progress':
                    onProgress(args);
                    break;
                case 'prediction-ongoing':
                    renderResult(args);
                    break;
                case 'update-audio-duration':
                    diagnostics['Audio Duration'] ?
                        diagnostics['Audio Duration'] += args.value :
                        diagnostics['Audio Duration'] = args.value;
                    break;
                case 'spawning':
                    displayWarmUpMessage();
                    break;
                case 'promptToSave':
                    if (confirm("Save results to your archive?")) {
                        worker.postMessage({action: 'save2db'})
                    }
                    break;
                case 'worker-loaded-audio':
                    onWorkerLoadedAudio(args);
                    break;
                case 'chart-data':
                    onChartData(args);
                    break;
                case 'generate-alert':
                    alert(args.message)
                    break
                case 'no-detections-remain':
                    detectionsModal.hide();
                    break;
                default:
                    alert(`Unrecognised message from worker:${args.event}`)
            }
        })
    })
}

function generateBirdList(store, rows) {
    let listHTML;

    if (store === 'allSpecies') {
        const excluded = ['Human', 'Vehicle', 'Animal', 'Ambient Noise'];
        const lastSelectedSpecies = STATE.birdList.lastSelectedSpecies;
        const remember = lastSelectedSpecies && excluded.indexOf(lastSelectedSpecies) === -1 ?
            `<li><a href="#">${lastSelectedSpecies}</a></li>` : '';
        listHTML = `
            <div class="bird-list all"><div class="rounded-border"><ul>
            ${remember}
            <li><a href="#">Animal</a></li>
            <li><a href="#">Ambient Noise</a></li>
            <li><a href="#">Human</a></li>
            <li><a href="#">Vehicle</a></li>`;

        for (const item in labels) {
            const [sname, cname] = labels[item].split('_');
            if (excluded.indexOf(cname) === -1 && cname.indexOf(lastSelectedSpecies) === -1) {
                listHTML += `<li><a href="#">${cname} - ${sname}</a></li>`;
            }
        }
    } else {
        listHTML = '<div class="bird-list seen"><div class="rounded-border"><ul class="request-bird">';
        for (const item in rows) {
            listHTML += `<li><a href="#">${rows[item].cname} - ${rows[item].sname} (${rows[item].count})</a></li>`;
        }
    }
    const parking = document.getElementById(store);
    listHTML += '</ul></div></div>';
    parking.innerHTML = listHTML;
}

// Search list handlers

$(document).on('focus', '.input', function () {
    document.removeEventListener('keydown', handleKeyDownDeBounce, true);
    const container = this.parentNode.querySelector('.bird-list-wrapper');
    // check we're not adjusting the confidence threshold - if we are, container will be null
    if (container) {
        let theList;
        if (container.classList.contains('editing')) {
            theList = document.querySelector('#allSpecies .bird-list')
        } else {
            theList = document.querySelector('#seenSpecies .bird-list')
        }
        if (theList) {  //there won't be a seenSpecies list until some records are saved
            container.appendChild(theList.cloneNode(true));
            theList = container.querySelector('.bird-list');
            theList.addEventListener('click', editHandler);
        }
    }
    if (this.id === "speciesSearch") hideElement(['dataRecords']);
})

$(document).on('blur', '.input', function (e) {
    document.addEventListener('keydown', handleKeyDownDeBounce, true);
    if (this.id !== 'threshold') {
        // We're looking at the birdlist search, so use a timeout to allow a click event on the list to fire
        setTimeout(hideBirdList, 250, this.parentNode);
    }
})

function hideBirdList(el) {
    const list = el.closest('.species-selector').querySelector('.bird-list');
    if (el.id === 'edit') {
        const cname = el.closest('.cname');
        if (cname) {
            const row = cname.closest('tr');
            const restore = row.querySelector('.restore');
            cname.replaceWith(restore);
            restore.classList.remove('restore', 'd-none');
        }
    } else {
        list.remove();
    }
}

let restoreSpecies;

$(document).on('contextmenu', '.edit, .cname', setEditID);

function setEditID(e) {
    setClickedIndex(e.target);
    const currentRow = e.target.closest('tr');
    let restore = currentRow.querySelector('.cname').cloneNode(true);
    restore.classList.add('restore', 'd-none');
    currentRow.appendChild(restore);
    let cname = currentRow.querySelector('.cname');
    // save the original cell contents in case edit is aborted or doesn't change species
    restoreSpecies = restore;
    // save the original species to use in batch edit search
    generateBirdList('allSpecies');
    cname.innerHTML = `<div id='edit' class="species-selector"><input type="text" class="input" id="editInput" 
                    placeholder="Search for a species..."><div class="editing bird-list-wrapper"></div></div>`;

    document.getElementById('editInput').focus();
}


// Clear contents of species input when clicked
$('.species-selector > input').on('focus', function () {
    this.value = '';
})

// Bird list filtering
$(document).on('keyup', '.input:not(.form-control)', filterList);

function filterList(e) {
    const input = e.target;
    const filter = input.value.toUpperCase();
    const ul = input.parentNode.querySelector("ul");
    const li = ul.getElementsByTagName('li');
    const theList = document.querySelector('.bird-list');
    theList.classList.remove('d-none');
    // Loop through all list items, and hide those who don't match the search query
    for (let i = 0; i < li.length; i++) {
        const a = li[i].getElementsByTagName("a")[0];
        const txtValue = a.textContent || a.innerText;
        if (txtValue.toUpperCase().indexOf(filter) > -1) {
            li[i].style.display = "";
        } else {
            li[i].style.display = "none";
        }
    }
}

function formatInputText(species) {
    species = formatSpeciesName(species);
    let [cname, latin] = species.split('~');
    cname = cname.replace(/_/g, ' ',);
    latin = latin.replace(/_/g, ' ');
    const speciesLabel = `${cname} (${latin})`;
    return [speciesLabel, cname];
}

function editHandler(e) {
    const container = this.closest('.species-selector').querySelector('.bird-list-wrapper');
    if (container.classList.contains('editing')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const [speciesLabel,] = formatInputText(e.target.innerText)
        const input = this.closest('.species-selector').querySelector('input');
        input.value = speciesLabel;
        let species = e.target.innerText;
        let [cname, sname] = species.split(' - ');
        // Handle animal, vehicle, etc.
        if (!sname) sname = cname;
        STATE.birdList.lastSelectedSpecies = cname;
        const cnameCell = this.closest('.cname');
        editID(cname, sname, cnameCell);
    }
}

const getActiveRow = () => {
    const activeRow = document.querySelector('.table-active');
    return activeRow ? activeRow.id : undefined;
};

const isSpeciesViewFiltered = (sendSpecies) => {
    const filtered = document.querySelector('.speciesFilter span.text-warning');
    const species = filtered ? filtered.innerHTML.replace(/\s<.*/, '') : undefined;
    return sendSpecies ? species : filtered !== null;
}

//Works for single and batch items in Explore, but not in Analyse
const editID = (cname, sname, cell) => {
    // Make sure we update the restore species
    //restoreSpecies = cell;
    let from;
    restoreSpecies.querySelector('ul') ?
        from = restoreSpecies.querySelector('ul').firstElementChild.firstChild.nodeValue.trim() :
        from = restoreSpecies.firstElementChild.innerHTML.replace(/(.*)\s<.*/, "$1");
    // Are we batch editing here?
    const context = getDetectionContext(cell)
    const batch = context === 'resultSummary';
    let start, files = fileList, file;
    if (!batch) {
        [file, start, end, currentRow] = unpackNameAttr(cell, cname);
        sendFeedback(file, cname, sname);
    }
    //let active = getActiveRow();
    //cell.innerHTML = `${cname} <br><i>${sname}</i>`;
    const range = context === 'selectionResults' ? getSelectionRange() : undefined;
    updateRecord('ID', range, start, from, cname, context, batch)
};

function unpackNameAttr(el, cname) {
    const currentRow = el.closest("tr");
    const nameAttr = currentRow.attributes[2].value;
    let [file, start, end, commonName] = nameAttr.split('|');
    if (cname) commonName = cname;
    currentRow.attributes[0].value = [file, start, end, commonName].join('|');
    return [file, parseFloat(start), parseFloat(end), currentRow];
}


function sendFeedback(file, cname, sname) {
    predictions[clickedIndex].cname = cname;
    predictions[clickedIndex].sname = sname;
    predictions[clickedIndex].filename =
        `${cname.replace(/\s+/g, '_')}~${sname.replace(/\s+/g, '_')}~${Date.parse(predictions[clickedIndex].date)}.opus`;
    sendFile('incorrect', predictions[clickedIndex]);
}

function getSpecies(target) {
    const row = target.closest('tr');
    const speciesCell = row.querySelector('.cname');
    const species = speciesCell.innerText.split('\n')[0];
    return species;
}

function updateLabel(e) {
    // Below is required so we don't post an update when an existing  label is clicked
    if (this.childElementCount < 2) return
    // context can be one of: results, selectionResults, resultSummary
    const detectionContext = getDetectionContext(e.target);
    let label = e.target.innerText.replace('Remove Label', '');
    // update the clicked badge
    const parent = e.target.parentNode;
    const species = getSpecies(e.target)
    parent.innerHTML = label ? tags[label] : '';
    if (detectionContext === 'results' || detectionContext === 'selectionResults') {
        const [, start, ,] = unpackNameAttr(activeRow);
        const range = detectionContext === 'selectionResults' ?
            getSelectionRange() : undefined;
        updateRecord('label', range, start, species, label, detectionContext)
    } else {
        // this is the summary table and a batch update is wanted
        //are we in Explore mode?
        const files = isExplore() ? [] : fileList;
        updateRecord('label', undefined, species, label, detectionContext, true)
    }
    addEvents('label');
}

function addEvents(element) {
    $(document).on('mouseenter', '.' + element, function () {

        $(this).children(`span.add-${element}`).removeClass("invisible");
    })

    $(document).on('mouseleave', '.' + element, function (e) {
        const text = e.target.innerText;
        const hasElement = text === 'comment' || text === 'Nocmig' || text === 'Local';
        if (hasElement) return;

        this.innerHTML = element === 'comment' ?
            `<span title="Add a ${element}" class="material-icons-two-tone pointer add-${element} invisible">add_${element}</span>` :
            tags['Remove Label'];
    })
}

const getDetectionContext = (target) => target.closest('table').id;

// Bird list form  click handler
$(document).on('click', '.request-bird', function (e) {
    // Clear the results table
    resultTable.innerText = '';
    const [, cname] = formatInputText(e.target.innerText)
    const context = this.closest('.bird-list-wrapper').classList[0];
    let pickerEl = context + 'Range';
    t0 = Date.now();
    context === 'chart' ? STATE.chart.species = cname : STATE.explore.species = cname;
    const picker = $('#' + pickerEl).data('daterangepicker');
    const start = picker.startDate._d.getTime();
    const end = picker.endDate._d.getTime();
    STATE[context].range = end !== start ? {start: start, end: end} : {};
    worker.postMessage({action: context, species: cname, range: STATE[context].range, order: STATE.explore.order})
})


// Chart functions
function getDateOfISOWeek(w) {
    const options = {month: 'long', day: 'numeric'};
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
    const genTimeElement = document.getElementById('genTime')
    genTimeElement.innerText = (genTime / 1000).toFixed(1) + ' seconds';
    if (args.species) showElement(['dataRecords'], false);
    const elements = document.getElementsByClassName('highcharts-data-table');
    while (elements.length > 0) {
        elements[0].parentNode.removeChild(elements[0]);
    }
    const records = args.records;
    for (const [key, value] of Object.entries(records)) {
        const element = document.getElementById(key);
        if (value?.constructor === Array) {
            if (isNaN(value[0])) element.innerText = 'N/A';
            else {
                element.innerText = value[0].toString() + ' on ' +
                    new Date(value[1]).toLocaleDateString(undefined, {dateStyle: "short"})
            }
        } else {
            element.innerText = value ? new Date(value).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric"
            }) : 'No Records';
        }
    }
    const results = args.results;
    const rate = args.rate;
    const total = args.total;
    const dataPoints = args.dataPoints;
    const aggregation = args.aggregation;
    const pointStart = args.pointStart;
    const chartOptions = setChartOptions(args.species, total, rate, results, dataPoints, aggregation, pointStart);
    Highcharts.chart('chart-week', chartOptions);
}

function setChartOptions(species, total, rate, results, dataPoints, aggregation, pointStart) {
    let chartOptions = {};
    chartOptions.yAxis = [];
    const pointInterval = {Week: 7 * 24 * 36e5, Day: 24 * 36e5, Hour: 36e5};
    chartOptions.colors = ["#003", "#2B9179", "#AB41E8", "#E88E2A", "#E86235"];
    chartOptions.chart = {
        zoomType: 'x',
        backgroundColor: {linearGradient: [0, 0, 0, 500], stops: [[0, "#dbe2ed"], [1, "#dddddd"]]}
    }
    chartOptions.credits = {text: 'Chart generated by Chirpity Nocmig', href: ''}
    chartOptions.title = species ? {text: `${species} Detections`} : {text: 'Hours Recorded'};
    chartOptions.lang = {
        noData: "No Detections to Display"
    }
    chartOptions.noData = {
        style: {
            fontWeight: 'bold',
            fontSize: '25px',
            color: '#303030'
        }
    }
    chartOptions.time = {useUTC: false}; // Use localtime for axes
    Highcharts.dateFormats.W = function (timestamp) {
        let date = new Date(timestamp), day = date.getUTCDay() === 0 ? 7 : date.getUTCDay(), dayNumber;
        date.setDate(date.getUTCDate() + 4 - day);
        dayNumber = Math.floor((date.getTime() - new Date(date.getUTCFullYear(), 0, 1, -6)) / 86400000);
        return 1 + Math.floor(dayNumber / 7);
    };
    const format = {Week: '{value:Week %W}', Day: '{value:%a %e %b}', Hour: '{value:%l%P}'}
    chartOptions.xAxis = {
        type: 'datetime',
        tickInterval: pointInterval[aggregation], // one week
        labels: {
            format: format[aggregation],
        }
    };

    chartOptions.series = [];
    if (aggregation === 'Week') {
        chartOptions.series.push({
            name: 'Hours of recordings',
            marker: {enabled: false},
            yAxis: 0,
            type: 'areaspline',
            data: total,
            pointInterval: pointInterval[aggregation],
            pointStart: pointStart,
            lineWidth: 0,
            fillColor: {
                linearGradient: [0, 0, 0, 300],
                stops: [
                    [0, chartOptions.colors[0]],
                    [1, Highcharts.color(chartOptions.colors[0]).setOpacity(0.2).get('rgba')]
                ]
            }
        });
        chartOptions.yAxis.push({
            title: {
                text: 'Hours recorded'
            },
            accessibility: {
                description: 'Total recording time in hours'
            },
            opposite: true
        });
    }
    if (rate && Math.max(...rate) > 0) {
        if (aggregation === 'Week') {
            chartOptions.yAxis.push({
                title: {text: 'Hourly Detection Rate'},
                accessibility: {description: 'Hourly rate of records'},
                opposite: true
            });
            chartOptions.series.push({
                name: 'Average hourly call rate',
                marker: {enabled: false},
                yAxis: 1,
                type: 'areaspline',
                data: rate,
                lineWidth: 0,
                pointInterval: pointInterval[aggregation],
                pointStart: pointStart,
                fillColor: {
                    linearGradient: [0, 0, 0, 300],
                    stops: [
                        [0, chartOptions.colors[1]],
                        [1, Highcharts.color(chartOptions.colors[1]).setOpacity(0.2).get('rgba')]
                    ]
                }
            });
        }
    }
    let hasResults = false;
    for (const key in results) {
        hasResults = true;
        chartOptions.series.push({
            name: `Total for ${aggregation} in ` + key,
            pointInterval: pointInterval[aggregation],
            pointStart: pointStart,
            type: 'column',
            yAxis: chartOptions.yAxis.length,
            data: results[key]
        });
    }
    if (hasResults) {
        chartOptions.yAxis.push(
            {
                title: {text: 'Detections'},
                accessibility: {description: 'Count of records'}
            }
        );
    }

    chartOptions.tooltip = {
        crosshairs: true, shared: true, formatter: function () {
            const x = new Date(this.x)
            if (aggregation === "Week") {
                const oneJan = new Date(x.getFullYear(), 0, 1);
                const numberOfDays = Math.floor((x - oneJan) / (24 * 60 * 60 * 1000));
                const weekOfYear = Math.ceil((x.getDay() + 1 + numberOfDays) / 7);
                return this.points.reduce(function (s, point) {
                    return s + '<br/><span style="font-weight: bold;color: ' + point.series.color + '">&#9679; </span>' + point.series.name + ': ' +
                        point.y;
                }, `<b>${aggregation} ${weekOfYear} (${getDateOfISOWeek(weekOfYear)} - ${getDateOfISOWeek(weekOfYear + 1)})</b>`);
            } else if (aggregation === 'Day') {
                const period = moment(x).format('MMMM Do, YYYY');
                return this.points.reduce(function (s, point) {
                    return s + '<br/><span style="font-weight: bold;color: ' + point.series.color + '">&#9679; </span>' + point.series.name + ': ' +
                        point.y;
                }, `<b>${period}</b>`);
            } else {
                const period = moment(x).format('MMM D, ha');
                return this.points.reduce(function (s, point) {
                    return s + '<br/><span style="font-weight: bold;color: ' + point.series.color + '">&#9679; </span> Count: ' +
                        point.y;
                }, `<b>${period}</b>`);
            }
        }
    };
    chartOptions.exporting = {};
    chartOptions.exporting.csv = {
        columnHeaderFormatter: function (item, key) {
            if (!item || item instanceof Highcharts.Axis) {
                return ''
            } else {
                return item.name;
            }
        }
    };
    return chartOptions;
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

$(window).resize(function () {
    waitForFinalEvent(function () {

        WindowResize();
    }, 250, 'id1');
});

function WindowResize() {
    //updateElementCache();
    adjustSpecDims(true);
}

$(document).on('click', '.play', function () {
    (typeof region !== 'undefined') ? region.play() : console.log('Region undefined')
})


function handleKeyDownDeBounce(e) {
    e.preventDefault();
    waitForFinalEvent(function () {
        handleKeyDown(e);
    }, 100, 'keyhandler');
}

function handleKeyDown(e) {
    let action = e.code;
    if (action in GLOBAL_ACTIONS) {
        if (document === e.target || document.body === e.target || e.target.attributes["data-action"]) {

        }
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

function enableKeyDownEvent() {
    document.addEventListener('keydown', handleKeyDownDeBounce, true);
}


///////////// Nav bar Option handlers //////////////

function initSpectrogram(height, fftSamples) {
    console.log("initializing spectrogram")
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
    wavesurfer.addPlugin(WaveSurfer.spectrogram.create({
        //deferInit: false,
        wavesurfer: wavesurfer,
        container: "#spectrogram",
        scrollParent: false,
        fillParent: true,
        windowFunc: 'hamming',
        minPxPerSec: 1,
        frequencyMin: 0,
        frequencyMax: 11750,
        normalize: false,
        hideScrollbar: true,
        labels: true,
        height: height,
        fftSamples: fftSamples,
        colorMap: colormap({
            colormap: config.colormap, nshades: 256, format: 'float'
        }),
    })).initPlugin('spectrogram');
    updateElementCache();
}

colourmap.addEventListener('change', (e) => {
    config.colormap = e.target.value;
    updatePrefs();
    if (wavesurfer) {
        initSpectrogram();
        // refresh caches
        updateElementCache()
        adjustSpecDims(true)
    }
})


// list mode icons
const listIcon = document.getElementById('list-icon')
const updateListIcon = () => {
    const icon = listIcon.querySelector('img');
    icon.src = icon.src.replace(/\w+\.png$/, config.list + '.png');
    const states = {
        migrants: 'Searching for migrants and owls',
        birds: 'Searching for all birds',
        everything: 'Searching for everything'
    };
    icon.title = states[config.list];
}
listIcon.addEventListener('click', () => {
    let img = listIcon.querySelector('img')
    const states = {
        migrants: 'Searching for migrants and owls',
        birds: 'Searching for all birds',
        everything: 'Searching for everything'
    };
    const keys = Object.keys(states);
    for (let key in Object.keys(states)) {
        key = parseInt(key);
        if (img.src.indexOf(keys[key]) !== -1) {
            const replace = (key === keys.length - 1) ? 0 : key + 1;
            img.src = img.src.replace(keys[key], keys[replace]);
            img.title = states[keys[replace]];
            listToUse.value = keys[replace];
            config.list = keys[replace];
            updatePrefs();
            worker.postMessage({action: 'update-list', list: config.list, explore: isExplore()})
            // setTimeout(setFilter, 10);
            break
        }
    }
})


const listToUse = document.getElementById('list-to-use');
listToUse.addEventListener('change', function (e) {
    config.list = e.target.value;
    updateListIcon();
    updatePrefs();
    worker.postMessage({action: 'update-list', list: config.list, explore: isExplore()})
    setFilter();
})

const loadModel = () => {
    t0_warmup = Date.now();
    worker.postMessage({
        action: 'load-model',
        model: config.model,
        list: config.list,
        batchSize: config[config.backend].batchSize,
        warmup: config.warmup,
        threads: config[config.backend].threads,
        backend: config.backend
    });
}

const modelToUse = document.getElementById('model-to-use');
modelToUse.addEventListener('change', function (e) {
    config.model = e.target.value;
    updatePrefs();
    diagnostics['Model'] = config.model;
    loadModel();
})

const backend = document.getElementsByName('backend');
for (let i = 0; i < backend.length; i++) {
    backend[i].addEventListener('click', function (e) {
        config.backend = e.target.value;
        SNRSlider.disabled = config.backend === 'webgl';
        SNRThreshold.innerText = config.snr.toString();
        // Update threads and batch Size in UI
        ThreadSlider.value = config[config.backend].threads;
        numberOfThreads.innerText = config[config.backend].threads;
        batchSizeSlider.value = BATCH_SIZE_LIST.indexOf(config[config.backend].batchSize);
        batchSizeValue.innerText = BATCH_SIZE_LIST[batchSizeSlider.value].toString();
        config.backend === 'webgl' ? powerSave(true) : powerSave(false);
        updatePrefs();
        loadModel();
    })
}

const timelineToggle = (e) => {
    // set file creation time
    config.timeOfDay = e.target.value === 'timeOfDay'; //toggle setting
    const timeFields = document.querySelectorAll('.timestamp')
    timeFields.forEach(time => {
        config.timeOfDay ? time.classList.remove('d-none') :
            time.classList.add('d-none');
    });
    if (fileLoaded) {
        const position = wavesurfer.getCurrentTime() / windowLength;
        postBufferUpdate({begin: bufferBegin, position: position})
    }
    updatePrefs();
};
document.getElementById('timelineSetting').addEventListener('change', timelineToggle);

/////////// Keyboard Shortcuts  ////////////

const GLOBAL_ACTIONS = { // eslint-disable-line
    KeyA: async function (e) {
        if (e.ctrlKey) {
            if (e.shiftKey && AUDACITY_LABELS !== {}) await showSaveDialog();
            else if (currentFile) analyseLink.click()
        }
    },
    KeyE: function (e) {
        if (e.ctrlKey) sendFile('save');
    },
    KeyO: async function (e) {
        if (e.ctrlKey) await showOpenDialog();
    },
    KeyP: function () {
        (typeof region !== 'undefined') ? region.play() : console.log('Region undefined')
    },
    KeyS: function (e) {
        if (e.ctrlKey) worker.postMessage({action: 'save2db'});
    },
    Escape: function () {
        if (PREDICTING) {
            console.log('Operation aborted');
            PREDICTING = false;
            worker.postMessage({
                action: 'abort',
                model: config.model,
                threads: config[config.backend].threads,
                list: config.list
            });
            alert('Operation cancelled');
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
            postBufferUpdate({begin: bufferBegin, position: 1})
        }
    },
    PageUp: function () {
        if (currentBuffer) {
            const position = wavesurfer.getCurrentTime() / windowLength;
            bufferBegin = Math.max(0, bufferBegin - windowLength);
            postBufferUpdate({begin: bufferBegin, position: position})
        }
    },
    PageDown: function () {
        if (currentBuffer) {
            const position = wavesurfer.getCurrentTime() / windowLength;
            bufferBegin = Math.min(bufferBegin + windowLength, currentFileDuration - windowLength);
            postBufferUpdate({begin: bufferBegin, position: position})
        }
    },
    ArrowLeft: function () {
        const skip = windowLength / 100;
        if (currentBuffer) {
            wavesurfer.skipBackward(skip);
            const position = wavesurfer.getCurrentTime() / windowLength;
            if (wavesurfer.getCurrentTime() < skip && bufferBegin > 0) {
                bufferBegin -= skip;
                postBufferUpdate({begin: bufferBegin, position: position})
            }
        }
    },
    ArrowRight: function () {
        const skip = windowLength / 100;
        if (wavesurfer) {
            wavesurfer.skipForward(skip);
            const position = Math.max(wavesurfer.getCurrentTime() / windowLength, 1);
            if (wavesurfer.getCurrentTime() > windowLength - skip) {
                bufferBegin = Math.min(currentFileDuration - windowLength, bufferBegin += skip)
                postBufferUpdate({begin: bufferBegin, position: position})
            }
        }
    },
    Equal: function (e) {
        if (e.shiftKey) {
            if (wavesurfer.spectrogram.fftSamples > 64) {
                wavesurfer.spectrogram.fftSamples /= 2;
                const position = wavesurfer.getCurrentTime() / windowLength;
                const currentRegion = region ? {
                    start: region.start,
                    end: region.end,
                    label: region.attributes?.label
                } : undefined;
                postBufferUpdate({begin: bufferBegin, position: position, region: currentRegion})
                console.log(wavesurfer.spectrogram.fftSamples);
            }
        } else {
            zoomSpec('zoomIn')
        }
    },
    NumpadAdd: function (e) {
        if (e.shiftKey) {
            if (wavesurfer.spectrogram.fftSamples > 64) {
                wavesurfer.spectrogram.fftSamples /= 2;
                const position = wavesurfer.getCurrentTime() / windowLength;
                const currentRegion = region ? {
                    start: region.start,
                    end: region.end,
                    label: region.attributes?.label
                } : undefined;
                postBufferUpdate({begin: bufferBegin, position: position, region: currentRegion})
                console.log(wavesurfer.spectrogram.fftSamples);
            }
        } else {
            zoomSpec('zoomIn')
        }
    },
    Minus: function (e) {
        if (e.shiftKey) {
            if (wavesurfer.spectrogram.fftSamples <= 2048) {
                wavesurfer.spectrogram.fftSamples *= 2;
                const position = wavesurfer.getCurrentTime() / windowLength;
                const currentRegion = region ? {
                    start: region.start,
                    end: region.end,
                    label: region.attributes?.label
                } : undefined;
                postBufferUpdate({begin: bufferBegin, position: position, region: currentRegion})
                console.log(wavesurfer.spectrogram.fftSamples);
            }
        } else {
            zoomSpec('zoomOut')
        }
    },
    NumpadSubtract: function (e) {
        if (e.shiftKey) {
            if (wavesurfer.spectrogram.fftSamples <= 2048) {
                wavesurfer.spectrogram.fftSamples *= 2;
                const position = wavesurfer.getCurrentTime() / windowLength;
                const currentRegion = region ? {
                    start: region.start,
                    end: region.end,
                    label: region.attributes?.label
                } : undefined;
                postBufferUpdate({begin: bufferBegin, position: position, region: currentRegion})
                console.log(wavesurfer.spectrogram.fftSamples);
            }
        } else {
            zoomSpec('zoomOut')
        }
    },
    Space: function () {
        if (wavesurfer) wavesurfer.playPause();
    },
    Tab: function (e) {
        if (activeRow) {
            if (e.shiftKey) {
                activeRow.classList.remove('table-active')
                activeRow = activeRow.previousSibling || activeRow;
                activeRow.classList.add('table-active')
            } else {
                activeRow.classList.remove('table-active')
                activeRow = activeRow.nextSibling || activeRow;
                activeRow.classList.add('table-active')
            }
            activeRow.focus();
            activeRow.click();
        }
    }
};

const postBufferUpdate = ({
                              file = currentFile,
                              begin = 0,
                              position = 0,
                              play = false,
                              resetSpec = false,
                              region = undefined
                          }) => {
    worker.postMessage({
        action: 'update-buffer',
        file: file,
        position: position,
        start: begin,
        end: begin + windowLength,
        play: play,
        resetSpec: resetSpec,
        region: region
    });
}
// Electron Message handling
const warmupText = document.getElementById('warmup');

function displayWarmUpMessage() {
    disableMenuItem(['analyse', 'analyseAll', 'reanalyse', 'reanalyseAll', 'analyseSelection']);
    warmupText.classList.remove('d-none');
}

function onModelReady(args) {
    modelReady = true;
    labels = args.labels;
    warmupText.classList.add('d-none');
    if (workerHasLoadedFile) {
        enableMenuItem(['analyse', 'reanalyse'])
        if (fileList.length > 1) enableMenuItem(['analyseAll', 'reanalyseAll'])
    }
    if (region) enableMenuItem(['analyseSelection'])
    t1_warmup = Date.now();
    diagnostics['Warm Up'] = ((t1_warmup - t0_warmup) / 1000).toFixed(2) + ' seconds';
    diagnostics['Backend'] = args.backend;
}


// worker.onmessage('update-error', async (event, args) => {
//     console.error('update error' + args.error)
// })
//
// worker.onmessage('update-not-available', async (event, args) => {
//     console.log('update not available ' + args.message)
// })
//
// worker.onmessage('update-available', async (event, args) => {
//     console.log('update available ' + args.message)
// })
//
// worker.onmessage('update-downloaded', async (event, args) => {
//     console.log('update downloaded' + args.releaseNotes)
// })

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
async function onWorkerLoadedAudio({
                                       start = 0,
                                       sourceDuration = 0,
                                       bufferBegin = 0,
                                       file = '',
                                       position = 0,
                                       contents = undefined,
                                       fileRegion = {},
                                       preserveResults = false,
                                       play = false
                                   }) {
    workerHasLoadedFile = true;
    const resetSpec = !currentFile;
    currentFileDuration = sourceDuration;
    //if (preserveResults) completeDiv.hide();
    console.log('UI received worker-loaded-audio: ' + file)
    currentBuffer = new AudioBuffer({length: contents.length, numberOfChannels: 1, sampleRate: 24000});
    currentBuffer.copyToChannel(contents, 0);
    if (currentFile !== file) {
        currentFile = file;
        fileStart = start;
        fileEnd = new Date(fileStart + (currentFileDuration * 1000));
        // Update the current file name in the UI
        updateFileName(fileList, file);
    }
    if (config.timeOfDay) {
        bufferStartTime = new Date(fileStart + (bufferBegin * 1000))
    } else {
        bufferStartTime = new Date(zero.getTime() + (bufferBegin * 1000))
    }
    if (windowLength > currentFileDuration) windowLength = currentFileDuration;
    if (modelReady) {
        enableMenuItem(['analyse', 'reanalyse']);
        if (fileList.length > 1) enableMenuItem(['analyseAll', 'reanalyseAll'])
    }
    fileLoaded = true;
    updateSpec({buffer: currentBuffer, play: play, resetSpec: resetSpec})
    wavesurfer.seekTo(position);
    if (fileRegion) {
        createRegion(fileRegion.start, fileRegion.end, fileRegion.label)
        if (fileRegion.play) {
            region.play()
        }
    } else {
        resetRegions();
    }
}

function onProgress(args) {
    progressDiv.show();
    if (args.text) {
        fileNumber.innerHTML = args.text;
    } else {
        const count = fileList.indexOf(args.file) + 1;
        fileNumber.innerText = `File ${count} of ${fileList.length}`;
    }
    if (args.progress) {
        let progress = Math.round(args.progress * 1000) / 10;
        updateProgress(progress)
        if (progress === 100.0) {
            progressDiv.hide();
        }
    } else {
        updateProgress(0)
    }
}


const updateSummary = ({
                           summary = [],
                           filterSpecies = ''
                       }) => {
    let summaryHTML = `<table id="resultSummary" class="table table-striped table-dark table-hover p-1"><thead>
            <tr>
                <th class="col-3" scope="col">Max</th>
                <th class="col-5" scope="col">Species</th>
                <th class="col-1 text-end" scope="col" >Count</th>
                <th class="col-3 text-end" scope="col">Label</th>
            </tr>
            </thead><tbody>`;

    for (let i = 0; i < summary.length; i++) {
        const selected = summary[i].cname === filterSpecies ? 'text-warning' : '';
        summaryHTML += `<tr tabindex="-1">
                        <td class="max">${iconizeScore(summary[i].max)}</td>
                        <td class="cname speciesFilter">
                            <span class="pointer ${selected}">${summary[i].cname} <i>${summary[i].sname}</i></span>
                        </td>                       
                        <td class="text-end">${summary[i].count}</td>
                        <td class="label">${tags['Remove Label']}</td>`;

    }
    summaryHTML += '</tbody></table>';
    // Get rid of flicker...
    const old_summary = document.getElementById('summaryTable');
    const buffer = old_summary.cloneNode();
    buffer.innerHTML = summaryHTML;
    old_summary.replaceWith(buffer);

    const currentFilter = document.querySelector('.speciesFilter span.text-warning');
    if (currentFilter) {
        const filterRow = currentFilter.closest('tr');
        filterRow.focus();
    }
}

async function onPredictionDone({
                                    filterSpecies = undefined,
                                    batchInProgress = false,
                                    audacityLabels = {},
                                    file = undefined,
                                    summary = [],
                                    active = undefined,
                                    total = 0,
                                    offset = 0,
                                    action = undefined
                                }) {

    AUDACITY_LABELS = audacityLabels;
    enableMenuItem(['save2db']);
    // Defer further processing until batch complete
    if (batchInProgress) {
        progressDiv.show();
        return;
    } else {
        PREDICTING = false;
    }
    if (resultsBuffer) {
        const results = document.getElementById('resultTableBody');
        results.replaceWith(resultsBuffer);
        resultsBuffer = undefined;
    }

    updateSummary({summary: summary, filterSpecies: filterSpecies});

    //Pagination
    total > config.limit ? addPagination(total, offset) : pagination.forEach(item => item.classList.add('d-none'));
    if (action !== 'filter') {
        progressDiv.hide();
        updateProgress(0)

        //completeDiv.show();

        if (AUDACITY_LABELS !== {}) {
            enableMenuItem(['saveLabels']);
            $('.download').removeClass('disabled');
        } else {
            disableMenuItem(['saveLabels']);
        }
        if (currentFile) enableMenuItem(['analyse', 'reanalyse'])

        // Add speciesfilter  filter handler
        // setFilterHandler()

        // Diagnostics:
        t1_analysis = Date.now();
        diagnostics['Analysis Duration'] = ((t1_analysis - t0_analysis) / 1000).toFixed(2) + ' seconds';
        diagnostics['Analysis Rate'] = (diagnostics['Audio Duration'] / ((t1_analysis - t0_analysis) / 1000)).toFixed(0) + 'x faster than real time performance.';
    }

    if (active) {
        // Refresh node and scroll to active row:
        activeRow = document.getElementById(active)
        if (activeRow === null) { // because: after an edit the active row may not exist
            resultTable = resultTableElement.getElementById('resultTableBody');
            const rows = resultTable.querySelectorAll('tr.daytime, tr.nighttime')
            if (rows.length) {
                activeRow = rows[rows.length - 1];
            }
        } else {
            activeRow.classList.add('table-active');
        }
        activeRow.focus();
        activeRow.click();
    }
    // else {
    //     document.getElementById('resultTableBody').scrollIntoView({behaviour: 'smooth'});
    // }
}

const pagination = document.querySelectorAll('.pagination');
pagination.forEach(item => {
    item.addEventListener('click', (e) => {
        if (e.target.tagName === 'A') { // Did we click a link in the list?
            let clicked = e.target.innerText;
            let currentPage = pagination[0].querySelector('.active');
            currentPage = parseInt(currentPage.innerText);
            if (clicked === 'Previous') {
                clicked = currentPage - 1
            } else if (clicked === 'Next') {
                clicked = currentPage + 1
            } else {
                clicked = parseInt(clicked)
            }
            const limit = config.limit;
            let offset = (clicked - 1) * limit;
            const species = isSpeciesViewFiltered(true);
            // Reset daylight banner
            shownDaylightBanner = false;
            worker.postMessage({
                action: 'filter',
                species: species,
                files: analyseList || fileList,
                offset: offset,
                limit: limit,
                explore: isExplore(),
                order: STATE.explore.order
            });
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


function setFilter() {
    // Prevent crazy double firing of handler
    //e.stopImmediatePropagation();
    // Species filtering in Explore is meaningless...
    // There won't be a target if the input box is clicked rather than the list
    // if (isExplore()) return
    activeRow = undefined;
    // Am I trying to unfilter?
    const target = this.location ? undefined : this.querySelector('span.pointer');
    if (target?.classList.contains('text-warning')) {
        // Clicked on filtered species icon
        worker.postMessage({
            action: 'filter',
            files: isExplore() ? [] : analyseList || fileList,
            order: STATE.explore.order
        });
        // Clear species from STATE
        STATE.explore.species = undefined;
    } else {
        // Clicked on unfiltered species name
        const species = target ? target.innerHTML.replace(/\s<.*/, '') : undefined;
        STATE.explore.species = species;
        worker.postMessage({
            action: 'filter',
            species: species,
            files: isExplore() ? [] : analyseList || fileList,
            order: STATE.explore.order,
        });
    }
    seenTheDarkness = false;
    shownDaylightBanner = false;
    document.getElementById('results').scrollTop = 0;
}


$(document).on('click', '.speciesFilter', setFilter)

const checkDayNight = (timestamp) => {
    let astro = SunCalc.getTimes(timestamp, config.latitude, config.longitude);
    return (astro.dawn.setMilliseconds(0) < timestamp && astro.dusk.setMilliseconds(0) > timestamp) ? 'daytime' : 'nighttime';
}

// TODO: show every detection in the spec window as a region on the spectrogram

async function renderResult({
                                index = 1,
                                result = {},
                                file = undefined,
                                isFromDB = false,
                                selection = false
                            }) {
    const isFromCache = isFromDB;
    let tr = '';
    if (index <= 1) {
        if (selection) selectionTable.innerHTML = '';
        else {
            showElement(['resultTableContainer'], false);
            resultTable.innerHTML = '';
        }
    } else if (!isFromCache && index > config.limit) {
        if (index % (config.limit + 1) === 0) addPagination(index, 0);
        return
    }
    if (typeof (result) === 'string') {
        const nocturnal = config.nocmig ? '<b>during the night</b>' : '';
        tr += `<tr><th scope='row'>${index}</th><td colspan="8">${result} (Predicting ${config.list} ${nocturnal} with at least ${config.minConfidence}% confidence in the prediction)</td></tr>`;
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
            count
        } = result;
        const dayNight = checkDayNight(timestamp);
        if (dayNight === 'nighttime') seenTheDarkness = true;
        // Todo: move this logic so pre dark sections of file are not even analysed
        if (config.nocmig && !selection && dayNight === 'daytime') return

        // Show twilight indicator when  nocmig mode off (except when analysing a selection)
        if (shownDaylightBanner === false && dayNight === 'daytime') {
            // Only do this if change starts midway through a file
            if ((index - 1) % config.limit !== 0) {
                // Show the twilight start bar
                tr += `<tr class="text-bg-dark"><td colspan="20" class="text-center">
                Start of civil twilight <span class="material-icons-two-tone text-warning align-bottom">wb_twilight</span>
                </td></tr>`;
            }
            shownDaylightBanner = true;
        }
        const commentHTML = comment ?
            `<span title="${comment}" class='material-icons-two-tone pointer edit-comment'>comment</span>` :
            "<span title='Add a comment' class='material-icons-two-tone pointer invisible add-comment'>add_comment</span>";
        const isUncertain = score < 65 ? '&#63;' : '';
        // result.filename  and result.date used for feedback
        result.date = timestamp;
        result.filename = cname.replace(/'/g, "\\'") + ' ' + timestamp + '.mp3';
        // store result for feedback function to use
        predictions[index] = result;
        // Format date and position for  UI
        const tsArray = new Date(timestamp).toString().split(' ');
        const UI_timestamp = `${tsArray[2]} ${tsArray[1]} ${tsArray[3].substring(2)}<br/>${tsArray[4]}`;
        const spliceStart = position < 3600 ? 14 : 11;
        const UI_position = new Date(position * 1000).toISOString().substring(spliceStart, 19);
        const showTimeOfDay = config.timeOfDay ? '' : 'd-none';
        const activeTable = active ? 'table-active' : '';
        const labelHTML = label ? tags[label] : tags['Remove Label'];
        const countIcon = count > 1 ? `<span class="circle pointer">${count}</span>` : '';

        tr += `<tr tabindex="-1" id="result${index}" name="${file}|${position}|${position + 3}|${cname}${isUncertain}" class='${activeTable} border-top border-2 border-secondary ${dayNight}'>
            <th scope='row'>${index}</th>
            <td class='text-start text-nowrap timestamp ${showTimeOfDay}'>${UI_timestamp}</td>
            <td class="text-end">${UI_position} </td>
            <td name="${cname}" class='text-start cname'>
            ${cname} ${countIcon} ${iconizeScore(score)}
             </td>
            <td><span class='material-icons-two-tone play pointer'>play_circle_filled</span></td>
            <td><a href='https://xeno-canto.org/explore?query=${sname}%20type:"nocturnal flight call"' target="xc">
                <img src='img/logo/XC.png' alt='Search ${cname} on Xeno Canto' title='${cname} NFCs on Xeno Canto'></a></td>
            <td><span class='delete material-icons-two-tone pointer'>delete_forever</span></td>
            <td class="label">${labelHTML}</td>
            <td class="comment text-end">${commentHTML}</td>
        </tr>`;
    }
    updateResultTable(tr, isFromCache, selection);
}


let resultsBuffer, detectionsModal;
const detectionsModalDiv = document.getElementById('detectionsModal')

detectionsModalDiv.addEventListener('hidden.bs.modal', () => {
    //resetRegions();
    worker.postMessage({action: 'selection-off'});
    worker.postMessage({action: 'set-variables', confidence: config.minConfidence})
    worker.postMessage({
        action: 'filter',
        species: isSpeciesViewFiltered(true),
        files: fileList,
        active: getActiveRow(),
        explore: isExplore(),
        order: STATE.explore.order
    });
    analyseList = undefined;
});

const detectionsDismiss = document.getElementById('detections-dismiss');
detectionsDismiss.addEventListener('click', event => {
    const rows = detectionsModalDiv.querySelectorAll('tr');
    let count = 0;
    rows.forEach(row => {
        count++;
        if (!row.classList.contains('text-bg-dark')) {
            deleteRecord(row, rows.length - count);
        }
    });
    STATE.selection = {start: undefined, end: undefined};
    selectionTable.innerText = '';
});

const detectionsAdd = document.getElementById('detections-add');
detectionsAdd.addEventListener('click', event => {
    STATE.selection = {start: undefined, end: undefined};
    selectionTable.innerText = '';
});

const updateResultTable = (row, isFromCache, isSelection) => {
    const table = isSelection ? selectionTable : resultTable;
    if (isFromCache && !isSelection) {
        if (!resultsBuffer) resultsBuffer = table.cloneNode();
        resultsBuffer.lastElementChild ?
            resultsBuffer.lastElementChild.insertAdjacentHTML('afterend', row) :
            resultsBuffer.innerHTML = row;
        table.replaceWith(resultsBuffer);
    } else {
        if (isSelection) {
            if (!detectionsModal || !detectionsModal._isShown) {
                detectionsModal = new bootstrap.Modal('#detectionsModal', {backdrop: 'static'});
                detectionsModal.show();
            }
        }
        table.lastElementChild ? table.lastElementChild.insertAdjacentHTML('afterend', row) :
            table.innerHTML = row;
    }
};

let restoreComment; // saves the current comment node
// Comment handling

$(document).on('click', '.add-comment, .edit-comment', function (e) {
    restoreComment = e.target.closest('td').cloneNode(true);
    const note = e.target.title === "Add a comment" ? '' : e.target.title;
    $(document).off('mouseleave mouseenter', '.comment');
    document.removeEventListener('keydown', handleKeyDownDeBounce, true);
    const parent = this.parentNode;
    parent.innerHTML = `<textarea class="h-100 rounded-3 comment-textarea" placeholder="Enter notes...">${note}</textarea>`;
    $('.comment-textarea').on('keydown blur', commentHandler);
    parent.firstChild.focus();
});

//$(document).on('click', ".circle", getSelectionResults)

const isExplore = () => {
    return STATE.mode === 'explore';
    //return !document.getElementById('exploreWrapper').classList.contains('d-none');
};

function commentHandler(e) {
    if (e?.code === 'Enter') {
        e.stopImmediatePropagation();
        const context = getDetectionContext(e.target)
        const note = e.target.value;
        let species;
        if (isExplore()) {
            // Format species before we replace the target node
            species = getSpecies(e.target)
        } else {
            species = isSpeciesViewFiltered(true);
        }
        if (note) {
            e.target.parentNode.innerHTML = `${note} <span title="Edit comment" class="material-icons-two-tone pointer edit-comment">comment</span>`;
        } else {
            e.target.parentNode.innerHTML = `<span title="Add a comment" class="material-icons-two-tone pointer add-comment">add_comment</span>`;
        }
        let [file, start, ,] = unpackNameAttr(activeRow);
        // let active = getActiveRow();
        updateRecord('comment', undefined, start, species, note, context)
        addEvents('comment');
        document.addEventListener('keydown', handleKeyDownDeBounce, true);
    } else if (e.type === 'blur') {
        e.target.closest('td').replaceWith(restoreComment);
        addEvents('comment');
    }
}

const updateRecord = (what, range, start, from, to, context, batchUpdate) => {
    //if (context === 'selectionResults') selectionTable.innerHTML = '';
    worker.postMessage({
        action: 'update-record',
        openFiles: fileList,
        currentFile: currentFile,
        start: start,
        from: from,
        value: to,
        what: what,
        isFiltered: isSpeciesViewFiltered(),
        isExplore: isExplore(),
        isBatch: batchUpdate,
        context: context,
        active: getActiveRow(),
        oder: STATE.explore.order,
        range: range
    })
};

$(document).on('click', '.add-label, .edit-label', labelHandler);

function labelHandler(e) {
    const cell = e.target.closest('td');
    activeRow = cell.closest('tr');
    cell.innerHTML = `<span class="badge bg-dark rounded-pill pointer">Nocmig</span> 
                                <span class="badge bg-success rounded-pill pointer">Local</span>
                                <span class="badge bg-secondary rounded-pill pointer">Remove Label</span>`;
    cell.addEventListener('click', updateLabel);
}

const tags = {
    Local: '<span class="badge bg-success rounded-pill edit-label pointer">Local</span>',
    Nocmig: '<span class="badge bg-dark rounded-pill edit-label pointer">Nocmig</span>',
    // If remove label is clicked, we want to replace with *add* label
    'Remove Label': '<span class="badge rounded-pill bg-secondary add-label pointer invisible">Add Label</span>'
}

// Results event handlers

function setClickedIndex(target) {
    const clickedNode = target.closest('tr');
    clickedIndex = clickedNode.querySelector('th') ? clickedNode.querySelector('th').innerText : null;
}


$(document).on('dblclick', '.delete', function (e) {
    e.stopImmediatePropagation();
    deleteRecord(e.target);
});

const deleteRecord = (target, isBatch) => {
    //resetRegions();
    setClickedIndex(target);
    const [file, start, ,] = unpackNameAttr(target);
    const setting = target.closest('table');
    let context = isExplore() ? 'explore' : 'results';
    let range, species;
    if (setting.id === 'summary') {
        range = STATE.explore.range
        species = isSpeciesViewFiltered(true)
    } else {
        if (setting.id === 'selection') {
            range = getSelectionRange();
            context = 'selection';
        }
        species = getSpecies(target);
    }

    let active = getActiveRow();
    worker.postMessage({
        action: 'delete',
        file: file,
        start: start,
        active: active,
        species: species,
        files: analyseList || fileList,
        context: context,
        order: STATE.explore.order,
        explore: isExplore(),
        range: range,
        batch: isBatch
    })
}

const getSelectionRange = () => {
    return STATE.selection ?
        {start: (STATE.selection.start * 1000) + fileStart, end: (STATE.selection.end * 1000) + fileStart} :
        undefined
}

function formatSpeciesName(filename) {
    filename = filename.replace(' - ', '~').replace(/\s+/g, '_',);
    if (!filename.includes('~')) filename = filename + '~' + filename; // dummy latin
    return filename;
}


function sendFile(mode, result) {
    let start, end, filename;
    if (result) {
        start = result.start;
        end = result.end || start + 3;
        filename = result.filename;
    } else if (start === undefined) {
        if (region.start) {
            start = region.start + bufferBegin;
            end = region.end + bufferBegin;
        } else {
            start = 0;
            end = currentBuffer.duration;
        }
        filename = 'export.mp3'
    }

    let metadata;
    if (result) {
        metadata = {
            UUID: config.UUID,
            start: start,
            end: end,
            filename: result.filename,
            cname: result.cname,
            sname: result.sname,
            score: result.score,
            cname2: result.cname2,
            sname2: result.sname2,
            score2: result.score2,
            cname3: result.cname3,
            sname3: result.sname3,
            score3: result.score3,
            date: result.date,
            lat: config.latitude,
            lon: config.longitude,
            version: version
        };
    }
    if (mode === 'save') {
        worker.postMessage({
            action: 'save',
            start: start, file: currentFile, end: end, filename: filename, metadata: metadata
        })
    } else {
        if (!config.seenThanks) {
            alert('Thank you, your feedback helps improve Chirpity predictions');
            config.seenThanks = true;
            updatePrefs()
        }
        worker.postMessage({
            action: 'post',
            start: start, file: currentFile, end: end, defaultName: filename, metadata: metadata, mode: mode
        })
    }
}

// create a dict mapping score to icon
// const iconDict = {
//     guess: '<span class="confidence material-icons-two-tone text-secondary score border border-2 border-secondary rounded" title="--%">signal_cellular_alt_1_bar</span>',
//     low: '<span class="confidence material-icons-two-tone score text-danger border border-2 border-secondary rounded" title="--%">signal_cellular_alt_1_bar</span>',
//     medium: '<span class="confidence material-icons-two-tone score text-warning border border-2 border-secondary rounded" title="--%">signal_cellular_alt_2_bar</span>',
//     high: '<span class="confidence material-icons-two-tone score text-success border border-2 border-secondary rounded" title="--%">signal_cellular_alt</span>',
//     confirmed: '<span class="confidence material-icons-two-tone score text-success border border-2 border-secondary rounded" title="confirmed">done</span>',
// }

const iconDict = {
    guess: '<span class="confidence-row"><span class="confidence bar" style="flex-basis: --%; background: grey">--%</span></span>',
    low: '<span class="confidence-row"><span class="confidence bar" style="flex-basis: --%; background: rgba(255,0,0,0.5)">--%</span></span>',
    medium: '<span class="confidence-row"><span class="confidence bar" style="flex-basis: --%; background: #fd7e14">--%</span></span>',
    high: '<span class="confidence-row"><span class="confidence bar" style="flex-basis: --%; background: #198754">--%</span></span>',
    confirmed: '<span class="confidence-row"><span class="confidence bar" style="flex-basis: 100%; background: #198754"><span class="material-icons-two-tone">done</span></span></span>',
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
document.getElementById('open').addEventListener('click', showOpenDialog);
document.getElementById('saveLabels').addEventListener('click', showSaveDialog);
document.getElementById('exportMP3').addEventListener('click', () => {
    sendFile('save')
});
document.getElementById('exit').addEventListener('click', exitApplication);

// Help menu handling
document.getElementById('keyboard').addEventListener('click', async () => {
    await populateHelpModal('Help/keyboard.html', 'Keyboard shortcuts');
});
document.getElementById('settings').addEventListener('click', async () => {
    await populateHelpModal('Help/settings.html', 'Settings Help');
});
document.getElementById('usage').addEventListener('click', async () => {
    await populateHelpModal('Help/usage.html', 'Usage Guide');
});

const populateHelpModal = async (file, label) => {
    document.getElementById('helpModalLabel').innerText = label;
    const response = await fetch(file);
    document.getElementById('helpModalBody').innerHTML = await response.text();
    const help = new bootstrap.Modal(document.getElementById('helpModal'));
    help.show();
}

nocmigButton.addEventListener('click', function () {
    if (config.nocmig) {
        config.nocmig = false;
        nocmigButton.innerText = 'bedtime_off';
        nocmigButton.title = 'Nocmig mode off';
    } else {
        config.nocmig = true;
        nocmigButton.innerText = 'bedtime';
        nocmigButton.title = 'Nocmig mode on';
    }
    worker.postMessage({
        action: 'set-variables',
        nocmig: config.nocmig,
    });
    updatePrefs();
});

const fullscreen = document.getElementById('fullscreen');

fullscreen.addEventListener('click', function () {
    if (config.fullscreen) {
        config.fullscreen = false;
        fullscreen.innerText = 'fullscreen';
    } else {
        config.fullscreen = true;
        fullscreen.innerText = 'fullscreen_exit';
    }
    adjustSpecDims(true);
});


const diagnosticMenu = document.getElementById('diagnostics');
diagnosticMenu.addEventListener('click', async function () {
    let diagnosticTable = "<table class='table-hover table-striped p-2 w-100'>";
    for (let [key, value] of Object.entries(diagnostics)) {
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
    $('#diagnosticsModalBody').html(diagnosticTable);
    const testModal = new bootstrap.Modal(document.getElementById('diagnosticsModal'));
    testModal.show();
});

// Transport controls handling
document.getElementById('playToggle').addEventListener('mousedown', async () => {
    await wavesurfer.playPause();
});

document.getElementById('zoomIn').addEventListener('click', zoomSpec);
document.getElementById('zoomOut').addEventListener('click', zoomSpec);

// Listeners to set and display  batch size
const batchSizeSlider = document.getElementById('batch-size');

batchSizeSlider.addEventListener('input', (e) => {
    batchSizeValue.innerText = BATCH_SIZE_LIST[batchSizeSlider.value].toString();
})
batchSizeSlider.addEventListener('change', (e) => {
    config[config.backend].batchSize = BATCH_SIZE_LIST[e.target.value];
    diagnostics['Batch size'] = config[config.backend].batchSize;
    loadModel();
    updatePrefs();
})


// Listeners to sort results table
const speciesSort = document.getElementById('species-sort');
speciesSort.addEventListener('click', () => {
    if (isExplore()) {
        postExploreMessage('score DESC ')
    }
});

const timeSort = document.getElementById('time-sort');
timeSort.addEventListener('click', () => {
    if (isExplore()) {
        postExploreMessage('dateTime')
    }
});

const postExploreMessage = (order) => {
    STATE.explore.order = order;
    if (STATE.explore.species) {
        worker.postMessage({
            action: 'explore',
            species: STATE.explore.species,
            file: currentFile,
            order: STATE.explore.order
        })
    }
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
    if (filelist.length) openFiles({filePaths: filelist})
});


// Prevent drag for UI elements
document.body.addEventListener('dragstart', e => {
    e.preventDefault()
});

// Make modals draggable
$(".modal-header").on("mousedown", function (mousedownEvt) {
    const $draggable = $(this);
    const x = mousedownEvt.pageX - $draggable.offset().left,
        y = mousedownEvt.pageY - $draggable.offset().top;
    $("body").on("mousemove.draggable", function (mousemoveEvt) {
        $draggable.closest(".modal-content").offset({
            "left": mousemoveEvt.pageX - x,
            "top": mousemoveEvt.pageY - y
        });
    });
    $("body").one("mouseup", function () {
        $("body").off("mousemove.draggable");
    });
    $draggable.closest(".modal").one("bs.modal.hide", function () {
        $("body").off("mousemove.draggable");
    });
});

////////// Date Picker ///////////////

$(function () {
    const start = moment();
    const end = start;
    $('#chartRange, #exploreRange').each(function () {
        $(this).daterangepicker({
            autoUpdateInput: false,
            locale: {
                cancelLabel: 'Clear'
            },
            timePicker: true,
            timePicker24Hour: true,
            timePickerIncrement: 60,
            startDate: start,
            endDate: end,
            opens: "center",
            ranges: {
                'Last Night': [moment().startOf('day').add(12, 'hours').subtract(1, 'days'), moment().startOf('day').add(12, 'hours')],
                'Previous Night': [moment().startOf('day').add(12, 'hours').subtract(2, 'days'), moment().subtract(1, 'days').startOf('day').add(12, 'hours')],
                'Last 7 Nights': [moment().startOf('day').add(12, 'hours').subtract(6, 'days'), moment().startOf('day').add(12, 'hours')],
                'Last 30 Nights': [moment().startOf('day').add(12, 'hours').subtract(29, 'days'), moment()],
                'This Month': [moment().startOf('month'), moment().endOf('month')],
                'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')],
                'This Year': [moment().startOf('year'), moment().endOf('year')],
                'Last Year': [moment().subtract(1, 'year').startOf('year'), moment().subtract(1, 'year').endOf('year')]
            }
        });
        $(this).on('apply.daterangepicker', function (ev, picker) {
            $(this).children('span').html(picker.startDate.format('MMMM D, YYYY') + ' - ' + picker.endDate.format('MMMM D, YYYY'));
            $(this).val(picker.startDate.format('MM/DD/YYYY') + ' - ' + picker.endDate.format('MM/DD/YYYY'));
            const dateRange = {start: picker.startDate._d.getTime(), end: picker.endDate._d.getTime()};
            if (worker) {
                // Update the seen species list
                worker.postMessage({action: 'get-detected-species-list', range: dateRange});
                if (this.id === 'chartRange') {
                    STATE.chart.range = dateRange;
                    if (STATE.chart.species) {
                        t0 = Date.now();
                        worker.postMessage({
                            action: 'chart',
                            species: STATE.chart.species,
                            range: STATE.chart.range
                        });
                    }
                } else if (this.id === 'exploreRange') {
                    STATE.explore.range = dateRange;
                    if (STATE.explore.species) worker.postMessage({
                        action: 'explore',
                        species: STATE.explore.species,
                        range: STATE.explore.range,
                        order: STATE.explore.order
                    });
                }
            }
        });

        $(this).on('cancel.daterangepicker', function () {
            $(this).children('span').html('Apply a date filter');
            if (worker) {
                // Update the seen species list
                worker.postMessage({action: 'get-detected-species-list'});
                if (this.id === 'chartRange') {
                    if (STATE.chart.species) {
                        t0 = Date.now();
                        worker.postMessage({
                            action: 'chart',
                            species: STATE.chart.species,
                            range: {start: undefined, end: undefined}
                        });
                    }
                }
            }
        });
    })
});


document.addEventListener("DOMContentLoaded", function () {
    enableKeyDownEvent();
    addEvents('comment');
    addEvents('label');
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
    // end if innerWidth
});


// Confidence thresholds
const thresholdDisplay = document.getElementById('threshold-value');
const confidenceDisplay = document.getElementById('confidence-value');
const confidenceSliderDisplay = document.getElementById('confidenceSliderContainer');
const confidenceSlider = document.getElementById('confidenceValue');
const confidenceRange = document.getElementById('confidence');


const setConfidence = (e) => {
    hideConfidenceSlider()
    confidenceRange.value = e.target.value;
    handleThresholdChange(e);
}

thresholdDisplay.addEventListener('click', () => {
    confidenceSliderDisplay.classList.remove('d-none');
    confidenceTimerTimeout = setTimeout(hideConfidenceSlider, 750)
})

const hideConfidenceSlider = () => {
    confidenceSliderDisplay.classList.add('d-none');
}
let confidenceTimerTimeout;
confidenceSliderDisplay.addEventListener('mouseout', () => {
    confidenceTimerTimeout = setTimeout(hideConfidenceSlider, 2000)
})

confidenceSliderDisplay.addEventListener('mouseenter', () => {
    if (confidenceTimerTimeout) clearTimeout(confidenceTimerTimeout)
})

confidenceSliderDisplay.addEventListener('mouseup', setConfidence);
confidenceSliderDisplay.addEventListener('input', (e) => {
    thresholdDisplay.innerHTML = `<b>${e.target.value}%</b>`;
});


const handleThresholdChange = (e) => {
    const threshold = e.target.value;
    config.minConfidence = parseInt(e.target.value);
    thresholdDisplay.innerHTML = `<b>${threshold}%</b>`;
    confidenceDisplay.innerHTML = `<b>${threshold}%</b>`;
    confidenceSlider.value = e.target.value;
    confidenceRange.value = e.target.value
    updatePrefs();
    worker.postMessage({
        action: 'set-variables',
        confidence: config.minConfidence,
    });
    if (!PREDICTING && !resultTableElement[0].hidden) setFilter();
}
confidenceRange.addEventListener('input', handleThresholdChange);
// SNR
const SNRThreshold = document.getElementById('SNR-threshold');
const SNRSlider = document.getElementById('snrValue');
SNRSlider.addEventListener('input', () => {
    SNRThreshold.innerText = SNRSlider.value;
});
SNRSlider.addEventListener('change', () => {
    config.snr = parseFloat(SNRSlider.value);
    updatePrefs();
});

// number of threads
const numberOfThreads = document.getElementById('threads-value');
const ThreadSlider = document.getElementById('thread-slider');
ThreadSlider.addEventListener('input', () => {
    numberOfThreads.innerText = ThreadSlider.value;
});
ThreadSlider.addEventListener('change', () => {
    config[config.backend].threads = parseInt(ThreadSlider.value);
    loadModel();
    updatePrefs();
});