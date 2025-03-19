/**
 * @file User Interface code.
 * Contains functions for rendering the spectrogram, updating settings, rendering the screen
 */

import {
  trackVisit as _trackVisit,
  trackEvent as _trackEvent,
} from "./utils/tracking.js";
import { checkMembership } from "./utils/member.js";
import { DOM } from "./utils/DOMcache.js";
import { IUCNtaxonomy } from "./utils/IUCNcache.js";
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
// Save console.warn and console.error functions
const originalInfo = console.info;
const originalWarn = console.warn;
const originalError = console.error;

// Override console.warn to intercept and track warnings
console.info = function () {
  // Call the original console.info to maintain default behavior
  originalInfo.apply(console, arguments);
  // Track the warning message using your tracking function
  trackEvent(
    config.UUID,
    "Information",
    arguments[0],
    utils.customURLEncode(arguments[1])
  );
};

// Override console.warn to intercept and track warnings
console.warn = function () {
  originalWarn.apply(console, arguments);
  trackEvent(
    config.UUID,
    "Warnings",
    arguments[0],
    utils.customURLEncode(arguments[1])
  );
};

// Override console.error to intercept and track errors
console.error = function () {
  originalError.apply(console, arguments);
  trackEvent(
    config.UUID,
    "Errors",
    arguments[0],
    utils.customURLEncode(arguments[1])
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
    utils.customURLEncode(stackTrace)
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
    utils.customURLEncode(stackTrace)
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
        recordUpdate(e.key);
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
  c: (e) => (e.ctrlKey || e.metaKey) && STATE.currentBuffer && spec.centreSpec(),
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
      const {species, start, end,  label, callCount, comment, file} = addToHistory(activeRow);
      insertManualRecord({
        files: file,
        cname: species,
        start: parseFloat(start),
        end: parseFloat(end),
        label,
        comment,
        count: callCount,
        action: "Update",
        batch: false,
        originalCname: species
      });
    }
  },
  z: (e) => {
    if ((e.ctrlKey || e.metaKey) && HISTORY.length)
      insertManualRecord(HISTORY.pop());
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
      STATE.diskHasRecords && utils.enableMenuItem(["explore", "charts"]);
      generateToast({ message: "cancelled" });
      DOM.progressDiv.classList.add("invisible");
    }
  },
  Home: () => {
    if (STATE.currentBuffer && STATE.regionsCompleted) {
      STATE.windowOffsetSecs = 0;
      postBufferUpdate({});
    }
  },
  End: () => {
    if (STATE.currentBuffer && STATE.regionsCompleted) {
      STATE.windowOffsetSecs = STATE.currentFileDuration - STATE.windowLength;
      postBufferUpdate({ begin: STATE.windowOffsetSecs, position: 1 });
    }
  },
  PageUp: () => {
    if (STATE.currentBuffer && STATE.regionsCompleted) {
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
    if (activeRow && STATE.regionsCompleted) {
      activeRow.classList.remove("table-active");
      activeRow = activeRow.previousSibling || activeRow;
      if (!activeRow.classList.contains("text-bg-dark")) activeRow.click();
      // activeRow.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  },
  PageDown: () => {
    if (STATE.currentBuffer && STATE.regionsCompleted) {
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
    if (activeRow && STATE.regionsCompleted) {
      activeRow.classList.remove("table-active");
      activeRow = activeRow.nextSibling || activeRow;
      if (!activeRow.classList.contains("text-bg-dark")) activeRow.click();
      // activeRow.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  },
  ArrowLeft: () => {
    const skip = STATE.windowLength / 100;
    if (STATE.currentBuffer && STATE.regionsCompleted) {
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
    if (STATE.currentBuffer && STATE.regionsCompleted) {
      const now = spec.wavesurfer.getCurrentTime();
      if (spec.wavesurfer.isReady) {
        // This will trigger the finish event if at the end of the window
        spec.wavesurfer.setTime(now + skip);
      }
      // }
    }
  },
  "=": (e) => (e.metaKey || e.ctrlKey ? config.FFT = spec.reduceFFT() : spec.zoom("In")),
  "+": (e) => (e.metaKey || e.ctrlKey ? config.FFT = spec.reduceFFT() : spec.zoom("In")),
  "-": (e) => (e.metaKey || e.ctrlKey ? config.FFT = spec.increaseFFT() : spec.zoom("Out")),
  F5: () => config.FFT = spec.reduceFFT(),
  F4: () => config.FFT = spec.increaseFFT(),
  " ": async () => {
    if (spec.wavesurfer) {
      try {
        await spec.wavesurfer.playPause();
      } catch (e) {
        console.warn("Wavesurfer error", error.message || error);
      }
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
  Delete: () => activeRow && deleteRecord(activeRow),
  Backspace: () => activeRow && deleteRecord(activeRow),
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
const p = window.module.p;
const uuidv4 = window.module.uuidv4;
const os = window.module.os;

// Is this CI / playwright?
const isTestEnv = window.env.TEST_ENV === "true";
const trackVisit = isTestEnv ? () => {} : _trackVisit;
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

let modelReady = false;
let PREDICTING = false,
  t0,
  app_t0 = Date.now();



let activeRow;
let predictions = {},
  clickedIndex;
// Set content container height
DOM.contentWrapper.style.height = document.body.clientHeight - 80 + "px";

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
    newHeight = Math.min(newHeight, spec.maxHeight(DOM));
    // Adjust the spectrogram dimensions accordingly
    debounceTimer = setTimeout(() => {
      spec.adjustDims(true, config.FFT, newHeight);
    }, 100);
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
  if (clearPagination) pagination.hide();
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
 * Loads an audio file by dispatching a file-load request to the worker.
 *
 * This function resets the file status and signals the worker to start processing the file.
 * It is triggered when a user opens a new file or selects a file from the list of open files.
 *
 * @param {string} filePath - The full filesystem path of the audio file.
 * @param {boolean} preserveResults - If true, existing analysis results are retained; otherwise, they are cleared.
 */
function loadAudioFileSync({ filePath = "", preserveResults = false }) {
  STATE.fileLoaded = false;
  locationID = undefined;
  worker.postMessage({
    action: "file-load-request",
    file: filePath,
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
  STATE.regionsCompleted = false;
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
  loadingTimeout = setTimeout(() => {
    DOM.loading.querySelector("#loadingText").textContent = "Loading file...";
    DOM.loading.classList.remove("d-none");
  }, 500);
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
  //e.preventDefault();
  e.stopImmediatePropagation();
  const menu = DOM.contextMenu;
  const i18 = i18n.get(i18n.Context);
  menu.innerHTML = `
    <a class="dropdown-item" id="setCustomLocation"><span
    class="material-symbols-outlined align-bottom pointer">edit_location_alt</span> ${i18.location}</a>
    <a class="dropdown-item" id="setFileStart"><span
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
  LOCATIONS = undefined;
  worker.postMessage({ action: "get-locations", file: STATE.currentFile });
  await utils.waitFor(() => LOCATIONS);
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
      return { name: fileName, time: stats.mtime.getTime() };
    })
  );

  return fileData
    .sort((a, b) => a.time - b.time) // Sort by modification time
    .map((file) => file.name); // Return sorted file names
}
async function onOpenFiles(args) {
  const sanitisedList = args.filePaths;
  if (!sanitisedList.length) return;
  DOM.loading.querySelector("#loadingText").textContent = "Loading files...";
  DOM.loading.classList.remove("d-none");
  // Store the sanitised file list and Load First audio file
  utils.hideAll();
  utils.showElement(["spectrogramWrapper"], false);
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
  STATE.openFiles = sanitisedList;
  worker.postMessage({
    action: "check-all-files-saved",
    files: STATE.openFiles,
  });

  // Sort file by time created (the oldest first):
  if (STATE.openFiles.length > 1) {
    if (modelReady) utils.enableMenuItem(["analyseAll", "reanalyseAll"]);
    STATE.openFiles = await sortFilesByTime(STATE.openFiles);
  }
  // Reset analysis status
  STATE.analysisDone = false;
  loadAudioFileSync({ filePath: STATE.openFiles[0] });

  // Clear unsaved records warning
  window.electron.unsavedRecords(false);
  document.getElementById("unsaved-icon").classList.add("d-none");
  // Reset the buffer playhead and zoom:
  STATE.windowOffsetSecs = 0;
  STATE.windowLength = 20;
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
  DOM.fileNumber.textContent = "";
  resetDiagnostics();
  DOM.progressDiv.classList.remove("invisible");
}

/**
 * Refreshes the results view in the UI based on the current file loading state and available predictions.
 *
 * When a file is loaded, this function hides all UI elements and then displays the spectrogram wrapper.
 * If there are prediction results available, it additionally reveals the results table container and results header.
 * If no file is loaded and there are no open files, all UI elements are hidden.
 */
function refreshResultsView() {
  if (STATE.fileLoaded) {
    utils.hideAll();
    utils.showElement(["spectrogramWrapper"], false);
    if (!utils.isEmptyObject(predictions)) {
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
    utils.disableMenuItem(["analyseSelection", "explore", "charts"]);
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
          await utils.waitFor(() => LOCATIONS); // Ensure this is awaited
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

async function batchExportAudio() {
  const species = isSpeciesViewFiltered(true);
  species
    ? exportData("audio", species, 1000)
    : generateToast({ type: "warning", message: "mustFilterSpecies" });
}

async function exportData(
  format,
  species = isSpeciesViewFiltered(true),
  limit = Infinity,
  duration
) {
  const defaultPath = localStorage.getItem("lastSaveFolder") || "";
  let location, lastSaveFolder;
  if (["Audacity", "audio"].includes(format)) {
    // Audacity exports one label file per file in results
    const response = await window.electron.selectDirectory(defaultPath);
    if (response.canceled) return;
    location = response.filePaths[0];
    lastSaveFolder = location;
  } else {
    let filename = species || "All";
    filename += format == "Raven" ? `_selections.txt` : "_detections.csv";
    const filePath = p.join(defaultPath, filename);
    location = await window.electron.exportData({ defaultPath: filePath });
    if (!location) return;
    lastSaveFolder = p.dirname(location);
  }
  worker.postMessage({
    action: "export-results",
    path: location,
    format,
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
  utils.enableMenuItem(["active-analysis", "explore"]);
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
  worker.postMessage({
    action: "chart",
    species: undefined,
    range: STATE.chart.range,
  });
}


/**
 * Prepares the interface for Explore mode by updating UI elements, state flags, and worker messages.
 *
 * This asynchronous function sets the file load flag and analysis state, enables and disables appropriate menu items,
 * and sends corresponding messages to the worker to switch to Explore mode and fetch the detected species list for the current range.
 * It also awaits the generation of a location filter, attaches a change event listener to it, reinitializes the spectrogram,
 * resets analysis results, and adjusts the UI layout to prevent scroll issues.
 */
async function showExplore() {
  // Change STATE.fileLoaded this one time, so a file will load!
  STATE.fileLoaded = true;
  saveAnalyseState();
  utils.enableMenuItem([
    "saveCSV",
    "save-eBird",
    "save-Raven",
    "charts",
    "active-analysis",
  ]);
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
    species: isSpeciesViewFiltered(true),
    range: STATE.explore.range,
  });
  resetResults();
  // Prevent scroll up hiding navbar
  spec.adjustDims();
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
  // Prevent the wavesurfer error
  spec.spectrogram && spec.spectrogram.destroy();
  spec.spectrogram = null;
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
  if (!STATE.fileLoaded) {
    console.warn("Cannot process click - no audio file is loaded");
    return;
  }
  if (!STATE.regionsCompleted) {
    console.warn("Cannot process click - regions are still being created");
    return;
  }
  let row = e.target.closest("tr");
  if (!row || row.classList.length === 0 || row.closest("#resultsHead")) {
    // 1. clicked and dragged, 2 no detections in file row 3. clicked a header
    return;
  }
  const [file, start, end, _, label] = row.getAttribute("name").split("|");

  if (activeRow) activeRow.classList.remove("table-active");
  row.classList.add("table-active");
  activeRow = row;
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
  const rows = DOM.resultTable.querySelectorAll("tr");
  for (const r of rows) {
    const [file, rowStart, _end, _, _label] = r.getAttribute("name").split("|");

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
  if (STATE.windowLength <= 3.5) STATE.windowLength = 6;
  let windowOffsetSecs = STATE.windowOffsetSecs;
  windowOffsetSecs = Math.max(0, start - STATE.windowLength / 2 + 1.5);
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
  spec.adjustDims(true);
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
  newInstallDate: 0,
  library: {
    location: undefined,
    format: "ogg",
    auto: false,
    trim: false,
    clips: false,
  },
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
    autoLoad: false,
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
  keyAssignment: {},
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
  await fs.readFile(configFile, "utf8", (err, data) => {
    if (err) {
      console.log("Config not loaded, using defaults");
      // Use defaults if no config file
      if (!fs.existsSync(configFile)) config = defaultConfig;
      else {
        generateToast({ type: "error", message: "configReadError" });
        config = defaultConfig;
      }
    } else {
      config = JSON.parse(data);
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
    utils.syncConfig(config, defaultConfig);

    membershipCheck().then((isMember) => (STATE.isMember = isMember));

    // Disable SNR
    config.filters.SNR = 0;

    // set version
    config.VERSION = VERSION;
    DIAGNOSTICS["UUID"] = config.UUID;

    // Set UI option state
    // Fontsize
    config.fontScale === 1 || setFontSizeScale(true);
    // Ensure config.model is valid (v1.10.x management)
    if (!["birdnet", "chirpity", "nocmig"].includes(config.model)) {
      config.model = "birdnet";
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
    LIST_MAP = i18n.get(i18n.LIST_MAP);
    // Localise UI
    i18n.localiseUI(DOM.locale.value).then((result) => (STATE.i18n = result));
    initialiseDatePicker(STATE, worker, config, resetResults, filterResults, i18n.get);
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
    if (config.colormap === "igreys") config.colormap = "gray";
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
    config.customColormap.windowFn === "gauss" &&
      document.getElementById("alpha").classList.remove("d-none");
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
    document.getElementById("auto-load").checked = config.detect.autoLoad;
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
    if (config.library.location) {
      document.getElementById("library-location").value =
        config.library.location;
      document.getElementById("library-format").value = config.library.format;
      document.getElementById("library-trim").checked = config.library.trim;
      document.getElementById("library-clips").checked = config.library.clips;
      const autoArchive = document.getElementById("auto-library");
      autoArchive.checked = config.library.auto;
    }
    setListUIState(config.list);
    worker.postMessage({
      action: "update-state",
      library: config.library,
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
            locale === "pt" && (locale = "pt_PT");
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
          spec.adjustDims();
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
          STATE.seenSpecies = args.list.map((item) => item.label);
          break;
        }
        case "tfjs-node": {
          // Have we gone from a no-node setting to a node one?
          const changedEnv = config.hasNode !== args.hasNode;
          if (changedEnv && args.hasNode) {
            // If not using tensorflow, switch to the tensorflow backend because this faster under Node
            config[config.model].backend !== "tensorflow" &&
              handleBackendChange("tensorflow");
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
 * (`STATE.activeRegion.start`, if defined). If the detection is active and the `goToRegion` flag is true, the view is repositioned
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
  // Prevent region cluster fest
  STATE.regionsCompleted = true;
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
function onChartData(args) {
  if (args.species) {
    utils.showElement(["recordsTableBody"], false);
    const title = document.getElementById("speciesName");
    title.textContent = args.species;
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

window.addEventListener("resize", function () {
  utils.waitForFinalEvent(
    function () {
      spec.adjustDims(true);
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
      250,
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
  setActiveRow(start + STATE.windowOffsetSecs);
}

const spec = new ChirpityWS(
  "#waveform",
  () => STATE, // Returns the current state
  () => config, // Returns the current config
  { postBufferUpdate, trackEvent, setActiveRegion, onStateUpdate: state.update, updatePrefs },
  GLOBAL_ACTIONS
);


const updateListIcon = () => {
  LIST_MAP = i18n.get(i18n.LIST_MAP);
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
  setListUIState(config.list);
  updateList();
});

DOM.customListSelector.addEventListener("click", async () => {
  const defaultPath = localStorage.getItem("customList") || "";
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
    LIST_MAP = i18n.get(i18n.LIST_MAP);
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
  if (STATE.fileLoaded && STATE.regionsCompleted) {
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
function recordUpdate(key) {
  if (!activeRow) {
    console.info("No active row selected for key assignment", key);
    return;
  }
  const assignment = config.keyAssignment["key" + key];
  if (assignment?.column && assignment?.value) {
    const nameAttribute = activeRow.getAttribute("name");
    const [file, start, end, sname, cname] = nameAttribute.split("|");
    const commentCell = activeRow.querySelector(".comment > span");
    const comment = commentCell ? commentCell.title : "";
    const labelCell = activeRow.querySelector(".label > span");
    const label = labelCell ? labelCell.textContent : "";
    const name = cname.replace("?", "");

    const newCname = assignment.column === "species" ? assignment.value : name;
    const newLabel =
      assignment.column === "label" ? assignment.value : label || "";
    const newComment =
      assignment.column === "comment" ? assignment.value : comment;
    // Save record for undo
    const { callCount, confidence } = addToHistory(activeRow, newCname);
    // If we set a new species, we want to give the record a 2000 confidence
    // However, if we just add a label or, leave the confidence alone
    const certainty = assignment.column === "species" ? 2000 : confidence;
    insertManualRecord({
      files: file,
      cname: newCname,
      start: parseFloat(start),
      end: parseFloat(end),
      comment: newComment,
      count: callCount,
      label: newLabel,
      action: "Update",
      batch: false,
      originalCname: cname,
      confidence: certainty
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
  DOM.backendOptions?.forEach((backend) => (backend.disabled = bool));
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
  if (STATE.currentFile && STATE.regionsCompleted) {
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

  document.getElementById("loading-screen").classList.add("d-none");
  // Get all the tags from the db
  worker.postMessage({ action: "get-tags", init: true });
  // New users - show the tour
  if (!isTestEnv && !config.seenTour) {
    config.seenTour = true;
    prepTour();
  }
  if (OS_FILE_QUEUE.length)
    onOpenFiles({ filePaths: OS_FILE_QUEUE }) && OS_FILE_QUEUE.shift();
}

/**
 * Handles audio data loaded by the worker and updates the UI and application state.
 *
 * This function clears loading indicators and any open context menus, assigns the loaded audio buffer
 * along with its timing and metadata to global state, resets any existing audio regions, and updates
 * the spectrogram with the new audio data. It also updates the filename display and enables analysis-related
 * menu options when applicable.
 *
 * @param {*} location - Identifier for the source location of the audio.
 * @param {number} fileStart - Unix epoch time in milliseconds marking the start time of the audio file.
 * @param {number} fileDuration - Duration of the audio file in seconds.
 * @param {number} windowBegin - Offset in seconds from the start of the file indicating the beginning of the audio window.
 * @param {string} file - Full path to the audio file.
 * @param {number} position - Normalized playhead position (0 to 1) within the audio file.
 * @param {*} contents - Audio buffer containing the loaded audio data.
 * @param {boolean} play - Flag indicating whether to automatically play the audio after loading.
 * @param {boolean} queued - Flag indicating if the audio load was queued.
 * @param {Object} [metadata] - Optional metadata associated with the audio file.
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
  STATE.currentFileDuration = fileDuration;
  //if (preserveResults) completeDiv.hide();
  config.debug &&
    console.log(
      `UI received worker-loaded-audio: ${file}, buffered: ${
        queued === true
      }, play: ${play}`
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
    ? new Date(fileStart)
    : new Date(0, 0, 0, 0, 0, 0, 0);
  STATE.bufferStartTime = new Date(initialTime.getTime() + windowBegin * 1000);

  if (STATE.windowLength > STATE.currentFileDuration) STATE.windowLength = STATE.currentFileDuration;

  resetRegions();
  await spec.updateSpec({
    buffer: STATE.currentBuffer,
    position: position,
    play: play,
    resetSpec: resetSpec,
  });
  // Doe this after the spec has loaded the file
  STATE.fileLoaded = true;
  if (modelReady) {
    utils.enableMenuItem(["analyse"]);
    if (STATE.openFiles.length > 1) utils.enableMenuItem(["analyseAll"]);
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
/**
 * Updates the UI progress elements during file loading.
 *
 * Removes the "invisible" class from the progress indicator, then either displays a localized
 * loading message (when the "text" flag is provided) or shows the current file's position within the
 * queue of open files. If a progress value is provided, it calculates the percentage (with one-decimal
 * precision) and updates the progress bar accordingly.
 *
 * @param {Object} args - Object containing details for the progress update.
 * @param {boolean} [args.text] - When truthy, displays a localized "awaiting" message instead of file count.
 * @param {File} [args.file] - The file whose loading progress is being updated.
 * @param {number} [args.progress] - A value between 0 and 1 representing the load progress.
 */
function onProgress(args) {
  DOM.progressDiv.classList.remove("invisible");
  if (args.text) {
    DOM.fileNumber.innerHTML = `<span class='loading text-nowrap'>${i18n.get(
      awaiting
    )}</span>`;
  } else {
    const count = STATE.openFiles.indexOf(args.file) + 1;
    DOM.fileNumber.textContent = utils.interpolate(i18n.get(i18nFile), {
      count: count,
      fileCount: STATE.openFiles.length,
    });
  }
  if (args.progress) {
    let progress = Math.round(args.progress * 1000) / 10;
    updateProgress(progress);
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
  STATE.diskHasRecords && utils.enableMenuItem(["explore", "charts"]);
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
    DIAGNOSTICS["Analysis Duration"] = utils.formatDuration(analysisTime);
    DIAGNOSTICS["Analysis Rate"] =
      rate.toFixed(0) + "x faster than real time performance.";
    generateToast({ message: "complete" });
    // activateResultSort();
  }
}

/**
 * Finalizes UI updates after summary data retrieval.
 *
 * This function updates the summary view with new data and applies filters if specified.
 * It enhances the summary table by adding pointer and hover effects to species rows, triggers
 * result sorting when appropriate,  and toggles
 * menu item availability based on the summary content and current application state.
 *
 * @param {Object} options - An object containing update parameters.
 * @param {*} [options.filterSpecies] - Optional criteria to filter species in the summary.
 * @param {Array} [options.summary=[]] - An array of summary records to be used for updating the UI.
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
    utils.enableMenuItem(["saveLabels", "saveCSV", "save-eBird", "save-Raven"]);
    STATE.mode !== "explore" && utils.enableMenuItem(["save2db"]);
  } else {
    utils.disableMenuItem([
      "saveLabels",
      "saveCSV",
      "save-eBird",
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
    !STATE.regionsCompleted ||
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
                </tr>`;
      setTimelinePreferences();
      // DOM.resultHeader.innerHTML = fragment;
    }
    utils.showElement(["resultTableContainer", "resultsHead"], false);
    // If  we have some results, let's update the view in case any are in the window
    if (
      config.specDetections &&
      !isFromDB &&
      !STATE.selection &&
      STATE.regionsCompleted
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
      : "";
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
  if (target === activeRow) {
  } else if (target instanceof PointerEvent) target = activeRow;
  else {
    // A batch delete?
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
  // If there is no row (deleted last record and hit delete again):
  if (clickedIndex === -1) return;
  const { species, start, end, file, row, setting } = addToHistory(target);

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
  if (STATE.activeRegion.label) {
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
  const i18 = i18n.get(i18n.SpeciesList);
  const current_file_text =
    STATE.week !== -1 && STATE.week
      ? utils.interpolate(i18.week, { week: STATE.week })
      : "";
  const model = config.model === "birdnet" ? "BirdNET" : "Nocmig";
  const localBirdsOnly =
    config.local && config.model === "birdnet" && config.list === "nocturnal"
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
  const i18 = i18n.get(i18n.Titles);
  if (on) {
    DOM.nocmigButton.textContent = "nights_stay";
    DOM.nocmigButton.title = i18.nocmigOn;
    DOM.nocmigButton.classList.add("text-info");
  } else {
    DOM.nocmigButton.textContent = "bedtime_off";
    DOM.nocmigButton.title = i18.nocmigOff;
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
  // resetResults({clearSummary: false, clearPagination: false, clearResults: true});
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
  const fileList = Array.from(event.dataTransfer.files)
    .filter(
      (file) =>
        !file.name.startsWith(".") &&
        (!file.type ||
          file.type.startsWith("audio/") ||
          file.type.startsWith("video/"))
    )
    .map((file) => file.path);

  worker.postMessage({ action: "get-valid-files-list", files: fileList });
  // For electron 32+
  // const filelist = audioFiles.map(file => window.electron.showFilePath(file));
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
  const i18 = i18n.get(i18n.Titles);
  if (
    config.filters.active &&
    (config.filters.highPassFrequency ||
      (config.filters.lowShelfAttenuation &&
        config.filters.lowShelfFrequency) ||
      config.filters.normalise)
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
  if (STATE.fileLoaded && STATE.regionsCompleted) {
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
  if (STATE.regionsCompleted) {
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
function handleUIClicks(e) {
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
      exportData("Audacity");
      break;
    }
    case "saveCSV": {
      exportData("text");
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
      if (config.library.auto)
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
      const fftSamples = spec.spectrogram.fftSamples;
      spec.adjustDims(true, fftSamples);
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
      if (spec.wavesurfer) {
        try {
          (async () => {
            await spec.wavesurfer.playPause();
          })();
        } catch (e) {
          console.warn("Wavesurfer error", e.message || JSON.stringify(e));
        }
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
document.addEventListener("change", function (e) {
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
          worker.postMessage({
            action: "update-state",
            useWeek: config.useWeek,
          });
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
            i18n
              .localiseUI(DOM.locale.value)
              .then((result) => (STATE.i18n = result));
            config.locale = element.value;
            setNocmig();
            contextAwareIconDisplay();
            updateListIcon();
            filterIconDisplay();
            initialiseDatePicker(STATE, worker, config, resetResults, filterResults, i18n.get);
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
            ? (LIST_MAP = i18n.get(i18n.LIST_MAP))
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
          if (spec.wavesurfer && STATE.currentFile && STATE.regionsCompleted) {
            const fftSamples = spec.spectrogram.fftSamples;
            spec.adjustDims(true, fftSamples);
            postBufferUpdate({
              begin: STATE.windowOffsetSecs,
              position: spec.wavesurfer.getCurrentTime() / STATE.windowLength,
            });
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
          windowFn === "gauss"
            ? document.getElementById("alpha").classList.remove("d-none")
            : document.getElementById("alpha").classList.add("d-none");
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
          if (spec.wavesurfer && STATE.currentFile) {
            const fftSamples = spec.spectrogram.fftSamples;
            spec.adjustDims(true, fftSamples);
            spec.refreshTimeline();
          }
          break;
        }
        case "gain": {
          DOM.gainAdjustment.textContent = element.value + "dB";
          element.blur();
          config.audio.gain = element.value;
          worker.postMessage({ action: "update-state", audio: config.audio });
          config.filters.active || toggleFilters();
          if (STATE.fileLoaded && STATE.regionsCompleted) {
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
            const fftSamples = spec.spectrogram.fftSamples;
            spec.adjustDims(true, fftSamples);
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
          const fftSamples = spec.spectrogram.fftSamples;
          spec.adjustDims(true, fftSamples);
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
          const fftSamples = spec.spectrogram.fftSamples;
          spec.adjustDims(true, fftSamples);
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
          if (STATE.fileLoaded && STATE.regionsCompleted) {
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

// function getI18n(context) {
//   const locale = config.locale.replace(/_.*$/, "");
//   return context[locale] || context["en"];
// }


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
  // If we let the playback continue, the region may get wiped
  if (spec.wavesurfer?.isPlaying()) spec.wavesurfer.pause();
  e.stopPropagation();
  this.closest("#spectrogramWrapper") && spec.checkForRegion(e, true);
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
        <a class="dropdown-item ${hideInSummary}" id="play-region"><span class='material-symbols-outlined'>play_circle</span> ${
    i18.play
  }</a>
        <a class="dropdown-item ${hideInSummary} ${hideInSelection}" href="#" id="context-analyse-selection">
        <span class="material-symbols-outlined">search</span> ${i18.analyse}
        </a>
        <div class="dropdown-divider ${hideInSummary}"></div>
        <a class="dropdown-item" id="create-manual-record" href="#">
        <span class="material-symbols-outlined">edit_document</span> ${createOrEdit} ${
    i18.record
  }
        </a>
        <a class="dropdown-item" id="context-create-clip" href="#">
        <span class="material-symbols-outlined">music_note</span> ${i18.export}
        </a>
        <span class="dropdown-item" id="context-xc" href='#' target="xc">
        <img src='img/logo/XC.png' alt='' style="filter:grayscale(100%);height: 1.5em"> ${
          i18.compare
        }
        </span>
        <div class="dropdown-divider ${hideInSelection}"></div>
        <a class="dropdown-item ${hideInSelection}" id="context-delete" href="#">
        <span class='delete material-symbols-outlined'>delete_forever</span> ${
          i18.delete
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
  if (!(inSummary || STATE.activeRegion?.label || hideInSelection || hideInSummary)) {
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
  const i18 = i18n.get(i18n.Headings);
  const cname = batch
    ? document.querySelector("#speciesFilter .text-warning .cname .cname")
        .textContent
    : STATE.activeRegion?.label || "";
  let callCount = "",
    commentText = "";
  if (cname && activeRow) {
    // Populate the form with existing values
    commentText = activeRow.querySelector(".comment > span")?.title || "";
    callCount = parseInt(activeRow.querySelector(".call-count").textContent);
  }
  document
    .querySelectorAll(".species-search-label")
    .forEach((label) => (label.textContent = i18.search));
  const selectedBird = recordEntryForm.querySelector("#selected-bird");
  const autoComplete = document.getElementById("bird-autocomplete");
  autoComplete.value = "";
  focusBirdList = () => autoComplete.focus();
  const speciesDisplay = document.createElement("div");
  speciesDisplay.className = "border rounded w-100";
  if (cname) {
    const species = LABELS.find((sp) => sp.includes(cname));
    const styled = species.split("_").reverse().join(" <br/><i>") + "</i>";
    selectedBird.innerHTML = styled;
  } else {
    selectedBird.innerHTML = i18.searchPrompt;
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
    originalCname
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
  reviewed
}  = {}) => {
  worker.postMessage({
    action: "insert-manual-record",
    cname,
    originalCname,
    start: start?.toFixed(3),
    end: end?.toFixed(3),
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
  });
};

/**
 * Updates the UI to reflect whether a custom frequency filter is active.
 *
 * Checks the audio configuration to determine if the frequency range has been altered from its default
 * (minFrequency > 0 or maxFrequency < 11950). If so, it applies warning styles to the frequency range display
 * and enables the reset button. Otherwise, it restores the default styling.
 */
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
  tracking.firstChild.nodeValue = text;
  tracking.classList.remove("d-none");
  // Update your UI with the progress information
  updateProgressBar.value = progressObj.percent;
  if (progressObj.percent > 99.8) tracking.classList.add("d-none");
};
window.electron.onDownloadProgress((_event, progressObj) =>
  displayProgress(progressObj, "Downloading the latest update: ")
);

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


function generateToast({
  message = "",
  type = "info",
  autohide = true,
  variables = undefined,
  locate = "",
} = {}) {
  // i18n
  const i18 = i18n.get(i18n.Toasts);
  if (message === "noFile") {
    clearTimeout(loadingTimeout) && DOM.loading.classList.add("d-none");
    // Alow further interactions!!
    STATE.regionsCompleted = true;
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
    sname = XCtaxon[sname] || sname;
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
        utils.shuffle(recordings);

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
  // const instance =  new ChirpityWS(
  //   "",
  //   () => STATE, // No-op
  //   () => config, // Returns the current config
  //   {}, // no handlers
  //   GLOBAL_ACTIONS
  // )
  // const spectrogram = instance.initSpectrogram(null, 256, 256);
  // ws = instance.initWavesurfer(mediaContainer, [spectrogram])
  // return ws
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
    height: 256,
    minPxPerSec: 195,
    sampleRate: 24000,
  });
  // set colormap
  const colors = spec.createColormap(config);
  const createCmpSpec = () =>
    ws.registerPlugin(
      Spectrogram.create({
        windowFunc: "hann",
        frequencyMin: 0,
        frequencyMax: 12_000,
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
  const cachedStatus = Boolean(localStorage.getItem("isMember"));
  const cachedTimestamp = Number(localStorage.getItem("memberTimestamp"));
  const now = Date.now();
  let installDate = Number(localStorage.getItem("installDate"));
  if (!installDate) {
    localStorage.setItem("installDate", now);
    installDate = now;
  }
  const trialPeriod = await window.electron.trialPeriod();
  const inTrial = Date.now() - installDate < trialPeriod;
  const lockedElements = document.querySelectorAll(".locked, .unlocked");
  const unlockElements = () => {
    lockedElements.forEach((el) => {
      if (el instanceof HTMLSpanElement) {
        el.classList.replace("locked", "unlocked");
        el.textContent = "lock_open";
      } else {
        el.classList.remove("locked");
        el.disabled = false;
      }
    });
  };
  const MEMBERSHIP_API_ENDPOINT =
    await window.electron.MEMBERSHIP_API_ENDPOINT();
  return await checkMembership(config.UUID, MEMBERSHIP_API_ENDPOINT)
    .then(([isMember, expiresIn]) => {
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
            "img/logo/chirpity_logo_subscriber_bronze.png"; // Silver & Gold available
        } else {
          document.getElementById("buy-me-coffee").classList.remove("d-none");
        }
        localStorage.setItem("isMember", true);
        localStorage.setItem("memberTimestamp", now);
      } else {
        config.keyAssignment = {};
        config.specDetections = false;
        config.detect.autoLoad = false;
        config.library.clips = false;
        lockedElements.forEach((el) => {
          el.classList.replace("unlocked", "locked");

          if (el instanceof HTMLSpanElement) {
            el.textContent = "lock";
          } else {
            el.classList.remove("locked"); // remove coral color
            if (el instanceof HTMLSelectElement) el.selectedIndex = 0;
            el.checked = false;
            el.disabled = true;
          }
        });
        localStorage.setItem("isMember", false);
      }

      console.info(
        `Version: ${VERSION}. Trial: ${inTrial} subscriber: ${isMember}, All detections: ${config.specDetections}`,
        expiresIn
      );
      return isMember || inTrial;
    })
    .catch((error) => {
      // Period of grace
      if (
        cachedStatus === true &&
        cachedTimestamp &&
        now - cachedTimestamp < oneWeek
      ) {
        console.warn("Using cached membership status during error.", error);
        unlockElements();
        document.getElementById("primaryLogo").src =
          "img/logo/chirpity_logo_subscriber_bronze.png";
        return true;
      } else {
        document.getElementById("buy-me-coffee").classList.remove("d-none");
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
  const i18 = i18n.get(i18n.Select);
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

  console.log("Tags list:", STATE.tagsList);
});

/**
 * Filters and sorts bird labels based on a search query.
 *
 * This function filters a list of bird labels—each expected to be in the format "sname_cname"—by performing
 * a case-insensitive match with the provided search string. For each label that contains the search term, it splits
 * the label by the underscore, reverses the parts to assign the common name (cname) and scientific name (sname), and
 * creates a `styled` HTML string that formats the names with a line break and italicized scientific name. The resulting
 * array is then sorted alphabetically by the common name using locale comparison based on the application's locale
 * configuration.
 *
 * If the search is empty or not a string, the function returns an empty array.
 *
 * @param {string} search - Substring used to filter bird labels.
 * @param {Array<string>} [list=LABELS] - Optional array of bird labels to filter; each label should be formatted as "sname_cname".
 * @returns {Array<{cname: string, sname: string, styled: string}>} Array of objects representing filtered and sorted birds.
 */
function getFilteredBirds(search, list = LABELS) {
  if (!search || typeof search !== "string") return [];
  const sortedList = list
    .filter((bird) => bird.toLowerCase().includes(search))
    .map((item) => {
      // Flip sname and cname from "sname_cname"
      const [cname, sname] = item.split("_").reverse();
      return { cname, sname, styled: `${cname} <br/><i>${sname}</i>` };
    })
    .sort((a, b) =>
      new Intl.Collator(config.locale.replace(/_.*$/, "")).compare(
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
        worker.postMessage({
          action: "chart",
          species: item.cname,
          range: STATE.chart.range,
        });
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
 * Extracts metadata from a DOM record representing an audio detection and adds it to the global history.
 *
 * The function parses details from the record's child elements—such as species information, confidence 
 * (or a default value for records lacking a confidence bar), comment, label, and call count—while also 
 * determining the record's associated file, row, and table (setting). If a new canonical name is 
 * provided via the second argument, it will override the extracted species name in the history entry.
 * The constructed data array is pushed to the global HISTORY. If the record is not part of a table, 
 * no history entry is added and undefined is returned.
 *
 * @param {HTMLElement} record - The DOM element containing record details.
 * @param {string} [newCname] - Optional name to override the extracted species name.
 * @returns {Object|undefined} An object containing properties: species, start, end, confidence, label, callCount, comment, file, row, and setting if the record is within a table; otherwise, undefined.
 */
function addToHistory(record, newCname) {
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
      row,
      setting,
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
