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
      key === "keyAssignment" || syncConfig(config[key], defaultConfig[key]);
    }
  });
}

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

function interpolate(template, variables) {
  return template.replace(/\$\{(.*?)\}/g, (match, key) => {
    const value = variables[key.trim()];
    if (value == null) return match;
    else return value;
  });
}

function customURLEncode(str) {
  return encodeURIComponent(str)
    .replace(/[!'()*]/g, (c) => {
      // Replacing additional characters not handled by encodeURIComponent
      return "%" + c.charCodeAt(0).toString(16).toUpperCase();
    })
    .replace(/%20/g, "+"); // Replace space with '+' instead of '%20'
}

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
 * Checks if the provided object has no enumerable properties.
 *
 * @param {Object} obj - The object to evaluate.
 * @returns {boolean} True if the object is empty, otherwise false.
 */
function isEmptyObject(obj) {
  for (const _ in obj) return false;
  return true;
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

function _setHeight(el, val) {
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
      _setHeight(thisElement, 0);
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
/**
 * Hides key UI components related to audio analysis.
 *
 * This function hides the primary display elements, including the waveform/timeline (exploreWrapper),
 * spectrogram (spectrogramWrapper), results table (resultTableContainer), and records sections (recordsContainer,
 * resultsHead), by delegating to the hideElement utility.
 */
function hideAll() {
  //  Waveform, timeline and spec, controls and result table
  hideElement([
    "exploreWrapper",
    "spectrogramWrapper",
    "resultTableContainer",
    "recordsContainer",
    "resultsHead",
  ]);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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

// Utility functions to wait for a variable to not be falsey
function waitFor(checkFn) {
  let maxRetries = 25;
  let retryCount = 0;
  return new Promise((resolve) => {
    let interval = setInterval(() => {
      if (checkFn() || retryCount >= maxRetries) {
        clearInterval(interval); // Stop further retries
        resolve(); // Resolve the promise
      } else {
        ++retryCount;
      }
    }, 100);
  });
}

// Not Harlem, but Fisher-Yates shuffle - used for xc call selection
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export {
  syncConfig,
  hexToRgb,
  interpolate,
  customURLEncode,
  extractFileNameAndFolder,
  getDatetimeLocalFromEpoch,
  isEmptyObject,
  enableMenuItem,
  disableMenuItem,
  showElement,
  hideElement,
  hideAll,
  clamp,
  waitForFinalEvent,
  formatDuration,
  waitFor,
  shuffle,
};
