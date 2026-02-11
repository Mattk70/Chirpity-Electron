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
      typeof defaultConfig[key] === "object" && 
      // Allow unknown models keys
      key !== 'models'
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
 * Converts a Date object or timestamp into a string formatted for HTML datetime-local input fields.
 *
 * @param {Date|number|string} date - The date value to convert, as a Date object, timestamp, or date string.
 * @returns {string} A string in the format "YYYY-MM-DDTHH:mm" suitable for use in datetime-local inputs.
 */
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
 * Enables DOM elements by removing the "disabled" CSS class from each element with an ID in the provided list.
 *
 * @param {string[]} id_list - List of DOM element IDs to enable.
 *
 * @remark Logs a warning for any ID that does not correspond to an existing DOM element.
 */
function enableMenuItem(id_list) {
  id_list.forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.classList.remove("disabled");
    } else {
      console.warn(`Element with ID '${id}' not found for enableMenuItem`);
    }
  });
}

function disableMenuItem(id_list) {
  id_list.forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.classList.add("disabled");
    } else {
      console.warn(`Element with ID '${id}' not found for disableMenuItem`);
    }
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
    if (!thisElement) {
      console.warn(`Element with ID '${id}' not found for showElement`);
      return;
    }
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
    if (!thisElement) {
      console.warn(`Element with ID '${id}' not found for hideElement`);
      return;
    }
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

/**
 * Formats a duration given in seconds as a human-readable string with hours, minutes, and seconds (including fractional seconds).
 *
 * @param {number} seconds - The total duration in seconds, which may include fractional values.
 * @returns {string} The formatted duration string (e.g., "1 hours 2 minutes 3.50 seconds").
 */
function formatDuration(seconds) {
  let duration = "";
  const hours = Math.floor(seconds / 3600); // 1 hour = 3600 seconds
  if (hours) duration += `${hours} hours `;
  const minutes = Math.floor((seconds % 3600) / 60); // 1 minute = 60 seconds
  if (hours || minutes) duration += `${minutes} minutes `;
  const remainingSeconds = seconds % 60; // Remaining seconds
  duration += `${remainingSeconds.toFixed(2)} seconds`;
  return duration;
}

/**
 * Parses a duration string with optional hours, minutes, and seconds, returning the total duration in seconds as a number.
 *
 * @param {string} durationString - A string such as "2 hours 5 minutes 10.25 seconds".
 * @returns {number} The total duration in seconds, including fractional seconds, or 0 if parsing fails.
 */

function parseDuration(durationString) {
  const regex = /(?:(\d+)\s*hours?)?\s*(?:(\d+)\s*minutes?)?\s*(?:([\d.]+)\s*seconds?)?/i;
  const match = durationString.match(regex);

  if (!match) return 0;

  const hours = parseInt(match[1], 10) || 0;
  const minutes = parseInt(match[2], 10) || 0;
  const seconds = parseFloat(match[3], 10) || 0;

  return hours * 3600 + minutes * 60 + seconds;
}


function requestFromWorker(worker, action, payload = {}) {
  return new Promise((resolve, reject) => {
    const messageId = crypto.randomUUID(); //  unique string 
    let timeoutId
    function handleMessage(event) {
      const { id, data, error } = event.data;
      if (id !== messageId) return;

      worker.removeEventListener("message", handleMessage);
      clearTimeout(timeoutId); // Clear the timeout if we got a response
      if (error) {
        reject(new Error(error));
      } else {
        resolve(data);
      }
    }
    // Set timeout to clean up listener and reject promise
   timeoutId = setTimeout(() => {
      worker.removeEventListener("message", handleMessage);
      reject(new Error(`Worker request timed out for action: ${action}`));
    }, 15_000); // 15 second timeout

    worker.addEventListener("message", handleMessage);
    worker.postMessage({ id: messageId, action, ...payload });
  });
}

/**
 * Returns a Promise that resolves when the provided check function returns a truthy value or after a maximum number of retries.
 *
 * The check function is evaluated every 10 milliseconds, up to 250 times.
 *
 * @param {Function} checkFn - A function that is repeatedly called until it returns a truthy value.
 * @returns {Promise<void>} Resolves when {@link checkFn} returns a truthy value or after the maximum retries.
 */
function waitFor(checkFn) {
  let maxRetries = 250;
  let retryCount = 0;
  return new Promise((resolve) => {
    let interval = setInterval(() => {
      if (checkFn() || retryCount >= maxRetries) {
        clearInterval(interval); // Stop further retries
        resolve(); // Resolve the promise
      } else {
        ++retryCount;
      }
    }, 10);
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
  extractFileNameAndFolder,
  getDatetimeLocalFromEpoch,
  enableMenuItem,
  disableMenuItem,
  showElement,
  hideElement,
  hideAll,
  clamp,
  waitForFinalEvent,
  formatDuration,
  parseDuration,
  requestFromWorker,
  waitFor,
  shuffle,
};
