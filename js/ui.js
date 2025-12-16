/**
 * @file User Interface code.
 * Contains functions for rendering the spectrogram, updating settings, rendering the screen
 */
// Get the modules loaded in preload.js
const fs = window.module.fs;
const p = window.module.p;

const si = window.module.si;
import {
  customURLEncode,
  installConsoleTracking,
  trackVisit as _trackVisit,
  trackEvent as _trackEvent,
} from "./utils/tracking.js";
import {plotTrainingHistory} from './components/charts.js';
import { checkMembership } from "./utils/member.js";
import { DOM } from "./utils/DOMcache.js";
import { IUCNtaxonomy, IUCNCache } from "./utils/IUCNcache.js";
import { XCtaxonomy as XCtaxon } from "./utils/XCtaxonomy.js";
import { CustomSelect } from "./components/custom-select.js";
import createFilterDropdown from "./components/custom-filter.js";
import { Pagination } from "./components/pagination.js";
import { initialiseDatePicker } from "./components/datePicker.js";
import {
  fetchIssuesByLabel,
  renderIssuesInModal,
  parseSemVer,
  isNewVersion,
} from "./utils/getKnownIssues.js";
import * as i18n from "./utils/i18n.js";
import * as utils from "./utils/utils.js";
import { UIState as State } from "./utils/UIState.js";
import { ChirpityWS } from './components/spectrogram.js';

let LOCATIONS,
  locationID = undefined,
  loadingTimeout,
  LIST_MAP;

let APPLICATION_LOADED = false;
let LABELS = [],
  HISTORY = [];

window.addEventListener("unhandledrejection", function (event) {
  if (isTestEnv) return
  // Extract the error message and stack trace from the event
  const errorMessage = event.reason.message;
  const stackTrace = event.reason.stack;

  // Track the unhandled promise rejection
  trackEvent(
    config.UUID,
    "Unhandled UI PR",
    errorMessage,
    customURLEncode(stackTrace)
  );
});

window.addEventListener("rejectionhandled", function (event) {
  if (isTestEnv) return
  // Extract the error message and stack trace from the event
  const errorMessage = event.reason.message;
  const stackTrace = event.reason.stack;

  // Track the unhandled promise rejection
  trackEvent(
    config.UUID,
    "Handled UI PR",
    errorMessage,
    customURLEncode(stackTrace)
  );
});


const state = new State();
let STATE = state.state;


const GLOBAL_ACTIONS = {
  // Handle number keys 1-9 dynamically
  handleNumberKeys: (e) => {
    if (/^[0-9]$/.test(e.key)) {
      // number keys here
      if (activeRow) {
        recordUpdate(e);
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
  c: (e) => (e.ctrlKey || e.metaKey) && STATE.fileLoaded && spec.centreSpec(),
  // D: (e) => {
  //     if (( e.ctrlKey || e.metaKey)) worker.postMessage({ action: 'create-dataset' });
  // },
  e: (e) => (e.ctrlKey || e.metaKey) && STATE.activeRegion && exportAudio(),
  g: (e) => (e.ctrlKey || e.metaKey) && showGoToPosition(),
  o: async (e) =>
    (e.ctrlKey || e.metaKey) && (await showOpenDialog("openFile")),
  p: () => STATE.activeRegion && playRegion(),
  q: (e) => e.metaKey && isMac && window.electron.exitApplication(),
  s: (e) =>
    (e.ctrlKey || e.metaKey) && document.getElementById("save2db").click(),
  t: (e) => (e.ctrlKey || e.metaKey) && timelineToggle(true),
  v: (e) => {
    if (activeRow && (e.ctrlKey || e.metaKey)) {
      const {species, start, end,  label, callCount, comment, file, modelID} = addToHistory(activeRow);
      insertManualRecord({
        files: file,
        cname: species,
        start,
        end,
        label,
        comment,
        count: callCount,
        action: "Update",
        batch: false,
        originalCname: species,
        modelID
      });
    }
  },
  z: (e) => {
    if ((e.ctrlKey || e.metaKey) && HISTORY.length)
      insertManualRecord({...HISTORY.pop(), undo: true});
  },
  Escape: () => {
    if (PREDICTING || STATE.training) {
      worker.postMessage({
        action: "abort",
        model: config.selectedModel,
        threads: config[config.models[config.selectedModel].backend].threads,
        list: config.list,
      });
      STATE.training && document.getElementById('train').classList.remove('disabled')
      PREDICTING = false; STATE.training = false; powerSave(false);
      disableSettingsDuringAnalysis(false);
      const summarySpecies = DOM.summaryTable.querySelectorAll(".cname");
      summarySpecies.forEach(row => row.classList.replace("not-allowed","pointer"));
      STATE.analysisDone = true;
      STATE.diskHasRecords && utils.enableMenuItem(["explore", "charts"]);
      generateToast({ message: "cancelled" });
      displayProgress({percent: 100, text:''})
    }
  },
  Home: () => {
    if (STATE.fileLoaded) {
      STATE.windowOffsetSecs = 0;
      postBufferUpdate({});
    }
  },
  End: () => {
    if (STATE.fileLoaded) {
      STATE.windowOffsetSecs = STATE.currentFileDuration - STATE.windowLength;
      postBufferUpdate({ begin: STATE.windowOffsetSecs, position: 1 });
    }
  },
  PageUp: () => {
    if (STATE.fileLoaded) {
      const position = utils.clamp(
        spec.wavesurfer.getCurrentTime() / STATE.windowLength,
        0,
        1
      );
      STATE.windowOffsetSecs = STATE.windowOffsetSecs - STATE.windowLength;
      const fileIndex = STATE.openFiles.indexOf(STATE.currentFile);
      let fileToLoad;
      if (fileIndex > 0 && STATE.windowOffsetSecs < 0) {
        STATE.windowOffsetSecs = -STATE.windowLength;
        fileToLoad = STATE.openFiles[fileIndex - 1];
      } else {
        STATE.windowOffsetSecs = Math.max(0, STATE.windowOffsetSecs);
        fileToLoad = STATE.currentFile;
      }
      postBufferUpdate({
        file: fileToLoad,
        begin: STATE.windowOffsetSecs,
        position: position,
      });
    }
  },
  ArrowUp: () => {
    if (activeRow) {
      activeRow.classList.remove("table-active");
      activeRow = activeRow.previousSibling || activeRow;
      if (!activeRow.classList.contains("text-bg-dark")) activeRow.click();
      // activeRow.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  },
  PageDown: () => {
    if (STATE.fileLoaded) {
      let position = utils.clamp(
        spec.wavesurfer.getCurrentTime() / STATE.windowLength,
        0,
        1
      );
      STATE.windowOffsetSecs = STATE.windowOffsetSecs + STATE.windowLength;
      const fileIndex = STATE.openFiles.indexOf(STATE.currentFile);
      let fileToLoad;
      if (
        fileIndex < STATE.openFiles.length - 1 &&
        STATE.windowOffsetSecs >= STATE.currentFileDuration - STATE.windowLength
      ) {
        // Move to next file
        fileToLoad = STATE.openFiles[fileIndex + 1];
        STATE.windowOffsetSecs = 0;
        position = 0;
      } else {
        STATE.windowOffsetSecs = Math.min(
          STATE.windowOffsetSecs,
          STATE.currentFileDuration - STATE.windowLength
        );
        fileToLoad = STATE.currentFile;
      }
      postBufferUpdate({
        file: fileToLoad,
        begin: STATE.windowOffsetSecs,
        position: position,
      });
    }
  },
  ArrowDown: () => {
    if (activeRow) {
      activeRow.classList.remove("table-active");
      activeRow = activeRow.nextSibling || activeRow;
      if (!activeRow.classList.contains("text-bg-dark")) activeRow.click();
      // activeRow.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  },
  ArrowLeft: () => {
    const skip = STATE.windowLength / 100;
    if (STATE.fileLoaded) {
      spec.wavesurfer.setTime(spec.wavesurfer.getCurrentTime() - skip);
      let position = utils.clamp(
        spec.wavesurfer.getCurrentTime() / STATE.windowLength,
        0,
        1
      );
      if (spec.wavesurfer.getCurrentTime() < skip && STATE.windowOffsetSecs > 0) {
        STATE.windowOffsetSecs -= skip;
        postBufferUpdate({
          begin: STATE.windowOffsetSecs,
          position: (position += skip / STATE.windowLength),
          play: spec.wavesurfer.isPlaying(),
        });
      }
    }
  },
  ArrowRight: () => {
    const skip = STATE.windowLength / 100;
    if (STATE.fileLoaded) {
      const now = spec.wavesurfer.getCurrentTime();
      // This will trigger the finish event if at the end of the window
      spec.wavesurfer.setTime(now + skip);
    }
  },
  "=": (e) => STATE.fileLoaded && (spec.wavesurfer && (e.metaKey || e.ctrlKey) ? config.FFT = spec.reduceFFT() : spec.zoom("In")),
  "+": (e) => STATE.fileLoaded && (spec.wavesurfer && (e.metaKey || e.ctrlKey) ? config.FFT = spec.reduceFFT() : spec.zoom("In")),
  "-": (e) => STATE.fileLoaded && (spec.wavesurfer && (e.metaKey || e.ctrlKey) ? config.FFT = spec.increaseFFT() : spec.zoom("Out")),
  F1: () => document.getElementById("navbarSettings").click(),
  F4: () =>  STATE.fileLoaded && (spec.wavesurfer && (config.FFT = spec.increaseFFT())),
  F5: () =>  STATE.fileLoaded && (spec.wavesurfer && (config.FFT = spec.reduceFFT())),
  " ": () => { STATE.fileLoaded && WSPlayPause()},
  Tab: (e) => {
    if ((e.metaKey || e.ctrlKey) && !PREDICTING && STATE.diskHasRecords) {
      // If you did this when predicting, your results would go straight to the archive
      const modeToSet =
        STATE.mode === "explore" ? "active-analysis" : "explore";
      document.getElementById(modeToSet).click();
    } else if (activeRow) {
      activeRow.classList.remove("table-active");
      if (e.shiftKey) {
        activeRow = activeRow.previousSibling || activeRow;
        activeRow.scrollIntoView({ behavior: "instant", block: "nearest" });
      } else {
        activeRow = activeRow.nextSibling || activeRow;
        activeRow.scrollIntoView({ behavior: "instant", block: "nearest" });
      }
      if (!activeRow.classList.contains("text-bg-dark")) {
        activeRow.click();
      }
    }
  },
  Delete: (e) => STATE.fileLoaded && activeRow && deleteRecord(e),
  Backspace: (e) => STATE.fileLoaded && activeRow && deleteRecord(e),
};

/**
 * Returns a promise that resolves when the Wavesurfer instance is ready.
 *
 * Use this to ensure audio waveform rendering and related operations only proceed after initialization is complete.
 * 
 * @returns {Promise<void>} Resolves when the Wavesurfer instance emits the 'ready' event.
 */
function waitForWavesurferReady() {
  return new Promise(resolve => {
    const wavesurfer = spec.wavesurfer;
    if (wavesurfer.isReady) {
      resolve();
    } else {
      const onReady = () => { 
        wavesurfer.un('ready', onReady);
        resolve();
      };
      wavesurfer.on('ready', onReady);
    }
  });
}

/**
 * Helper function to ensure play promise has resolved before calling ws.pause().
 * A workaround for https://github.com/katspaugh/wavesurfer.js/issues/4047
 */
function WSPlayPause(){
  waitForWavesurferReady().then(() => {
    if (spec.wavesurfer.isPlaying() ){
      spec.wavesurfer.once('audioprocess', () => spec.wavesurfer.pause() )
    } else {
      spec.wavesurfer.play() 
    }
  })
}

//Open Files from OS "open with"
let OS_FILE_QUEUE = [];
window.electron.onFileOpen((filePath) => {
  if (APPLICATION_LOADED) onOpenFiles({ filePaths: [filePath], checkSaved: true });
  else OS_FILE_QUEUE.push(filePath);
});


// Is this CI / playwright?
const isTestEnv = window.env.TEST_ENV === "true";
const trackVisit = isTestEnv ? () => {} : _trackVisit;
isTestEnv || installConsoleTracking(() => config.UUID, "UI");
const trackEvent = isTestEnv ? () => {} : _trackEvent;
isTestEnv && console.log("Running in test environment");

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
  const dirname = await window.electron.getAppPath();
  // console.log('Folder is', dirname, 'data path is', appPath, 'temp is', tempPath, 'raw locale is', locale);
  return [appPath, tempPath, locale, dirname];
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

let modelReady = false;
let PREDICTING = false,
  app_t0 = Date.now();



let activeRow;
let predictions = new Map(),
  clickedIndex;
// Set content container height
DOM.contentWrapper.style.height = document.body.clientHeight - 80 + "px";
let animating = false;
// Mouse down event to start dragging
DOM.controlsWrapper.addEventListener("mousedown", (e) => {
  if (e.target.tagName !== "DIV") return;
  const startY = e.clientY;
  const initialHeight = DOM.spectrogram.offsetHeight;
  let newHeight;

  const onMouseMove = (e) => {
    // Calculate the delta y (drag distance)
    newHeight = initialHeight + e.clientY - startY;
    // Clamp newHeight to ensure it doesn't exceed the available height
    newHeight = Math.min(newHeight, spec.maxHeight(DOM));
    // Adjust the spectrogram dimensions accordingly
    if (!animating) {
      animating = true;
      requestAnimationFrame(() => {
        spec.adjustDims(true, config.FFT, newHeight);
        animating = false;
      });
    }
  };
  // Remove event listener on mouseup
  const onMouseUp = () => {
    document.removeEventListener("mousemove", onMouseMove);
    trackEvent(config.UUID, "Drag", "Spec Resize", newHeight);
  };
  // Attach event listeners for mousemove and mouseup
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp, { once: true });
});

//Drag to resize chart
const chartContainer = document.getElementById("chart-outer");
chartContainer.addEventListener("mousedown", (e) => {
  if (e.target.tagName !== "CANVAS") return;
  document.body.style.cursor = "ns-resize";
  const startY = e.clientY;
  const initialHeight = chartContainer.offsetHeight;
  let newHeight;
  const onMouseMove = (e) => {
    newHeight = initialHeight + e.clientY - startY;
    // Clamp newHeight to ensure it doesn't exceed the available height
    newHeight = Math.min(newHeight, document.body.clientHeight - 300);
    chartContainer.style.height = newHeight + "px";
};
  // Remove event listener on mouseup
  const onMouseUp = () => {
    document.body.style.cursor = "default";
    document.removeEventListener("mousemove", onMouseMove);
    trackEvent(config.UUID, "Drag", "Chart Resize", newHeight);
  };
  // Attach event listeners for mousemove and mouseup
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp, { once: true });
});


// Set default Options
let config;

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

let GPU_RAM = 0;

let diagnosticsReady = (async () => {
  try {
    const [cpuInfo, memInfo, graphics] = await Promise.all([
      si?.cpu?.() ?? Promise.reject(new Error("si.cpu unavailable")),
      si?.mem?.() ?? Promise.reject(new Error("si.mem unavailable")),
      si?.graphics?.() ?? Promise.reject(new Error("si.graphics unavailable")),
    ]);
    DIAGNOSTICS["CPU"] = cpuInfo?.brand ?? "Unknown";
    DIAGNOSTICS["Cores"] = cpuInfo?.cores ?? (navigator.hardwareConcurrency || 1);
    DIAGNOSTICS["Physical Cores"] = cpuInfo?.physicalCores ?? "Unknown";
    DIAGNOSTICS["System Memory"] =
      (((memInfo?.total ?? 0) / (1024 ** 3)) || 0).toFixed(0) + " GB";
    DIAGNOSTICS["GPUs"] = (graphics?.controllers ?? [])
      .map(gpu => `${gpu?.model} (${(gpu?.vram/1024).toFixed(0) ?? "Unknown"} GB)` )
      .filter(Boolean)
      .join(", ");
    // Pick the card with the highest VRAM
    GPU_RAM = graphics.controllers
      .filter(c => typeof c.vram === 'number')  // ensure valid number
      .sort((a, b) => b.vram - a.vram)
    if (GPU_RAM.length > 0) GPU_RAM = GPU_RAM[0].vram;
    else GPU_RAM = memInfo?.total /1024**2 - 2048 || 2048; // Fallback to total system RAM or 2GB
  } catch (err) {
    console.warn("Diagnostics collection failed:", err);
    DIAGNOSTICS["CPU"] = "Unknown";
    DIAGNOSTICS["Cores"] = navigator.hardwareConcurrency || "Unknown";
    DIAGNOSTICS["Physical Cores"] = DIAGNOSTICS["Cores"];
    DIAGNOSTICS["System Memory"] = "Unknown";
    DIAGNOSTICS["GPUs"] = "Unknown";
  }
})();

/**
 * Resets the results display and related UI components to their initial state.
 *
 * @param {Object} [options] - Options for which UI elements to reset.
 * @param {boolean} [options.clearSummary=true] - Whether to clear the summary table.
 * @param {boolean} [options.clearPagination=true] - Whether to hide pagination controls.
 * @param {boolean} [options.clearResults=true] - Whether to clear the results table and header.
 */
function resetResults({
  clearSummary = true,
  clearPagination = true,
  clearResults = true,
} = {}) {
  if (clearSummary) DOM.summaryTable.textContent = "";
  if (clearPagination) pagination.hide();
  resultsBuffer = DOM.resultTable.cloneNode(false);
  if (clearResults) {
    DOM.resultTable.textContent = "";
    DOM.resultHeader.textContent = "";
  }
  predictions.clear();
}

/**
 * Requests the worker to load an audio file for analysis, resetting file state and specifying the initial audio window.
 *
 * @param {Object} params
 * @param {string} params.filePath - The full filesystem path of the audio file to load.
 * @param {boolean} params.preserveResults - Whether to retain existing analysis results when loading the new file.
 */
function loadAudioFileSync({ filePath = "", preserveResults = false }) {
  STATE.fileLoaded = false;
  locationID = undefined;
  worker.postMessage({
    action: "file-load-request",
    file: filePath,
    start: 0,
    end: STATE.windowLength,
    preserveResults: preserveResults,
    position: 0,
    list: config.list, // list and warmup are passed to enable abort if file loaded during predictions
    warmup: config.warmup,
  });
}


const postBufferUpdate = ({
  file = STATE.currentFile,
  begin = 0,
  position = 0,
  play = false,
  resetSpec = false,
  goToRegion = false,
}) => {
  STATE.fileLoaded = false;
  worker.postMessage({
    action: "update-buffer",
    file: file,
    position: position,
    start: begin,
    end: begin + STATE.windowLength,
    play: play,
    resetSpec: resetSpec,
    goToRegion: goToRegion,
  });
  // In case it takes a while:
  loadingFiles({hide:false})
};

const resetRegions = (clearActive) => {
  if (spec.wavesurfer) spec.REGIONS.clearRegions();
  clearActive && (STATE.activeRegion = null);
  STATE.selection = false;
  worker.postMessage({ action: "update-state", selection: false });
  utils.disableMenuItem(["analyseSelection", "export-audio"]);
  if (STATE.fileLoaded) utils.enableMenuItem(["analyse"]);
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




async function showOpenDialog(fileOrFolder) {
  const defaultPath = localStorage.getItem("lastFolder") || "";
  const files = await window.electron.openDialog("showOpenDialog", {
    type: "audio",
    fileOrFolder: fileOrFolder,
    multi: "multiSelections",
    defaultPath,
  });
  if (!files.canceled) {
    filterValidFiles({ filePaths: files.filePaths });
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
  e.stopImmediatePropagation();
  const disabled = PREDICTING ? "disabled" : "";
  const menu = DOM.contextMenu;
  const i18 = i18n.get(i18n.Context);
  menu.innerHTML = `
      <a class="dropdown-item ${disabled}" id="setCustomLocation"><span
      class="material-symbols-outlined align-bottom pointer">edit_location_alt</span> ${i18.location}</a>
      <a class="dropdown-item ${disabled}" id="setFileStart"><span
      class="material-symbols-outlined align-bottom pointer">edit_calendar</span> ${i18.time}
      `;
    positionMenu(menu, e);
};

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
  const i18 = i18n.get(i18n.Form);
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
  label.innerHTML = i18.select;
  label.classList.add("form-label");
  form.appendChild(label);

  // Create the datetime-local input
  const datetimeInput = document.createElement("input");
  datetimeInput.setAttribute("type", "datetime-local");
  datetimeInput.setAttribute("id", "fileStart");
  datetimeInput.setAttribute(
    "value",
    utils.getDatetimeLocalFromEpoch(STATE.fileStart)
  );
  datetimeInput.setAttribute(
    "max",
    utils.getDatetimeLocalFromEpoch(new Date())
  );
  datetimeInput.classList.add("form-control");
  form.appendChild(datetimeInput);

  // Create a submit button
  const submitButton = document.createElement("button");
  submitButton.innerHTML = i18.submit;
  submitButton.classList.add("btn", "btn-primary", "mt-2");
  form.appendChild(submitButton);

  // Create a cancel button
  var cancelButton = document.createElement("button");
  cancelButton.innerHTML = i18.cancel;
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

/**
 * Renders the filename panel, displaying the current audio file and a dropdown for switching between multiple open files.
 *
 * Updates the UI to show the active file's name and parent folder, and provides a dropdown menu if multiple files are open. Also adapts the analysis menu based on the file's save state.
 */
function renderFilenamePanel() {
  const i18 = i18n.get(i18n.Titles);
  if (!STATE.currentFile) return;
  const openFile = STATE.currentFile;
  const files = STATE.openFiles;
  showMetadata();
  let filenameElement = DOM.filename;
  filenameElement.innerHTML = "";
  //let label = openFile.replace(/^.*[\\\/]/, "");
  const { parentFolder, fileName } = utils.extractFileNameAndFolder(openFile);
  const label = `${parentFolder}/${fileName}`;
  let appendStr;
  const title = ` title="${i18.filename}" `;
  const isSaved = ["archive", "explore"].includes(STATE.mode)
    ? "text-info"
    : "text-warning";
  if (files.length > 1) {
    appendStr = `<div id="fileContainer" class="btn-group dropup pointer">
        <span ${title} class="filename ${isSaved}">${label}</span>
        </button>
        <button id="filecount" class="btn btn-dark dropdown-toggle dropdown-toggle-split" type="button" 
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

/**
 * Updates the "Analyse All" menu UI based on whether analysis results are saved.
 *
 * Sets the menu's icon, label, and shortcut text using a platform-specific modifier (⌘ for Mac, Ctrl otherwise). When results are saved, displays an upload icon with a label to retrieve all analyses, enables the "reanalyseAll" and "charts" menu items, and conditionally enables "explore" if not already active. When not saved, displays a search icon with the appropriate label and disables the "reanalyseAll" menu item.
 *
 * @param {boolean} saved - Indicates if the analysis results are saved.
 */
function customAnalysisAllMenu(saved) {
  const analyseAllMenu = document.getElementById("analyseAll");
  const modifier = isMac ? "⌘" : "Ctrl";
  if (saved) {
    analyseAllMenu.innerHTML = `<span class="material-symbols-outlined">upload_file</span> ${STATE.i18n.retrieveAll}
        <span class="shortcut float-end">${modifier}+Shift+A</span>`;
    utils.enableMenuItem(["reanalyseAll", "charts"]);
    STATE.mode === "explore" || utils.enableMenuItem(["explore"]);
  } else {
    analyseAllMenu.innerHTML = `<span class="material-symbols-outlined">search</span> ${STATE.i18n.analyseAll[0]}
        <span class="shortcut float-end">${modifier}+Shift+A</span>`;
    utils.disableMenuItem(["reanalyseAll"]);
  }
}

/**
 * Customizes the analysis menu based on whether an analysis is saved.
 *
 * When the analysis is saved (saved === true), this function updates the menu to display an upload icon and a retrieval label, and it enables the "reanalyse", "charts", and conditionally the "explore" menu items. When the analysis is not saved, it displays a search icon with an analysis label and disables the "reanalyse" menu item.
 *
 * @param {boolean} saved - Indicates if the analysis has been saved, determining the menu's appearance and available options.
 */
function customiseAnalysisMenu(saved) {
  const modifier = isMac ? "⌘" : "Ctrl";
  const analyseMenu = document.getElementById("analyse");
  if (saved) {
    analyseMenu.innerHTML = `<span class="material-symbols-outlined">upload_file</span> ${STATE.i18n.retrieve}
        <span class="shortcut float-end">${modifier}+A</span>`;
    utils.enableMenuItem(["reanalyse", "charts"]);
    STATE.mode === "explore" || utils.enableMenuItem(["explore"]);
  } else {
    analyseMenu.innerHTML = `<span class="material-symbols-outlined">search</span> ${STATE.i18n.analyse[0]}
        <span class="shortcut float-end">${modifier}+A</span>`;
    utils.disableMenuItem(["reanalyse"]);
  }
}

async function generateLocationList(id) {
  const i18 = i18n.get(i18n.All);
  const defaultText = id === "savedLocations" ? i18[0] : i18[1];
  const el = document.getElementById(id);
  LOCATIONS = await utils.requestFromWorker(worker, "get-locations", {
    file: STATE.currentFile
  });
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
  const locationID = FILE_LOCATION_MAP[STATE.currentFile]
  placeMap("customLocationMap", locationID);
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
  if (!map) placeMap("customLocationMap", id);
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
    button.classList.replace("btn-primary", "btn-danger");
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
  button.classList.replace("btn-danger","btn-primary");
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
  updateList();

  resetResults();
  worker.postMessage({
    action: "update-list",
    list: "location",
  });
  const button = document.getElementById("apply-location");
  button.classList.replace("btn-danger","btn-primary");
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

  const i18 = i18n.get(i18n.Location);
  const addOrDelete = () => {
    if (customPlaceEl.value) {
      locationAdd.textContent = i18[0];
      locationAdd.classList.remove("btn-danger");
      locationAdd.classList.add("button-primary");
    } else {
      locationAdd.textContent = i18[1];
      locationAdd.classList.add("btn-danger");
      locationAdd.classList.remove("button-primary");
    }
  };
  // Highlight delete
  customPlaceEl.addEventListener("keyup", addOrDelete);
  addOrDelete();
  locationModalDiv.querySelector("h5").textContent = i18[0];
  const legends = locationModalDiv.querySelectorAll("legend");
  for (let i = 0; i < legends.length; i++) {
    legends[i].textContent = i18[i + 2]; // process each node
  }
  locationModalDiv.querySelector('label[for="batchLocations"]').textContent =
    i18[4];
  document.getElementById("customLatLabel").textContent = i18[5];
  document.getElementById("customLonLabel").textContent = i18[6];
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

async function sortFilesByTime(fileNames) {
  const fileData = await Promise.all(
    fileNames.map(async (fileName) => {
      const stats = await fs.promises.stat(fileName);
      return { name: fileName, time: stats.mtimeMs };
    })
  );

  return fileData
    .sort((a, b) => a.time - b.time) // Sort by modification time
    .map((file) => file.name); // Return sorted file names
}
/**
 * Opens one or more audio files, resets analysis state, and updates the UI for new input.
 *
 * Loads the provided audio files, resets analysis results and diagnostics, updates menu items, and initializes the spectrogram. If multiple files are selected, sorts them by creation time and enables batch analysis options. Begins loading the first file in the list.
 *
 * @param {Object} args - Arguments for file opening.
 * @param {string[]} args.filePaths - Paths of audio files to open.
 * @param {boolean} [args.preserveResults] - If true, preserves previous analysis results.
 */
async function onOpenFiles({ filePaths = [], checkSaved = true, preserveResults } = {}) {
  if (!filePaths.length) return;
  loadingFiles({hide:false})
  // Store the sanitised file list and Load First audio file
  // utils.hideAll();
  resetResults();
  resetDiagnostics();
  utils.disableMenuItem([
    "analyseSelection",
    "analyse",
    "analyseAll",
    "reanalyse",
    "reanalyseAll",
    "save2db",
  ]);

  // Store the file list and Load First audio file
  STATE.openFiles = filePaths;

  // Reset the buffer playhead and zoom:
  STATE.windowOffsetSecs = 0;
  STATE.windowLength = config.selectedModel.includes('bats') ? 5 : 20;
  // Reset the mode
  STATE.mode = 'analyse';
  // Reset analysis status - when importing, we want to set analysis done = true
  STATE.analysisDone = !checkSaved;

  // Sort file by time created (the oldest first):
  if (STATE.openFiles.length > 1) {
    if (modelReady) utils.enableMenuItem(["analyseAll", "reanalyseAll"]);
    STATE.openFiles = await sortFilesByTime(STATE.openFiles);
  }
  utils.hideAll();
  utils.showElement(["spectrogramWrapper"], false);
  loadAudioFileSync({ filePath: STATE.openFiles[0], preserveResults });
  // Clear unsaved records warning
  window.electron.unsavedRecords(false);
  document.getElementById("unsaved-icon").classList.add("d-none");
}

/**
 * Resets diagnostic metrics and clears the history log.
 *
 * Deletes diagnostic entries for "Audio Duration", "Analysis Rate", and "Analysis Duration" from the DIAGNOSTICS object,
 * and resets the HISTORY array to an empty state.
 */
function resetDiagnostics() {
  delete DIAGNOSTICS["Audio Duration"];
  delete DIAGNOSTICS["Analysis Rate"];
  delete DIAGNOSTICS["Analysis Duration"];
  //reset delete history too
  HISTORY = [];
}

/**
 * Resets the analysis state for a new operation.
 *
 * This function clears any active selections, resets the file number display,
 * clears diagnostic information, and empties the Audacity labels. It also ensures
 * that the progress indicator is visible.
 */
function analyseReset() {
  clearActive();
  resetDiagnostics();
}

/**
 * Updates the UI to display the spectrogram and results table based on the current file and prediction state.
 *
 * Shows the spectrogram when a file is loaded, and displays the results table if predictions are available. Hides all UI elements if no file is loaded and there are no open files.
 */
function refreshResultsView() {
  if (STATE.fileLoaded) {
    utils.hideAll();
    utils.showElement(["spectrogramWrapper"], false);
    if (predictions.size) {
      utils.showElement(["resultTableContainer", "resultsHead"], false);
    }
  } else if (!STATE.openFiles.length) {
    utils.hideAll();
  }
}

// fromDB is requested when circle clicked
const getSelectionResults = (fromDB) => {
  if (fromDB instanceof PointerEvent) fromDB = false;
  let start = STATE.activeRegion.start + STATE.windowOffsetSecs;
  // Remove small amount of region to avoid pulling in results from 'end'
  let end = STATE.activeRegion.end + STATE.windowOffsetSecs; // - 0.001;
  STATE.selection = {};
  STATE["selection"]["start"] = Number(start.toFixed(3));
  STATE["selection"]["end"] = Number(end.toFixed(3));

  postAnalyseMessage({
    filesInScope: [STATE.currentFile],
    start: STATE["selection"]["start"],
    end: STATE["selection"]["end"],
    offset: 0,
    fromDB,
  });
};

/**
 * Sends an analysis request to the worker thread to initiate audio analysis, managing UI state and preventing concurrent analyses.
 *
 * Disables relevant UI controls and resets results if not analyzing a selection. If an analysis is already in progress, displays a warning notification and does not start a new analysis.
 *
 * @param {Object} args - Parameters for the analysis request, including start and end positions, file scope, reanalysis flag, and source indicator.
 */
function postAnalyseMessage(args) {
  if (!PREDICTING) {
    // Start a timer
    t0_analysis = Date.now();
    utils.disableMenuItem(["analyseSelection", "explore", "charts"]);
    const selection = !!args.end;
    const filesInScope = args.filesInScope;
    if (!args.fromDB){
      PREDICTING = true;
      powerSave(true);
      disableSettingsDuringAnalysis(true);
    }
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
            LOCATIONS = await utils.requestFromWorker(worker, "get-locations", {
              file: STATE.currentFile
            });
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

/**
 * Exports audio clips in batch for the currently filtered species.
 *
 * If no species filter is active, displays a warning notification.
 */

async function batchExportAudio() {
  const species = isSpeciesViewFiltered(true);
  species
    ? exportData("audio", species, 1000)
    : generateToast({ type: "warning", message: "mustFilterSpecies" });
}

/**
 * Opens a file dialog to import analysis results data and sends the selected file to the worker for processing.
 *
 * @param {string} format - The format of the data to import (e.g., "CSV").
 */
async function importData(format){
  const defaultPath = localStorage.getItem("lastSaveFolder") || "";
  const files = await window.electron.openDialog("showOpenDialog", {
    type: "CSV",
    defaultPath,
  });
  if (files.canceled) return;
  const file = files.filePaths[0]
  const lastSaveFolder = p.dirname(file);
  localStorage.setItem("lastSaveFolder", lastSaveFolder);
  DOM.loadingScreen.classList.remove("d-none");
  worker.postMessage({
    action: "import-results",
    file,
    format
  })
}

/**
 * Exports detection results or summaries in the specified format.
 *
 * Depending on the chosen format, prompts the user to select a directory or file location, then sends an export request to the worker with the relevant parameters and headers. Updates the last used save folder in local storage.
 *
 * @param {string} format - The export format (e.g., "Audacity", "audio", "summary", "Raven").
 * @param {string|string[]} [species] - Species or list of species to include in the export. Defaults to the current species filter.
 * @param {number} [limit=Infinity] - Maximum number of results to export.
 * @param {number} [duration] - Optional duration filter for exported results.
 */
async function exportData(
  format,
  species = isSpeciesViewFiltered(true),
  limit = Infinity,
  duration
) {
  const defaultPath = localStorage.getItem("lastSaveFolder") || "";
  let location, lastSaveFolder, headers;
  if (["Audacity", "audio"].includes(format)) {
    // Audacity exports one label file per file in results
    const response = await window.electron.selectDirectory(defaultPath);
    if (response.canceled) return;
    location = response.filePaths[0];
    lastSaveFolder = location;
  } else {
    let filename;
    if (format === 'summary'){
      filename = 'detection-summary.csv';
      const {cname, sname} = i18n.get(i18n.SpeciesList)
      const {calls, detections, max} = i18n.get(i18n.Headings)
      headers = {cname, sname, count:detections, calls, max};

    } else {
      filename = species || "All";
      filename += format == "Raven" ? `_selections.txt` : "_detections.csv";
    }
    const filePath = p.join(defaultPath, filename);
    location = await window.electron.exportData({ defaultPath: filePath });
    if (!location) return;
    lastSaveFolder = p.dirname(location);
  }
  worker.postMessage({
    action: "export-results",
    path: location,
    format,
    headers,
    duration,
    species,
    files: isExplore() ? [] : STATE.openFiles,
    explore: isExplore(),
    limit,
    range: isExplore() ? STATE.explore.range : undefined,
  });
  localStorage.setItem("lastSaveFolder", lastSaveFolder);
}

const handleLocationFilterChange = (e) => {
  const value = e.target.value;
  const parsed = value === "" ? undefined : parseInt(value, 10);
  const location = Number.isFinite(parsed) ? parsed : undefined;
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

const clearLocationFilter = () =>   // Clear any species/location filters from explore/charts
  worker.postMessage({
    action: "update-state",
    locationID: undefined,
  });

/**
 * Activates chart visualization mode in the UI.
 *
 * This asynchronous function transitions the application into chart mode by saving the current
 * analysis state, updating menu items to reflect the mode change, and instructing the worker to
 * adjust its mode and fetch detected species. It sets up a location filter with an associated event
 * handler, destroys any existing spectrogram to prevent conflicts, and updates the display to show
 * the records container for chart visualization.
 *
 * @async
 */
async function showCharts() {
  saveAnalyseState();
  clearLocationFilter();
  const state = STATE.currentAnalysis;
  if (state.currentFile) utils.enableMenuItem(["active-analysis"]);
  utils.enableMenuItem(["explore"]);
  utils.disableMenuItem([
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
  // Prevent the wavesurfer error
  spec.spectrogram && spec.spectrogram.destroy();
  spec.spectrogram = null;
  utils.hideAll();
 
  utils.showElement(["recordsContainer"]);
  callForChart();
}


/**
 * Switches the UI to Explore mode, updating state, menus, and worker communication.
 *
 * Enables relevant menu items, sets analysis state flags, requests detected species and location filters from the worker, and reinitializes the spectrogram. Resets analysis results and adjusts the UI layout for Explore mode.
 */
async function showExplore() {
  // Change STATE.fileLoaded this one time, so a file will load!
  STATE.fileLoaded = true;
  saveAnalyseState();
  STATE.openFiles = [];
  const state = STATE.currentAnalysis;
  utils.enableMenuItem([
    "saveCSV",
    "save-eBird",
    "save-summary",
    "save-Raven",
    "charts",
  ]);
  if (state.currentFile) utils.enableMenuItem(["active-analysis"]);

  utils.disableMenuItem(["explore", "save2db"]);
  // Tell the worker we are in Explore mode
  worker.postMessage({ action: "change-mode", mode: "explore" });
  worker.postMessage({
    action: "get-detected-species-list",
    range: STATE.explore.range,
  });
  const locationFilter = await generateLocationList("explore-locations");
  locationFilter.addEventListener("change", handleLocationFilterChange);
  utils.hideAll();
  utils.showElement(["exploreWrapper", "spectrogramWrapper"], false);
  spec.reInitSpec(config.specMaxHeight);
  worker.postMessage({ action: "update-state", filesToAnalyse: [] });
  // Analysis is done
  STATE.analysisDone = true;
  filterResults({
    species: undefined,
    range: STATE.explore.range,
  });
  resetResults();
  // Prevent scroll up hiding navbar
  await spec.adjustDims();
}

/**
 * Initiates the audio analysis workflow.
 *
 * This asynchronous function restores the previously saved analysis state and configures the UI and worker
 * process for a new analysis cycle. It disables the active analysis menu item, updates the worker mode,
 * and destroys any existing spectrogram instance to avoid conflicts. If an audio file is loaded, it
 * reveals the spectrogram UI, reinitializes the spectrogram, and updates the worker with the current state.
 * Depending on whether analysis was already completed, it either filters the results or reloads the audio file for analysis.
 * Finally, it resets the displayed results.
 *
 * @async
 */
async function showAnalyse() {
  utils.disableMenuItem(["active-analysis"]);
  //Restore STATE
  STATE = { ...STATE, ...STATE.currentAnalysis };
  worker.postMessage({ action: "change-mode", mode: STATE.mode });
  clearLocationFilter();
  // Prevent the wavesurfer error
  if (spec.spectrogram) {
    spec.spectrogram.destroy();
    spec.spectrogram = null;
  }
  utils.hideAll();
  if (STATE.currentFile) {
    utils.showElement(["spectrogramWrapper"], false);
    spec.reInitSpec(config.specMaxHeight);
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

// We add the handler to the whole table as the body gets replaced and the handlers on it would be wiped
const results = document.getElementById("results");
results.addEventListener("click", debounceClick(resultClick));
const selectionTable = document.getElementById("selectionResultTableBody");
selectionTable.addEventListener("click", debounceClick(resultClick));

/**
 * Activates a result row and loads the corresponding audio region when a result table row is clicked.
 *
 * If the clicked element is a "circle", waits for the audio file to finish loading before retrieving selection results.
 *
 * @param {Event} e - The click event on a result row.
 * @returns {Promise<void>}
 */
async function resultClick(e) {
  if (!STATE.fileLoaded) {
    console.warn("Cannot process click - no audio file is loaded");
    return;
  }
  let row = e.target.closest("tr");
  if (!row || row.classList.length === 0 || row.closest("#resultsHead")) {
    // 1. clicked and dragged, 2 no detections in file row 3. clicked a header
    return;
  }
  const {file, start, end, cname:label} = unpackNameAttr(row);

  if (activeRow) activeRow.classList.remove("table-active");
  row.classList.add("table-active");
  activeRow = row;
  activeRow.scrollIntoView({ behavior: "instant", block: "nearest",  inline: "nearest" });
  if (this.closest("#results")) {
    // Don't do this after "analyse selection"
    loadResultRegion({ file, start, end, label });
  }
  if (e.target.classList.contains("circle")) {
    await utils.waitFor(() => STATE.fileLoaded);
    getSelectionResults(true);
  }
}

/**
 * Activates the result table row matching the given start time for the current file.
 *
 * Deactivates any previously active row, highlights the matching row, and scrolls it into view.
 *
 * @param {number} start - The start time identifying the row to activate.
 */
function setActiveRow(start) {
  const rows = DOM.resultTable.querySelectorAll("tr");
  for (const r of rows) {
    const {file, start:rowStart} = unpackNameAttr(r);

    if (file === STATE.currentFile && Number(rowStart) === start) {
      // Clear the active row if there's one
      if (activeRow && activeRow !== r) {
        activeRow.classList.remove("table-active");
      }
      // Add the 'table-active' class to the target row
      r.classList.add("table-active");
      activeRow = r; // Update the active row reference

      activeRow.scrollIntoView({ behavior: "instant", block: "center" });
      break; // Exit loop once the target row is found
    }
  }
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
  STATE.windowLength = Math.max(STATE.windowLength, (end-start) * 1.5);
  let windowOffsetSecs = STATE.windowOffsetSecs;
  const middle = (end-start)/2
  windowOffsetSecs = Math.max(0, start - STATE.windowLength / 2 + middle);
  STATE.activeRegion = {
    start: Math.max(start - windowOffsetSecs, 0),
    end: end - windowOffsetSecs,
    label,
  };
  const position = spec.wavesurfer
    ? utils.clamp(spec.wavesurfer.getCurrentTime() / STATE.windowLength, 0, 1)
    : 0;
  postBufferUpdate({
    file,
    begin: windowOffsetSecs,
    position,
    goToRegion: true,
  });
};


///////////////// Font functions ////////////////
// Function to set the font size scale
async function setFontSizeScale(doNotScroll) {
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
  STATE.currentFile && await flushSpec();
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

/////////////////////////  Window Handlers ////////////////////////////
// Set config defaults
const defaultConfig = {
  // training
  training: {
    datasetLocation: '',
    cacheLocation: '',
    customModel: {location:'', type:'replace'},
    settings: {
      useCache: false, 
      lr: 0.0001, 
      hidden: 0, 
      dropout: 0, 
      epochs: 10,
      validation: 0.2,
      decay: false,
      mixup: false,
      labelSmoothing: 0,
      useWeights: false,
      useFocal: false,
      useNoise: false
    }
  },
  library: {
    location: undefined,
    format: "ogg",
    auto: false,
    trim: false,
    clips: false,
  },
  database: { location: undefined },
  fontScale: 1,
  seenTour: false,
  lastUpdateCheck: 0,
  UUID: null,
  colormap: "roseus",
  specMaxHeight: 260,
  specLabels: true,
  specDetections: true,
  customColormap: {
    loud: "#ff7b00",
    mid: "#850035",
    quiet: "#000000",
    quietThreshold: 0.0,
    midThreshold: 0.5,
    windowFn: "hann",
    alpha: 0.5
  },
  timeOfDay: true,
  list: "birds",
  models: {
    birdnet: {displayName: 'BirdNET', backend: 'webgpu', customListFile: ''},
    chirpity: {displayName: 'Nocmig', backend: 'webgpu', customListFile: ''},
    nocmig: {displayName: 'Nocmig V2 (Beta)', backend: 'webgpu', customListFile: ''},
  },
  local: true,
  speciesThreshold: 0.03,
  useWeek: false,
  selectedModel: "birdnet",
  locale: "en",
  latitude: 52.87,
  longitude: 0.89,
  location: "Great Snoring, North Norfolk",
  detect: {
    nocmig: false,
    autoLoad: false,
    contextAware: false,
    merge: false,
    combine: false,
    confidence: 45,
    iucn: true,
    iucnScope: "Global",
    topRankin: 1
  },
  filters: {
    active: false,
    highPassFrequency: 0,
    lowPassFrequency: 15000,
    lowShelfFrequency: 0,
    lowShelfAttenuation: 0,
    SNR: 0,
    normalise: false,
    sendToModel: false,
  },
  warmup: true,
  hasNode: true,
  tensorflow: { threads: null, batchSize: 8 },
  webgpu: { threads: 1, batchSize: 8 },
  audio: {
    gain: 0,
    format: "mp3",
    bitrate: 192,
    quality: 5,
    downmix: false,
    padding: false,
    fade: false,
    notification: true,
    frequencyMin: 0,
    frequencyMax: 11950,
  },
  limit: 500,
  debug: false,
  VERSION: VERSION,
  fileStartMtime: false,
  keyAssignment: {},
};
let dirname, appPath, tempPath, systemLocale, isMac;
window.onload = async () => {
  window.electron.requestWorkerChannel();
  await diagnosticsReady;
  defaultConfig.tensorflow.threads = DIAGNOSTICS["Physical Cores"] || 2;
  isMac = await window.electron.isMac();
  if (isMac) replaceCtrlWithCommand();
  DOM.contentWrapper.classList.add("loaded");

  // Load preferences and override defaults
  [appPath, tempPath, systemLocale, dirname] = await getPaths();
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
  document.getElementById("version").textContent = VERSION;
  const configPath = p.join(appPath, "config.json");
  const configFile = await fs.promises.readFile(configPath, "utf8").catch(err =>{
    console.log("Config not found, using defaults", err);
    config = defaultConfig
  });
  
  if (configFile) {
    config = JSON.parse(configFile);
    //fill in defaults - after updates add new items
    utils.syncConfig(config, defaultConfig);
  }

  const installDate = localStorage.getItem("installDate");
  const {appId, installedAt} = await window.electron.getInstallInfo(installDate);
  if (!installDate || ! isNaN(Number(installDate))) {
    let effectiveDate = installedAt;
    if (installDate) {
      const localDate = Number(installDate);
      if (!isNaN(localDate) && localDate < new Date(installedAt).getTime())  {
        effectiveDate = new Date(localDate).toISOString();
      }
      console.log('converting install date to', effectiveDate)
    } 
    localStorage.setItem("installDate", effectiveDate)
  }
  config.UUID ??= appId;
  config.installedAt = installedAt;
  if (isTestEnv) console.log(`UUID: ${config.UUID}, `)
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


  const isMember = await membershipCheck()
    .catch(err => {console.error(err); return false});
  STATE.isMember = isMember;

  
  const { library, database, detect, filters, audio, 
    limit, locale, speciesThreshold, list, useWeek, 
    local, debug, fileStartMtime, specDetections, UUID } = config;
  
  let modelPath = config.models[config.selectedModel].modelPath;
  if (modelPath){
    if (!fs.existsSync(modelPath)) {
      generateToast({ type: "error", message: "modelPathNotFound", variables: {modelPath} });
      worker.postMessage({action: "update-state",
        modelPath: undefined,
        model: 'birdnet'
      });
      config.selectedModel = 'birdnet';
      modelPath = undefined;
    }
  }
  const selectedModel = config.selectedModel;

  updateListOptions(selectedModel);
  if (detect.combine) document.getElementById('model-icon').classList.remove('d-none')
  debug && document.getElementById('dataset').classList.remove('d-none')
  isMember && updateModelOptions();

  worker.postMessage({
    action: "update-state",
    model: selectedModel,
    library,
    database,
    path: appPath,
    temp: tempPath,
    lat: config.latitude,
    lon: config.longitude,
    place: config.location,
    detect,
    filters,
    audio,
    limit,
    locale,
    speciesThreshold,
    list,
    useWeek,
    local,
    UUID,
    debug,
    fileStartMtime,
    specDetections,
  });
  t0_warmup = Date.now();
  if (isTestEnv) {
    config.models[selectedModel].backend = "tensorflow";
  }
  const backend = config.models[config.selectedModel].backend;

  worker.postMessage({
    action: "_init_",
    model: selectedModel,
    batchSize: config[backend].batchSize,
    threads: config[backend].threads,
    backend,
    list,
    modelPath
  });
  // Disable SNR
  config.filters.SNR = 0;

  // set version
  config.VERSION = VERSION;
  DIAGNOSTICS["UUID"] = config.UUID;

  // Set UI option state
  // Fontsize
  config.fontScale === 1 || setFontSizeScale(true);

  // Map slider value to batch size
  DOM.batchSizeSlider.value = 
    config[config.models[config.selectedModel].backend].batchSize;
  DOM.batchSizeValue.textContent =
    config[config.models[config.selectedModel].backend].batchSize;
  DOM.modelToUse.value = config.selectedModel;
  const backendEL = document.getElementById(config.models[config.selectedModel].backend);
  backendEL.checked = true;
  // Show time of day in results?
  setTimelinePreferences();
  // Show the list in use
  DOM.listToUse.value = config.list;
  DOM.localSwitch.checked = config.local;
  // Show Locale
  DOM.locale.value = config.locale;
  LIST_MAP = i18n.get(i18n.LIST_MAP);
  // Localise UI
  i18n.localiseUI(DOM.locale.value).then((result) => (STATE.i18n = result));
  initialiseDatePicker(STATE, worker, config, resetResults, filterResults, generateToast);
  STATE.picker.options.lang = DOM.locale.value.replace("_uk", "");

  // remember audio notification setting
  DOM.audioNotification.checked = config.audio.notification;
  // Zoom H1E filestart handling:
  document.getElementById("file-timestamp").checked = config.fileStartMtime;

  // timeline
  DOM.timelineSetting.value = config.timeOfDay ? "timeOfDay" : "timecode";
  // Spectrogram colour
  if (config.colormap === "igreys") config.colormap = "gray";
  DOM.colourmap.value = config.colormap;

  // Spectrogram labels
  DOM.specLabels.checked = config.specLabels;
  // Show all detections
  DOM.specDetections.checked = config.specDetections;
  // Spectrogram frequencies
  DOM.fromInput.value = config.audio.frequencyMin;
  DOM.fromSlider.value = config.audio.frequencyMin;
  DOM.toInput.value = config.audio.frequencyMax;
  DOM.toSlider.value = config.audio.frequencyMax;
  fillSlider(DOM.fromInput, DOM.toInput, "#C6C6C6", "#0d6efd", DOM.toSlider);
  checkFilteredFrequency();
  // Window function & colormap
  document.getElementById("window-function").value =
    config.customColormap.windowFn;
  config.customColormap.windowFn === "gauss" &&
    document.getElementById("alpha").classList.remove("d-none");
  config.colormap === "custom" &&
    document.getElementById("colormap-fieldset").classList.remove("d-none");
  const {loud, mid, quiet, quietThreshold, midThreshold, alpha} = config.customColormap;
  document.getElementById("quiet-color-threshold").textContent = quietThreshold;
  document.getElementById("quiet-color-threshold-slider").value = quietThreshold;
  document.getElementById("mid-color-threshold").textContent = midThreshold;
  document.getElementById("mid-color-threshold-slider").value = midThreshold;
  document.getElementById("loud-color").value = loud;
  document.getElementById("mid-color").value = mid;
  document.getElementById("quiet-color").value = quiet;
  document.getElementById("alpha-slider").value = alpha;
  document.getElementById("alpha-value").textContent = alpha;
  
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
  document.getElementById("merge-detections").checked = config.detect.merge;
  document.getElementById("combine-detections").checked = config.detect.combine;
  document.getElementById("auto-load").checked = config.detect.autoLoad;
  document.getElementById("iucn").checked = config.detect.iucn;
  document.getElementById("iucn-scope").selected = config.detect.iucnScope;
  handleModelChange(config.selectedModel, false)
  // List appearance in settings
  DOM.speciesThreshold.value = config.speciesThreshold;
  document.getElementById("species-week").checked = config.useWeek;
  DOM.customListFile.value = config.models[config.selectedModel].customListFile;
  if (!DOM.customListFile.value) delete LIST_MAP.custom;
  // And update the icon
  updateListIcon();
  setListUIState(list)
  contextAwareIconDisplay();
  DOM.debugMode.checked = config.debug;
  showThreshold(config.detect.confidence);
  showTopRankin(config.detect.topRankin)

  // Filters
  document.getElementById("HP-threshold").textContent = formatHz(config.filters.highPassFrequency);
  document.getElementById("highPassFrequency").value = config.filters.highPassFrequency;
  const lowPass = document.getElementById("lowPassFrequency")
  lowPass.value = Number(lowPass.max) - config.filters.lowPassFrequency;
  document.getElementById("LP-threshold").textContent = formatHz(config.filters.lowPassFrequency);
  document.getElementById("lowShelfFrequency").value = config.filters.lowShelfFrequency;
  document.getElementById("LowShelf-threshold").textContent = formatHz(config.filters.lowShelfFrequency);
  DOM.attenuation.value = -config.filters.lowShelfAttenuation;
  document.getElementById("attenuation-threshold").textContent = DOM.attenuation.value + "dB";
  DOM.sendFilteredAudio.checked = config.filters.sendToModel;
  filterIconDisplay();
  if (config.models[config.selectedModel].backend === "webgpu") {
    DOM.threadSlider.max = 6;
  } else {
    DOM.threadSlider.max = DIAGNOSTICS["Cores"];
  }
  DOM.batchSizeSlider.max = Math.max(parseInt(160 / (24576 / GPU_RAM)), 32);
  DOM.threadSlider.value = config[config.models[config.selectedModel].backend].threads;
  DOM.numberOfThreads.textContent = DOM.threadSlider.value;
  DOM.defaultLat.value = config.latitude;
  DOM.defaultLon.value = config.longitude;
  place.innerHTML =
    '<span class="material-symbols-outlined">fmd_good</span>' +
    config.location;
  if (config.library.location) {
    document.getElementById("library-location").value =
      config.library.location;
    document.getElementById("library-format").value = config.library.format;
    document.getElementById("library-trim").checked = config.library.trim;
    document.getElementById("library-clips").checked = config.library.clips;
    const autoArchive = document.getElementById("auto-library");
    autoArchive.checked = config.library.auto;
  }
  if (config.database.location) {
    document.getElementById("database-location").value =
      config.database.location;
  }
  


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
  // Add cpu model & memory to config
  config.CPU = DIAGNOSTICS["CPU"];
  config.RAM = DIAGNOSTICS["System Memory"];
  config.GPUs = DIAGNOSTICS["GPUs"];
  trackVisit(config);

  // check for new version on Intel mac platform. dmg auto-update not yet working
  // window.electron.isIntelMac() && !isTestEnv && checkForIntelMacUpdates();
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
        case "clear-loading": {
          loadingFiles({hide:true})
          DOM.loadingScreen.classList.add('d-none')
          break;
        }
        case "footer-progress": {
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
          config.library.location &&
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
          if (args.message.includes("archive.sqlite")) {
            config.database.location = undefined;
            document.getElementById("database-location").value = '';
            updatePrefs("config.json", config);
          }
          if (args.complete) {
            STATE.training = false;
            powerSave(false);
            disableSettingsDuringAnalysis(false)
            document.getElementById('train').classList.remove('disabled')
          }
          if (args.model) {
            expungeModal.hide();
            document.getElementById('expunge').classList.remove('disabled');
          }
          if (args.history){
            plotTrainingHistory(args.history)
          }
          if (args.updateFilenamePanel) {
            renderFilenamePanel();
            window.electron.unsavedRecords(false);
            document.getElementById("unsaved-icon").classList.add("d-none");
          }
          if (args.file) {
            // Clear the file loading overlay:
            loadingFiles({hide: true})
            MISSING_FILE = args.file;
            const i18 = i18n.get(i18n.Locate);
            args.locate = `
                            <div class="d-flex justify-content-center mt-2">
                                <button id="locate-missing-file" class="btn btn-primary border-dark text-nowrap" style="--bs-btn-padding-y: .25rem;" type="button">
                                    ${i18.locate}
                                </button>
                                <button id="purge-from-toast" class="ms-3 btn btn-warning text-nowrap" style="--bs-btn-padding-y: .25rem;" type="button">
                                ${i18.remove}
                                </button>
                            </div>
                            `;
          }
          generateToast(args);
          // This is how we know the database update has completed
          if (args.database && config.library.auto)
            document.getElementById("compress-and-organise").click();
          break;
        }
        // Called when last result is returned from a database query
        case "database-results-complete": {
          onResultsComplete(args);
          break;
        }
        case "labels": {
          // Remove duplicate labels
          LABELS = [...new Set(args.labels)];
          // Code below to retrieve Red list data
          // if (!done){
          //   done = true;
          //               for (let i = 0;i< LABELS.length; i++){
          //                   const label = LABELS[i];
          //                   let  sname = label.split(getSplitChar())[0];
          //                   sname = IUCNtaxonomy[sname] || sname;
          //                   if (sname && ! STATE.IUCNcache[sname]) { 
          //                       await getIUCNStatus(sname)
          //                       await new Promise(resolve => setTimeout(resolve, 500))
          //                   }
          //               }
          //               }
                        
          break;
        }
        case "label-translation-needed": {
          // Called when the initial system locale isn't english
          let locale = args.locale;
          let labelFile;
          locale === "pt" && (locale = "pt_PT");
          labelFile = p.join(dirname,`labels/V2.4/BirdNET_GLOBAL_6K_V2.4_Labels_${locale}.txt`);

          readLabels(labelFile);
          break;
        }
        case "location-list": {
          LOCATIONS = args.locations;
          locationID = args.currentLocation;
          break;
        }
        case "model-ready": {
          onModelReady();
          break;
        }
        case "mode-changed": {
          const mode = args.mode;
          STATE.mode = mode;
          switch (mode) {
            case "analyse": {
              STATE.diskHasRecords &&
                !PREDICTING &&
                utils.enableMenuItem(["explore", "charts"]);
              break;
            }
            case "archive": {
              utils.enableMenuItem(["save2db", "explore", "charts"]);
              break;
            }
          }
          renderFilenamePanel()
          config.debug && console.log("Mode changed to: " + mode);
          if (["archive", "explore"].includes(mode)) {
            utils.enableMenuItem(["purge-file"]);
            // change header to indicate activation
            DOM.resultHeader.classList.replace(
              "text-bg-secondary",
              "text-bg-dark"
            );
          } else {
            utils.disableMenuItem(["purge-file"]);
            // change header to indicate deactivation
            DOM.resultHeader.classList.replace(
              "text-bg-dark",
              "text-bg-secondary"
            );
          }
          spec?.adjustDims();
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
        // called when an analysis ends, or when the filesbeingprocessed list is empty
        case "processing-complete": {
          STATE.analysisDone = true;
          break;
        }
        case "seen-species-list": {
          STATE.seenSpecies = args.list.map((item) => item.label);
          break;
        }
        case "tfjs-node": {
          // Have we gone from a no-node setting to a node one?
          const changedEnv = config.hasNode !== args.hasNode;
          if ((changedEnv || !STATE.isMember) && args.hasNode) {
            // If not using tensorflow, switch to the tensorflow backend because this faster under Node
            config.models[config.selectedModel].backend !== "tensorflow" &&
              handleBackendChange("tensorflow");
          }
          config.hasNode = args.hasNode;
          if (!config.hasNode && config.models[config.selectedModel].backend !== "webgpu") {
            // No node? Not using webgpu? Force webgpu
            handleBackendChange("webgpu");
            generateToast({ type: "warning", message: "noNode" });
            console.warn("tfjs-node could not be loaded, CPU is:", DIAGNOSTICS["CPU"]);
          }
          modelSettingsDisplay();
          break;
        }
        case "valid-species-list": {
          populateSpeciesModal(args);

          break;
        }
        case "tags": {
          STATE.tagsList = args.tags;
          // Init is passed on launch, so set up the UI
          args.init && setKeyAssignmentUI(config.keyAssignment);
          break;
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
          utils.waitFor(() => STATE.fileLoaded).then(() => showWindowDetections(args));
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
 * Creates and displays audio regions for detections within the current spectrogram window.
 *
 * Adjusts detection times relative to the current window offset and creates regions for those visible in the window. Only active detections or those allowed by configuration are processed. Optionally repositions the view to an active region.
 *
 * @param {Object} options - Options for region creation.
 * @param {Array<Object>} options.detections - Detections to display, each with `start`, `end`, and `label` properties.
 * @param {boolean} options.goToRegion - Whether to reposition the view to the active region.
 */
function showWindowDetections({ detections, goToRegion }) {
  for (const detection of detections) {
    const start = detection.start - STATE.windowOffsetSecs;
    if (start < STATE.windowLength) {
      const end = detection.end - STATE.windowOffsetSecs;
      const active = start === STATE.activeRegion?.start;
      if (!config.specDetections && !active) continue;
      const colour = active ? STATE.regionActiveColour : null;
      const setPosition = active && goToRegion;
      spec.createRegion(start, end, detection.label, setPosition, colour);
    }
  }
}

/**
 * Constructs an HTML string of table rows for bird identification data.
 *
 * Iterates through the provided collection of bird records, where each record contains a common name ("cname")
 * and a scientific name ("sname"), and generates a corresponding HTML table row for each.
 *
 * @param {Object[]} rows - Collection of bird records with properties "cname" (common name) and "sname" (scientific name).
 * @returns {string} A string containing HTML table rows for each bird record.
 */
function generateBirdIDList(rows) {
  let listHTML = "";
  for (const item in rows) {
    listHTML += `   <tr><td>${rows[item].cname}</td> <td><i>${rows[item].sname}</i></td></tr>\n`;
  }
  return listHTML;
}


const isSpeciesViewFiltered = (sendSpecies) => {
  const filtered = document.querySelector("#speciesFilter tr.text-warning");
  const species = filtered ? getSpecies(filtered) : undefined;
  return sendSpecies ? species : filtered !== null;
};

/**
 * Extracts and parses metadata fields from the `name` attribute of a table row element.
 *
 * @param {HTMLElement} el - An element within the target table row.
 * @returns {Object} An object containing the file name, start and end times (as numbers), scientific and common names, score, and model ID (as numbers).
 */
function unpackNameAttr(el) {
  const currentRow = el.closest("tr");
  let [file, start, end, sname, cname, score, modelID] = currentRow
    .getAttribute("name")
    .split("|");
  return {
    file, 
    start: parseFloat(start), 
    end: parseFloat(end), 
    sname, 
    cname, 
    score: parseInt(score),
    modelID: parseInt(modelID)
  };
}

/**
 * Retrieves the species name from a table row element.
 *
 * @param {HTMLElement} target - An element within the table row containing the species.
 * @returns {string} The species name extracted from the row.
 */
function getSpecies(target) {
  const row = target.closest("tr");
  const speciesCell = row.querySelector(".cname .cname");
  const species = speciesCell.textContent.split("\n")[0];
  return species;
}



/**
 * Asynchronously saves an audio clip using Electron's file system API.
 *
 * @param {Object} options - Parameters for saving the audio clip.
 * @param {*} options.file - The audio file data to be saved.
 * @param {string} options.filename - The name under which to save the audio file.
 * @param {string} options.extension - The file extension to use for the saved file.
 */
async function onSaveAudio({ file, filename, extension }) {
  await window.electron.saveFile({
    file: file,
    filename: filename,
    extension: extension,
  });
}



/**
 * Processes chart data to update the UI and render a new Chart.js chart.
 *
 * This function updates UI elements based on the provided chart data. If a species name is given,
 * it displays the species title and toggles visibility of the associated records table; otherwise,
 * the records table is hidden. It then updates individual record elements with formatted dates or
 * "N/A"/"No Records" messages. Any existing Chart.js instances are destroyed before constructing a new
 * chart on the canvas element with the id "chart-week". The chart configuration includes bar datasets
 * for each year (with an adjustment for hourly data) and, if provided, a line dataset displaying total
 * hours recorded. A custom plugin is used to set the background color of the canvas.
 *
 * @param {Object} args - An object containing chart configuration and data.
 * @param {string} [args.species] - The species name to display; its presence toggles the records table.
 * @param {Object} args.records - A mapping of DOM element IDs to record values (arrays or timestamps) used to update record displays.
 * @param {string} args.aggregation - The aggregation level (e.g., "Hour") which determines chart label generation.
 * @param {number} args.pointStart - The starting timestamp for the data points; may be adjusted for hourly charts.
 * @param {Object} args.results - An object where each key is a year and each value is an array of data points for that year.
 * @param {number[]} [args.total] - Optional dataset representing total hours recorded, rendered as a line chart if provided.
 * @param {number} args.dataPoints - The number of data points to generate date labels for the x-axis.
 * @param {number} args.rate - A data rate value included in the arguments (currently unused in chart rendering).
 */

let chartInstance;

function getDateOfISOWeek(week, year) {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dayOfWeek = simple.getDay();
  const isoWeekStart = new Date(simple);
  const diff = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
  isoWeekStart.setDate(simple.getDate() + diff);
  return isoWeekStart;
}

function formatWeekRange(week, year) {
  const locale = config.locale.replace("en_uk", "en-GB").replace('_', '-');

  const start = getDateOfISOWeek(week, year);
  if (isNaN(start.getTime())) return week;
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const monthOpts = { month: 'long' };

  const startStr = `${start.toLocaleDateString(locale, { day: 'numeric' })}`;
  const endStr =
    end.toLocaleDateString(locale, { day: 'numeric', ...monthOpts });

  // If start and end are in different months, show both
  if (start.getMonth() !== end.getMonth()) {
    const startFull =
      `${start.toLocaleDateString(locale, { day: 'numeric', ...monthOpts })}`;
    return `${startFull} – ${endStr}`;
  }

  // Same month → “5–11 February”
  return `${startStr}–${endStr}`;
}

function onChartData(args) {
  const i18 = i18n.get(i18n.ChartUI)
  const {records, aggregation, pointStart, results, rate, startX} = args;
  const dataPoints = Object.values(results)[0]?.length;
  const species = args.species || "";
  if (species) {
    utils.showElement(["recordsTableBody"], false);
    const title = document.getElementById("speciesName");
    title.textContent = species;
  } else {
    utils.hideElement(["recordsTableBody"]);
  }
  // Destroy the existing charts (if any)
  const chartInstances = Object.values(Chart.instances);
  chartInstances.forEach((chartInstance) => {
    chartInstance.destroy();
  });

  // Get the Chart.js canvas
  const chartCanvas = document.getElementById("chart-week");

  for (const [key, value] of Object.entries(records)) {
    const element = document.getElementById(key);
    if (value?.constructor === Array) {
      if (isNaN(value[0])) element.textContent = i18.NR
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
        : i18.NR;
    }
  }

  const total = args.total;
  // start hourly charts at midday if no filter applied
  const start =
    STATE.chart.range.start || aggregation !== "hour"
      ? pointStart
      : pointStart + 12 * 60 * 60 * 1000;
  const dateLabels = generateDateLabels(aggregation, dataPoints, start, startX);

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
        label: isNaN(year) ? i18.AY : year,
        data,
        // backgroundColor: 'rgba(255, 0, 64, 0.5)',
        borderWidth: 1,
        // borderColor: 'rgba(255, 0, 64, 0.9)',
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
          text: utils.interpolate(i18.NoD, {species}).replace("()", ""),
        },
        customCanvasBackgroundColor: {
          color: "GhostWhite",
        },
        tooltip: aggregation === "week" ? { 
        callbacks: {
          title: (items) => {
            const week = items[0].label;
            const key = items[0].dataset.label;
            const year = isNaN(parseInt(key)) ? new Date().getFullYear() : parseInt(key);
            return formatWeekRange(week, year);
          }
        }
      } : undefined
      },
    },
    plugins: [plugin],
  };
  if (total) {
    chartOptions.data.datasets.unshift({
      label: i18.HR,
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
      title: { display: true, text: i18.HoR },
    };
    chartOptions.options.scales.x = {
      max: 53,
      title: { display: true, text: i18.WiY },
    };
  }
  chartInstance = new Chart(chartCanvas, chartOptions);
}

function generateDateLabels(aggregation, datapoints, pointstart, startX) {
  const dateLabels = [];
  const startDate = new Date(pointstart);
  if (aggregation === "week") {
    return Array.from({length: datapoints }, (_, i) => startX + i);
  }
  for (let i = 0; i < datapoints; i++) {
    // Push the formatted date label to the array
    dateLabels.push(formatDate(startDate, aggregation));

    // Increment the startDate based on the aggregation
    if (aggregation === "hour") {
      startDate.setTime(startDate.getTime() + 60 * 60 * 1000); // Add 1 hour
    } else if (aggregation === "day") {
      startDate.setDate(startDate.getDate() + 1); // Add 1 day
    }
  }
  return dateLabels;
}

// Helper function to format the date as desired
function formatDate(date, aggregation) {
  const options = {};
  let formattedDate = "";
  const locale = config.locale.replace("en_uk", "en-GB").replace('_', '-');
  if (aggregation === "week") {
    // Add 1 day to the startDate
    date.setHours(date.getDate() );
    const year = date.getFullYear();
    const oneJan = new Date(year, 0, 1);
    const weekNumber = Math.ceil(
      ((date - oneJan) / (24 * 60 * 60 * 1000) + oneJan.getDay() ) / 7
    );
    return weekNumber;
  } else if (aggregation === "day") {
    options.day = "numeric";
    // options.weekday = "short";
    options.month = "short";
  } else if (aggregation === "hour") {
    const timeString = new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      hour12: true
    }).format(date);
    // const hour = date.getHours();
    // const period = hour >= 12 ? "PM" : "AM";
    // const formattedHour = hour % 12 || 12; // Convert 0 to 12
    // return `${formattedHour}${period}`;
    return timeString;
  }
  
  return formattedDate + date.toLocaleDateString(locale, options);
}

window.addEventListener("resize", function () {
  utils.waitForFinalEvent(
    async function () {
      await spec.adjustDims(true);
    },
    100,
    "id1"
  );
});

/**
 * Debounces keydown event handling for non-input elements.
 *
 * If the keydown event does not originate from an input, textarea, or custom select element, prevents its default action and schedules the keydown handler to run after a short delay.
 *
 * @param {KeyboardEvent} e - The keydown event.
 */
function handleKeyDownDeBounce(e) {
  if (
    !(
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof CustomSelect
    )
  ) {
    e.preventDefault();
    utils.waitForFinalEvent(
      function () {
        handleKeyDown(e);
      },
      50,
      "keyhandler"
    );
  }
}

function debounceClick(handler, delay = 250) {
  let timeout;
  return function (e) {
    if (timeout) {
      // If second click within delay, ignore
      return;
    }
    handler.call(this, e); // Preserve `this` context
    timeout = setTimeout(() => {
      timeout = null;
    }, delay);
  };
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
  if (!config) return;
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
 * Sets the specified audio region as active, updating UI highlights and playhead position.
 *
 * Clears any previously active regions, applies active styling to the selected region, updates the global active region state, and moves the playhead to the region's start. Enables relevant menu items for exporting audio and, if available, analyzing the selection. Optionally activates the corresponding result row in the UI.
 *
 * @param {Object} region - The audio region to activate, containing start and end times and label content.
 * @param {boolean} [activateRow] - If true, also activates the corresponding result row.
 *
 * @remark
 * If the region is invalid (missing or with non-numeric start/end), the function logs an error and does not update the state.
 */
function setActiveRegion(region, activateRow) {
  if (
    !region ||
    typeof region.start !== "number" ||
    typeof region.end !== "number"
  ) {
    console.error("Invalid region:", region);
    return;
  }
  const { start, end, content } = region;
  // Clear active regions
  spec.REGIONS.regions.forEach((r) =>
    r.setOptions({
      color: STATE.regionColour,
      content: spec.formatLabel(r.content?.innerText),
    })
  );
  // Set the playhead to the start of the region
  const label = content?.innerText || "";
  const labelEl = spec.formatLabel(label, "gold");
  STATE.activeRegion = { start, end, label };
  region.setOptions({ color: STATE.regionActiveColour, content: labelEl });
  utils.enableMenuItem(["export-audio"]);
  if (modelReady && !PREDICTING) {
    utils.enableMenuItem(["analyseSelection"]);
  }
  activateRow && setActiveRow(start + STATE.windowOffsetSecs);
}

let spec = new ChirpityWS(
  "#waveform",
  () => STATE, // Returns the current state
  () => config, // Returns the current config
  { postBufferUpdate, trackEvent, setActiveRegion, onStateUpdate: state.update, updatePrefs },
  GLOBAL_ACTIONS
);

const updateListOptions = (model) => {
  const select = document.getElementById('list-to-use');
  select.replaceChildren();
  let options;
  if (/perch/i.test(model)) {
    options = ["birds", "Amphibia", "Insecta", "Mammalia", "Reptilia", "Animalia", "everything", "custom"]
  } else  {
    options = ["location", "nocturnal", "birds", "everything", "custom"];
  }
  options.forEach(option => {
    const opt = document.createElement("option");
    opt.value = option;
    opt.textContent = i18n.get(i18n.Lists)[option] || option;
    select.appendChild(opt);
  });
  if (!options.includes(config.list)) {
    config.list = "birds";
    updatePrefs("config.json", config);
    select.value = config.list;
  }
}

const updateListIcon = () => {
  const LIST_MAP = i18n.get(i18n.LIST_MAP);
  const {list} = config;
  let node;
  if (["custom", "Mammalia", "Insecta", "Animalia"].includes(list)) {
    const iconName = {
      custom: "fact_check",
      Mammalia: "pets",
      Insecta: "bug_report",
      Animalia: "voice_over_off"
    }
    node = document.createElement("span");
    node.className = "material-symbols-outlined mt-1";
    node.style.width =  "1.8rem";
    node.style.height =  "1.6rem";
    node.textContent = iconName[list];
  } else {
    if (!['location', 'birds', 'nocturnal', 'everything', 'Amphibia', "Reptilia"].includes(list)) return
    node = document.createElement("img");
    node.className = "icon filter";
    node.setAttribute("src", `img/${list}.png`);
    node.setAttribute("alt", list);
  }
  node.setAttribute("title", LIST_MAP[list] || "Unknown List");
  DOM.listIcon.replaceChildren(node);
};

const updateModelIcon = (model) => {
  let title;
  switch (model) {
    case 'birdnet':
      title = "BirdNET";
      break;
    case 'chirpity':
      title = "Nocmig";
      break;
    case 'nocmig':
      title = "Nocmig (beta)";
      break;
    case 'perch v2':
      title = "Perch V2";
      model = 'perch';
      break;
    default:
      if (/bats/i.test(model)) {
        title = "Bats";
        model = "bats";
      } else {
        title = i18n.get(i18n.Lists).custom;
        model = "custom"
      }
      
  }
  const img = document.createElement("img");
  img.className = "icon";
  img.setAttribute("src", `img/icon/${model}_logo.png`);
  img.setAttribute("alt", title);
  img.setAttribute("title", title);
  DOM.modelIcon.replaceChildren(img); // Clear existing content
}

DOM.listIcon.addEventListener("click", () => {
  if (PREDICTING) {
    generateToast({ message: "changeListBlocked", type: "warning" });
    return;
  }
  const keys = config.selectedModel !== 'perch v2' ? ["location", "nocturnal", "birds", "everything", "custom"] : ["birds", "Amphibia", "Insecta", "Mammalia", "Reptilia", "Animalia", "everything", "custom"];
  const currentListIndex = keys.indexOf(config.list);
  const next = currentListIndex === keys.length - 1 ? 0 : currentListIndex + 1;
  config.list = keys[next];
  updatePrefs("config.json", config);
  updateList();
});

DOM.customListSelector.addEventListener("click", async () => {
  const defaultPath = localStorage.getItem("customList") || "";
  const files = await window.electron.openDialog("showOpenDialog", {
    type: "Text",
    defaultPath,
  });
  if (!files.canceled) {
    DOM.customListSelector.classList.remove("btn-outline-danger");
    const customListFile = files.filePaths[0];
    config.models[config.selectedModel].customListFile = customListFile;
    DOM.customListFile.value = customListFile;
    readLabels(customListFile, "list");
    LIST_MAP = i18n.get(i18n.LIST_MAP);
    updatePrefs("config.json", config);
    localStorage.setItem("customList", customListFile);
  }
});

const loadModel = () => {
  PREDICTING = false;
  t0_warmup = Date.now();
  const {selectedModel, warmup} = config;
  const backend = isTestEnv ? 'tensorflow' : config.models[selectedModel].backend;
  const modelPath = config.models[selectedModel].modelPath;
  worker.postMessage({
    action: "load-model",
    model: selectedModel,
    batchSize: config[backend].batchSize,
    warmup,
    threads: config[backend].threads,
    backend,
    modelPath
  });
};

const handleModelChange = async (model, reload = true) => {
  modelSettingsDisplay();
  DOM.customListFile.value = config.models[model].customListFile;
  DOM.customListFile.value
    ? (LIST_MAP = i18n.get(i18n.LIST_MAP))
    : delete LIST_MAP.custom;
  const backend = config.models[model].backend;
  document.getElementById(backend).checked = true;
  if (reload) {
    handleBackendChange(backend);
  }
  updateListOptions(model);
  updateModelIcon(model);
  updateListIcon();
}

const handleBackendChange = (backend) => {
  backend = backend instanceof Event ? backend.target.value : backend;
  config.models[config.selectedModel].backend = backend;
  const backendEL = document.getElementById(backend);
  backendEL.checked = true;
  if (backend === "webgpu") {
    DOM.threadSlider.max = 6;
  } else {
    DOM.threadSlider.max = DIAGNOSTICS["Cores"];
    DOM.contextAware.disabled = false;
    if (DOM.contextAware.checked) {
      config.detect.contextAware = true;
    }
  }
  // Update threads and batch Size in UI
  DOM.threadSlider.value = config[backend].threads;
  DOM.numberOfThreads.textContent = config[backend].threads;
  DOM.batchSizeSlider.value = config[backend].batchSize;
  DOM.batchSizeValue.textContent = DOM.batchSizeSlider.value
  updatePrefs("config.json", config);
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
  if (STATE.fileLoaded) {
    // Reload wavesurfer with the new timeline
    const position = utils.clamp(
      spec.wavesurfer.getCurrentTime() / STATE.windowLength,
      0,
      1
    );
    postBufferUpdate({ begin: STATE.windowOffsetSecs, position: position });
  }
  updatePrefs("config.json", config);
};


/**
 * Updates the currently selected record using a key assignment or sets the call count with a modifier key.
 *
 * If a key assignment exists for the pressed key, updates the corresponding field (species, label, or comment) in the active row and inserts the modified record. If Ctrl or Cmd is held, sets the call count to the key's numeric value (for members only). Does nothing if no row is selected.
 *
 * @param {KeyboardEvent} e - The keyboard event triggering the update.
 */
function recordUpdate(e) {
  const {key, ctrlKey, metaKey} = e;
  const setCallCount = ctrlKey || metaKey;
  if (!activeRow) {
    console.info("No active row selected for key assignment", key);
    return;
  }
  const assignment = config.keyAssignment["key" + key];
  if ((assignment?.column && assignment?.value) || setCallCount) {
    // const {file, start, end, cname,} = unpackNameAttr(activeRow)
    let newLabel, newName, newCallCount, newConfidence, newComment;
    if (setCallCount && STATE.isMember){
      // Ctrl/Cmd + number to set call count
      newCallCount = Number(key);
    } else {
      const {column, value} = assignment;
      // If we set a new species, we want to give the record a 2000 confidence
      newName = column === "species" ? value : null;
      newConfidence = column === "species" ? 2000 : null;
      newLabel = column === "label" ? value : null;
      newComment = column === "comment" ? value : null;
    }
    // Save record for undo
    const {species, start, end,  label, callCount, 
      comment, confidence, file, modelID
    } = addToHistory(activeRow, newName);

    insertManualRecord({
      files: file,
      cname: newName ?? species,
      start,
      end,
      comment: newComment ?? comment,
      count: newCallCount ?? callCount,
      label: newLabel ?? label,
      action: "Update",
      batch: false,
      originalCname: species,
      confidence: newConfidence ?? confidence,
      modelID
    });
  }
}

function disableSettingsDuringAnalysis(bool) {
  const elements = [
    "modelToUse",
    "threadSlider",
    "batchSizeSlider",
    "locale",
    "listToUse",
    "customListContainer",
    "localSwitchContainer",
    "speciesThreshold",
    "speciesWeek",
    "contextAware",
    "sendFilteredAudio",
  ];
  elements.forEach((el) => {
    if (DOM[el]) DOM[el].disabled = bool;
    else throw new Error(`${el} is not in the DOM cache`);
  });
  if (STATE.isMember){
    DOM.backendOptions?.forEach((backend) => (backend.disabled = bool));
  }
}


// Go to position
const goto = new bootstrap.Modal(document.getElementById("gotoModal"));
const showGoToPosition = () => {
  if (STATE.currentFile) {
    const gotoLabel = document.getElementById("gotoModalLabel");
    const timeHeading = config.timeOfDay
      ? i18n.get(i18n.Context).gotoTimeOfDay
      : i18n.get(i18n.Context).gotoPosition;
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
    STATE.windowLength = 20;

    start = Math.min(start, STATE.currentFileDuration);
    STATE.windowOffsetSecs = Math.max(start - STATE.windowLength / 2, 0);
    const position = start === 0 ? 0 : 0.5;
    postBufferUpdate({ begin: STATE.windowOffsetSecs, position: position });
    // Close the modal
    goto.hide();
  }
};

const gotoForm = document.getElementById("gotoForm");
gotoForm.addEventListener("submit", gotoTime);

/**
 * Custom model modals
 */
const training = new bootstrap.Modal(document.getElementById("training-modal"));
const showTraining = () => {
  const i18 = i18n.get(i18n.Training);
  const trainingTitle = document.getElementById("training-modal-label");
  trainingTitle.textContent = i18["training-modal-label"];
  // Restore training settings:
  const {datasetLocation, cacheLocation, customModel, settings} = config.training;
  const datasetLocationInput = document.getElementById("dataset-location");
  datasetLocationInput.value = datasetLocation;
  const datasetLocationLabel = document.getElementById('dataset-location-select');
  datasetLocationLabel.textContent = i18["dataset-location-select"];
  datasetLocationInput.setAttribute("placeholder", i18["dataset-placeholder"]);
  const cacheLocationInput = document.getElementById("dataset-cache-location");
  cacheLocationInput.value = cacheLocation;
  const cacheLocationLabel = document.getElementById('dataset-cache-location-select');
  cacheLocationLabel.textContent = i18["dataset-cache-location-select"];
  cacheLocationInput.setAttribute("placeholder", i18["cache-placeholder"]);
  const modelLocationInput = document.getElementById("model-location");
  modelLocationInput.value = customModel.location;
  const modelLocationLabel = document.getElementById('model-location-select');
  modelLocationLabel.textContent = i18["model-location-select"];
  modelLocationInput.setAttribute("placeholder", i18["model-placeholder"]);
  document.getElementById(customModel.type).checked = true;
  const replace = document.querySelector('label[for="replace"]');
  replace.textContent = i18["replace"];
  const append = document.querySelector('label[for="append"]');
  append.textContent = i18["append"];

  document.getElementById('training-parameters-title').textContent = i18["training-parameters-title"];
  document.getElementById('augmentations-title').textContent = i18["augmentations-title"];
  document.getElementById('classifier-title').textContent = i18["classifier-title"];


  const hiddenUnitsInput = document.getElementById('hidden-units');
  hiddenUnitsInput.value = settings.hidden;
  const hidden = document.querySelector('label[for="hidden-units"]');
  hidden.textContent = i18["hidden-units"];
  const dropout = document.getElementById('dropout');
  const dropoutLabel = document.querySelector('label[for="dropout"]');
  dropoutLabel.textContent = i18["dropout"];
  dropout.value = settings.dropout;
  dropout.disabled = !settings.hidden;
  const lr = document.getElementById('lr');
  lr.value = settings.lr;
  const lrLabel = document.querySelector('label[for="lr"]');
  lrLabel.textContent = i18["lr"];
  const epochs = document.getElementById('epochs');
  epochs.value = settings.epochs;
  const epochsLabel = document.querySelector('label[for="epochs"]');
  epochsLabel.textContent = i18["epochs"];
  const labelSmoothing = document.getElementById('label-smoothing');
  labelSmoothing.value = settings.labelSmoothing;
  const labelSmoothingLabel = document.querySelector('label[for="label-smoothing"]');
  labelSmoothingLabel.textContent = i18["label-smoothing"];
  const decay = document.getElementById('decay');
  decay.checked = settings.decay;
  const decayLabel = document.querySelector('label[for="decay"]');
  decayLabel.textContent = i18["decay"];
  // Only allow class weights if not using focal loss
  const weights = document.getElementById('weights');
  weights.checked = settings.useWeights;
  weights.disabled = settings.useFocal;
  const weightsLabel = document.querySelector('label[for="weights"]');
  weightsLabel.textContent = i18["weights"];
  document.getElementById('focal').checked = settings.useFocal;
  const focalLabel = document.querySelector('label[for="focal"]');
  focalLabel.textContent = i18["focal"];
  document.getElementById('mixup').checked = settings.mixup;
  const mixupLabel = document.querySelector('label[for="mixup"]');
  mixupLabel.textContent = i18["mixup"];
  document.getElementById('use-noise').checked = settings.useNoise;
  const useNoiseLabel = document.querySelector('label[for="use-noise"]');
  useNoiseLabel.textContent = i18["use-noise"];
  document.getElementById('useCache').checked = settings.useCache;
  const useCacheLabel = document.querySelector('label[for="useCache"]');
  useCacheLabel.textContent = i18["useCache"];
  document.getElementById('validation-split').value = settings.validation;
  const validationSplitLabel = document.querySelector('label[for="validation-split"]');
  validationSplitLabel.textContent = i18["validation-split"];

  document.getElementById('train').textContent = i18["train"];
  document.getElementById('training-dismiss').textContent = i18["training-dismiss"];


  training.show();
}

const importModal = new bootstrap.Modal(document.getElementById("import-modal"));
const showImport = () => {
  const i18 = i18n.get(i18n.ManageModels);
  const importTitle = document.getElementById("import-modal-label");
  importTitle.textContent = i18["import-model-label"];
  const modelName = document.getElementById("model-name-text");
  modelName.textContent = i18["model-name-text"];
  const modelNameInput = document.getElementById("model-name");
  modelNameInput.value = "";
  modelNameInput.setAttribute("placeholder", i18["model-name-placeholder"]);
  const modelFile = document.getElementById("import-location-select");
  modelFile.textContent = i18["import-location-select"];
  const importLocation = document.getElementById("import-location");
  importLocation.setAttribute("placeholder", i18["model-location-placeholder"]);
  const importBtn = document.getElementById("import");
  importBtn.textContent = i18["import"];

  importModal.show();
}

const expungeModal = new bootstrap.Modal(document.getElementById("expunge-modal"));
const showExpunge = () => {
  const i18 = i18n.get(i18n.ManageModels);
  const expungeTitle = document.getElementById("expunge-modal-label");
  expungeTitle.textContent = i18["expunge-modal-label"];
  const expungeModel = document.getElementById("expunge-model");
  expungeModel.textContent = i18["expunge-model"];
  const expungeWarning = document.getElementById("expunge-warning");
  expungeWarning.textContent = i18["expunge-warning"];
  const expungeBtn = document.getElementById("expunge");
  expungeBtn.textContent = i18["expunge"];
  expungeModal.show();
}
/**
 * Handles initialization tasks after the audio model is ready.
 *
 * Updates UI elements based on loaded audio files and regions, logs warm-up and launch times, hides the loading screen, requests tag data from the worker, starts the user tour for new users, and processes any queued OS file inputs.
 */
function onModelReady() {
  modelReady = true;
  updateList();
  if (STATE.fileLoaded) {
    utils.enableMenuItem(["analyse"]);
    if (STATE.openFiles.length > 1)
      utils.enableMenuItem(["analyseAll", "reanalyseAll"]);
  }
  if (STATE.activeRegion) utils.enableMenuItem(["analyseSelection"]);
  t1_warmup = Date.now();
  DIAGNOSTICS["Warm Up"] =
    ((t1_warmup - t0_warmup) / 1000).toFixed(2) + " seconds";

  APPLICATION_LOADED ||
    console.info(
      "App launch time",
      `${Math.round((t1_warmup - app_t0) / 1000)} seconds`
    );
  APPLICATION_LOADED = true;

  DOM.loadingScreen.classList.add("d-none");
  // Get all the tags from the db
  worker.postMessage({ action: "get-tags", init: true });
  // New users - show the tour
  if (!isTestEnv && !config.seenTour) {
    config.seenTour = true;
    prepTour();
  }
  if (OS_FILE_QUEUE.length) {
    onOpenFiles({ filePaths: OS_FILE_QUEUE, checkSaved: true });
    OS_FILE_QUEUE = []; // Clear the queue
  }
}

/**
 * Handles audio data loaded by the worker, updating application state, resetting regions, and refreshing the spectrogram and UI.
 *
 * Updates the current audio buffer, file metadata, timing, and UI elements after an audio file is loaded. Resets audio regions, refreshes the spectrogram display, and enables analysis menu options if a model is ready.
 *
 * @param {Object} params - Parameters for the loaded audio.
 * @param {*} params.location - Identifier for the audio source location.
 * @param {number} [params.fileStart=0] - Start time of the audio file in milliseconds since the Unix epoch.
 * @param {number} [params.fileDuration=0] - Duration of the audio file in seconds.
 * @param {number} [params.windowBegin=0] - Offset in seconds from the file start for the audio window.
 * @param {string} [params.file=""] - Full path to the audio file.
 * @param {number} [params.position=0] - Normalized playhead position (0 to 1).
 * @param {*} [params.contents] - Audio buffer containing the loaded data.
 * @param {boolean} [params.play=false] - Whether to automatically play the audio after loading.
 * @param {Object} [params.metadata] - Optional metadata for the audio file.
 * @returns {Promise<void>}
 */

async function onWorkerLoadedAudio({
  location,
  fileStart = 0,
  fileDuration,
  windowBegin = 0,
  file = "",
  position = 0,
  contents,
  play = false,
  metadata,
}) {
  loadingFiles({hide:true})
  const resetSpec = !STATE.currentFile;
  if (fileDuration) {STATE.currentFileDuration = fileDuration}
  else if (fileDuration === 0) { 
    generateToast({message: `The file ${file} has zero length`, type: 'warning'});
    console.warn(`The file ${file} has zero length`);
    return
    // Else undefined or null - exit
  } else { return }
  //if (preserveResults) completeDiv.hide();
  config.debug &&
    console.log(
      `UI received worker-loaded-audio: ${file}, play: ${play}`
    );
  // Dismiss a context menu if it's open
  DOM.contextMenu.classList.add("d-none");
  STATE.currentBuffer = contents;

  STATE.fileStart = fileStart;
  locationID = location;
  STATE.windowOffsetSecs = windowBegin;
  if (STATE.currentFile !== file) {
    STATE.currentFile = file;
    STATE.metadata[STATE.currentFile] = metadata;
    renderFilenamePanel();
  }

  const initialTime = config.timeOfDay
    ? fileStart
    : new Date(0, 0, 0, 0, 0, 0, 0).getTime();
  STATE.bufferStartTime = new Date(initialTime + windowBegin * 1000);

  if (STATE.windowLength > STATE.currentFileDuration) STATE.windowLength = STATE.currentFileDuration;

  resetRegions();
  await spec.updateSpec({
    buffer: STATE.currentBuffer,
    position: position,
    play: play,
    resetSpec: resetSpec,
  });
  // Do this after the spec has loaded the file
  STATE.fileLoaded = true;
  if (modelReady) {
    utils.enableMenuItem(["analyse"]);
    if (STATE.openFiles.length > 1) utils.enableMenuItem(["analyseAll"]);
  }
}



/**
 * Updates the pagination controls based on the total number of items.
 *
 * If the total exceeds the configured limit, pagination controls are rendered using the given offset.
 * Otherwise, all pagination elements are hidden.
 *
 * @param {number} total - The total number of items.
 * @param {number} [offset=STATE.offset] - The starting offset for pagination.
 */
function updatePagination(total, offset = STATE.offset) {
  total > config.limit ? pagination.add(total, offset) : pagination.hide();
}

const updateSummary = async ({ summary = [], filterSpecies = "" }) => {
  const i18 = i18n.get(i18n.Headings);
  const showIUCN = config.detect.iucn;

  // if (summary.length){
  let summaryHTML = summary.length
    ? `<table id="resultSummary" class="table table-dark p-1"><thead>
            <tr class="pointer col-auto text-nowrap">
            <th id="summary-max" scope="col"><span id="summary-max-icon" class="text-muted material-symbols-outlined summary-sort-icon d-none">sort</span>${
              i18.max
            }</th>
            <th id="summary-cname" scope="col">
            <span id="summary-sname-icon" class="text-muted material-symbols-outlined summary-sort-icon">filter_list</span>
            <span id="summary-cname-icon" class="text-muted material-symbols-outlined summary-sort-icon d-none">sort</span>${
              i18.species[0]
            }</th>
            ${showIUCN ? '<th scope="col"></th>' : ""}
            <th id="summary-count" class="text-end" scope="col"><span id="summary-count-icon" class="text-muted material-symbols-outlined summary-sort-icon d-none">sort</span>${
              i18.detections
            }</th>
            <th id="summary-calls" class="text-end" scope="col"><span id="summary-calls-icon" class="text-muted material-symbols-outlined summary-sort-icon d-none">sort</span>${
              i18.calls
            }</th>
            </tr>
            </thead><tbody id="speciesFilter">`
    : "";
  let selectedRow = null;
  const i18nIUCN = i18n.get(i18n.IUCNLabel);
  for (let i = 0; i < summary.length; i++) {
    const item = summary[i];
    const selected = item.cname === filterSpecies ? " text-warning" : "";
    if (selected) selectedRow = i + 1;
    summaryHTML += `<tr tabindex="-1" class="${selected}">
                <td class="max">${iconizeScore(item.max)}</td>
                    <td class="cname not-allowed">
                        <span class="cname">${item.cname}</span> <br><i>${
      item.sname
    }</i>
                    </td>`;

    if (showIUCN) {
      const species = IUCNtaxonomy[item.sname] || item.sname;
      const record = IUCNCache[species];
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
  summary.length && (summaryHTML += "</tbody></table>");
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
  setAutocomplete(selectedRow ? filterSpecies : "");
  // scroll to the selected species
  if (selectedRow) {
    const table = document.getElementById("resultSummary");
    table.rows[selectedRow].scrollIntoView({
      behavior: "instant",
      block: "center",
    });
  }
  // }
};

/**
 * Finalizes result processing by updating the results table UI and activating the appropriate result row.
 *
 * Replaces the results table with the latest data, resets analysis state, and determines which row to activate based on the provided options or current table state. Ensures the selected row is activated and scrolled into view, updates sorting indicators, and refreshes related UI panels.
 *
 * @param {Object} [options={}] - Options for determining which result row to activate.
 * @param {number} [options.active] - Index of the row to activate, if specified.
 * @param {*} [options.select] - Value used to identify the row to activate via a helper function.
 */
function onResultsComplete({ active = undefined, select = undefined } = {}) {
  PREDICTING = false; powerSave(false);
  disableSettingsDuringAnalysis(false);
  DOM.resultTable.replaceWith(resultsBuffer.cloneNode(true));
  resultsBuffer.textContent = "";
  const table = DOM.resultTable;
  utils.showElement(["resultTableContainer", "resultsHead"], false);
  const labelSort = document.getElementById("sort-label");
  if (labelSort) {
    labelSort.classList.toggle("text-warning", STATE.labelFilters?.length > 0);
    if (!labelSort.querySelector("span.fs-6")) {
      const span = document.createElement("span");
      span.className = "material-symbols-outlined fs-6";
      span.textContent = "menu_open";
      labelSort.appendChild(span);
      span.classList.add(`${STATE.isMember ? "text-muted" : "locked"}`);
    }
  }
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
    utils.waitFor(() => STATE.fileLoaded).then(() => activeRow.click());
    activeRow.scrollIntoView({ behavior: "instant", block: "center" });
  }
  renderFilenamePanel();
  activateResultSort();
}


/**
 * Returns the index of the first table row whose parsed start time matches the specified value.
 *
 * @param {HTMLTableElement} table - The table to search.
 * @param {number} start - The start time to match.
 * @returns {number|undefined} The index of the matching row, or undefined if not found.
 */
function getRowFromStart(table, start) {
  for (var i = 0; i < table.rows.length; i++) {
    const row = table.rows[i];
    const startTime = unpackNameAttr(row).start || 0;

    // Check if the second value matches the 'select' variable
    if (parseFloat(startTime) === start) {
      return i;
    }
  }
}

/**
 * Finalizes the audio analysis process by updating application state, restoring UI controls, and logging diagnostics.
 *
 * Resets prediction status, re-enables settings, updates analysis completion state, and manages menu item availability based on whether disk records exist. Hides the progress indicator. If not in quiet mode, logs analysis duration and rate, tracks relevant events, updates diagnostics, and displays a completion notification.
 *
 * @param {Object} options - Analysis completion options.
 * @param {boolean} options.quiet - If true, suppresses diagnostic tracking and notifications.
 */
function onAnalysisComplete({ quiet }) {
  PREDICTING = false; powerSave(false);
  disableSettingsDuringAnalysis(false);
  STATE.analysisDone = true;
  STATE.diskHasRecords && utils.enableMenuItem(["explore", "charts"]);
  if (quiet) return;
  // DIAGNOSTICS:
  t1_analysis = Date.now();
  const analysisTime = ((t1_analysis - t0_analysis) / 1000).toFixed(2);
  const duration = STATE.selection
    ? STATE.selection.end - STATE.selection.start
    : DIAGNOSTICS["Audio Duration"];
  const rate = duration / parseFloat(analysisTime);

  trackEvent(
    config.UUID,
    `${config.selectedModel}-${config.models[config.selectedModel].backend}`,
    "Audio Duration",
    config.models[config.selectedModel].backend,
    Math.round(duration)
  );

  if (!STATE.selection) {
    trackEvent(
      config.UUID,
      `${config.selectedModel}-${config.models[config.selectedModel].backend}`,
      "Analysis Rate",
      config.models[config.selectedModel].backend,
      parseInt(rate)
    );
    trackEvent(
      config.UUID,
      `${config.selectedModel}-${config.models[config.selectedModel].backend}`,
      "Analysis Duration",
      config.models[config.selectedModel].backend,
      parseInt(analysisTime)
    );
    DIAGNOSTICS["Analysis Duration"] = utils.formatDuration(analysisTime);
    DIAGNOSTICS["Analysis Rate"] =
      rate.toFixed(0) + "x faster than real time performance.";
    generateToast({ message: "complete" });
    displayProgress({percent: 100});
  }
  worker.postMessage({ action: "update-state", selection: false });
}

/**
 * Updates the UI after summary data is loaded, refreshing the summary table, enabling or disabling menu items, and applying species filters if provided.
 *
 * @param {Object} options - Parameters for updating the summary view.
 * @param {*} [options.filterSpecies] - Optional filter to restrict summary to specific species.
 * @param {Array} [options.summary=[]] - Summary records to display in the UI.
 */
function onSummaryComplete({ filterSpecies = undefined, summary = [] }) {
  updateSummary({ summary: summary, filterSpecies: filterSpecies });
  // Add pointer icon to species summaries
  const summarySpecies = DOM.summaryTable.querySelectorAll(".cname");
  summarySpecies.forEach((row) => row.classList.replace("not-allowed","pointer"));
  
  // Add hover to the summary
  const summaryNode = document.getElementById("resultSummary");
  if (summaryNode) {
    summaryNode.classList.add("table-hover");
  }
  if (!PREDICTING || STATE.mode !== "analyse") activateResultSort();
  if (summary.length) {
    utils.enableMenuItem(["saveLabels", "saveCSV", "save-summary", "save-eBird", "save-Raven"]);
    STATE.mode !== "explore" && utils.enableMenuItem(["save2db"]);
  } else {
    utils.disableMenuItem([
      "saveLabels",
      "saveCSV",
      "save-eBird",
      "save-summary",
      "save-Raven",
      "save2db",
    ]);
  }
  if (STATE.currentFile) utils.enableMenuItem(["analyse"]);
}

// Set up pagination
const pagination = new Pagination(
  document.querySelector(".pagination"),
  () => STATE, // Returns the current state
  () => config, // Returns the current config
  () => worker,
  {
    isSpeciesViewFiltered,
    filterResults,
    resetResults,
  }
);
pagination.init();

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
  if (
    PREDICTING ||
    ["TBODY", "TH", "DIV"].includes(e.target.tagName)
  )
    return; // on Drag or clicked header
  let species;
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
  setAutocomplete(species);
  filterResults({ updateSummary: false });
  resetResults({
    clearSummary: false,
    clearPagination: false,
    clearResults: false,
  });
}

function setAutocomplete(species) {
  if (isExplore()) {
    const autoComplete = document.getElementById("bird-autocomplete-explore");
    autoComplete.value = species || "";
  }
}

/**
 * Renders a detection result row in the results table, updating headers, pagination, and UI as needed.
 *
 * For the first result, resets the table and sets up localized headers. Handles pagination and result limits for non-database results. Formats and displays detection details including timestamps, species, call counts, labels, comments, review status, and model information. Stores results for feedback and updates the UI accordingly.
 *
 * @param {Object} options - Rendering options.
 * @param {number} [options.index=1] - The sequential index of the detection result.
 * @param {Object} [options.result={}] - Detection result data, including timestamp, position, species, score, label, and related fields.
 * @param {*} [options.file=undefined] - The audio file reference for the detection.
 * @param {boolean} [options.isFromDB=false] - Whether the result is from the database.
 * @param {boolean} [options.selection=false] - Whether rendering is for a selection-specific view.
 *
 * @returns {Promise<void>} Resolves when the result has been rendered and the UI updated.
 *
 * @remark Results detected as daytime are skipped if nocturnal migration detection is enabled and not in selection mode.
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
      const i18 = i18n.get(i18n.Headings);
      // const fragment = new DocumentFragment();
      DOM.resultHeader.innerHTML = `
                <tr class="text-nowrap">
                    <th id="sort-time" class="time-sort col text-start timeOfDay" title="${i18.time[1]}"><span class="text-muted material-symbols-outlined time-sort-icon d-none">sort</span> ${i18.time[0]}</th>
                    <th id="sort-position" class="time-sort text-start timestamp" title="${i18.position[1]}"><span class="text-muted material-symbols-outlined time-sort-icon d-none">sort</span> ${i18.position[0]}</th>
                    <th id="confidence-sort" class="text-start" title="${i18.species[1]}"><span class="text-muted material-symbols-outlined species-sort-icon d-none">sort</span> ${i18.species[0]}</th>
                    <th class="text-end">${i18.calls}</th>
                    <th id="sort-label" class="col pointer"><span class="text-muted material-symbols-outlined meta-sort-icon d-none">sort</span> ${i18.label}</th>
                    <th id="sort-comment" class="col pointer text-end"><span class="text-muted material-symbols-outlined meta-sort-icon d-none">sort</span> ${i18.notes}</th>
                    <th id="sort-reviewed" class="col pointer text-end"><span class="text-muted material-symbols-outlined meta-sort-icon d-none">sort</span>${i18.reviewed}</th>
                    <th id="sort-model" class="col pointer text-end"><span class="text-muted material-symbols-outlined meta-sort-icon d-none">sort</span>${i18.model || 'Model'}</th>
                </tr>`;
      setTimelinePreferences();
      // DOM.resultHeader.innerHTML = fragment;
    }
    utils.showElement(["resultTableContainer", "resultsHead"], false);
    // If  we have some results, let's update the view in case any are in the window
    if (
      config.specDetections &&
      !isFromDB &&
      !STATE.selection
    )
      postBufferUpdate({ file, begin: STATE.windowOffsetSecs });
  } else if (!isFromDB && index % (config.limit + 1) === 0) {
    pagination.add(index, 0);
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
      reviewed,
      model,
      modelID
    } = result;

    const dayNight = isDaylight ? "daytime" : "nighttime";

    const commentHTML = comment
      ? `<span title="${comment.replaceAll(
          '"',
          "&quot;"
        )}" class='material-symbols-outlined pointer'>comment</span>`
      : "";

    const reviewHTML = reviewed
      ? `<span class='material-symbols-outlined'>check_small</span>`
      : "";
    // store result for feedback function to use
    if (!selection) predictions.set(index, result);
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
    const labelHTML =
      Number.isInteger(tagID) && label
        ? `<span class="badge text-bg-${
            STATE.labelColors[tagID % STATE.labelColors.length]
          } rounded-pill">${label}</span>`
        : "";
    const hide = selection ? "d-none" : "";
    const countIcon =
      count > 1
        ? `<span class="circle" title="Click to view the ${count} detections at this timecode">${count}</span>`
        : "";
    tr += `<tr tabindex="-1" id="result${index}" name="${file}|${position}|${
      end || position + 3
    }|${sname}|${cname}|${score}|${modelID}" class='${activeTable} border-top border-2 border-secondary ${dayNight}'>
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
            <td class="text-end"><img class="model-logo" src="img/icon/${model}_logo.png" title="${model}" alt="${model}"></td>
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
 * Updates the global clickedIndex to the row index of the nearest table row ancestor of the given element.
 *
 * If the element is not within a table row, clickedIndex is set to null.
 *
 * @param {HTMLElement} target - The element from which to start the search for a table row.
 */

function setClickedIndex(target) {
  const clickedNode = target.closest("tr");
  clickedIndex = clickedNode?.rowIndex;
}

const deleteSpeciesByConfidence = (species, confidence, modelID) => {
  if (!(STATE.resultsSortOrder.includes("score") && isSpeciesViewFiltered())) return;
  const { start, end } = STATE.mode === "explore" ? STATE.explore.range : {};
  worker.postMessage({
    action: "delete-confidence",
    start,
    end,
    species,
    confidence,
    modelID
  });
  // const currentRow = activeRow.rowIndex;
  // const table = document.getElementById("resultTableBody");
  // for (let i = table.rows.length - 1; i >= currentRow; i--) {
  //   table.deleteRow(i);
  // }
  filterResults();
}


const deleteRecord = (e) => {
  if (! (STATE.fileLoaded && activeRow)) return;
  let target = activeRow;
  setClickedIndex(target);
  // If there is no row (deleted last record and hit delete again):
  if (clickedIndex === -1 || clickedIndex === undefined) return;
  const { species, start, end, confidence, file, setting, modelID } = addToHistory(target);
  if (e?.shiftKey) {
    deleteSpeciesByConfidence(species, confidence, modelID);
    return;
  }
  worker.postMessage({
    action: "delete",
    file,
    start,
    end,
    species,
    speciesFiltered: isSpeciesViewFiltered(),
    modelID
  });
  // Clear the record in the UI
  // there may be no records remaining (no index)
  setting.deleteRow(clickedIndex);
  setting.rows[clickedIndex]?.click();
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
    const species = result.cname.replaceAll("/", " - ");
    filename = `${species}_${datetime}.${config.audio.format}`;
  } else if (start === undefined) {
    if (STATE.activeRegion.start) {
      start = STATE.activeRegion.start + STATE.windowOffsetSecs;
      end = STATE.activeRegion.end + STATE.windowOffsetSecs;
    } else {
      start = 0;
      end = STATE.currentBuffer.duration;
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
  score = Math.round(score/10);
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
  if (activeRow && STATE.activeRegion.label) {
    setClickedIndex(activeRow);
    result = predictions.get(clickedIndex);
  }
  sendFile("save", result);
};

/**
 * Loads and localizes a modal's HTML content based on the specified filename and locale.
 *
 * For certain help files ("usage", "settings", "ebird", "training"), loads a locale-specific HTML file directly. For other files, loads the base HTML and applies localization by replacing element contents using a corresponding JSON file if available. Returns the localized HTML as a string, or the original HTML if localization data is missing. Returns null if an error occurs.
 *
 * @param {string} filename - The base name of the modal or help file to load.
 * @param {string} locale - The locale code (e.g., "en", "de") for localization.
 * @returns {Promise<string|null>} The localized HTML content as a string, or null if loading fails.
 */
async function localiseModal(filename, locale) {
  try {
    // Fetch the HTML file
    if (["usage", "settings", "ebird", "training"].includes(filename)) {
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

const populateSpeciesModal = async ({included, excluded, place}) => {
  const i18 = i18n.get(i18n.SpeciesList);
  const current_file_text =
    STATE.week !== -1 && STATE.week
      ? utils.interpolate(i18.week, { week: STATE.week })
      : "";
  const model = config.models[config.selectedModel].displayName;
  const localBirdsOnly =
    config.local && config.selectedModel === "birdnet" && config.list === "nocturnal"
      ? i18.localBirds
      : "";
  let species_filter_text = "",
    location_filter_text = "";
  if (config.list === "location") {
    const weekSpecific = config.useWeek ? i18.weekSpecific : "";
    species_filter_text = utils.interpolate(i18.threshold, {
      weekSpecific: weekSpecific,
      speciesThreshold: config.speciesThreshold,
    });
    location_filter_text = utils.interpolate(i18.location, {
      place: place,
      current_file_text: current_file_text,
      species_filter_text: species_filter_text,
    });
  }
  const includedList = generateBirdIDList(included);
  const depending =
    config.useWeek &&
    config.list === "location" &&
    (STATE.week === -1 || !STATE.week)
      ? i18.depending
      : "";
  const listLabel = i18n.get(i18n.Lists)[config.list];
  const includedContent = utils.interpolate(i18.included, {
    model: model,
    listInUse: listLabel,
    location_filter_text: location_filter_text,
    localBirdsOnly: localBirdsOnly,
    upTo: i18.upTo,
    count: included.length,
    depending: depending,
    includedList: includedList,
  });
  let excludedContent = "",
    disable = "";
  if (excluded) {
    const excludedList = generateBirdIDList(excluded);

    excludedContent = utils.interpolate(i18.excluded, {
      excludedList: excludedList,
      excludedCount: excluded.length,
      cname: i18.cname,
      sname: i18.sname,
    });
  } else {
    disable = " disabled";
  }
  let modalContent = `
        <ul class="nav nav-tabs" id="myTab" role="tablist">
        <li class="nav-item" role="presentation">
        <button class="nav-link active" id="included-tab" data-bs-toggle="tab" data-bs-target="#included-tab-pane" type="button" role="tab" aria-controls="included-tab-pane" aria-selected="true">${i18.includedButton}</button>
        </li>
        <li class="nav-item" role="presentation">
        <button class="nav-link" id="excluded-tab" data-bs-toggle="tab" data-bs-target="#excluded-tab-pane" type="button" role="tab" aria-controls="excluded-tab-pane" aria-selected="false" ${disable}>${i18.excludedButton}</button>
        </li>
        </ul>
        <div class="tab-content" id="myTabContent">
        <div class="tab-pane fade show active" id="included-tab-pane" role="tabpanel" aria-labelledby="included-tab" tabindex="0" style="max-height: 50vh;overflow: auto">${includedContent}</div>
        <div class="tab-pane fade" id="excluded-tab-pane" role="tabpanel" aria-labelledby="excluded-tab" tabindex="0" style="max-height: 50vh;overflow: auto">${excludedContent}</div>
        </div>
        `;
  document.getElementById("speciesModalBody").innerHTML = modalContent;
  document.getElementById("speciesModalLabel").textContent = i18.title;
  const species = new bootstrap.Modal(document.getElementById("speciesModal"));
  species.show();
  STATE.includedList = included;
};

// exporting a list
function exportSpeciesList() {
  const included = STATE.includedList;
  // Create a blob containing the content of included array
  const content = included
    .map((item) => `${item.sname}${getSplitChar()}${item.cname}`)
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
  const i18 = i18n.get(i18n.Titles);
  const btn = DOM.nocmigButton;
  if (on === 'day') {
    btn.textContent = "wb_sunny";
    btn.title = i18.nocmigOn;
    btn.classList.add("text-warning");
    btn.classList.remove("text-info");
  } else if (on) {
    btn.textContent = "nights_stay";
    btn.title = i18.nocmigOn;
    btn.classList.add("text-info");
    btn.classList.remove("text-warning");
  } else {
    btn.textContent = "bedtime_off";
    btn.title = i18.nocmigOff;
    btn.classList.remove("text-info","text-warning");
  }
  const checked = on === true;
  DOM.nocmig.checked = checked;
}

const changeNocmigMode = () => {
  const modes = [true, 'day', false]
  let nocmigMode = config.detect.nocmig;
  const index = (modes.indexOf(nocmigMode) + 1) % modes.length
  nocmigMode = modes[index]
  setNocmig(nocmigMode);
  worker.postMessage({
    action: "update-state",
    detect: { nocmig: nocmigMode },
    globalOffset: 0,
    filteredOffset: {},
  });
  config.detect.nocmig = nocmigMode;
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

/**
 * Sends a filter request to the worker to process analysis results if the analysis is complete.
 *
 * This function posts a "filter" action message to the worker using the provided filtering options,
 * which include species filtering criteria, a flag to update the results summary, and optional pagination
 * and range parameters. The filtering is applied only if the analysis has been completed.
 *
 * @param {Object} [options={}] - Filter configuration options.
 * @param {*} [options.species=isSpeciesViewFiltered(true)] - Criteria for filtering by species.
 * @param {boolean} [options.updateSummary=true] - Flag indicating whether to update the summary after filtering.
 * @param {number} [options.offset] - Optional starting index for pagination.
 * @param {number} [options.limit=500] - Maximum number of results to process.
 * @param {Object} [options.range] - Optional constraints to limit the range of filtered results.
 */
function filterResults({
  species,
  updateSummary = true,
  offset = undefined,
  limit = 500,
  range = undefined,
} = {}) {
  // This allows you to pass {species: undefined} and override the default
  const effectiveSpecies = Object.hasOwn(arguments[0] ?? {}, 'species')
    ? species
    : isSpeciesViewFiltered(true);
  STATE.analysisDone &&
    worker.postMessage({
      action: "filter",
      species: effectiveSpecies,
      updateSummary,
      offset,
      limit,
      range,
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
  if (!['chirpity', 'nocmig'].includes(config.selectedModel)) {
    // hide chirpity-only features
    chirpityOnly.forEach((element) => {
      // element.classList.add('chirpity-only');
      element.classList.replace("chirpity-only-visible", "chirpity-only");
    });
    DOM.contextAware.checked = false;
    DOM.contextAware.disabled = true;
    config.detect.contextAware = false;
    DOM.contextAwareIcon.classList.add("d-none");
  } else {
    // show chirpity-only features
    chirpityOnly.forEach((element) => {
      element.classList.replace("chirpity-only", "chirpity-only-visible");
    });
    DOM.contextAware.checked = config.detect.contextAware;
    DOM.contextAwareIcon.classList.remove("d-none");
  }    

  isMac && noMac.forEach((element) => element.classList.add("d-none"));
  if (config.hasNode) {
    nodeOnly.forEach((element) => element.classList.remove("d-none"));
  } else {
    nodeOnly.forEach((element) => element.classList.add("d-none"));
  }
  // Hide train unless BirdNET (and a member)
  const blockTrain = config.selectedModel !== 'birdnet' || ! STATE.isMember;
  DOM.trainNav.classList.toggle('disabled', blockTrain);
};

const contextAwareIconDisplay = () => {
  const i18 = i18n.get(i18n.Titles);
  if (config.detect.contextAware) {
    DOM.contextAwareIcon.classList.add("text-warning");
    DOM.contextAwareIcon.title = i18.contextModeOn;
  } else {
    DOM.contextAwareIcon.classList.remove("text-warning");
    DOM.contextAwareIcon.title = i18.contextModeOff;
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
  if (['chirpity', 'nocmig'].includes(config.selectedModel))
    config.detect.contextAware = !config.detect.contextAware;
  DOM.contextAware.checked = config.detect.contextAware;
  contextAwareIconDisplay();
  worker.postMessage({
    action: "update-state",
    detect: { contextAware: config.detect.contextAware },
    filters: { SNR: config.filters.SNR },
  });
  updatePrefs("config.json", config);
};

const diagnosticMenu = document.getElementById("diagnostics");
diagnosticMenu.addEventListener("click", async function () {
  const backend = config.models[config.selectedModel].backend;
  DIAGNOSTICS["Model"] =
    DOM.modelToUse.options[DOM.modelToUse.selectedIndex].text;
  DIAGNOSTICS["Backend"] = backend;
  DIAGNOSTICS["Batch size"] = config[backend].batchSize;
  DIAGNOSTICS["Threads"] = config[backend].threads;
  DIAGNOSTICS["Context"] = config.detect.contextAware;
  DIAGNOSTICS["SNR"] = config.filters.SNR;
  DIAGNOSTICS["List"] = config.list;
  let diagnosticTable = "<table class='table-hover table-striped p-2 w-100'>";
  for (let [key, value] of Object.entries(DIAGNOSTICS)) {
    if (key === "Audio Duration") {
      // Format duration as days, hours,minutes, etc.
      value = utils.formatDuration(value);
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
 * Updates the UI sort indicators based on the current sort configuration.
 *
 * Adjusts the visibility and styling of time, species, and metadata sort icons within the header element
 * according to the global sort settings. When score-based sorting is active, time icons are hidden while species
 * icons reflect the sort order by toggling the "flipped" class for ascending order. Metadata sort icons are similarly
 * updated based on the active metadata sort field and direction. Additionally, the header's background style is
 * updated, and the summary sort indicator is refreshed via showSummarySortIcon().
 *
 * Global State Dependencies:
 * - STATE.resultsSortOrder: Determines if results are sorted by score and the sort direction.
 * - STATE.resultsMetaSortOrder: Specifies the active metadata sort field and sort direction.
 * - DOM.resultHeader: The header element containing sort icons.
 *
 * @returns {void}
 */
function activateResultSort() {
  // Work with the existing header directly.
  const header = DOM.resultHeader;

  const timeHeadings = header.getElementsByClassName("time-sort-icon");
  const speciesHeadings = header.getElementsByClassName("species-sort-icon");
  const metaHeadings = header.getElementsByClassName("meta-sort-icon");

  const sortOrderScore = STATE.resultsSortOrder.includes("score");
  const state = STATE.resultsMetaSortOrder;
  const sortOrderMeta = state.replace(" ASC ", "").replace(" DESC ", "");

  // Update meta headings
  [...metaHeadings].forEach((heading) => {
    const hideIcon =
      state === "" || !heading.parentNode.id.includes(sortOrderMeta);
    heading.classList.toggle("d-none", hideIcon);
    if (state.includes("ASC")) {
      heading.classList.add("flipped");
    } else {
      heading.classList.remove("flipped");
    }
  });

  // Update time sort icons
  [...timeHeadings].forEach((heading) => {
    heading.classList.toggle(
      "flipped",
      !sortOrderScore && STATE.resultsSortOrder.includes("ASC")
    );
    heading.classList.toggle("d-none", sortOrderScore);
    heading.parentNode.classList.add("pointer");
  });

  // Update species sort icons
  [...speciesHeadings].forEach((heading) => {
    heading.parentNode.classList.add("pointer");
    heading.classList.toggle(
      "flipped",
      sortOrderScore && STATE.resultsSortOrder.includes("ASC")
    );
    heading.classList.toggle("d-none", !sortOrderScore);
  });

  // Update the header's background classes
  header.classList.replace("text-bg-secondary", "text-bg-dark");

  // Optionally update the summary icon as needed
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
  filterResults();
};

const setSummarySortOrder = (order) => {
  STATE.summarySortOrder = order;
  worker.postMessage({ action: "update-state", summarySortOrder: order });
  refreshSummary();
};

// Drag file to app window to open
document.addEventListener("dragover", (event) => {
  event.preventDefault();
});

document.addEventListener("drop", (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (!modelReady) return;
  const fileList = Array.from(event.dataTransfer.files)
    .filter(
      (file) =>
        !file.name.startsWith(".") &&
        (!file.type ||
          file.type.startsWith("audio/") ||
          file.type.startsWith("video/"))
    );
  if (fileList.length){
    const audioFiles = fileList.map(file => window.electron.showFilePath(file));
    worker.postMessage({ action: "get-valid-files-list", files: audioFiles });
  } else {
    const noSupport = {
        en: 'File type not supported',
        da: 'Filtype understøttes ikke',
        de: 'Dateityp wird nicht unterstützt',
        es: 'Tipo de archivo no admitido',
        fr: 'Type de fichier non pris en charge',
        ja: 'ファイル形式はサポートされていません',
        nl: 'Bestandstype wordt niet ondersteund',
        pt: 'Tipo de ficheiro não suportado',
        ru: 'Тип файла не поддерживается',
        sv: 'Filtypen stöds inte',
        zh: '不支持的文件类型'
    };
    generateToast({message: 'noFile', variables:{error:i18n.get(noSupport)}})
  }
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

/**
 * Updates the threshold display and input values in both the filter and settings panels.
 * @param {Event|number} e - The input event or numeric threshold value to display and set.
 */
function showThreshold(e) {
  const threshold = e instanceof Event ? e.target.valueAsNumber : e;
  filterPanelThresholdDisplay.innerHTML = `<b>${threshold}%</b>`;
  settingsPanelThresholdDisplay.innerHTML = `<b>${threshold}%</b>`;
  filterPanelRangeInput.value = threshold;
  settingsPanelRangeInput.value = threshold;
}

/**
 * Updates the UI to display the current topRankin threshold value.
 * 
 * Accepts either an event or a numeric value, updates the display element with the threshold, and sets the input value accordingly.
 */
function showTopRankin(e) {
  const threshold = e instanceof Event ? e.target.valueAsNumber : e;
  const topRankinDisplay = document.getElementById('top-rankin-value')
  topRankinDisplay.innerHTML = `<b>${threshold}</b>`;
  document.getElementById('top-rankin').value = threshold;
}

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
  const i18 = i18n.get(i18n.Titles);
  const {
    active, 
    highPassFrequency, 
    lowPassFrequency, 
    lowShelfAttenuation, 
    lowShelfFrequency, 
    normalise} = config.filters;
  if (
    active &&
    (
      highPassFrequency || 
      lowPassFrequency  ||
      (lowShelfAttenuation && lowShelfFrequency) ||
      normalise
    )
  ) {
    DOM.audioFiltersIcon.classList.add("text-warning");
    DOM.audioFiltersIcon.title = i18.audioFiltersOn;
  } else {
    DOM.audioFiltersIcon.classList.remove("text-warning");
    DOM.audioFiltersIcon.title = i18.audioFiltersOff;
  }
};
// High pass threshold
const showFilterEffect = () => {
  if (STATE.fileLoaded) {
    const position = utils.clamp(
      spec.wavesurfer.getCurrentTime() / STATE.windowLength,
      0,
      1
    );
    postBufferUpdate({
      begin: STATE.windowOffsetSecs,
      position: position,
    });
  }
};


const formatHz = (n) => n >= 1000 ? `${(n / 1000).toFixed(1)}kHz` : `${n}Hz`;


function updateDisplay(el, id, unit){
  const display = document.getElementById(id);
  let value = el.value;
  if (el.id === 'lowPassFrequency') value = Number(el.max) - value;
  if (unit === 'Hz'){
    value = formatHz(value);
    unit = null
  }
  display.textContent = value + (unit || '');
}

document.addEventListener('input', (e) =>{
  const el = e.target;
  const target = el.id;
  switch (target){
    case 'mid-color-threshold-slider':{
      updateDisplay(el, "mid-color-threshold")
      break;
    }
    case "quiet-color-threshold-slider": {
      updateDisplay(el, "quiet-color-threshold");
      break;
    }
    case "alpha-slider": {
      updateDisplay(el, "alpha-value");
      break;
    }
    case "highPassFrequency": {
      updateDisplay(el, "HP-threshold", 'Hz');
      break;
    }
    case "lowPassFrequency": {
      updateDisplay(el, "LP-threshold", 'Hz');
      break;
    }
    case "lowShelfFrequency": {
      updateDisplay(el, "LowShelf-threshold", 'Hz');
      break;
    }
    case "attenuation": {
      updateDisplay(el, "attenuation-threshold", 'dB');
      break;
    }
    case "batch-size":{
      DOM.batchSizeValue.textContent = DOM.batchSizeSlider.value;
      break;
    }
    case "confidence":
    case "confidenceValue": {
      showThreshold(e)
      break;
    }
    case "top-rankin": {
      showTopRankin(e);
      config.detect.topRankin = el.valueAsNumber;
      updatePrefs('config.json', config)
      worker.postMessage({
        action: "update-state",
        detect: config.detect,
      });
      break;
    }
    case "thread-slider": {
      DOM.numberOfThreads.textContent = DOM.threadSlider.value;
      break;
    }
    case "gain": {
      DOM.gainAdjustment.textContent = DOM.gain.value + "dB";
      break;
    }
    default: {
      // Log unhandled input events for debugging
      config.debug && console.log(`Unhandled input event for element: ${target}`);
      break;  
    }
  }
})

const handlePassFilterchange = (el) => {
  const filter = el.id;
  let value = el.valueAsNumber;
  // Invert scale for low pass
  if (filter === 'lowPassFrequency') value = Number(el.max) - value;
  config.filters[filter] = value;
  config.filters.active || toggleFilters();
  worker.postMessage({
    action: "update-state",
    filters: { [filter]: config.filters[filter] },
  });
  showFilterEffect();
  filterIconDisplay();
  el.blur(); // Fix slider capturing the focus so you can't use spaceBar or hit 'p' directly
};


// Low shelf threshold
const handleLowShelfchange = () => {
  config.filters.lowShelfFrequency = DOM.LowShelfSlider.valueAsNumber;
  config.filters.active || toggleFilters();
  worker.postMessage({
    action: "update-state",
    filters: { lowShelfFrequency: config.filters.lowShelfFrequency },
  });
  showFilterEffect();
  filterIconDisplay();
  DOM.LowShelfSlider.blur(); // Fix slider capturing thefocus so you can't use spaceBar or hit 'p' directly
};


// Low shelf gain
const handleAttenuationchange = () => {
  config.filters.lowShelfAttenuation = -DOM.attenuation.valueAsNumber;
  config.filters.active = true;
  worker.postMessage({
    action: "update-state",
    filters: { lowShelfAttenuation: config.filters.lowShelfAttenuation },
  });
  showFilterEffect();
  filterIconDisplay();
  DOM.attenuation.blur();
};


/**
 * Plays the active audio region after sanitizing its boundaries.
 *
 * This function locates the active region from the global REGIONS object by matching the
 * region's start time with the global STATE.activeRegion. It then adjusts the region's start and
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
 * - STATE.activeRegion: The currently active region used for matching.
 * - windowLength: A number representing the maximum playback window length.
 *
 * @returns {void}
 */
function playRegion() {
  // Sanitise region (after zoom, start or end may be outside the windowlength)
  // I don't want to change the actual region length, so make a copy
  const region = spec.REGIONS.regions?.find(
    (region) => region.start === STATE.activeRegion.start
  );
  if (region) {
    const myRegion = region;
    myRegion.start = Math.max(0, myRegion.start);
    // Have to adjust the windowlength so the finish event isn't fired - causing a page reload)
    myRegion.end = Math.min(myRegion.end, STATE.windowLength * 0.995);
    myRegion.play(true);
  }
}
// Audio preferences:

const showRelevantAudioQuality = () => {
  const { format } = config.audio;
  DOM.audioBitrateContainer.classList.toggle(
    "d-none",
    !["mp3", "opus", "aac"].includes(format)
  );
  DOM.audioQualityContainer.classList.toggle("d-none", format !== "flac");
};
document.addEventListener("click", debounceClick(handleUIClicks));
/**
 * Handles all UI click events by dispatching actions based on the clicked element's ID.
 *
 * Routes user clicks to the appropriate application logic, including file operations, analysis commands, model management, settings adjustments, help dialogs, sorting, context menu actions, and UI updates. Updates application state, communicates with the worker thread, manages configuration, and triggers relevant UI changes as needed.
 *
 * @param {MouseEvent} e - The click event object.
 */
async function handleUIClicks(e) {
  if (!APPLICATION_LOADED) return;
  const element = e.target;
  const target = element.closest("[id]")?.id;
  const locale = config.locale.replace(/_.*$/, "");
  switch (target) {
    // Spec outside of region
    case "waveform": {
      resetRegions(false);
      break;
    }
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
      exportData("Audacity");
      break;
    }
    case "saveCSV": {
      exportData("text");
      break;
    }
    case "save-summary": {
      exportData("summary");
      break;
    }
    case "save-eBird": {
      exportData("eBird");
      break;
    }
    case "save-Raven": {
      exportData("Raven");
      break;
    }
    case "export-audio": {
      exportAudio();
      break;
    }
    case "import-csv": {
      STATE.fileLoaded = false;
      showAnalyse();
      importData('csv');
      break;
    }
    case "exit": {
      window.close();
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
      break;
    }
    case "charts": {
      showCharts();
      break;
    }
    case "downloadChart": {
      // Download the chart
      element.disabled = true;
      const imageURL = chartInstance.toBase64Image();
      const a = document.createElement('a');
      a.href = imageURL;
      a.download = 'chart.png';
      a.click();
      a.remove();
      element.disabled = false;
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
      config.models[config.selectedModel].customListFile = "";
      delete LIST_MAP.custom;
      config.list = "birds";
      DOM.customListFile.value = "";
      updatePrefs("config.json", config);
      resetResults({
        clearSummary: true,
        clearPagination: true,
        clearResults: true,
      });
      updateList();
      break;
    }
    case "clear-database-location": {
      config.database.location = undefined;
      document.getElementById("database-location").value = "";
      worker.postMessage({
        action: "update-state",
        database: config.database,
      });
      config.list = 'everything';
      updateList();
      updatePrefs("config.json", config);
      showAnalyse();
      break;
    }
    // Custom models
    case "open-training": {
      showTraining();
      break;
    }
    case "import-model": {
      showImport();
      break;
    }
    case "remove-model": {
      // Just present custom models to choose from
      updateModelOptions('customOnly');
      showExpunge();
      break;
    }
    case "dataset-location-select": {
      (async () => {
        const files = await window.electron.selectDirectory(
          config.training.datasetLocation || ""
        );
        if (!files.canceled) {
          const audioFolder = files.filePaths[0];
          config.training.datasetLocation = audioFolder;
          document.getElementById("dataset-location").value = audioFolder;
          // if we change the dataset location, let's not use the old cached data
          config.training.settings.useCache = false;
          document.getElementById("useCache").checked = false;
          updatePrefs("config.json", config);
        }
      })();
      break;
    }
    case "dataset-cache-location-select": {
      (async () => {
        const files = await window.electron.selectDirectory(
          config.training.cacheLocation || ""
        );
        if (!files.canceled) {
          const audioFolder = files.filePaths[0];
          config.training.cacheLocation = audioFolder;
          document.getElementById("dataset-cache-location").value = audioFolder;
          updatePrefs("config.json", config);
        }
      })();
      break;
    }
    case "model-type": {
      config.training.customModel.type = element.selected.value
      break
    }
    case "model-location-select": {
      (async () => {
        const files = await window.electron.selectDirectory(
          config.training.customModel.location || ""
        );
        if (!files.canceled) {
          const modelFolder = files.filePaths[0];
          config.training.customModel.location = modelFolder;
          document.getElementById("model-location").value = modelFolder;
          updatePrefs("config.json", config);
        }
      })();
      break;
    }
    case "import-location-select": {
      (async () => {
        const files = await window.electron.selectDirectory(
          config.training.customModel.location || ""
        );
        if (!files.canceled) {
          const modelFolder = files.filePaths[0]
          document.getElementById("import-location").value = modelFolder;
          const modelNameInput = document.getElementById("model-name");
          // Prevent people changing Perch v2 name
          modelNameInput.value = p.basename(modelFolder).replace(/^perch v2.*$/i, 'Perch v2');
          modelNameInput.disabled = modelNameInput.value === 'Perch v2';
        }
      })();
      break;
    }
    case "train": {
      e.preventDefault();
      const {customModel, settings, datasetLocation, cacheLocation} = config.training;
      const dataset = datasetLocation;
      const cache = cacheLocation;
      const modelType = customModel.type;
      const modelLocation = customModel.location;

      if (!(settings.lr && settings.epochs)) {
        generateToast({message:'A value for both Epochs and Learning rate is needed', type:'warning'})
        break;
      }
      if (!dataset) {
        generateToast({message:'A location for the training audio is needed', type:'warning'})
        break;
      }
      function isDirectory(entry) {
        const typeSymbol = Object.getOwnPropertySymbols(entry).find(sym => sym.toString().includes('type'));
        return entry[typeSymbol] === 2;
      }
      const entries = fs.readdirSync(dataset, { withFileTypes: true }).filter(e => isDirectory(e) && ! e.name.startsWith('.'));
      const folders = entries.map(entry => entry.name);
      // Check valid formatting
      for (const f of folders) {
        const parts = f.split('_');
        if (parts.length !== 2 && !f.toLowerCase().includes('background') ){
          generateToast({message:`There are audio folders not in the correct format.<br>
              <b>"scientific name_common name"</b> is expected but found:<br>
              <b>${f}</b>`, type: 'warning', autohide: false})
          break
        }
      }
      if (modelType === 'append'){
        function findDuplicateLines(labelFile) {
          const labels = new Set(fs.readFileSync(labelFile, 'utf8').split('\n').map(l => l.trim()));
          return folders.filter(f => labels.has(f) && f !== '');
        }
        const labelFile = p.join(dirname,`labels/V2.4/BirdNET_GLOBAL_6K_V2.4_Labels_${config.locale}.txt`)
        const duplicates = findDuplicateLines(labelFile);
        if (duplicates.length){
          generateToast({message:`There are audio folders which have the same name as BirdNET labels. 
            When appending labels, the new labels must be unique:<br>
            <b>${duplicates.join('<br>')}</b>`, type: 'warning', autohide: false})
          break;
        }
      }
      const trainBtn = document.getElementById('train');
      trainBtn.classList.add('disabled');
      trainBtn.blur();
      training.hide();
      displayProgress({percent: 0}, 'Starting...')
      disableSettingsDuringAnalysis(true)
      const backend = config.models[config.selectedModel].backend;
      const batchSize = config[backend].batchSize;
      STATE.training = true;
      powerSave(true);
      worker.postMessage({
        action: "train-model", 
        dataset, cache, modelLocation, modelType, batchSize, ...settings});
      break;
    }
    case "import": {
      e.preventDefault();
      const form = e.target.form;
      if (!form.checkValidity()) {
        form.reportValidity(); // Shows the native browser validation messages
        break;
      }
      let displayName = document.getElementById('model-name').value.trim();
      displayName = displayName.replace(/^perch v2.*$/i, 'Perch v2')

      const modelName = displayName.toLowerCase();
      const modelLocation = document.getElementById('import-location').value;
      const requiredFiles = modelName === 'perch v2' ? ['perch_v2.onnx', 'labels.txt'] : ['weights.bin', 'labels.txt', 'model.json'];
      if (config.models[modelName] !== undefined){
        generateToast({message: 'A model with that name already exists', type:'error'})
        break;
      }
      const missingFiles = [];
      requiredFiles.forEach(file => {
        if (!fs.existsSync(p.join(modelLocation, file))) {
          missingFiles.push(file)
        }
      })
      if (missingFiles.length){ 
        const files = missingFiles.join(', ');
        generateToast({message: `
        The chosen location <br>${modelLocation}<br>is missing required files:
        <br> <b>${files}</b>.
        `, type:'error'})
        break
      }
      importModal.hide();
      config.models[modelName] = {
        backend: modelName === 'perch v2' 
          ? 'tensorflow' 
          : config.models['birdnet'].backend, 
          displayName, 
          modelPath:modelLocation};
      config.selectedModel = modelName;
      const select = document.getElementById('model-to-use');
      const newOption = document.createElement('option');
      newOption.value = modelName;
      newOption.textContent = displayName;
      select.appendChild(newOption);
      updatePrefs('config.json', config)
      updateModelOptions();
      handleModelChange(modelName);
      select.value = modelName;
      select.dispatchEvent(new Event('change'));
      break;
    }
    case "expunge":{
      e.preventDefault();
      const form = e.target.form;
      if (!form.checkValidity()) {
        form.reportValidity();
        break;
      }
      element.classList.add('disabled')
      const model = document.getElementById('custom-models').value;
      worker.postMessage({action:"expunge-model", model})
      delete config.models[model];
      config.selectedModel ===  model && (config.selectedModel = 'birdnet');
      updateModelOptions();
      document.querySelector(`#model-to-use option[value="${model}"]`)?.remove();
      updatePrefs('config.json', config);
      break;
    }
    // Help Menu
    case "keyboardHelp": {
      (async () =>
        await populateHelpModal("keyboard", i18n.Help.keyboard[locale]))();
      break;
    }
    case "settingsHelp": {
      (async () =>
        await populateHelpModal("settings", i18n.Help.settings[locale]))();
      break;
    }
    case "usage": {
      (async () => await populateHelpModal("usage", i18n.Help.usage[locale]))();
      break;
    }
    case "community": {
      (async () =>
        await populateHelpModal("community", i18n.Help.community[locale]))();
      break;
    }
    case "known-issues": {
      const version = VERSION.replace(" (Portable)", "");
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
      (async () => await populateHelpModal("ebird", i18n.Help.eBird[locale]))();
      break;
    }
    case "trainingHelp": {
      (async () => await populateHelpModal("training", i18n.Help.training[locale]))();
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
      config.selectedModel.includes("bats") && ws.setPlaybackRate(0.1, false);
      ws.playPause();
      break;
    }

    case "library-location-select": {
      (async () => {
        const files = await window.electron.selectDirectory(
          config.library.location || ""
        );
        if (!files.canceled) {
          const archiveFolder = files.filePaths[0];
          config.library.location = archiveFolder;
          DOM.exploreLink.classList.contains("disabled") ||
            document
              .getElementById("compress-and-organise")
              .classList.remove("disabled");
          document.getElementById("library-location").value = archiveFolder;
          updatePrefs("config.json", config);
          worker.postMessage({
            action: "update-state",
            library: config.library,
          });
        }
      })();
      break;
    }
    case "database-location-select": {
      (async () => {
        const files = await window.electron.selectDirectory(
          config.database.location || ""
        );
        if (!files.canceled) {
          const archiveFolder = files.filePaths[0];
          config.database.location = archiveFolder;
          document.getElementById("database-location").value = archiveFolder;
          updatePrefs("config.json", config);
          worker.postMessage({
            action: "update-state",
            database: config.database,
          });
          config.list = 'everything';
          updateList()
          updatePrefs("config.json", config);
          showAnalyse();
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
    case "sort-reviewed":
    case "sort-model": {
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
          STATE.resultsMetaSortOrder = "";
        }
      }
      setSortOrder("resultsMetaSortOrder", STATE.resultsMetaSortOrder);
      break;
    }

    case "sort-position":
    case "sort-time": {
      if (!PREDICTING) {
        const sortBy =
          STATE.resultsSortOrder === "timestamp ASC"
            ? "timestamp DESC"
            : "timestamp ASC";
        setSortOrder("resultsSortOrder", sortBy);
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
      const sortOptions = [
        "cname ASC",
        "cname DESC",
        "sname ASC",
        "sname DESC",
      ];
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
      const i18 = {
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
      const message = i18n.get(i18);
      if (confirm(message)) {
        const uuid = config.UUID;
        config = defaultConfig;
        config.UUID = uuid;
        updatePrefs("config.json", config);
      }
      break;
    }
    case "reset-spec-frequency": {
      config.audio.frequencyMin = 0;
      config.audio.frequencyMax = 11950;
      const {frequencyMax, frequencyMin} = config.audio;
      DOM.fromInput.value = frequencyMin;
      // DOM.fromInput.max = frequencyMax;
      DOM.fromSlider.value = frequencyMin;
      // DOM.fromSlider.max = frequencyMax;
      // DOM.toInput.max = frequencyMax;
      DOM.toInput.value = frequencyMax;
      DOM.toSlider.value = frequencyMax;
      // DOM.toSlider.max = frequencyMax;
      fillSlider(
        DOM.fromInput,
        DOM.toInput,
        "#C6C6C6",
        "#0d6efd",
        DOM.toSlider
      );
      checkFilteredFrequency();
      worker.postMessage({ action: "update-state", audio: config.audio });

      spec.setRange({frequencyMin, frequencyMax});
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
      await setFontSizeScale();
      break;
    }
    case "decreaseFont": {
      const fontScale = parseFloat(
        Math.max(0.7, config.fontScale - 0.1).toFixed(1)
      ); // Don't let it go below 0.7
      config.fontScale = fontScale;
      await setFontSizeScale();
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
    case "model-icon": {
      if (!PREDICTING) {
        const el = DOM.modelToUse;
        const numberOfOptions = el.options.length;
        const currentListIndex = el.selectedIndex;
        const next = currentListIndex === numberOfOptions - 1 ? 0 : currentListIndex + 1;
        config.selectedModel = el.options[next].value;
        el.selectedIndex = next;
        handleModelChange(config.selectedModel)
      }
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
      spec.zoom(e);
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
      if (spec.wavesurfer) WSPlayPause();
        break;      
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

  }
  DOM.contextMenu.classList.add("d-none");
  if (
    target != "frequency-range" &&
    !e.target.closest("#frequency-range-panel")
  ) {
    document.getElementById("frequency-range-panel").classList.add("d-none");
    document.getElementById("frequency-range").classList.remove("active");
  }
  if (!target?.startsWith("bird-")) {
    document
      .querySelectorAll(".suggestions")
      .forEach((list) => (list.style.display = "none"));
  }
  hideConfidenceSlider();
  config.debug && console.log("clicked", target);
  target &&
    target !== "result1" &&
    trackEvent(config.UUID, "UI", "Click", target);
};

/**
 * Toggles between basic and advanced settings modes in the UI.
 *
 * Updates button styles and shows or hides advanced settings elements based on the selected mode.
 *
 * @param {string} target - The selected mode, either "basic" or "advanced".
 */
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

/**
 * Updates the species list UI and synchronizes the active list with the worker.
 *
 * If a custom list is selected, loads labels from the specified custom list file. Otherwise, notifies the worker to update the list and optionally refresh results based on analysis state.
 */
async function updateList() {
  updateListIcon();
  setListUIState(config.list)
  if (config.list === "custom") {
    await readLabels(config.models[config.selectedModel].customListFile, "list");
  } else {
    worker.postMessage({
      action: "update-list",
      list: config.list,
      refreshResults: STATE.analysisDone,
    });
  }
}

/**
 * Refreshes the summary display by sending an update request to the worker.
 *
 * If audio analysis has completed, this function retrieves the filtered species view and dispatches
 * an "update-summary" message to the worker with the current species filter.
 */
function refreshSummary() {
  const species = isSpeciesViewFiltered(true);
  if (STATE.analysisDone) {
    // resetResults({});
    worker.postMessage({ action: "update-summary", species });
  }
}

// Beginnings of the all-powerful document 'change' listener
// One listener to rule them all!
document.addEventListener("change", async function (e) {
  const element = e.target.closest("[id]");
  if (element) {
    const target = element.id;
    config.debug && console.log("Change target:", target);
    // Handle key assignments
    if (/^key\d/.test(target)) {
      if (target.length === 4) {
        // Handle custom-select
        if (e.detail) {
          config.keyAssignment[target] = {
            column: "label",
            value: e.detail.value,
            active: true,
          };
          config.debug &&
            console.log(
              `${target} is assigned to update 'label' with ${e.detail.value}`
            );
        } else {
          setKeyAssignment(element, target);
        }
      } else {
        const key = target.slice(0, 4);
        const inputElement = document.getElementById(key);
        const column = e.target.value;
        const newElement = changeInputElement(column, inputElement, key);
        setKeyAssignment(newElement, key);
      }
    } else {
      switch (target) {
        // -- Training settings
        case "replace":
        case "append":{config.training.customModel.type = element.value; break}
        case "dropout": {
          config.training.settings.dropout = Number(element.value); break}
        case "lr": {
          config.training.settings.lr = element.valueAsNumber; break}
        case "hidden-units": {
          config.training.settings.hidden = Number(element.value); 
          const dropout = document.getElementById('dropout')
          dropout.disabled = !config.training.settings.hidden
          break
        }
        case "validation-split": {
          config.training.settings.validation = Number(element.value); 
          config.training.settings.useCache = false;
          document.getElementById('useCache').checked = false;
          break
        }
        case "epochs": {
          config.training.settings.epochs = element.valueAsNumber; break}
        case "useCache": {config.training.settings.useCache = element.checked; break}
        case "use-noise": {config.training.settings.useNoise = element.checked; break}
        case "mixup": {config.training.settings.mixup = element.checked; break}
        case "decay": {config.training.settings.decay = element.checked; break}
        case "weights": {config.training.settings.useWeights = element.checked; break}
        case "focal": {
          config.training.settings.useFocal = element.checked; 
          config.training.settings.useWeights = !element.checked; 
          // If using focal loss, we don't want class weights too
          const weights = document.getElementById('weights');
          weights.disabled = element.checked;
          element.checked && (weights.checked = false);
          break
        }
        case "label-smoothing": {
          config.training.settings.labelSmoothing = element.valueAsNumber; break}
        // --- Backends
        case "tensorflow":
        case "webgpu": { handleBackendChange(target); break }
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
        case "merge-detections": {
          config.detect.merge = element.checked;
          worker.postMessage({
            action: "update-state",
            detect: config.detect,
          });
          filterResults()
          break;
        }
        case "combine-detections": {
          config.detect.combine = element.checked;
          document.getElementById('model-icon').classList.toggle('d-none', !element.checked)
          worker.postMessage({
            action: "update-state",
            detect: config.detect,
          });
          break;
        }
        case "auto-load": {
          config.detect.autoLoad = element.checked;
          worker.postMessage({
            action: "update-state",
            detect: config.detect,
          });
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
          refreshSummary();
          break;
        }
        case "auto-library": {
          config.library.auto = element.checked;
          worker.postMessage({
            action: "update-state",
            library: config.library,
          });
          break;
        }
        case "library-trim": {
          config.library.trim = element.checked;
          worker.postMessage({
            action: "update-state",
            library: config.library,
          });
          break;
        }
        case "library-format": {
          config.library.format =
            document.getElementById("library-format").value;
          worker.postMessage({
            action: "update-state",
            library: config.library,
          });
          break;
        }
        case "library-clips": {
          config.library.clips = element.checked;
          worker.postMessage({
            action: "update-state",
            library: config.library,
          });
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
        case "highPassFrequency": {
          handlePassFilterchange(DOM.HPSlider);
          break;
        }
        case "lowPassFrequency": {
          handlePassFilterchange(DOM.LPSlider);
          break;
        }
        // Charts
        case "hour":
        case "day":
        case "week": {
          STATE.chart.aggregation = element.value;
          callForChart();
          break;
        }
        case "stackYears": {
          STATE.chart.stackYears = element.checked;
          callForChart();
          break;
        }
        case "chart-locations": {
          const location = element.value ? Number(element.value) : undefined;
          STATE.chart.location = location;
          callForChart();
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
        case "species-week": {
          config.useWeek = element.checked;

          if (!config.useWeek) STATE.week = -1;
          worker.postMessage({
            action: "update-state",
            useWeek: config.useWeek,
          });
          updateList();
          break;
        }
        case "list-to-use": {
          config.list = element.value;
          updateList();
          break;
        }
        case "locale": {
          let labelFile;
          if (element.value === "custom") {
            labelFile = config.models[config.selectedModel].customListFile;
            if (!labelFile) {
              generateToast({ type: "warning", message: "labelFileNeeded" });
              return;
            }
          } else {
            labelFile = p.join(dirname,`labels/V2.4/BirdNET_GLOBAL_6K_V2.4_Labels_${element.value}.txt`);
            i18n
              .localiseUI(DOM.locale.value)
              .then((result) => (STATE.i18n = result));
            config.locale = element.value;
            setNocmig();
            contextAwareIconDisplay();
            updateListIcon();
            filterIconDisplay();
            initialiseDatePicker(STATE, worker, config, resetResults, filterResults, generateToast);
          }
          config.locale = element.value;
          STATE.picker.options.lang = element.value.replace(/_.*$/, "");
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
          config.selectedModel = element.value;
          handleModelChange(config.selectedModel);
          break;
        }
        case "thread-slider": {
          // change number of threads
          DOM.numberOfThreads.textContent = DOM.threadSlider.value;
          config[config.models[config.selectedModel].backend].threads =
            DOM.threadSlider.valueAsNumber;
          worker.postMessage({
            action: "change-threads",
            threads: DOM.threadSlider.valueAsNumber,
          });
          break;
        }
        case "batch-size": {
          DOM.batchSizeValue.textContent = DOM.batchSizeSlider.value;
          config[config.models[config.selectedModel].backend].batchSize =
            DOM.batchSizeSlider.valueAsNumber;
          worker.postMessage({
            action: "change-batch-size",
            batchSize: DOM.batchSizeSlider.valueAsNumber,
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
          if (spec.wavesurfer && STATE.currentFile) {
            spec.setColorMap() || await flushSpec()
          }
          break;
        }
        case "window-function":{
          const windowFn = document.getElementById("window-function").value;
          document.getElementById("alpha").classList.toggle("d-none", windowFn !== "gauss")
          config.customColormap = {
              ...config.customColormap, 
              windowFn
            };
          STATE.fileLoaded && await flushSpec();
          break
        }
        case "loud-color":
        case "mid-color":
        case "quiet-color":
        case "mid-color-threshold-slider":
        case "quiet-color-threshold-slider":
        case "alpha-slider": {
          const alpha = document.getElementById("alpha-slider").valueAsNumber;
          const loud = document.getElementById("loud-color").value;
          const mid = document.getElementById("mid-color").value;
          const quiet = document.getElementById("quiet-color").value;
          const quietThreshold = document.getElementById(
            "quiet-color-threshold-slider"
          ).valueAsNumber;
          const midThreshold = document.getElementById(
            "mid-color-threshold-slider"
          ).valueAsNumber;
          // document.getElementById("color-threshold").textContent = threshold;
          config.customColormap = {
            ...config.customColormap,
            loud,
            mid,
            quiet,
            quietThreshold,
            midThreshold,
            alpha
          };
          if (spec.wavesurfer && STATE.currentFile) {
            spec.setColorMap() || await flushSpec();     
          }
          break;
        }
        case "gain": {
          DOM.gainAdjustment.textContent = element.value + "dB";
          element.blur();
          config.audio.gain = element.value;
          worker.postMessage({ action: "update-state", audio: config.audio });
          config.filters.active || toggleFilters();
          if (STATE.fileLoaded) {
            const position = utils.clamp(
              spec.wavesurfer.getCurrentTime() / STATE.windowLength,
              0,
              1
            );
            postBufferUpdate({
              begin: STATE.windowOffsetSecs,
              position: position,
            });
          }
          break;
        }
        case "spec-labels": {
          config.specLabels = element.checked;
          if (spec.wavesurfer && STATE.currentFile) {
            await flushSpec()
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
          config.audio.frequencyMin = Math.min(element.valueAsNumber, config.audio.frequencyMax - 50);
          DOM.fromInput.value = config.audio.frequencyMin;
          DOM.fromSlider.value = config.audio.frequencyMin;
          spec.setRange({frequencyMin: config.audio.frequencyMin});
          checkFilteredFrequency();
          element.blur();
          worker.postMessage({ action: "update-state", audio: config.audio });
          break;
        }
        case "toInput":
        case "toSlider": {
          config.audio.frequencyMax = Math.max(element.valueAsNumber, config.audio.frequencyMin + 50);
          DOM.toInput.value = config.audio.frequencyMax;
          DOM.toSlider.value = config.audio.frequencyMax;
          spec.setRange({frequencyMax: config.audio.frequencyMax});
          checkFilteredFrequency();
          element.blur();
          worker.postMessage({ action: "update-state", audio: config.audio });
          break;
        }
        case "normalise": {
          config.filters.normalise = element.checked;
          element.checked && (config.filters.active = true);
          worker.postMessage({
            action: "update-state",
            filters: config.filters,
          });
          element.blur();
          if (STATE.fileLoaded) {
            const position = utils.clamp(
              spec.wavesurfer.getCurrentTime() / STATE.windowLength,
              0,
              1
            );
            postBufferUpdate({
              begin: STATE.windowOffsetSecs,
              position: position,
            });
          }
          break;
        }
        case "send-filtered-audio-to-model": {
          config.filters.sendToModel = element.checked;
          worker.postMessage({
            action: "update-state",
            filters: config.filters,
          });
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
        case "debug-mode": {
          config.debug = !config.debug;
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

const flushSpec = async () =>{
  spec.wavesurfer?.destroy();
  DOM.waveElement.replaceChildren();
  DOM.spectrogram.replaceChildren();
  spec = new ChirpityWS(
    "#waveform",
    () => STATE, // Returns the current state
    () => config, // Returns the current config
    { postBufferUpdate, trackEvent, setActiveRegion, onStateUpdate: state.update, updatePrefs },
    GLOBAL_ACTIONS
  );
  if (STATE.currentBuffer){
    await spec.initAll({audio:STATE.currentBuffer, height: STATE.specMaxHeight})
    spec.reload()
  }
}

function callForChart() {
  const {species, range, location, aggregation, stackYears: byYear} = STATE.chart;
  worker.postMessage({
    action: "chart",
    species,
    range,
    location,
    aggregation,
    byYear,
  });
}
/**
 * Updates the UI to reflect the selected species list type and displays relevant controls.
 *
 * Shows or hides UI elements based on the chosen list type ("location", "nocturnal", or "custom"). If "custom" is selected and no custom list file is set for the current model, displays a warning toast.
 *
 * @param {string} list - The selected species list type.
 */
function setListUIState(list) {
  // Sets User Preferences for chosen model
  // cf. modelSettingsDisplay
  DOM.listToUse.value = list;
  const listElements = document.querySelectorAll(".list-hidden, .list-visible");
  listElements.forEach((element) => {
    element.classList.replace("list-visible", "list-hidden");
  });
  if (list === "location") {
    DOM.speciesThresholdEl.classList.replace("list-hidden", "list-visible");
  } else if (list === "nocturnal") {
    DOM.localSwitchContainer.classList.replace("list-hidden", "list-visible");
  } else if (list === "custom") {
    DOM.customListContainer.classList.replace("list-hidden", "list-visible");
    if (!config.models[config.selectedModel].customListFile) {
      generateToast({ type: "warning", message: "listFileNeeded" });
    }
  }
}

/**
 * Loads and processes a label file, updating species labels or custom lists for the application.
 *
 * If the label file cannot be fetched, displays an error toast and updates the UI to prompt for correction.
 * On success, updates the worker with the new labels or custom list, and ensures an "Unknown Sp._Unknown Sp." entry is present.
 *
 * @param {string} labelFile - Path or URL to the label file to load.
 * @param {string} [updating] - If set to "list", updates the custom species list; otherwise, updates locale labels.
 *
 * @throws {Error} If the label file cannot be fetched or read.
 */
async function readLabels(labelFile, updating) {
  try {
    const filecontents = await fs.promises.readFile(labelFile, "utf8");
    const labels = filecontents.trim().split(/\r?\n/);
    const unknown = `Unknown Sp.${getSplitChar()}Unknown Sp.`;
    if (!labels.includes(unknown)) labels.push(unknown);
    if (updating === "list") {
      worker.postMessage({
        action: "update-list",
        list: config.list,
        customLabels: labels,
        refreshResults: STATE.analysisDone,
      });
      trackEvent(config.UUID, "UI", "Create", "Custom list", labels.length);
    } else {
      LABELS = labels;
      worker.postMessage({
        action: "update-locale",
        locale: config.locale,
        labels: LABELS,
        refreshResults: STATE.analysisDone && STATE.mode !== 'chart',
      });
    }
  } catch (error) {
    if (error?.message?.startsWith("ENOENT")) {
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
    } else {
      console.error(`Error reading label file ${labelFile}:`, error);
    }
  }
}

function filterLabels(e) {
  DOM.contextMenu.classList.add("d-none");
  const i18 = i18n.get(i18n.Context);
  createFilterDropdown(
    e,
    STATE.tagsList,
    STATE.labelColors,
    STATE.labelFilters,
    i18
  );
}

/**
 * Creates and displays a custom context menu based on the event target.
 *
 * This asynchronous function handles user interactions for generating a context menu
 * in the spectrogram interface. It performs the following actions:
 * - Pauses any ongoing audio playback via the spec.wavesurfer instance to prevent interference.
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
  e.stopPropagation();
  if (this.closest("#spectrogramWrapper")){
    const region = spec.checkForRegion(e, true);
    if (!region)  return
      // If we let the playback continue, the region may get wiped
    if (spec.wavesurfer?.isPlaying()) WSPlayPause();
  }
  const i18 = i18n.get(i18n.Context);
  const target = e.target;
  if (target.closest("#sort-label")) {
    if (STATE.isMember) filterLabels(e);
    return;
  } else if (target.classList.contains("circle") || target.closest("thead"))
    return;
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
      await utils.waitFor(() => STATE.fileLoaded);
    }
  }
  if (!STATE.activeRegion && !inSummary) return;

  const createOrEdit =
    STATE.activeRegion?.label || target.closest("#summary") ? i18.edit : i18.create;

  DOM.contextMenu.innerHTML = `
    <div id="${inSummary ? "inSummary" : "inResults"}">
      <ul class="list-unstyled mb-1">
        <li class="dropdown-item ${hideInSummary}" id="play-region"><span class='material-symbols-outlined'>play_circle</span> ${
    i18.play
  }</li>
        <li class="dropdown-item ${hideInSummary} ${hideInSelection}" id="context-analyse-selection">
        <span class="material-symbols-outlined">search</span> ${i18.analyse}
        </li>
        <div class="dropdown-divider ${hideInSummary}"></div>
        <li class="dropdown-item" id="create-manual-record">
        <span class="material-symbols-outlined">edit_document</span> ${createOrEdit} ${
    i18.record
  }
        </li>
        <li class="dropdown-item" id="context-create-clip">
        <span class="material-symbols-outlined">music_note</span> ${i18.export}
        </li>
        <span class="dropdown-item" id="context-xc" target="xc">
        <img src='img/logo/XC.png' alt='' style="filter:grayscale(100%);height: 1.5em"> ${
          i18.compare
        }
        </span>
        <div class="dropdown-divider ${hideInSelection}"></div>
        <li class="dropdown-item ${hideInSelection}" id="context-delete">
        <span class='delete material-symbols-outlined'>delete_forever</span> ${
          i18.delete
        }
        </li>
        </ul>
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
  if (!(inSummary || STATE.activeRegion?.label || hideInSelection || hideInSummary)) {
    const xc = document.getElementById("context-xc");
    xc.classList.add("d-none");
    contextDelete.classList.add("d-none");
  }
  setTimeout(() => positionMenu(DOM.contextMenu, e), 100);
}

/**
 * Positions a context menu element near the mouse event, ensuring it remains within the visible viewport.
 *
 * Adjusts the menu's top and left coordinates to prevent it from overflowing the right or bottom edges of the window.
 *
 * @param {HTMLElement} menu - The menu element to position.
 * @param {MouseEvent} event - The mouse event triggering the menu display.
 */
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

const getSplitChar = () => config.selectedModel.includes('perch') ? '~' : '_';
/**
 * Displays and populates the record entry modal for adding or updating audio record details.
 *
 * Automatically fills form fields such as species, call count, comment, model ID, and score based on the current selection or batch mode. Adjusts UI elements for batch operations, updates localized labels, and initializes the label selector with available tags. Focus is set to the bird autocomplete input when the modal appears.
 *
 * @param {string} mode - The record update mode identifier.
 * @param {boolean} batch - Whether to apply batch mode settings.
 * @returns {Promise<void>} Resolves when the record entry form is ready and displayed.
 */
async function showRecordEntryForm(mode, batch) {
  const i18 = i18n.get(i18n.Headings);
  const cname = batch
    ? document.querySelector("#speciesFilter .text-warning .cname .cname")
        .textContent
    : STATE.activeRegion?.label || "";
  let callCount = "",
    commentText = "",
    modelID, score;
  if (cname && activeRow) {
    // Populate the form with existing values
    ({modelID, score} = unpackNameAttr(activeRow))
    commentText = activeRow.querySelector(".comment > span")?.title || "";
    callCount = parseInt(activeRow.querySelector(".call-count").textContent);
  } else {
    // Brand new record
    modelID = 0;
  }
  document
    .querySelectorAll(".species-search-label")
    .forEach((label) => (label.textContent = i18.search));
  const selectedBird = recordEntryForm.querySelector("#selected-bird");
  const autoComplete = document.getElementById("bird-autocomplete");
  autoComplete.value = "";
  const focusBirdList = () => autoComplete.focus();
  const speciesDisplay = document.createElement("div");
  speciesDisplay.className = "border rounded w-100";
  if (cname) {
    const species = LABELS.find(sp => sp.split(getSplitChar())[1] === cname);
    if (species) {
      const [sciName, commonName] = species.split(getSplitChar());
      const styled = `${commonName}<br/><i>${sciName}</i>`;
      selectedBird.innerHTML = styled;
    } else {
      selectedBird.innerHTML = i18.searchPrompt;
    }
  } else {
    selectedBird.innerHTML = i18.searchPrompt;
  }

  const batchHide = recordEntryForm.querySelectorAll(".hide-in-batch");
  batchHide.forEach((el) =>
    batch ? el.classList.add("d-none") : el.classList.remove("d-none")
  );

  recordEntryForm.querySelector("#call-count").value = callCount || 1;
  recordEntryForm.querySelector("#record-comment").value = commentText;
  recordEntryForm.querySelector("#DBmode").value = mode;
  recordEntryForm.querySelector("#batch-mode").value = batch;
  recordEntryForm.querySelector("#original-id").value = cname;
  recordEntryForm.querySelector("#original-modelID").value = modelID;
  recordEntryForm.querySelector("#original-score").value = score;
  const labelText = activeRow?.querySelector(".label").textContent;

  const labels = STATE.tagsList.map((item) => item.name);
  const i18nOptions = i18n.get(i18n.Select);
  const select = new CustomSelect({
    theme: "light",
    labels: labels,
    i18n: i18nOptions,
    preselectedLabel: labelText,
  });
  const container = document.getElementById("label-container");
  container.textContent = "";
  container.appendChild(select);
  recordEntryModalDiv.addEventListener("shown.bs.modal", focusBirdList);
  recordEntryModal.show();
}

recordEntryForm.addEventListener("submit", function (e) {
  e.preventDefault();
  const action = document.getElementById("DBmode").value;
  // cast boolstring to boolean
  const batch = document.getElementById("batch-mode").value === "true";
  const cname = document
    .getElementById("selected-bird")
    .innerText.split("\n")[0];
  // Check we selected a species
  if (!LABELS.some((item) => item.includes(cname))) return;
  let start, end;
  if (STATE.activeRegion) {
    start = STATE.windowOffsetSecs + STATE.activeRegion.start;
    end = STATE.windowOffsetSecs + STATE.activeRegion.end;
    const region = spec.REGIONS.regions.find(
      (region) => region.start === STATE.activeRegion.start
    );
    // You can still add a record if you cleared the regions
    region?.setOptions({ content: cname });
  }
  const originalCname = document.getElementById("original-id").value || cname;
  // Update the region label
  const count = document.getElementById("call-count")?.valueAsNumber;
  const comment = document.getElementById("record-comment")?.value;
  const select = document.getElementById("label-container").firstChild;
  const modelID = Number(document.getElementById("original-modelID").value) || 0;
  const confidence = Number(document.getElementById("original-score").value) || null;
  const label = select.selectedValue;

  recordEntryModal.hide();
  insertManualRecord({
    files: STATE.currentFile,
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
    modelID
  });
});

const insertManualRecord = ( {
  files,
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
  reviewed,
  modelID,
  undo
}  = {}) => {
  worker.postMessage({
    action: "insert-manual-record",
    cname,
    originalCname,
    start,
    end,
    comment,
    count,
    file: files,
    label,
    DBaction: action,
    batch,
    confidence,
    position: {
      row: activeRow?.rowIndex - 1,
      page: pagination.getCurrentPage(),
    }, //  have to account for the header row
    speciesFiltered: isSpeciesViewFiltered(true),
    reviewed,
    modelID,
    undo
  });
};

/**
 * Updates the frequency filter UI to indicate whether a custom frequency range is active.
 *
 * Applies warning styles and enables the reset button if the frequency range differs from the default; otherwise, restores default styles and disables the reset button.
 */
function checkFilteredFrequency() {
  const resetButton = document.getElementById("reset-spec-frequency");
  // const defaultMax = config.selectedModel.includes('slow') ? 120000 : 11950;
  const defaultMax = 11950;
  if (config.audio.frequencyMin > 0 || config.audio.frequencyMax < defaultMax) {
    document.getElementById("frequency-range").classList.add("text-warning");
    resetButton.classList.add("btn-warning");
    resetButton.classList.remove("btn-secondary", "disabled");
  } else {
    document.getElementById("frequency-range").classList.remove("text-warning");
    resetButton.classList.remove("btn-warning");
    resetButton.classList.add("btn-secondary", "disabled");
  }
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
    const message = i18n.get(i18nPurge);
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
  if (!STATE.fileLoaded) {
    const example_file = await window.electron.getAudio();
    // create a canvas for the audio spec
    utils.showElement(["spectrogramWrapper"], false);
    loadAudioFileSync({ filePath: example_file });
  }
  startTour();
};

// Function to display update download progress
const tracking = document.getElementById("update-progress");
const updateProgressBar = document.getElementById("update-progress-bar");
const displayProgress = (progressObj, text) => {
  tracking.querySelector('span').textContent = text;
  tracking.classList.remove("d-none");
  // Update your UI with the progress information
  updateProgressBar.value = progressObj.percent;
  if (progressObj.percent > 99.8) tracking.classList.add("d-none");
};
window.electron.onDownloadProgress((_event, progressObj) =>
  displayProgress(progressObj, "Downloading the latest update: ")
);



const loadingFiles = ({hide, content}) => {
  content ??= "Loading file...";
  if (hide){
    clearTimeout(loadingTimeout);
    DOM.loading.classList.add("d-none");
  } else {
    loadingTimeout = setTimeout(() => {
      DOM.loading.querySelector("#loadingText").textContent = content;
      DOM.loading.classList.remove("d-none");
    }, 500);
  }
}
/**
 * Displays a toast notification in the UI with optional localization, icon, and notification sound.
 *
 * The toast can be customized by type (info, warning, error), message variables, and autohide behavior. For certain messages, such as analysis completion after a long duration, it may also trigger a desktop notification or play a sound if enabled in the configuration.
 *
 * @param {Object} [options] - Toast configuration options.
 * @param {string} [options.message] - The message key or text to display.
 * @param {string} [options.type] - The type of toast ('info', 'warning', or 'error').
 * @param {boolean} [options.autohide] - Whether the toast should automatically hide. Defaults to true unless the type is 'error'.
 * @param {Object} [options.variables] - Variables for message interpolation.
 * @param {string} [options.locate] - Additional HTML or text to append to the message.
 */
function generateToast({
  message = "",
  type = "info",
  autohide,
  variables = undefined,
  locate = "",
} = {}) {
  // By default toasts are autohidden, unless they are errors
  autohide = autohide === undefined ? type !== "error" : autohide;
  // i18n
  const i18 = i18n.get(i18n.Toasts);
  loadingFiles({hide:true})
  if (message === "noFile") {
    // Alow further interactions!!
    STATE.currentFile && (STATE.fileLoaded = true);
  }
  message = variables
    ? utils.interpolate(i18[message], variables)
    : i18[message] || message;
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
    info: i18.info,
    warning: i18.warning,
    error: i18.error,
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
  if (message === i18.complete) {
    const duration = utils.parseDuration(
      DIAGNOSTICS["Analysis Duration"]
    );
    if (config.audio.notification && duration > 30) {
      if (Notification.permission === "granted") {
        // Check whether notification permissions have already been granted;
        // if so, create a notification
        const notification = new Notification(
          `Analysis completed in ${duration.toFixed(0)} seconds`,
          { requireInteraction: true, icon: "img/icon/chirpity_logo.png" }
        );
      } else if (Notification.permission !== "denied") {
        // We need to ask the user for permission
        Notification.requestPermission().then((permission) => {
          // If the user accepts, let's create a notification
          if (permission === "granted") {
            const notification = new Notification(
              `Analysis completed in ${duration.toFixed(0)} seconds`,
              { requireInteraction: true, icon: "img/icon/chirpity_logo.png" }
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

/**
 * Fetches and displays Xeno-Canto audio comparisons for the currently selected species and call type.
 *
 * Attempts to load cached comparison data; if unavailable, queries the Xeno-Canto API for relevant recordings, supporting both bird and bat models with appropriate call types and duration filters. Deduplicates and limits results per call type, updates the cache, and renders the comparison UI. Notifies the user if no suitable comparisons are found.
 */
async function getXCComparisons() {
  let {sname, cname} = unpackNameAttr(activeRow);
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
    const content = "Loading Xeno-Canto data...";
    loadingFiles({hide:false, content})
    const bats = config.selectedModel.includes('bats');
    const quality = "+q:%22>C%22";
    const defaultLength = bats ? "+len:0.5-10" : "+len:3-15";
    sname = XCtaxon[sname] || sname;
    const types = bats
      ? ["distress call", "feeding buzz", "social call", "ecolocation", "song"]
      : ["nocturnal flight call", "flight call", "call", "song"];
    const filteredLists = {}
    types.forEach((type) => {
      filteredLists[type] = []; // Initialize each type with an empty array
    });
    
    // Create an array of promises—one for each call type
    const fetchRequests = types.map((type) => {
      type = type.replaceAll(" ", "%20"); // Replace spaces with underscores for the API query
      // Use a different length parameter for "song"
      const typeLength = type === "song" ? "+len:10-30" : defaultLength;
      const query = `https://xeno-canto.org/api/3/recordings?key=d5e2d2775c7f2b2fb8325ffacc41b9e6aa94679e&query=sp:"${sname}"${quality}${typeLength}+type:"${type}"`;
      
      return fetch(query)
        .then((response) =>
          response.json().then((payload) => {
            if (!response.ok) {
              loadingFiles({hide:true})
              generateToast({ type: "error", message: payload.message || "noXC" });
              return null;
            }
            return payload;
          })
        )
        .then((data) => {
          if (!data || !data.recordings) return [];
          // Map each recording to the desired format and filter out empty file URLs
          const recordings = data.recordings
            .map((record) => ({
              file: record.file,    // media file
              rec: record.rec,      // recordist
              url: record.url,      // URL on XC
              type: record.type,    // call type
              smp: record.smp,      // sample rate
              licence: record.lic   // licence
            }))
            .filter((record) => record.file);
          // Shuffle the list so that subsequent slicing gives a different order
          utils.shuffle(recordings);
          return recordings;
        })
        .catch((error) => {
          loadingFiles({hide:true})
          console.warn("Error getting XC data for type", type, error);
          return [];
        });
    });
    
    // Wait for all four requests to complete
    Promise.all(fetchRequests).then((results) => {
      loadingFiles({hide:true})
      // Use a Set to track unique records by a chosen key, here we use 'file'
      const seenRecords = new Set();
    
      types.forEach((type, index) => {
        // Remove duplicates that have already been added from higher priority types.
        const uniqueRecords = results[index].filter(record => {
          const key = record.file;  // change this key if needed
          if (seenRecords.has(key)) {
            return false;
          } else {
            seenRecords.add(key);
            return true;
          }
        });
        // Limit to 10 records per type after shuffling and de-duplication
        filteredLists[type] = uniqueRecords.slice(0, 10);
      });
      
      // If all lists are empty, notify the user
      if (Object.values(filteredLists).every(arr => arr.length === 0)) {
        generateToast({ type: "warning", message: "noComparisons" });
        return;
      }
    
      // Cache and render the results
      XCcache[sname] = filteredLists;
      updatePrefs("XCcache.json", XCcache);
      console.log("XC response", filteredLists);
      renderComparisons(filteredLists, cname);
    });
    

  }
}


function renderComparisons(lists, cname) {
  const i18 = i18n.get(i18n.Context);
  const i18nTitle = i18n.get(i18n.Titles);
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
                                class="align-middle d-none d-lg-inline"> ${i18.play} </span>
                                /
                                <span class="material-symbols-outlined">pause</span><span
                                class="align-middle d-none d-lg-inline-block">${i18.pause}</span>
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
      }">${i18[callType]}</button>`;
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
        carouselItem.style.height = "256px";
        carouselItem.style.display = "flex";
        carouselItem.style.flexDirection = "column";
        carouselItem.style.justifyContent = "flex-end";
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
    compareDiv.remove();
  });
  compareDiv.addEventListener("slid.bs.carousel", () => showCompareSpec());
  compareDiv.addEventListener("shown.bs.modal", () => showCompareSpec());
  comparisonModal.show();
}
import WaveSurfer from "../node_modules/wavesurfer.js/dist/wavesurfer.esm.js";
import Spectrogram from "../node_modules/wavesurfer.js/dist/plugins/spectrogram.esm.js";

let ws;

const createCompareWS = (mediaContainer) => {
  ws?.destroy();
  const bats = config.selectedModel.includes('bats');
  ws = WaveSurfer.create({
    container: mediaContainer,
    backgroundColor: "rgba(0,0,0,0)",
    waveColor: "rgba(0,0,0,0)",
    progressColor: "rgba(0,0,0,0)",
    // but keep the playhead
    cursorColor: "#fff",
    hideScrollbar: true,
    cursorWidth: 2,
    height: 256,
    minPxPerSec: 195,
    sampleRate: bats ? 256000 : 24000,
  });
  // set colormap
  const colors = spec.createColormap(config);
  const createCmpSpec = () =>
    ws.registerPlugin(
      Spectrogram.create({
        windowFunc: "hann",
        frequencyMin: 0,
        frequencyMax: bats ? 120_000 : 12_000,
        labels: true,
        fftSamples: 256,
        height: 256,
        colorMap: colors,
        scale: "linear",
      })
    );
  createCmpSpec();
};

function showCompareSpec() {
  const activeCarouselItem = document.querySelector(
    "#recordings .tab-pane.active .carousel-item.active"
  );
  // Hide all xc-links
  document
    .querySelectorAll(".xc-link")
    .forEach((link) => link.classList.add("d-none"));
  // Show the active one
  const activeXCLink = activeCarouselItem.querySelector(".xc-link");
  activeXCLink && activeXCLink.classList.remove("d-none");

  const mediaContainer = activeCarouselItem.lastChild;
  // need to prevent accumulation, and find event for show/hide loading
  const loading = DOM.loading.cloneNode(true);
  loading.classList.remove("d-none", "text-white");
  loading.firstElementChild.textContent = "Loading audio from Xeno-Canto...";
  mediaContainer.appendChild(loading);
  const [_, file] = mediaContainer.getAttribute("name").split("|");
  // Create an instance of WaveSurfer
  createCompareWS(mediaContainer);
  ws.once("decode", function () {
    mediaContainer.removeChild(loading);
  });
  ws.load(file);
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
  RE: "text-bg-dark",
  EX: "text-bg-dark",
};

// Make config, LOCATIONS and displayLocationAddress and toasts available to the map script in index.html
export { config, displayLocationAddress, LOCATIONS, generateToast };

/**
 * Checks the user's membership status via a remote API and updates the UI to reflect feature access.
 *
 * Determines if the user is a member or within a trial period, unlocking or locking premium features accordingly. If the remote check fails, uses a cached membership status if available and less than one week old. Updates UI elements, feature availability, and branding based on membership state.
 *
 * @returns {Promise<boolean|undefined>} Resolves to `true` if the user is a member or within the trial period, `false` if not, or `undefined` if status cannot be determined and no valid cache exists.
 */
async function membershipCheck() {
  const twoWeeks = 14 * 24 * 60 * 60 * 1000; // "It's been two weeks since you looked at me..."
  const cachedStatus = localStorage.getItem("isMember") === 'true';
  config.debug && console.log('cached membership is', cachedStatus)
  const cachedTimestamp = Number(localStorage.getItem("memberTimestamp"));
  const now = Date.now();
  const installDate = new Date(config.installedAt ?? 0).getTime();
  const trialPeriod = await window.electron.trialPeriod();
  const installPeriod = now - installDate;
  const trialDaysLeft = Math.max(Math.ceil((trialPeriod - installPeriod)/86_400_000), 0)
  const inTrial = installPeriod < trialPeriod;
  const lockedElements = document.querySelectorAll(".locked, .unlocked");
  const unlockElements = () => {
    lockedElements.forEach((el) => {
      if (el instanceof HTMLSpanElement) {
        el.classList.replace("locked", "unlocked");
        el.textContent = "lock_open";
      } else {
        el.classList.remove("locked", "disabled");
        el.disabled = false;
      }
    });
  };

  const setLocks = () =>{
    document.getElementById("buy-me-coffee").classList.remove("d-none");

    config.keyAssignment = {};
    config.specDetections = false;
    config.detect.autoLoad = false;
    config.detect.combine = false;
    config.detect.merge = false;
    config.library.clips = false;
    config.database.location = "";
    // Set all backends to 'tensorflow'
    if (config.hasNode){
      Object.values(config.models).forEach(model => {
        model.backend = 'tensorflow';
      });
    }
    lockedElements.forEach((el) => {
      el.classList.replace("unlocked", "locked");

      if (el instanceof HTMLSpanElement) {
        el.textContent = "lock";
      } else {
        el.classList.remove("locked"); // remove coral color
        if (el instanceof HTMLSelectElement) el.selectedIndex = 0;
        el.classList.add('disabled');
        el.checked = false;
        el.disabled = true;
      }
    });
  }

  const MEMBERSHIP_API_ENDPOINT =
    await window.electron.MEMBERSHIP_API_ENDPOINT();
  return await checkMembership(config.UUID, MEMBERSHIP_API_ENDPOINT)
    .then(([isMember, level, expiresIn]) => {
      if (isMember || inTrial) {
        if (expiresIn && expiresIn < 30) {
          generateToast({
            message: "membershipExpiry",
            type: "warning",
            variables: { expiresIn },
          });
        }
        unlockElements();
        if (isMember) {
          document.getElementById("primaryLogo").src =
            `img/logo/chirpity_logo_subscriber_${level}.png`; // bronze / Silver (& Gold) available
        } else {
          document.getElementById("buy-me-coffee").classList.remove("d-none");
        }
        localStorage.setItem("isMember", isMember);
        localStorage.setItem("memberTimestamp", now);
      } else {
        setLocks()
        localStorage.setItem("isMember", false);
        if (!['birdnet', 'nocmig', 'chirpity'].includes(config.selectedModel)) {
          config.selectedModel = 'birdnet'      
        }
      }

      console.info(
        `Version: ${VERSION}. Trial: ${inTrial} Subscriber: ${isMember}`, trialDaysLeft
      );
      return isMember || inTrial;
    })
    .catch((error) => {
      // Period of grace
      if (
        cachedStatus === true &&
        cachedTimestamp &&
        now - cachedTimestamp < twoWeeks
      ) {
        console.warn("Using cached membership status during error.", error);
        unlockElements();
        document.getElementById("primaryLogo").src =
          "img/logo/chirpity_logo_subscriber_bronze.png";
        return true;
      } else {
        setLocks()
      }
    });
}

/**
 * Assigns a key binding configuration based on user input.
 *
 * Retrieves the column identifier from the DOM element with the ID matching `${key}-column` 
 * and uses it to update the global key assignment stored in `config.keyAssignment`. 
 * The function trims the value from the input element and sets it to `null` if empty. 
 * It marks the assignment as active when a non-empty value is provided and dynamically 
 * enables or disables the input element based on the presence of a valid column.
 *
 * @param {HTMLInputElement} inputEL - The input element that triggered the change event.
 * @param {string} key - The identifier used to locate the corresponding column element and update the key assignment configuration.
 * @returns {void}
 */
function setKeyAssignment(inputEL, key) {
  // Called on change to inputs
  const columnEl = document.getElementById(key + "-column");
  const column = columnEl.value;
  let active = false;
  const value = inputEL.value?.trim() || null;
  // column === 'label' && worker.postMessage({action: "get-tags"})
  if (column) {
    inputEL.disabled = false; // enable input
    if (value) {
      active = true;
      config.keyAssignment[key] = { column, value, active };
      config.debug &&
        console.log(`${key} is assigned to update ${column} with ${value}`);
    } else {
      config.keyAssignment[key] = { column, value, active };
      config.debug &&
        console.log(`${key} is assigned to update ${column} with ${value}`);
    }
  } else {
    inputEL.disabled = true; // disable input
    config.keyAssignment[key] = { column, value, active };
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
 * column elements using the format {@code key + '-column'}. Relies on a global {@code i18n.get} function and
 * an {@code i18n.Select} parameter to initialize internationalization context.
 */
function setKeyAssignmentUI(keyAssignments) {
  Object.entries(keyAssignments).forEach(([k, v]) => {
    const input = document.getElementById(k);
    input.value = v.value;
    v.value === "unused" || (input.disabled = false);
    document.getElementById(k + "-column").value = v.column;
    if (["label", "species"].includes(v.column))
      changeInputElement(v.column, input, k, v.value);
  });
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
function changeInputElement(column, element, key, preSelected = null) {
  if (column === "label") {
    const i18 = i18n.get(i18n.Select);
    const container = document.createElement("div");
    container.id = key;
    container.className = "form-control-sm bg-dark border-0";
    const labels = STATE.tagsList.map((item) => item.name);
    const select = new CustomSelect({
      theme: "dark",
      labels: labels,
      i18n: i18,
      preselectedLabel: preSelected,
    });
    container.appendChild(select);
    element.replaceWith(container);
    return container;
  } else {
    const input = document.createElement("input");
    input.className = "ms-2 form-control";
    input.id = key;
    input.value = preSelected;
    input.style = "font-size: small";
    if (column === "species") {
      const listContainer = document.getElementById(`bird-list-${key}`);
      input.addEventListener("input", () =>
        updateSuggestions(input, listContainer, true)
      );
    }
    element.replaceWith(input);
    return input;
  }
}

document.addEventListener("labelsUpdated", (e) => {
  const tags = e.detail.tags;
  const tagObjects = tags.map((name, index) => ({ id: index, name }));
  const deleted = e.detail.deleted;
  if (deleted) {
    console.log("Tag deleted:", deleted);
    worker.postMessage({ action: "delete-tag", deleted });
    STATE.tagsList = STATE.tagsList.filter((item) => item.name !== deleted);
  } else {
    // Find the new or renamed tag
    const alteredOrNew = tagObjects.find(
      (tag) => !STATE.tagsList.find((t) => t.name === tag.name)
    );
    STATE.tagsList = tags;
    console.log("Tag updated:", alteredOrNew);
    worker.postMessage({ action: "update-tag", alteredOrNew });
  }
  config.debug && console.log("Tags list:", STATE.tagsList);
});

/**
 * Returns a sorted list of bird label objects matching a search query.
 *
 * Filters the provided list of bird labels for entries containing the search string (case-insensitive), then splits each label into common and scientific names, and formats them for display. The results are sorted alphabetically by common name according to the application's locale.
 *
 * @param {string} search - The search term to match against bird labels.
 * @param {Array<string>} list - The list of bird labels in "sname_cname" format.
 * @returns {Array<{cname: string, sname: string, styled: string}>} Filtered and sorted bird label objects with display formatting.
 */
function getFilteredBirds(search, list) {
  if (!search || typeof search !== "string") return [];
  // console.warn("Non-string list entries:", list.filter(b => typeof b !== "string"));

  const collator = new Intl.Collator(config.locale.replace(/_.*$/, ""))
  const sortedList = list.filter(bird => typeof bird === "string" && bird.toLowerCase().includes(search))
    .map((item) => {
      // Flip sname and cname from "sname_/~cname"
      const [cname, sname] = item.split(getSplitChar()).reverse();
      return { cname, sname, styled: `${cname} <br/><i>${sname}</i>` };
    })
    .sort((a, b) =>
      collator.compare(
        a.cname,
        b.cname
      )
    );
  return sortedList;
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
  element.textContent = ""; // Clear any existing suggestions
  // Close any open lists
  const suggestionLists = document.querySelectorAll(".suggestions");
  suggestionLists.forEach((list) => (list.style.display = "none"));
  const label = document.querySelector(`label[for="${input.id}"]`);
  const list = [
    "bird-autocomplete-explore",
    "bird-autocomplete-chart",
  ].includes(input.id)
    ? STATE.seenSpecies
    : LABELS;
  let span;
  if (label) {
    span = label.querySelector("span"); // Check if a span already exists

    if (!span) {
      span = document.createElement("span");
      label.appendChild(span); // Append to label
    }
    span.textContent = ` (${list.length})`; // Update existing span
  }
  if (search.length < 2) {
    const oldSpecies = STATE.chart.species;
    STATE.chart.species = null;
    if (oldSpecies) callForChart();
    element.style.display = "none";
    return;
  }

  const filtered = getFilteredBirds(search, list);
  if (span) span.textContent = ` (${filtered.length})`;
  const fragment = document.createDocumentFragment();
  // Populate the suggestion list
  filtered.forEach((item) => {
    const li = document.createElement("li");
    li.className = "list-group-item";

    const text = document.createElement("span");
    text.textContent = item.cname;
    const italic = document.createElement("i");
    italic.textContent = item.sname;
    li.appendChild(text);
    li.appendChild(document.createElement("br"));
    li.appendChild(italic);

    li.addEventListener("click", () => {
      const selectedBird = document.getElementById("selected-bird");
      selectedBird.replaceChildren(
        text.cloneNode(true),
        document.createElement("br"),
        italic.cloneNode(true)
      );
      input.value = preserveInput ? item.cname : "";
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) {
        const span = label.querySelector("span");
        if (span) {
          span.remove(); // Removes the span if it exists
        }
      }

      if (input.id === "bird-autocomplete-explore") {
        filterResults({ species: item.cname, updateSummary: true });
        resetResults({
          clearSummary: false,
          clearPagination: false,
          clearResults: false,
        });
      } else if (input.id === "bird-autocomplete-chart") {
        STATE.chart.species = item.cname;
        callForChart();
      }
      input.dispatchEvent(new Event("change", { bubbles: true })); // fire the change event
      element.style.display = "none";
    });
    fragment.appendChild(li);
  });
  element.appendChild(fragment);
  element.style.display = filtered.length ? "block" : "none";
  // Make sure the dropdown is visble
  element.getBoundingClientRect().bottom > window.innerHeight &&
    element.scrollIntoView({ behavior: "smooth", block: "end" });
}

// Update suggestions on each input event
const autocomplete = document.querySelectorAll(".autocomplete");
autocomplete.forEach((input) => {
  const listContainer = input
    .closest(".bird-search")
    .querySelector(".suggestions");
  input.addEventListener("input", () =>
    updateSuggestions(input, listContainer, true)
  );
});

// Toggle the display of the suggestion list when the caret is clicked
const dropdownCaret = document.querySelectorAll(".input-caret");
dropdownCaret.forEach((caret) =>
  caret.addEventListener("click", (e) => {
    const suggestionsList = e.target
      .closest(".bird-search")
      .querySelector(".suggestions");
    if (suggestionsList.style.display === "block") {
      suggestionsList.style.display = "none";
    } else {
      const inputField = e.target
        .closest(".bird-search")
        .querySelector("input");
      updateSuggestions(inputField, suggestionsList);
    }
  })
);

/**
 * Adds a record's metadata to the global history and returns its extracted details.
 *
 * Extracts species, time range, confidence, label, call count, comment, file, row, table, and model ID from a DOM record element. Optionally overrides the species name with a provided canonical name. Returns an object with the extracted data if the record is within a table; otherwise, returns undefined.
 *
 * @param {HTMLElement} record - The DOM element representing the detection record.
 * @param {string} [newCname] - Optional canonical species name to override the extracted value.
 * @returns {Object|undefined} Extracted record details if the element is within a table; otherwise, undefined.
 */
function addToHistory(record, newCname) {
  // prepare the undelete record
  const {file, start, end, cname: species, score: confidence, modelID} = unpackNameAttr(record);
  const setting = record.closest("table");
  if (setting) {
    const comment = record.querySelector(".comment").innerText;
    const label = record.querySelector(".label").innerText;
    let callCount = Number(record.querySelector(".call-count").innerText || 1);
    let reviewed = !!record.querySelector(".reviewed").innerText;
    HISTORY.push({
      files:file,
      cname: species,
      start,
      end,
      comment,
      count: parseInt(callCount),
      label,
      originalCname: newCname || species,
      confidence,
      modelID,
      reviewed,
    });
    return {
      species,
      start,
      end,
      confidence,
      label,
      callCount,
      comment,
      file,
      row: record.closest('tr'),
      setting,
      modelID
    };
  }
}

document.addEventListener("filter-labels", (e) => {
  STATE.labelFilters = e.detail.filters;
  worker.postMessage({
    action: "update-state",
    labelFilters: STATE.labelFilters,
    species: isSpeciesViewFiltered(true),
  });
});


function updateModelOptions(customOnly){
  const formElement = customOnly ? 'custom-models' : 'model-to-use';
  const select = document.getElementById(formElement);
  // Update the model selector options
  select.replaceChildren();
  // Add options
  const modelOptions = customOnly 
    ? Object.fromEntries(Object.entries(config.models)
    .filter(([model, _]) => !['nocmig', 'chirpity','birdnet'].includes(model)))
    : config.models;
  // Add new options from the object
  for (const [model, opt] of Object.entries(modelOptions)) {
    const option = document.createElement('option');
    option.value = model;
    option.textContent = opt.displayName;
    select.appendChild(option);
  }
  customOnly || (select.value = config.selectedModel)
}

// Update checking for Intel Mac

function checkForIntelMacUpdates() {
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
          const message = utils.interpolate(i18n.get(i18n.UpdateMessage), {
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