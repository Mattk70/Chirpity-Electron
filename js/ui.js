/**
 * @file User Interface code.
 * Contains functions for rendering the spectrogram, updating settings, rendering the screen
 */

import { trackVisit as _trackVisit, trackEvent as _trackEvent} from "./tracking.js";
import {checkMembership} from './member.js';
import { DOM } from "./DOMcache.js";
import { IUCNCache, IUCNtaxonomy } from "./IUCNcache.js";
import WaveSurfer from "../node_modules/wavesurfer.js/dist/wavesurfer.esm.js";
import RegionsPlugin from "../node_modules/wavesurfer.js/dist/plugins/regions.esm.js";
import Spectrogram from "../node_modules/wavesurfer.js/dist/plugins/spectrogram.esm.js";
import TimelinePlugin from "../node_modules/wavesurfer.js/dist/plugins/timeline.esm.js";
import { CustomSelect } from './custom-select.js';
import {
  fetchIssuesByLabel,
  renderIssuesInModal,
  parseSemVer,
  isNewVersion,
} from "./getKnownIssues.js";
import {
  i18nAll,
  i18nSpeciesList,
  i18nHeadings,
  localiseUI,
  i18nContext,
  i18nLocation,
  i18nForm,
  i18nHelp,
  i18nToasts,
  i18nTitles,
  i18nLIST_MAP,
  i18nLists,
  IUCNLabel,
  i18nLocate,
  i18nSelect
} from "./i18n.js";
let LOCATIONS,
  locationID = undefined,
  loadingTimeout,
  LIST_MAP;

let REGIONS, spectrogram, timeline;
let APPLICATION_LOADED = false;
let LABELS = [],
  HISTORY = [];
// Save console.warn and console.error functions
const originalInfo = console.info;
const originalWarn = console.warn;
const originalError = console.error;

function customURLEncode(str) {
  return encodeURIComponent(str)
    .replace(/[!'()*]/g, (c) => {
      // Replacing additional characters not handled by encodeURIComponent
      return "%" + c.charCodeAt(0).toString(16).toUpperCase();
    })
    .replace(/%20/g, "+"); // Replace space with '+' instead of '%20'
}


// Override console.warn to intercept and track warnings
console.info = function () {
  // Call the original console.warn to maintain default behavior
  originalInfo.apply(console, arguments);

  // Track the warning message using your tracking function
  trackEvent(
    config.UUID,
    "Information",
    arguments[0],
    customURLEncode(arguments[1])
  );
};

// Override console.warn to intercept and track warnings
console.warn = function () {
  // Call the original console.warn to maintain default behavior
  originalWarn.apply(console, arguments);

  // Track the warning message using your tracking function
  trackEvent(
    config.UUID,
    "Warnings",
    arguments[0],
    customURLEncode(arguments[1])
  );
};

// Override console.error to intercept and track errors
console.error = function () {
  // Call the original console.error to maintain default behavior
  originalError.apply(console, arguments);

  // Track the error message using your tracking function
  trackEvent(
    config.UUID,
    "Errors",
    arguments[0],
    customURLEncode(arguments[1])
  );
};

window.addEventListener("unhandledrejection", function (event) {
  // Extract the error message and stack trace from the event
  const errorMessage = event.reason.message;
  const stackTrace = event.reason.stack;

  // Track the unhandled promise rejection
  trackEvent(
    config.UUID,
    "Unhandled UI Promise Rejection",
    errorMessage,
    customURLEncode(stackTrace)
  );
});

window.addEventListener("rejectionhandled", function (event) {
  // Extract the error message and stack trace from the event
  const errorMessage = event.reason.message;
  const stackTrace = event.reason.stack;

  // Track the unhandled promise rejection
  trackEvent(
    config.UUID,
    "Handled UI Promise Rejection",
    errorMessage,
    customURLEncode(stackTrace)
  );
});

let STATE = {
  metadata: {},
  lastGestureTime: 0,
  mode: "analyse",
  analysisDone: false,
  openFiles: [],
  chart: {
    aggregation: "Week",
    species: undefined,
    range: { start: undefined, end: undefined },
  },
  explore: {
    species: undefined,
    range: { start: undefined, end: undefined },
  },
  resultsSortOrder: "timestamp",
  summarySortOrder: "cname ASC",
  resultsMetaSortOrder: '',
  dataFormatOptions: {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  },
  birdList: { lastSelectedSpecies: undefined }, // Used to put the last selected species at the top of the all-species list
  selection: { start: undefined, end: undefined },
  currentAnalysis: {
    currentFile: null,
    openFiles: [],
    mode: null,
    species: null,
    offset: 0,
    active: null,
  },
  IUCNcache: IUCNCache,
  translations: ["da", "de", "es", "fr", "ja", "nl", "pt", "ru", "sv", "zh"],
  regionColour: "rgba(255, 255, 255, 0.1)",
  regionActiveColour: "rgba(255, 255, 0, 0.1)",
  regionsCompleted: true,
  labelColors: ["dark", "success", "warning", "info", "secondary", "danger", "primary"]
};

//Open Files from OS "open with"
const OS_FILE_QUEUE = [];
window.electron.onFileOpen((filePath) => {
  if (APPLICATION_LOADED) onOpenFiles({ filePaths: [filePath] });
  else OS_FILE_QUEUE.push(filePath);
});

// Batch size map for slider
const BATCH_SIZE_LIST = [4, 8, 16, 32, 48, 64, 96];

// Get the modules loaded in preload.js
const fs = window.module.fs;
const colormap = window.module.colormap;
const p = window.module.p;
const uuidv4 = window.module.uuidv4;
const os = window.module.os;

// Is this CI / playwright?
const isTestEnv = window.env.TEST_ENV === "true";
const trackVisit = isTestEnv ? () => {} : _trackVisit;
const trackEvent = isTestEnv ? () => {} : _trackEvent;
isTestEnv &&  console.log("Running in test environment");

function hexToRgb(hex) {
  // Remove the '#' character if present
  hex = hex.replace(/^#/, "");

  // Parse the hex string into individual RGB components
  var r = parseInt(hex.substring(0, 2), 16);
  var g = parseInt(hex.substring(2, 4), 16);
  var b = parseInt(hex.substring(4, 6), 16);

  // Return the RGB components as an array
  return [r, g, b];
}
function createColormap() {
  const cmap = config.colormap;
  const map =
    cmap === "custom"
      ? [
          { index: 0, rgb: hexToRgb(config.customColormap.quiet) },
          {
            index: config.customColormap.threshold,
            rgb: hexToRgb(config.customColormap.mid),
          },
          { index: 1, rgb: hexToRgb(config.customColormap.loud) },
        ]
      : cmap;
    
  return ['roseus', 'gray', 'igray'].includes(cmap)
    ? cmap
    : colormap({ colormap: map, nshades: 256, format: "float" });
}
function interpolate(template, variables) {
  return template.replace(/\$\{(.*?)\}/g, (match, key) => {
    const value = variables[key.trim()];
    if (value == null) return match;
    else return value;
  });
}

let worker;

/// Set up communication channel between UI and worker window
const establishMessageChannel = new Promise((resolve) => {
  window.onmessage = (event) => {
    // event.source === window means the message is coming from the preload
    // script, as opposed to from an <iframe> or other source.
    if (event.source === window) {
      if (event.data === "provide-worker-channel") {
        [worker] = event.ports;
        worker.postMessage({ action: "create message port" });
        // Once we have the port, we can communicate directly with the worker
        // process.
        worker.onmessage = (e) => {
          resolve(e.data);
        };
      }
    }
  };
}).then(
  (value) => {
    console.log(value);
  },
  (error) => {
    console.log(error);
  }
);

async function getPaths() {
  const appPath = await window.electron.getPath();
  const tempPath = await window.electron.getTemp();
  const locale = await window.electron.getLocale();
  //console.log('path is', appPath, 'temp is', tempPath, 'raw locale is', locale);
  return [appPath, tempPath, locale];
}

let VERSION;
let DIAGNOSTICS = {};

let appVersionLoaded = new Promise((resolve, reject) => {
  window.electron
    .getVersion()
    .then((appVersion) => {
      VERSION = appVersion;
      console.log("App version:", appVersion);
      DIAGNOSTICS["Chirpity Version"] = VERSION;
      resolve();
    })
    .catch((error) => {
      console.log("Error getting app version:", error);
      reject(error);
    });
});

let modelReady = false,
  fileLoaded = false;
let PREDICTING = false,
  t0, app_t0 = Date.now();
let activeRegion,
  AUDACITY_LABELS = {},
  wavesurfer;
let bufferStartTime, fileEnd;

// set up some DOM element handles
const bodyElement = document.body;

let activeRow;
let predictions = {},
  clickedIndex,
  currentFileDuration;

let currentBuffer,
  windowOffsetSecs = 0,
  windowLength = 20; // seconds
// Set content container height
DOM.contentWrapper.style.height = bodyElement.clientHeight - 80 + "px";

const specMaxHeight = () => {
  // Get the available viewport height
  const formOffset = DOM.exploreWrapper.offsetHeight
  const navPadding = DOM.navPadding.clientHeight;
  const footerHeight = DOM.footer.clientHeight;
  const controlsHeight = DOM.controlsWrapper.clientHeight;
  return window.innerHeight - navPadding - footerHeight - controlsHeight - formOffset;
};

// Mouse down event to start dragging
DOM.controlsWrapper.addEventListener("mousedown", (e) => {
  if (e.target.tagName !== "DIV") return;
  const startY = e.clientY;
  const initialHeight = DOM.spectrogram.offsetHeight;
  let newHeight;
  let debounceTimer;

  const onMouseMove = (e) => {
    clearTimeout(debounceTimer);
    // Calculate the delta y (drag distance)
    newHeight = initialHeight + e.clientY - startY;
    // Clamp newHeight to ensure it doesn't exceed the available height
    newHeight = Math.min(newHeight, specMaxHeight());
    // Adjust the spectrogram dimensions accordingly
    debounceTimer = setTimeout(() => {
      adjustSpecDims(true, spectrogram.fftSamples, newHeight);
    }, 10);
  };

  // Remove event listener on mouseup
  const onMouseUp = () => {
    document.removeEventListener("mousemove", onMouseMove);
    trackEvent(config.UUID, "Drag", "Spec Resize", newHeight);
  };
  // Attach event listeners for mousemove and mouseup
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp, {once: true});
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
DIAGNOSTICS["CPU"] = os.cpus()[0].model;
DIAGNOSTICS["Cores"] = os.cpus().length;
DIAGNOSTICS["System Memory"] =
  (os.totalmem() / (1024 ** 2 * 1000)).toFixed(0) + " GB";

function resetResults({
  clearSummary = true,
  clearPagination = true,
  clearResults = true,
} = {}) {
  if (clearSummary) DOM.summaryTable.textContent = "";
  if (clearPagination)
    pagination.forEach((item) => item.classList.add("d-none"));
  resultsBuffer = DOM.resultTable.cloneNode(false);
  if (clearResults) {
    DOM.resultTable.textContent = "";
    DOM.resultHeader.textContent = "";
  }
  predictions = {};
  DOM.progressDiv.classList.add("invisible");
  updateProgress(0);
}

/***
 *
 * @param val: float between 0 and 100
 */
function updateProgress(val) {
  if (val) {
    DOM.progressBar.value = val;
    val = val.toString();
    DOM.progressBar.textContent = val + "%";
  } else {
    DOM.progressBar.removeAttribute("value");
  }
}

/**
 * loadAudioFileSync: Called when user opens a file (just opens first file in multiple files)
 * and when clicking on filename in list of open files.
 *
 * @param {*} filePath: full path to file
 * @param {*} preserveResults: whether to clear results when opening file (i.e. don't clear results when clicking file in list of open files)
 *
 */
function loadAudioFileSync({ filePath = "", preserveResults = false }) {
  fileLoaded = false;
  locationID = undefined;
  worker.postMessage({
    action: "file-load-request",
    file: filePath,
    preserveResults: preserveResults,
    position: 0,
    list: config.list, // list and warmup are passed to enable abort if file loaderd during predictions
    warmup: config.warmup,
  });
}


// https://developer.chrome.com/blog/play-request-was-interrupted
let playPromise;

/**
 * Updates the spectrogram visualization and timeline asynchronously.
 *
 * This function ensures that the spectrogram element is visible by removing the "d-none" class and updates the display based on the provided audio buffer and options. It resets the spectrogram dimensions if a reset is requested or if the wavesurfer instance is uninitialized; otherwise, it loads the new audio buffer. After updating the spectrogram, the timeline is refreshed, the playback position is set using a normalized value, and playback is initiated if specified.
 *
 * @async
 * @param {Object} options - Configuration options for updating the spectrogram.
 * @param {AudioBuffer|*} options.buffer - The audio buffer to be visualized.
 * @param {boolean} [options.play=false] - If true, starts playback immediately after the update.
 * @param {number} [options.position=0] - Normalized playback position (between 0 and 1) to seek to.
 * @param {boolean} [options.resetSpec=false] - If true, resets the spectrogram dimensions before loading the buffer.
 * @returns {Promise<void>} A promise that resolves once the spectrogram and timeline update process is complete.
 */
async function updateSpec({
  buffer,
  play = false,
  position = 0,
  resetSpec = false,
}) {
  DOM.spectrogramWrapper.classList.remove("d-none");
  if (resetSpec || !wavesurfer) await adjustSpecDims(true);
  else {
    await loadBuffer(buffer);
  }
  refreshTimeline();
  wavesurfer.seekTo(position);
  if (play) {
    try {wavesurfer.play() }
    catch (e) { console.warn("Wavesurfer error: ", e.message || JSON.stringify(e)) }
  }
}

/**
 * Creates and registers a timeline plugin for WaveSurfer.js.
 *
 * This function computes the timeline display intervals based on the global variable `windowLength`.
 * It determines the primary label interval as the ceiling of (`windowLength` divided by 5) and calculates
 * the time interval as one-tenth of this primary interval. Using these values, it configures a timeline
 * plugin via the `TimelinePlugin.create` method with customized options, including:
 * - Label formatting through the global `formatTimeCallback`
 * - Secondary label opacity set to 0.35
 * - Styling options such as font size ("0.75rem") and color obtained from `wsTextColour()`
 *
 * If a global WaveSurfer instance exists (referenced by `wavesurfer`), the timeline is automatically
 * registered with it; otherwise, the standalone timeline plugin object is returned.
 *
 * @returns {Object} The timeline plugin instance, either as a registered plugin with WaveSurfer or as a standalone object.
 */
function createTimeline() {
  const primaryLabelInterval = Math.ceil(windowLength / 5);
  const secondaryLabelInterval = 0;
  const timeinterval = primaryLabelInterval / 10;
  const colour = wsTextColour();
  const timeline = TimelinePlugin.create({
    insertPosition: "beforebegin",
    formatTimeCallback: formatTimeCallback,
    timeInterval: timeinterval,
    primaryLabelInterval: primaryLabelInterval,
    secondaryLabelInterval: secondaryLabelInterval,
    secondaryLabelOpacity: 0.35,
    style: {
      fontSize: "0.75rem",
      color: colour,
    },
  });
  return wavesurfer ? wavesurfer.registerPlugin(timeline) : timeline;
}

const resetRegions = (clearActive) => {
  if (wavesurfer) REGIONS.clearRegions();
  clearActive && (activeRegion = null);
  STATE.selection = false;
  worker.postMessage({ action: "update-state", selection: false });
  disableMenuItem(["analyseSelection", "export-audio"]);
  if (fileLoaded) enableMenuItem(["analyse"]);
};

/**
 * Resets the active audio region and clears the corresponding UI selection.
 *
 * This function forcefully resets all defined audio regions by calling
 * `resetRegions(true)`. It then checks if an active table row exists and,
 * if so, removes the "table-active" class from it to remove any UI highlighting.
 * Finally, it clears the `activeRow` reference to ensure that no table row remains marked as active.
 *
 * @returns {void}
 */
function clearActive() {
  resetRegions(true);
  activeRow?.classList.remove("table-active");
  activeRow = undefined;
}

const WSPluginPurge = () => {
  // Destroy leaves the plugins in the plugin list.
  // So, this is needed to remove plugins where the `wavesurfer` key is null
  wavesurfer &&
    (wavesurfer.plugins = wavesurfer.plugins.filter(
      (plugin) => plugin.wavesurfer !== null
    ));
};

function makeBlob(audio) {
  // Recreate TypedArray
  const int16Array = new Int16Array(audio.buffer);
  // Convert to Float32Array (Web Audio API uses Float32 samples)
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / 32768; // Normalize from Int16 to Float32
  }
  // Create AudioBuffer using AudioContext
  const audioBuffer = audioContext.createBuffer(
    1,
    float32Array.length,
    sampleRate
  ); // Mono channel
  // Populate the AudioBuffer with float32Array data
  audioBuffer.copyToChannel(float32Array, 0);
  const blob = new Blob([audio], { type: "audio/wav" });
  const peaks = [audioBuffer.getChannelData(0)];
  const duration = audioBuffer.duration;
  return [blob, peaks, duration];
}
const audioContext = new AudioContext();
async function loadBuffer(audio = currentBuffer) {
  t0 = Date.now();
  const [blob, peaks, duration] = STATE.blob || makeBlob(audio);
  await wavesurfer.loadBlob(blob, peaks, duration);
  STATE.blob = null;
}
const nullRender = (peaks, ctx) => {};
const wsTextColour = () =>
  config.colormap === "custom" ? config.customColormap.loud 
  : config.colormap === "gray" ? "#000" : "#fff";

const initWavesurfer = ({ audio = undefined, height = 0 }) => {
  wavesurfer && wavesurfer.destroy();
  const loggedErrors = new Set();
  initRegion();
  spectrogram = initSpectrogram(height);
  timeline = createTimeline();
  // Setup waveform and spec views
  wavesurfer = WaveSurfer.create({
    container: document.querySelector("#waveform"),
    // make waveform transparent
    backgroundColor: "rgba(0,0,0,0)",
    waveColor: "rgba(0,0,0,0)",
    progressColor: "rgba(0,0,0,0)",
    // but keep the playhead
    cursorColor: wsTextColour(),
    cursorWidth: 2,
    height: "auto",
    renderFunction: nullRender, // no need to render a waveform
    plugins: [REGIONS, spectrogram, timeline],
  });

  if (audio) {
    loadBuffer(audio);
  }
  DOM.colourmap.value = config.colormap;
  // Set click event that removes all REGIONS

  REGIONS.enableDragSelection({
    color: STATE.regionActiveColour,
  });

  wavesurfer.on("dblclick", centreSpec);
  wavesurfer.on("click", () => REGIONS.clearRegions());

  wavesurfer.on("finish", function () {
    const bufferEnd = windowOffsetSecs + windowLength;
    activeRegion = null;
    if (currentFileDuration > bufferEnd) {
      postBufferUpdate({ begin: windowOffsetSecs + windowLength, play: true });
    }
  });

  // Show controls
  showElement(["controlsWrapper"]);
  // Resize canvas of spec and labels
  adjustSpecDims(true);
  // remove the tooltip
  DOM.tooltip?.remove();

  const tooltip = document.createElement("div");
  tooltip.id = "tooltip";
  document.body.appendChild(tooltip);
  // Add event listener for the gesture events
  const wave = DOM.waveElement;
  wave.removeEventListener("wheel", handleGesture);
  wave.addEventListener("wheel", handleGesture, { passive: true });

  wave.removeEventListener("mousemove", specTooltip);
  wave.removeEventListener("mouseout", hideTooltip);


  wave.addEventListener("mousemove", specTooltip, { passive: true });
  wave.addEventListener("mouseout", hideTooltip);
};

/**
 * Increases the FFT sample count for the spectrogram if it is below 2048.
 *
 * This function checks if the current FFT sample count (spectrogram.fftSamples) is less than 2048.
 * If so, it doubles the sample count, updates the global FFT configuration (config.FFT), and refreshes
 * the audio buffer by invoking postBufferUpdate with the current window offset, normalized playback position,
 * and playback state from wavesurfer. The playback position is calculated by dividing wavesurfer.getCurrentTime()
 * by windowLength, then clamped between 0 and 1. Finally, the updated FFT sample count is logged to the console.
 *
 * Side Effects:
 * - Modifies spectrogram.fftSamples and config.FFT.
 * - Calls postBufferUpdate to refresh the audio buffer.
 * - Logs the new FFT sample count using console.log.
 *
 * External Dependencies:
 * - spectrogram: Object containing FFT settings.
 * - config: Global configuration object for FFT.
 * - wavesurfer: Instance controlling audio playback and current time.
 * - windowLength: Global variable used to normalize the playback position.
 * - windowOffsetSecs: Global variable indicating the current window offset in seconds.
 * - clamp: Utility function to restrict a value between a minimum and maximum.
 * - postBufferUpdate: Function to update the audio buffer after FFT changes.
 */
function increaseFFT() {
  if (spectrogram.fftSamples < 2048) {
    spectrogram.fftSamples *= 2;
    const position = clamp(wavesurfer.getCurrentTime() / windowLength, 0, 1);
    postBufferUpdate({
      begin: windowOffsetSecs,
      position: position,
      play: wavesurfer.isPlaying(),
    });
    console.log(spectrogram.fftSamples);
    config.FFT = spectrogram.fftSamples
  }
}

/**
 * Halve the FFT sample count for the spectrogram when it exceeds the minimum threshold.
 *
 * This function checks if `spectrogram.fftSamples` is greater than 64. If so, the FFT sample
 * count is halved, and the normalized playback position is computed using the ratio of the current
 * playback time (from `wavesurfer.getCurrentTime()`) to the `windowLength`, clamped between 0 and 1.
 * It then calls `postBufferUpdate` with an object containing:
 *   - `begin`: the current window offset in seconds (`windowOffsetSecs`),
 *   - `position`: the normalized (and clamped) playback position,
 *   - `play`: a boolean indicating whether audio is currently playing (`wavesurfer.isPlaying()`).
 *
 * The updated FFT sample count is logged to the console, and the global configuration (`config.FFT`)
 * is updated accordingly.
 *
 * Assumes that the following globals and helper functions are available in the scope:
 *   - `spectrogram`
 *   - `wavesurfer`
 *   - `windowLength`
 *   - `windowOffsetSecs`
 *   - `config`
 *   - `clamp`
 *   - `postBufferUpdate`
 *
 * @returns {void}
 */
function reduceFFT() {
  if (spectrogram.fftSamples > 64) {
    spectrogram.fftSamples /= 2;
    const position = clamp(wavesurfer.getCurrentTime() / windowLength, 0, 1);
    postBufferUpdate({
      begin: windowOffsetSecs,
      position: position,
      play: wavesurfer.isPlaying(),
    });
    console.log(spectrogram.fftSamples);
    config.FFT = spectrogram.fftSamples
  }
}

const refreshTimeline = () => {
  timeline.destroy();
  timeline = createTimeline();
};

/**
 * Adjusts the spectrogram zoom level and repositions the playhead relative to the audio timeline.
 *
 * Halves the display window during a "zoomIn" operation—without reducing the window below 1.5 seconds—
 * and doubles it during a "zoomOut" operation, capped at 100 seconds or the total duration of the file.
 * The window offset is recalculated to keep the playhead at the same absolute position within the audio,
 * and any active audio regions are updated to remain consistent with the new window.
 *
 * No operation is performed if no audio file is loaded or if the audio regions have not been fully initialized.
 *
 * @param {(string|Event)} direction - A zoom command either as a string ("zoomIn" or "zoomOut") for direct calls,
 * or as an Event from which the command is extracted using the event target's closest button ID.
 * @returns {void}
 *
 * @example
 * // Programmatically zoom in:
 * zoomSpec("zoomIn");
 *
 * @example
 * // Zoom out via a button click:
 * buttonElement.addEventListener("click", zoomSpec);
 */
function zoomSpec(direction) {
  if (fileLoaded && STATE.regionsCompleted) {

    if (typeof direction !== "string") {
      // then it's an event
      direction = direction.target.closest("button").id;
    }
    let playedSeconds = wavesurfer.getCurrentTime();
    let position = playedSeconds / windowLength;
    let timeNow = windowOffsetSecs + playedSeconds;
    const oldBufferBegin = windowOffsetSecs;
    if (direction === "zoomIn") {
      if (windowLength < 1.5) return;
      windowLength /= 2;
      windowOffsetSecs += windowLength * position;
    } else {
      if (windowLength > 100 || windowLength === currentFileDuration) return;
      windowOffsetSecs -= windowLength * position;
      windowLength = Math.min(currentFileDuration, windowLength * 2);

      if (windowOffsetSecs < 0) {
        windowOffsetSecs = 0;
      } else if (windowOffsetSecs + windowLength > currentFileDuration) {
        windowOffsetSecs = currentFileDuration - windowLength;
      }
    }
    // Keep playhead at same time in file
    position = (timeNow - windowOffsetSecs) / windowLength;
    // adjust region start time to new window start time
    if (activeRegion) {
      const duration = activeRegion.end - activeRegion.start;
      activeRegion.start =
        oldBufferBegin + activeRegion.start - windowOffsetSecs;
      activeRegion.end = activeRegion.start + duration;
    }
    postBufferUpdate({
      begin: windowOffsetSecs,
      position: position,
      play: wavesurfer.isPlaying(),
    });
  }
}

async function showOpenDialog(fileOrFolder) {
  const defaultPath = localStorage.getItem("lastFolder") || '';
  const files = await window.electron.openDialog("showOpenDialog", {
    type: "audio",
    fileOrFolder: fileOrFolder,
    multi: "multiSelections",
    defaultPath,
  });
  if (!files.canceled) {
    if (fileOrFolder === "openFiles") {
      await onOpenFiles({ filePaths: files.filePaths });
    } else {
      filterValidFiles({ filePaths: files.filePaths });
    }
    localStorage.setItem("lastFolder", p.dirname(files.filePaths[0]));
  }
}

function powerSave(on) {
  return window.electron.powerSaveBlocker(on);
}

const openFileInList = async (e) => {
  const target = e.target;
  if (!PREDICTING && (target.type === "submit" || target.tagName === "A")) {
    loadAudioFileSync({
      filePath: target.id || STATE.currentFile,
      preserveResults: true,
    });
  }
};

const buildFileMenu = (e) => {
  //e.preventDefault();
  e.stopImmediatePropagation();
  const menu = DOM.contextMenu;
  const i18n = getI18n(i18nContext);
  menu.innerHTML = `
    <a class="dropdown-item" id="setCustomLocation"><span
    class="material-symbols-outlined align-bottom pointer">edit_location_alt</span> ${i18n.location}</a>
    <a class="dropdown-item" id="setFileStart"><span
    class="material-symbols-outlined align-bottom pointer">edit_calendar</span> ${i18n.time}
    `;
  positionMenu(menu, e);
};

function getDatetimeLocalFromEpoch(date) {
  // Assuming you have a Date object, for example:
  const myDate = new Date(date);
  let datePart = myDate.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  datePart = datePart.split("/").reverse().join("-");
  const timePart = myDate
    .toLocaleTimeString([], {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(/\s.M$/, "");
  // Combine date and time parts in the format expected by datetime-local input
  const isoDate = datePart + "T" + timePart;
  return isoDate;
}

/**
 * Renders a date and time picker form for updating the start time of the current audio file.
 *
 * The form is dynamically created and appended to the filename panel, featuring:
 * - A label and a datetime-local input, with the input's value initialized from STATE.fileStart and its maximum value set to the current datetime.
 * - A submit button that, when activated, converts the selected datetime into a millisecond timestamp, sends an update message to the worker, logs the change, resets analysis results, and updates STATE.fileStart.
 * - A cancel button that removes the form without making any changes.
 *
 * @returns {void}
 */
function showDatePicker() {
  // Create a form element
  const i18n = getI18n(i18nForm);
  const form = document.createElement("form");
  form.classList.add(
    "mt-3",
    "mb-3",
    "p-3",
    "rounded",
    "text-bg-light",
    "position-relative"
  );
  form.style.zIndex = "1000";
  // Create a label for the datetime-local input
  const label = document.createElement("label");
  label.innerHTML = i18n.select;
  label.classList.add("form-label");
  form.appendChild(label);

  // Create the datetime-local input
  const datetimeInput = document.createElement("input");
  datetimeInput.setAttribute("type", "datetime-local");
  datetimeInput.setAttribute("id", "fileStart");
  datetimeInput.setAttribute(
    "value",
    getDatetimeLocalFromEpoch(STATE.fileStart)
  );
  datetimeInput.setAttribute("max", getDatetimeLocalFromEpoch(new Date()));
  datetimeInput.classList.add("form-control");
  form.appendChild(datetimeInput);

  // Create a submit button
  const submitButton = document.createElement("button");
  submitButton.innerHTML = i18n.submit;
  submitButton.classList.add("btn", "btn-primary", "mt-2");
  form.appendChild(submitButton);

  // Create a cancel button
  var cancelButton = document.createElement("button");
  cancelButton.innerHTML = i18n.cancel;
  cancelButton.classList.add("btn", "btn-secondary", "mt-2", "ms-2");
  form.appendChild(cancelButton);

  // Append the form to the filename element
  DOM.filename.appendChild(form);
  // Add submit event listener to the form
  form.addEventListener("submit", function (event) {
    event.preventDefault();

    // Get the datetime-local value
    const newStart = document.getElementById("fileStart").value;
    // Convert the datetime-local value to milliseconds
    const timestamp = new Date(newStart).getTime();

    // Send the data to the worker
    worker.postMessage({
      action: "update-file-start",
      file: STATE.currentFile,
      start: timestamp,
    });
    trackEvent(config.UUID, "Settings Change", "fileStart", newStart);
    resetResults();
    STATE.fileStart = timestamp;
    // Remove the form from the DOM
    form.remove();
  });
  // Add click event listener to the cancel button
  cancelButton.addEventListener("click", function () {
    // Remove the form from the DOM
    form.remove();
  });
}

const filename = DOM.filename;
// This click handler is needed because the file links have their own id, so the global listener doesn't fire.
filename.addEventListener("click", openFileInList);
filename.addEventListener("contextmenu", buildFileMenu);

function extractFileNameAndFolder(path) {
  const regex = /[\\/]?([^\\/]+)[\\/]?([^\\/]+)$/; // Regular expression to match the parent folder and file name

  const match = path.match(regex);

  if (match) {
    const parentFolder = match[1];
    const fileName = match[2];
    return { parentFolder, fileName };
  } else {
    // Return a default value or handle the case where the path doesn't match the pattern
    return { parentFolder: "", fileName: "" };
  }
}

/**
 * Formats a JSON object as a Bootstrap table
 * @param {object} jsonData - The JSON object to format
 * @returns {string} - HTML string of the formatted Bootstrap table
 */
function formatAsBootstrapTable(jsonData) {
  let parsedData = JSON.parse(jsonData);
  let tableHtml = "<div class='metadata'>";

  for (const [heading, keyValuePairs] of Object.entries(parsedData)) {
    tableHtml += `<h5 class="text-primary">${heading.toUpperCase()}</h5>`;
    tableHtml +=
      "<table class='table table-striped table-bordered'><thead class='text-bg-light'><tr><th>Key</th><th>Value</th></tr></thead><tbody>";

    for (const [key, value] of Object.entries(keyValuePairs)) {
      tableHtml += "<tr>";
      tableHtml += `<td><strong>${key}</strong></td>`;
      if (typeof value === "object") {
        tableHtml += `<td>${JSON.stringify(value, null, 2)}</td>`;
      } else {
        tableHtml += `<td>${value}</td>`;
      }
      tableHtml += "</tr>";
    }

    tableHtml += "</tbody></table>";
  }

  tableHtml += "</div>";
  return tableHtml;
}
function showMetadata() {
  const icon = document.getElementById("metadata");
  if (STATE.metadata[STATE.currentFile]) {
    icon.classList.remove("d-none");
    icon.setAttribute("data-bs-content", "New content for the popover");
    // Reinitialize the popover to reflect the updated content
    const popover = bootstrap.Popover.getInstance(icon);
    popover.setContent({
      ".popover-header": "Metadata",
      ".popover-body": formatAsBootstrapTable(
        STATE.metadata[STATE.currentFile]
      ),
    });
  } else {
    icon.classList.add("d-none");
  }
}

function renderFilenamePanel() {
  const i18n = getI18n(i18nTitles);
  if (!STATE.currentFile) return;
  const openFile = STATE.currentFile;
  const files = STATE.openFiles;
  showMetadata();
  let filenameElement = DOM.filename;
  filenameElement.innerHTML = "";
  //let label = openFile.replace(/^.*[\\\/]/, "");
  const { parentFolder, fileName } = extractFileNameAndFolder(openFile);
  const label = `${parentFolder}/${fileName}`;
  let appendStr;
  const title = ` title="${i18n.filename}" `;
  const isSaved = ["archive", "explore"].includes(STATE.mode)
    ? "text-info"
    : "text-warning";
  if (files.length > 1) {
    appendStr = `<div id="fileContainer" class="btn-group dropup pointer">
        <span ${title} class="filename ${isSaved}">${label}</span>
        </button>
        <button class="btn btn-dark dropdown-toggle dropdown-toggle-split" type="button" 
        data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">+${
          files.length - 1
        }
        <span class="visually-hidden">Toggle Dropdown</span>
        </button>
        <div class="dropdown-menu dropdown-menu-dark" aria-labelledby="dropdownMenuButton">`;
    files.forEach((item) => {
      if (item !== openFile) {
        const label = item.replace(/^.*[\\/]/, "");
        appendStr += `<a id="${item}" class="dropdown-item openFiles" href="#">
                <span class="material-symbols-outlined align-bottom">audio_file</span>${label}</a>`;
      }
    });
    appendStr += `</div></div>`;
  } else {
    appendStr = `<div id="fileContainer">
        <button class="btn btn-dark" type="button" id="dropdownMenuButton">
        <span ${title} class="filename ${isSaved}">${label}</span>
        </button></div>`;
  }

  filenameElement.innerHTML = appendStr;
  // Adapt menu
  customiseAnalysisMenu(isSaved === "text-info");
}

function customAnalysisAllMenu(saved) {
  const analyseAllMenu = document.getElementById("analyseAll");
  const modifier = isMac ? "⌘" : "Ctrl";
  if (saved) {
    analyseAllMenu.innerHTML = `<span class="material-symbols-outlined">upload_file</span> ${STATE.i18n.retrieveAll}
        <span class="shortcut float-end">${modifier}+Shift+A</span>`;
    enableMenuItem(["reanalyseAll", "explore", "charts"]);
  } else {
    analyseAllMenu.innerHTML = `<span class="material-symbols-outlined">search</span> ${STATE.i18n.analyseAll[0]}
        <span class="shortcut float-end">${modifier}+Shift+A</span>`;
    disableMenuItem(["reanalyseAll"]);
  }
}

function customiseAnalysisMenu(saved) {
  const modifier = isMac ? "⌘" : "Ctrl";
  const analyseMenu = document.getElementById("analyse");
  if (saved) {
    analyseMenu.innerHTML = `<span class="material-symbols-outlined">upload_file</span> ${STATE.i18n.retrieve}
        <span class="shortcut float-end">${modifier}+A</span>`;
    enableMenuItem(["reanalyse", "explore", "charts"]);
  } else {
    analyseMenu.innerHTML = `<span class="material-symbols-outlined">search</span> ${STATE.i18n.analyse[0]}
        <span class="shortcut float-end">${modifier}+A</span>`;
    disableMenuItem(["reanalyse"]);
  }
}

async function generateLocationList(id) {
  const i18n = i18nAll[config.locale] || i18nAll["en"];
  const defaultText = id === "savedLocations" ? i18n[0] : i18n[1];
  const el = document.getElementById(id);
  LOCATIONS = undefined;
  worker.postMessage({ action: "get-locations", file: STATE.currentFile });
  await waitFor(() => LOCATIONS);
  el.innerHTML = `<option value="">${defaultText}</option>`; // clear options
  LOCATIONS.forEach((loc) => {
    const option = document.createElement("option");
    option.value = loc.id;
    option.textContent = loc.place;
    el.appendChild(option);
  });
  return el;
}

const FILE_LOCATION_MAP = {};
const onFileLocationID = ({ file, id }) => (FILE_LOCATION_MAP[file] = id);
const locationModalDiv = document.getElementById("locationModal");
locationModalDiv.addEventListener("shown.bs.modal", () => {
  placeMap("customLocationMap");
});
//document

// showLocation: Show the currently selected location in the form inputs
const showLocation = async (fromSelect) => {
  let newLocation;
  const latEl = document.getElementById("customLat");
  const lonEl = document.getElementById("customLon");
  const customPlaceEl = document.getElementById("customPlace");
  const locationSelect = document.getElementById("savedLocations");
  // Check if current file has a location id
  const id = fromSelect
    ? parseInt(locationSelect.value)
    : FILE_LOCATION_MAP[STATE.currentFile];

  if (id) {
    newLocation = LOCATIONS.find((obj) => obj.id === id);
    //locationSelect.value = id;
    if (newLocation) {
      (latEl.value = newLocation.lat),
        (lonEl.value = newLocation.lon),
        (customPlaceEl.value = newLocation.place),
        (locationSelect.value = id);
    } else {
      (latEl.value = config.latitude),
        (lonEl.value = config.longitude),
        (customPlaceEl.value = config.location),
        (locationSelect.value = "");
    }
  } else {
    //Default location
    await generateLocationList("savedLocations");
    (latEl.value = config.latitude),
      (lonEl.value = config.longitude),
      (customPlaceEl.value = config.location);
  }
  // make sure the  map is initialised
  if (!map) placeMap("customLocationMap");
  updateMap(latEl.value, lonEl.value);
};

const displayLocationAddress = async (where) => {
  const custom = where.includes("custom");
  let latEl, lonEl, placeEl, address;
  if (custom) {
    latEl = document.getElementById("customLat");
    lonEl = document.getElementById("customLon");
    placeEl = document.getElementById("customPlace");
    address = await fetchLocationAddress(latEl.value, lonEl.value, false);
    if (address === false) return;
    placeEl.value = address || "Location not available";
  } else {
    latEl = DOM.defaultLat;
    lonEl = DOM.defaultLon;
    placeEl = DOM.place;
    address = await fetchLocationAddress(latEl.value, lonEl.value, false);
    if (address === false) return;
    const content =
      '<span class="material-symbols-outlined">fmd_good</span> ' + address;
    placeEl.innerHTML = content;
    const button = document.getElementById("apply-location");
    button.classList.add("btn-danger");
    button.textContent = "Apply";
  }
};

const cancelDefaultLocation = () => {
  const latEl = DOM.defaultLat;
  const lonEl = DOM.defaultLon;
  const placeEl = DOM.place;
  latEl.value = config.latitude;
  lonEl.value = config.longitude;
  placeEl.innerHTML =
    '<span class="material-symbols-outlined">fmd_good</span> ' +
    config.location;
  updateMap(latEl.value, lonEl.value);
  const button = document.getElementById("apply-location");
  button.classList.remove("btn-danger");
  button.innerHTML = 'Set <span class="material-symbols-outlined">done</span>';
};

const setDefaultLocation = () => {
  config.latitude = parseFloat(DOM.defaultLat.value).toFixed(4);
  config.longitude = parseFloat(parseFloat(DOM.defaultLon.value)).toFixed(4);
  config.location = DOM.place.textContent.replace("fmd_good", "");
  updateMap(parseFloat(DOM.defaultLat.value), parseFloat(DOM.defaultLon.value));
  updatePrefs("config.json", config);
  worker.postMessage({
    action: "update-state",
    lat: config.latitude,
    lon: config.longitude,
    place: config.location,
  });
  // Initially, so changes to the default location are immediately reflected in subsequent analyses
  // We will switch to location filtering when the default location is changed.
  config.list = "location";
  DOM.speciesThresholdEl.classList.remove("d-none");

  updateListIcon();
  DOM.listToUse.value = config.list;
  resetResults();
  worker.postMessage({
    action: "update-list",
    list: "location",
  });
  const button = document.getElementById("apply-location");
  button.classList.remove("btn-danger");
  button.innerHTML = 'Set <span class="material-symbols-outlined">done</span>';
};

async function setCustomLocation() {
  const savedLocationSelect = await generateLocationList("savedLocations");
  const latEl = document.getElementById("customLat");
  const lonEl = document.getElementById("customLon");
  const customPlaceEl = document.getElementById("customPlace");
  const locationAdd = document.getElementById("set-location");
  const batchWrapper = document.getElementById("location-batch-wrapper");
  STATE.openFiles.length > 1
    ? batchWrapper.classList.remove("d-none")
    : batchWrapper.classList.add("d-none");
  // Use the current file location for lat, lon, place or use defaults
  showLocation(false);
  savedLocationSelect.addEventListener("change", function () {
    showLocation(true);
  });

  const i18n = getI18n(i18nLocation);
  const addOrDelete = () => {
    if (customPlaceEl.value) {
      locationAdd.textContent = i18n[0];
      locationAdd.classList.remove("btn-danger");
      locationAdd.classList.add("button-primary");
    } else {
      locationAdd.textContent = i18n[1];
      locationAdd.classList.add("btn-danger");
      locationAdd.classList.remove("button-primary");
    }
  };
  // Highlight delete
  customPlaceEl.addEventListener("keyup", addOrDelete);
  addOrDelete();
  locationModalDiv.querySelector("h5").textContent = i18n[0];
  const legends = locationModalDiv.querySelectorAll("legend");
  for (let i = 0; i < legends.length; i++) {
    legends[i].textContent = i18n[i + 2]; // process each node
  }
  locationModalDiv.querySelector('label[for="batchLocations"]').textContent =
    i18n[4];
  document.getElementById("customLatLabel").textContent = i18n[5];
  document.getElementById("customLonLabel").textContent = i18n[6];
  const locationModal = new bootstrap.Modal(locationModalDiv);
  locationModal.show();

  // Submit action
  const locationForm = document.getElementById("locationForm");

  const addLocation = () => {
    locationID = savedLocationSelect.value;
    const batch = document.getElementById("batchLocations").checked;
    const files = batch ? STATE.openFiles : [STATE.currentFile];
    worker.postMessage({
      action: "set-custom-file-location",
      lat: latEl.value,
      lon: lonEl.value,
      place: customPlaceEl.value,
      files: files,
    });
    generateLocationList("explore-locations");

    locationModal.hide();
  };
  locationAdd.addEventListener("click", addLocation);
  const onModalDismiss = () => {
    locationForm.reset();
    locationAdd.removeEventListener("click", addLocation);
    locationModalDiv.removeEventListener("hide.bs.modal", onModalDismiss);
    if (showLocation)
      savedLocationSelect.removeEventListener("change", setCustomLocation);
  };
  locationModalDiv.addEventListener("hide.bs.modal", onModalDismiss);
}

/**
 * We post the list to the worker as it has node and that allows it easier access to the
 * required filesystem routines, returns valid audio file list
 * @param filePaths
 */
const filterValidFiles = ({ filePaths }) => {
  worker.postMessage({ action: "get-valid-files-list", files: filePaths });
};

function filterFilePaths(filePaths) {
  const filteredPaths = [];
  filePaths.forEach((filePath) => {
    const baseName = p.basename(filePath);
    const isHiddenFile = baseName.startsWith(".");
    // Only add the path if it’s not hidden and doesn’t contain '?'
    if (!isHiddenFile) {
      filteredPaths.push(filePath);
    }
  });
  return filteredPaths;
}

async function sortFilesByTime(fileNames) {
  const fileData = await Promise.all(
    fileNames.map(async (fileName) => {
      const stats = await fs.promises.stat(fileName);
      return { name: fileName, time: stats.mtime.getTime() };
    })
  );

  return fileData
    .sort((a, b) => a.time - b.time) // Sort by modification time
    .map((file) => file.name); // Return sorted file names
}
async function onOpenFiles(args) {
  const sanitisedList = filterFilePaths(args.filePaths);
  if (!sanitisedList.length) return;
  DOM.loading.querySelector("#loadingText").textContent = "Loading files...";
  DOM.loading.classList.remove("d-none");
  // Store the sanitised file list and Load First audio file
  hideAll();
  showElement(["spectrogramWrapper"], false);
  resetResults();
  resetDiagnostics();
  STATE.openFiles = sanitisedList;

  // Store the file list and Load First audio file
  worker.postMessage({
    action: "check-all-files-saved",
    files: STATE.openFiles,
  });

  // Sort file by time created (the oldest first):
  if (STATE.openFiles.length > 1) {
    if (modelReady) enableMenuItem(["analyseAll", "reanalyseAll"]);
    STATE.openFiles = await sortFilesByTime(STATE.openFiles);
  } else {
    disableMenuItem(["analyseAll", "reanalyseAll"]);
  }
  // Reset analysis status
  STATE.analysisDone = false;
  loadAudioFileSync({ filePath: STATE.openFiles[0] });
  disableMenuItem([
    "analyseSelection",
    "analyse",
    "analyseAll",
    "reanalyse",
    "reanalyseAll",
    "save2db",
  ]);
  // Clear unsaved records warning
  window.electron.unsavedRecords(false);
  document.getElementById("unsaved-icon").classList.add("d-none");
  // Reset the buffer playhead and zoom:
  windowOffsetSecs = 0;
  windowLength = 20;
}

function resetDiagnostics() {
  delete DIAGNOSTICS["Audio Duration"];
  delete DIAGNOSTICS["Analysis Rate"];
  delete DIAGNOSTICS["Analysis Duration"];
  //reset delete history too
  HISTORY = [];
}

// Worker listeners
function analyseReset() {
  clearActive();
  DOM.fileNumber.textContent = "";
  resetDiagnostics();
  AUDACITY_LABELS = {};
  DOM.progressDiv.classList.remove("invisible");
}

function isEmptyObject(obj) {
  for (const i in obj) return false;
  return true;
}

function refreshResultsView() {
  if (fileLoaded) {
    hideAll();
    showElement(["spectrogramWrapper"], false);
    if (!isEmptyObject(predictions)) {
      showElement(["resultTableContainer", "resultsHead"], false);
    }
  } else if (!STATE.openFiles.length) {
    hideAll();
  }
}

// fromDB is requested when circle clicked
const getSelectionResults = (fromDB) => {
  if (fromDB instanceof PointerEvent) fromDB = false;
  let start = activeRegion.start + windowOffsetSecs;
  // Remove small amount of region to avoid pulling in results from 'end'
  let end = activeRegion.end + windowOffsetSecs; // - 0.001;
  STATE.selection = {};
  STATE["selection"]["start"] = start.toFixed(3);
  STATE["selection"]["end"] = end.toFixed(3);

  postAnalyseMessage({
    filesInScope: [STATE.currentFile],
    start: STATE["selection"]["start"],
    end: STATE["selection"]["end"],
    offset: 0,
    fromDB: fromDB,
  });
};

function postAnalyseMessage(args) {
  if (!PREDICTING) {
    // Start a timer
    t0_analysis = Date.now();
    disableMenuItem(["analyseSelection", "explore", "charts"]);
    const selection = !!args.end;
    const filesInScope = args.filesInScope;
    args.fromDB || (PREDICTING = true);
    disableSettingsDuringAnalysis(true);
    if (!selection) {
      analyseReset();
      refreshResultsView();
      resetResults();
      // change result header to indicate deactivation
      DOM.resultHeader.classList.replace("text-bg-dark", "text-bg-secondary");
    }
    worker.postMessage({
      action: "analyse",
      start: args.start,
      end: args.end,
      filesInScope: filesInScope,
      reanalyse: args.reanalyse,
      SNR: config.filters.SNR,
      circleClicked: args.fromDB,
    });
  } else {
    generateToast({ type: "warning", message: "analysisUnderway" });
  }
}

let openStreetMapTimer,
  currentRequest = null;
async function fetchLocationAddress(lat, lon, pushLocations) {
  const isInvalidLatitude = isNaN(lat) || lat === null || lat < -90 || lat > 90;
  const isInvalidLongitude =
    isNaN(lon) || lon === null || lon < -180 || lon > 180;

  if (isInvalidLatitude || isInvalidLongitude) {
    generateToast({ type: "warning", message: "placeOutOfBounds" });
    return false;
  }

  currentRequest && clearTimeout(openStreetMapTimer); // Cancel pending request

  return new Promise((resolve, reject) => {
    currentRequest = { lat, lon }; // Store the current request details
    const storedLocation = LOCATIONS?.find(
      (obj) => obj.lat === lat && obj.lon === lon
    );
    if (storedLocation) {
      return resolve(storedLocation.place);
    }
    openStreetMapTimer = setTimeout(async () => {
      try {
        if (!LOCATIONS) {
          worker.postMessage({
            action: "get-locations",
            file: STATE.currentFile,
          });
          await waitFor(() => LOCATIONS); // Ensure this is awaited
        }
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=14`
        );

        if (!response.ok) {
          return reject(
            new Error(
              `Network error: code ${response.status} fetching location from OpenStreetMap.`
            )
          );
        }
        const data = await response.json();

        let address;
        if (data.error) {
          address = "No location found for this map point";
        } else {
          // Just take the first two elements of the address
          address = data.display_name.split(",").slice(0, 2).join(",").trim();
          pushLocations &&
            LOCATIONS.push({
              id: LOCATIONS.length + 1,
              lat: lat,
              lon: lon,
              place: address,
            });
        }

        resolve(address);
      } catch (error) {
        console.warn(
          `A location for this point (lat: ${lat}, lon: ${lon}) could not be retrieved from OpenStreetMap:`,
          error
        );
        generateToast({ type: "warning", message: "placeNotFound" });
        resolve(`${parseFloat(lat).toFixed(4)}, ${parseFloat(lon).toFixed(4)}`);
      } finally {
        currentRequest = null; // Clear the current request
      }
    }, 1000); // 1 second delay
  });
}

// Menu bar functions

function exitApplication() {
  window.close();
}

function enableMenuItem(id_list) {
  id_list.forEach((id) => {
    document.getElementById(id).classList.remove("disabled");
  });
}

function disableMenuItem(id_list) {
  id_list.forEach((id) => {
    document.getElementById(id).classList.add("disabled");
  });
}

function setHeight(el, val) {
  if (typeof val === "function") val = val();
  if (typeof val === "string") el.style.height = val;
  else el.style.height = val + "px";
}

function showElement(id_list, makeFlex = true, empty = false) {
  id_list.forEach((id) => {
    const thisElement = document.getElementById(id);
    thisElement.classList.remove("d-none");
    if (makeFlex) thisElement.classList.add("d-flex");
    if (empty) {
      setHeight(thisElement, 0);
      thisElement.replaceChildren(); // empty
    }
  });
}

function hideElement(id_list) {
  id_list.forEach((id) => {
    const thisElement = document.getElementById(id);
    // Don't use replace as d-flex may be absent
    thisElement.classList.remove("d-flex");
    thisElement.classList.add("d-none");
  });
}

function hideAll() {
  // File hint div,  Waveform, timeline and spec, controls and result table
  hideElement([
    "exploreWrapper",
    "spectrogramWrapper",
    "resultTableContainer",
    "recordsContainer",
    "resultsHead",
  ]);
}

async function batchExportAudio() {
  const species = isSpeciesViewFiltered(true);
  species
    ? exportData("audio", species, 1000)
    : generateToast({ type: "warning", message: "mustFilterSpecies" });
}

const export2CSV = () =>
  exportData("text", isSpeciesViewFiltered(true), Infinity);
const exporteBird = () =>
  exportData("eBird", isSpeciesViewFiltered(true), Infinity);
const exportRaven = () =>
  exportData("Raven", isSpeciesViewFiltered(true), Infinity);
const exportAudacity = () =>
  exportData("Audacity", isSpeciesViewFiltered(true), Infinity);

async function exportData(format, species, limit, duration) {
  const defaultPath = localStorage.getItem("lastFolder") || '';
  const response = await window.electron.selectDirectory(defaultPath);
  if (!response.canceled) {
    const directory = response.filePaths[0];
    worker.postMessage({
      action: "export-results",
      directory: directory,
      format: format,
      duration: duration,
      species: species,
      files: isExplore() ? [] : STATE.openFiles,
      explore: isExplore(),
      limit: limit,
      range: isExplore() ? STATE.explore.range : undefined,
    });
    localStorage.setItem("lastFolder", p.dirname(directory));
  }
}

const handleLocationFilterChange = (e) => {
  const location = parseInt(e.target.value) || undefined;
  worker.postMessage({ action: "update-state", locationID: location });
  // Update the seen species list
  worker.postMessage({ action: "get-detected-species-list" });
  worker.postMessage({
    action: "update-state",
    globalOffset: 0,
    filteredOffset: {},
  });
  if (STATE.mode === "explore") filterResults();
};

function saveAnalyseState() {
  if (["analyse", "archive"].includes(STATE.mode)) {
    const active = activeRow?.rowIndex - 1 || null;
    // Store a reference to the current file
    STATE.currentAnalysis = {
      currentFile: STATE.currentFile,
      openFiles: STATE.openFiles,
      mode: STATE.mode,
      species: isSpeciesViewFiltered(true),
      offset: STATE.offset,
      active: active,
      analysisDone: STATE.analysisDone,
      resultsSortOrder: STATE.resultsSortOrder,
    };
  }
}

async function showCharts() {
  saveAnalyseState();
  enableMenuItem(["active-analysis", "explore"]);
  disableMenuItem([
    "analyse",
    "analyseSelection",
    "analyseAll",
    "reanalyse",
    "reanalyseAll",
    "charts",
  ]);
  // Tell the worker we are in Chart mode
  worker.postMessage({ action: "change-mode", mode: "chart" });
  // Disable analyse file links
  worker.postMessage({
    action: "get-detected-species-list",
    range: STATE.chart.range,
  });
  const locationFilter = await generateLocationList("chart-locations");
  locationFilter.addEventListener("change", handleLocationFilterChange);
  hideAll();
  showElement(["recordsContainer"]);
  worker.postMessage({
    action: "chart",
    species: undefined,
    range: STATE.chart.range,
  });
}

async function showExplore() {
  // Change fileLoaded this one time, so a file will load!
  fileLoaded = true;
  saveAnalyseState();
  enableMenuItem([
    "saveCSV",
    "save-eBird",
    "save-Raven",
    "charts",
    "active-analysis",
  ]);
  disableMenuItem(["explore", "save2db"]);
  // Tell the worker we are in Explore mode
  worker.postMessage({ action: "change-mode", mode: "explore" });
  worker.postMessage({
    action: "get-detected-species-list",
    range: STATE.explore.range,
  });
  const locationFilter = await generateLocationList("explore-locations");
  locationFilter.addEventListener("change", handleLocationFilterChange);
  hideAll();
  showElement(["exploreWrapper", "spectrogramWrapper"], false);
  worker.postMessage({ action: "update-state", filesToAnalyse: [] });
  // Analysis is done
  STATE.analysisDone = true;
  filterResults({
    species: isSpeciesViewFiltered(true),
    range: STATE.explore.range,
  });
  resetResults();
  // Prevent scroll up hiding navbar
  adjustSpecDims()
}

async function showAnalyse() {
  disableMenuItem(["active-analysis"]);
  //Restore STATE
  STATE = { ...STATE, ...STATE.currentAnalysis };
  worker.postMessage({ action: "change-mode", mode: STATE.mode });
  hideAll();
  if (STATE.currentFile) {
    showElement(["spectrogramWrapper"], false);
    worker.postMessage({
      action: "update-state",
      filesToAnalyse: STATE.openFiles,
      resultsSortOrder: STATE.resultsSortOrder,
    });
    if (STATE.analysisDone) {
      filterResults({
        species: STATE.species,
        offset: STATE.offset,
        active: STATE.active,
        updateSummary: true,
      });
    } else {
      clearActive();
      loadAudioFileSync({ filePath: STATE.currentFile });
    }
  }
  resetResults();
}

// const datasetLink = document.getElementById('dataset');
// datasetLink.addEventListener('click', async () => {
//     worker.postMessage({ action: 'create-dataset', species: isSpeciesViewFiltered(true) });
// });

const checkWidth = (text) => {
  // Create a temporary element to measure the width of the text
  const tempElement = document.createElement("span");
  tempElement.style.position = "absolute";
  tempElement.style.visibility = "hidden";
  tempElement.textContent = text;
  document.body.appendChild(tempElement);

  // Get the width of the text
  const textWidth = tempElement.clientWidth;

  // Remove the temporary element from the document
  document.body.removeChild(tempElement);
  return textWidth + 5;
};

/**
 * Creates and registers a new audio region on the waveform, optionally navigating to its start time.
 *
 * This function validates the input parameters and adds a new region to the global REGIONS collection using the
 * specified start and end times. It applies the provided color or defaults to STATE.regionColour, and formats the label
 * using the formatLabel helper. If the goToRegion flag is true, the waveform's current time is set to the new region's start time.
 *
 * Note: If the start and end parameters are invalid (i.e., non-numeric or if start is not less than end), the function logs
 * an error and returns early without creating the region.
 *
 * @param {number} start - The start time of the region in seconds.
 * @param {number} end - The end time of the region in seconds (must be greater than start).
 * @param {string} label - The label for the region.
 * @param {boolean} goToRegion - If true, navigates the waveform to the region's start time.
 * @param {string} [colour] - Optional color for the region; defaults to STATE.regionColour if not provided.
 * @returns {void}
 */
function createRegion(start, end, label, goToRegion, colour) {
  // Validate input parameters
  if (typeof start !== 'number' || typeof end !== 'number' || start >= end) {
    console.error('Invalid region parameters:', { start, end });
    return;
  }
    // Check for overlapping regions
  // const hasOverlap = REGIONS.regions.some(region => {
  //   return (start < region.end && end > region.start);
  // });
  
  // if (hasOverlap) {
  //   console.warn('Region overlap detected');
  //   return;
  // }

  REGIONS.addRegion({
    start: start,
    end: end,
    color: colour || STATE.regionColour,
    content: formatLabel(label, colour),
  });

  if (goToRegion) wavesurfer.setTime(start);
}

// We add the handler to the whole table as the body gets replaced and the handlers on it would be wiped
const results = document.getElementById("results");
results.addEventListener("click", resultClick);
const selectionTable = document.getElementById("selectionResultTableBody");
selectionTable.addEventListener("click", resultClick);

/**
 * Processes click events on audio analysis result rows.
 *
 * Validates that audio regions are fully established and an audio file is loaded before proceeding. Extracts the file name,
 * start time, end time, and label from the clicked row's "name" attribute (expected in the format "file|start|end|unused|label"),
 * sets the row as active by updating its CSS class, and loads the corresponding audio region. If the clicked target has a "circle"
 * class, waits until the audio file is completely loaded before obtaining selection results.
 *
 * @param {Event} e - The click event triggered by the user.
 * @returns {Promise<void>} A promise that resolves once the event processing is complete.
 *
 * @example
 * // Assuming a table row element with the following "name" attribute:
 * // <tr name="audio.mp3|10|20|unused|Speech">...</tr>
 * // Attach the event handler as follows:
 * document.querySelector('tr').addEventListener('click', resultClick);
 */
async function resultClick(e) {
  if (!STATE.regionsCompleted) {
      console.warn('Cannot process click - regions are still being created');
      return;
    }
  if (!fileLoaded) {
    console.warn('Cannot process click - no audio file is loaded');
    return;
  }
  let row = e.target.closest("tr");
  if (!row || row.classList.length === 0) {
    // 1. clicked and dragged, 2 no detections in file row
    return;
  }

  const [file, start, end, _, label] = row.getAttribute("name").split("|");

  // Search for results rows - Why???
  // while (
  //   !(row.classList.contains("nighttime") || row.classList.contains("daytime"))
  // ) {
  //   row = row.previousElementSibling;
  //   if (!row) return;
  // }
  if (activeRow) activeRow.classList.remove("table-active");
  row.classList.add("table-active");
  activeRow = row;
  loadResultRegion({ file, start, end, label });
  if (e.target.classList.contains("circle")) {
    await waitFor(() => fileLoaded);
    getSelectionResults(true);
  }
}

/**
 * Marks the row corresponding to the specified start time as active in the result table.
 *
 * Iterates through all table rows within the result table and checks the "name" attribute, which is expected
 * to be a pipe-separated string containing file identifier, start time, and additional details. When a row is found
 * where the file matches the current file (STATE.currentFile) and the start time matches the provided value, any
 * previously active row (if different) is deactivated, the target row is activated by adding the 'table-active'
 * class, and the row is smoothly scrolled into view.
 *
 * @param {number} start - The start time to match for activating the corresponding table row.
 */
function setActiveRow(start) {
    const rows = DOM.resultTable.querySelectorAll('tr');
    for (const r of rows) {
        const [file, rowStart, _end, _, _label] = r.getAttribute("name").split("|");

        if ( file === STATE.currentFile && Number(rowStart) === start) {
            // Clear the active row if there's one
            if (activeRow && activeRow !== r) {
                activeRow.classList.remove('table-active');
            }
            // Add the 'table-active' class to the target row
            r.classList.add('table-active');
            activeRow = r;  // Update the active row reference
            
            activeRow.scrollIntoView({ behavior: "smooth", block: "center" });
            break;  // Exit loop once the target row is found
        }
    }
}
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

const loadResultRegion = ({
  file = "",
  start = 0,
  end = 3,
  label = "",
} = {}) => {
  start = parseFloat(start);
  end = parseFloat(end);
  // ensure region doesn't spread across the whole window
  if (windowLength <= 3.5) windowLength = 6;
  windowOffsetSecs = Math.max(0, start - windowLength / 2 + 1.5);
  activeRegion = {
    start: Math.max(start - windowOffsetSecs, 0),
    end: end - windowOffsetSecs,
    label,
  };
  postBufferUpdate({
    file: file,
    begin: windowOffsetSecs,
    goToRegion: true
  });
};

/**
 * Adjusts the dimensions of the spectrogram and related UI elements based on the current window and DOM sizes.
 *
 * This asynchronous function recalculates the layout of key UI components such as the content wrapper,
 * spectrogram display, and result table, ensuring they adapt to changes in the window size. When the
 * `redraw` flag is true and an audio file is loaded, the function computes a new spectrogram height using
 * either the specified `newHeight` (if non-zero) or the current configuration limits. If a new height is provided,
 * it updates the configuration preferences accordingly.
 *
 * Depending on whether WaveSurfer is already initialized, the function will either:
 * - Initialize a new WaveSurfer instance with the current audio buffer and updated height.
 * - Update the existing WaveSurfer instance's options (including height and cursor color), re-register the spectrogram
 *   plugin with the new settings (using `fftSamples` if provided), and reload the audio buffer.
 *
 * Finally, it adjusts the height of the result table to fill the remaining vertical space.
 *
 * @param {boolean} redraw - Indicates whether the spectrogram should be re-rendered and WaveSurfer updated.
 * @param {number} [fftSamples] - Optional. The number of FFT samples to use for rendering; must be a power of two.
 * @param {number} [newHeight=0] - Optional. Overrides the dynamic height calculation for the spectrogram; a value of 0 triggers dynamic sizing.
 * @returns {Promise<void>} A promise that resolves once the UI adjustments and spectrogram rendering updates are complete.
 */

async function adjustSpecDims(redraw, fftSamples, newHeight) {
  const footerHeight = DOM.footer.offsetHeight;
  const navHeight = DOM.navPadding.clientHeight;
  newHeight ??= 0;
  DOM.contentWrapper.style.top = (navHeight).toString() + 'px'; // for padding
  DOM.contentWrapper.style.height =
    (bodyElement.clientHeight - footerHeight - navHeight).toString() + "px";
  const contentHeight = contentWrapper.offsetHeight;
  // + 2 for padding
  const formOffset = DOM.exploreWrapper.offsetHeight;

  let specOffset;
  if (!DOM.spectrogramWrapper.classList.contains("d-none")) {
    const specHeight =
      newHeight || Math.min(config.specMaxHeight, specMaxHeight());
    if (newHeight !== 0) {
      config.specMaxHeight = specHeight;
      updatePrefs("config.json", config);
    }
    if (STATE.currentFile && redraw) {
      // give the wrapper space for the transport controls and element padding/margins
      if (!wavesurfer) {
        initWavesurfer({
          audio: currentBuffer,
          height: specHeight,
        });
      } else {
        wavesurfer.setOptions({
          height: specHeight,
          cursorColor: wsTextColour(),
        });
        spectrogram = initSpectrogram(specHeight, fftSamples);
        wavesurfer.registerPlugin(spectrogram);
        await loadBuffer();
      }
    }
    if (wavesurfer) {
      specOffset = spectrogramWrapper.offsetHeight;
    }
  } else {
    specOffset = 0;
  }
  DOM.resultTableElement.style.height =
    contentHeight - specOffset - formOffset + "px";
}

///////////////// Font functions ////////////////
// Function to set the font size scale
function setFontSizeScale(doNotScroll) {
  document.documentElement.style.setProperty(
    "--font-size-scale",
    config.fontScale
  );
  const decreaseBtn = document.getElementById("decreaseFont");
  const increaseBtn = document.getElementById("increaseFont");

  decreaseBtn.classList.toggle("disabled", config.fontScale === 0.7);
  increaseBtn.classList.toggle("disabled", config.fontScale === 1.1);
  doNotScroll ||
    decreaseBtn.scrollIntoView({ block: "center", behavior: "auto" });
  updatePrefs("config.json", config);
  adjustSpecDims(true);
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

function formatRegionTooltip(regionLength, start, end) {
  const length = end - start;
  if (length === 3) {
    return `${formatTimeCallback(start)} -  ${formatTimeCallback(end)}`;
  } else if (length < 1)
    return `${regionLength}: ${(length * 1000).toFixed(0)}ms`;
  else {
    return `${regionLength}: ${length.toFixed(3)}s`;
  }
}

function formatTimeCallback(secs) {
  secs = secs.toFixed(2);
  // Add 500 to deal with overflow errors
  let now = new Date(bufferStartTime.getTime() + secs * 1000);
  let milliseconds = now.getMilliseconds();
  if (milliseconds > 949) {
    // Deal with overflow errors
    now = new Date(now.getTime() + 50);
    milliseconds = 0;
  }
  // Extract the components
  let hours = now.getHours();
  let minutes = now.getMinutes();
  let seconds = now.getSeconds();

  let formattedTime;
  if (config.timeOfDay) {
    // Format the time as hh:mm:ss
    formattedTime = [
      hours.toString().padStart(2, "0"),
      minutes.toString().padStart(2, "0"),
      seconds.toString().padStart(2, "0"),
    ].join(":");
  } else {
    if (hours === 0 && minutes === 0) {
      // Format as ss
      formattedTime = seconds.toString();
    } else if (hours === 0) {
      // Format as mm:ss
      formattedTime = [
        minutes.toString(),
        seconds.toString().padStart(2, "0"),
      ].join(":");
    } else {
      // Format as hh:mm:ss
      formattedTime = [
        hours.toString(),
        minutes.toString().padStart(2, "0"),
        seconds.toString().padStart(2, "0"),
      ].join(":");
    }
  }
  if (windowLength <= 5) {
    formattedTime += "." + milliseconds.toString();
  } else {
    milliseconds = (milliseconds / 1000).toFixed(1);
    formattedTime += milliseconds.slice(1);
  }

  return formattedTime;
}

////////// Store preferences //////////

function updatePrefs(file, data) {
  scheduler.postTask(
    () => {
      try {
        const jsonData = JSON.stringify(data); // Convert object to JSON string
        //const hexData = utf8ToHex(jsonData); // Encode to hex
        const hexData = jsonData;
        fs.writeFileSync(p.join(appPath, file), hexData);
      } catch (error) {
        console.log(error);
      }
    },
    {
      priority: "background",
    }
  );
}

/**
 * Synchronizes a configuration object with a default configuration.
 *
 * Removes keys from the configuration that are not found in the default configuration,
 * and adds any missing keys from the default configuration. For keys with values that
 * are both objects in the configuration and the default configuration, the merge is
 * performed recursively, except when the key is "keyAssignment", which is left untouched.
 *
 * @param {Object} config - The configuration object to be synchronized (modified in place).
 * @param {Object} defaultConfig - The default configuration serving as the reference.
 */
function syncConfig(config, defaultConfig) {
  // First, remove keys from config that are not in defaultConfig
  Object.keys(config).forEach((key) => {
    if (!(key in defaultConfig)) {
      delete config[key];
    }
  });

  // Then, fill in missing keys from defaultConfig
  Object.keys(defaultConfig).forEach((key) => {
    if (!(key in config)) {
      config[key] = defaultConfig[key];
    } else if (
      typeof config[key] === "object" &&
      typeof defaultConfig[key] === "object"
    ) {
      // Recursively sync nested objects (but allow key assignment to be empty)
      key === 'keyAssignment' || syncConfig(config[key], defaultConfig[key]);
    }
  });
}

/////////////////////////  Window Handlers ////////////////////////////
// Set config defaults
const defaultConfig = {
  newInstallDate: 0,
  archive: { location: undefined, format: "ogg", auto: false, trim: false },
  fontScale: 1,
  seenTour: false,
  lastUpdateCheck: 0,
  UUID: uuidv4(),
  colormap: "inferno",
  specMaxHeight: 260,
  specLabels: true,
  specDetections: true,
  customColormap: {
    loud: "#ff7b00",
    mid: "#850035",
    quiet: "#000000",
    threshold: 0.5,
    windowFn: "hann",
  },
  timeOfDay: true,
  list: "birds",
  customListFile: { birdnet: "", chirpity: "", nocmig: "" },
  local: true,
  speciesThreshold: 0.03,
  useWeek: false,
  model: "birdnet",
  locale: "en",
  chirpity: { backend: "tensorflow" },
  nocmig: { backend: "tensorflow" },
  birdnet: { backend: "tensorflow" },
  latitude: 52.87,
  longitude: 0.89,
  location: "Great Snoring, North Norfolk",
  detect: {
    nocmig: false,
    contextAware: false,
    confidence: 45,
    iucn: true,
    iucnScope: "Global",
  },
  filters: {
    active: false,
    highPassFrequency: 0,
    lowShelfFrequency: 0,
    lowShelfAttenuation: 0,
    SNR: 0,
    normalise: false,
    sendToModel: false,
  },
  warmup: true,
  hasNode: false,
  tensorflow: { threads: DIAGNOSTICS["Cores"], batchSize: 8 },
  webgpu: { threads: 2, batchSize: 8 },
  webgl: { threads: 2, batchSize: 32 },
  audio: {
    gain: 0,
    format: "mp3",
    bitrate: 192,
    quality: 5,
    downmix: false,
    padding: false,
    fade: false,
    notification: true,
    minFrequency: 0,
    maxFrequency: 11950,
  },
  limit: 500,
  debug: false,
  VERSION: VERSION,
  powerSaveBlocker: false,
  fileStartMtime: false,
  keyAssignment: {}
};
let appPath, tempPath, systemLocale, isMac;
window.onload = async () => {
  window.electron.requestWorkerChannel();
  isMac = await window.electron.isMac();
  if (isMac) replaceCtrlWithCommand();
  DOM.contentWrapper.classList.add("loaded");

  // Load preferences and override defaults
  [appPath, tempPath, systemLocale] = await getPaths();
  // Set default locale
  systemLocale = systemLocale.replace("en-GB", "en_uk");
  systemLocale =
    systemLocale === "en_uk"
      ? systemLocale
      : systemLocale.slice(0, 2).toLowerCase();
  if (STATE.translations.includes(systemLocale)) {
    defaultConfig.locale = systemLocale;
  }
  // establish the message channel
  setUpWorkerMessaging();

  // Set footer year
  document.getElementById("year").textContent = new Date().getFullYear();
  await appVersionLoaded;
  const configFile = p.join(appPath, "config.json");
  await fs.readFile(configFile, "utf8", (err, hexData) => {
    if (err) {
      console.log("Config not loaded, using defaults");
      // Use defaults if no config file
      if (!fs.existsSync(configFile)) config = defaultConfig;
    } else {
      try {
        const jsonData = hexToUtf8(hexData);
        config = JSON.parse(jsonData);
      } catch {
        //ASCII config or corrupt config
        try {
          config = JSON.parse(hexData);
        } catch {
          alert("Config file is corrupt");
        }
      }
    }

    // Attach an error event listener to the window object
    window.onerror = function (message, file, lineno, colno, error) {
      trackEvent(
        config.UUID,
        "Error",
        error.message,
        encodeURIComponent(error.stack)
      );
      // Return false not to inhibit the default error handling
      return false;
    };
    //fill in defaults - after updates add new items
    syncConfig(config, defaultConfig);

    membershipCheck().then(isMember  => STATE.isMember = isMember);
 
    // Disable SNR
    config.filters.SNR = 0;

    // set version
    config.VERSION = VERSION;
    DIAGNOSTICS["UUID"] = config.UUID;

    // Initialize Spectrogram
    //initWavesurfer({});
    // Set UI option state
    // Fontsize
    config.fontScale === 1 || setFontSizeScale(true);
    // Ensure config.model is valid (v1.10.x management)
    if (! ['birdnet', 'chirpity', 'nocmig'].includes(config.model)){
      config.model = 'birdnet';
    }

    // Map slider value to batch size
    DOM.batchSizeSlider.value = BATCH_SIZE_LIST.indexOf(
      config[config[config.model].backend].batchSize
    );
    DOM.batchSizeSlider.max = (BATCH_SIZE_LIST.length - 1).toString();
    DOM.batchSizeValue.textContent =
      config[config[config.model].backend].batchSize;
    DOM.modelToUse.value = config.model;
    const backendEL = document.getElementById(config[config.model].backend);
    backendEL.checked = true;
    // Show time of day in results?
    setTimelinePreferences();
    // Show the list in use
    DOM.listToUse.value = config.list;
    DOM.localSwitch.checked = config.local;
    config.list === "custom" &&
      readLabels(config.customListFile[config.model], "list");
    // Show Locale
    DOM.locale.value = config.locale;
    LIST_MAP = getI18n(i18nLIST_MAP);
    // Localise UI
    localiseUI(DOM.locale.value).then((result) => (STATE.i18n = result));
    initialiseDatePicker();
    STATE.picker.options.lang = DOM.locale.value.replace("_uk", "");

    // remember audio notification setting
    DOM.audioNotification.checked = config.audio.notification;
    // Zoom H1E filestart handling:
    document.getElementById("file-timestamp").checked = config.fileStartMtime;
    // List appearance in settings
    DOM.speciesThreshold.value = config.speciesThreshold;
    document.getElementById("species-week").checked = config.useWeek;
    DOM.customListFile.value = config.customListFile[config.model];
    if (!DOM.customListFile.value) delete LIST_MAP.custom;
    // And update the icon
    updateListIcon();
    // timeline
    DOM.timelineSetting.value = config.timeOfDay ? "timeOfDay" : "timecode";
    // Spectrogram colour
    if (config.colormap === 'igreys') config.colormap = 'gray';
    DOM.colourmap.value = config.colormap;

    // Spectrogram labels
    DOM.specLabels.checked = config.specLabels;
    // Show all detections
    DOM.specDetections.checked = config.specDetections;
    // Spectrogram frequencies
    DOM.fromInput.value = config.audio.minFrequency;
    DOM.fromSlider.value = config.audio.minFrequency;
    DOM.toInput.value = config.audio.maxFrequency;
    DOM.toSlider.value = config.audio.maxFrequency;
    fillSlider(DOM.fromInput, DOM.toInput, "#C6C6C6", "#0d6efd", DOM.toSlider);
    checkFilteredFrequency();
    // Window function & colormap
    document.getElementById("window-function").value =
      config.customColormap.windowFn;
    config.customColormap.windowFn === 'gauss' && document.getElementById('alpha').classList.remove('d-none')
    config.colormap === "custom" &&
      document.getElementById("colormap-fieldset").classList.remove("d-none");
    document.getElementById("color-threshold").textContent =
      config.customColormap.threshold;
    document.getElementById("loud-color").value = config.customColormap.loud;
    document.getElementById("mid-color").value = config.customColormap.mid;
    document.getElementById("quiet-color").value = config.customColormap.quiet;
    document.getElementById("color-threshold-slider").value =
      config.customColormap.threshold;
    // Audio preferences:
    DOM.gain.value = config.audio.gain;
    DOM.gainAdjustment.textContent = config.audio.gain + "dB";
    DOM.normalise.checked = config.filters.normalise;
    DOM.audioFormat.value = config.audio.format;
    DOM.audioBitrate.value = config.audio.bitrate;
    DOM.audioQuality.value = config.audio.quality;
    showRelevantAudioQuality();
    DOM.audioFade.checked = config.audio.fade;
    DOM.audioPadding.checked = config.audio.padding;
    DOM.audioFade.disabled = !DOM.audioPadding.checked;
    DOM.audioDownmix.checked = config.audio.downmix;
    setNocmig(config.detect.nocmig);
    document.getElementById("iucn").checked = config.detect.iucn;
    document.getElementById("iucn-scope").selected = config.detect.iucnScope;
    modelSettingsDisplay();
    // Block powersave?
    document.getElementById("power-save-block").checked =
      config.powerSaveBlocker;
    powerSave(config.powerSaveBlocker);

    contextAwareIconDisplay();
    DOM.debugMode.checked = config.debug;
    showThreshold(config.detect.confidence);
    // SNRSlider.value = config.filters.SNR;
    // SNRThreshold.textContent = config.filters.SNR;
    // if (config[config.model].backend === 'webgl' || config[config.model].backend === 'webgpu') {
    //     SNRSlider.disabled = true;
    // };

    // Filters
    HPThreshold.textContent = config.filters.highPassFrequency + "Hz";
    HPSlider.value = config.filters.highPassFrequency;
    LowShelfSlider.value = config.filters.lowShelfFrequency;
    LowShelfThreshold.textContent = config.filters.lowShelfFrequency + "Hz";
    lowShelfAttenuation.value = -config.filters.lowShelfAttenuation;
    lowShelfAttenuationThreshold.textContent = lowShelfAttenuation.value + "dB";
    DOM.sendFilteredAudio.checked = config.filters.sendToModel;
    filterIconDisplay();
    if (config[config.model].backend.includes("web")) {
      // Force max three threads to prevent severe memory issues
      config[config[config.model].backend].threads = Math.min(
        config[config[config.model].backend].threads,
        3
      );
      DOM.threadSlider.max = 3;
    } else {
      DOM.threadSlider.max = DIAGNOSTICS["Cores"];
    }

    DOM.threadSlider.value = config[config[config.model].backend].threads;
    DOM.numberOfThreads.textContent = DOM.threadSlider.value;
    DOM.defaultLat.value = config.latitude;
    DOM.defaultLon.value = config.longitude;
    place.innerHTML =
      '<span class="material-symbols-outlined">fmd_good</span>' +
      config.location;
    if (config.archive.location) {
      document.getElementById("archive-location").value =
        config.archive.location;
      document.getElementById("archive-format").value = config.archive.format;
      document.getElementById("library-trim").checked = config.archive.trim;
      const autoArchive = document.getElementById("auto-archive");
      autoArchive.checked = config.archive.auto;
    }
    setListUIState(config.list);
    worker.postMessage({
      action: "update-state",
      archive: config.archive,
      path: appPath,
      temp: tempPath,
      lat: config.latitude,
      lon: config.longitude,
      place: config.location,
      detect: config.detect,
      filters: config.filters,
      audio: config.audio,
      limit: config.limit,
      locale: config.locale,
      speciesThreshold: config.speciesThreshold,
      list: config.list,
      useWeek: config.useWeek,
      local: config.local,
      UUID: config.UUID,
      debug: config.debug,
      fileStartMtime: config.fileStartMtime,
      specDetections: config.specDetections,
    });
    const { model, list } = config;
    t0_warmup = Date.now();
    worker.postMessage({
      action: "_init_",
      model: model,
      batchSize: config[config[model].backend].batchSize,
      threads: config[config[model].backend].threads,
      backend: config[model].backend,
      list: list,
    });
    // Enable popovers
    const myAllowList = bootstrap.Tooltip.Default.allowList;
    myAllowList.table = []; // Allow <table> element with no attributes
    myAllowList.thead = [];
    myAllowList.tbody = [];
    myAllowList.tr = [];
    myAllowList.td = [];
    myAllowList.th = [];
    const popoverTriggerList = document.querySelectorAll(
      '[data-bs-toggle="popover"]'
    );
    const _ = [...popoverTriggerList].map(
      (popoverTriggerEl) =>
        new bootstrap.Popover(popoverTriggerEl, { allowList: myAllowList })
    );

    // check for new version on mac platform. pkg containers are not an auto-updatable target
    // https://www.electron.build/auto-update#auto-updatable-targets
    isMac && !isTestEnv && checkForMacUpdates();

    // Add cpu model & memory to config
    config.CPU = DIAGNOSTICS["CPU"];
    config.RAM = DIAGNOSTICS["System Memory"];
    trackVisit(config);
  });
};

let MISSING_FILE;

const setUpWorkerMessaging = () => {
  establishMessageChannel.then(() => {
    worker.addEventListener("message", async function (e) {
      const args = e.data;
      const event = args.event;
      switch (event) {
        case "all-files-saved-check-result": {
          customAnalysisAllMenu(args.result);
          break;
        }
        case "analysis-complete": {
          onAnalysisComplete(args);
          break;
        }
        case "audio-file-to-save": {
          onSaveAudio(args);
          break;
        }
        case "chart-data": {
          onChartData(args);
          break;
        }
        case "conversion-progress": {
          displayProgress(args.progress, args.text);
          break;
        }
        case "current-file-week": {
          STATE.week = args.week;
          break;
        }
        case "diskDB-has-records": {
          DOM.chartsLink.classList.remove("disabled");
          DOM.exploreLink.classList.remove("disabled");
          config.archive.location &&
            document
              .getElementById("compress-and-organise")
              .classList.remove("disabled");
          STATE.diskHasRecords = true;
          break;
        }
        case "file-location-id": {
          onFileLocationID(args);
          break;
        }
        case "files": {
          onOpenFiles(args);
          break;
        }
        case "generate-alert": {
          if (args.updateFilenamePanel) {
            renderFilenamePanel();
            window.electron.unsavedRecords(false);
            document.getElementById("unsaved-icon").classList.add("d-none");
          }
          if (args.file) {
            // Clear the file loading overlay:
            clearTimeout(loadingTimeout);
            DOM.loading.classList.add("d-none");
            MISSING_FILE = args.file;
            const i18n = getI18n(i18nLocate);
            args.locate = `
                            <div class="d-flex justify-content-center mt-2">
                                <button id="locate-missing-file" class="btn btn-primary border-dark text-nowrap" style="--bs-btn-padding-y: .25rem;" type="button">
                                    ${i18n.locate}
                                </button>
                                <button id="purge-from-toast" class="ms-3 btn btn-warning text-nowrap" style="--bs-btn-padding-y: .25rem;" type="button">
                                ${i18n.remove}
                                </button>
                            </div>
                            `;
          }
          generateToast(args);
          // This is how we know the database update has completed
          if (args.database && config.archive.auto)
            document.getElementById("compress-and-organise").click();
          break;
        }
        // Called when last result is returned from a database query
        case "database-results-complete": {
          onResultsComplete(args);
          break;
        }
        case "labels": {
          LABELS = args.labels;
          /* Code below to retrieve Red list data
                        for (let i = 0;i< LABELS.length; i++){
                            const label = LABELS[i];
                            let  sname = label.split('_')[0];
                            sname = IUCNtaxonomy[sname]
                            if (sname && ! STATE.IUCNcache[sname]) { 
                                await getIUCNStatus(sname)
                                await new Promise(resolve => setTimeout(resolve, 500))
                            }
                        }
                        */
          break;
        }
        case "label-translation-needed": {
          // Called when the initial system locale isn't english
          let locale = args.locale;
          let labelFile;
          if (config.list === "custom") {
            labelFile = config.customListFile[config.model];
          } else {
            locale === 'pt' && (locale ='pt_PT')
            labelFile = `labels/V2.4/BirdNET_GLOBAL_6K_V2.4_Labels_${locale}.txt`;
          }
          readLabels(labelFile);
          break;
        }
        case "location-list": {
          LOCATIONS = args.locations;
          locationID = args.currentLocation;
          break;
        }
        case "model-ready": {
          onModelReady(args);
          break;
        }
        case "mode-changed": {
          const mode = args.mode;
          STATE.mode = mode;
          renderFilenamePanel();
          adjustSpecDims()
          switch (mode) {
            case "analyse": {
              STATE.diskHasRecords &&
                !PREDICTING &&
                enableMenuItem(["explore", "charts"]);
              break;
            }
            case "archive": {
              enableMenuItem(["save2db", "explore", "charts"]);
              break;
            }
          }
          config.debug && console.log("Mode changed to: " + mode);
          if (["archive", "explore"].includes(mode)) {
            enableMenuItem(["purge-file"]);
            // change header to indicate activation
            DOM.resultHeader.classList.replace(
              "text-bg-secondary",
              "text-bg-dark"
            );
            //adjustSpecDims(true)
          } else {
            disableMenuItem(["purge-file"]);
            // change header to indicate deactivation
            DOM.resultHeader.classList.replace(
              "text-bg-dark",
              "text-bg-secondary"
            );
          }
          break;
        }
        case "summary-complete": {
          onSummaryComplete(args);
          break;
        }
        case "new-result": {
          renderResult(args);
          break;
        }
        case "progress": {
          onProgress(args);
          break;
        }
        // called when an analysis ends, or when the filesbeingprocessed list is empty
        case "processing-complete": {
          STATE.analysisDone = true;
          break;
        }
        case "seen-species-list": {
          STATE.seenSpecies = args.list.map(item => item.label)
          // generateBirdList("seenSpecies", args.list);
          break;
        }
        case "tfjs-node": {
          // Have we gone from a no-node setting to a node one?
          const changedEnv = config.hasNode !== args.hasNode;
          if (changedEnv && args.hasNode) {
            // If not using tensorflow, switch to the tensorflow backend because this faster under Node
            config[config.model].backend !== "tensorflow" && handleBackendChange("tensorflow");
          }
          config.hasNode = args.hasNode;
          if (!config.hasNode && config[config.model].backend !== "webgpu") {
            // No node? Not using webgpu? Force webgpu
            handleBackendChange("webgpu");
            generateToast({ type: "warning", message: "noNode" });
            console.warn(
              "tfjs-node could not be loaded, webGPU backend forced. CPU is",
              DIAGNOSTICS["CPU"]
            );
          }
          modelSettingsDisplay();
          break;
        }
        case "valid-species-list": {
          populateSpeciesModal(args.included, args.excluded);

          break;
        }
        case "tags": {
          STATE.tagsList = args.tags;
          // Init is passed on launch, so set up the UI
          args.init && setKeyAssignmentUI(config.keyAssignment)
          break
        }
        case "total-records": {
          updatePagination(args.total, args.offset);
          break;
        }
        case "unsaved-records": {
          window.electron.unsavedRecords(true);
          document.getElementById("unsaved-icon").classList.remove("d-none");
          break;
        }
        case "update-audio-duration": {
          DIAGNOSTICS["Audio Duration"] ??= 0;
          DIAGNOSTICS["Audio Duration"] += args.value;
          break;
        }
        case "update-summary": {
          updateSummary(args);
          break;
        }
        case "window-detections": {
          showWindowDetections(args);
          break;
        }
        case "worker-loaded-audio": {
          onWorkerLoadedAudio(args);
          break;
        }
        default: {
          generateToast({
            type: "error",
            message: "badMessage",
            variables: { "args.event": args.event },
          });
        }
      }
    });
  });
};

/**
 * Creates audio regions for detections that occur within the current view window.
 *
 * For each detection, the function adjusts its start and end times by subtracting the global offset
 * `windowOffsetSecs`. Only detections with an adjusted start time less than the current window length are processed.
 * A detection is considered "active" if its adjusted start time matches the start time of the currently active region
 * (`activeRegion.start`, if defined). If the detection is active and the `goToRegion` flag is true, the view is repositioned
 * to focus on that region. Otherwise, the detection is processed only if the configuration flag `config.specDetections` is enabled.
 *
 * Audio regions are created by calling `createRegion` with the adjusted start and end times, the detection's label,
 * a flag indicating whether to reposition the view (only for active detections when `goToRegion` is true), and an optional
 * colour (set to `STATE.regionActiveColour` for active regions). After processing all detections,
 * `STATE.regionsCompleted` is set to true to indicate that region creation is complete.
 *
 * @param {Object} options - An options object.
 * @param {Array<Object>} options.detections - An array of detection objects. Each object should include:
 *   @param {number} options.detections[].start - The starting time of the detection in seconds.
 *   @param {number} options.detections[].end - The ending time of the detection in seconds.
 *   @param {string} options.detections[].label - The label associated with the detection.
 * @param {boolean} options.goToRegion - If true, reposition the view to the newly created region when the detection is active.
 *
 * @returns {void}
 */
function showWindowDetections({detections, goToRegion}) {
  for (const detection of detections) {
    const start = detection.start - windowOffsetSecs;
    if (start < windowLength) {
      const end = detection.end - windowOffsetSecs;
      const active = start === activeRegion?.start;
      if (!config.specDetections && !active) continue;
      const colour = active ? STATE.regionActiveColour : null;
      const setPosition = active && goToRegion;      
      createRegion(start, end, detection.label, setPosition, colour);
    }
  }
  // Prevent region cluster fest
  STATE.regionsCompleted = true;
}

// function generateBirdList(store, rows) {
//   const chart = document.getElementById("chart-list");
//   const explore = document.getElementById("explore-list");
//   const listHTML = generateBirdOptionList({ store, rows });
//   chart.innerHTML = listHTML;
//   explore.innerHTML = listHTML;
// }

// /**
//  * Generates an HTML string for a bird species selection dropdown.
//  *
//  * Constructs a select element based on the provided options. When options.store is "allSpecies", a floating form-select is created with either a search prompt or a preselected species from the global LABELS. Otherwise, a basic select element is built using the species data from options.rows, with the currently active species (from STATE.chart.species) marked as selected.
//  *
//  * Also updates the inner HTML of the element with ID "species-search-label" using localized text.
//  *
//  * @param {Object} options - Options to configure the species option list.
//  * @param {string} options.store - Determines the type of select element to generate. Use "allSpecies" to render all species with an optional preselection.
//  * @param {Array<Object>} options.rows - Array of species objects; each must contain a "cname" property used for option values.
//  * @param {string} [options.selected] - Optionally, the species name to preselect when options.store is "allSpecies".
//  * @returns {string} HTML string representing the constructed select element with bird species options.
//  *
//  * @remark Relies on external globals such as LABELS, STATE, i18nHeadings, and i18nAll for data retrieval and localization.
//  */
// function generateBirdOptionList({ store, rows, selected }) {
//   let listHTML = "";
//   const i18n = getI18n(i18nHeadings);
//   const i18nTout = getI18n(i18nAll);
//   // Species search label and match count
//   document.getElementById('species-search-label').innerHTML = i18n.search;
//   if (store === "allSpecies") {
//     // let sortedList = LABELS.map((label) => {
//     //   const [sname, cname] = label.split("_")
//     //   return `${cname}~${sname}`
//     // });

//     // // International language sorting, recommended for large arrays - 'en_uk' not valid, but same as 'en'
//     // sortedList.sort(
//     //   new Intl.Collator(config.locale.replace(/_.*$/, "")).compare
//     // );
//     // Check if we have prepared this before

//     // const lastSelectedSpecies = selected || STATE.birdList.lastSelectedSpecies;
//     listHTML +=
//       `<div class="form-floating">
//       <select spellcheck="false" id="bird-list-all" class="form-select mb-3" aria-label=".form-select" required>`;
//     // 
//     // for (const species of sortedList) {
//     if (selected){
//       const species = LABELS.find(sp => sp.split('_')[1] === selected);
//       const [sname, cname] = species.split('_');
//       // const isSelected = cname === lastSelectedSpecies ? "selected" : "";
//       listHTML += `<option value="${cname}" selected>${cname}~${sname}</option>`;
//     } else {
//       listHTML += `<option value="">${i18n.searchPrompt}</option>`
//     }
//     listHTML += `</select><label for="bird-list-all">${i18n.species[0]}</label></div>`;
//   } else {
//     listHTML += `<select id="bird-list-seen" class="form-select"><option value="">${i18nTout[1]}</option>`;
//     for (const { cname } of rows) {
//       const isSelected = cname === STATE.chart.species ? "selected" : "";
//       listHTML += `<option value="${cname}" ${isSelected}>${cname}</option>`;
//     }
//     listHTML += `</select><label for="bird-list-seen">${i18n.species[0]}</label>`;
//   }

//   return listHTML;
// }

function generateBirdIDList(rows) {
  let listHTML = "";
  for (const item in rows) {
    listHTML += `   <tr><td>${rows[item].cname}</td> <td><i>${rows[item].sname}</i></td></tr>\n`;
  }
  return listHTML;
}

const getActiveRowID = () => activeRow?.rowIndex - 1;

const isSpeciesViewFiltered = (sendSpecies) => {
  const filtered = document.querySelector("#speciesFilter tr.text-warning");
  const species = filtered ? getSpecies(filtered) : undefined;
  return sendSpecies ? species : filtered !== null;
};

function unpackNameAttr(el, cname) {
  const currentRow = el.closest("tr");
  let [file, start, end, sname, commonName] = currentRow
    .getAttribute("name")
    .split("|");
  if (cname) commonName = cname;
  currentRow.attributes[0].value = [file, start, end, sname, commonName].join(
    "|"
  );
  return [file, parseFloat(start), parseFloat(end), currentRow];
}

function getSpecies(target) {
  const row = target.closest("tr");
  const speciesCell = row.querySelector(".cname .cname");
  const species = speciesCell.textContent.split("\n")[0];
  return species;
}

function handleGesture(e) {
  const currentTime = Date.now();
  if (currentTime - STATE.lastGestureTime < 1200) {
    return; // Ignore successive events within 1.2 second
  }
  STATE.lastGestureTime = currentTime;
  const moveDirection = e.deltaX || e.deltaY; // If deltaX is 0, use deltaY
  const key = moveDirection > 0 ? "PageDown" : "PageUp";
  config.debug && console.log(`scrolling x: ${e.deltaX} y: ${e.deltaY}`);
  // waitForFinalEvent(() => {
  GLOBAL_ACTIONS[key](e);
  trackEvent(config.UUID, "Swipe", key, "");
  // }, 200, 'swipe');
}

// document.addEventListener("change", function (e) {
//   const target = e.target;
//   const context = target.parentNode.classList.contains("chart")
//     ? "chart"
//     : "explore";
//   if (target.closest("#bird-list-seen")) {
//     // Clear the results table
//     // const resultTable = document.getElementById('resultTableBody');
//     // resultTable.textContent = '';
//     const cname = target.value;
//     let pickerEl = context + "Range";
//     t0 = Date.now();
//     let action, explore;
//     if (context === "chart") {
//       STATE.chart.species = cname;
//       action = "chart";
//     } else {
//       action = "filter";
//       resetResults({
//         clearSummary: false,
//         clearPagination: true,
//         clearResults: false,
//       });
//     }
//     worker.postMessage({
//       action: action,
//       species: cname,
//       range: STATE[context].range,
//       updateSummary: true,
//     });
//   } else if (target.closest("#chart-aggregation")) {
//     STATE.chart.aggregation = target.value;
//     worker.postMessage({
//       action: "chart",
//       aggregation: STATE.chart.aggregation,
//       species: STATE.chart.species,
//       range: STATE[context].range,
//     });
//   }
// });

// Save audio clip
async function onSaveAudio({ file, filename, extension }) {
  await window.electron.saveFile({
    file: file,
    filename: filename,
    extension: extension,
  });
}

// Chart functions
function getDateOfISOWeek(w) {
  const options = { month: "long", day: "numeric" };
  const y = new Date().getFullYear();
  const simple = new Date(y, 0, 1 + (w - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = simple;
  if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  return ISOweekStart.toLocaleDateString("en-GB", options);
}

function onChartData(args) {
  if (args.species) {
    showElement(["recordsTableBody"], false);
    const title = document.getElementById("speciesName");
    title.textContent = args.species;
  } else {
    hideElement(["recordsTableBody"]);
  }
  // Destroy the existing charts (if any)
  const chartInstances = Object.values(Chart.instances);
  chartInstances.forEach((chartInstance) => {
    chartInstance.destroy();
  });

  // Get the Chart.js canvas
  const chartCanvas = document.getElementById("chart-week");

  const records = args.records;
  for (const [key, value] of Object.entries(records)) {
    const element = document.getElementById(key);
    if (value?.constructor === Array) {
      if (isNaN(value[0])) element.textContent = "N/A";
      else {
        element.textContent =
          value[0].toString() +
          " on " +
          new Date(value[1]).toLocaleDateString(undefined, {
            dateStyle: "short",
          });
      }
    } else {
      element.textContent = value
        ? new Date(value).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })
        : "No Records";
    }
  }

  const aggregation = args.aggregation;
  const results = args.results;
  const rate = args.rate;
  const total = args.total;
  const dataPoints = args.dataPoints;
  // start hourly charts at midday if no filter applied
  const pointStart =
    STATE.chart.range.start || aggregation !== "Hour"
      ? args.pointStart
      : args.pointStart + 12 * 60 * 60 * 1000;
  const dateLabels = generateDateLabels(aggregation, dataPoints, pointStart);

  // Initialize Chart.js
  const plugin = {
    id: "customCanvasBackgroundColor",
    beforeDraw: (chart, args, options) => {
      const { ctx } = chart;
      ctx.save();
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = options.color || "#99ffff";
      ctx.fillRect(0, 0, chart.width, chart.height);
      ctx.restore();
    },
  };
  const chartOptions = {
    type: "bar",
    data: {
      labels: dateLabels,
      datasets: Object.entries(results).map(([year, data]) => ({
        label: year,
        //shift data to midday - midday rather than nidnight to midnight if hourly chart and filter not set
        data:
          aggregation !== "Hour"
            ? data
            : data.slice(12).join(data.slice(0, 12)),
        //backgroundColor: 'rgba(255, 0, 64, 0.5)',
        borderWidth: 1,
        //borderColor: 'rgba(255, 0, 64, 0.9)',
        borderSkipped: "bottom", // Lines will appear to rise from the bottom
      })),
    },
    options: {
      scales: {
        y: {
          min: 0,
          ticks: {
            // Force integers on the Y-axis
            precision: 0,
          },
        },
      },
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: args.species ? `${args.species} Detections` : "",
        },
        customCanvasBackgroundColor: {
          color: "GhostWhite",
        },
      },
    },
    plugins: [plugin],
  };
  if (total) {
    chartOptions.data.datasets.unshift({
      label: "Hours Recorded",
      type: "line",
      data: total,
      fill: true,
      //backgroundColor: 'rgba(0, 0, 64, 0.2)',
      borderWidth: 0,
      pointRadius: 0,
      yAxisID: "y1",
      cubicInterpolationMode: "monotone", // Use monotone cubic interpolation for a spline effect
      borderSkipped: "bottom", // Lines will appear to rise from the bottom
    });
    chartOptions.options.scales["y1"] = {
      position: "right",
      title: { display: true, text: "Hours of Recordings" },
    };
    chartOptions.options.scales.x = {
      max: 53,
      title: { display: true, text: "Week in Year" },
    };
  }
  new Chart(chartCanvas, chartOptions);
}

function generateDateLabels(aggregation, datapoints, pointstart) {
  const dateLabels = [];
  const startDate = new Date(pointstart);

  for (let i = 0; i < datapoints; i++) {
    // Push the formatted date label to the array
    dateLabels.push(formatDate(startDate, aggregation));

    // Increment the startDate based on the aggregation
    if (aggregation === "Hour") {
      startDate.setTime(startDate.getTime() + 60 * 60 * 1000); // Add 1 hour
    } else if (aggregation === "Day") {
      startDate.setDate(startDate.getDate() + 1); // Add 1 day
    } else if (aggregation === "Week") {
      startDate.setDate(startDate.getDate() + 7); // Add 7 days (1 week)
    }
  }

  return dateLabels;
}

// Helper function to format the date as desired
function formatDate(date, aggregation) {
  const options = {};
  let formattedDate = "";
  if (aggregation === "Week") {
    // Add 1 day to the startDate
    date.setHours(date.getDate() + 1);
    const year = date.getFullYear();
    const oneJan = new Date(year, 0, 1);
    const weekNumber = Math.ceil(
      ((date - oneJan) / (24 * 60 * 60 * 1000) + oneJan.getDay() + 1) / 7
    );
    return weekNumber;
  } else if (aggregation === "Day") {
    options.day = "numeric";
    options.weekday = "short";
    options.month = "short";
  } else if (aggregation === "Hour") {
    const hour = date.getHours();
    const period = hour >= 12 ? "PM" : "AM";
    const formattedHour = hour % 12 || 12; // Convert 0 to 12
    return `${formattedHour}${period}`;
  }

  return formattedDate + date.toLocaleDateString("en-GB", options);
}
function setChartOptions(
  species,
  total,
  rate,
  results,
  dataPoints,
  aggregation,
  pointStart
) {
  let chartOptions = {};
  //chartOptions.plugins = [ChartDataLabels];

  chartOptions.data = {
    labels: dataPoints, // Assuming dataPoints is an array of labels
    datasets: [
      {
        label: "Hours of recordings",
        data: total,
        borderColor: "#003",
        backgroundColor: "rgba(0, 51, 0, 0.2)",
        fill: true,
        yAxisID: "y-axis-0",
      },
      // Add other datasets as needed
    ],
  };

  chartOptions.options = {
    scales: {
      x: {
        type: "time",
        time: {
          unit: aggregation.toLowerCase(), // Assuming aggregation is 'Week', 'Day', or 'Hour'
          displayFormats: {
            day: "ddd D MMM",
            week: "MMM D",
            hour: "hA",
          },
        },
      },
      y: [
        {
          id: "y-axis-0",
          type: "linear",
          position: "left",
          title: {
            text: "Hours recorded",
          },
        },
        // Add other y-axes as needed
      ],
    },
    plugins: {
      legend: {
        display: true,
        position: "top",
      },
      tooltip: {
        enabled: true,
        mode: "index",
        intersect: false,
        position: "nearest",
        callbacks: {
          title: function (tooltipItems) {
            const timestamp = tooltipItems[0].parsed.x;
            const date = new Date(timestamp);
            return getTooltipTitle(date, aggregation);
          },
          label: function (tooltipItem) {
            return `${tooltipItem.dataset.label}: ${tooltipItem.formattedValue}`;
          },
        },
      },
      datalabels: {
        display: true,
        color: "white",
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        borderRadius: 3,
        padding: {
          top: 2,
        },
        formatter: function (value, _) {
          return value; // Customize the displayed value as needed
        },
      },
    },
  };

  return chartOptions;
}

function getTooltipTitle(date, aggregation) {
  if (aggregation === "Week") {
    // Customize for week view
    return `Week ${getISOWeek(date)} (${getDateOfISOWeek(
      getISOWeek(date)
    )} - ${getDateOfISOWeek(getISOWeek(date) + 1)})`;
  } else if (aggregation === "Day") {
    // Customize for day view
    return date.toLocaleDateString("en-GB", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } else {
    // Customize for hour view
    return (
      date.toLocaleDateString("en-GB", { month: "short", day: "numeric" }) +
      ", " +
      date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      })
    );
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

window.addEventListener("resize", function () {
  waitForFinalEvent(
    function () {
      adjustSpecDims(true);
    },
    100,
    "id1"
  );
});

/**
 * Debounces keydown event processing for non-interactive elements.
 *
 * Prevents the default behavior of keydown events when they do not originate from
 * an HTMLInputElement, HTMLTextAreaElement, or CustomSelect. The debounced call delays
 * the execution of the keydown handler by 100 milliseconds using a unique identifier ("keyhandler").
 *
 * @param {KeyboardEvent} e - The keydown event triggered by the user.
 */
function handleKeyDownDeBounce(e) {
  if (!(e.target instanceof HTMLInputElement 
    || e.target instanceof HTMLTextAreaElement
    || e.target instanceof CustomSelect)){
    e.preventDefault();
    waitForFinalEvent(
      function () {
        handleKeyDown(e);
      },
      100,
      "keyhandler"
    );
  }
}

/**
 * Responds to keydown events by dispatching configured global actions.
 *
 * Logs the pressed key when debugging is enabled. If the pressed key exists in the global actions mapping,
 * hides the context menu, determines the active modifier key (Shift, Control, or Alt; defaults to "no"),
 * tracks the key press event with its modifier via a tracking function, and executes the corresponding action callback.
 * If the key is not mapped, invokes the fallback handler for number keys.
 *
 * @param {KeyboardEvent} e - The keyboard event triggered on key press.
 * @returns {void}
 */
function handleKeyDown(e) {
  let action = e.key;
  config.debug && console.log(`${action} key pressed`);
  if (action in GLOBAL_ACTIONS) {
    DOM.contextMenu.classList.add("d-none");
    if (
      document === e.target ||
      document.body === e.target ||
      e.target.attributes["data-action"]
    ) {
    }
    const modifier = e.shiftKey
      ? "Shift"
      : e.ctrlKey
      ? "Control"
      : e.metaKey
      ? "Alt"
      : "no";
    trackEvent(config.UUID, "KeyPress", action, modifier);
    GLOBAL_ACTIONS[action](e);
  } else {
    GLOBAL_ACTIONS.handleNumberKeys(e);
  }
}

/**
 * Creates and returns a styled label element for a navigation option.
 *
 * This function generates an HTML <span> element with specific styling properties, including absolute positioning,
 * a text color, and a text shadow effect. If the global configuration's colormap is set to 'gray', the provided color
 * is overridden: a truthy color results in 'purple', whereas a falsy value defaults to '#666'. If no label text is provided,
 * the function returns undefined.
 *
 * @param {string} label - The text to display in the label. If falsy, the function returns undefined.
 * @param {string} [color] - The desired color for the label text (subject to configuration overrides).
 * @returns {(HTMLElement|undefined)} The styled <span> element containing the label text, or undefined if no label is provided.
 */
function formatLabel(label, color){
  if (config.colormap === 'gray') {
    color = color ? 'purple': '#666'
  }
  if (!label) return
  const labelEl = document.createElement('span');
  Object.assign(labelEl.style, {
    position: 'absolute',
    color: color || 'beige',
    top: '1rem',
    left: '0.5rem',
    textShadow: '2px 2px 3px rgb(0, 0, 0, 0.5)'
  })
  labelEl.textContent = label;
  return labelEl
}

/**
 * Activates the specified audio region by updating the global state and UI.
 *
 * This function first clears any previously active regions by resetting their colors 
 * and labels to the default state. It then applies an active style to the provided region,
 * which includes setting a new color and formatting the label. The function updates the global 
 * active region, positions the playhead at the region's start time (taking into account any window offset),
 * and enables UI menu items such as "export-audio" and, when applicable (i.e., if the model is ready and not predicting),
 * "analyseSelection". If the provided region object is invalid (missing or having non-numeric start or end values),
 * the function logs an error and exits without modifying the state.
 *
 * @param {Object} region - The audio region to activate.
 * @param {number} region.start - The start time of the region in seconds.
 * @param {number} region.end - The end time of the region in seconds.
 * @param {Object} region.content - A DOM element or object with an `innerText` property for displaying the region's label.
 *
 * @example
 * const region = {
 *   start: 15,
 *   end: 30,
 *   content: { innerText: 'Bird Call' }
 * };
 * setActiveRegion(region);
 */
function setActiveRegion(region) {
  if (!region || typeof region.start !== 'number' || typeof region.end !== 'number') {
    console.error('Invalid region:', region);
    return;
  }
  const { start, end, content } = region;
  // Clear active regions
  REGIONS.regions.forEach((r) => r.setOptions({ 
    color: STATE.regionColour,
    content: formatLabel(r.content?.innerText)
  }));
  // Set the playhead to the start of the region
  const label = content?.innerText || '';
  const labelEl = formatLabel(label, 'gold')
  activeRegion = { start, end, label};
  region.setOptions({ color: STATE.regionActiveColour, content: labelEl});
  enableMenuItem(["export-audio"]);
  if (modelReady && !PREDICTING) {
    enableMenuItem(["analyseSelection"]);
  }
  setActiveRow(start + windowOffsetSecs)
}

/**
 * Initializes and configures audio region management using the RegionsPlugin.
 *
 * Destroys any existing RegionsPlugin instance and creates a new instance with regions that are draggable,
 * a maximum limit of 100 regions, and a default color defined by STATE.regionColour.
 *
 * Registers event listeners for region interactions:
 * - "region-clicked": Hides the context menu, updates the active region, and seeks playback to the region's start.
 *   If the Shift key is pressed, all regions with the default color are removed; if the Ctrl/Cmd key is pressed,
 *   the clicked region is removed.
 * - "region-created": Marks a new region as active if it has no label (content) or its start time matches the current active region.
 * - "region-update": Clears the region's label and sets the updated region as active.
 *
 * @returns {Object} The new RegionsPlugin instance.
 */
function initRegion() {
  if (REGIONS) REGIONS.destroy();
  REGIONS = RegionsPlugin.create({
    drag: true,
    maxRegions: 100,
    color: STATE.regionColour,
  });

  REGIONS.on("region-clicked", function (r, e) {
    e.stopPropagation()
    // Hide context menu
    DOM.contextMenu.classList.add("d-none");
    if (r.start !== activeRegion?.start){
      setActiveRegion(r);
      wavesurfer.setTime(r.start);
    }
    // If shift key held, clear other regions
    if (e.shiftKey){
      REGIONS.regions.forEach((r) => r.color === STATE.regionColour && r.remove());
      // Ctrl / Cmd: remove the current region
    } else if (e.ctrlKey || e.metaKey) r.remove()
  })

  // Enable analyse selection when region created
  REGIONS.on("region-created", function (r) {
    const { start, content } = r;
    const activeStart = activeRegion ? activeRegion.start : null;
    // If a new region is created without a label, it must be user generated
     if (!content || start === activeStart) {
      setActiveRegion(r);
     }
  });

  // Clear label on modifying region
  REGIONS.on("region-update", function (r) {
    r.setOptions({content: ' '});
    setActiveRegion(r);
  });

  return REGIONS;
}

function initSpectrogram(height, fftSamples) {
    fftSamples ??= config.FFT;
  config.debug && console.log("initializing spectrogram");
  spectrogram && spectrogram.destroy() && WSPluginPurge();
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
    height = fftSamples / 2;
  }
  // set colormap
  const colors = createColormap();
  return Spectrogram.create({
    container: "#spectrogram",
    windowFunc: config.customColormap.windowFn,
    frequencyMin: config.audio.minFrequency,
    frequencyMax: config.audio.maxFrequency,
    // noverlap: 128, Auto (the default) seems fine
    // gainDB: 50, Adjusts spec brightness without increasing volume
    labels: config.specLabels,
    labelsColor: wsTextColour(),
    labelsBackground: "rgba(0,0,0,0)",
    height: height,
    fftSamples: fftSamples,
    scale: "linear",
    colorMap: colors,
    alpha: config.alpha
  });
}

function hideTooltip() {
  DOM.tooltip.style.visibility = "hidden";
}

function specTooltip(event, showHz = !config.specLabels) {
  if (true || config.showTooltip) {
    const i18n = getI18n(i18nContext);
    const waveElement = event.target;
    // Update the tooltip content
    const tooltip = DOM.tooltip;
    tooltip.style.display = "none";
    tooltip.replaceChildren();
    const inRegion = checkForRegion(event, false);
    if (showHz || inRegion) {
      const specDimensions = waveElement.getBoundingClientRect();
      const frequencyRange =
        Number(config.audio.maxFrequency) - Number(config.audio.minFrequency);
      const yPosition =
        Math.round(
          (specDimensions.bottom - event.clientY) *
            (frequencyRange / specDimensions.height)
        ) + Number(config.audio.minFrequency);

      tooltip.textContent = `${i18n.frequency}: ${yPosition}Hz`;
      if (inRegion){
        const { start, end } = inRegion;
        const textNode = document.createTextNode(
          formatRegionTooltip(i18n.length, start, end)
        );
        const lineBreak = document.createElement("br");
        tooltip.appendChild(lineBreak); // Add the line break
        tooltip.appendChild(textNode); // Add the text node
      }
      // Apply styles to the tooltip
      Object.assign(tooltip.style, {
        top: `${event.clientY}px`,
        left: `${event.clientX + 15}px`,
        display: "block",
        visibility: "visible",
        opacity: 1,
      });
    }
  }
}

const updateListIcon = () => {
  LIST_MAP = getI18n(i18nLIST_MAP);
  DOM.listIcon.style.visibility = "hidden";
  DOM.listIcon.innerHTML =
    config.list === "custom"
      ? `<span class="material-symbols-outlined mt-1" title="${
          LIST_MAP[config.list]
        }" style="width: 30px">fact_check</span>`
      : `<img class="icon" src="img/${config.list}.png" alt="${
          config.list
        }"  title="${LIST_MAP[config.list]}">`;
  DOM.listIcon.style.visibility = "visible";
};

DOM.listIcon.addEventListener("click", () => {
  if (PREDICTING) {
    generateToast({ message: "changeListBlocked", type: "warning" });
    return;
  }
  const keys = Object.keys(LIST_MAP);
  const currentListIndex = keys.indexOf(config.list);
  const next = currentListIndex === keys.length - 1 ? 0 : currentListIndex + 1;
  config.list = keys[next];
  DOM.listToUse.value = config.list;
  updateListIcon();
  updatePrefs("config.json", config);
  //resetResults();
  setListUIState(config.list);
  updateList();
});

DOM.customListSelector.addEventListener("click", async () => {
  const defaultPath = localStorage.getItem("customList") || '';
  const files = await window.electron.openDialog("showOpenDialog", {
    type: "text",
    defaultPath,
  });
  if (!files.canceled) {
    DOM.customListSelector.classList.remove("btn-outline-danger");
    const customListFile = files.filePaths[0];
    config.customListFile[config.model] = customListFile;
    DOM.customListFile.value = customListFile;
    readLabels(customListFile, "list");
    LIST_MAP = getI18n(i18nLIST_MAP);
    updatePrefs("config.json", config);
    localStorage.setItem("customList", customListFile);
  }
});

const loadModel = () => {
  PREDICTING = false;
  t0_warmup = Date.now();
  worker.postMessage({
    action: "load-model",
    model: config.model,
    list: config.list,
    batchSize: config[config[config.model].backend].batchSize,
    warmup: config.warmup,
    threads: config[config[config.model].backend].threads,
    backend: config[config.model].backend,
  });
};

const handleBackendChange = (backend) => {
  backend = backend instanceof Event ? backend.target.value : backend;
  config[config.model].backend = backend;
  const backendEL = document.getElementById(backend);
  backendEL.checked = true;
  if (backend === "webgl" || backend === "webgpu") {
    DOM.threadSlider.max = 3;
    // SNRSlider.disabled = true;
    // config.filters.SNR = 0;
  } else {
    DOM.threadSlider.max = DIAGNOSTICS["Cores"];
    DOM.contextAware.disabled = false;
    if (DOM.contextAware.checked) {
      config.detect.contextAware = true;
      // SNRSlider.disabled = true;
      // config.filters.SNR = 0;
    } else {
      // SNRSlider.disabled = false;
      // config.filters.SNR = parseFloat(SNRSlider.value);
      // if (config.filters.SNR) {
      //     DOM.contextAware.disabled = true;
      //     config.detect.contextAware = false;
      //     contextAwareIconDisplay();
      // }
    }
  }
  // Update threads and batch Size in UI
  DOM.threadSlider.value = config[backend].threads;
  DOM.numberOfThreads.textContent = config[backend].threads;
  DOM.batchSizeSlider.value = BATCH_SIZE_LIST.indexOf(
    config[backend].batchSize
  );
  DOM.batchSizeValue.textContent =
    BATCH_SIZE_LIST[DOM.batchSizeSlider.value].toString();
  updatePrefs("config.json", config);
  // restart wavesurfer regions to set new maxLength
  // initRegion();
  loadModel();
};

const setTimelinePreferences = () => {
  const timestampFields = document.querySelectorAll(".timestamp");
  const timeOfDayFields = document.querySelectorAll(".timeOfDay");
  timestampFields.forEach((time) => {
    config.timeOfDay
      ? time.classList.add("d-none")
      : time.classList.remove("d-none");
  });
  timeOfDayFields.forEach((time) => {
    config.timeOfDay
      ? time.classList.remove("d-none")
      : time.classList.add("d-none");
  });
};

const timelineToggle = (fromKeys) => {
  if (fromKeys === true) {
    DOM.timelineSetting.value === "timeOfDay"
      ? (DOM.timelineSetting.value = "timecode")
      : (DOM.timelineSetting.value = "timeOfDay");
  }
  config.timeOfDay = DOM.timelineSetting.value === "timeOfDay"; //toggle setting
  setTimelinePreferences();
  if (fileLoaded) {
    // Reload wavesurfer with the new timeline
    const position = clamp(wavesurfer.getCurrentTime() / windowLength, 0, 1);
    postBufferUpdate({ begin: windowOffsetSecs, position: position });
  }
  updatePrefs("config.json", config);
};
/**
 * Centers the spectrogram view around the current playback time.
 *
 * This function recalculates the starting offset of the audio window so that the
 * current time (from the WaveSurfer instance) appears at the center of the display.
 * It updates the global variable `windowOffsetSecs` by subtracting half of the
 * window's length from the computed midpoint. The offset is clamped between 0 and
 * the maximum valid offset determined by `currentFileDuration - windowLength`.
 *
 * If an active audio region exists (stored in `activeRegion`), the function adjusts
 * its start and end times by the same offset shift. Should the region extend beyond the
 * valid window boundaries after the shift, it is cleared (set to null).
 *
 * Finally, the function invokes `postBufferUpdate` to refresh the audio display with 
 * the new configuration, positioning the center at 0.5.
 *
 * Side Effects:
 * - Modifies the global variables `windowOffsetSecs` and `activeRegion`.
 * - Relies on and interacts with global state including `wavesurfer`, `windowLength`,
 *   `currentFileDuration`, and `postBufferUpdate`.
 */

function centreSpec() {
  if (STATE.regionsCompleted){
    const saveBufferBegin = windowOffsetSecs;
    const middle = windowOffsetSecs + wavesurfer.getCurrentTime();
    windowOffsetSecs = middle - windowLength / 2;
    windowOffsetSecs = Math.max(0, windowOffsetSecs);
    windowOffsetSecs = Math.min(
      windowOffsetSecs,
      currentFileDuration - windowLength
    );

    if (activeRegion) {
      const shift = saveBufferBegin - windowOffsetSecs;
      activeRegion.start += shift;
      activeRegion.end += shift;
      const { start, end } = activeRegion;
      if (start < 0 || end > windowLength) activeRegion = null;
    }
    postBufferUpdate({
      begin: windowOffsetSecs,
      position: 0.5
    });
  }
}

/**
 * Updates the active record based on the key assignment configuration.
 *
 * When an assignment exists for the provided key, extracts record details from the currently
 * selected row, modifies the appropriate field (species, label, or comment) based on the assignment,
 * and calls the record insertion routine with the updated values. If no active row is selected,
 * logs an informational message and aborts the update.
 *
 * @param {number|string} key - Identifier used to retrieve the key assignment (appended to "key" for lookup) from the configuration.
 *
 * @example
 * // Assuming a key assignment exists for key "1" in config.keyAssignment:
 * recordUpdate(1);
 */
function recordUpdate(key){
  if (!activeRow) {
    console.info('No active row selected for key assignment', key);
    return;
  }
  const assignment = config.keyAssignment['key'+ key];
  if (assignment?.column && assignment?.value){
    const nameAttribute = activeRow.getAttribute("name");
    const [file, start, end, sname, cname] = nameAttribute.split("|");
    const commentCell = activeRow.querySelector('.comment > span');
    const comment = commentCell ? commentCell.title : ''
    const labelCell = activeRow.querySelector('.label > span');
    const label = labelCell ? labelCell.textContent : ''
    const name = cname.replace("?", "");


    const newCname = assignment.column === 'species' ?  assignment.value : name;
    const newLabel = assignment.column === 'label' ?  assignment.value : label || '';
    const newComment = assignment.column === 'comment' ?  assignment.value : comment;
    // Save record for undo
    const {callCount} = addToHistory(activeRow, newCname);
    insertManualRecord(
      newCname,
      parseFloat(start),
      parseFloat(end),
      newComment,
      callCount ,
      newLabel,
      "Update",
      false,
      cname
    );
  }
}


const GLOBAL_ACTIONS = {

  // Handle number keys 1-9 dynamically
  handleNumberKeys: (e) => {
    if (/^[0-9]$/.test(e.key)) {
      // number keys here
      if (activeRow){
        recordUpdate(e.key)
      }
    }
  },
  a: (e) => {
    if ((e.ctrlKey || e.metaKey) && STATE.currentFile) {
      const element = e.shiftKey ? "analyseAll" : "analyse";
      document.getElementById(element).click();
    }
  },
  A: (e) => {
    (e.ctrlKey || e.metaKey) &&
      STATE.currentFile &&
      document.getElementById("analyseAll").click();
  },
  c: (e) => (e.ctrlKey || e.metaKey) && currentBuffer && centreSpec(),
  // D: (e) => {
  //     if (( e.ctrlKey || e.metaKey)) worker.postMessage({ action: 'create-dataset' });
  // },
  e: (e) => (e.ctrlKey || e.metaKey) && activeRegion && exportAudio(),
  g: (e) => (e.ctrlKey || e.metaKey) && showGoToPosition(),
  o: async (e) => (e.ctrlKey || e.metaKey) && await showOpenDialog("openFile"),
  p: () => activeRegion && playRegion(),
  q: (e) => e.metaKey && isMac && window.electron.exitApplication(),
  s: (e) => (e.ctrlKey || e.metaKey) &&
      document.getElementById("save2db").click(),
  t: (e) => (e.ctrlKey || e.metaKey) && timelineToggle(true),
  v: (e) => {
    if (activeRow && (e.ctrlKey || e.metaKey)) {
      const nameAttribute = activeRow.getAttribute("name");
      const [file, start, end, sname, cname] = nameAttribute.split("|");
      insertManualRecord(
        cname,
        parseFloat(start),
        parseFloat(end),
        "",
        "",
        "",
        "Update",
        false,
        cname
      );
    }
  },
  z: (e) => {
    if ((e.ctrlKey || e.metaKey) && HISTORY.length)
      insertManualRecord(...HISTORY.pop());
  },
  Escape: () => {
    if (PREDICTING) {
      console.log("Operation aborted");
      PREDICTING = false;
      disableSettingsDuringAnalysis(false);
      STATE.analysisDone = true;
      worker.postMessage({
        action: "abort",
        model: config.model,
        threads: config[config[config.model].backend].threads,
        list: config.list,
      });
      STATE.diskHasRecords && enableMenuItem(["explore", "charts"]);
      generateToast({ message: "cancelled" });
      DOM.progressDiv.classList.add("invisible");
    }
  },
  Home: () => {
    if (currentBuffer) {
      windowOffsetSecs = 0;
      postBufferUpdate({});
    }
  },
  End: () => {
    if (currentBuffer) {
      windowOffsetSecs = currentFileDuration - windowLength;
      postBufferUpdate({ begin: windowOffsetSecs, position: 1 });
    }
  },
  PageUp: () => {
    if (currentBuffer) {
      const position = clamp(wavesurfer.getCurrentTime() / windowLength, 0, 1);
      windowOffsetSecs = windowOffsetSecs - windowLength;
      const fileIndex = STATE.openFiles.indexOf(STATE.currentFile);
      let fileToLoad;
      if (fileIndex > 0 && windowOffsetSecs < 0) {
        windowOffsetSecs = -windowLength;
        fileToLoad = STATE.openFiles[fileIndex - 1];
      } else {
        windowOffsetSecs = Math.max(0, windowOffsetSecs);
        fileToLoad = STATE.currentFile;
      }
      postBufferUpdate({
        file: fileToLoad,
        begin: windowOffsetSecs,
        position: position
      });
    }
  },
  ArrowUp: () => {
    if (activeRow && STATE.regionsCompleted) {
      activeRow.classList.remove("table-active");
      activeRow = activeRow.previousSibling || activeRow;
      if (!activeRow.classList.contains("text-bg-dark")) activeRow.click();
      // activeRow.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  },
  PageDown: () => {
    if (currentBuffer) {
      let position = clamp(wavesurfer.getCurrentTime() / windowLength, 0, 1);
      windowOffsetSecs = windowOffsetSecs + windowLength;
      const fileIndex = STATE.openFiles.indexOf(STATE.currentFile);
      let fileToLoad;
      if (
        fileIndex < STATE.openFiles.length - 1 &&
        windowOffsetSecs >= currentFileDuration - windowLength
      ) {
        // Move to next file
        fileToLoad = STATE.openFiles[fileIndex + 1];
        windowOffsetSecs = 0;
        position = 0;
      } else {
        windowOffsetSecs = Math.min(
          windowOffsetSecs,
          currentFileDuration - windowLength
        );
        fileToLoad = STATE.currentFile;
      }
      postBufferUpdate({
        file: fileToLoad,
        begin: windowOffsetSecs,
        position: position
      });
    }
  },
  ArrowDown: () => {
    if (activeRow && STATE.regionsCompleted) {
      activeRow.classList.remove("table-active");
      activeRow = activeRow.nextSibling || activeRow;
      if (!activeRow.classList.contains("text-bg-dark")) activeRow.click();
      // activeRow.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  },
  ArrowLeft: () => {
    const skip = windowLength / 100;
    if (currentBuffer) {
      wavesurfer.setTime(wavesurfer.getCurrentTime() - skip);
      let position = clamp(wavesurfer.getCurrentTime() / windowLength, 0, 1);
      if (wavesurfer.getCurrentTime() < skip && windowOffsetSecs > 0) {
        windowOffsetSecs -= skip;
        postBufferUpdate({
          begin: windowOffsetSecs,
          position: (position += skip / windowLength)
        });
      }
    }
  },
  ArrowRight: () => {
    const skip = windowLength / 100;
    if (wavesurfer) {
      wavesurfer.setTime(wavesurfer.getCurrentTime() + skip);
      let position = clamp(wavesurfer.getCurrentTime() / windowLength, 0, 1);
      if (wavesurfer.getCurrentTime() > windowLength - skip) {
        windowOffsetSecs = Math.min(
          currentFileDuration - windowLength,
          (windowOffsetSecs += skip)
        );
        postBufferUpdate({
          begin: windowOffsetSecs,
          position: (position -= skip / windowLength)
        });
      }
    }
  },
  "=": (e) => e.metaKey || e.ctrlKey ? reduceFFT() : zoomSpec("zoomIn"),
  "+": (e) => e.metaKey || e.ctrlKey ? reduceFFT() : zoomSpec("zoomIn"),
  "-": (e) => e.metaKey || e.ctrlKey ? increaseFFT() : zoomSpec("zoomOut"),
  F5:() => reduceFFT(),
  F4: () => increaseFFT(),
  " ": () => {
      if (wavesurfer) {
        try {wavesurfer.playPause() }
        catch (e) { console.warn("Wavesurfer error", error.message || error) }
      }
    }, 
  Tab: (e) => {
    if ((e.metaKey || e.ctrlKey) && !PREDICTING && STATE.diskHasRecords) {
      // If you did this when predicting, your results would go straight to the archive
      const modeToSet =
        STATE.mode === "explore" ? "active-analysis" : "explore";
      document.getElementById(modeToSet).click();
    } else if (activeRow && STATE.regionsCompleted) {
      activeRow.classList.remove("table-active");
      if (e.shiftKey) {
        activeRow = activeRow.previousSibling || activeRow;
        activeRow.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else {
        activeRow = activeRow.nextSibling || activeRow;
        activeRow.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      if (!activeRow.classList.contains("text-bg-dark")) {
        activeRow.click();
      }
    }
  },
  Delete: () => activeRow && deleteRecord(activeRow),
  Backspace: () => activeRow && deleteRecord(activeRow),
};

/**
 * Retrieves the currently active region.
 *
 * This function returns the global active region object, which typically contains
 * properties (such as start and end) that define the region. If there is no active region,
 * the function returns undefined.
 *
 * @return {Object|undefined} The active region object with its defined properties, or undefined if not set.
 */
function getRegion() {
  return activeRegion || undefined;
}

function disableSettingsDuringAnalysis(bool) {
  DOM.modelToUse.disabled = bool;
  DOM.threadSlider.disabled = bool;
  DOM.batchSizeSlider.disabled = bool;
  DOM.locale.disabled = bool;
  DOM.listToUse.disabled = bool;
  DOM.customListContainer.disabled = bool;
  DOM.localSwitchContainer.disabled = bool;
  DOM.speciesThreshold.disabled = bool;
  DOM.speciesWeek.disabled = bool;
  DOM.backendOptions.forEach((backend) => (backend.disabled = bool));
  DOM.contextAware.disabled = bool;
  DOM.sendFilteredAudio.disabled = bool;
}

const postBufferUpdate = ({
  file = STATE.currentFile,
  begin = 0,
  position = 0,
  play = false,
  resetSpec = false,
  goToRegion = false,
}) => {

  /* Validate input parameters - removed as position is clamped before use
  if (position < 0 || position > 1) {
    console.error('Invalid buffer update position:', `Position: ${position}`);
    return;
  } */
 
  STATE.regionsCompleted = false;
  fileLoaded = false;
  worker.postMessage({
    action: "update-buffer",
    file: file,
    position: position,
    start: begin,
    end: begin + windowLength,
    play: play,
    resetSpec: resetSpec,
    // region: activeRegion,
    goToRegion: goToRegion,
  });
  // In case it takes a while:
  loadingTimeout = setTimeout(() => {
    DOM.loading.querySelector("#loadingText").textContent = "Loading file...";
    DOM.loading.classList.remove("d-none");
  }, 500);
};

// Go to position
const goto = new bootstrap.Modal(document.getElementById("gotoModal"));
const showGoToPosition = () => {
  if (STATE.currentFile) {
    const gotoLabel = document.getElementById("gotoModalLabel");
    const timeHeading = config.timeOfDay
      ? getI18n(i18nContext).gotoTimeOfDay
      : getI18n(i18nContext).gotoPosition;
    gotoLabel.textContent = timeHeading;
    goto.show();
  }
};

const gotoModal = document.getElementById("gotoModal");
//gotoModal.addEventListener('hidden.bs.modal', enableKeyDownEvent)

gotoModal.addEventListener("shown.bs.modal", () => {
  const timeInput = document.getElementById("timeInput");
  timeInput.value = "";
  timeInput.focus();
});

const gotoTime = (e) => {
  if (STATE.currentFile) {
    e.preventDefault();
    const time = document.getElementById("timeInput").value;
    // Nothing entered?
    if (!time) {
      // generateToast({type: 'warning',  message:'badTime'});
      return;
    }
    let [hours, minutes, seconds] = time.split(":").map(Number);
    hours ??= 0;
    minutes ??= 0;
    seconds ??= 0;
    let initialTime, start;
    if (config.timeOfDay) {
      initialTime = new Date(STATE.fileStart);
      // Create a Date object for the input time on the same day as the file start
      const inputDate = new Date(
        initialTime.getFullYear(),
        initialTime.getMonth(),
        initialTime.getDate(),
        hours,
        minutes,
        seconds
      );
      // Calculate the offset in milliseconds
      const offsetMillis = inputDate - STATE.fileStart;
      start = offsetMillis / 1000;
      //if we move to a new day... add 24 hours
      start += start < 0 ? 86400 : 0;
    } else {
      start = hours * 3600 + minutes * 60 + seconds;
    }
    windowLength = 20;

    start = Math.min(start, currentFileDuration);
    windowOffsetSecs = Math.max(start - windowLength / 2, 0);
    const position = start === 0 ? 0 : 0.5;
    postBufferUpdate({ begin: windowOffsetSecs, position: position });
    // Close the modal
    goto.hide();
  }
};

const gotoForm = document.getElementById("gotoForm");
gotoForm.addEventListener("submit", gotoTime);

/**
 * Initializes application state after the audio model becomes ready.
 *
 * Sets the model ready flag and updates UI elements based on current audio assets:
 * - Enables the "analyse" menu item if an audio file is loaded, and additionally "analyseAll" and "reanalyseAll" if multiple files are open.
 * - Enables the "analyseSelection" menu item when an active audio region exists.
 * - Calculates the warm-up time and logs it in the DIAGNOSTICS object.
 * - Logs the application launch time if this is the first load.
 * - Marks the application as loaded and hides the loading screen.
 * - Requests tag data from the worker.
 * - Initiates the user tour for new users in non-testing environments.
 * - Processes any queued operating system file inputs.
 *
 * @param {Object} [args={}] - Optional parameters (currently unused).
 * @returns {void}
 */
function onModelReady(args) {
  modelReady = true;
  if (fileLoaded) {
    enableMenuItem(["analyse"]);
    if (STATE.openFiles.length > 1)
      enableMenuItem(["analyseAll", "reanalyseAll"]);
  }
  if (activeRegion) enableMenuItem(["analyseSelection"]);
  t1_warmup = Date.now();
  DIAGNOSTICS["Warm Up"] =
    ((t1_warmup - t0_warmup) / 1000).toFixed(2) + " seconds";

  APPLICATION_LOADED || console.info("App launch time", `${ Math.round((t1_warmup - app_t0) / 1000)} seconds`)
  APPLICATION_LOADED = true;

  document.getElementById('loading-screen').classList.add('d-none');
  // Get all the tags from the db
  worker.postMessage({action: "get-tags", init: true});
  // New users - show the tour
  if (!isTestEnv && !config.seenTour) {
      config.seenTour = true;
      prepTour();
  }
  if (OS_FILE_QUEUE.length) onOpenFiles({filePaths: OS_FILE_QUEUE}) && OS_FILE_QUEUE.shift()
}

/***
 *  Called when a new file or buffer is loaded by the worker
 * @param fileStart  Unix epoch in ms for the start of the file
 * @param sourceDuration a float: number of seconds audio in the file
 * @param windowOffsetSecs a float: the start position of the file in seconds
 * @param file full path to the audio file
 * @param position the position to place the play head: between  0-1
 * @param contents the audio buffer
 * @param fileRegion an object {start, end} with the positions in seconds from the beginning of the buffer
 * @param preserveResults boolean determines whether to clear the result table
 * @param play whether to auto-play the audio
 * @returns {Promise<void>}
 */

async function onWorkerLoadedAudio({
  location,
  fileStart = 0,
  fileDuration = 0,
  windowBegin = 0,
  file = "",
  position = 0,
  contents = undefined,
  play = false,
  queued = false,
  metadata = undefined,
}) {
  clearTimeout(loadingTimeout);
  // Clear the loading animation
  DOM.loading.classList.add("d-none");
  const resetSpec = !STATE.currentFile;
  currentFileDuration = fileDuration;
  //if (preserveResults) completeDiv.hide();
  console.log(
    `UI received worker-loaded-audio: ${file}, buffered: ${queued === true}`
  );
  // Dismiss a context menu if it's open
  DOM.contextMenu.classList.add("d-none");
  currentBuffer = contents;

  STATE.fileStart = fileStart;
  locationID = location;
  windowOffsetSecs = windowBegin;
  if (STATE.currentFile !== file) {
    STATE.currentFile = file;
    fileEnd = new Date(fileStart + currentFileDuration * 1000);
    STATE.metadata[STATE.currentFile] = metadata;
    renderFilenamePanel();
  }

  const initialTime = config.timeOfDay
    ? new Date(fileStart)
    : new Date(0, 0, 0, 0, 0, 0, 0);
  bufferStartTime = new Date(initialTime.getTime() + windowBegin * 1000);

  if (windowLength > currentFileDuration) windowLength = currentFileDuration;

  resetRegions();
  await updateSpec({
    buffer: currentBuffer,
    position: position,
    play: play,
    resetSpec: resetSpec,
  });
  // Doe this after the spec has loaded the file
  fileLoaded = true;
  if (modelReady) {
    enableMenuItem(["analyse"]);
    if (STATE.openFiles.length > 1) enableMenuItem(["analyseAll"]);
  }
}

const i18nFile = {
  en: "File ${count} of ${fileCount}",
  da: "Fil ${count} af ${fileCount}",
  de: "Datei ${count} von ${fileCount}",
  es: "Archivo ${count} de ${fileCount}",
  fr: "Fichier ${count} sur ${fileCount}",
  nl: "Bestand ${count} van ${fileCount}",
  pt: "Arquivo ${count} de ${fileCount}",
  ru: "Файл ${count} из ${fileCount}",
  sv: "Fil ${count} av ${fileCount}",
  zh: "文件 ${count} / ${fileCount}",
};
const awaiting = {
  en: "Awaiting detections",
  da: "Afventer detektioner",
  de: "Warten auf Erkennungen",
  es: "Esperando detecciones",
  fr: "En attente des détections",
  nl: "Wachten op detecties",
  pt: "Aguardando detecções",
  ru: "Ожидание обнаружений",
  sv: "Väntar på detektioner",
  zh: "等待检测",
};
function onProgress(args) {
  DOM.progressDiv.classList.remove("invisible");
  if (args.text) {
    DOM.fileNumber.innerHTML = `<span class='loading text-nowrap'>${getI18n(
      awaiting
    )}</span>`;
  } else {
    const count = STATE.openFiles.indexOf(args.file) + 1;
    DOM.fileNumber.textContent = interpolate(getI18n(i18nFile), {
      count: count,
      fileCount: STATE.openFiles.length,
    });
  }
  if (args.progress) {
    let progress = Math.round(args.progress * 1000) / 10;
    updateProgress(progress);
  }
}

function updatePagination(total, offset = STATE.offset) {
  //Pagination
  total > config.limit
    ? addPagination(total, offset)
    : pagination.forEach((item) => item.classList.add("d-none"));
}

const updateSummary = async ({ summary = [], filterSpecies = "" }) => {
  const i18n = getI18n(i18nHeadings);
  const showIUCN = config.detect.iucn;

  // if (summary.length){
  let summaryHTML = `
            <table id="resultSummary" class="table table-dark p-1"><thead>
            <tr class="pointer col-auto">
            <th id="summary-max" scope="col"><span id="summary-max-icon" class="text-muted material-symbols-outlined summary-sort-icon d-none">sort</span>${
              i18n.max
            }</th>
            <th id="summary-cname" scope="col">
            <span id="summary-sname-icon" class="text-muted material-symbols-outlined summary-sort-icon">filter_list</span>
            <span id="summary-cname-icon" class="text-muted material-symbols-outlined summary-sort-icon d-none">sort</span>${
              i18n.species[0]
            }</th>
            ${showIUCN ? '<th scope="col"></th>' : ""}
            <th id="summary-count" class="text-end" scope="col"><span id="summary-count-icon" class="text-muted material-symbols-outlined summary-sort-icon d-none">sort</span>${
              i18n.detections
            }</th>
            <th id="summary-calls" class="text-end" scope="col"><span id="summary-calls-icon" class="text-muted material-symbols-outlined summary-sort-icon d-none">sort</span>${
              i18n.calls
            }</th>
            </tr>
            </thead><tbody id="speciesFilter">`;
  let selectedRow = null;
  const i18nIUCN = getI18n(IUCNLabel);
  for (let i = 0; i < summary.length; i++) {
    const item = summary[i];
    const selected = item.cname === filterSpecies ? " text-warning" : "";
    if (selected) selectedRow = i + 1;
    summaryHTML += `<tr tabindex="-1" class="${selected}">
                <td class="max">${iconizeScore(item.max)}</td>
                    <td class="cname">
                        <span class="cname">${item.cname}</span> <br><i>${
      item.sname
    }</i>
                    </td>`;

    if (showIUCN) {
      const species = IUCNtaxonomy[item.sname] || item.sname;
      const record = STATE.IUCNcache[species];
      // there might not be a record...
      const iucn = record?.scopes.find(
        (obj) => obj.scope === config.detect.iucnScope
      );
      const status = iucn?.status || "NA";
      const url = iucn?.url
        ? "https://www.iucnredlist.org/species/" + iucn.url
        : null;
      summaryHTML += `<td class="text-end"><a id="iucn-link-${
        item.sname
      }" title="${i18nIUCN[status]}" 
                        class="d-inline-block p-1 w-100 rounded text-decoration-none text-center ${
                          IUCNMap[status]
                        } ${!url ? "disabled-link" : ""}"
                        href="${
                          url || "#"
                        }" target="_blank"> ${status}</a></td>`;
    }
    summaryHTML += `<td class="text-end">${item.count}</td>
                    <td class="text-end">${item.calls}</td>
                    </tr>`;
  }
  summaryHTML += "</tbody></table>";
  // Get rid of flicker...
  const old_summary = DOM.summaryTable;
  const fragment = document.createDocumentFragment(); // Create a document fragment
  const tempDiv = document.createElement("div"); // Temporary container for parsing

  // Parse the new HTML into DOM nodes
  tempDiv.innerHTML = summaryHTML;

  // Move parsed child nodes into the fragment
  Array.from(tempDiv.childNodes).forEach((node) => fragment.appendChild(node));

  // Replace the contents of the #summaryTable
  old_summary.replaceChildren(); // Clear existing children

  old_summary.appendChild(fragment);

  showSummarySortIcon();
  // scroll to the selected species
  if (selectedRow) {
    const table = document.getElementById("resultSummary");
    table.rows[selectedRow].scrollIntoView({
      behavior: "instant",
      block: "center"
    });
  }
  // }
};

/**
 * Finalizes result processing after the database has sent the last result.
 *
 * Updates analysis state by disabling the predicting flag and re-enabling settings, replaces the result table
 * with the latest content cloned from a buffer, resets the buffer's content, and ensures that the designated row
 * in the results table is activated. The active row is selected based on the following priority:
 * - If an `active` index is provided, uses that row; if not found (which can occur after an edit), selects the last row
 *   matching daytime or nighttime criteria.
 * - If a `select` value is provided, determines the row index via a helper function and activates that row.
 * - Otherwise, attempts to activate a row marked with the "table-active" class, or defaults to the first table row.
 *
 * Once the active row is determined, it simulates a click on that row and scrolls it into view, hides the progress indicator,
 * and updates the filename panel.
 *
 * @param {Object} [options={}] - Options for handling result activation.
 * @param {number} [options.active] - Specific row index to activate in the result table.
 * @param {*} [options.select] - Value used by a helper function to determine which row to activate.
 *
 * @returns {void}
 */
function onResultsComplete({ active = undefined, select = undefined } = {}) {
  PREDICTING = false;
  disableSettingsDuringAnalysis(false);
  DOM.resultTable.replaceWith(resultsBuffer.cloneNode(true));
  resultsBuffer.textContent = "";
  const table = DOM.resultTable;
  showElement(["resultTableContainer", "resultsHead"], false);
  // Set active Row
  if (active) {
    // Refresh node and scroll to active row:
    activeRow = table.rows[active];
    if (!activeRow) {
      // because: after an edit the active row may not exist
      const rows = table.querySelectorAll("tr.daytime, tr.nighttime");
      if (rows.length) {
        activeRow = rows[rows.length - 1];
      }
    }
  } else if (select) {
    const row = getRowFromStart(table, select);
    activeRow = table.rows[row];
  } else {
    // if (STATE.mode === 'analyse') {
    activeRow = table.querySelector(".table-active");
    if (!activeRow) {
      // Select the first row
      activeRow = table.querySelector("tr:first-child");
    }
  }

  if (activeRow) {
    activeRow.click();
    activeRow.scrollIntoView({ behavior: "instant", block: "center" });
  }
  // hide progress div
  DOM.progressDiv.classList.add("invisible");
  renderFilenamePanel();
  activateResultSort();
}

/**
 * Retrieves the index of a table row whose associated start time matches a specified value.
 *
 * Iterates over the rows of an HTML table, extracting the start time from each row's "name" attribute.
 * The "name" attribute is expected to be a string with values separated by a "|" character, where the
 * second element represents the start time. If the "name" attribute is absent, a default value of 0 is used.
 *
 * @param {HTMLTableElement} table - The table element containing rows to search.
 * @param {number} start - The target start time to match against the row's parsed start time.
 * @returns {number|undefined} The index of the first row with a matching start time, or undefined if no match is found.
 */
function getRowFromStart(table, start) {
  for (var i = 0; i < table.rows.length; i++) {
    const row = table.rows[i];
    // Get the value of the name attribute and split it on '|'
    // Start time is the second value in the name string
    const nameAttr = row.getAttribute("name");
    // no nameAttr for start civil twilight row
    const startTime = nameAttr ? nameAttr.split("|")[1] : 0;

    // Check if the second value matches the 'select' variable
    if (parseFloat(startTime) === start) {
      return i;
    }
  }
}

// formatDuration: Used for DIAGNOSTICS Duration
function formatDuration(seconds) {
  let duration = "";
  const hours = Math.floor(seconds / 3600); // 1 hour = 3600 seconds
  if (hours) duration += `${hours} hours `;
  const minutes = Math.floor((seconds % 3600) / 60); // 1 minute = 60 seconds
  if (hours || minutes) duration += `${minutes} minutes `;
  const remainingSeconds = Math.floor(seconds % 60); // Remaining seconds
  duration += `${remainingSeconds} seconds`;
  return duration;
}

/**
 * Finalizes audio analysis by updating application state, re-enabling UI settings,
 * and logging diagnostic metrics and tracking events.
 *
 * Resets the prediction flag, restores settings, updates analysis state,
 * and conditionally enables menu items based on available disk records.
 * Hides the progress indicator and, when not in quiet mode, calculates
 * the analysis duration and rate for telemetry. In non-quiet mode, records
 * these metrics through event tracking and displays a completion notification.
 *
 * @param {Object} options - Options for analysis completion.
 * @param {boolean} options.quiet - Suppresses diagnostic tracking and notifications if true.
 *
 */
function onAnalysisComplete({ quiet }) {
  PREDICTING = false;
  disableSettingsDuringAnalysis(false);
  STATE.analysisDone = true;
  STATE.diskHasRecords && enableMenuItem(["explore", "charts"]);
  DOM.progressDiv.classList.add("invisible");
  if (quiet) return;
  // DIAGNOSTICS:
  t1_analysis = Date.now();
  const analysisTime = ((t1_analysis - t0_analysis) / 1000).toFixed(2);
  const duration = STATE.selection
    ? STATE.selection.end - STATE.selection.start
    : DIAGNOSTICS["Audio Duration"];
  const rate = duration / analysisTime;

  trackEvent(
    config.UUID,
    `${config.model}-${config[config.model].backend}`,
    "Audio Duration",
    config[config.model].backend,
    Math.round(duration)
  );

  if (!STATE.selection) {
    trackEvent(
      config.UUID,
      `${config.model}-${config[config.model].backend}`,
      "Analysis Rate",
      config[config.model].backend,
      parseInt(rate)
    );
    trackEvent(
      config.UUID,
      `${config.model}-${config[config.model].backend}`,
      "Analysis Duration",
      config[config.model].backend,
      parseInt(analysisTime)
    );
    DIAGNOSTICS["Analysis Duration"] = formatDuration(analysisTime);
    DIAGNOSTICS["Analysis Rate"] =
      rate.toFixed(0) + "x faster than real time performance.";
    generateToast({ message: "complete" });
    // activateResultSort();
  }
}

/* 
    onSummaryComplete is called when getSummary finishes.
    */
function onSummaryComplete({
  filterSpecies = undefined,
  audacityLabels = {},
  summary = [],
}) {
  updateSummary({ summary: summary, filterSpecies: filterSpecies });
  // Add pointer icon to species summaries
  const summarySpecies = DOM.summaryTable.querySelectorAll(".cname");
  summarySpecies.forEach((row) => row.classList.add("pointer"));

  // Add hover to the summary
  const summaryNode = document.getElementById("resultSummary");
  if (summaryNode) {
    summaryNode.classList.add("table-hover");
  }
  if (!PREDICTING || STATE.mode !== "analyse") activateResultSort();
  // Why do we do audacity labels here?
  AUDACITY_LABELS = audacityLabels;
  if (summary.length) {
    enableMenuItem(["saveLabels", "saveCSV", "save-eBird", "save-Raven"]);
    STATE.mode !== "explore" && enableMenuItem(["save2db"]);
  } else {
    disableMenuItem([
      "saveLabels",
      "saveCSV",
      "save-eBird",
      "save-Raven",
      "save2db",
    ]);
  }
  if (STATE.currentFile) enableMenuItem(["analyse"]);
}

const pagination = document.querySelectorAll(".pagination");
pagination.forEach((item) => {
  item.addEventListener("click", (e) => {
    if (STATE.analysisDone && e.target.tagName === "A") {
      // Did we click a link in the list?
      let clicked = e.target.textContent;
      let currentPage = pagination[0].querySelector(".active");
      currentPage = parseInt(currentPage.textContent);
      if (clicked === "Previous") {
        clicked = currentPage - 1;
      } else if (clicked === "Next") {
        clicked = currentPage + 1;
      } else {
        clicked = parseInt(clicked);
      }
      const limit = config.limit;
      const offset = (clicked - 1) * limit;
      // Tell the worker about the new offset
      const species = isSpeciesViewFiltered(true);
      species
        ? worker.postMessage({
            action: "update-state",
            filteredOffset: { [species]: offset },
          })
        : worker.postMessage({ action: "update-state", globalOffset: offset });
      filterResults({ offset: offset, limit: limit });
      resetResults({
        clearSummary: false,
        clearPagination: false,
        clearResults: false,
      });
    }
  });
});

const addPagination = (total, offset) => {
  const limit = config.limit;
  const pages = Math.ceil(total / limit);
  const currentPage = offset / limit + 1;
  let list = "";
  for (let i = 1; i <= pages; i++) {
    if (i === 1) {
      list +=
        i === currentPage
          ? '<li class="page-item disabled"><span class="page-link" href="#">Previous</span></li>'
          : '<li class="page-item"><a class="page-link" href="#">Previous</a></li>';
    }
    if (
      i <= 2 ||
      i > pages - 2 ||
      (i >= currentPage - 2 && i <= currentPage + 2)
    ) {
      list +=
        i === currentPage
          ? '<li class="page-item active" aria-current="page"><span class="page-link" href="#">' +
            i +
            "</span></li>"
          : '<li class="page-item"><a class="page-link" href="#">' +
            i +
            "</a></li>";
    } else if (i === 3 || i === pages - 3) {
      list +=
        '<li class="page-item disabled"><span class="page-link" href="#">...</span></li>';
    }
    if (i === pages) {
      list +=
        i === currentPage
          ? '<li class="page-item disabled"><span class="page-link" href="#">Next</span></li>'
          : '<li class="page-item"><a class="page-link" href="#">Next</a></li>';
    }
  }
  pagination.forEach((item) => {
    item.classList.remove("d-none");
    item.innerHTML = list;
  });
};

/**
 * Toggles the species filter based on user interaction with the summary table.
 *
 * Validates the event against non-interactive elements and current analysis state before proceeding.
 * If the selected row is already highlighted (indicating an active filter), the highlight is removed;
 * otherwise, all highlighted rows are cleared, the current row is marked, and the corresponding species
 * is extracted from the clicked element. In explore mode, the species value is set in the bird list display.
 * Subsequently, the function refreshes the results filtering and resets the UI components without clearing
 * the summary, pagination, or result listings.
 *
 * @param {Event} e - The DOM event triggered by the user's click on a table row.
 *
 * @example
 * // Apply species filtering when a table row is clicked.
 * speciesFilter(event);
 */
function speciesFilter(e) {
  if (!STATE.regionsCompleted || PREDICTING || ["TBODY", "TH", "DIV"].includes(e.target.tagName)) return; // on Drag or clicked header
  let species, range;
  // Am I trying to unfilter?
  if (e.target.closest("tr").classList.contains("text-warning")) {
    e.target.closest("tr").classList.remove("text-warning");
  } else {
    //Clear any highlighted rows
    const tableRows = DOM.summary.querySelectorAll("tr");
    tableRows.forEach((row) => row.classList.remove("text-warning"));
    // Add a highlight to the current row
    e.target.closest("tr").classList.add("text-warning");
    // Clicked on unfiltered species
    species = getSpecies(e.target);
  }
  if (isExplore()) {
    range = STATE.explore.range;
    const autoComplete = document.getElementById('bird-autocomplete-explore')
    autoComplete.value = species || "";
  }
  filterResults({ updateSummary: false });
  resetResults({
    clearSummary: false,
    clearPagination: false,
    clearResults: false,
  });
}

/**
 * Renders a detection result into the results table while managing table headers, pagination, and UI updates.
 *
 * For the first result (index ≤ 1), clears or resets the results table based on the selection mode and sets up table headers
 * with localized labels. When handling non-database results beyond the configured limit, the function adds pagination or
 * aborts further processing. For valid detection results, it formats timestamps and positions for display, constructs the
 * corresponding table row including species details, call counts, labels, comments, and review status, and schedules UI
 * updates to incorporate the new entry.
 *
 * @param {Object} options - Options for rendering the result.
 * @param {number} [options.index=1] - Sequential index of the detection result.
 * @param {Object} [options.result={}] - Detection result data containing properties such as timestamp, position, active,
 *   sname, cname, score, label, tagID, comment, end, count, callCount, isDaylight, and reviewed.
 * @param {*} [options.file=undefined] - The audio file reference associated with the detection.
 * @param {boolean} [options.isFromDB=false] - Flag indicating whether the result originates from the database.
 * @param {boolean} [options.selection=false] - Flag indicating if the rendering is for a selection-specific view.
 *
 * @returns {Promise<void>} A promise that resolves once the result has been rendered and the UI updated.
 *
 * @todo Display each detection as a distinct region on the spectrogram.
 */

async function renderResult({
  index = 1,
  result = {},
  file = undefined,
  isFromDB = false,
  selection = false,
}) {
  let tr = "";
  if (index <= 1) {
    if (selection) {
      const selectionTable = document.getElementById(
        "selectionResultTableBody"
      );
      selectionTable.textContent = "";
    } else {
      // if (!isFromDB) {
      //     resetResults({clearResults: false, clearSummary: false, clearPagination: false});
      // }
      const i18n = getI18n(i18nHeadings);
      // const fragment = new DocumentFragment();
      DOM.resultHeader.innerHTML = `
                <tr>
                    <th id="sort-time" class="time-sort col text-start timeOfDay" title="${i18n.time[1]}"><span class="text-muted material-symbols-outlined time-sort-icon d-none">sort</span> ${i18n.time[0]}</th>
                    <th id="sort-position" class="time-sort text-start timestamp" title="${i18n.position[1]}"><span class="text-muted material-symbols-outlined time-sort-icon d-none">sort</span> ${i18n.position[0]}</th>
                    <th id="confidence-sort" class="text-start" title="${i18n.species[1]}"><span class="text-muted material-symbols-outlined species-sort-icon d-none">sort</span> ${i18n.species[0]}</th>
                    <th class="text-end">${i18n.calls}</th>
                    <th id="sort-label" class="col pointer"><span class="text-muted material-symbols-outlined meta-sort-icon d-none">sort</span> ${i18n.label}</th>
                    <th id="sort-comment" class="col pointer text-end"><span class="text-muted material-symbols-outlined meta-sort-icon d-none">sort</span> ${i18n.notes}</th>
                    <th id="sort-reviewed" class="col pointer text-end"><span class="text-muted material-symbols-outlined meta-sort-icon d-none">sort</span>${i18n.reviewed}</th>
                </tr>`;
      setTimelinePreferences();
      // DOM.resultHeader.innerHTML = fragment;
    }
    showElement(["resultTableContainer", "resultsHead"], false);
    // If  we have some results, let's update the view in case any are in the window
    if (config.specDetections && !isFromDB && !STATE.selection)
      postBufferUpdate({ file, begin: windowOffsetSecs });
  } else if (!isFromDB && index % (config.limit + 1) === 0) {
    addPagination(index, 0);
  }
  if (!isFromDB && index > config.limit) {
    return;
  } else {
    const {
      timestamp,
      position,
      active,
      sname,
      cname,
      score,
      label,
      tagID,
      comment,
      end,
      count,
      callCount,
      isDaylight,
      reviewed
    } = result;
    const dayNight = isDaylight ? "daytime" : "nighttime";
    // Todo: move this logic so pre dark sections of file are not even analysed
    if (config.detect.nocmig && !selection && dayNight === "daytime") return;

    const commentHTML = comment
      ? `<span title="${comment.replaceAll(
          '"',
          "&quot;"
        )}" class='material-symbols-outlined pointer'>comment</span>`
      : "";

    const reviewHTML = reviewed 
        ? `<span class='material-symbols-outlined'>check_small</span>`
        : '';
    // store result for feedback function to use
    if (!selection) predictions[index] = result;
    // Format date and position for  UI
    const date = new Date(timestamp);
    const UI_timestamp = date.toLocaleString(
      undefined,
      STATE.dataFormatOptions
    );
    const spliceStart = position < 3600 ? 14 : 11;
    const UI_position = new Date(position * 1000)
      .toISOString()
      .substring(spliceStart, 19);
    const showTimeOfDay = config.timeOfDay ? "" : "d-none";
    const showTimestamp = config.timeOfDay ? "d-none" : "";
    const activeTable = active ? "table-active" : "";
    const labelHTML = Number.isInteger(tagID) && label ? `<span class="badge text-bg-${STATE.labelColors[tagID % STATE.labelColors.length] } rounded-pill">${label}</span>` : "";
    const hide = selection ? "d-none" : "";
    const countIcon =
      count > 1
        ? `<span class="circle" title="Click to view the ${count} detections at this timecode">${count}</span>`
        : "";
    tr += `<tr tabindex="-1" id="result${index}" name="${file}|${position}|${
      end || position + 3
    }|${sname}|${cname}" class='${activeTable} border-top border-2 border-secondary ${dayNight}'>
            <td class='text-start timeOfDay ${showTimeOfDay}'>${UI_timestamp}</td>
            <td class="text-start timestamp ${showTimestamp}">${UI_position} </td>
            <td name="${cname}" class='text-start cname'>
            <span class="cname">${cname}</span> ${countIcon} ${iconizeScore(
      score
    )}
            </td>
            <td class="text-end call-count ${hide}">${callCount || "1"} </td>
            
            <td class="label ${hide}">${labelHTML}</td>
            <td class="comment text-end ${hide}">${commentHTML}</td>
            <td class="reviewed text-end ${hide}">${reviewHTML}</td>
            </tr>`;
  }
  updateResultTable(tr, isFromDB, selection);
}

let resultsBuffer = document.getElementById("resultTableBody").cloneNode(false),
  detectionsModal;
const detectionsModalDiv = document.getElementById("detectionsModal");

detectionsModalDiv.addEventListener("hide.bs.modal", (e) => {
  worker.postMessage({ action: "update-state", selection: undefined });
});

const updateResultTable = (row, isFromDB, isSelection) => {
  const table = isSelection
    ? document.getElementById("selectionResultTableBody")
    : document.getElementById("resultTableBody");
  if (isFromDB && !isSelection) {
    resultsBuffer.lastElementChild
      ? resultsBuffer.lastElementChild.insertAdjacentHTML("afterend", row)
      : (resultsBuffer.innerHTML = row);
  } else {
    if (isSelection) {
      if (!detectionsModal || !detectionsModal._isShown) {
        detectionsModal = new bootstrap.Modal("#detectionsModal", {
          backdrop: "static",
        });
        detectionsModal.show();
      }
    }
    table.lastElementChild
      ? table.lastElementChild.insertAdjacentHTML("afterend", row)
      : (table.innerHTML = row);
  }
};

const isExplore = () => {
  return STATE.mode === "explore";
};

/**
 * Stores the row index of the table row associated with the clicked element.
 *
 * Traverses upward from the provided element to locate the nearest ancestor <tr> element,
 * then assigns its rowIndex to the global variable clickedIndex. It is assumed that the
 * target element is within a table row; otherwise, the function may produce errors.
 *
 * @param {HTMLElement} target - The DOM element that triggered the event.
 */

function setClickedIndex(target) {
  const clickedNode = target.closest("tr");
  clickedIndex = clickedNode.rowIndex;
}

const deleteRecord = (target) => {
  if (target instanceof PointerEvent) target = activeRow;
  else {
    //I'm not sure what triggers this
    target.forEach((position) => {
      const [start, end] = position;
      worker.postMessage({
        action: "delete",
        file: STATE.currentFile,
        start: start,
        end: end,
        active: getActiveRowID(),
      });
    });
    activeRow = undefined;
    return;
  }

  setClickedIndex(target);
  const {species, start, end, file, row, setting} = addToHistory(target)

    worker.postMessage({
      action: "delete",
      file,
      start,
      end,
      species,
      speciesFiltered: isSpeciesViewFiltered(),
    });
    // Clear the record in the UI
    const index = row.rowIndex;
    // there may be no records remaining (no index)
    index > -1 && setting.deleteRow(index);
    setting.rows[index]?.click();
};

const deleteSpecies = (target) => {
  worker.postMessage({
    action: "delete-species",
    species: getSpecies(target),
    speciesFiltered: isSpeciesViewFiltered(),
  });
  // Clear the record in the UI
  const row = target.closest("tr");
  const table = document.getElementById("resultSummary");
  const rowClicked = row.rowIndex;
  table.deleteRow(rowClicked);
  const resultTable = document.getElementById("resultTableBody");
  resultTable.innerHTML = "";
  // Highlight the next row
  const newRow = table.rows[rowClicked];
  newRow?.click();
};

function sendFile(mode, result) {
  let start, end, filename;
  if (result) {
    start = result.position;
    end = result.end || start + 3;
    const dateArray = new Date(result.timestamp).toString().split(" ");
    const datetime = dateArray.slice(0, 5).join(" ");
    filename = `${result.cname}_${datetime}.${config.audio.format}`;
  } else if (start === undefined) {
    if (activeRegion.start) {
      start = activeRegion.start + windowOffsetSecs;
      end = activeRegion.end + windowOffsetSecs;
    } else {
      start = 0;
      end = currentBuffer.duration;
    }
    const dateArray = new Date(STATE.fileStart + start * 1000)
      .toString()
      .split(" ");
    const dateString = dateArray.slice(0, 5).join(" ");
    filename = dateString + "." + config.audio.format;
  }

  let metadata = {
    lat: parseFloat(config.latitude),
    lon: parseFloat(config.longitude),
    Artist: "Chirpity " + VERSION.toString(),
  };
  if (result) {
    const date = new Date(result.timestamp);
    metadata = {
      ...metadata,
      //filename: result.file,
      Genre: result.sname.split(" ")[0],
      Title: `${result.cname} - ${result.sname}`,
      Track: parseInt(result.score),
      Year: date.getFullYear(),
    };
  }

  if (mode === "save") {
    worker.postMessage({
      action: "save",
      start: start,
      file: STATE.currentFile,
      end: end,
      filename: filename,
      metadata: metadata,
    });
  } else {
    if (!config.seenThanks) {
      generateToast({ message: "feedback" });
      config.seenThanks = true;
      updatePrefs("config.json", config);
    }
    worker.postMessage({
      action: "post",
      start: start,
      file: STATE.currentFile,
      end: end,
      defaultName: filename,
      metadata: metadata,
      mode: mode,
    });
  }
}

const iconDict = {
  guess:
    '<span class="confidence-row"><span class="confidence bar" style="flex-basis: --%; background: grey">--%</span></span>',
  low: '<span class="confidence-row"><span class="confidence bar" style="flex-basis: --%; background: rgba(255,0,0,0.5)">--%</span></span>',
  medium:
    '<span class="confidence-row"><span class="confidence bar" style="flex-basis: --%; background: #fd7e14">--%</span></span>',
  high: '<span class="confidence-row"><span class="confidence bar" style="flex-basis: --%; background: #198754">--%</span></span>',
  confirmed:
    '<span class="material-symbols-outlined" title="Manual Record">person_add</span>',
};

const iconizeScore = (score) => {
  const tooltip = score.toString();
  if (score < 50) return iconDict["guess"].replaceAll("--", tooltip);
  else if (score < 65) return iconDict["low"].replaceAll("--", tooltip);
  else if (score < 85) return iconDict["medium"].replaceAll("--", tooltip);
  else if (score <= 100) return iconDict["high"].replaceAll("--", tooltip);
  else return iconDict["confirmed"];
};

// File menu handling

const exportAudio = () => {
  let result;
  if (activeRegion.label) {
    setClickedIndex(activeRow);
    result = predictions[clickedIndex];
  }
  sendFile("save", result);
};

async function localiseModal(filename, locale) {
  try {
    // Fetch the HTML file
    if (["usage", "settings", "ebird"].includes(filename)) {
      filename = `Help/${filename}.${locale}.html`;
      const htmlResponse = await fetch(filename);
      if (!htmlResponse.ok)
        throw new Error(`Failed to load HTML file: ${filename}`);
      return await htmlResponse.text();
    }
    // Put the filename into its path:
    filename = `Help/${filename}.html`;
    const htmlResponse = await fetch(filename);
    if (!htmlResponse.ok)
      throw new Error(`Failed to load HTML file: ${filename}.html`);

    const htmlContent = await htmlResponse.text();

    // Try fetching the localisation JSON file
    let localisationData = {};
    try {
      // Fetch the localisation JSON file
      const basename = p.basename(filename, ".html");
      const jsonResponse = await fetch(
        p.join("I18n", `${basename}.${locale}.json`)
      );
      if (jsonResponse.ok) {
        localisationData = await jsonResponse.json();
      } else {
        console.warn(
          `JSON file not found: ${filename} parsed to ${locale}.json`
        );
        return htmlContent; // Return unmodified HTML if JSON not found
      }
    } catch (error) {
      console.warn(
        `Failed to fetch JSON file: ${filename} parsed to ${locale}.json`,
        error
      );
      return htmlContent; // Return unmodified HTML if JSON fetch fails
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");

    // Update elements in the parsed HTML
    for (const key in localisationData) {
      if (localisationData.hasOwnProperty(key)) {
        const element = doc.getElementById(key);
        if (element) {
          element.innerHTML = Array.isArray(localisationData[key])
            ? localisationData[key].join("<br>")
            : localisationData[key];
        }
      }
    }

    // Return the modified HTML content as a string
    return doc.documentElement.outerHTML;
  } catch (error) {
    console.error("Localisation Error:", error.message);
    return null; // Return null if there was an error
  }
}

const populateHelpModal = async (file, label) => {
  document.getElementById("helpModalLabel").textContent = label;
  let locale = config.locale;
  locale = STATE.translations.includes(locale) ? locale : "en";
  const response = await localiseModal(file, locale);
  document.getElementById("helpModalBody").innerHTML = response;
  const help = new bootstrap.Modal(document.getElementById("helpModal"));
  document.removeEventListener("show.bs.modal", replaceCtrlWithCommand);
  document.addEventListener("show.bs.modal", replaceCtrlWithCommand);
  help.show();
};

function _replaceTextInTitleAttributes() {
  // Select all elements with title attribute in the body of the web page
  const elementsWithTitle = document.querySelectorAll("[title]");

  // Iterate over each element with title attribute
  elementsWithTitle.forEach((element) => {
    // Replace 'Ctrl' with ⌘ in the title attribute value
    element.title = element.title.replaceAll("Ctrl", "⌘");
  });
}

function _replaceTextInTextNode(node) {
  node.nodeValue = node.nodeValue.replaceAll("Ctrl", "⌘");
}

function replaceCtrlWithCommand() {
  if (isMac) {
    // Select all text nodes in the body of the web page
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    const nodes = [];
    let node;

    // Iterate over each text node
    while ((node = walker.nextNode())) {
      nodes.push(node);
    }

    // Replace 'Ctrl' with ⌘ in each text node
    nodes.forEach((node) => _replaceTextInTextNode(node));

    // Replace 'Ctrl' with ⌘ in title attributes of elements
    _replaceTextInTitleAttributes();
  }
}

const populateSpeciesModal = async (included, excluded) => {
  const i18n = getI18n(i18nSpeciesList);
  const current_file_text =
    STATE.week !== -1 && STATE.week
      ? interpolate(i18n.week, { week: STATE.week })
      : "";
  const model = config.model === "birdnet" ? "BirdNET" : "Nocmig";
  const localBirdsOnly =
    config.local && config.model === "birdnet" && config.list === "nocturnal"
      ? i18n.localBirds
      : "";
  let species_filter_text = "",
    location_filter_text = "";
  if (config.list === "location") {
    const weekSpecific = config.useWeek ? i18n.weekSpecific : "";
    species_filter_text = interpolate(i18n.threshold, {
      weekSpecific: weekSpecific,
      speciesThreshold: config.speciesThreshold,
    });
    location_filter_text = interpolate(i18n.location, {
      place: place.textContent.replace("fmd_good", ""),
      current_file_text: current_file_text,
      species_filter_text: species_filter_text,
    });
  }
  const includedList = generateBirdIDList(included);
  const depending =
    config.useWeek &&
    config.list === "location" &&
    (STATE.week === -1 || !STATE.week)
      ? i18n.depending
      : "";
  const listLabel = getI18n(i18nLists)[config.list];
  const includedContent = interpolate(i18n.included, {
    model: model,
    listInUse: listLabel,
    location_filter_text: location_filter_text,
    localBirdsOnly: localBirdsOnly,
    upTo: i18n.upTo,
    count: included.length,
    depending: depending,
    includedList: includedList,
  });
  let excludedContent = "",
    disable = "";
  if (excluded) {
    const excludedList = generateBirdIDList(excluded);

    excludedContent = interpolate(i18n.excluded, {
      excludedList: excludedList,
      excludedCount: excluded.length,
      cname: i18n.cname,
      sname: i18n.sname,
    });
  } else {
    disable = " disabled";
  }
  let modalContent = `
        <ul class="nav nav-tabs" id="myTab" role="tablist">
        <li class="nav-item" role="presentation">
        <button class="nav-link active" id="included-tab" data-bs-toggle="tab" data-bs-target="#included-tab-pane" type="button" role="tab" aria-controls="included-tab-pane" aria-selected="true">${i18n.includedButton}</button>
        </li>
        <li class="nav-item" role="presentation">
        <button class="nav-link" id="excluded-tab" data-bs-toggle="tab" data-bs-target="#excluded-tab-pane" type="button" role="tab" aria-controls="excluded-tab-pane" aria-selected="false" ${disable}>${i18n.excludedButton}</button>
        </li>
        </ul>
        <div class="tab-content" id="myTabContent">
        <div class="tab-pane fade show active" id="included-tab-pane" role="tabpanel" aria-labelledby="included-tab" tabindex="0" style="max-height: 50vh;overflow: auto">${includedContent}</div>
        <div class="tab-pane fade" id="excluded-tab-pane" role="tabpanel" aria-labelledby="excluded-tab" tabindex="0" style="max-height: 50vh;overflow: auto">${excludedContent}</div>
        </div>
        `;
  document.getElementById("speciesModalBody").innerHTML = modalContent;
  document.getElementById("speciesModalLabel").textContent = i18n.title;
  const species = new bootstrap.Modal(document.getElementById("speciesModal"));
  species.show();
  STATE.includedList = included;
};

// exporting a list
function exportSpeciesList() {
  const included = STATE.includedList;
  // Create a blob containing the content of included array
  const content = included
    .map((item) => `${item.sname}_${item.cname}`)
    .join("\n");
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
  const i18n = getI18n(i18nTitles);
  if (on) {
    DOM.nocmigButton.textContent = "nights_stay";
    DOM.nocmigButton.title = i18n.nocmigOn;
    DOM.nocmigButton.classList.add("text-info");
  } else {
    DOM.nocmigButton.textContent = "bedtime_off";
    DOM.nocmigButton.title = i18n.nocmigOff;
    DOM.nocmigButton.classList.remove("text-info");
  }
  DOM.nocmig.checked = config.detect.nocmig;
}

const changeNocmigMode = () => {
  config.detect.nocmig = !config.detect.nocmig;
  setNocmig(config.detect.nocmig);
  worker.postMessage({
    action: "update-state",
    detect: { nocmig: config.detect.nocmig },
    globalOffset: 0,
    filteredOffset: {},
  });
  updatePrefs("config.json", config);
  if (STATE.analysisDone) {
    resetResults({
      clearSummary: false,
      clearPagination: true,
      clearResults: false,
    });
    filterResults();
  }
};

function filterResults({
  species = isSpeciesViewFiltered(true),
  updateSummary = true,
  offset = undefined,
  limit = 500,
  range = undefined,
} = {}) {
  STATE.analysisDone &&
    worker.postMessage({
      action: "filter",
      species,
      updateSummary,
      offset,
      limit,
      range
    });
}

const modelSettingsDisplay = () => {
  // Sets system options according to model or machine cababilities
  // cf. setListUIState
  const chirpityOnly = document.querySelectorAll(
    ".chirpity-only, .chirpity-only-visible"
  );
  const noMac = document.querySelectorAll(".no-mac");
  const nodeOnly = document.querySelectorAll(".node-only");
  if (config.model === "birdnet") {
    // hide chirpity-only features
    chirpityOnly.forEach((element) => {
      // element.classList.add('chirpity-only');
      element.classList.replace("chirpity-only-visible", "chirpity-only");
    });
    DOM.contextAware.checked = false;
    DOM.contextAware.disabed = true;
    config.detect.contextAware = false;
    DOM.contextAwareIcon.classList.add("d-none");

    // SNRSlider.disabled = true;
    // config.filters.SNR = 0;
  } else {
    // show chirpity-only features
    chirpityOnly.forEach((element) => {
      element.classList.replace("chirpity-only", "chirpity-only-visible");
    });
    // Remove GPU option on Mac
    isMac && noMac.forEach((element) => element.classList.add("d-none"));
    DOM.contextAware.checked = config.detect.contextAware;
    DOM.contextAwareIcon.classList.remove("d-none");
    // SNRSlider.disabled = false;
    if (config.hasNode) {
      nodeOnly.forEach((element) => element.classList.remove("d-none"));
    } else {
      nodeOnly.forEach((element) => element.classList.add("d-none"));
    }
  }
};

const contextAwareIconDisplay = () => {
  const i18n = getI18n(i18nTitles);
  if (config.detect.contextAware) {
    DOM.contextAwareIcon.classList.add("text-warning");
    DOM.contextAwareIcon.title = i18n.contextModeOn;
  } else {
    DOM.contextAwareIcon.classList.remove("text-warning");
    DOM.contextAwareIcon.title = i18n.contextModeOff;
  }
};

const toggleFilters = () => {
  config.filters.active = !config.filters.active;
  worker.postMessage({
    action: "update-state",
    filters: { active: config.filters.active },
  });
  updatePrefs("config.json", config);
  showFilterEffect();
  filterIconDisplay();
};

const toggleContextAwareMode = () => {
  if (PREDICTING) {
    generateToast({ message: "contextBlocked", type: "warning" });
    return;
  }
  if (config.model !== "birdnet")
    config.detect.contextAware = !config.detect.contextAware;
  DOM.contextAware.checked = config.detect.contextAware;
  contextAwareIconDisplay();
  // if (config.detect.contextAware) {
  //     SNRSlider.disabled = true;
  //     config.filters.SNR = 0;
  // } else if (config[config.model].backend !== 'webgl'  && config.model !== 'birdnet') {
  //     SNRSlider.disabled = false;
  //     config.filters.SNR = parseFloat(SNRSlider.value);
  // }
  worker.postMessage({
    action: "update-state",
    detect: { contextAware: config.detect.contextAware },
    filters: { SNR: config.filters.SNR },
  });
  updatePrefs("config.json", config);
};

const diagnosticMenu = document.getElementById("diagnostics");
diagnosticMenu.addEventListener("click", async function () {
  DIAGNOSTICS["Model"] =
    DOM.modelToUse.options[DOM.modelToUse.selectedIndex].text;
  DIAGNOSTICS["Backend"] = config[config.model].backend;
  DIAGNOSTICS["Batch size"] = config[config[config.model].backend].batchSize;
  DIAGNOSTICS["Threads"] = config[config[config.model].backend].threads;
  DIAGNOSTICS["Context"] = config.detect.contextAware;
  DIAGNOSTICS["SNR"] = config.filters.SNR;
  DIAGNOSTICS["List"] = config.list;
  let diagnosticTable = "<table class='table-hover table-striped p-2 w-100'>";
  for (let [key, value] of Object.entries(DIAGNOSTICS)) {
    if (key === "Audio Duration") {
      // Format duration as days, hours,minutes, etc.
      value = formatDuration(value);
    }
    if (key === "UUID") {
      diagnosticTable += `<tr><th scope="row">${key}</th><td id="uuid">${value} 
                    <span id ="copy-uuid" data-bs-toggle="tooltip" data-bs-placement="right" title="Copy to clipboard" 
                    class="material-symbols-outlined text-secondary"> content_copy</span></td></tr>`;
    } else {
      diagnosticTable += `<tr><th scope="row">${key}</th><td>${value}</td></tr>`;
    }
  }
  diagnosticTable += "</table>";
  document.getElementById("diagnosticsModalBody").innerHTML = diagnosticTable;
  const testModal = new bootstrap.Modal(
    document.getElementById("diagnosticsModal")
  );
  testModal.show();
});

/**
 * Updates the sorting indicators and UI elements for the result filters based on the current global state.
 *
 * Clones and replaces header elements to reflect active sort orders: toggles visibility of time-related sort icons
 * when the score-based sort is active, applies pointer styles to sort elements, and manages the flipped state based on
 * ascending or descending order for species and metadata sorting. Also, clones and updates summary elements with hover
 * effects to enhance interactivity.
 *
 * Global State Dependencies:
 * - STATE.resultsSortOrder: Determines if results are sorted by score and whether the sort is in ascending order.
 * - STATE.resultsMetaSortOrder: Specifies the currently active metadata sort and direction.
 * - DOM.resultHeader: The header element that is cloned and replaced for visual update.
 * - DOM.summaryTable: The table whose species summary elements receive pointer styling.
 *
 * @returns {void}
 */
function activateResultSort() {
  // Clone the result header and work on it in the fragment
  const resultHeaderClone = DOM.resultHeader.cloneNode(true);

  const timeHeadings = resultHeaderClone.getElementsByClassName("time-sort-icon");
  const speciesHeadings = resultHeaderClone.getElementsByClassName("species-sort-icon");
  const sortOrderScore = STATE.resultsSortOrder.includes("score");
  const fragment = document.createDocumentFragment();
  // if (STATE.resultsMetaSortOrder){
  const state = STATE.resultsMetaSortOrder;
  const sortOrderMeta = state.replace(' ASC ', '').replace(' DESC ', '');
  const metaHeadings = resultHeaderClone.getElementsByClassName("meta-sort-icon");
  [...metaHeadings].forEach((heading) => {
    const hideIcon = state === '' || !heading.parentNode.id.includes(sortOrderMeta);
    heading.classList.toggle("d-none", hideIcon);
    if (state.includes("ASC")){
      heading.classList.add("flipped");
    } else {
      heading.classList.remove("flipped");
    }
  });
  // }


  // Update time sort icons
  [...timeHeadings].forEach((heading) => {
    heading.classList.toggle("d-none", sortOrderScore);
    heading.parentNode.classList.add("pointer");
  });

  // Update species sort icons
  [...speciesHeadings].forEach((heading) => {
    heading.classList.toggle("d-none", !sortOrderScore);
    heading.parentNode.classList.add("pointer");
    if (sortOrderScore && STATE.resultsSortOrder.includes("ASC")) {
      heading.classList.add("flipped");
    } else {
      heading.classList.remove("flipped");
    }
  });

  // Update the cloned result header's classes
  resultHeaderClone.classList.replace("text-bg-secondary", "text-bg-dark");
  fragment.appendChild(resultHeaderClone);



  // Replace the old header with the updated one
  DOM.resultHeader.replaceWith(resultHeaderClone);

  showSummarySortIcon();
}

/**
 * Update the sort icon in the summary table to reflect the current sort order.
 *
 * Extracts the sort column and direction from the STATE.summarySortOrder string (formatted as "column direction"),
 * determines the corresponding icon element by constructing its ID ("summary-{column}-icon"),
 * and then hides all sort icons in the summary table before displaying the relevant icon.
 * The icon is styled with the "flipped" class when the sort direction is "ASC", and without it for other directions.
 *
 * @example
 * // If STATE.summarySortOrder is "duration ASC", then the sort icon for "duration" will be shown with the "flipped" class.
 * showSummarySortIcon();
 */
function showSummarySortIcon() {
  let [column, direction] = STATE.summarySortOrder.split(" ");
  // column = column === "sname" ? "cname" : column;
  const iconId = `summary-${column}-icon`;
  const targetIcon = document.getElementById(iconId);
  if (targetIcon) {
    // Hide all sort icons
    DOM.summaryTable.querySelectorAll(".summary-sort-icon").forEach((icon) => {
      icon.classList.add("d-none");
    });
    direction === "ASC"
      ? targetIcon.classList.add("flipped")
      : targetIcon.classList.remove("flipped");
    targetIcon.classList.remove("d-none");
  }
}

const setSortOrder = (field, order) => {
  STATE[field] = order;
  worker.postMessage({ action: "update-state", [field]: order });
  // resetResults({clearSummary: false, clearPagination: false, clearResults: true});
  filterResults();
};

const setSummarySortOrder = (order) => {
  STATE.summarySortOrder = order;
  worker.postMessage({ action: "update-state", summarySortOrder: order });
  refreshSummary()
};


// Drag file to app window to open
document.addEventListener("dragover", (event) => {
  event.preventDefault();
});

document.addEventListener("drop", (event) => {
  event.preventDefault();
  event.stopPropagation();
  const filelist = Array.from(event.dataTransfer.files)
    .filter(
      (file) =>
        !file.name.startsWith(".") &&
        (!file.type ||
          file.type.startsWith("audio/") ||
          file.type.startsWith("video/"))
    )
    .map((file) => file.path);

  // For electron 32+
  // const filelist = audioFiles.map(file => window.electron.showFilePath(file));
  if (filelist.length) filterValidFiles({ filePaths: filelist });
});

// Prevent drag for UI elements
document.body.addEventListener("dragstart", (e) => {
  e.preventDefault();
});

// Make modals draggable
document.querySelectorAll(".modal-header").forEach((header) => {
  header.removeEventListener("mousedown", makeDraggable);
  makeDraggable(header);
});

function makeDraggable(header) {
  header.addEventListener("mousedown", function (mousedownEvt) {
    const draggable = this;
    const modalContent = draggable.closest(".modal-content");
    const initialLeft = parseFloat(getComputedStyle(modalContent).left);
    const initialTop = parseFloat(getComputedStyle(modalContent).top);
    const x = mousedownEvt.pageX - initialLeft,
      y = mousedownEvt.pageY - initialTop;

    function handleDrag(moveEvt) {
      draggable.closest(".modal-content").style.left = moveEvt.pageX - x + "px";
      draggable.closest(".modal-content").style.top = moveEvt.pageY - y + "px";
    }

    function stopDrag() {
      document.body.removeEventListener("mousemove", handleDrag);
      document.body.removeEventListener("mouseup", stopDrag);
      draggable
        .closest(".modal")
        .removeEventListener("hide.bs.modal", stopDrag);
    }

    document.body.addEventListener("mousemove", handleDrag);
    document.body.addEventListener("mouseup", stopDrag);
    draggable.closest(".modal").addEventListener("hide.bs.modal", stopDrag);
  });
}
////////// Date Picker ///////////////

function initialiseDatePicker() {
  if (STATE.picker) {
    STATE.picker.destroy();
    delete STATE.picker;
  }
  const currentDate = new Date();

  const thisYear = () => {
    const d1 = new Date(currentDate.getFullYear(), 0, 1);
    return [d1, currentDate];
  };
  const lastYear = () => {
    const d1 = new Date(currentDate.getFullYear() - 1, 0, 1);
    const d2 = new Date(currentDate.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    return [d1, d2];
  };
  const thisMonth = () => {
    const startOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    return [startOfMonth, currentDate];
  };

  const lastMonth = () => {
    const startOfLastMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() - 1,
      1
    );
    const endOfLastMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      0,
      23,
      59,
      59,
      999
    );

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
    middayYesterday.setDate(currentDate.getDate() - 1);
    middayYesterday.setHours(12, 0, 0, 0); // Set to midday yesterday
    const middayToday = new Date(currentDate);
    middayToday.setHours(12, 0, 0, 0); // Set to midday today
    return [middayYesterday, middayToday];
  };
  ["chartRange", "exploreRange"].forEach(function (element) {
    const i18n = getI18n(i18nContext);
    element = document.getElementById(element);
    STATE.picker = new easepick.create({
      element: element,
      lang: config.locale.replace(/_.*$/, ""),
      locale: {
        cancel: i18n.cancel,
        apply: i18n.apply,
      },
      css: ["./node_modules/@easepick/bundle/dist/index.css"],
      format: "H:mm MMM D, YYYY",
      zIndex: 10,
      calendars: 1,
      autoApply: false,
      plugins: ["RangePlugin", "PresetPlugin", "TimePlugin"],
      PresetPlugin: {
        customPreset: {
          [i18n.lastNight]: lastNight(),
          [i18n.thisWeek]: thisWeek(),
          [i18n.lastWeek]: lastWeek(),
          [i18n.thisMonth]: thisMonth(),
          [i18n.lastMonth]: lastMonth(),
          [i18n.thisYear]: thisYear(),
          [i18n.lastYear]: lastYear()
        },
      },
      TimePlugin: {
        format: "HH:mm",
      },
    });
    const picker = STATE.picker;
    picker.on("select", (e) => {
      const { start, end } = e.detail;
      console.log("Range Selected!", JSON.stringify(e.detail));
      if (element.id === "chartRange") {
        STATE.chart.range = { start: start.getTime(), end: end.getTime() };
        worker.postMessage({ action: "update-state", chart: STATE.chart });
        t0 = Date.now();
        worker.postMessage({
          action: "chart",
          species: STATE.chart.species,
          range: STATE.chart.range,
          aggregation: STATE.chart.aggregation,
        });
      } else if (element.id === "exploreRange") {
        STATE.explore.range = { start: start.getTime(), end: end.getTime() };
        resetResults({
          clearSummary: true,
          clearPagination: true,
          clearResults: false,
        });
        worker.postMessage({
          action: "update-state",
          globalOffset: 0,
          filteredOffset: {},
          explore: STATE.explore,
        });
        filterResults({ range: STATE.explore.range });
      }

      // Update the seen species list
      worker.postMessage({ action: "get-detected-species-list" });
    });
    picker.on("clear", (e) => {
      console.log("Range Cleared!", JSON.stringify(e.detail));
      if (element.id === "chartRange") {
        STATE.chart.range = { start: undefined, end: undefined };
        worker.postMessage({ action: "update-state", chart: STATE.chart });
        t0 = Date.now();
        worker.postMessage({
          action: "chart",
          species: STATE.chart.species,
          range: STATE.chart.range,
          aggregation: STATE.chart.aggregation,
        });
      } else if (element.id === "exploreRange") {
        STATE.explore.range = { start: undefined, end: undefined };
        worker.postMessage({
          action: "update-state",
          globalOffset: 0,
          filteredOffset: {},
          explore: STATE.explore,
        });
        resetResults({
          clearSummary: true,
          clearPagination: true,
          clearResults: false,
        });
        filterResults({
          species: STATE.explore.species,
          range: STATE.explore.range,
        });
      }
    });
    picker.on("click", (e) => {
      if (e.target.classList.contains("cancel-button")) {
        console.log("cancelled");
        //element.innerHTML = savedContent;
      }
    });
    picker.on("show", () => {
      picker.setStartTime("12:00");
      picker.setEndTime("12:00");
    });
    picker.on("hide", () => {
      const id = STATE.mode === "chart" ? "chartRange" : "exploreRange";
      const element = document.getElementById(id);
      if (!element.textContent) {
        // It's blank
        element.innerHTML = `<span class="material-symbols-outlined align-bottom">date_range</span><span>${STATE.i18n["explore-datefilter"]}</span> <span class="material-symbols-outlined float-end">expand_more</span>`;
      } else if (
        !element.textContent.includes(STATE.i18n["explore-datefilter"])
      ) {
        createDateClearButton(element, picker);
      }
    });
  });
}

/**
 * Appends a clear date filter button to the specified UI element.
 *
 * The function creates a clickable span styled as a "cancel" icon that, when activated,
 * clears the date selection using the provided picker instance. Upon clicking the button,
 * the date picker is cleared and the original date filter UI is restored in the element.
 *
 * @param {HTMLElement} element - The container element that displays the date filter.
 * @param {Object} picker - The date picker instance with a clear() method to remove the active date filter.
 *
 * @example
 * // Assuming dateFilterElement is a valid HTMLElement and datePicker is a date picker instance:
 * createDateClearButton(dateFilterElement, datePicker);
 */
function createDateClearButton(element, picker) {
  const span = document.createElement("span");
  span.classList.add("material-symbols-outlined", "text-secondary", "ps-2");
  element.appendChild(span);
  span.textContent = "cancel";
  span.title = "Clear date filter";
  span.id = element.id + "-clear";
  span.addEventListener("click", (e) => {
    e.stopImmediatePropagation();
    picker.clear();
    element.innerHTML = `<span class="material-symbols-outlined align-bottom">date_range</span><span>${STATE.i18n["explore-datefilter"]}</span> <span class="material-symbols-outlined float-end">expand_more</span>`;
  });
}

document.addEventListener("DOMContentLoaded", function () {
  document.addEventListener("keydown", handleKeyDownDeBounce, true);
  // make menu an accordion for smaller screens
  if (window.innerWidth < 768) {
    // close all inner dropdowns when parent is closed
    document
      .querySelectorAll(".navbar .dropdown")
      .forEach(function (everydropdown) {
        everydropdown.addEventListener("hidden.bs.dropdown", function () {
          // after dropdown is hidden, then find all submenus
          this.querySelectorAll(".submenu").forEach(function (everysubmenu) {
            // hide every submenu as well
            everysubmenu.style.display = "none";
          });
        });
      });

    document.querySelectorAll(".dropdown-menu a").forEach(function (element) {
      element.addEventListener("click", function (e) {
        let nextEl = this.nextElementSibling;
        if (nextEl?.classList.contains("submenu")) {
          // prevent opening link if link needs to open dropdown
          e.preventDefault();
          if (nextEl.style.display === "block") {
            nextEl.style.display = "none";
          } else {
            nextEl.style.display = "block";
          }
        }
      });
    });
  }
  const divider = document.getElementById("divider");
  const summary = document.getElementById("summary");
  const resultsDiv = document.getElementById("resultsDiv");

  let isResizing = false;

  divider.addEventListener("mousedown", function (e) {
    isResizing = true;
    document.body.style.cursor = "col-resize";
  });

  document.addEventListener("mousemove", function (e) {
    if (!isResizing) return;

    const containerRect = document
      .getElementById("resultTableContainer")
      .getBoundingClientRect();
    const newSummaryWidth = e.clientX - containerRect.left;
    const newResultsWidth = containerRect.right - e.clientX;

    if (newSummaryWidth > 50 && newResultsWidth > 50) {
      // Minimum width for both divs
      summary.style.width = newSummaryWidth + "px";
      resultsDiv.style.width = newResultsWidth + "px";
    }
  });

  document.addEventListener("mouseup", function () {
    isResizing = false;
    document.body.style.cursor = "default";
  });
});

// Confidence thresholds
const filterPanelThresholdDisplay = document.getElementById("threshold-value"); // confidence % display in panel
const settingsPanelThresholdDisplay =
  document.getElementById("confidence-value"); // confidence % display in settings
const confidenceSliderDisplay = document.getElementById(
  "confidenceSliderContainer"
); // confidence span for slider in panel - show-hide
const filterPanelRangeInput = document.getElementById("confidenceValue"); // panel range input
const settingsPanelRangeInput = document.getElementById("confidence"); // confidence range input in settings

filterPanelThresholdDisplay.addEventListener("click", (e) => {
  e.stopPropagation();
  filterPanelRangeInput.autofocus = true;
  confidenceSliderDisplay.classList.toggle("d-none");
});
filterPanelRangeInput.addEventListener("click", (e) => {
  e.stopPropagation();
});

const hideConfidenceSlider = () => {
  confidenceSliderDisplay.classList.add("d-none");
};

function showThreshold(e) {
  const threshold = e instanceof Event ? e.target.valueAsNumber : e;
  filterPanelThresholdDisplay.innerHTML = `<b>${threshold}%</b>`;
  settingsPanelThresholdDisplay.innerHTML = `<b>${threshold}%</b>`;
  filterPanelRangeInput.value = threshold;
  settingsPanelRangeInput.value = threshold;
}
settingsPanelRangeInput.addEventListener("input", showThreshold);
filterPanelRangeInput.addEventListener("input", showThreshold);

const handleThresholdChange = (e) => {
  const threshold = e.target.valueAsNumber;
  config.detect.confidence = threshold;
  updatePrefs("config.json", config);
  worker.postMessage({
    action: "update-state",
    detect: { confidence: config.detect.confidence },
  });
  if (STATE.mode === "explore") {
    // Update the seen species list
    worker.postMessage({ action: "get-detected-species-list" });
  }
  if (!PREDICTING && !DOM.resultTableElement.classList.contains("d-none")) {
    worker.postMessage({
      action: "update-state",
      globalOffset: 0,
      filteredOffset: {},
    });
    resetResults({
      clearSummary: false,
      clearPagination: true,
      clearResults: false,
    });
    filterResults();
  }
};

// Filter handling
const filterIconDisplay = () => {
  const i18n = getI18n(i18nTitles);
  if (
    config.filters.active &&
    (config.filters.highPassFrequency ||
      (config.filters.lowShelfAttenuation &&
        config.filters.lowShelfFrequency) ||
      config.filters.normalise)
  ) {
    DOM.audioFiltersIcon.classList.add("text-warning");
    DOM.audioFiltersIcon.title = i18n.audioFiltersOn;
  } else {
    DOM.audioFiltersIcon.classList.remove("text-warning");
    DOM.audioFiltersIcon.title = i18n.audioFiltersOff;
  }
};
// High pass threshold
const showFilterEffect = () => {
  if (fileLoaded) {
    const position = clamp(wavesurfer.getCurrentTime() / windowLength, 0, 1);
    postBufferUpdate({
      begin: windowOffsetSecs,
      position: position
    });
  }
};

// SNR
// const handleSNRchange = () => {
//     config.filters.SNR = parseFloat(SNRSlider.value);
//     if (config.filters.SNR > 0) {
//         config.detect.contextAware = false;
//         DOM.contextAware.disabled = true;
//     } else {
//         config.detect.contextAware = DOM.contextAware.checked;
//         DOM.contextAware.disabled = false;
//     }
//     worker.postMessage({ action: 'update-state', filters: { SNR: config.filters.SNR } })
//     filterIconDisplay();
// }

// const SNRThreshold = document.getElementById('SNR-threshold');
// // const SNRSlider = document.getElementById('snrValue');
// SNRSlider.addEventListener('input', () => {
//     SNRThreshold.textContent = SNRSlider.value;
// });

const colorMapThreshold = document.getElementById("color-threshold");
const colorMapSlider = document.getElementById("color-threshold-slider");
colorMapSlider.addEventListener("input", () => {
  colorMapThreshold.textContent = colorMapSlider.value;
});

// Gauss Alpha
const alphaValue = document.getElementById("alpha-value");
const alphaSlider = document.getElementById("alpha-slider");
alphaSlider.addEventListener("input", () => {
  alphaValue.textContent = alphaSlider.value;
});

const handleHPchange = () => {
  config.filters.highPassFrequency = HPSlider.valueAsNumber;
  config.filters.active || toggleFilters();
  worker.postMessage({
    action: "update-state",
    filters: { highPassFrequency: config.filters.highPassFrequency },
  });
  showFilterEffect();
  filterIconDisplay();
  HPSlider.blur(); // Fix slider capturing thefocus so you can't use spaceBar or hit 'p' directly
};

const HPThreshold = document.getElementById("HP-threshold");
const HPSlider = document.getElementById("HighPassFrequency");
HPSlider.addEventListener("input", () => {
  HPThreshold.textContent = HPSlider.value + "Hz";
});

// Low shelf threshold
const handleLowShelfchange = () => {
  config.filters.lowShelfFrequency = LowShelfSlider.valueAsNumber;
  config.filters.active || toggleFilters();
  worker.postMessage({
    action: "update-state",
    filters: { lowShelfFrequency: config.filters.lowShelfFrequency },
  });
  showFilterEffect();
  filterIconDisplay();
  LowShelfSlider.blur(); // Fix slider capturing thefocus so you can't use spaceBar or hit 'p' directly
};

const LowShelfThreshold = document.getElementById("LowShelf-threshold");
const LowShelfSlider = document.getElementById("lowShelfFrequency");
LowShelfSlider.addEventListener("input", () => {
  LowShelfThreshold.textContent = LowShelfSlider.value + "Hz";
});

// Low shelf gain
const handleAttenuationchange = () => {
  config.filters.lowShelfAttenuation = -lowShelfAttenuation.valueAsNumber;
  config.filters.active = true;
  worker.postMessage({
    action: "update-state",
    filters: { lowShelfAttenuation: config.filters.lowShelfAttenuation },
  });
  showFilterEffect();
  filterIconDisplay();
  lowShelfAttenuation.blur();
};

const lowShelfAttenuation = document.getElementById("attenuation");
const lowShelfAttenuationThreshold = document.getElementById(
  "attenuation-threshold"
);

lowShelfAttenuation.addEventListener("input", () => {
  lowShelfAttenuationThreshold.textContent = lowShelfAttenuation.value + "dB";
});

// Show batch size / threads as user moves slider
DOM.batchSizeSlider.addEventListener("input", () => {
  DOM.batchSizeValue.textContent = BATCH_SIZE_LIST[DOM.batchSizeSlider.value];
});

DOM.threadSlider.addEventListener("input", () => {
  DOM.numberOfThreads.textContent = DOM.threadSlider.value;
});

DOM.gain.addEventListener("input", () => {
  DOM.gainAdjustment.textContent = DOM.gain.value + "dB";
});

/**
 * Plays the active audio region after sanitizing its boundaries.
 *
 * This function locates the active region from the global REGIONS object by matching the 
 * region's start time with the global activeRegion. It then adjusts the region's start and 
 * end times to ensure they fall within the valid playback window—ensuring the start is not 
 * negative and the end does not exceed 99.5% of the windowLength to avoid triggering a finish 
 * event that causes a page reload. Note that if playback is paused at the end of an adjacent region, 
 * the subsequent region may not play.
 *
 * Side Effects:
 * - Modifies the region's start and end properties for playback.
 * - Initiates playback by calling the region's play() method.
 *
 * Global Dependencies:
 * - REGIONS: An object containing all audio regions.
 * - activeRegion: The currently active region used for matching.
 * - windowLength: A number representing the maximum playback window length.
 *
 * @returns {void}
 */
function playRegion() {
  // Sanitise region (after zoom, start or end may be outside the windowlength)
  // I don't want to change the actual region length, so make a copy
  const region = REGIONS.regions?.find(
    (region) => region.start === activeRegion.start
  );
  if (region){
    const myRegion = region;
    myRegion.start = Math.max(0, myRegion.start);
    // Have to adjust the windowlength so the finish event isn't fired - causing a page reload)
    myRegion.end = Math.min(myRegion.end, windowLength * 0.995);
    /* ISSUE if you pause at the end of a region, 
      when 2 regions abut, the second region won't play*/
      REGIONS.once('region-out', () => wavesurfer.pause());
    myRegion.play();
  }
}
// Audio preferences:

const showRelevantAudioQuality = () => {
  if (["mp3", "opus", "aac"].includes(config.audio.format)) {
    DOM.audioBitrateContainer.classList.remove("d-none");
    DOM.audioQualityContainer.classList.add("d-none");
  } else if (config.audio.format === "flac") {
    DOM.audioQualityContainer.classList.remove("d-none");
    DOM.audioBitrateContainer.classList.add("d-none");
  } else {
    DOM.audioQualityContainer.classList.add("d-none");
    DOM.audioBitrateContainer.classList.add("d-none");
  }
};

document.addEventListener("click", function (e) {
  const element = e.target;
  const target = element.closest("[id]")?.id;
  const locale = config.locale.replace(/_.*$/, "");
  switch (target) {
    // File menu
    case "open-file": {
      showOpenDialog("openFile");
      break;
    }
    case "open-folder": {
      showOpenDialog("openDirectory");
      break;
    }
    case "saveLabels": {
      exportAudacity();
      break;
    }
    case "saveCSV": {
      export2CSV();
      break;
    }
    case "save-eBird": {
      exporteBird();
      break;
    }
    case "save-Raven": {
      exportRaven();
      break;
    }
    case "export-audio": {
      exportAudio();
      break;
    }
    case "exit": {
      exitApplication();
      break;
    }

    case "dataset": {
      worker.postMessage({
        action: "create-dataset",
        species: isSpeciesViewFiltered(true),
      });
      break;
    }

    // Records menu
    case "save2db": {
      worker.postMessage({ action: "save2db", file: STATE.currentFile });
      if (config.archive.auto)
        document.getElementById("compress-and-organise").click();
      break;
    }
    case "charts": {
      showCharts();
      break;
    }
    case "explore": {
      showExplore();
      break;
    }
    case "active-analysis": {
      showAnalyse();
      break;
    }
    case "compress-and-organise": {
      compressAndOrganise();
      break;
    }
    case "purge-file": {
      deleteFile(STATE.currentFile);
      break;
    }

    //Analyse menu
    case "analyse": {
      postAnalyseMessage({ filesInScope: [STATE.currentFile] });
      break;
    }
    case "analyseSelection": {
      getSelectionResults();
      break;
    }
    case "analyseAll": {
      postAnalyseMessage({ filesInScope: STATE.openFiles });
      break;
    }
    case "reanalyse": {
      postAnalyseMessage({
        filesInScope: [STATE.currentFile],
        reanalyse: true,
      });
      break;
    }
    case "reanalyseAll": {
      postAnalyseMessage({ filesInScope: STATE.openFiles, reanalyse: true });
      break;
    }

    case "purge-from-toast": {
      deleteFile(MISSING_FILE);
      break;
    }

    // ----
    case "locate-missing-file": {
      (async () => await locateFile(MISSING_FILE))();
      break;
    }
    case "clear-custom-list": {
      config.customListFile[config.model] = "";
      delete LIST_MAP.custom;
      config.list = "birds";
      DOM.listToUse.value = config.list;
      DOM.customListFile.value = "";
      updateListIcon();
      updatePrefs("config.json", config);
      resetResults({
        clearSummary: true,
        clearPagination: true,
        clearResults: true,
      });
      setListUIState(config.list);
      if (STATE.currentFile) updateList();
      break;
    }
    // Help Menu
    case "keyboardHelp": {
      (async () =>
        await populateHelpModal("keyboard", i18nHelp.keyboard[locale]))();
      break;
    }
    case "settingsHelp": {
      (async () =>
        await populateHelpModal("settings", i18nHelp.settings[locale]))();
      break;
    }
    case "usage": {
      (async () => await populateHelpModal("usage", i18nHelp.usage[locale]))();
      break;
    }
    case "community": {
      (async () =>
        await populateHelpModal("community", i18nHelp.community[locale]))();
      break;
    }
    case "known-issues": {
      const version = VERSION.replace(' (Portable)', '')
      fetchIssuesByLabel(["v" + version, "All versions affected"])
        .then((issues) => renderIssuesInModal(issues, version))
        .catch((error) => console.error("Error getting known issues:", error));
      break;
    }
    case "show-species":
    case "species": {
      worker.postMessage({
        action: "get-valid-species",
        file: STATE.currentFile,
      });
      break;
    }
    case "startTour": {
      prepTour();
      break;
    }
    case "eBird": {
      (async () => await populateHelpModal("ebird", i18nHelp.eBird[locale]))();
      break;
    }
    case "copy-uuid": {
      // Get the value from the input element
      const copyText = document
        .getElementById("uuid")
        .textContent.split("\n")[0];
      // Use the clipboard API to copy text
      navigator.clipboard
        .writeText(copyText)
        .then(function () {
          // Show a message once copied
          DOM.tooltipInstance.setContent({ ".tooltip-inner": "Copied!" });
          DOM.tooltipInstance.show();
          // Reset the tooltip text to default after 2 seconds
          setTimeout(function () {
            DOM.tooltipInstance.hide();
            DOM.tooltipInstance.setContent({
              ".tooltip-inner": "Click to Copy",
            });
          }, 2000);
        })
        .catch((error) => console.warn(error));
      break;
    }

    // Settings
    case "basic":
    case "advanced": {
      changeSettingsMode(target);
      break;
    }

    // Context-menu
    case "play-region": {
      playRegion();
      break;
    }
    case "context-analyse-selection": {
      getSelectionResults();
      break;
    }
    case "context-create-clip": {
      element.closest("#inSummary") ? batchExportAudio() : exportAudio();
      break;
    }
    // XC compare play/pause
    case "playComparison": {
      ws.playPause();
      break;
    }

    // --- Backends
    case "tensorflow":
    case "webgl":
    case "webgpu": {
      handleBackendChange(target);
      break;
    }

    case "archive-location-select": {
      (async () => {
        const files = await window.electron.selectDirectory(
            config.archive.location || ''
        );
        if (!files.canceled) {
          const archiveFolder = files.filePaths[0];
          config.archive.location = archiveFolder;
          DOM.exploreLink.classList.contains("disabled") ||
            document
              .getElementById("compress-and-organise")
              .classList.remove("disabled");
          document.getElementById("archive-location").value = archiveFolder;
          updatePrefs("config.json", config);
          worker.postMessage({
            action: "update-state",
            archive: config.archive,
          });
        }
      })();
      break;
    }
    case "export-list": {
      exportSpeciesList();
      break;
    }
    case "sort-label":
    case "sort-comment":
    case "sort-reviewed": {
      if (!PREDICTING) {
        const sort = target.slice(5);
        const state = STATE.resultsMetaSortOrder;
        // If no sort is set or the sort column is different, start with DESC.
        if (!state || !state.startsWith(sort)) {
          STATE.resultsMetaSortOrder = `${sort} DESC `;
        } else if (state === `${sort} DESC `) {
          // Second click: switch from DESC to ASC.
          STATE.resultsMetaSortOrder = `${sort} ASC `;
        } else if (state === `${sort} ASC `) {
          // Third click: reset sort order.
          STATE.resultsMetaSortOrder = '';
        }
      }
      setSortOrder("resultsMetaSortOrder", STATE.resultsMetaSortOrder);
      break;
    }

    case "sort-position":
    case "sort-time": {
      if (!PREDICTING) {
        STATE.resultsSortOrder === "timestamp" || setSortOrder("resultsSortOrder", "timestamp");
      }
      break;
    }
    case "confidence-sort": {
      if (!PREDICTING) {
        const sortBy =
          STATE.resultsSortOrder === "score DESC "
            ? "score ASC "
            : "score DESC ";
            setSortOrder("resultsSortOrder", sortBy);
      }
      break;
    }
    case "summary-max": {
      const sortBy =
        STATE.summarySortOrder === "max DESC " ? "max ASC " : "max DESC ";
      setSummarySortOrder(sortBy);
      break;
    }
    case "summary-cname": {
      const sortOptions = ["cname ASC", "cname DESC", "sname ASC", "sname DESC"];
      const currentIndex = sortOptions.indexOf(STATE.summarySortOrder);
      const nextIndex = (currentIndex + 1) % sortOptions.length;
      const sortBy = sortOptions[nextIndex];
      setSummarySortOrder(sortBy);
      break;
    }
    case "summary-count": {
      const sortBy =
        STATE.summarySortOrder === "count DESC " ? "count ASC " : "count DESC ";
      setSummarySortOrder(sortBy);
      break;
    }
    case "summary-calls": {
      const sortBy =
        STATE.summarySortOrder === "calls DESC " ? "calls ASC " : "calls DESC ";
      setSummarySortOrder(sortBy);
      break;
    }
    case "reset-defaults": {
      const i18n = {
        en: "Are you sure you want to revert to the default settings? You will need to relaunch Chirpity to see the changes.",
        da: "Er du sikker på, at du vil gendanne standardindstillingerne? Du skal genstarte Chirpity for at se ændringerne.",
        de: "Sind Sie sicher, dass Sie die Standardeinstellungen wiederherstellen möchten? Sie müssen Chirpity neu starten, um die Änderungen zu sehen.",
        es: "¿Está seguro de que desea restablecer la configuración predeterminada? Tendrá que reiniciar Chirpity para ver los cambios.",
        fr: "Êtes-vous sûr de vouloir rétablir les paramètres par défaut ? Vous devrez relancer Chirpity pour voir les modifications.",
        nl: "Weet u zeker dat u wilt terugkeren naar de standaardinstellingen? U moet Chirpity opnieuw starten om de wijzigingen te zien.",
        pt: "Tem certeza de que deseja restaurar as configurações padrão? Você precisará reiniciar o Chirpity para ver as alterações.",
        ru: "Вы уверены, что хотите восстановить настройки по умолчанию? Вам нужно будет перезапустить Chirpity, чтобы увидеть изменения.",
        sv: "Är du säker på att du vill återställa till standardinställningarna? Du måste starta om Chirpity för att se ändringarna.",
        zh: "您确定要恢复默认设置吗？您需要重新启动 Chirpity 才能看到更改。",
        ja: "デフォルト設定に戻してもよろしいですか？ 変更を反映するには、Chirpityを再起動する必要があります。",
      };

      const locale = config.locale;
      const message = i18n[locale] || i18n["en"];
      if (confirm(message)) {
        const uuid = config.UUID;
        config = defaultConfig;
        config.UUID = uuid;
        updatePrefs("config.json", config);
      }
      break;
    }
    case "reset-spec-frequency": {
      config.audio.minFrequency = 0;
      config.audio.maxFrequency = 11950;
      DOM.fromInput.value = config.audio.minFrequency;
      DOM.fromSlider.value = config.audio.minFrequency;
      DOM.toInput.value = config.audio.maxFrequency;
      DOM.toSlider.value = config.audio.maxFrequency;
      fillSlider(
        DOM.fromInput,
        DOM.toInput,
        "#C6C6C6",
        "#0d6efd",
        DOM.toSlider
      );
      checkFilteredFrequency();
      worker.postMessage({ action: "update-state", audio: config.audio });
      const fftSamples = spectrogram.fftSamples;
      adjustSpecDims(true, fftSamples);
      document
        .getElementById("frequency-range")
        .classList.remove("text-warning");
      updatePrefs("config.json", config);
      break;
    }
    case "increaseFont": {
      const fontScale = parseFloat(
        Math.min(1.1, config.fontScale + 0.1).toFixed(1)
      ); // Don't let it go above 1.1
      config.fontScale = fontScale;
      setFontSizeScale();
      break;
    }
    case "decreaseFont": {
      const fontScale = parseFloat(
        Math.max(0.7, config.fontScale - 0.1).toFixed(1)
      ); // Don't let it go below 0.7
      config.fontScale = fontScale;
      setFontSizeScale();
      break;
    }
    case "speciesFilter": {
      speciesFilter(e);
      break;
    }
    case "audioFiltersIcon": {
      toggleFilters();
      break;
    }
    case "context-mode": {
      toggleContextAwareMode();
      break;
    }
    case "frequency-range": {
      document
        .getElementById("frequency-range-panel")
        .classList.toggle("d-none");
      document.getElementById("frequency-range").classList.toggle("active");
      break;
    }
    case "nocmigMode": {
      changeNocmigMode();
      break;
    }
    case "apply-location": {
      setDefaultLocation();
      break;
    }
    case "cancel-location": {
      cancelDefaultLocation();
      break;
    }

    case "zoomIn":
    case "zoomOut": {
      zoomSpec(e);
      break;
    }
    case "cmpZoomIn":
    case "cmpZoomOut": {
      let minPxPerSec = ws.options.minPxPerSec;
      minPxPerSec =
        target === "cmpZoomOut"
          ? Math.max((minPxPerSec /= 2), 10)
          : Math.min((minPxPerSec *= 2), 780);
      ws.zoom(minPxPerSec);
      break;
    }
    case "clear-call-cache": {
      const data = fs.rm(p.join(appPath, "XCcache.json"), (err) => {
        if (err)
          generateToast({ type: "error", message: "noCallCache" }) &&
            config.debug &&
            console.log("No XC cache found", err);
        else generateToast({ message: "callCacheCleared" });
      });
      break;
    }
    case "playToggle": {
      if (wavesurfer) {
        try {wavesurfer.playPause() }
        catch (e) { console.warn("Wavesurfer error", e.message || JSON.stringify(e)) }
        break;
      }
    }
    case "setCustomLocation": {
      setCustomLocation();
      break;
    }
    case "setFileStart": {
      showDatePicker();
      break;
    }

    // XC API calls (no await)
    case "context-xc": {
      getXCComparisons();
      break;
    }
    case "debug-mode": {
      config.debug = !config.debug;
      updatePrefs("config.json", config);
      break;
    }
  }
  DOM.contextMenu.classList.add("d-none");
  if (
    target != "frequency-range" &&
    !e.target.closest("#frequency-range-panel")
  ) {
    document.getElementById("frequency-range-panel").classList.add("d-none");
    document.getElementById("frequency-range").classList.remove("active");
  }
  if (!target?.startsWith('bird-')) {
    document.querySelectorAll('.suggestions').forEach(list => list.style.display = 'none');
  }
  hideConfidenceSlider();
  config.debug && console.log("clicked", target);
  target &&
    target !== "result1" &&
    trackEvent(config.UUID, "UI", "Click", target);
});

function changeSettingsMode(target) {
  // Get references to the buttons
  const basicButton = document.getElementById("basic");
  const advancedButton = document.getElementById("advanced");
  let showAdvanced;
  if (target === "advanced") {
    basicButton.classList.replace("btn-primary", "btn-secondary");
    advancedButton.classList.replace("btn-secondary", "btn-primary");
    showAdvanced = true;
  } else {
    basicButton.classList.replace("btn-secondary", "btn-primary");
    advancedButton.classList.replace("btn-primary", "btn-secondary");
    showAdvanced = false;
  }
  const advancedElements = document.querySelectorAll(
    ".advanced, .advanced-visible"
  );
  advancedElements.forEach((element) => {
    if (showAdvanced) {
      element.classList.replace("advanced", "advanced-visible");
    } else {
      element.classList.replace("advanced-visible", "advanced");
    }
  });
}

function updateList() {
  if (config.list === "custom") {
    readLabels(config.customListFile[config.model], "list");
  } else {
    worker.postMessage({
      action: "update-list",
      list: config.list,
      refreshResults: STATE.analysisDone,
    });
  }
}

function refreshSummary() {
  if (STATE.analysisDone) {
    // resetResults({});
    worker.postMessage({ action: "update-summary" });
  }
}

// Beginnings of the all-powerful document 'change' listener
// One listener to rule them all!
document.addEventListener("change", function (e) {
  const element = e.target.closest("[id]");
  if (element) {
    const target = element.id;
    config.debug && console.log("Change target:", target);
    // Handle key assignments
    if (/^key\d/.test(target)) {
      if (target.length === 4) {
        // Handle custom-select
        if (e.detail){
          config.keyAssignment[target] = {column: 'label', value: e.detail.value, active: true}
          config.debug && console.log(`${target} is assigned to update 'label' with ${e.detail.value}`)
        } else { setKeyAssignment(element, target) }
      }
      else {
        const key = target.slice(0,4);
        const inputElement = document.getElementById(key)
        const column = e.target.value;
        const newElement = changeInputElement(column, inputElement, key)
        setKeyAssignment(newElement, key);
      }
    } else {
      switch (target) {
        case "species-frequency-threshold": {
          if (isNaN(element.value) || element.value === "") {
            generateToast({ type: "warning", message: "badThreshold" });
            return false;
          }
          config.speciesThreshold = element.value;
          worker.postMessage({
            action: "update-state",
            speciesThreshold: element.value,
          });
          updateList();
          break;
        }
        case "timelineSetting": {
          timelineToggle(e);
          break;
        }
        case "nocmig": {
          changeNocmigMode(e);
          break;
        }
        case "iucn": {
          config.detect.iucn = element.checked;
          // resetRegions();
          refreshSummary();
          break;
        }
        case "iucn-scope": {
          config.detect.iucnScope = element.value;
          // resetRegions();
          refreshSummary();
          break;
        }
        case "auto-archive": {
          config.archive.auto = element.checked;
          worker.postMessage({ action: "update-state", archive: config.archive });
          break;
        }
        case "library-trim": {
          config.archive.trim = element.checked;
          worker.postMessage({ action: "update-state", archive: config.archive });
          break;
        }
        case "archive-format": {
          config.archive.format = document.getElementById("archive-format").value;
          worker.postMessage({ action: "update-state", archive: config.archive });
          break;
        }
        case "confidenceValue":
        case "confidence": {
          handleThresholdChange(e);
          break;
        }
        case "context": {
          toggleContextAwareMode(e);
          break;
        }
        case "attenuation": {
          handleAttenuationchange(e);
          break;
        }
        case "lowShelfFrequency": {
          handleLowShelfchange(e);
          break;
        }
        case "HighPassFrequency": {
          handleHPchange(e);
          break;
        }
        case "snrValue": {
          handleSNRchange(e);
          break;
        }
        case "file-timestamp": {
          config.fileStartMtime = element.checked;
          worker.postMessage({
            action: "update-state",
            fileStartMtime: config.fileStartMtime,
          });
          break;
        }
        case "audio-notification": {
          config.audio.notification = element.checked;
          break;
        }
        case "power-save-block": {
          config.powerSaveBlocker = element.checked;
          powerSave(config.powerSaveBlocker);
          break;
        }
        case "species-week": {
          config.useWeek = element.checked;

          if (!config.useWeek) STATE.week = -1;
          worker.postMessage({ action: "update-state", useWeek: config.useWeek });
          updateList();
          break;
        }
        case "list-to-use": {
          setListUIState(element.value);
          config.list = element.value;
          updateListIcon();
          updateList();
          break;
        }
        case "locale": {
          let labelFile;
          if (element.value === "custom") {
            labelFile = config.customListFile[config.model];
            if (!labelFile) {
              generateToast({ type: "warning", message: "labelFileNeeded" });
              return;
            }
          } else {
            const chirpity =
              element.value === "en_uk" && config.model !== "birdnet"
                ? "chirpity"
                : "";
            labelFile = `labels/V2.4/BirdNET_GLOBAL_6K_V2.4_${chirpity}Labels_${element.value}.txt`;
            localiseUI(DOM.locale.value).then((result) => (STATE.i18n = result));
            config.locale = element.value;
            initialiseDatePicker();
          }
          config.locale = element.value;
          STATE.picker.options.lang = element.value.replace("_uk", "");
          readLabels(labelFile, "locale");
          break;
        }
        case "local": {
          config.local = element.checked;
          worker.postMessage({ action: "update-state", local: config.local });
          updateList();
          break;
        }
        case "model-to-use": {
          config.model = element.value;
          STATE.analysisDone = false;
          modelSettingsDisplay();
          DOM.customListFile.value = config.customListFile[config.model];
          DOM.customListFile.value
            ? (LIST_MAP = getI18n(i18nLIST_MAP))
            : delete LIST_MAP.custom;
          document.getElementById("locale").value = config.locale;
          document.getElementById(config[config.model].backend).checked = true;
          handleBackendChange(config[config.model].backend);
          setListUIState(config.list);
          DOM.chartsLink.classList.add("disabled");
          DOM.exploreLink.classList.add("disabled");
          STATE.diskHasRecords = false;
          break;
        }
        case "thread-slider": {
          // change number of threads
          DOM.numberOfThreads.textContent = DOM.threadSlider.value;
          config[config[config.model].backend].threads =
            DOM.threadSlider.valueAsNumber;
          worker.postMessage({
            action: "change-threads",
            threads: DOM.threadSlider.valueAsNumber,
          });
          break;
        }
        case "batch-size": {
          DOM.batchSizeValue.textContent =
            BATCH_SIZE_LIST[DOM.batchSizeSlider.value].toString();
          config[config[config.model].backend].batchSize =
            BATCH_SIZE_LIST[element.value];
          worker.postMessage({
            action: "change-batch-size",
            batchSize: BATCH_SIZE_LIST[element.value],
          });
          break;
        }
        case "colourmap": {
          config.colormap = element.value;
          const colorMapFieldset = document.getElementById("colormap-fieldset");
          if (config.colormap === "custom") {
            colorMapFieldset.classList.remove("d-none");
          } else {
            colorMapFieldset.classList.add("d-none");
          }
          if (wavesurfer && STATE.currentFile) {
            const fftSamples = spectrogram.fftSamples;
            adjustSpecDims(true, fftSamples);
            postBufferUpdate({ begin: windowOffsetSecs, position: wavesurfer.getCurrentTime() / windowLength });
          }
          break;
        }
        case "window-function":
        case "alpha-slider":
        case "loud-color":
        case "mid-color":
        case "quiet-color":
        case "color-threshold-slider": {
          const windowFn = document.getElementById("window-function").value;
          const alpha = document.getElementById("alpha-slider").valueAsNumber;
          config.alpha = alpha;
          windowFn === 'gauss' 
            ? document.getElementById('alpha').classList.remove('d-none') 
            : document.getElementById('alpha').classList.add('d-none')
          const loud = document.getElementById("loud-color").value;
          const mid = document.getElementById("mid-color").value;
          const quiet = document.getElementById("quiet-color").value;
          const threshold = document.getElementById(
            "color-threshold-slider"
          ).valueAsNumber;
          document.getElementById("color-threshold").textContent = threshold;
          config.customColormap = {
            loud: loud,
            mid: mid,
            quiet: quiet,
            threshold: threshold,
            windowFn: windowFn,
          };
          if (wavesurfer && STATE.currentFile) {
            const fftSamples = spectrogram.fftSamples;
            adjustSpecDims(true, fftSamples);
            refreshTimeline();
          }
          break;
        }
        case "gain": {
          DOM.gainAdjustment.textContent = element.value + "dB";
          element.blur();
          config.audio.gain = element.value;
          worker.postMessage({ action: "update-state", audio: config.audio });
          config.filters.active || toggleFilters();
          if (fileLoaded) {
            const position = clamp(
              wavesurfer.getCurrentTime() / windowLength,
              0,
              1
            );
            postBufferUpdate({
              begin: windowOffsetSecs,
              position: position
            });
          }
          break;
        }
        case "spec-labels": {
          config.specLabels = element.checked;
          if (wavesurfer && STATE.currentFile) {
            const fftSamples = spectrogram.fftSamples;
            adjustSpecDims(true, fftSamples);
          }
          break;
        }
        case "spec-detections": {
          config.specDetections = element.checked;
          worker.postMessage({
            action: "update-state",
            specDetections: config.specDetections,
          });
          break;
        }
        case "fromInput":
        case "fromSlider": {
          config.audio.minFrequency = Math.max(element.valueAsNumber, 0);
          DOM.fromInput.value = config.audio.minFrequency;
          DOM.fromSlider.value = config.audio.minFrequency;
          const fftSamples = spectrogram.fftSamples;
          adjustSpecDims(true, fftSamples);
          checkFilteredFrequency();
          element.blur();
          worker.postMessage({ action: "update-state", audio: config.audio });
          break;
        }
        case "toInput":
        case "toSlider": {
          config.audio.maxFrequency = Math.min(element.valueAsNumber, 11950);
          DOM.toInput.value = config.audio.maxFrequency;
          DOM.toSlider.value = config.audio.maxFrequency;
          const fftSamples = spectrogram.fftSamples;
          adjustSpecDims(true, fftSamples);
          checkFilteredFrequency();
          element.blur();
          worker.postMessage({ action: "update-state", audio: config.audio });
          break;
        }
        case "normalise": {
          config.filters.normalise = element.checked;
          element.checked && (config.filters.active = true);
          worker.postMessage({ action: "update-state", filters: config.filters });
          element.blur();
          if (fileLoaded) {
            const position = clamp(
              wavesurfer.getCurrentTime() / windowLength,
              0,
              1
            );
            postBufferUpdate({
              begin: windowOffsetSecs,
              position: position
            });
          }
          break;
        }
        case "send-filtered-audio-to-model": {
          config.filters.sendToModel = element.checked;
          worker.postMessage({ action: "update-state", filters: config.filters });
          break;
        }

        case "format": {
          config.audio.format = element.value;
          showRelevantAudioQuality();
          worker.postMessage({ action: "update-state", audio: config.audio });
          break;
        }

        case "bitrate": {
          config.audio.bitrate = e.target.value;
          worker.postMessage({ action: "update-state", audio: config.audio });
          break;
        }

        case "quality": {
          config.audio.quality = element.value;
          worker.postMessage({ action: "update-state", audio: config.audio });
          break;
        }

        case "fade": {
          config.audio.fade = element.checked;
          worker.postMessage({ action: "update-state", audio: config.audio });
          break;
        }

        case "padding": {
          config.audio.padding = e.target.checked;
          DOM.audioFade.disabled = !DOM.audioPadding.checked;
          worker.postMessage({ action: "update-state", audio: config.audio });
          break;
        }

        case "downmix": {
          config.audio.downmix = e.target.checked;
          worker.postMessage({ action: "update-state", audio: config.audio });
          break;
        }
      }
    }
    updatePrefs("config.json", config);
    const value = element.type === "checkbox" ? element.checked : element.value;
    target === "fileStart" ||
      trackEvent(config.UUID, "Settings Change", target, value);
  }
});

function setListUIState(list) {
  // Sets User Preferences for chosen model
  // cf. modelSettingsDisplay
  const listElements = document.querySelectorAll(".list-hidden, .list-visible");
  listElements.forEach((element) => {
    element.classList.replace("list-visible", "list-hidden");
  });
  // DOM.customListContainer.classList.add('d-none');
  // DOM.localSwitchContainer.classList.add('d-none')
  // DOM.speciesThresholdEl.classList.add('d-none');
  if (list === "location") {
    DOM.speciesThresholdEl.classList.replace("list-hidden", "list-visible");
  } else if (list === "nocturnal") {
    DOM.localSwitchContainer.classList.replace("list-hidden", "list-visible");
  } else if (list === "custom") {
    DOM.customListContainer.classList.replace("list-hidden", "list-visible");
    if (!config.customListFile[config.model]) {
      generateToast({ type: "warning", message: "listFileNeeded" });
    }
  }
}

async function readLabels(labelFile, updating) {
  fetch(labelFile)
    .then((response) => {
      if (!response.ok) throw new Error("Network response was not ok");
      if (!labelFile) throw new Error("Failed to fetch");
      return response.text();
    })
    .catch((error) => {
      if (error.message === "Failed to fetch") {
        generateToast({
          type: "error",
          message: "listNotFound",
          variables: { file: labelFile },
        });
        DOM.customListSelector.classList.add("btn-outline-danger");
        if (!document.getElementById("settings").classList.contains("show")) {
          document.getElementById("navbarSettings").click();
        }
        document.getElementById("list-file-selector").focus();
        throw new Error(`Missing label file: ${labelFile}`);
      } else {
        throw new Error(
          `There was a problem reading the label file: ${labelFile}`
        );
      }
    })
    .then((filecontents) => {
      LABELS = filecontents.trim().split(/\r?\n/);
      // Add unknown species
      !LABELS.includes("Unknown Sp._Unknown Sp.") &&
        LABELS.push("Unknown Sp._Unknown Sp.");

      if (updating === "list") {
        worker.postMessage({
          action: "update-list",
          list: config.list,
          customLabels: LABELS,
          refreshResults: STATE.analysisDone,
        });
        trackEvent(config.UUID, "UI", "Create", "Custom list", LABELS.length);
      } else {
        worker.postMessage({
          action: "update-locale",
          locale: config.locale,
          labels: LABELS,
          refreshResults: STATE.analysisDone,
        });
      }
    })
    .catch((error) => {
      // No need to record the error if it's just that the label file wasn't entered in the form
      labelFile && console.error(error);
    });
}

function getI18n(context) {
  const locale = config.locale.replace(/_.*$/, "");
  return context[locale] || context["en"];
}

/**
 * Determines if a right-click event occurred within an audio region and optionally sets it as active.
 *
 * This function calculates the time position from the event's x-coordinate relative to the target element's width
 * using the global "windowLength". It then searches the global "REGIONS.regions" array for an audio region that spans
 * the computed time. If a matching region is found and the setActive flag is true, the region is set as active by calling
 * the global "setActiveRegion" function.
 *
 * @param {MouseEvent} e - The right-click event containing the clientX coordinate and target element dimensions.
 * @param {boolean} setActive - Flag indicating whether to mark the located region as active.
 * @returns {Object|undefined} The audio region that contains the computed time, or undefined if none is found.
 */
function checkForRegion(e, setActive) {
  const relativePosition = e.clientX / e.currentTarget.clientWidth;
  const time = relativePosition * windowLength;
  const region = REGIONS.regions.find((r) => r.start < time && r.end > time);
  region && setActive && setActiveRegion(region);
  return region;
}

/**
 * Creates and displays a custom context menu based on the event target.
 *
 * This asynchronous function handles user interactions for generating a context menu
 * in the spectrogram interface. It performs the following actions:
 * - Pauses any ongoing audio playback via the wavesurfer instance to prevent interference.
 * - Stops the propagation of the triggering event.
 * - Checks and adjusts for region detection within the spectrogram.
 * - Determines the context (e.g., summary, selection, or results) of the click and sets
 *   visibility flags for specific menu items.
 * - If necessary, triggers a click on the target element to load or update the active row
 *   and awaits the file load completion.
 * - Constructs the HTML for the context menu with options such as playing a region,
 *   analyzing a selection, creating/editing a manual record, exporting a clip, comparing,
 *   or deleting records.
 * - Sets the modal title based on whether the action is to create or edit a record.
 * - Attaches event listeners to handle deletion and record entry actions based on the context.
 * - Adjusts certain menu items' visibility depending on the active context.
 * - Positions the context menu at the event coordinates.
 *
 * @async
 * @param {Event} e - The event object that triggers the context menu (typically a MouseEvent).
 * @returns {Promise<void>} Resolves once the context menu is setup and positioned.
 */
async function createContextMenu(e) {
  // If we let the playback continue, the region may get wiped
  if (wavesurfer?.isPlaying()) wavesurfer.pause();
  e.stopPropagation();
  this.closest("#spectrogramWrapper") && checkForRegion(e, true);
  const i18n = getI18n(i18nContext);
  const target = e.target;
  if (target.classList.contains("circle") || target.closest("thead")) return;
  let hideInSummary = "",
    hideInSelection = "",
    plural = "";
  const inSummary = target.closest("#speciesFilter");
  const resultContext = !target.closest("#summaryTable");
  if (inSummary) {
    hideInSummary = "d-none";
    plural = "s";
  } else if (target.closest("#selectionResultTableBody")) {
    hideInSelection = "d-none";
  }

  // If we haven't clicked the active row or we cleared the region, load the row we clicked
  if (resultContext || hideInSelection || hideInSummary) {
    // Lets check if the summary needs to be filtered
    if (
      (inSummary && !target.closest("tr").classList.contains("text-warning")) ||
      (target.closest("#resultTableBody") &&
        !target.closest("tr").classList.contains("table-active"))
    ) {
      target.click(); // Wait for file to load
      await waitFor(() => fileLoaded);
    }
  }
  if (!activeRegion && !inSummary) return;
  const createOrEdit =
    activeRegion?.label || target.closest("#summary") ? i18n.edit : i18n.create;

  DOM.contextMenu.innerHTML = `
    <div id="${inSummary ? "inSummary" : "inResults"}">
        <a class="dropdown-item ${hideInSummary}" id="play-region"><span class='material-symbols-outlined'>play_circle</span> ${
    i18n.play
  }</a>
        <a class="dropdown-item ${hideInSummary} ${hideInSelection}" href="#" id="context-analyse-selection">
        <span class="material-symbols-outlined">search</span> ${i18n.analyse}
        </a>
        <div class="dropdown-divider ${hideInSummary}"></div>
        <a class="dropdown-item" id="create-manual-record" href="#">
        <span class="material-symbols-outlined">edit_document</span> ${createOrEdit} ${
    i18n.record
  }
        </a>
        <a class="dropdown-item" id="context-create-clip" href="#">
        <span class="material-symbols-outlined">music_note</span> ${i18n.export}
        </a>
        <span class="dropdown-item" id="context-xc" href='#' target="xc">
        <img src='img/logo/XC.png' alt='' style="filter:grayscale(100%);height: 1.5em"> ${
          i18n.compare
        }
        </span>
        <div class="dropdown-divider ${hideInSelection}"></div>
        <a class="dropdown-item ${hideInSelection}" id="context-delete" href="#">
        <span class='delete material-symbols-outlined'>delete_forever</span> ${
          i18n.delete
        }
        </a>
    </div>
    `;
  const modalTitle = document.getElementById("record-entry-modal-label");
  const contextDelete = document.getElementById("context-delete");
  modalTitle.textContent = `${createOrEdit}`;
  if (!hideInSelection) {
    resultContext
      ? contextDelete.addEventListener("click", deleteRecord)
      : contextDelete.addEventListener("click", function () {
          deleteSpecies(target);
        });
  }
  // Add event Handlers
  if (!hideInSelection) {
    document
      .getElementById("create-manual-record")
      .addEventListener("click", function (e) {
        if (e.target.textContent.includes("Edit")) {
          showRecordEntryForm("Update", !!hideInSummary);
        } else {
          showRecordEntryForm("Add", !!hideInSummary);
        }
      });
  }
  if (inSummary || activeRegion.label || hideInSummary) {
  } else {
    const xc = document.getElementById("context-xc");
    xc.classList.add("d-none");
    contextDelete.classList.add("d-none");
  }
  setTimeout(() => positionMenu(DOM.contextMenu, e), 100);
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

  menu.style.display = "block";
  menu.style.top = top + "px";
  menu.style.left = left + "px";
}

[DOM.spectrogramWrapper, DOM.resultTableElement, selectionTable].forEach(
  (el) => {
    el.addEventListener("contextmenu", createContextMenu);
  }
);

const recordEntryModalDiv = document.getElementById("record-entry-modal");
const recordEntryModal = new bootstrap.Modal(recordEntryModalDiv, {
  backdrop: "static",
});

const recordEntryForm = document.getElementById("record-entry-form");
let focusBirdList;

/**
 * Populates and displays the record entry modal for updating or adding audio record details.
 *
 * Retrieves species information from either the batch selector or the active audio region and auto-populates
 * related fields such as call count and comment when an active record exists. Adjusts the UI based on batch mode
 * by toggling visibility of certain elements, updates labels based on localization settings, and initializes a 
 * custom label selector with available tags from the application state. Focus is set to the bird autocomplete input 
 * when the modal is shown.
 *
 * @param {string} mode - Identifier for the record update mode, used to set the DB mode field.
 * @param {boolean} batch - If true, applies batch mode settings by using batch-specific species selection and hiding certain form elements.
 * @returns {Promise<void>} Resolves once the record entry form is fully populated and the modal is displayed.
 *
 * @example
 * // Open the record entry form for a single record update
 * showRecordEntryForm('update', false);
 *
 * @example
 * // Open the record entry form in batch mode for multiple records
 * showRecordEntryForm('add', true);
 */
async function showRecordEntryForm(mode, batch) {
  const i18n = getI18n(i18nHeadings)
  const cname = batch
    ? document.querySelector("#speciesFilter .text-warning .cname .cname")
        .textContent
    : activeRegion?.label || ''
  let callCount = "",
    typeIndex = "",
    commentText = "";
  if (cname && activeRow) {
    // Populate the form with existing values
    commentText = activeRow.querySelector(".comment > span")?.title || "";
    callCount = parseInt(activeRow.querySelector(".call-count").textContent);
  }
  document.querySelectorAll('.species-search-label').forEach(label => label.textContent = i18n.search);
  const selectedBird = recordEntryForm.querySelector(
    "#selected-bird"
  );
  focusBirdList = () => document.getElementById("bird-autocomplete").focus();
  const speciesDisplay = document.createElement('div')
  speciesDisplay.className = 'border rounded w-100';
  if (cname) {
    const species = LABELS.find(sp => sp.includes(cname))
    const styled = species.split('_').reverse().join(' <br/><i>') + '</i>';
    selectedBird.innerHTML = styled;
  } else {

    selectedBird.innerHTML = i18n.searchPrompt;
  }

  const batchHide = recordEntryForm.querySelectorAll(".hide-in-batch");
  batchHide.forEach((el) =>
    batch ? el.classList.add("d-none") : el.classList.remove("d-none")
  );

  recordEntryForm.querySelector("#call-count").value = callCount;
  recordEntryForm.querySelector("#record-comment").value = commentText;
  recordEntryForm.querySelector("#DBmode").value = mode;
  recordEntryForm.querySelector("#batch-mode").value = batch;
  recordEntryForm.querySelector("#original-id").value = cname;
  //recordEntryForm.querySelector('#record-add').textContent = mode;
  const labels = STATE.tagsList.map(item => item.name);
  const i18nOptions = getI18n(i18nSelect);
  const select = new CustomSelect({
    theme: 'light',
    labels: labels,
    i18n: i18nOptions,
    preselectedLabel: activeRow?.querySelector(".label").textContent
  });
  const container = document.getElementById('label-container');
  container.textContent = '';
  container.appendChild(select);
  recordEntryModalDiv.addEventListener("shown.bs.modal", focusBirdList);
  recordEntryModal.show();
}

recordEntryForm.addEventListener("submit", function (e) {
  e.preventDefault();
  const action = document.getElementById("DBmode").value;
  // cast boolstring to boolean
  const batch = document.getElementById("batch-mode").value === "true";
  const cname = document.getElementById("selected-bird").innerText.split('\n')[0];
  // Check we selected a species
  if (!LABELS.some(item => item.includes(cname))) return
  let start, end;
  if (activeRegion) {
    start = windowOffsetSecs + activeRegion.start;
    end = windowOffsetSecs + activeRegion.end;
    const region = REGIONS.regions.find(
      (region) => region.start === activeRegion.start
    );
    region.setOptions({ content: cname });
  }
  const originalCname = document.getElementById("original-id").value || cname;
  // Update the region label
  const count = document.getElementById("call-count")?.value;
  const comment = document.getElementById("record-comment")?.value;
  const select = document.getElementById('label-container').firstChild;
  const label = select.selectedValue;

  recordEntryModal.hide();
  insertManualRecord(
    cname,
    start,
    end,
    comment,
    count,
    label,
    action,
    batch,
    originalCname
  );
});

const insertManualRecord = (
  cname,
  start,
  end,
  comment,
  count,
  label,
  action,
  batch,
  originalCname,
  confidence,
  reviewed
) => {
  const files = batch ? STATE.openFiles : STATE.currentFile;
  worker.postMessage({
    action: "insert-manual-record",
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
    position: { row: activeRow?.rowIndex - 1, page: getCurrentPage() }, //  have to account for the header row
    speciesFiltered: isSpeciesViewFiltered(true),
    reviewed
  });
};

function checkFilteredFrequency() {
  const resetButton = document.getElementById("reset-spec-frequency");
  if (config.audio.minFrequency > 0 || config.audio.maxFrequency < 11950) {
    document.getElementById("frequency-range").classList.add("text-warning");
    resetButton.classList.add("btn-warning");
    resetButton.classList.remove("btn-secondary", "disabled");
  } else {
    document.getElementById("frequency-range").classList.remove("text-warning");
    resetButton.classList.remove("btn-warning");
    resetButton.classList.add("btn-secondary", "disabled");
  }
}

function getCurrentPage() {
  let currentPage = pagination[0].querySelector(".active");
  currentPage = currentPage ? parseInt(currentPage.textContent) : 1;
  return currentPage;
}

async function locateFile(file) {
  const files = await window.electron.openDialog("showOpenDialog", {
    type: "audio",
    fileOrFolder: "openFile",
    buttonLabel: "Select File",
    title: `Select the file to replace ${file}`,
  });
  if (!files.canceled) {
    worker.postMessage({
      action: "relocated-file",
      originalFile: file,
      updatedFile: files.filePaths[0],
    });
    renderFilenamePanel();
  }
}

function deleteFile(file) {
  // EventHandler caller
  if (typeof file === "object" && file instanceof Event) {
    file = STATE.currentFile;
  }
  if (file) {
    const i18nPurge = {
      en: `This will remove ${file} and all the associated detections from the database archive. Proceed?`,
      da: `Dette vil fjerne ${file} og alle tilknyttede registreringer fra databasearkivet. Fortsæt?`,
      de: `Dadurch werden ${file} und alle zugehörigen Erkennungen aus dem Datenbankarchiv entfernt. Fortfahren?`,
      es: `Esto eliminará ${file} y todas las detecciones asociadas del archivo de la base de datos. ¿Continuar?`,
      fr: `Cela supprimera ${file} et toutes les détections associées de l'archive de la base de données. Continuer ?`,
      nl: `Dit verwijdert ${file} en alle bijbehorende detecties uit het databasearchief. Doorgaan?`,
      pt: `Isso removerá ${file} e todas as detecções associadas do arquivo do banco de dados. Prosseguir?`,
      ru: `Это удалит ${file} и все связанные обнаружения из архива базы данных. Продолжить?`,
      sv: `Detta kommer att ta bort ${file} och alla tillhörande detektioner från databasarvet. Fortsätt?`,
      zh: `这将删除 ${file} 及其所有相关检测记录从数据库存档中。继续吗？`,
    };
    const message = getI18n(i18nPurge);
    if (confirm(message)) {
      worker.postMessage({
        action: "purge-file",
        fileName: file,
      });
      resetResults();
    }
    renderFilenamePanel();
  }
}

function compressAndOrganise() {
  worker.postMessage({
    action: "compress-and-organise",
  });
}

// Utility functions to wait for a variable to not be falsey

let retryCount = 0;
function waitFor(checkFn) {
  let maxRetries = 15;
  return new Promise((resolve) => {
    let interval = setInterval(() => {
      if (checkFn() || retryCount >= maxRetries) {
        clearInterval(interval); // Stop further retries
        resolve((retryCount = 0)); // Resolve the promise
      } else {
        console.log("retries: ", ++retryCount);
      }
    }, 100);
  });
}

// TOUR functions
const tourModal = document.getElementById("tourModal");
// Initialize the Bootstrap modal

// Function to start the tour
function startTour() {
  var modal = new bootstrap.Modal(tourModal, {
    backdrop: "static", // Prevent closing by clicking outside the modal
    keyboard: false, // Prevent closing by pressing Esc key
  });
  modal.show();
}

// Function to highlight an element on the page
function highlightElement(selector) {
  // Remove any previous highlights
  var highlightedElements = document.querySelectorAll(".highlighted");
  highlightedElements.forEach(function (element) {
    element.classList.remove("highlighted");
  });
  // Add a highlight class to the selected element
  var selectedElement = document.querySelector(selector);
  if (selectedElement) {
    selectedElement.classList.add("highlighted");
  }
}

// Event handler for when the carousel slides
document
  .getElementById("carouselExample")
  .addEventListener("slid.bs.carousel", function () {
    // Get the active carousel item
    var activeItem = document.querySelector(
      "#carouselExample .carousel-inner .carousel-item.active"
    );
    // Get the element selector associated with the current step
    var elementSelector = activeItem.dataset.elementSelector;
    // Highlight the corresponding element on the page
    highlightElement(elementSelector);

    if (elementSelector === "#fileContainer") {
      // Create and dispatch a new 'contextmenu' event
      var element = document.getElementById("filename");
      var contextMenuEvent = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientY: element.offsetTop + 2 * element.offsetHeight,
        clientX: 20,
      });
      buildFileMenu(contextMenuEvent);
    } else {
      document.getElementById("context-menu").classList.remove("show");
    }
  });

// Event handler for closing the modal
tourModal.addEventListener("hidden.bs.modal", function () {
  // Remove any highlights when the modal is closed
  var highlightedElements = document.querySelectorAll(".highlighted");
  highlightedElements.forEach(function (element) {
    element.classList.remove("highlighted");
  });
  config.seenTour = true;
  updatePrefs("config.json", config);
});

// Event handler for starting the tour
const prepTour = async () => {
  if (!fileLoaded) {
    const example_file = await window.electron.getAudio();
    // create a canvas for the audio spec
    showElement(["spectrogramWrapper"], false);
    loadAudioFileSync({ filePath: example_file });
  }
  startTour();
};

// Function to display update download progress
const tracking = document.getElementById("update-progress");
const updateProgressBar = document.getElementById("update-progress-bar");
const displayProgress = (progressObj, text) => {
  tracking.firstChild.nodeValue = text;
  tracking.classList.remove("d-none");
  // Update your UI with the progress information
  updateProgressBar.value = progressObj.percent;
  if (progressObj.percent > 99.8) tracking.classList.add("d-none");
};
window.electron.onDownloadProgress((_event, progressObj) =>
  displayProgress(progressObj, "Downloading the latest update: ")
);

// CI functions
const getFileLoaded = () => fileLoaded;
const donePredicting = () => !PREDICTING;
const getAudacityLabels = () => AUDACITY_LABELS[STATE.currentFile];

// Update checking for Mac

function checkForMacUpdates() {
  // Do this at most daily
  const latestCheck = Date.now();
  const checkDue = latestCheck - config.lastUpdateCheck > 86_400_000;
  if (checkDue) {
    fetch(
      "https://api.github.com/repos/Mattk70/Chirpity-Electron/releases/latest"
    )
      .then((response) => response.json())
      .then((data) => {
        const latestVersion = data.tag_name;
        const latest = parseSemVer(latestVersion);
        const current = parseSemVer(VERSION);

        if (isNewVersion(latest, current)) {
          const alertPlaceholder = document.getElementById("updateAlert");
          const alert = (message, type) => {
            const wrapper = document.createElement("div");
            wrapper.innerHTML = [
              `<div class="alert alert-${type} alert-dismissible" role="alert">`,
              `   <div>${message}</div>`,
              '   <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>',
              "</div>",
            ].join("");
            alertPlaceholder.append(wrapper);
          };
          const link = `<a href="https://chirpity.mattkirkland.co.uk?fromVersion=${VERSION}" target="_blank">`;
          const message = interpolate(getI18n(i18nUpdateMessage), {
            link: link,
          });
          alert(
            `<svg class="bi flex-shrink-0 me-2" width="20" height="20" role="img" aria-label="Info:"><use xlink:href="#info-fill"/></svg>${message}`,
            "warning"
          );
          trackEvent(
            config.UUID,
            "Update message",
            `From ${VERSION}`,
            `To: ${latestVersion}`
          );
        }
        config.lastUpdateCheck = latestCheck;
        updatePrefs("config.json", config);
      })
      .catch((error) => {
        console.warn("Error checking for updates:", error);
      });
  }
}
const i18nUpdateMessage = {
  en: "There's a new version of Chirpity available! ${link}Check the website</a> for more information",
  da: "Der er en ny version af Chirpity tilgængelig! ${link}Besøg hjemmesiden</a> for mere information",
  de: "Eine neue Version von Chirpity ist verfügbar! ${link}Besuchen Sie die Website</a> für weitere Informationen",
  es: "¡Hay una nueva versión de Chirpity disponible! ${link}Visita el sitio web</a> para más información",
  fr: "Une nouvelle version de Chirpity est disponible ! ${link}Consultez le site web</a> pour plus d'informations",
  nl: "Er is een nieuwe versie van Chirpity beschikbaar! ${link}Bezoek de website</a> voor meer informatie",
  pt: "Há uma nova versão do Chirpity disponível! ${link}Visite o site</a> para mais informações",
  ru: "Доступна новая версия Chirpity! ${link}Посетите сайт</a> для получения дополнительной информации",
  sv: "En ny version av Chirpity är tillgänglig! ${link}Besök webbplatsen</a> för mer information",
  zh: "Chirpity有新版本可用！${link}访问网站</a>了解更多信息",
};

function generateToast({
  message = "",
  type = "info",
  autohide = true,
  variables = undefined,
  locate = "",
} = {}) {
  // i18n
  const i18n = getI18n(i18nToasts);
  if (message === "noFile") {
      clearTimeout(loadingTimeout) &&
      DOM.loading.classList.add("d-none");
      // Alow further interactions!!
      STATE.regionsCompleted = true;
      STATE.currentFile && (fileLoaded = true);
  }
  message = variables
    ? interpolate(i18n[message], variables)
    : i18n[message] || message;
  // add option to locate a missing file
  message += locate;
  const domEl = document.getElementById("toastContainer");

  const wrapper = document.createElement("div");
  // Add toast attributes
  wrapper.setAttribute("class", "toast");
  wrapper.setAttribute("role", "alert");
  wrapper.setAttribute("aria-live", "assertive");
  wrapper.setAttribute("aria-atomic", "true");

  // Create elements
  const toastHeader = document.createElement("div");
  toastHeader.className = "toast-header";

  const iconSpan = document.createElement("span");
  iconSpan.classList.add("material-symbols-outlined", "pe-2");
  iconSpan.textContent = type; // The icon name
  const typeColours = {
    info: "text-primary",
    warning: "text-warning",
    error: "text-danger",
  };
  const typeText = {
    info: i18n.info,
    warning: i18n.warning,
    error: i18n.error,
  };
  iconSpan.classList.add(typeColours[type]);
  const strong = document.createElement("strong");
  strong.className = "me-auto";
  strong.textContent = typeText[type];

  const small = document.createElement("small");
  small.className = "text-muted";
  small.textContent = ""; //just now';

  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn-close";
  button.setAttribute("data-bs-dismiss", "toast");
  button.setAttribute("aria-label", "Close");

  // Append elements to toastHeader
  toastHeader.appendChild(iconSpan);
  toastHeader.appendChild(strong);
  toastHeader.appendChild(small);
  toastHeader.appendChild(button);

  // Create toast body
  const toastBody = document.createElement("div");
  toastBody.className = "toast-body";
  toastBody.innerHTML = message; // Assuming message is defined

  // Append header and body to the wrapper
  wrapper.appendChild(toastHeader);
  wrapper.appendChild(toastBody);

  domEl.appendChild(wrapper);
  const toast = new bootstrap.Toast(wrapper, { autohide: autohide });
  toast.show();
  if (message === i18n.complete) {
    const duration = parseFloat(
      DIAGNOSTICS["Analysis Duration"].replace(" seconds", "")
    );
    if (config.audio.notification && duration > 30) {
      if (Notification.permission === "granted") {
        // Check whether notification permissions have already been granted;
        // if so, create a notification
        const notification = new Notification(
          `Analysis completed in ${duration.toFixed(0)} seconds`,
          { requireInteraction: true, icon: "img/icon/chirpity_logo2.png" }
        );
      } else if (Notification.permission !== "denied") {
        // We need to ask the user for permission
        Notification.requestPermission().then((permission) => {
          // If the user accepts, let's create a notification
          if (permission === "granted") {
            const notification = new Notification(
              `Analysis completed in ${duration.toFixed(0)} seconds`,
              { requireInteraction: true, icon: "img/icon/chirpity_logo2.png" }
            );
          }
        });
      } else {
        notificationSound = document.getElementById("notification");
        notificationSound.play();
      }
    }
  }
}

// Not Harlem, but Fisher-Yates shuffle - used for xc call selection
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function getXCComparisons() {
  let [, , , sname, cname] = activeRow.getAttribute("name").split("|");
  cname.includes("call)") ? "call" : "";
  let XCcache;
  try {
    const data = await fs.promises.readFile(
      p.join(appPath, "XCcache.json"),
      "utf8"
    );
    XCcache = JSON.parse(data);
  } catch (err) {
    config.debug && console.log("No XC cache found", err);
    XCcache = {}; // Set XCcache as an empty object
  }

  if (XCcache[sname]) renderComparisons(XCcache[sname], cname);
  else {
    DOM.loading.querySelector("#loadingText").textContent =
      "Loading Xeno-Canto data...";
    DOM.loading.classList.remove("d-none");
    const quality = "+q:%22>C%22";
    const length = "+len:3-15";
    fetch(
      `https://xeno-canto.org/api/2/recordings?query=${sname}${quality}${length}`
    )
      .then((response) => {
        if (!response.ok) {
          DOM.loading.classList.add("d-none");
          return generateToast({ type: "error", message: "noXC" });
        }
        return response.json();
      })
      .then((data) => {
        // Hide loading
        DOM.loading.classList.add("d-none");
        // Extract the first 10 items from the recordings array
        const recordings = data.recordings
          .map((record) => ({
            file: record.file, // media file
            rec: record.rec, // recordist
            url: record.url, // URL on XC
            type: record.type, // call type
            smp: record.smp, // sample rate
            licence: record.lic, //// licence
          }))
          .filter((record) => record.file); // Remove records with empty file URL;

        // Shuffle recordings so new cache returns a different set
        shuffle(recordings);

        // Initialize an object to store the lists
        const filteredLists = {
          "nocturnal flight call": [],
          "flight call": [],
          call: [],
          song: [],
        };

        // Counters to track the number of items added to each list
        let songCount = 0;
        let callCount = 0;
        let flightCallCount = 0;
        let nocturnalFlightCallCount = 0;

        // Iterate over the recordings array and filter items
        recordings.forEach((record) => {
          if (record.type === "song" && songCount < 10) {
            filteredLists.song.push(record);
            songCount++;
          } else if (
            record.type === "nocturnal flight call" &&
            nocturnalFlightCallCount < 10
          ) {
            filteredLists["nocturnal flight call"].push(record);
            nocturnalFlightCallCount++;
          } else if (record.type === "flight call" && flightCallCount < 10) {
            filteredLists["flight call"].push(record);
            flightCallCount++;
          } else if (record.type === "call" && callCount < 10) {
            filteredLists.call.push(record);
            callCount++;
          }
        });
        if (
          songCount === 0 &&
          callCount === 0 &&
          flightCallCount === 0 &&
          nocturnalFlightCallCount === 0
        ) {
          generateToast({ type: "warning", message: "noComparisons" });
          return;
        } else {
          // Let's cache the result, 'cos the XC API is quite slow
          XCcache[sname] = filteredLists;
          updatePrefs("XCcache.json", XCcache); // TODO: separate the caches, add expiry - a week?
          console.log("XC response", filteredLists);
          renderComparisons(filteredLists, cname);
        }
      })
      .catch((error) => {
        DOM.loading.classList.add("d-none");
        console.warn("Error getting XC data", error);
      });
  }
}

function capitalizeEachWord(str) {
  return str.replace(/\b\w/g, function (char) {
    return char.toUpperCase();
  });
}
function renderComparisons(lists, cname) {
  const i18n = getI18n(i18nContext);
  const i18nTitle = getI18n(i18nTitles);
  cname = cname.replace(/\(.*\)/, "").replace("?", "");
  const compareDiv = document.createElement("div");
  compareDiv.classList.add("modal", "modal-fade", "model-lg");
  compareDiv.id = "compareModal";
  compareDiv.tabIndex = -1;
  compareDiv.setAttribute("aria-labelledby", "compareModalLabel");
  compareDiv.setAttribute("aria-modal", "true");
  compareDiv.setAttribute("data-bs-backdrop", "static");
  const compareHTML = `
        <div class="modal-dialog modal-lg modal-dialog-bottom w-100">
            <div class="modal-content">
                <div class="modal-header pt-1 pb-0 bg-dark bg-opacity-25"><h5>${cname}</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
                    <div class="modal-body pt-0 pb-1">
                        <ul class="nav nav-tabs navbar navbar-expand p-0 pt-1" id="callTypeHeader" role="tablist"></ul>
                        <div class="tab-content" id="recordings"></div>
                        <div class="modal-footer justify-content-center pb-0">
                            <button id="playComparison" class="p-1 pe-2 btn btn-outline-secondary" title="${i18nTitle.playToggle}">
                                <span class="material-symbols-outlined ">play_circle</span><span
                                class="align-middle d-none d-lg-inline"> ${i18n.play} </span>
                                /
                                <span class="material-symbols-outlined">pause</span><span
                                class="align-middle d-none d-lg-inline-block">${i18n.pause}</span>
                            </button>
                            <div class="btn-group" role="group">
                                <button id="cmpZoomIn" title="${i18nTitle.zoomIn}" class="btn btn-outline-secondary p-0">
                                <span class="material-symbols-outlined zoom-xc">zoom_in</span>
                                </button>
                                <button id="cmpZoomOut" title="${i18nTitle.zoomOut}" class="btn btn-outline-secondary p-0"
                                style="max-width: 70px"><span class="material-symbols-outlined zoom-xc align-middle">zoom_out</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
  compareDiv.innerHTML = compareHTML;
  //const indicatorList = compareDiv.querySelector('.carousel-indicators');
  const callTypeHeader = compareDiv.querySelector("#callTypeHeader");
  const recordings = compareDiv.querySelector("#recordings");
  let count = 0;
  Object.keys(lists).forEach((callType) => {
    const active = count === 0 ? "active" : "";
    const callTypePrefix = callType.replaceAll(" ", "-");
    if (lists[callType]?.length) {
      // tab headings
      const tabHeading = document.createElement("li");
      tabHeading.classList.add("nav-item");
      tabHeading.setAttribute("role", "presentation");
      const button = `<button class="nav-link text-nowrap ${active}" id="${callTypePrefix}-tab" data-bs-toggle="tab" data-bs-target="#${callTypePrefix}-tab-pane" type="button" role="tab" aria-controls="${callTypePrefix}-tab-pane" aria-selected="${
        count === 0
      }">${i18n[callType]}</button>`;
      tabHeading.innerHTML = button;
      callTypeHeader.appendChild(tabHeading);

      // Tab pane for each call type
      const tabContentPane = document.createElement("div");
      tabContentPane.classList.add("tab-pane", "fade");
      count === 0 && tabContentPane.classList.add("show", "active");
      tabContentPane.id = callTypePrefix + "-tab-pane";
      tabContentPane.setAttribute("role", "tabpanel");
      tabContentPane.setAttribute("aria-labelled-by", callTypePrefix + "-tab");
      recordings.appendChild(tabContentPane);
      // Content carousels in each tab-pane
      const carousel = document.createElement("div");
      carousel.classList.add("carousel", "carousel-dark", "slide");
      carousel.id = `${callTypePrefix}-comparisons`;
      carousel.setAttribute("data-bs-ride", "false");
      carousel.setAttribute("data-bs-wrap", "true");
      //carousel indicators
      carousel.innerHTML = `<div class="carousel-inner"></div><div class="carousel-indicators position-relative mt-3"></div> `;
      tabContentPane.appendChild(carousel);
      //carousel items for each recording in the list
      const carouselIndicators = carousel.querySelector(".carousel-indicators");
      const examples = lists[callType];
      const carouselInner = carousel.querySelector(".carousel-inner");
      for (let i = 0; i < examples.length; i++) {
        const recording = examples[i];
        const carouselItem = document.createElement("div");
        const indicatorItem = document.createElement("button");
        indicatorItem.setAttribute(
          "data-bs-target",
          `#${callTypePrefix}-comparisons`
        );
        indicatorItem.setAttribute("data-bs-slide-to", `${i}`);
        carouselItem.classList.add("carousel-item");
        // Need to have waveform and spec in the same container for zoom to work.
        // This css caps the height, and only shows the spec, at the bottom
        carouselItem.style.height = '256px';
        carouselItem.style.display = 'flex';
        carouselItem.style.flexDirection = 'column';
        carouselItem.style.justifyContent = 'flex-end';
        i === 0 && carouselItem.classList.add("active");
        i === 0 && indicatorItem.classList.add("active");
        // create div for wavesurfer
        const mediaDiv = document.createElement("div");
        mediaDiv.id = `${callType}-${i}`;
        const specDiv = document.createElement("div");
        specDiv.id = `${callTypePrefix}-${i}-compareSpec`;
        mediaDiv.setAttribute("name", `${specDiv.id}|${recording.file}`);
        mediaDiv.appendChild(specDiv);
        const creditContainer = document.createElement("div");
        creditContainer.classList.add("text-end");
        creditContainer.style.width = "100%";
        const creditText = document.createElement("div");
        creditText.style.zIndex = 5;
        creditText.style.top = 0;
        creditText.classList.add(
          "float-end",
          "w-100",
          "position-absolute",
          "pe-1"
        );
        const creditLink = document.createElement("a");
        creditLink.classList.add("xc-link");
        creditText.appendChild(creditLink);
        creditContainer.appendChild(creditText);
        carouselItem.appendChild(creditContainer);
        carouselItem.appendChild(mediaDiv);
        creditLink.setAttribute("href", "https:" + recording.url);
        creditLink.setAttribute("target", "_blank");
        creditLink.innerHTML = "Source: Xeno-Canto &copy; " + recording.rec;
        carouselInner.appendChild(carouselItem);

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
      const controls = document.createElement("div");
      controls.innerHTML = innerHTML;
      carouselIndicators.appendChild(controls);
      count++;
    }
  });

  document.body.appendChild(compareDiv);
  const header = compareDiv.querySelector(".modal-header");
  makeDraggable(header);
  callTypeHeader.addEventListener("click", showCompareSpec);
  const comparisonModal = new bootstrap.Modal(compareDiv);
  compareDiv.addEventListener("hidden.bs.modal", () => {
    ws && ws.destroy();
    ws = null;
    compareDiv.remove()
});
  compareDiv.addEventListener("slid.bs.carousel", () => showCompareSpec());
  compareDiv.addEventListener("shown.bs.modal", () => showCompareSpec());
  comparisonModal.show();
}

let ws, compareSpec;
const createCompareWS = (mediaContainer) => {
  if (ws) ws.destroy();
  ws = WaveSurfer.create({
    container: mediaContainer,
    backgroundColor: "rgba(0,0,0,0)",
    waveColor: "rgba(0,0,0,0)",
    progressColor: "rgba(0,0,0,0)",
    // but keep the playhead
    cursorColor: "#fff",
    hideScrollbar: true,
    cursorWidth: 2,
    fillParent: true,
    height: 256,
    minPxPerSec: 195,
    sampleRate: 24000
  });
  // set colormap
  const colors = createColormap();
  const createCmpSpec = () => ws.registerPlugin(Spectrogram.create({
      //deferInit: false,
      wavesurfer: ws,
      // container: "#" + specContainer,
      windowFunc: "hann",
      frequencyMin: 0,
      frequencyMax: 12_000,
      labels: true,
      fftSamples: 256,
      height: 256,
      colorMap: colors,
      scale: 'linear'
  }))
  createCmpSpec()
}

function showCompareSpec() {

  const activeCarouselItem = document.querySelector(
    "#recordings .tab-pane.active .carousel-item.active"
  );
  // Hide all xc-links
  document.querySelectorAll('.xc-link').forEach(link => link.classList.add('d-none'));
  // Show the active one
  const activeXCLink = activeCarouselItem.querySelector('.xc-link');
  activeXCLink && activeXCLink.classList.remove('d-none');
  
  const mediaContainer = activeCarouselItem.lastChild;
  // need to prevent accumulation, and find event for show/hide loading
  const loading = DOM.loading.cloneNode(true);
  loading.classList.remove("d-none", "text-white");
  loading.firstElementChild.textContent = "Loading audio from Xeno-Canto...";
  mediaContainer.appendChild(loading);
  const [_, file] = mediaContainer.getAttribute("name").split("|");
  // Create an instance of WaveSurfer
  createCompareWS(mediaContainer)
  ws.once("decode", function () {
    mediaContainer.removeChild(loading);
  });
  ws.load(file);
}

async function getIUCNStatus(sname = "Anser anser") {
  if (!Object.keys(STATE.IUCNcache).length) {
    //const path = p.join(appPath, 'IUCNcache.json');
    const path = window.location.pathname
      .replace(/^\/(\w:)/, "$1")
      .replace("index.html", "IUCNcache.json");
    if (fs.existsSync(path)) {
      const data = await fs.promises.readFile(path, "utf8").catch((err) => {});
      STATE.IUCNcache = JSON.parse(data);
    } else {
      STATE.IUCNcache = {};
    }
  }
  return STATE.IUCNcache[sname];

  /* The following code should not be called in the packaged app */

  const [genus, species] = sname.split(" ");

  const headers = {
    Accept: "application/json",
    Authorization: "API_KEY", // Replace with the actual API key
    keepalive: true,
  };

  try {
    const response = await fetch(
      `https://api.iucnredlist.org/api/v4/taxa/scientific_name?genus_name=${genus}&species_name=${species}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(
        `Network error: code ${response.status} fetching IUCN data.`
      );
    }

    const data = await response.json();

    // Filter out all but the latest assessments
    const filteredAssessments = data.assessments.filter(
      (assessment) => assessment.latest
    );
    const speciesData = { sname, scopes: [] };

    // Fetch all the assessments concurrently
    const assessmentResults = await Promise.all(
      filteredAssessments.map(async (item) => {
        const response = await fetch(
          `https://api.iucnredlist.org/api/v4/assessment/${item.assessment_id}`,
          { headers }
        );
        if (!response.ok) {
          throw new Error(
            `Network error: code ${response.status} fetching IUCN data.`
          );
        }
        const data = await response.json();
        await new Promise((resolve) => setTimeout(resolve, 500));
        return data;
      })
    );

    // Process each result
    for (let item of assessmentResults) {
      const scope = item.scopes?.[0]?.description?.en || "Unknown";
      const status = item.red_list_category?.code || "Unknown";
      const url = item.url || "No URL provided";

      speciesData.scopes.push({ scope, status, url });
    }

    console.log(speciesData);
    STATE.IUCNcache[sname] = speciesData;
    updatePrefs("IUCNcache.json", STATE.IUCNcache);
    return true; // Optionally return the data if you need to use it elsewhere
  } catch (error) {
    if (error.message.includes("404")) {
      generateToast({
        message: "noIUCNRecord",
        variables: { sname: sname },
        type: "warning",
      });
      STATE.IUCNcache[sname] = {
        scopes: [{ scope: "Global", status: "NA", url: null }],
      };
      updatePrefs("IUCNcache.json", STATE.IUCNcache);
      return true;
    }
    console.error("Error fetching IUCN data:", error.message);
    return false;
  }
}
const IUCNMap = {
  NA: "text-bg-secondary",
  DD: "text-bg-secondary",
  LC: "text-bg-success",
  VU: "text-bg-warning",
  NT: "text-bg-warning",
  EN: "text-bg-danger",
  CR: "text-bg-danger",
  EW: "text-bg-dark",
  EX: "text-bg-dark",
};

// Make config, LOCATIONS and displayLocationAddress and toasts available to the map script in index.html
export { config, displayLocationAddress, LOCATIONS, generateToast };

/**
 * Asynchronously verifies the current user's membership status and updates the UI accordingly.
 *
 * This function checks membership status via a remote call using the global configuration UUID and retrieves the trial period
 * from the Electron API. It uses localStorage to cache the membership status, its timestamp, and the installation date. The function
 * determines if the user is either a subscriber or within the trial period based on the installation date and trial duration.
 * Based on the result, it updates UI elements by toggling "locked" and "unlocked" classes, enabling or disabling controls, and,
 * if the user is a confirmed member, updating the primary logo image.
 *
 * Side Effects:
 * - Reads from and writes to localStorage (membership status, membership timestamp, and install date).
 * - Modifies DOM elements by replacing "locked" and "unlocked" classes, updating button states, and changing text content.
 * - Changes the primary logo's image source when membership is verified.
 * - Logs membership check details and error information using console.info and console.warn.
 *
 * Note:
 * In case of a remote check error, if a valid cached membership status (cached within the last week) exists, it is used as a
 * fallback. Otherwise, the promise may resolve to undefined.
 *
 * @returns {Promise<boolean|undefined>} A promise that resolves to a boolean indicating whether the user is a member,
 * or undefined if an error occurs and no valid cached membership status is available.
 *
 * @example
 * membershipCheck().then(isMember => {
 *   if (isMember) {
 *     console.log('User is a member or within the trial period.');
 *   } else {
 *     console.log('User is not a member or membership status could not be determined.');
 *   }
 * });
 */
async function membershipCheck() {
  const oneWeek = 7 * 24 * 60 * 60 * 1000; // "It's been one week since you looked at me, cocked your head to the side..."
  const cachedStatus = Boolean(localStorage.getItem('isMember'));
  const cachedTimestamp = Number(localStorage.getItem('memberTimestamp'));
  const now = Date.now()
  let installDate = Number(localStorage.getItem('installDate'));
  if (!installDate) {
    localStorage.setItem('installDate', now);
    installDate = now
  }
  const trialPeriod = await window.electron.trialPeriod();
  const inTrial = Date.now() - installDate < trialPeriod;
  const lockedElements = document.querySelectorAll(".locked, .unlocked");
  const unlockElements = () => {
    lockedElements.forEach((el) => {
      if (el instanceof HTMLSpanElement){
        el.classList.replace("locked", "unlocked");
        el.textContent = "lock_open";
      } else {
        el.classList.remove('locked')
        el.disabled = false;
      }
      
    });
  }
  const MEMBERSHIP_API_ENDPOINT = await window.electron.MEMBERSHIP_API_ENDPOINT();
  return await checkMembership(config.UUID, MEMBERSHIP_API_ENDPOINT).then(([isMember, expiresIn])  =>{
    console.info(`Version: ${VERSION}. Trial: ${inTrial} subscriber: ${isMember}, All detections: ${config.specDetections}`, expiresIn)
    if (isMember || inTrial) {
      if (expiresIn && expiresIn < 35){ // two weeks 
        generateToast({message:"membershipExpiry", type:"warning", variables: {expiresIn}})
      }
      unlockElements();
      if (isMember) {
        document.getElementById('primaryLogo').src = 'img/logo/chirpity_logo_subscriber_bronze.png'; // Silver & Gold available
      } else {
        document.getElementById("buy-me-coffee").classList.remove('d-none')
      }
      localStorage.setItem('isMember', true);
      localStorage.setItem('memberTimestamp', now);
    } else {
      lockedElements.forEach((el) => {
        el.classList.replace("unlocked", "locked");
        config.specDetections = false; // will need to update when more elements
        if (el instanceof HTMLSpanElement){
          el.checked = false;
          el.disabled = true;
          el.textContent = "lock";
        } else {
          el.classList.remove('locked')
          el.disabled = true;
          el instanceof HTMLSelectElement && (el.value = '')
        }
      });
      localStorage.setItem('isMember', false);
    }
    return isMember || inTrial
  }).catch(error =>{ // Period of grace
    if (cachedStatus === 'true' && cachedTimestamp && now - cachedTimestamp < oneWeek) {
      console.warn('Using cached membership status during error.', error);
      unlockElements();
      document.getElementById('primaryLogo').src = 'img/logo/chirpity_logo_subscriber_bronze.png';
      return true
    } else {
      document.getElementById("buy-me-coffee").classList.remove('d-none')
    }
  });

}

function utf8ToHex(str) {
  return Array.from(str)
    .map((char) => char.charCodeAt(0).toString(16).padStart(2, "0")) // Convert each char to hex
    .join("");
}

/**
 * Converts a hexadecimal string into a UTF-8 string.
 *
 * Splits the hex string into two-character segments, converts each segment to its corresponding character,
 * and concatenates the characters to form the decoded string.
 *
 * @param {string} hex - The hexadecimal string to convert. Must consist of an even number of hexadecimal digits.
 * @returns {string} The resulting string after decoding the hexadecimal input.
 *
 * @example
 * hexToUtf8("48656c6c6f") // returns "Hello"
 */
function hexToUtf8(hex) {
  return hex
    .match(/.{1,2}/g) // Split the hex string into pairs
    .map((byte) => String.fromCharCode(parseInt(byte, 16))) // Convert each pair to a character
    .join("");
}

/**
 * Assigns a key binding configuration based on user input.
 *
 * Retrieves the column identifier from the DOM element with the ID matching `${key}-column` and uses it to update the global key assignment stored in `config.keyAssignment`. The function trims the value from the input element and sets it to `null` if empty. It marks the assignment as active when a non-empty value is provided and dynamically enables or disables the input element based on the presence of a valid column.
 *
 * @param {HTMLInputElement} inputEL - The input element that triggered the change event.
 * @param {string} key - The identifier used to locate the corresponding column element and update the key assignment configuration.
 * @returns {void}
 */
function setKeyAssignment(inputEL, key){
  // Called on change to inputs
  const columnEl = document.getElementById(key + '-column')
  const column = columnEl.value;
  let active = false;
  const value = inputEL.value?.trim() || null;
  // column === 'label' && worker.postMessage({action: "get-tags"})
  if (column){
    inputEL.disabled = false; // enable input
    if (value){
      active = true;
      config.keyAssignment[key] = {column, value, active};
      config.debug && console.log(`${key} is assigned to update ${column} with ${value}`)
    } else {
      config.keyAssignment[key] = {column, value, active};
      config.debug && console.log(`${key} is assigned to update ${column} with ${value}`)
    }
  } else {

    inputEL.disabled = true; // disable input
    config.keyAssignment[key] = {column, value, active};
  }
}

/**
 * Update key assignment UI elements based on the provided configuration.
 *
 * Iterates over each key in the {@code keyAssignments} object, updating the corresponding
 * DOM input elements with their assigned value and column information. If the key's value
 * is not "unused", the input is enabled. Additionally, for key assignments with a column of
 * "label" or "species", the input element is further processed for specialized handling.
 *
 * @param {Object.<string, {value: string, column: string}>} keyAssignments - 
 *   An object mapping element IDs to their key assignment configurations. Each configuration object
 *   should contain:
 *   - {@code value}: The assigned key value. Use "unused" to indicate no assignment.
 *   - {@code column}: The column type, typically "label" or "species", affecting further UI processing.
 *
 * @example
 * const keyAssignments = {
 *   "key1": { value: "A", column: "label" },
 *   "key2": { value: "unused", column: "species" }
 * };
 * setKeyAssignmentUI(keyAssignments);
 *
 * @remarks
 * Assumes that DOM elements exist with IDs matching each key in {@code keyAssignments} and their associated
 * column elements using the format {@code key + '-column'}. Relies on a global {@code getI18n} function and
 * an {@code i18nSelect} parameter to initialize internationalization context.
 */
function setKeyAssignmentUI(keyAssignments){
  const i18n = getI18n(i18nSelect);
  Object.entries(keyAssignments).forEach(([k, v]) => {
    const input = document.getElementById(k);
    input.value = v.value;
    v.value === 'unused' || (input.disabled = false);
    document.getElementById(k+'-column').value = v.column;
    if (['label', 'species'].includes(v.column)) changeInputElement(v.column, input, k, v.value);
  }) 
}

/**
 * Replaces a target DOM element with a custom input component based on the specified column.
 *
 * For a column value of "label", creates a dark-themed custom select populated with labels obtained from STATE.tagsList.
 * Otherwise, creates an input element with a prefilled value; if the column is "species", adds an event listener to update suggestion lists.
 *
 * @param {string} column - Determines the type of input element to generate ("label" for a custom select, "species" for an input with suggestions, or any other value for a generic input).
 * @param {HTMLElement} element - The DOM element to be replaced by the new input component.
 * @param {string} key - A unique identifier used as the new element's ID.
 * @param {string|null} [preSelected=null] - The preselected value to populate the input component.
 * @returns {HTMLElement} The newly created DOM element, either a container with a custom select (for "label") or an input element.
 */
function changeInputElement(column, element, key, preSelected = null){
  if (column === 'label'){
    const i18n = getI18n(i18nSelect)
    const container = document.createElement('div')
    container.id = key;
    container.className = 'form-control-sm bg-dark border-0';
    const labels = STATE.tagsList.map(item => item.name);
    const select = new CustomSelect({
      theme: 'dark',
      labels: labels,
      i18n: i18n,
      preselectedLabel: preSelected
    });
    container.appendChild(select);
    element.replaceWith(container)
    return container
  } else {
    const input = document.createElement('input');
    input.className="ms-2 form-control";
    input.id=key;
    input.value = preSelected;
    input.style="font-size: small";
    if (column === 'species'){
      const listContainer = document.getElementById(`bird-list-${key}`)
      input.addEventListener('input', () => updateSuggestions(input, listContainer, true));
    }
    element.replaceWith(input);
    return input
  }
}

document.addEventListener("labelsUpdated", (e) => {
  const tags = e.detail.tags;
  const tagObjects = tags.map((name, index) => ({ id: index, name }));
  const deleted = e.detail.deleted;
  if (deleted){
    console.log("Tag deleted:", deleted);
    worker.postMessage({action: "delete-tag", deleted });
    STATE.tagsList = STATE.tagsList.filter(item => item.name !== deleted)
  } else {
    // Find the new or renamed tag
    const alteredOrNew = tagObjects.find(tag => !STATE.tagsList.find(t => t.name === tag.name));
    STATE.tagsList = tags;
    console.log("Tag updated:", alteredOrNew);
    worker.postMessage({action: "update-tag", alteredOrNew })
  }
  
  console.log("Tags list:", STATE.tagsList);
});


/**
 * Filters and sorts bird labels based on a search query.
 *
 * This function processes a global collection of bird labels by performing a case-insensitive filter based on the provided search string.
 * Each matching label, originally in the format "sname_cname", is split and reversed to yield the common name (`cname`) and the scientific name (`sname`).
 * The returned object includes a `styled` property that formats these names into an HTML string with `<br/>` and `<i>` tags.
 * The resulting list is sorted alphabetically by the common name using locale comparison based on the configuration.
 *
 * @param {string} search - A substring used to filter bird labels; if invalid, an empty array is returned.
 * @returns {Array<{cname: string, sname: string, styled: string}>} An array of objects representing filtered and sorted birds.
 */
function getFilteredBirds(search, list = LABELS) {
  if (!search || typeof search !== 'string') return [];
  const sortedList =  list
    .filter(bird => bird.toLowerCase().includes(search))
    .map(item => {
      // Flip sname and cname from "sname_cname"
      const [cname, sname] = item.split('_').reverse();
      return { cname, sname, styled: `${cname} <br/><i>${sname}</i>` };
    })
    .sort((a, b) => new Intl.Collator(config.locale.replace(/_.*$/, "")).compare(a.cname, b.cname));
    return sortedList
}

/**
 * Updates the suggestions list  based on the input search query.
 *
 * Uses the lowercase value of the provided input element to filter bird suggestions via the global
 * getFilteredBirds function. If the search query is shorter than 2 characters, the suggestion element
 * is hidden. Otherwise, a list of matching suggestions is created where each suggestion, when clicked,
 * updates the selected bird display (the element with ID "selected-bird"), conditionally modifies the
 * input value based on the preserveInput flag, dispatches a change event on the input, and hides the
 * suggestion element.
 *
 * @param {HTMLInputElement} input - The input element containing the current search query.
 * @param {HTMLElement} element - The DOM element that displays the list of filtered suggestions.
 * @param {boolean} preserveInput - Determines whether to keep the input’s value after a suggestion is selected.
 */
function updateSuggestions(input, element, preserveInput) {
  const search = input.value.toLowerCase();
  element.textContent = ''; // Clear any existing suggestions
    // Close any open lists
    const suggestionLists = document.querySelectorAll('.suggestions')
    suggestionLists.forEach(list => list.style.display = 'none');
  if (search.length < 2) {
    element.style.display = 'none';
    return;
  }
  const list = input.id === 'bird-autocomplete-explore' || input.id === 'bird-autocomplete-chart'? STATE.seenSpecies : LABELS;
  const filtered = getFilteredBirds(search, list);
  const fragment = document.createDocumentFragment();
  // Populate the suggestion list
  filtered.forEach(item => {
    const li = document.createElement('li');
    li.className = 'list-group-item';

    const text = document.createElement('span');
    text.textContent = item.cname;
    const italic = document.createElement('i');
    italic.textContent = item.sname;
    li.appendChild(text);
    li.appendChild(document.createElement('br'));
    li.appendChild(italic);

    li.addEventListener('click', () => {
      const selectedBird = document.getElementById('selected-bird');
      selectedBird.replaceChildren(
        text.cloneNode(true),
        document.createElement('br'),
        italic.cloneNode(true)
      );
      input.value = preserveInput ? item.cname : '';
      if (input.id === 'bird-autocomplete-explore'){
        filterResults({ species: item.cname, updateSummary: true });
        resetResults({
          clearSummary: false,
          clearPagination: false,
          clearResults: false,
        });
      } else if  (input.id === 'bird-autocomplete-chart'){
        worker.postMessage({action: "chart", species: item.cname, range: STATE.chart.range})
      }
      input.dispatchEvent(new Event('change', { bubbles: true })); // fire the change event
      element.style.display = 'none';
    });
    fragment.appendChild(li);
  });
  element.appendChild(fragment);
  element.style.display = filtered.length ? 'block' : 'none';
  // Make sure the dropdown is visble
  element.getBoundingClientRect().bottom > window.innerHeight &&
    element.scrollIntoView({behavior: 'smooth', block:'end'})
}

// Update suggestions on each input event
const autocomplete = document.querySelectorAll('.autocomplete');
autocomplete.forEach(input => {
  const listContainer = input.closest('.bird-search').querySelector('.suggestions');
  input.addEventListener('input', () => updateSuggestions(input, listContainer, true));
})


// Toggle the display of the suggestion list when the caret is clicked
const dropdownCaret = document.querySelectorAll('.input-caret');
dropdownCaret.forEach(caret => caret.addEventListener('click', (e) => {
  const suggestionsList = e.target.closest('.bird-search').querySelector('.suggestions');
  if (suggestionsList.style.display === 'block') {
    suggestionsList.style.display = 'none';
  } else {
    const inputField = e.target.closest('.bird-search').querySelector('input');
    updateSuggestions(inputField, suggestionsList);
  }
}));


function addToHistory (record, newCname) {
    // prepare the undelete record
    const [file, start, end] = unpackNameAttr(record);
    const setting = record.closest("table");
    if (setting) {
      const row = record.closest("tr");
      let cname = record.querySelector(".cname").innerText;
      let [species, confidence] = cname.split("\n");
      // Manual records don't have a confidence bar
      if (!confidence) {
        species = species.slice(0, -11); // remove ' person_add'
        confidence = 2000;
      } else {
        confidence = parseInt(confidence.replace("%", "")) * 10;
      }
      const comment = record.querySelector(".comment").innerText;
      const label = record.querySelector(".label").innerText;
      let callCount = record.querySelector(".call-count").innerText;
      let reviewed = !!record.querySelector(".reviewed").innerText;
      HISTORY.push([
        species,
        start,
        end,
        comment,
        callCount,
        label,
        undefined,
        undefined,
        newCname || species,
        confidence,
        reviewed
      ]);
    return {species, start, end, confidence, label, callCount, comment, file, row, setting}
  }
}

// const exploreList = document.getElementById('bird-autocomplete-explore');
// const listContainer = document.getElementById('bird-suggestions-explore');
// exploreList.addEventListener('input', function () {updateSuggestions(this, listContainer, true)});