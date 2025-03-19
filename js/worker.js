/**
 * @file Backbone of the app. Functions to process audio, manage database interaction
 * and interact with the AI models
 */

const { ipcRenderer } = require("electron");
const fs = require("node:fs");
const p = require("node:path");
const SunCalc = require("suncalc");
const ffmpeg = require("fluent-ffmpeg");

const merge = require("lodash.merge");
import { WorkerState as State } from "./utils/state.js";
import {
  sqlite3,
  createDB,
  checkpoint,
  closeDatabase,
  upgrade_to_v1,
  upgrade_to_v2,
  Mutex,
} from "./database.js";
import { trackEvent as _trackEvent } from "./utils/tracking.js";

let isWin32 = false;

const DATASET = false;
const DATABASE = "archive_test";
const adding_chirpity_additions = false;
const DATASET_SAVE_LOCATION =
  "/media/matt/36A5CC3B5FA24585/DATASETS/European/call";
let ntsuspend;
if (process.platform === "win32") {
  ntsuspend = require("ntsuspend");
  isWin32 = true;
}
// Is this CI / playwright? Disable tracking
const isTestEnv = process.env.TEST_ENV;
const trackEvent = isTestEnv ? () => {} : _trackEvent;

let DEBUG;

let METADATA = {};
let index = 0,
  predictionStart;
let sampleRate; // Should really make this a property of the model
let predictWorkers = [],
  aborted = false;
let UI;
let FILE_QUEUE = [];
let INITIALISED = null;
// Save console.warn and console.error functions
const originalInfo = console.info;
const originalWarn = console.warn;
const originalError = console.error;

const generateAlert = ({
  message,
  type,
  autohide,
  variables,
  file,
  updateFilenamePanel,
}) => {
  UI.postMessage({
    event: "generate-alert",
    type: type || "info",
    message,
    autohide,
    variables,
    file,
    updateFilenamePanel,
  });
};
function customURLEncode(str) {
  return encodeURIComponent(str)
    .replace(/[!'()*]/g, (c) => {
      // Replacing additional characters not handled by encodeURIComponent
      return "%" + c.charCodeAt(0).toString(16).toUpperCase();
    })
    .replace(/%20/g, "+"); // Replace space with '+' instead of '%20'
}

// Override console.info to intercept and track information
console.info = function () {
  // Call the original console.warn to maintain default behavior
  originalInfo.apply(console, arguments);

  // Track the warning message using your tracking function
  trackEvent(
    STATE.UUID,
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
    STATE.UUID,
    "Worker Warning",
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
    STATE.UUID,
    "Worker Handled Errors",
    arguments[0],
    customURLEncode(arguments[1])
  );
};
// Implement error handling in the worker
self.onerror = function (message, file, lineno, colno, error) {
  trackEvent(
    STATE.UUID,
    "Unhandled Worker Error",
    message,
    customURLEncode(error?.stack)
  );
  if (message.includes("dynamic link library"))
    generateAlert({ type: "error", message: "noDLL" });
  // Return false not to inhibit the default error handling
  return false;
};

self.addEventListener("unhandledrejection", function (event) {
  // Extract the error message and stack trace from the event
  const errorMessage = event.reason?.message;
  const stackTrace = event.reason?.stack;

  // Track the unhandled promise rejection
  trackEvent(
    STATE.UUID,
    "Unhandled Worker Promise Rejections",
    errorMessage,
    customURLEncode(stackTrace)
  );
});

self.addEventListener("rejectionhandled", function (event) {
  // Extract the error message and stack trace from the event
  const errorMessage = event.reason?.message;
  const stackTrace = event.reason?.stack;

  // Track the unhandled promise rejection
  trackEvent(
    STATE.UUID,
    "Handled Worker Promise Rejections",
    errorMessage,
    customURLEncode(stackTrace)
  );
});

//Object will hold files in the diskDB, and the active timestamp from the most recent selection analysis.
const STATE = new State();

let WINDOW_SIZE = 3;
const SUPPORTED_FILES = [
  ".wav",
  ".flac",
  ".opus",
  ".m4a",
  ".mp3",
  ".mpga",
  ".ogg",
  ".aac",
  ".mpeg",
  ".mp4",
  ".mov",
];

let NUM_WORKERS, AUDIO_BACKLOG;
let workerInstance = 0;
let appPath,
  tempPath,
  BATCH_SIZE,
  LABELS,
  batchChunksToSend = {};
let LIST_WORKER;

// Adapted from https://stackoverflow.com/questions/6117814/get-week-of-year-in-javascript-like-in-php
Date.prototype.getWeekNumber = function () {
  var d = new Date(
    Date.UTC(this.getFullYear(), this.getMonth(), this.getDate())
  );
  var dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000 + 1) / 7) * (48 / 52));
};

const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path.replace(
  "app.asar",
  "app.asar.unpacked"
);
ffmpeg.setFfmpegPath(ffmpegPath);
let predictionsRequested = {},
  predictionsReceived = {},
  filesBeingProcessed = [];
let diskDB, memoryDB;

let t0; // Application profiler

const setupFfmpegCommand = ({
  file,
  start = 0,
  end = undefined,
  sampleRate = undefined,
  channels = 1,
  format = "s16le", //<= outputs audio without header
  additionalFilters = [],
  metadata = {},
  audioCodec = null,
  audioBitrate = null,
  outputOptions = [],
}) => {
  const command = ffmpeg("file:" + file)
    .format(format)
    .audioChannels(channels);
  // .addOutputOption('-af',
  //     `aresample=resampler=soxr:filter_type=kaiser:kaiser_beta=12.9846:osr=${sampleRate}`
  //   )
  sampleRate && command.audioFrequency(sampleRate);
  //.audioFilters('aresample=filter_type=kaiser:kaiser_beta=9.90322');

  // Add filters if provided
  additionalFilters.forEach((filter) => {
    command.audioFilters(filter);
  });
  if (Object.keys(metadata).length) {
    metadata = Object.entries(metadata).flatMap(([k, v]) => {
      if (typeof v === "string") {
        // Escape special characters, including quotes and apostrophes
        v = v.replaceAll(" ", "_");
      }
      return ["-metadata", `${k}=${v}`];
    });
    command.addOutputOptions(metadata);
  }

  // Set codec if provided
  if (audioCodec) command.audioCodec(audioCodec);

  // Set bitRate if provided
  if (audioBitrate) command.audioBitrate(audioBitrate);

  // Add any additional output options
  if (outputOptions.length) command.addOutputOptions(...outputOptions);

  command.seekInput(start).duration(end - start);
  if (DEBUG) {
    command.on("start", function (commandLine) {
      console.log("FFmpeg command: " + commandLine);
    });
  }
  return command;
};

const getSelectionRange = (file, start, end) => {
  return {
    start: start * 1000 + METADATA[file].fileStart,
    end: end * 1000 + METADATA[file].fileStart,
  };
};


/**
 * Loads, configures, and migrates the SQLite database used for audio records and metadata.
 *
 * This asynchronous function initializes the database by:
 * - Fetching default model labels from a remote file (for the "birdnet" model) or a local configuration file,
 *   then appending a default "Unknown Sp." label.
 * - Constructing a unique database filename based on the total number of labels and either creating a new database (via createDB)
 *   or opening an existing one.
 * - Enforcing PRAGMA settings (foreign keys, journal mode, and busy timeout) for reliable operation.
 * - Performing schema migrations on an existing database when necessary, such as:
 *   - Creating indices on species(sname) and species(cname).
 *   - Adding missing columns ("archiveName" and "metadata") to the files table.
 *   - Updating the tags and records tables (including adding a 'reviewed' column and migrating existing records).
 * - Refreshing the global LABELS variable with the preferred locale labels from the species table and notifying the UI if records exist.
 *
 * @param {string} path - The directory path where the database file is or will be located.
 * @returns {Promise<boolean>} Resolves to true when the database is successfully loaded and configured.
 *
 * @example
 * loadDB('/data/db')
 *   .then(success => console.log('Database loaded:', success))
 *   .catch(error => console.error('Error loading database:', error));
 *
 * @remarks
 * This function depends on global variables (e.g., STATE, DATASET, LABELS, diskDB, UI) and auxiliary functions such as createDB, checkpoint, and dbMutex.
 */
async function loadDB(path) {
  // We need to get the default labels from the config file
  DEBUG && console.log("Loading db " + path);
  let modelLabels;
  const model = STATE.model;
  if (model === "birdnet") {
    const labelFile = `labels/V2.4/BirdNET_GLOBAL_6K_V2.4_Labels_en.txt`;
    await fetch(labelFile)
      .then((response) => {
        if (!response.ok) throw new Error("Network response was not ok");
        return response.text();
      })
      .then((filecontents) => {
        modelLabels = filecontents.trim().split(/\r?\n/);
      })
      .catch((error) => {
        console.error("There was a problem fetching the label file:", error);
      });
  } else {
    const { labels } = JSON.parse(
      fs.readFileSync(p.join(__dirname, `${model}_model_config.json`), "utf8")
    );
    modelLabels = labels;
  }

  // Add Unknown Sp.
  modelLabels.push("Unknown Sp._Unknown Sp.");
  const num_labels = modelLabels.length;
  LABELS = modelLabels; // these are the default english labels
  const file = DATASET
    ? p.join(path, `${DATABASE}${num_labels}.sqlite`)
    : p.join(path, `archive${num_labels}.sqlite`);
  if (!fs.existsSync(file)) {
    console.log("No db file: ", file);
    diskDB = await createDB({file, LABELS, dbMutex});
    console.log("DB created at : ", file);
    UI.postMessage({ event: "label-translation-needed", locale: STATE.locale });
  } else if (!diskDB || diskDB.filename !== file) {
    diskDB = new sqlite3.Database(file);
    STATE.update({ db: diskDB });
    await diskDB.runAsync("VACUUM");
    await diskDB.runAsync("PRAGMA foreign_keys = ON");
    await diskDB.runAsync("PRAGMA journal_mode = WAL");
    await diskDB.runAsync("PRAGMA busy_timeout = 5000");

    // Add empty version table if not exists
    await diskDB.runAsync(
      "CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)"
    );
    const row = await diskDB.getAsync(`SELECT version FROM schema_version`);
    let user_version;
    if (!row) {
      const { pragma_version } = await diskDB.getAsync("PRAGMA user_version");
      user_version = pragma_version || 0;
      await diskDB.runAsync(
        "INSERT INTO schema_version (version) VALUES (?)",
        user_version
      );
    } else {
      user_version = row.version;
    }
    if (user_version < 1) {
      await upgrade_to_v1(diskDB, dbMutex);
    }
    if (user_version < 2) {
      await upgrade_to_v2(diskDB, dbMutex);
    }
    const { count } = await diskDB.getAsync(
      "SELECT COUNT(*) as count FROM records"
    );
    if (count) {
      UI.postMessage({ event: "diskDB-has-records" });
    }
    // Get the labels from the DB. These will be in preferred locale
    DEBUG && console.log("Getting labels from disk db " + path);
    const res = await diskDB.allAsync(
      "SELECT sname || '_' || cname AS labels FROM species ORDER BY id"
    );
    LABELS = res.map((obj) => obj.labels); // these are the labels in the preferred locale
    DEBUG && console.log("Opened and cleaned disk db " + file);
  }
  return true;
}

/**
 * Dispatches incoming worker messages by executing actions specified in the event's data payload.
 *
 * This asynchronous function processes event messages that include an `action` field alongside associated parameters.
 * For any action other than "_init_", it waits for any pending initialization to complete before proceeding.
 * Depending on the action, the function delegates tasks such as initializing environments, processing audio files,
 * managing prediction worker threads, updating database records, handling file operations, and more.
 * Supported actions include:
 *
 * - "_init_": Sets up the environment by initializing the list worker, launching the predictive model, and updating state.
 * - "abort": Aborts currently ongoing analysis.
 * - "analyse": Initiates audio analysis by validating prediction workers and sending alerts if they are not ready.
 * - "change-batch-size": Adjusts the batch size used by prediction workers.
 * - "change-threads": Modifies the number of active prediction worker threads.
 * - "change-mode": Switches the operational mode.
 * - "chart": Processes chart data requests.
 * - "check-all-files-saved": Verifies that specified files have been saved in the database.
 * - "convert-dataset": Converts dataset specifications from existing formats.
 * - "create-dataset": Creates a dataset with inclusion identifiers.
 * - "delete": Performs deletion operations.
 * - "delete-species": Removes specified species records.
 * - "export-results": Exports detection results.
 * - "file-load-request": Loads an audio file, optionally clearing in-memory records, and switches modes based on file state.
 * - "filter": Applies filters to results, refreshes summaries, and updates inclusion identifiers.
 * - "get-detected-species-list": Retrieves a list of detected species.
 * - "get-valid-species": Fetches valid species associated with a file.
 * - "get-locations": Retrieves location details for a specified file from the database.
 * - "get-tags": Retrieves a list of tags from the disk database.
 * - "delete-tag": Deletes a tag and generates an alert if an error occurs.
 * - "update-tag": Updates a tag in the database and refreshes the UI with the updated tag list.
 * - "get-valid-files-list": Returns a list of valid files after scanning.
 * - "insert-manual-record": Manually inserts a record and updates summaries and results accordingly.
 * - "load-model": Loads a new predictive model, aborting ongoing processing if necessary.
 * - "post": Uploads processed audio data.
 * - "purge-file": Deletes the specified file.
 * - "compress-and-organise": Compresses and reorganises audio files.
 * - "relocated-file": Updates file paths after relocation.
 * - "save": Saves audio processing data along with associated metadata.
 * - "save2db": Persists changes from the in-memory database to disk.
 * - "set-custom-file-location": Specifies a custom location for file storage.
 * - "update-buffer": Reloads an audio file to update its buffer.
 * - "update-file-start": Adjusts the starting point for audio file processing.
 * - "update-list": Updates internal lists and custom labels, optionally refreshing summaries and results.
 * - "update-locale": Updates locale settings and associated labels.
 * - "update-summary": Refreshes summary data.
 * - "update-state": Updates overall application state, including paths and processing thresholds.
 *
 * @example
 * const msgEvent = {
 *   data: {
 *     action: "analyse",
 *     file: "audio_sample.mp3",
 *     // ...additional parameters for analysis
 *   }
 * };
 * handleMessage(msgEvent);
 *
 * @param {Object} e - The message event object containing the action and related parameters.
 * @returns {Promise<void>} Resolves once the message is processed.
 */
async function handleMessage(e) {
  const args = e.data;
  const action = args.action;
  DEBUG && console.log("message received", action);
  if (action !== "_init_" && INITIALISED) {
    // Wait until _init_ or onLaunch completes before processing other messages
    await INITIALISED;
  }
  switch (action) {
    case "_init_": {
      let { model, batchSize, threads, backend, list } = args;
      const t0 = Date.now();
      STATE.detect.backend = backend;
      INITIALISED = (async () => {
        LIST_WORKER = await spawnListWorker(); // this can change the backend if tfjs-node isn't available
        DEBUG && console.log("List worker took", Date.now() - t0, "ms to load");
        await onLaunch({
          model: model,
          batchSize: batchSize,
          threads: threads,
          backend: STATE.detect.backend,
          list: list,
        });
      })();
      break;
    }
    case "abort": {
      onAbort(args);
      break;
    }
    case "analyse": {
      if (!predictWorkers.length) {
        generateAlert({
          type: "Error",
          message: "noLoad",
          variables: { model: STATE.model },
        });
        UI.postMessage({ event: "analysis-complete", quiet: true });
        break;
      }
      predictionsReceived = {};
      predictionsRequested = {};
      await onAnalyse(args);
      break;
    }
    case "change-batch-size": {
      BATCH_SIZE = args.batchSize;
      predictWorkers.forEach((worker) => {
        worker.postMessage({
          message: "change-batch-size",
          batchSize: BATCH_SIZE,
        });
      });
      break;
    }
    case "change-threads": {
      const threads = e.data.threads;
      const delta = threads - predictWorkers.length;
      NUM_WORKERS += delta;
      if (delta > 0) {
        spawnPredictWorkers(STATE.model, STATE.list, BATCH_SIZE, delta);
      } else {
        for (let i = delta; i < 0; i++) {
          const worker = predictWorkers.pop();
          worker.terminate(); //postMessage({message: 'terminate'})
        }
      }
      break;
    }
    case "change-mode": {
      const mode = args.mode;
      await onChangeMode(mode);
      break;
    }
    case "chart": {
      Object.assign(args, { diskDB, state: STATE, UI });
      const { onChartRequest } = require("./js/components/charts.js");
      await onChartRequest(args);
      break;
    }
    case "check-all-files-saved": {
      const allSaved = await savedFileCheck(args.files);
      if (STATE.detect.autoLoad && allSaved) {
        STATE.filesToAnalyse = args.files;
        await onChangeMode("archive");
        await Promise.all([getResults(), getSummary()]);
      }
      break;
    }
    case "convert-dataset": {
      convertSpecsFromExistingSpecs();
      break;
    }
    case "create-dataset": {
      args.included = await getIncludedIDs();
      saveResults2DataSet(args);
      break;
    }
    case "delete": {
      await onDelete(args);
      break;
    }
    case "delete-species": {
      await onDeleteSpecies(args);
      break;
    }
    case "export-results": {
      await getResults(args);
      break;
    }
    case "file-load-request": {
      if (!args.preserveResults) {
        // Clear records from the memory db
        await memoryDB.runAsync("DELETE FROM records; VACUUM");
      }
      index = 0;
      filesBeingProcessed.length && onAbort(args);
      DEBUG && console.log("Worker received audio " + args.file);
      await loadAudioFile(args).catch((_e) =>
        console.warn("Error opening file:", args.file)
      );
      const file = args.file;
      const mode = METADATA[file].isSaved ? "archive" : "analyse";
      await onChangeMode(mode);
      break;
    }
    case "filter": {
      if (STATE.db) {
        await getResults(args);
        args.updateSummary && (await getSummary(args));
        args.included = await getIncludedIDs(args.file);
        await getTotal(args);
      }
      break;
    }
    case "get-detected-species-list": {
      getDetectedSpecies();
      break;
    }
    case "get-valid-species": {
      getValidSpecies(args.file);
      break;
    }
    case "get-locations": {
      getLocations({ file: args.file });
      break;
    }
    case "get-tags": {
      const result = await diskDB.allAsync("SELECT id, name FROM tags");
      UI.postMessage({ event: "tags", tags: result, init: true });
      break;
    }
    case "delete-tag": {
      try {
        const result = await diskDB.runAsync(
          "DELETE FROM tags where name = ?",
          args.deleted
        );
      } catch (error) {
        generateAlert({ message: `Label deletion failed: ${error.message}` });
        console.error(error);
      }
      break;
    }
    case "update-tag": {
      try {
        const tag = args.alteredOrNew;
        if (tag.id && tag.name) {
          const query = STATE.db.runAsync(
            `
            INSERT OR REPLACE INTO tags (id, name) VALUES (?, ?)
            ON CONFLICT(id) DO UPDATE SET name = excluded.name
            `,
            tag.id,
            tag.name
          );
        }
        const result = await STATE.db.allAsync("SELECT id, name FROM tags");
        UI.postMessage({ event: "tags", tags: result, init: false });
      } catch (error) {
        generateAlert({ message: `Tag update failed: ${error.message}` });
        console.error(error);
      }
      break;
    }
    case "get-valid-files-list": {
      await getFiles(args.files);
      break;
    }
    case "insert-manual-record": {
      await onInsertManualRecord(args);
      await Promise.all([
        getResults({ position: args.position, species: args.speciesFiltered }),
        getSummary({ species: args.speciesFiltered }),
      ]);
      STATE.db === memoryDB && UI.postMessage({ event: "unsaved-records" });
      break;
    }
    case "load-model": {
      if (filesBeingProcessed.length) {
        onAbort(args);
      } else {
        predictWorkers.length && terminateWorkers();
      }
      INITIALISED = onLaunch(args);
      break;
    }
    case "post": {
      await uploadOpus(args);
      break;
    }
    case "purge-file": {
      onFileDelete(args.fileName);
      break;
    }
    case "compress-and-organise": {
      convertAndOrganiseFiles();
      break;
    }
    case "relocated-file": {
      onFileUpdated(args.originalFile, args.updatedFile);
      break;
    }
    case "save": {
      DEBUG && console.log("file save requested");
      await saveAudio(
        args.file,
        args.start,
        args.end,
        args.filename,
        args.metadata
      );
      break;
    }
    case "save2db": {
      await onSave2DiskDB(args);
      break;
    }
    case "set-custom-file-location": {
      onSetCustomLocation(args);
      break;
    }
    case "update-buffer": {
      await loadAudioFile(args);
      break;
    }
    case "update-file-start": {
      await onUpdateFileStart(args);
      break;
    }
    case "update-list": {
      STATE.list = args.list;
      STATE.customLabels =
        args.list === "custom" ? args.customLabels : STATE.customLabels;
      const { lat, lon, week } = STATE;
      // Clear the LIST_CACHE & STATE.included keys to force list regeneration
      LIST_CACHE = {}; //[`${lat}-${lon}-${week}-${STATE.model}-${STATE.list}`];
      delete STATE.included?.[STATE.model]?.[STATE.list];
      LIST_WORKER && (await setIncludedIDs(lat, lon, week));
      updateSpeciesLabelLocale();
      args.refreshResults && (await Promise.all([getResults(), getSummary()]));
      break;
    }
    case "update-locale": {
      await onUpdateLocale(args.locale, args.labels, args.refreshResults);
      break;
    }
    case "update-summary": {
      await getSummary(args);
      break;
    }
    case "update-state": {
      appPath = args.path || appPath;
      tempPath = args.temp || tempPath;
      // If we change the speciesThreshold, we need to invalidate any location caches
      if (args.speciesThreshold) {
        if (STATE.included?.["birdnet"]?.["location"])
          STATE.included.birdnet.location = {};
        if (STATE.included?.["chirpity"]?.["location"])
          STATE.included.chirpity.location = {};
      }
      // likewise, if we change the "use local birds" setting we need to flush the migrants cache"
      if (args.local !== undefined) {
        if (STATE.included?.["birdnet"]?.["nocturnal"])
          delete STATE.included.birdnet.nocturnal;
      }
      STATE.update(args);
      if (args.labelFilters) {
        const species = args.species;
        await Promise.all([
          getResults({ species, offset: 0 }),
          getSummary({ species }),
          getTotal({ species, offset: 0 }),
        ]);
      }
      DEBUG = STATE.debug;
      break;
    }
    default: {
      UI.postMessage("Worker communication lines open");
    }
  }
}

ipcRenderer.on("new-client", async (event) => {
  [UI] = event.ports;
  UI.onmessage = handleMessage;
});

ipcRenderer.on("close-database", async () => {
  try {
    await checkpoint(diskDB);
    await closeDatabase(diskDB);
  } catch (error) {
    console.error("Error closing database:", error.message);
  } finally {
    diskDB = null;
    ipcRenderer.send("database-closed");
  }
});

/**
 * Checks whether all files in the provided list are present in the database.
 *
 * This asynchronous function processes the given file list in batches (up to 25,000 files per batch) to accommodate SQLite's parameter limits.
 * For each batch, it constructs a parameterized SQL query that counts how many of the files exist in the database's "files" table.
 * If any batch has a count lower than the number of files in that batch, the function immediately posts a failure event to the UI and returns false.
 * If all batches are successfully verified, it posts a success event to the UI and returns true.
 * If the database (diskDB) is not loaded, an error alert is generated and the function returns undefined.
 *
 * @param {Array.<string>} fileList - An array of file names to verify in the database.
 * @return {Promise<boolean|undefined>} A promise that resolves to true if every file is found in the database, false if one or more files are missing, or undefined if the database is not loaded.
 *
 * @example
 * const files = ['track1.mp3', 'track2.wav'];
 * savedFileCheck(files).then(result => {
 *   if (result === true) {
 *     console.log('All files exist in the database.');
 *   } else if (result === false) {
 *     console.log('Some files are missing in the database.');
 *   } else {
 *     console.log('Database not loaded.');
 *   }
 * });
 */
async function savedFileCheck(fileList) {
  if (diskDB) {
    // Slice the list into a # of params SQLITE can handle
    const batchSize = 25_000;
    let totalFilesChecked = 0;
    for (let i = 0; i < fileList.length; i += batchSize) {
      const fileSlice = fileList.slice(i, i + batchSize);

      // Construct a parameterized query to count matching files in the database
      const query = `SELECT COUNT(*) AS count FROM files WHERE name IN (${prepParams(
        fileSlice
      )})`;

      // Execute the query with the slice as parameters
      const countResult = await diskDB.getAsync(query, ...fileSlice);
      const count = countResult?.count || 0;

      if (count < fileSlice.length) {
        UI.postMessage({
          event: "all-files-saved-check-result",
          result: false,
        });
        return false;
      }

      totalFilesChecked += count;
    }

    const allSaved = totalFilesChecked === fileList.length;
    UI.postMessage({ event: "all-files-saved-check-result", result: allSaved });
    return allSaved;
  } else {
    generateAlert({ type: "error", message: "dbNotLoaded" });
    return undefined;
  }
}

function setGetSummaryQueryInterval(threads) {
  STATE.incrementor =
    STATE.detect.backend !== "tensorflow" ? threads * 10 : threads;
}

async function onChangeMode(mode) {
  if (STATE.mode !== mode) {
    if (!memoryDB){
      await createDB({file: null, LABELS, diskDB, dbMutex});
      UI.postMessage({ event: "label-translation-needed", locale: STATE.locale });
    }
    UI.postMessage({ event: "mode-changed", mode: mode });
    STATE.changeMode({
      mode: mode,
      disk: diskDB,
      memory: memoryDB,
    });
  }
}

const filtersApplied = (list) => {
  const filtered = list?.length && list.length < LABELS.length - 1;
  return filtered;
};

/**
 * Initializes and launches the application environment by configuring model settings, databases, and prediction workers.
 *
 * This function is invoked when the application is first opened or when the model is changed. It sets global flags,
 * configures the sample rate based on the model, updates the application state, loads the disk and memory databases,
 * and spawns prediction workers to process audio data.
 *
 * @async
 * @param {Object} options - Configuration options for launching the application.
 * @param {string} [options.model="chirpity"] - The name of the model to use; if "birdnet", sets sample rate to 48000 Hz, otherwise 24000 Hz.
 * @param {number} [options.batchSize=32] - The size of the batch to process audio data.
 * @param {number} [options.threads=1] - The number of worker threads to spawn for prediction processing.
 * @param {string} [options.backend="tensorflow"] - The backend to use for predictions.
 * @param {string} [options.list="everything"] - Specifies the list or category to use for predictions.
 * @returns {Promise<void>} A promise that resolves when the application environment is initialized and prediction workers are spawned.
 * @throws {Error} Propagates any error encountered during database loading or worker spawning.
 *
 * @example
 * onLaunch({
 *   model: "birdnet",
 *   batchSize: 64,
 *   threads: 4,
 *   backend: "tensorflow",
 *   list: "selected"
 * });
 */

async function onLaunch({
  model = "chirpity",
  batchSize = 32,
  threads = 1,
  backend = "tensorflow",
  list = "everything",
}) {
  SEEN_MODEL_READY = false;
  LIST_CACHE = {};
  sampleRate = model === "birdnet" ? 48_000 : 24_000;
  STATE.detect.backend = backend;
  BATCH_SIZE = batchSize;
  if (!STATE.model || STATE.model !== model) {
    STATE.update({ model: model });
    await loadDB(appPath); // load the diskdb
    memoryDB = await createDB({file: null, LABELS, diskDB, dbMutex}); // now make the memoryDB
    UI.postMessage({ event: "label-translation-needed", locale: STATE.locale });
  }
  const db = STATE.mode === 'analyse'
    ? memoryDB
    : diskDB;
  STATE.update({ db });
  NUM_WORKERS = threads;
  spawnPredictWorkers(model, list, batchSize, NUM_WORKERS);
}

/**
 * Spawns a list worker and returns a function to interact with it.
 *
 * This asynchronous function creates a new Web Worker from "./js/models/listWorker.js" and waits until the worker signals it is ready
 * by sending a "list-model-ready" message. During initialization, if a "tfjs-node" message is received, it updates internal state and notifies the UI
 * about backend availability. Once the worker is ready, the function returns another function that sends a message to the worker under a mutex lock
 * and returns a Promise that resolves with the worker's response containing a result and supplemental messages.
 *
 * @returns {Function} A function that accepts a message as its argument and returns a Promise resolving to an object with the following properties:
 *   - result: The outcome of processing the sent message.
 *   - messages: Additional messages or status information from the worker.
 *
 * @throws {Error} Propagates errors encountered during worker initialization or message handling.
 */
async function spawnListWorker() {
  const worker_1 = await new Promise((resolve, reject) => {
    const worker = new Worker("./js/models/listWorker.js", { type: "module" });
    worker.onmessage = function (event) {
      // Resolve the promise once the worker sends a message indicating it's ready
      const message = event.data.message;

      if (message === "list-model-ready") {
        return resolve(worker);
      } else if (message === "tfjs-node") {
        STATE.hasNode = true;
        if (!event.data.available) {
          STATE.detect.backend = "webgpu";
          STATE.hasNode = false;
        }
        UI.postMessage({ event: "tfjs-node", hasNode: STATE.hasNode });
      }
    };

    worker.onerror = function (error) {
      reject(error);
    };

    // Start the worker
    worker.postMessage("start");
  });
  return function listWorker(message_1) {
    return new Promise((resolve_1, reject_1) => {
      worker_1.onmessage = function (event_1) {
        const { result, messages } = event_1.data;
        resolve_1({ result, messages });
      };

      worker_1.onerror = function (error_1) {
        reject_1(error_1);
      };

      DEBUG && console.log("getting a list from the list worker");
      dbMutex
        .lock()
        .then(() => worker_1.postMessage(message_1))
        .catch(() => {})
        .finally(() => dbMutex.unlock());
    });
  };
}

/**
 * Generates a list of supported audio files, recursively searching directories.
 * Sends this list to the UI
 * @param {*} files must be a list of file paths
 */
const getFiles = async (files, image) => {
  const supportedFiles = image ? [".png"] : SUPPORTED_FILES;
  let folderDropped = false;
  let fileList = [];

  for (const path of files) {
    try {
      const stats = fs.lstatSync(path);
      if (stats.isDirectory()) {
        folderDropped = true;
        // Retrieve files in the directory and filter immediately
        const dirFiles = (await getFilesInDirectory(path)).filter(
          (file) =>
            supportedFiles.some((ext) => file.toLowerCase().endsWith(ext)) &&
            !p.basename(file).startsWith(".")
        );
        fileList.push(...dirFiles);
      } else if (
        !p.basename(path).startsWith(".") &&
        supportedFiles.some((ext) => path.toLowerCase().endsWith(ext))
      ) {
        fileList.push(path);
      }
    } catch (error) {
      if (error.code === "EACCES") {
        generateAlert({
          type: "error",
          message: `Permission Denied while attempting to access ${path}`,
        });
      } else {
        generateAlert({ type: "error", message: error.message });
      }
      throw error;
    }
  }
  const fileOrFolder = folderDropped ? "Open Folder(s)" : "Open Files(s)";
  trackEvent(STATE.UUID, "UI", "Drop", fileOrFolder, fileList.length);
  UI.postMessage({ event: "files", filePaths: fileList });
  return fileList;
};

const getFilesInDirectory = async (dir) => {
  const files = [];
  const stack = [dir];
  const { readdir } = require("node:fs/promises");
  while (stack.length) {
    const currentDir = stack.pop();
    const dirents = await readdir(currentDir, { withFileTypes: true });
    for (const dirent of dirents) {
      const path = p.join(currentDir, dirent.name);
      if (dirent.isDirectory()) {
        stack.push(path);
      } else {
        const filename = p.basename(path);
        filename.startsWith("._") || files.push(path);
      }
    }
  }

  return files;
};

const prepParams = (list) => "?".repeat(list.length).split("").join(",");

/**
 * Generates an SQL filtering clause along with its corresponding parameters for file record retrieval.
 *
 * This function constructs an SQL fragment to filter file records based on an optional date range and the
 * current application mode stored in the global STATE variable. Depending on whether a valid range is provided
 * or the application mode is set to "archive", it generates the appropriate conditions and parameters:
 *
 * - When a range object with a defined `start` property is provided, an SQL condition is appended to filter
 *   records where `dateTime` is between `range.start` (inclusive) and `range.end` (exclusive). The provided range
 *   values are pushed to the parameters array.
 * - In "archive" mode, the function creates an SQL condition that filters records by matching either the file's
 *   name or its archiveName against the list obtained from STATE.filesToAnalyse. It also processes file paths
 *   by removing the archive path prefix defined in STATE.library.location.
 * - In "analyse" mode, a file-based filtering condition exists in the code but is currently commented out.
 *
 * @param {Object} [range] - Optional object specifying a date range for filtering records.
 * @param {(number|string)} range.start - The start boundary of the date range (inclusive).
 * @param {(number|string)} range.end - The end boundary of the date range (exclusive).
 * @returns {Array.<(string | any[])>} A tuple where the first element is the SQL condition fragment (string)
 * and the second element is an array of parameters to bind to the SQL query.
 */
function getFileSQLAndParams(range) {
  const fileParams = prepParams(STATE.filesToAnalyse);
  const params = [];
  let SQL = "";
  if (range?.start) {
    // Prioritise range queries
    SQL += " AND dateTime >= ? AND dateTime < ? ";
    params.push(range.start, range.end);
    // If you create a record manually before analysis, STATE.filesToAnalyse will be empty
  } else if (["analyse"].includes(STATE.mode) && fileParams) {
    // SQL += ` AND name IN  (${fileParams}) `;
    // params.push(...STATE.filesToAnalyse);
  } else if (["archive"].includes(STATE.mode)) {
    SQL += ` AND ( file IN  (${fileParams}) `;
    params.push(...STATE.filesToAnalyse);
    SQL += ` OR archiveName IN  (${fileParams}) ) `;
    const archivePath = STATE.library.location + p.sep;
    const archive_names = STATE.filesToAnalyse.map((item) =>
      item.replace(archivePath, "")
    );
    params.push(...archive_names);
  }
  return [SQL, params];
}
function getExcluded(included, fullRange = LABELS.length) {
  const missing = [];
  let currentIndex = 0;

  for (let i = 0; i < fullRange; i++) {
    // If the current value in the sorted list matches `i`, move to the next list item
    if (currentIndex < included.length && included[currentIndex] === i) {
      currentIndex++;
    } else {
      // Otherwise, `i` is missing
      missing.push(i);
    }
  }
  return missing;
}
const prepSummaryStatement = (included) => {
  const range = STATE.mode === "explore" ? STATE.explore.range : undefined;
  const params = [STATE.detect.confidence];
  let summaryStatement = `
    WITH ranked_records AS (
        SELECT records.dateTime, records.confidence, files.name as file, files.archiveName, cname, sname, COALESCE(callCount, 1) as callCount, speciesID, isDaylight, tagID,
        RANK() OVER (PARTITION BY fileID, dateTime ORDER BY records.confidence DESC) AS rank
        FROM records
        JOIN files ON files.id = records.fileID
        JOIN species ON species.id = records.speciesID
        WHERE confidence >=  ? `;

  const [SQLtext, fileParams] = getFileSQLAndParams(range);
  (summaryStatement += SQLtext), params.push(...fileParams);
  if (STATE.labelFilters.length) {
    summaryStatement += ` AND tagID in (${prepParams(STATE.labelFilters)}) `;
    params.push(...STATE.labelFilters);
  }
  let not = "";
  if (filtersApplied(included)) {
    if (STATE.list === "birds") {
      included = getExcluded(included);
      not = "NOT";
    }
    // DEBUG &&
    //   console.log("included", included.length, "# labels", LABELS.length);
    const includedParams = prepParams(included);
    summaryStatement += ` AND speciesID ${not} IN (${includedParams}) `;
    params.push(...included);
  }
  if (STATE.detect.nocmig) {
    summaryStatement += " AND COALESCE(isDaylight, 0) != 1 ";
  }

  if (STATE.locationID) {
    summaryStatement += " AND locationID = ? ";
    params.push(STATE.locationID);
  }
  summaryStatement += `
    )
    SELECT speciesID, cname, sname, COUNT(cname) as count, SUM(callcount) as calls, ROUND(MAX(ranked_records.confidence) / 10.0, 0) as max
    FROM ranked_records
    WHERE ranked_records.rank <= ${STATE.topRankin}`;

  summaryStatement += ` GROUP BY speciesID  ORDER BY ${STATE.summarySortOrder}`;

  return [summaryStatement, params];
};

const getTotal = async ({
  species = undefined,
  offset = undefined,
  included = undefined,
  file = undefined,
} = {}) => {
  let params = [];
  included ??= await getIncludedIDs(file);
  const range = STATE.mode === "explore" ? STATE.explore.range : undefined;
  offset =
    offset ??
    (species !== undefined
      ? STATE.filteredOffset[species]
      : STATE.globalOffset);
  let SQL = ` WITH MaxConfidencePerDateTime AS (
        SELECT confidence,
        speciesID, files.name as file, tagID,
        RANK() OVER (PARTITION BY fileID, dateTime ORDER BY records.confidence DESC) AS rank
        FROM records 
        JOIN files ON records.fileID = files.id 
        WHERE confidence >= ${STATE.detect.confidence} `;

  if (filtersApplied(included)) SQL += ` AND speciesID IN (${included}) `;
  if (STATE.labelFilters.length) {
    SQL += ` AND tagID in (${prepParams(STATE.labelFilters)}) `;
    params.push(...STATE.labelFilters);
  }
  if (STATE.detect.nocmig) SQL += " AND NOT isDaylight";
  if (STATE.locationID) SQL += ` AND locationID =  ${STATE.locationID}`;
  const [SQLtext, fileParams] = getFileSQLAndParams(range);
  (SQL += SQLtext), params.push(...fileParams);
  SQL += " ) ";
  SQL += `SELECT COUNT(confidence) AS total FROM MaxConfidencePerDateTime WHERE rank <= ${STATE.topRankin}`;

  if (species) {
    params.push(species);
    SQL += " AND speciesID = (SELECT id from species WHERE cname = ?) ";
  }
  const { total } = await STATE.db.getAsync(SQL, ...params);
  UI.postMessage({
    event: "total-records",
    total: total,
    offset: offset,
    species: species,
  });
};

const prepResultsStatement = (
  species,
  noLimit,
  included,
  offset,
  topRankin
) => {
  const params = [STATE.detect.confidence];
  let resultStatement = `
    WITH ranked_records AS (
        SELECT 
        records.dateTime, 
        files.duration, 
        files.filestart, 
        fileID,
        files.name as file,
        files.archiveName,
        files.locationID,
        records.position, 
        records.speciesID,
        species.sname, 
        species.cname, 
        records.confidence as score, 
        tagID,
        tags.name as label, 
        records.comment, 
        records.end,
        records.callCount,
        records.isDaylight,
        records.reviewed,
        RANK() OVER (PARTITION BY fileID, dateTime ORDER BY records.confidence DESC) AS rank
        FROM records 
        JOIN species ON records.speciesID = species.id 
        JOIN files ON records.fileID = files.id 
        LEFT JOIN tags ON records.tagID = tags.id
        WHERE confidence >= ? 
        `;
  // // Prioritise selection ranges
  const range = STATE.selection?.start
    ? STATE.selection
    : STATE.mode === "explore"
    ? STATE.explore.range
    : false;

  // If you're using the memory db, you're either analysing one,  or all of the files
  const [SQLtext, fileParams] = getFileSQLAndParams(range);
  (resultStatement += SQLtext), params.push(...fileParams);
  if (STATE.labelFilters.length) {
    resultStatement += ` AND tagID in (${prepParams(STATE.labelFilters)}) `;
    params.push(...STATE.labelFilters);
  }
  if (filtersApplied(included)) {
    resultStatement += ` AND speciesID IN (${prepParams(included)}) `;
    params.push(...included);
  }
  if (STATE.selection) {
    resultStatement += ` AND file = ? `;
    params.push(FILE_QUEUE[0]);
  }
  if (STATE.locationID) {
    resultStatement += ` AND locationID = ? `;
    params.push(STATE.locationID);
  }
  if (STATE.detect.nocmig) {
    resultStatement += " AND COALESCE(isDaylight, 0) != 1 "; // Backward compatibility for < v0.9.
  }

  resultStatement += ` )
    SELECT 
    dateTime as timestamp, 
    score,
    duration, 
    filestart, 
    file, 
    archiveName,
    fileID,
    position, 
    speciesID,
    sname, 
    cname, 
    score,
    tagID,
    label, 
    comment,
    end,
    callCount,
    isDaylight,
    reviewed,
    rank
    FROM 
    ranked_records 
    WHERE rank <= ? `;
  params.push(topRankin);
  if (species) {
    resultStatement += ` AND  cname = ? `;
    params.push(species);
  }
  const limitClause = noLimit ? "" : "LIMIT ?  OFFSET ?";
  noLimit || params.push(STATE.limit, offset);
  const metaSort = STATE.resultsMetaSortOrder
    ? `${STATE.resultsMetaSortOrder}, `
    : "";
  resultStatement += ` ORDER BY ${metaSort} ${STATE.resultsSortOrder} ${limitClause} `;

  return [resultStatement, params];
};

// Helper to chunk an array
function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size));
  }
  return result;
}

async function updateMetadata(fileNames) {
  const batchSize = 10000;
  const batches = chunkArray(fileNames, batchSize);
  const finalResult = {};
  for (const batch of batches) {
    // Build placeholders (?, ?, ?) dynamically based on number of file names
    const placeholders = batch.map(() => '?').join(', ');

    // 1. Get files and locations
    const fileQuery = `
        SELECT 
            f.id,
            f.name,
            f.duration,
            f.filestart as fileStart,
            f.metadata,
            f.locationID,
            l.lat,
            l.lon
        FROM files f
        LEFT JOIN locations l ON f.locationID = l.id
        WHERE f.name IN (${placeholders})
    `;

    const fileRows = await diskDB.allAsync(fileQuery, ...batch);

    if (fileRows.length === 0) {
        continue
    }

    // Extract file IDs for duration query
    const fileIDs = fileRows.map(row => row.id);
    const durationPlaceholders = fileIDs.map(() => '?').join(', ');

    // 2. Get durations
    const durationQuery = `
        SELECT day, duration, fileID 
        FROM duration 
        WHERE fileID IN (${durationPlaceholders})
    `;
    const durationRows = await diskDB.allAsync(durationQuery, ...fileIDs);

    // 3. Organise durations by fileID
    const durationMap = {};
    durationRows.forEach(row => {
        if (!durationMap[row.fileID]) durationMap[row.fileID] = {};
        durationMap[row.fileID][row.day] = row.duration;
    });

    // 4. Build object keyed by file name

    fileRows.forEach(row => {
      const {name, duration, fileStart, metadata, locationID, lat, lon} = row;
      const complete = !!duration && !!fileStart;
      finalResult[name] = {
            duration,
            fileStart,
            metadata,
            locationID,
            dateDuration: durationMap[row.id] || {},
            lat,
            lon,
            isSaved: true,
            isComplete: complete
        };
    });
  }
  // 5. Merge with METADATA
  for (const [fileName, metadataObj] of Object.entries(METADATA)) {
    if (finalResult[fileName]) {
        // Shallow merge: overwrite keys in finalResult[fileName] with METADATA[fileName]
        finalResult[fileName] = {
            ...finalResult[fileName],
            ...metadataObj
        };
    } else {
        // Add new entry if fileName not in finalResult
        finalResult[fileName] = { ...metadataObj };
    }
  }
  return finalResult;
}

// Not an arrow function. Async function has access to arguments - so we can pass them to processnextfile
async function onAnalyse({
  filesInScope = [],
  start = 0,
  end = undefined,
  reanalyse = false,
  circleClicked = false,
}) {
  // Now we've asked for a new analysis, clear the aborted flag
  aborted = false;
  STATE.incrementor = 1;
  predictionStart = new Date();
  // Set the appropriate selection range if this is a selection analysis
  STATE.update({
    selection: end ? getSelectionRange(filesInScope[0], start, end) : undefined,
  });

  DEBUG &&
    console.log(
      `Worker received message: ${filesInScope}, ${STATE.detect.confidence}, start: ${start}, end: ${end}`
    );
  //Reset GLOBAL variables
  index = 0;
  batchChunksToSend = {};
  FILE_QUEUE = filesInScope;
  AUDIO_BACKLOG = 0;
  STATE.processingPaused = {};
  STATE.backlogInterval = {};

  if (!STATE.selection) {
    // Clear records from the memory db
    await memoryDB.runAsync("DELETE FROM records; VACUUM");
    //create a copy of files in scope for state, as filesInScope is spliced
    STATE.setFiles([...filesInScope]);
  }

  let count = 0;
  if (DATASET && !STATE.selection && !reanalyse) {
    for (let i = FILE_QUEUE.length - 1; i >= 0; i--) {
      let file = FILE_QUEUE[i];
      //STATE.db = diskDB;
      const result = await diskDB.getAsync(
        "SELECT name FROM files WHERE name = ?",
        file
      );
      if (result && result.name !== FILE_QUEUE[0]) {
        DEBUG && console.log(`Skipping ${file}, already analysed`);
        FILE_QUEUE.splice(i, 1);
        count++;
        continue;
      }
      DEBUG && console.log(`Adding ${file} to the queue.`);
    }
  } else {
    // check if results for the files are cached
    // we only consider it cached if all files have been saved to the disk DB)
    // BECAUSE we want to change state.db to disk if they are
    let allCached = true;
    METADATA = await updateMetadata(FILE_QUEUE)
    for (let i = 0; i < FILE_QUEUE.length; i++) {
      const file = FILE_QUEUE[i];
      const meta = METADATA[file];
      if (!meta?.isComplete || !meta?.isSaved){
        allCached = false;
        break;
      }
    }
    const retrieveFromDatabase =
      (allCached && !reanalyse && !STATE.selection) || circleClicked;
    if (retrieveFromDatabase) {
      filesBeingProcessed = [];
      if (circleClicked) {
        // handle circle here
        await getResults({ topRankin: 5 });
      } else {
        await onChangeMode("archive");
        FILE_QUEUE.forEach((file) =>
          UI.postMessage({
            event: "update-audio-duration",
            value: METADATA[file].duration,
          })
        );
        // Weirdness with promise all - list worker called 2x and no results returned
        //await Promise.all([getResults(), getSummary()] );
        await getResults();
        await getSummary();
      }
      return;
    }
  }
  DEBUG &&
    console.log(
      "FILE_QUEUE has",
      FILE_QUEUE.length,
      "files",
      count,
      "files ignored"
    );
  STATE.selection || onChangeMode("analyse");

  filesBeingProcessed = [...FILE_QUEUE];
  for (let i = 0; i < NUM_WORKERS; i++) {
    processNextFile({ start: start, end: end, worker: i });
  }
}

function onAbort({ model = STATE.model, list = STATE.list }) {
  aborted = true;
  FILE_QUEUE = [];
  predictQueue = [];
  filesBeingProcessed = [];
  predictionsReceived = {};
  predictionsRequested = {};
  index = 0;
  DEBUG && console.log("abort received");
  Object.keys(STATE.backlogInterval).forEach((pid) => {
    clearInterval(STATE.backlogInterval[pid]);
  });
  //restart the workers
  terminateWorkers();
  setTimeout(
    () => spawnPredictWorkers(model, list, BATCH_SIZE, NUM_WORKERS),
    20
  );
}

const getDuration = async (src) => {
  let audio;
  return new Promise(function (resolve, reject) {
    audio = new Audio();

    audio.src = src.replaceAll("#", "%23").replaceAll("?", "%3F"); // allow hash and ? in the path (https://github.com/Mattk70/Chirpity-Electron/issues/98)
    audio.addEventListener("loadedmetadata", function () {
      const duration = audio.duration;
      if (duration === Infinity || !duration || isNaN(duration)) {
        const i18n = {
          en: "File duration",
          en_uk: "File duration",
          da: "Filens varighed",
          de: "Dateidauer",
          es: "Duración del archivo",
          fr: "Durée du fichier",
          ja: "ファイルの長さ",
          nl: "Bestandsduur",
          pt: "Duração do arquivo",
          ru: "Длительность файла",
          sv: "Filens varaktighet",
          zh: "文件时长",
        };
        const message = i18n[STATE.locale] || i18n["en"];
        return reject(
          `${message} <span style="color: red">${duration}</span> (${src})`
        );
      }
      audio.remove();
      resolve(duration);
    });
    audio.addEventListener("error", (error) => {
      generateAlert({
        type: "error",
        message: "badMetadata",
        variables: { src },
      });
      reject(error, src);
    });
  });
};

/**
 * getWorkingFile's purpose is to locate a file and set its metadata.
 * @param file: full path to source file
 * @returns {Promise<boolean|*>}
 */
async function getWorkingFile(file) {
  // find the file
  const source_file = fs.existsSync(file) ? file : await locateFile(file);
  if (!source_file) {
    const i18n = {
      en: "File not found",
      da: "Fil ikke fundet",
      de: "Datei nicht gefunden",
      es: "Archivo no encontrado",
      fr: "Fichier non trouvé",
      ja: "ファイルが見つかりません",
      nl: "Bestand niet gevonden",
      pt: "Arquivo não encontrado",
      ru: "Файл не найден",
      sv: "Fil kunde inte hittas",
      zh: "文件未找到",
    };
    const message = i18n[STATE.locale] || i18n["en"];
    throw new Error(`${message}: ${file}`);
  }
  const meta = await setMetadata({ file: file, source_file: source_file });
  if (!meta) throw new Error(`No metadata set for: ${file}`);

  METADATA[source_file] = METADATA[file];
  return source_file;
}

/**
 * Function to locate a file either in the archive, or with the same basename but different extension from SUPPORTED_FILES
 * @param {string} file - Full path to a file that doesn't exist
 * @returns {string | null} - Full path to the located file or null if not found
 */
async function locateFile(file) {
  // Check if the file has been archived
  const row = await diskDB.getAsync(
    "SELECT archiveName from files WHERE name = ?",
    file
  );
  if (row?.archiveName) {
    const fullPathToFile = p.join(STATE.library.location, row.archiveName);
    if (fs.existsSync(fullPathToFile)) {
      return fullPathToFile;
    }
  }
  // Not there, search the directory
  const dir = p.dirname(file); // Get directory of the provided file
  const baseName = p.basename(file, p.extname(file)); // Get the base name without extension

  // Read all files in the directory
  try {
    const files = fs.readdirSync(dir);

    // Search for a file with the same base name
    for (const currentFile of files) {
      const currentBaseName = p.basename(currentFile, p.extname(currentFile));

      // Check if the base name matches before comparing the extension
      if (currentBaseName === baseName) {
        const currentExt = p.extname(currentFile);

        if (SUPPORTED_FILES.includes(currentExt)) {
          return p.join(dir, currentFile); // Return the full path of the found file
        }
      }
    }
  } catch (error) {
    if (error.message.includes("scandir")) {
      const match = error.message.match(/'([^']+)'/);
      generateAlert({
        type: "error",
        message: "noDirectory",
        variables: { match },
      });
    }
    console.warn(error.message + " - Disk removed?"); // Expected that this happens when the directory doesn't exist
  }
  return null;
}

/**
 * Notifies the UI about a missing file entry in the database.
 *
 * This asynchronous function queries the disk database for a file record by its name.
 * If a record with an associated ID exists, it considers the file as missing and triggers an
 * error alert with the message "dbFileMissing" along with the file name in the alert variables.
 *
 * @async
 * @param {string} file - The name of the file to search for in the database.
 * @returns {Promise<void>} A promise that resolves once the alert has been generated.
 * @throws Propagates any errors encountered during the database query.
 */
async function notifyMissingFile(file) {
  let missingFile;
  // Look for the file in the Archive
  const row = await diskDB.getAsync("SELECT * FROM FILES WHERE name = ?", file);
  if (row?.id) missingFile = file;
  generateAlert({
    type: "error",
    message: "dbFileMissing",
    variables: { file: missingFile },
  });
}

/**
 * Asynchronously loads an audio file, processes its audio data, and updates the UI with relevant metadata.
 *
 * This function fetches the audio buffer from the specified file between the given start and end times,
 * then posts the audio data along with metadata to the UI. It also triggers detection processing and posts
 * the current file's week number based on the application's state. If the file does not exist or an error occurs
 * during processing, an error alert is generated and the promise is rejected.
 *
 * @param {Object} options - Configuration options for loading the audio file.
 * @param {string} [options.file=""] - The path to the audio file to load.
 * @param {number} [options.start=0] - The starting time (in seconds) of the audio segment to load.
 * @param {number} [options.end=20] - The ending time (in seconds) of the audio segment to load.
 * @param {number} [options.position=0] - The playback position offset for the audio file.
 * @param {boolean} [options.play=false] - Flag indicating whether to automatically play the audio after loading.
 * @param {boolean} [options.goToRegion=true] - Flag indicating whether the UI should navigate to a specific region.
 *
 * @returns {Promise<void>} A promise that resolves when the audio file has been successfully loaded and processed,
 * or rejects with a generated error alert if the file cannot be found or processed.
 *
 * @throws Will reject if the file does not exist or if an error occurs while fetching or processing the audio data.
 *
 * @example
 * loadAudioFile({
 *   file: "/path/to/audio.mp3",
 *   start: 10,
 *   end: 30,
 *   position: 5,
 *   play: true,
 *   goToRegion: true
 * })
 *   .then(() => console.log("Audio loaded successfully."))
 *   .catch((error) => console.error("Error loading audio:", error));
 */
async function loadAudioFile({
  file = "",
  start = 0,
  end = 20,
  position = 0,
  // region = false,
  play = false,
  goToRegion = true,
}) {
  return new Promise((resolve, reject) => {
    if (file) {
      fetchAudioBuffer({ file, start, end })
        .then(([audio, start]) => {
          // let audioArray = getMonoChannelData(audio);
          UI.postMessage(
            {
              event: "worker-loaded-audio",
              location: METADATA[file].locationID,
              fileStart: METADATA[file].fileStart,
              fileDuration: METADATA[file].duration,
              windowBegin: start,
              file: file,
              position: position,
              contents: audio,
              // fileRegion: region,
              play: play,
              // goToRegion,
              metadata: METADATA[file].metadata,
            },
            [audio.buffer]
          );
          let week;

          sendDetections(file, start, end, goToRegion);

          if (STATE.list === "location") {
            week = STATE.useWeek
              ? new Date(METADATA[file].fileStart).getWeekNumber()
              : -1;
            // Send the week number of the surrent file
            UI.postMessage({ event: "current-file-week", week: week });
          } else {
            UI.postMessage({ event: "current-file-week", week: undefined });
          }
          resolve();
        })
        .catch((error) => {
          // notify and throw error if no matching file was found
          if (!fs.existsSync(file)) {
            generateAlert({
              type: "error",
              message: "noFile",
              variables: { error },
              file,
            });
            //reject(error)
          } else {
            const size = fs.statSync(file).size === 0 ? "0 bytes" : "";
            const message = error.message || `${file}: ${size}`;
            console.warn(message);
            reject(
              generateAlert(
                {
                  type: "error",
                  message: "noFile",
                  variables: { error: message },
                },
                file
              )
            );
          }
        });
    } else {
      const error = "No file";
      reject(
        generateAlert({
          type: "error",
          message: "noFile",
          variables: { error },
        })
      );
    }
  });
}

/**
 * Adds a specified number of days to a given date and returns a new Date object.
 *
 * This function accepts a date provided as a Date object, a date string, or a timestamp, and adds the given number of days.
 * Use negative values for subtracting days. It throws an error if the input date is invalid or if the days parameter is not a valid number.
 *
 * @param {(Date|string|number)} date - The original date to modify. Can be a Date object, a valid date string, or a timestamp.
 * @param {number} days - The number of days to add. Use a negative value to subtract days.
 * @returns {Date} A new Date object representing the date after adding the specified number of days.
 * @throws {TypeError} If the input date is invalid or if days is not a valid number.
 *
 * @example
 * // Add 3 days to the current date
 * const newDate = addDays(new Date(), 3);
 */
function addDays(date, days) {
  if (!(date instanceof Date) && isNaN(Date.parse(date))) {
    throw new TypeError("Invalid date parameter");
  }
  if (typeof days !== "number" || isNaN(days)) {
    throw new TypeError("Days must be a valid number");
  }
  let result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Retrieves detection records for a given audio file within a specified time range and posts them to the UI.
 *
 * This asynchronous function calculates absolute start and end timestamps by adding the file's metadata offset
 * (in milliseconds) to the provided start and end offsets (in seconds). It queries the database for detection
 * records that satisfy the following criteria:
 * - A confidence level greater than or equal to the configured minimum (STATE.detect.confidence).
 * - A file name matching the provided file parameter.
 * - A detection timestamp between the calculated start and end times.
 *
 * If additional species filters are active, the query further restricts results by species ID. Records are
 * ranked using a window function to select the top (most confident) detection per grouping of file and datetime.
 * The function posts the resulting detections to the UI along with a flag that instructs the UI whether to
 * navigate directly to the corresponding region.
 *
 * @async
 * @param {string} file - The identifier or name of the audio file used for querying metadata and filtering detections.
 * @param {number} start - The starting offset in seconds from the beginning of the file's recording.
 * @param {number} end - The ending offset in seconds from the beginning of the file's recording.
 * @param {boolean} goToRegion - If true, signals the UI to navigate to the detected region.
 * @returns {Promise<void>} A promise that resolves when detections have been successfully retrieved and sent to the UI.
 */
async function sendDetections(file, start, end, goToRegion) {
  const db = STATE.db;
  start = METADATA[file].fileStart + start * 1000;
  end = METADATA[file].fileStart + end * 1000;
  const params = [STATE.detect.confidence, file, start, end];
  const included = await getIncludedIDs();
  const includedSQL = filtersApplied(included)
    ? ` AND speciesID IN (${prepParams(included)})`
    : "";
  includedSQL && params.push(...included);
  const results = await db.allAsync(
    `
        WITH RankedRecords AS (
            SELECT 
                position AS start, 
                end, 
                cname AS label, 
                ROW_NUMBER() OVER (PARTITION BY fileID, dateTime ORDER BY confidence DESC) AS rank,
                confidence,
                name,
                dateTime,
                speciesID
            FROM records
            JOIN species ON speciesID = species.ID
            JOIN files ON fileID = files.ID
            WHERE confidence >= ?
            AND name = ? 
            AND dateTime BETWEEN ? AND ?
            ${includedSQL}
        )
        SELECT start, end, label
        FROM RankedRecords
        WHERE rank = 1  
        `,
    ...params
  );
  UI.postMessage({
    event: "window-detections",
    detections: results,
    goToRegion,
  });
}

const roundedFloat = (string) => Math.round(parseFloat(string) * 10000) / 10000;

/**
 * Called by getWorkingFile, setCustomLocation
 * Assigns file metadata to a metadata cache object. file is the key, and is the source file
 * @param file: the file name passed to the worker
 * @param source_file: the file that exists ( will be different after compression)
 * @returns {Promise<unknown>}
 */
const setMetadata = async ({ file, source_file = file }) => {
  if (METADATA[file]?.isComplete) return METADATA[file];

  // CHeck the database first, so we honour any manual updates.
  const savedMeta = await getSavedFileInfo(file).catch((error) =>
    console.warn("getSavedFileInfo error", error)
  );
  if (savedMeta) {
    METADATA[file] = savedMeta;
    if (savedMeta.locationID)
      UI.postMessage({
        event: "file-location-id",
        file,
        id: savedMeta.locationID,
      });
    METADATA[file].isSaved = true; // Queried by UI to establish saved state of file.
  } else {
    METADATA[file] = {};
  }

  let guanoTimestamp;
  // savedMeta may just have a locationID if it was set by onSetCUstomLocation
  if (!savedMeta?.duration) {
    METADATA[file].duration = await getDuration(file);
    if (file.toLowerCase().endsWith("wav")) {
      const { extractWaveMetadata } = require("./js/utils/metadata.js");
      const t0 = Date.now();
      const wavMetadata = await extractWaveMetadata(file); //.catch(error => console.warn("Error extracting GUANO", error));
      if (Object.keys(wavMetadata).includes("guano")) {
        const guano = wavMetadata.guano;
        const location = guano["Loc Position"];
        if (location) {
          const [lat, lon] = location.split(" ");
          await onSetCustomLocation({
            lat: roundedFloat(lat),
            lon: roundedFloat(lon),
            place: location,
            files: [file],
            overwritePlaceName: false,
          });
          METADATA[file].lat = roundedFloat(lat);
          METADATA[file].lon = roundedFloat(lon);
        }
        guanoTimestamp = Date.parse(guano.Timestamp);
        METADATA[file].fileStart = guanoTimestamp;
      }
      if (Object.keys(wavMetadata).length > 0) {
        METADATA[file].metadata = JSON.stringify(wavMetadata);
      }
      DEBUG &&
        console.log(`GUANO search took: ${(Date.now() - t0) / 1000} seconds`);
    }
  }
  let fileStart, fileEnd;
  // Prepare to set dateDurations
  if (savedMeta?.fileStart) {
    // Saved timestamps have the highest priority allowing for an override of Guano timestamp/file mtime
    fileStart = new Date(savedMeta.fileStart);
    fileEnd = new Date(fileStart.getTime() + METADATA[file].duration * 1000);
  } else if (guanoTimestamp) {
    // Guano has second priority
    fileStart = new Date(guanoTimestamp);
    fileEnd = new Date(guanoTimestamp + METADATA[file].duration * 1000);
  } else {
    // Least preferred
    const stat = fs.statSync(source_file);
    const meta = METADATA[file].metadata
      ? JSON.parse(METADATA[file].metadata)
      : {};
    const H1E = meta.bext?.Originator?.includes("H1essential");
    if (STATE.fileStartMtime || H1E) {
      // Zoom H1E apparently sets mtime to be the start of the recording
      fileStart = new Date(stat.mtime);
      fileEnd = new Date(stat.mtime + METADATA[file].duration * 1000);
    } else {
      fileEnd = new Date(stat.mtime);
      fileStart = new Date(stat.mtime - METADATA[file].duration * 1000);
    }
  }

  // split  the duration of this file across any dates it spans
  METADATA[file].dateDuration = {};
  const key = new Date(fileStart);
  key.setHours(0, 0, 0, 0);
  const keyCopy = addDays(key, 0).getTime();
  if (fileStart.getDate() === fileEnd.getDate()) {
    METADATA[file].dateDuration[keyCopy] = METADATA[file].duration;
  } else {
    const key2 = addDays(key, 1);
    const key2Copy = addDays(key2, 0).getTime();
    METADATA[file].dateDuration[keyCopy] = (key2Copy - fileStart) / 1000;
    METADATA[file].dateDuration[key2Copy] =
      METADATA[file].duration - METADATA[file].dateDuration[keyCopy];
  }
  // If we haven't set METADATA.file.fileStart by now we need to create it from a Date
  METADATA[file].fileStart ??= fileStart.getTime();
  // Set complete flag
  METADATA[file].isComplete = true;
  return METADATA[file];
};

function pauseFfmpeg(ffmpegCommand, pid) {
  if (!STATE.processingPaused[pid]) {
    if (isWin32) {
      const message = pid
        ? ntsuspend.suspend(pid)
          ? "Ffmpeg process paused"
          : "Could not pause process"
        : "Could not pause process (exited)";
      DEBUG && console.log(message);
    } else {
      ffmpegCommand.kill("SIGSTOP");
      console.log("paused ", pid);
    }
    STATE.processingPaused[pid] = true;
  }
}

function resumeFfmpeg(ffmpegCommand, pid) {
  if (STATE.processingPaused[pid]) {
    if (isWin32) {
      const message = pid
        ? ntsuspend.resume(pid)
          ? "Ffmpeg process resumed"
          : `Could not resume process ${pid}`
        : "Could not resume process (exited)";
      DEBUG && console.log(message);
    } else {
      ffmpegCommand.kill("SIGCONT");
      console.log("resumed ", pid);
    }
    STATE.processingPaused[pid] = false;
  }
}

let predictQueue = [];

const getPredictBuffers = async ({ file = "", start = 0, end = undefined }) => {
  if (!fs.existsSync(file)) {
    const found = await getWorkingFile(file);
    if (!found) throw new Error("Unable to locate " + file);
    const index = filesBeingProcessed.indexOf(file);
    filesBeingProcessed[index] = found;
    // Need to update state too
    const stateIndex = STATE.filesToAnalyse.indexOf(file);
    STATE.filesToAnalyse[stateIndex] = found;
    file = found;
  }
  // Ensure max and min are within range
  start = Math.max(0, start);
  end = Math.min(METADATA[file].duration, end);
  if (start > METADATA[file].duration) {
    return;
  }

  const duration = end - start;
  batchChunksToSend[file] = Math.ceil(duration / (BATCH_SIZE * WINDOW_SIZE));
  predictionsReceived[file] = 0;
  predictionsRequested[file] = 0;

  const batchDuration = BATCH_SIZE * WINDOW_SIZE;
  //reduce highWaterMark for small analyses
  const samplesInWindow = sampleRate * WINDOW_SIZE;
  let samplesInBatch;
  if (end && end - start < batchDuration) {
    const audioDuration = end - start;
    samplesInBatch = Math.ceil(audioDuration / WINDOW_SIZE) * samplesInWindow;
  } else {
    samplesInBatch = samplesInWindow * BATCH_SIZE;
  }
  const highWaterMark = samplesInBatch * 2;
  let chunkStart = start * sampleRate;

  await processAudio(
    file,
    start,
    end,
    chunkStart,
    highWaterMark,
    samplesInBatch
  );
};

async function processAudio(
  file,
  start,
  end,
  chunkStart,
  highWaterMark,
  samplesInBatch
) {
  const MAX_CHUNKS = Math.max(12, NUM_WORKERS * 2);
  return new Promise((resolve, reject) => {
    // Many compressed files start with a small section of silence due to encoder padding, which affects predictions
    // To compensate, we move the start back a small amount, and slice the data to remove the silence
    let remainingTrim,
      adjustment = 0.05;
    if (start > adjustment) {
      remainingTrim = sampleRate * 2 * adjustment;
      start -= adjustment;
    }
    let currentIndex = 0,
      duration = 0,
      bytesPerSecond = 48_000;
    const audioBuffer = Buffer.allocUnsafe(highWaterMark);
    const additionalFilters = STATE.filters.sendToModel
      ? setAudioFilters()
      : [];
    const command = setupFfmpegCommand({
      file,
      start,
      end,
      sampleRate,
      additionalFilters,
    });
    command.on("error", (error) => {
      if ((error.message === "Output stream closed") & !aborted) {
        console.warn(`processAudio: ${file} ${error}`);
      } else {
        if (error.message.includes("SIGKILL"))
          console.log("FFMPEG process shut down at user request");
        reject(error);
      }
    });

    const STREAM = command.pipe();

    STREAM.on("data", (chunk) => {
      const pid = command.ffmpegProc?.pid;
      duration += chunk.length / bytesPerSecond;
      if (!STATE.processingPaused[pid] && AUDIO_BACKLOG >= MAX_CHUNKS) {
        //console.log(`Backlog for pid: ${pid}`, AUDIO_BACKLOG)
        pauseFfmpeg(command, pid);
        STATE.backlogInterval[pid] = setInterval(() => {
          if (AUDIO_BACKLOG < NUM_WORKERS * 2) {
            resumeFfmpeg(command, pid);
            clearInterval(STATE.backlogInterval[pid]);
          }
        }, 10);
      }
      if (aborted) {
        STREAM.destroy();
        return;
      }
      if (remainingTrim) {
        if (chunk.length <= remainingTrim) {
          // Reduce the remaining trim by the chunk length and skip this chunk
          remainingTrim -= chunk.length;
          return; // Ignore this chunk and move to the next
        } else {
          // Trim the current chunk by the remaining amount
          chunk = chunk.subarray(remainingTrim, highWaterMark);
          remainingTrim = 0; // Reset the remainder after trimming
        }
      }
      // Copy incoming chunk into the audioBuffer
      const remainingSpace = highWaterMark - currentIndex;
      if (chunk.length <= remainingSpace) {
        chunk.copy(audioBuffer, currentIndex);
        currentIndex += chunk.length;
      } else {
        // Fill remaining space
        chunk.copy(audioBuffer, currentIndex);
        // Process full buffer
        AUDIO_BACKLOG++;
        prepareWavForModel(
          audioBuffer.subarray(0, highWaterMark),
          file,
          end,
          chunkStart
        );
        feedChunksToModel(...predictQueue.shift());
        chunkStart += samplesInBatch;

        // Handle the remainder
        const remainder = chunk.subarray(highWaterMark - currentIndex);
        remainder.copy(audioBuffer, 0);
        currentIndex = remainder.length; // Reset index for the new chunk
      }

      // If we have filled the buffer completely
      if (currentIndex === highWaterMark) {
        AUDIO_BACKLOG++;
        prepareWavForModel(audioBuffer, file, end, chunkStart);
        feedChunksToModel(...predictQueue.shift());
        chunkStart += samplesInBatch;
        currentIndex = 0; // Reset index for the next fill
      }
    });
    STREAM.on("end", () => {
      const metaDuration = METADATA[file].duration;
      if (end === metaDuration && duration < metaDuration) {
        // If we have a short file (header duration > processed duration)
        // *and* were looking for the whole file, we'll fix # of expected chunks here
        batchChunksToSend[file] = Math.ceil(
          duration / (BATCH_SIZE * WINDOW_SIZE)
        );

        const diff = Math.abs(metaDuration - duration);
        if (diff > 3) console.warn("File duration mismatch", diff);

        METADATA[file].duration = duration;
      }
      // Handle any remaining data in the buffer
      if (currentIndex > 0) {
        // Check if there's any data left in the buffer
        AUDIO_BACKLOG++;
        prepareWavForModel(
          audioBuffer.subarray(0, currentIndex),
          file,
          end,
          chunkStart
        );
        feedChunksToModel(...predictQueue.shift());
      }
      DEBUG && console.log("All chunks sent for ", file);
      return resolve();
    });

    STREAM.on("error", (err) => {
      console.log("stream error: ", err);
      err.code === "ENOENT" && notifyMissingFile(file);
    });
  }).catch((error) => console.log(error));
}

function getMonoChannelData(audio) {
  const sampleCount = audio.length / 2;
  const channelData = new Float32Array(sampleCount);
  const dataView = new DataView(
    audio.buffer,
    audio.byteOffset,
    audio.byteLength
  );

  // Process in blocks of 4 samples at a time for loop unrolling (optional)
  let i = 0;
  let j = 0;
  const end = sampleCount - (sampleCount % 8); // Ensure we don’t overshoot the buffer

  for (; i < end; i += 8, j += 16) {
    // Unrolled loop
    channelData[i] = dataView.getInt16(j, true) / 32768;
    channelData[i + 1] = dataView.getInt16(j + 2, true) / 32768;
    channelData[i + 2] = dataView.getInt16(j + 4, true) / 32768;
    channelData[i + 3] = dataView.getInt16(j + 6, true) / 32768;
    channelData[i + 4] = dataView.getInt16(j + 8, true) / 32768;
    channelData[i + 5] = dataView.getInt16(j + 10, true) / 32768;
    channelData[i + 6] = dataView.getInt16(j + 12, true) / 32768;
    channelData[i + 7] = dataView.getInt16(j + 14, true) / 32768;
  }

  // Process remaining samples (if any)
  for (; i < sampleCount; i++, j += 2) {
    channelData[i] = dataView.getInt16(j, true) / 32768;
  }

  return channelData;
}

function prepareWavForModel(audio, file, end, chunkStart) {
  predictionsRequested[file]++;
  const channelData = getMonoChannelData(audio);
  // Send the channel data to the model
  predictQueue.push([channelData, chunkStart, file, end]);
}

/**
 * Called when file first loaded, when result clicked and when saving or sending file snippets
 * @param {Object} params - The parameters for fetching the audio buffer.
 * @param {string} params.file - The file path.
 * @param {number} params.start - The start time in seconds.
 * @param {number} [params.end] - The end time in seconds.
 * @returns {Promise<Buffer[]>} - The audio buffer and start time.
 */
const fetchAudioBuffer = async ({ file = "", start = 0, end }) => {
  if (!fs.existsSync(file)) {
    const result = await getWorkingFile(file);
    if (!result) throw new Error(`Cannot locate ${file}`);
    file = result;
  }

  await setMetadata({ file });
  end ??= METADATA[file].duration;

  if (start < 0) {
    // Work back from file end
    start += METADATA[file].duration;
    end += METADATA[file].duration;
  }

  // Ensure start is a minimum 0.1 seconds from the end of the file, and >= 0
  start =
    METADATA[file].duration < 0.1
      ? 0
      : Math.min(METADATA[file].duration - 0.1, start);
  end = Math.min(end, METADATA[file].duration);

  // Validate start time
  if (isNaN(start)) throw new Error("fetchAudioBuffer: start is NaN");

  return new Promise((resolve, reject) => {
    const additionalFilters = setAudioFilters();
    const command = setupFfmpegCommand({
      file,
      start,
      end,
      sampleRate: 24000,
      format: "wav",
      channels: 1,
      additionalFilters,
    });

    const stream = command.pipe();
    let concatenatedBuffer = Buffer.alloc(0);

    command.on("error", (error) => {
      generateAlert({ type: "error", message: "ffmpeg", variables: { error } });
      reject(
        new Error(
          `fetchAudioBuffer: Error extracting audio segment: ${JSON.stringify(
            error
          )}`
        )
      );
    });

    stream.on("readable", () => {
      const chunk = stream.read();
      if (chunk === null) {
        // Last chunk
        resolve([concatenatedBuffer, start]);
        stream.destroy();
      } else {
        concatenatedBuffer = concatenatedBuffer.length
          ? Buffer.concat([concatenatedBuffer, chunk])
          : chunk;
      }
    });
  });
};

function setAudioFilters() {
  const filters = STATE.filters;
  return STATE.filters.active
    ? [
        filters.lowShelfAttenuation &&
          filters.lowShelfFrequency && {
            filter: "lowshelf",
            options: `gain=${filters.lowShelfAttenuation}:f=${filters.lowShelfFrequency}`,
          },
        filters.highPassFrequency && {
          filter: "highpass",
          options: `f=${filters.highPassFrequency}:poles=1`,
        },
        STATE.audio.gain > 0 && {
          filter: "volume",
          options: `volume=${STATE.audio.gain}dB`,
        },
        filters.normalise && {
          filter: "loudnorm",
          options: "I=-16:LRA=11:TP=-1.5",
        },
      ].filter(Boolean)
    : [];
}

// Helper function to check if a given time is within daylight hours
function isDuringDaylight(datetime, lat, lon) {
  const date = new Date(datetime);
  const { dawn, dusk } = SunCalc.getTimes(date, lat, lon);
  return datetime >= dawn && datetime <= dusk;
}

async function feedChunksToModel(channelData, chunkStart, file, end, worker) {
  // pick a worker - this method is faster than looking for available workers
  if (++workerInstance >= NUM_WORKERS) workerInstance = 0;
  worker = workerInstance;

  const objData = {
    message: "predict",
    worker: worker,
    fileStart: METADATA[file].fileStart,
    file: file,
    start: chunkStart,
    duration: end,
    resetResults: !STATE.selection,
    snr: STATE.filters.SNR,
    context: STATE.detect.contextAware,
    confidence: STATE.detect.confidence,
    chunks: channelData,
  };
  predictWorkers[worker].isAvailable = false;
  predictWorkers[worker].postMessage(objData, [channelData.buffer]);
}
async function doPrediction({
  file = "",
  start = 0,
  end = METADATA[file].duration,
}) {
  await getPredictBuffers({ file: file, start: start, end: end }).catch(
    (error) => console.warn(error)
  );

  UI.postMessage({
    event: "update-audio-duration",
    value: METADATA[file].duration,
  });
}

const speciesMatch = (path, sname) => {
  const pathElements = path.split(p.sep);
  const species = pathElements[pathElements.length - 2];
  sname = sname.replace(/ /g, "_");
  return species.includes(sname);
};

function findFile(pathParts, filename, species) {
  const baseDir = pathParts.slice(0, 5).concat(["XC_ALL_mp3"]).join(p.sep);

  // List of suffixes to check, in order
  const suffixes = ["", " (call)", " (fc)", " (nfc)", " (song)"];

  // Extract existing suffix from species, if present
  const suffixPattern = / \((call|fc|nfc|song)\)$/;
  let speciesBase = species;
  let existingSuffix = "";

  const match = species.match(suffixPattern);
  if (match) {
    existingSuffix = match[0]; // e.g., " (call)"
    speciesBase = species.replace(suffixPattern, ""); // Remove suffix
  }

  // First, check the species with its existing suffix
  if (existingSuffix) {
    const folder = p.join(baseDir, species);
    const filePath = p.join(folder, filename + ".mp3");
    if (fs.existsSync(filePath)) {
      console.log(`File found: ${filePath}`);
      return [filePath, species];
    }
  }

  // Check species with other suffixes, removing the existing one
  for (const suffix of suffixes) {
    if (suffix === existingSuffix) continue; // Skip the suffix already checked
    const found_calltype = speciesBase + suffix;
    const folder = p.join(baseDir, found_calltype);
    const filePath = p.join(folder, filename + ".mp3");
    if (fs.existsSync(filePath)) {
      console.log(`File found: ${filePath}`);

      return [filePath, found_calltype];
    }
  }

  console.log("File not found in any directory");
  return [null, null];
}
const convertSpecsFromExistingSpecs = async (path) => {
  path ??=
    "/media/matt/36A5CC3B5FA24585/DATASETS/MISSING/NEW_DATASET_WITHOUT_ALSO_MERGED";
  const file_list = await getFiles([path], true);
  for (let i = 0; i < file_list.length; i++) {
    if (i % 100 === 0) {
      console.log(`${i} records processed`);
    }
    const parts = p.parse(file_list[i]);
    let path_parts = parts.dir.split(p.sep);
    let species = path_parts[path_parts.length - 1];
    const species_parts = species.split("~");
    species = species_parts[1] + "~" + species_parts[0];
    const [filename, time] = parts.name.split("_");
    const [start, end] = time.split("-");
    // const path_to_save = path.replace('New_Dataset', 'New_Dataset_Converted') + p.sep + species;
    let path_to_save =
      "/media/matt/36A5CC3B5FA24585/DATASETS/ATTENUATED_pngs/converted" +
      p.sep +
      species;
    let file_to_save = p.join(path_to_save, parts.base);
    if (fs.existsSync(file_to_save)) {
      DEBUG && console.log("skipping file as it is already saved");
    } else {
      const [file_to_analyse, confirmed_species_folder] = findFile(
        path_parts,
        filename,
        species
      );
      path_to_save = path_to_save.replace(species, confirmed_species_folder);
      file_to_save = p.join(path_to_save, parts.base);
      if (fs.existsSync(file_to_save)) {
        console.log("skipping file as it is already saved");
        continue;
      }
      if (!file_to_analyse) continue;
      //parts.dir.replace('MISSING/NEW_DATASET_WITHOUT_ALSO_MERGED', 'XC_ALL_mp3') + p.sep + filename + '.mp3';
      const [AudioBuffer, begin] = await fetchAudioBuffer({
        start: parseFloat(start),
        end: parseFloat(end),
        file: file_to_analyse,
      });
      if (AudioBuffer) {
        // condition to prevent barfing when audio snippet is v short i.e. fetchAudioBUffer false when < 0.1s
        if (++workerInstance === NUM_WORKERS) {
          workerInstance = 0;
        }
        const buffer = getMonoChannelData(AudioBuffer);
        predictWorkers[workerInstance].postMessage(
          {
            message: "get-spectrogram",
            filepath: path_to_save,
            file: parts.base,
            buffer: buffer,
            height: 256,
            width: 384,
            worker: workerInstance,
          },
          [buffer.buffer]
        );
      }
    }
  }
};

const saveResults2DataSet = ({ species, included }) => {
  // STATE.specCount = 0; STATE.totalSpecs = 0;
  const exportType = ""; //audio';
  const rootDirectory = DATASET_SAVE_LOCATION;
  sampleRate = STATE.model === "birdnet" ? 48_000 : 24_000;
  const height = 256,
    width = 384;
  let t0 = Date.now();
  let promise = Promise.resolve();
  let promises = [];
  let count = 0;
  let db2ResultSQL = `SELECT dateTime AS timestamp, 
    files.duration, 
    files.filestart,
    files.name AS file, 
    position,
    species.sname, 
    species.cname, 
    confidence AS score, 
    tagID, 
    comment
    FROM records
    JOIN species
    ON species.id = records.speciesID
    JOIN files ON records.fileID = files.id
    WHERE confidence >= ${STATE.detect.confidence}`;
  db2ResultSQL += filtersApplied(included)
    ? ` AND speciesID IN (${prepParams(included)})`
    : "";

  let params = filtersApplied(included) ? included : [];
  if (species) {
    db2ResultSQL += ` AND species.cname = ?`;
    params.push(species);
  }
  STATE.db.each(
    db2ResultSQL,
    ...params,
    async (err, result) => {
      // Check for level of ambient noise activation
      let ambient,
        threshold,
        value = STATE.detect.confidence;
      // adding_chirpity_additions is a flag for curated files, if true we assume every detection is correct
      if (!adding_chirpity_additions) {
        // ambient = (result.sname2 === 'Ambient Noise' ? result.score2 : result.sname3 === 'Ambient Noise' ? result.score3 : false)
        // console.log('Ambient', ambient)
        // // If we have a high level of ambient noise activation, insist on a high threshold for species detection
        // if (ambient && ambient > 0.2) {
        //     value = 0.7
        // }
        // Check whether top predicted species matches folder (i.e. the searched for species)
        // species not matching the top prediction sets threshold to 2000, effectively limiting treatment to manual records
        threshold = speciesMatch(result.file, result.sname) ? value : 2000;
      } else {
        //threshold = result.sname === "Ambient_Noise" ? 0 : 2000;
        threshold = result.sname === "Ambient_Noise" ? 0 : 0;
      }
      promise = promise.then(async function () {
        let score = result.score;
        if (score >= threshold) {
          //const folders = p.dirname(result.file).split(p.sep);
          species = result.cname.replaceAll(" ", "_");
          const sname = result.sname.replaceAll(" ", "_");
          // score 2000 when manual id. if manual ID when doing  additions put it in the species folder
          const folder =
            adding_chirpity_additions && score !== 2000
              ? "No_call"
              : `${sname}~${species}`;
          // get start and end from timestamp
          const start = result.position;
          let end = start + 3;

          // filename format: <source file>_<confidence>_<start>.png
          const file = `${p
            .basename(result.file)
            .replace(p.extname(result.file), "")}_${start}-${end}.png`;
          const filepath = p.join(rootDirectory, folder);
          const file_to_save = p.join(filepath, file);
          if (fs.existsSync(file_to_save)) {
            DEBUG && console.log("skipping file as it is already saved");
          } else {
            end = Math.min(end, result.duration);
            if (exportType === "audio")
              saveAudio(
                result.file,
                start,
                end,
                file.replace(".png", ".wav"),
                { Artist: "Chirpity" },
                filepath
              );
            else {
              const [AudioBuffer, _] = await fetchAudioBuffer({
                start: start,
                end: end,
                file: result.file,
              });
              if (AudioBuffer) {
                // condition to prevent barfing when audio snippet is v short i.e. fetchAudioBUffer false when < 0.1s
                if (++workerInstance === NUM_WORKERS) {
                  workerInstance = 0;
                }
                const buffer = getMonoChannelData(AudioBuffer);
                // STATE.totalSpecs++
                predictWorkers[workerInstance].postMessage(
                  {
                    message: "get-spectrogram",
                    filepath: filepath,
                    file: file,
                    buffer: buffer,
                    height: height,
                    width: width,
                    worker: workerInstance,
                  },
                  [buffer.buffer]
                );
              }
            }
            count++;
          }
        }
        return new Promise(function (resolve) {
          setTimeout(resolve, 0.1);
        });
      });
      promises.push(promise);
    },
    (err) => {
      if (err) return console.log(err);

      Promise.all(promises).then(() =>
        console.log(
          `Dataset created. ${count} files saved in ${
            (Date.now() - t0) / 1000
          } seconds`
        )
      );
    }
  );
};

const onSpectrogram = async (filepath, file, width, height, data, channels) => {
  const { writeFile, mkdir } = require("node:fs/promises");
  const png = require("fast-png");
  await mkdir(filepath, { recursive: true });
  let image = png.encode({
    width: 384,
    height: 256,
    data: data,
    channels: channels,
  });
  const file_to_save = p.join(filepath, file);
  await writeFile(file_to_save, image);
  DEBUG && console.log("saved:", file_to_save);
};

async function uploadOpus({ file, start, end, defaultName, metadata, mode }) {
  const blob = await bufferToAudio({
    file: file,
    start: start,
    end: end,
    format: "opus",
    meta: metadata,
  });
  // Populate a form with the file (blob) and filename
  const formData = new FormData();
  //const timestamp = Date.now()
  formData.append("thefile", blob, defaultName);
  // Was the prediction a correct one?
  formData.append("Chirpity_assessment", mode);
  // post form data
  const xhr = new XMLHttpRequest();
  xhr.responseType = "text";
  // log response
  xhr.onload = () => {
    DEBUG && console.log(xhr.response);
  };
  // create and send the reqeust
  xhr.open("POST", "https://birds.mattkirkland.co.uk/upload");
  xhr.send(formData);
}

const bufferToAudio = async ({
  file = "",
  start = 0,
  end = 3,
  meta = {},
  format = STATE.audio.format,
  folder = undefined,
  filename = undefined,
}) => {
  if (!fs.existsSync(file)) {
    const found = await getWorkingFile(file);
    if (!found) return;
    file = found;
  }
  let padding = STATE.audio.padding;
  let fade = STATE.audio.fade;
  let bitrate = ["mp3", "aac", "opus"].includes(format)
    ? STATE.audio.bitrate
    : undefined;
  let quality = ["flac"].includes(format)
    ? parseInt(STATE.audio.quality)
    : undefined;
  let downmix = STATE.audio.downmix;
  const formatMap = {
    mp3: { audioCodec: "libmp3lame", soundFormat: "mp3" },
    aac: { audioCodec: "aac", soundFormat: "mp4" },
    wav: { audioCodec: "pcm_s16le", soundFormat: "wav" },
    flac: { audioCodec: "flac", soundFormat: "flac" },
    opus: { audioCodec: "libopus", soundFormat: "opus" },
  };
  const { audioCodec, soundFormat } = formatMap[format] || {};

  if (padding) {
    start = Math.max(0, start - 1);
    METADATA[file] ??= await setMetadata({ file });

    end = Math.min(METADATA[file].duration, end + 1);
  }

  return new Promise(function (resolve, reject) {
    const filters = setAudioFilters();
    if (fade && padding) {
      filters.push(
        { filter: "afade", options: `t=in:ss=${start}:d=1` },
        { filter: "afade", options: `t=out:st=${end - start - 1}:d=1` }
      );
    }

    if (Object.entries(meta).length) {
      meta = Object.entries(meta).flatMap(([k, v]) => {
        if (typeof v === "string") {
          // Escape special characters, including quotes and apostrophes
          v = v.replaceAll(" ", "_");
        }
        return ["-metadata", `${k}=${v}`];
      });
    }

    let command = setupFfmpegCommand({
      file,
      start,
      end,
      sampleRate: undefined,
      audioBitrate: bitrate,
      audioQuality: quality,
      audioCodec,
      format: soundFormat,
      channels: downmix ? 1 : -1,
      metadata: meta,
      additionalFilters: filters,
    });

    const destination = p.join(folder || tempPath, filename);
    command.save(destination);

    command.on("start", function (commandLine) {
      DEBUG && console.log("FFmpeg command: " + commandLine);
    });
    command.on("error", (err) => {
      reject(console.error("An error occurred: " + err.message));
    });
    command.on("end", function () {
      DEBUG && console.log(format + " file rendered");
      resolve(destination);
    });
  });
};

async function saveAudio(file, start, end, filename, metadata, folder) {
  filename = filename.replaceAll(":", "-");
  const convertedFilePath = await bufferToAudio({
    file,
    start,
    end,
    meta: metadata,
    folder,
    filename,
  });
  if (folder) {
    DEBUG && console.log("Audio file saved: ", convertedFilePath);
  } else {
    UI.postMessage({
      event: "audio-file-to-save",
      file: convertedFilePath,
      filename: filename,
      extension: STATE.audio.format,
    });
  }
}

// Create a flag to indicate if parseMessage is currently being executed
let isParsing = false;

// Create a queue to hold messages while parseMessage is executing
const messageQueue = [];

// Function to process the message queue
const processQueue = async () => {
  if (!isParsing && messageQueue.length > 0) {
    // Set isParsing to true to prevent concurrent executions
    isParsing = true;

    // Get the first message from the queue
    const message = messageQueue.shift();

    // Parse the message
    await parseMessage(message).catch((error) => {
      console.warn("Parse message error", error, "message was", message);
    });

    // Set isParsing to false to allow the next message to be processed
    isParsing = false;

    // Process the next message in the queue
    processQueue();
  }
};

/**
 * Spawns Web Worker threads for parallel prediction processing.
 *
 * This function creates the specified number of worker threads that load prediction models in separate modules.
 * If the model name is "birdnet", it substitutes the worker script with "BirdNet2.4". Each worker is initialized
 * with configuration details including a processing list, batch size, and various state parameters (such as backend,
 * geolocation, week, and species threshold) sourced from the global state. Message and error handlers are set up for
 * asynchronous communication and to manage worker failures.
 *
 * @param {string} model - The name of the AI model to use; for "birdnet", the "BirdNet2.4" script is used.
 * @param {Array} list - The list of data items for the workers to process.
 * @param {number} batchSize - The number of items each worker should process per batch.
 * @param {number} threads - The number of Web Worker threads to spawn.
 */
function spawnPredictWorkers(model, list, batchSize, threads) {
  // And be ready to receive the list:
  for (let i = 0; i < threads; i++) {
    const workerSrc = model === "birdnet" ? "BirdNet2.4" : model;
    const worker = new Worker(`./js/models/${workerSrc}.js`, { type: "module" });
    worker.isAvailable = true;
    worker.isReady = false;
    predictWorkers.push(worker);
    DEBUG && console.log("loading a worker");
    worker.postMessage({
      message: "load",
      model: model,
      list: list,
      batchSize: batchSize,
      backend: STATE.detect.backend,
      worker: i,
    });

    // Web worker message event handler
    worker.onmessage = (e) => {
      // Push the message to the queue
      messageQueue.push(e);
      // Process the queue
      processQueue();
    };
    worker.onerror = (e) => {
      console.warn(
        `Worker ${i} is suffering, shutting it down. THe error was:`,
        e.message
      );
      predictWorkers.splice(i, 1);
      worker.terminate();
    };
  }
}

const terminateWorkers = () => {
  predictWorkers.forEach((worker) => {
    worker.terminate(); //postMessage({message: 'terminate'})
  });
  predictWorkers = [];
};

/**
 * Performs batch insertion of audio records into the database.
 *
 * Retrieves records using a prepared statement based on the original identifier,
 * then iterates through each record to insert it individually via onInsertManualRecord.
 * The operation is performed within a mutex lock and a database transaction to
 * guarantee atomicity. A UI update is triggered after the final record is processed,
 * and debug timing information is logged if enabled.
 *
 * @param {string} cname - Identifier used for the new records.
 * @param {string} label - Label to associate with each inserted record.
 * @param {Array} files - List of files; currently reserved and not utilized by the function.
 * @param {string} originalCname - Original identifier used in the prepared statement query.
 * @returns {Promise<void>} A promise that resolves when the batch insertion completes.
 *
 * @throws {Error} Propagates any error encountered during the database transaction,
 *                 ensuring a rollback to avoid partial insertions.
 *
 * @example
 * await batchInsertRecords("newCampaign", "approved", fileList, "origCampaign");
 */
async function batchInsertRecords(cname, label, files, originalCname) {
  const db = STATE.db;
  const t0 = Date.now();
  const [sql, params] = prepResultsStatement(
    originalCname,
    true,
    STATE.included,
    undefined,
    STATE.topRankin
  );
  const records = await STATE.db.allAsync(sql, ...params);
  let count = 0;

  await dbMutex.lock();
  try {
    await db.runAsync("BEGIN");
    for (let i = 0; i < records.length; i++) {
      const item = records[i];
      const { dateTime, speciesID, fileID, position, end, comment, callCount } =
        item;
      const { name } = await STATE.db.getAsync(
        "SELECT name FROM files WHERE id = ?",
        fileID
      );
      count += await onInsertManualRecord({
        cname,
        start: position,
        end,
        comment,
        count: callCount,
        file: name,
        label,
        batch: false,
        originalCname,
        calledByBatch: true,
        updateResults: i === records.length - 1, // trigger a UI update after the last item
      });
    }
    await db.runAsync("END");
  } catch (error) {
    await db.runAsync("ROLLBACK");
    throw error;
  } finally {
    dbMutex.unlock();
  }

  DEBUG &&
    console.log(`Batch record update took ${(Date.now() - t0) / 1000} seconds`);
}

const onInsertManualRecord = async ({
  cname,
  start,
  end,
  comment,
  count,
  file,
  label,
  batch,
  originalCname,
  confidence,
  reviewed = true,
  calledByBatch
}) => {
  if (batch)
    return batchInsertRecords(cname, label, file, originalCname, confidence);
  (start = parseFloat(start)), (end = parseFloat(end));
  const startMilliseconds = Math.round(start * 1000);
  let fileID, fileStart;
  const db = STATE.db;
  const speciesFound = await db.getAsync(
    `SELECT id as speciesID FROM species WHERE cname = ?`,
    cname
  );
  let speciesID;
  if (speciesFound) {
    speciesID = speciesFound.speciesID;
  } else {
    generateAlert({
      message: "noSpecies",
      variables: { cname },
      type: "error",
    });
    return;
  }
  let res = await db.getAsync(
    `SELECT id, filestart FROM files WHERE name = ?`,
    file
  );

  if (!res) {
    // Manual records can be added off the bat, so there may be no record of the file in either db
    fileStart = METADATA[file].fileStart;
    res = await db.runAsync(
      `INSERT INTO files ( id, name, duration, filestart, locationID, archiveName, metadata ) VALUES (?,?,?,?,?,?,?)
        ON CONFLICT(name) DO UPDATE SET
        duration = EXCLUDED.duration,
        filestart = EXCLUDED.filestart,
        metadata = EXCLUDED.metadata
        `,
      fileID,
      file,
      METADATA[file].duration,
      fileStart,
      undefined,
      undefined,
      METADATA[file].metadata
    );
    fileID = res.lastID;
    await insertDurations(file, fileID)
  } else {
    fileID = res.id;
    fileStart = res.filestart;
  }

  const dateTime = fileStart + startMilliseconds;
  const isDaylight = isDuringDaylight(dateTime, STATE.lat, STATE.lon);

  // Delete an existing record if species was changed
  if (cname !== originalCname) {
    const result = await db.getAsync(
      `SELECT id as originalSpeciesID FROM species WHERE cname = ?`,
      originalCname
    );
    if (result?.originalSpeciesID) {
      await db.runAsync(
        "DELETE FROM records WHERE datetime = ? AND speciesID = ? AND fileID = ?",
        dateTime,
        result.originalSpeciesID,
        fileID
      );
      confidence ??= 2000; // Manual record
    }
  } else {
    // const r = await db.getAsync(
    //   "SELECT * FROM records WHERE dateTime = ? AND fileID = ? AND speciesID = ?",
    //   dateTime, fileID, speciesID);
    // confidence = r?.confidence || 2000; // Save confidence
    confidence ??= 2000;
  }
  const result = await db.getAsync("SELECT id FROM tags WHERE name = ?", label);
  const tagID = result?.id;
  if (calledByBatch && cname === originalCname) {
    await db.runAsync(
      `UPDATE records SET tagID = ?, comment = ?, reviewed = 1 
        WHERE dateTime = ? AND fileID = ? AND speciesID = ?`,
      tagID,
      comment,
      dateTime,
      fileID,
      speciesID
    );
  } else {
    await db.runAsync(
      `INSERT INTO records (dateTime, position, fileID, speciesID, confidence, tagID, comment, end, callCount, isDaylight, reviewed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(dateTime, fileID, speciesID) DO UPDATE SET 
          confidence = excluded.confidence, 
          tagID = excluded.tagID,
          comment = excluded.comment,
          callCount = excluded.callCount,
          reviewed = excluded.reviewed;`,
      dateTime,
      start,
      fileID,
      speciesID,
      confidence,
      tagID,
      comment,
      end,
      count,
      isDaylight,
      reviewed
    );
  }
};

const insertDurations = async (file, id) => {
  const durationSQL = Object.entries(METADATA[file].dateDuration)
    .map((entry) => `(${entry.toString()},${id})`)
    .join(",");
  const _result = await STATE.db.runAsync(
    `INSERT OR REPLACE INTO duration VALUES ${durationSQL}`
  );
};

const generateInsertQuery = async (latestResult, file) => {
  const db = STATE.db;
  let fileID;
  const meta = METADATA[file];
  await dbMutex.lock();
  try {
    await db.runAsync("BEGIN");
    let insertQuery = "INSERT OR IGNORE INTO records VALUES ";
    let res = await db.getAsync("SELECT id FROM files WHERE name = ?", file);
    if (!res) {
      let id = null;
      if (meta.metadata) {
        const metadata = JSON.parse(meta.metadata);
        const guano = metadata.guano;
        if (guano && guano["Loc Position"]) {
          const [lat, lon] = guano["Loc Position"].split(" ");
          const place = guano["Site Name"] || guano["Loc Position"];
          // Note diskDB used here
          const row = await db.getAsync(
            "SELECT id FROM locations WHERE lat = ? AND lon = ?",
            roundedFloat(lat),
            roundedFloat(lon)
          );
          if (!row) {
            const result = await db.runAsync(
              "INSERT OR IGNORE INTO locations VALUES ( ?,?,?,? )",
              undefined,
              roundedFloat(lat),
              roundedFloat(lon),
              place
            );
            id = result.lastID;
          }
        }
      }
      res = await db.runAsync(
        "INSERT OR IGNORE INTO files VALUES ( ?,?,?,?,?,?,? )",
        undefined,
        file,
        meta.duration,
        meta.fileStart,
        id,
        null,
        meta.metadata
      );
      fileID = res.lastID;
      await insertDurations(file, fileID);
    } else {
      fileID = res.id;
    }

    let [keysArray, speciesIDBatch, confidenceBatch] = latestResult;
    const minConfidence = Math.min(STATE.detect.confidence, 150); // store results with 15% confidence and up unless confidence set lower
    for (let i = 0; i < keysArray.length; i++) {
      const key = parseFloat(keysArray[i]);
      const timestamp = meta.fileStart + key * 1000;
      const isDaylight = isDuringDaylight(timestamp, STATE.lat, STATE.lon);
      const confidenceArray = confidenceBatch[i];
      const speciesIDArray = speciesIDBatch[i];
      for (let j = 0; j < confidenceArray.length; j++) {
        const confidence = Math.round(confidenceArray[j] * 1000);
        if (confidence < minConfidence) break;
        const speciesID = speciesIDArray[j];
        insertQuery += `(${timestamp}, ${key}, ${fileID}, ${speciesID}, ${confidence}, null, ${
          key + 3
        }, null, ${isDaylight}, 0, null), `;
      }
    }
    // Remove the trailing comma and space
    insertQuery = insertQuery.slice(0, -2);
    //DEBUG && console.log(insertQuery);
    // Make sure we have some values to INSERT
    if (insertQuery.endsWith(")")) {
      await db
        .runAsync(insertQuery)
        .catch((error) => console.log("Database error:", error));
    }
    await db.runAsync("END");
  } catch (error) {
    await db.runAsync("ROLLBACK");
    console.log("Transaction error:", error);
  } finally {
    dbMutex.unlock();
  }
  return fileID;
};
const parsePredictions = async (response) => {
  let file = response.file;
  AUDIO_BACKLOG--;
  const latestResult = response.result;
  if (!latestResult.length) {
    predictionsReceived[file]++;
    return response.worker;
  }
  DEBUG && console.log("worker being used:", response.worker);
  if (!STATE.selection)
    await generateInsertQuery(latestResult, file).catch((error) =>
      console.warn("Error generating insert query", error)
    );
  let [keysArray, speciesIDBatch, confidenceBatch] = latestResult;
  if (index < 500) {
    const included = await getIncludedIDs(file).catch((error) =>
      console.log("Error getting included IDs", error)
    );
    for (let i = 0; i < keysArray.length; i++) {
      let updateUI = false;
      let key = parseFloat(keysArray[i]);
      const timestamp = METADATA[file].fileStart + key * 1000;
      const confidenceArray = confidenceBatch[i];
      const speciesIDArray = speciesIDBatch[i];
      for (let j = 0; j < confidenceArray.length; j++) {
        let confidence = confidenceArray[j];
        if (confidence < 0.05) break;
        confidence *= 1000;
        let speciesID = speciesIDArray[j];
        updateUI =
          confidence >= STATE.detect.confidence &&
          (!included.length || included.includes(speciesID));
        if (STATE.selection || updateUI) {
          let end, confidenceRequired;
          if (STATE.selection) {
            const duration =
              (STATE.selection.end - STATE.selection.start) / 1000;
            end = key + duration;
            confidenceRequired = STATE.userSettingsInSelection
              ? STATE.detect.confidence
              : 50;
          } else {
            end = key + 3;
            confidenceRequired = STATE.detect.confidence;
          }
          if (confidence >= confidenceRequired) {
            const { cname, sname } = await memoryDB
              .getAsync(
                `SELECT cname, sname FROM species WHERE id = ${speciesID}`
              )
              .catch((error) =>
                console.warn("Error getting species name", error)
              );
            const result = {
              timestamp: timestamp,
              position: key,
              end: end,
              file: file,
              cname: cname,
              sname: sname,
              score: confidence,
            };
            sendResult(++index, result, false);
            //getResults()
            if (index > 499) {
              setGetSummaryQueryInterval(NUM_WORKERS);
              DEBUG &&
                console.log(
                  "Reducing summary updates to one every ",
                  STATE.incrementor
                );
            }
            // Only show the highest confidence detection, unless it's a selection analysis
            if (!STATE.selection) break;
          }
        }
      }
    }
  } else if (index++ === 5_000) {
    STATE.incrementor = 1000;
    DEBUG && console.log("Reducing summary updates to one every 1000");
  }
  predictionsReceived[file]++;
  const received = sumObjectValues(predictionsReceived);
  const total = sumObjectValues(batchChunksToSend);
  const progress = received / total;
  const fileProgress = predictionsReceived[file] / batchChunksToSend[file];
  UI.postMessage({ event: "progress", progress: progress, file: file });
  if (fileProgress === 1) {
    if (index === 0) {
      generateAlert({
        message: "noDetectionsDetailed2",
        variables: {
          file,
          list: STATE.list,
          confidence: STATE.detect.confidence / 10,
        },
      });
    }
    updateFilesBeingProcessed(response.file);
    DEBUG &&
      console.log(
        `File ${file} processed after ${
          (new Date() - predictionStart) / 1000
        } seconds: ${filesBeingProcessed.length} files to go`
      );
  }

  if (!STATE.selection && STATE.increment() === 0) {
    if (fileProgress < 1) getSummary({ interim: true });
    getTotal({ file });
  }

  return response.worker;
};

let SEEN_MODEL_READY = false;
async function parseMessage(e) {
  const response = e.data;
  switch (response["message"]) {
    case "model-ready": {
      predictWorkers[response.worker].isReady = true;
      predictWorkers[response.worker].isAvailable = true;
      if (!SEEN_MODEL_READY) {
        SEEN_MODEL_READY = true;
        sampleRate = response["sampleRate"];
        const backend = response["backend"];
        DEBUG && console.log(backend);
        UI.postMessage({
          event: "model-ready",
          message: "Give It To Me Baby. Uh-Huh Uh-Huh",
        });
      }
      break;
    }
    case "prediction": {
      if (!aborted) {
        predictWorkers[response.worker].isAvailable = true;
        let worker = await parsePredictions(response).catch((error) =>
          console.log("Error parsing predictions", error)
        );
        DEBUG &&
          console.log(
            "predictions left for",
            response.file,
            batchChunksToSend[response.file] -
              predictionsReceived[response.file]
          );
        const remaining =
          predictionsReceived[response.file] - batchChunksToSend[response.file];
        if (remaining === 0) {
          if (filesBeingProcessed.length) {
            processNextFile({ worker: worker });
          }
        }
      }
      break;
    }
    case "spectrogram": {
      onSpectrogram(
        response["filepath"],
        response["file"],
        response["width"],
        response["height"],
        response["image"],
        response["channels"]
      );
      break;
    }
  }
}

/**
 * Called when a files processing is finished
 * @param {*} file
 */
function updateFilesBeingProcessed(file) {
  // This method to determine batch complete
  const fileIndex = filesBeingProcessed.indexOf(file);
  if (fileIndex !== -1) {
    filesBeingProcessed.splice(fileIndex, 1);
    DEBUG &&
      console.log(
        "filesbeingprocessed updated length now :",
        filesBeingProcessed.length
      );
  }
  if (!filesBeingProcessed.length) {
    if (!STATE.selection) getSummary();
    // Need this here in case last file is not sent for analysis (e.g. nocmig mode)
    UI.postMessage({ event: "analysis-complete" });
  }
}

// Optional Arguments
async function processNextFile({
  start = undefined,
  end = undefined,
  worker = undefined,
} = {}) {
  if (FILE_QUEUE.length) {
    let file = FILE_QUEUE.shift();
    const found = await getWorkingFile(file).catch((error) => {
      if (error instanceof Event)
        error = `Event passed ${error.type}, attached to ${error.currentTarget}`;
      const message = error.message || error;
      if (!STATE.notFound.file) {
        STATE.notFound[file] = true;
        console.warn("Error in getWorkingFile", message);
        generateAlert({
          type: "warning",
          message: "noFile",
          variables: { error: message },
        });
      }
    });
    if (found) {
      delete STATE.notFound[file];
      if (end) {
      }
      let boundaries = [];
      if (!start)
        boundaries = await setStartEnd(file).catch((error) =>
          console.warn("Error in setStartEnd", error)
        );
      else boundaries.push({ start: start, end: end });
      for (let i = 0; i < boundaries.length; i++) {
        const { start, end } = boundaries[i];
        if (start === end) {
          // Nothing to do for this file
          updateFilesBeingProcessed(file);
          generateAlert({ message: "noNight", variables: { file } });

          DEBUG && console.log("Recursion: start = end");
          await processNextFile(arguments[0]).catch((error) =>
            console.warn("Error in processNextFile call", error)
          );
        } else {
          if (!sumObjectValues(predictionsReceived)) {
            UI.postMessage({
              event: "progress",
              text: "yes",
              file: file,
            });
          }
          await doPrediction({
            start: start,
            end: end,
            file: file,
            worker: worker,
          }).catch((error) =>
            console.warn(
              "Error in doPrediction",
              error,
              "file",
              file,
              "start",
              start,
              "end",
              end
            )
          );
        }
      }
    } else {
      DEBUG && console.log("Recursion: file not found");
      updateFilesBeingProcessed(file); // remove file from processing list
      await processNextFile(arguments[0]).catch((error) =>
        console.warn("Error in recursive processNextFile call", error)
      );
    }
  }
}

function sumObjectValues(obj) {
  let total = 0;
  for (const key in obj) {
    total += obj[key];
  }
  return total;
}

// Function to calculate the active intervals for an audio file in nocmig mode

function calculateNighttimeBoundaries(fileStart, fileEnd, latitude, longitude) {
  const activeIntervals = [];
  const maxFileOffset = (fileEnd - fileStart) / 1000;
  const dayNightBoundaries = [];

  const endTime = new Date(fileEnd);
  endTime.setHours(23, 59, 59, 999);
  for (
    let currentDay = new Date(fileStart);
    currentDay <= endTime;
    currentDay.setDate(currentDay.getDate() + 1)
  ) {
    const { dawn, dusk } = SunCalc.getTimes(currentDay, latitude, longitude);
    dayNightBoundaries.push(dawn.getTime(), dusk.getTime());
  }

  for (let i = 0; i < dayNightBoundaries.length; i++) {
    const offset = (dayNightBoundaries[i] - fileStart) / 1000;
    // negative offsets are boundaries before the file starts.
    // If the file starts during daylight, we move on
    if (offset < 0) {
      if (!isDuringDaylight(fileStart, latitude, longitude) && i > 0) {
        activeIntervals.push({ start: 0 });
      }
      continue;
    }
    // Now handle 'all daylight' files
    if (offset >= maxFileOffset) {
      if (isDuringDaylight(fileEnd, latitude, longitude)) {
        if (!activeIntervals.length) {
          activeIntervals.push({ start: 0, end: 0 });
          return activeIntervals;
        }
      }
    }
    // The list pattern is [dawn, dusk, dawn, dusk,...]
    // So every second item is a start trigger
    if (i % 2 !== 0) {
      if (offset > maxFileOffset) break;
      activeIntervals.push({ start: Math.max(offset, 0) });
      // and the others are a stop trigger
    } else {
      activeIntervals.length || activeIntervals.push({ start: 0 });
      activeIntervals[activeIntervals.length - 1].end = Math.min(
        offset,
        maxFileOffset
      );
    }
  }
  activeIntervals[activeIntervals.length - 1].end ??= maxFileOffset;
  return activeIntervals;
}

async function setStartEnd(file) {
  const meta = METADATA[file];
  let boundaries;
  //let start, end;
  if (STATE.detect.nocmig) {
    const fileEnd = meta.fileStart + meta.duration * 1000;
    // Note diskDB used here
    const result = await STATE.db.getAsync(
      "SELECT * FROM locations WHERE id = ?",
      meta.locationID
    );
    const { lat, lon } = result
      ? { lat: result.lat, lon: result.lon }
      : { lat: STATE.lat, lon: STATE.lon };
    boundaries = calculateNighttimeBoundaries(
      meta.fileStart,
      fileEnd,
      lat,
      lon
    );
  } else {
    boundaries = [{ start: 0, end: meta.duration }];
  }
  return boundaries;
}

const getSummary = async ({
  species = undefined,
  active = undefined,
  interim = false,
  action = undefined,
} = {}) => {
  const included = STATE.selection ? [] : await getIncludedIDs();
  const [sql, params] = prepSummaryStatement(included);
  const offset = species ? STATE.filteredOffset[species] : STATE.globalOffset;

  const summary = await STATE.db.allAsync(sql, ...params);
  const event = interim ? "update-summary" : "summary-complete";
  UI.postMessage({
    event: event,
    summary: summary,
    offset: offset,
    filterSpecies: species,
    active: active,
    action: action,
  });
};

/**
 *
 * @param files: files to query for detections
 * @param species: filter for SQL query
 * @param limit: the pagination limit per page
 * @param offset: is the SQL query offset to use
 * @param topRankin: return results >= to this rank for each datetime
 * @param directory: if set, will export audio of the returned results to this folder
 * @param format: whether to export audio or text
 *
 * @returns {Promise<integer> } A count of the records retrieved
 */

const getResults = async ({
  species = undefined,
  limit = STATE.limit,
  offset = undefined,
  topRankin = STATE.topRankin,
  path = undefined,
  format = undefined,
  active = undefined,
  position = undefined,
} = {}) => {
  let confidence = STATE.detect.confidence;
  const included = STATE.selection ? [] : await getIncludedIDs();
  if (position) {
    //const position = await getPosition({species: species, dateTime: select.dateTime, included: included});
    offset = (position.page - 1) * limit;
    // We want to consistently move to the next record. If results are sorted by time, this will be row + 1.
    active = position.row; //+ 1;
    // update the pagination
    await getTotal({ species: species, offset: offset, included: included });
  }
  offset =
    offset ??
    (species ? STATE.filteredOffset[species] ?? 0 : STATE.globalOffset);
  if (species) STATE.filteredOffset[species] = offset;
  else STATE.update({ globalOffset: offset });

  let index = offset;

  const [sql, params] = prepResultsStatement(
    species,
    limit === Infinity,
    included,
    offset,
    topRankin
  );

  const result = await STATE.db.allAsync(sql, ...params);

  if (["text", "eBird", "Raven"].includes(format)) {
    await exportData(result, path, format);
  } else if (format === "Audacity") {
    exportAudacity(result, path);
  } else {
    for (let i = 0; i < result.length; i++) {
      const r = result[i];
      if (format === "audio") {
        if (limit) {
          // Audio export. Format date to YYYY-MM-DD-HH-MM-ss
          const dateArray = new Date(r.timestamp).toString().split(" ");
          const dateString = dateArray
            .slice(0, 5)
            .join(" ")
            .replaceAll(":", "_");
          const filename = `${r.cname}_${dateString}.${STATE.audio.format}`;
          DEBUG &&
            console.log(
              `Exporting from ${r.file}, position ${r.position}, into folder ${path}`
            );
          saveAudio(
            r.file,
            r.position,
            r.end,
            filename,
            { Artist: "Chirpity" },
            path
          );
          i === result.length - 1 &&
            generateAlert({
              message: "goodResultSave",
              variables: { number: result.length },
            });
        }
      } else if (species && STATE.mode !== "explore") {
        // get a number for the circle
        const { count } = await STATE.db.getAsync(
          `SELECT COUNT(*) as count FROM records WHERE dateTime = ?
                AND confidence >= ? and fileID = ?`,
          r.timestamp,
          confidence,
          r.fileID
        );
        r.count = count;
        sendResult(++index, r, true);
      } else {
        sendResult(++index, r, true);
      }
      if (i === result.length - 1)
        UI.postMessage({ event: "processing-complete" });
    }
    if (!result.length) {
      if (STATE.selection) {
        // No more detections in the selection
        generateAlert({ message: "noDetections" });
      } else {
        species = species || "";
        const nocmig = STATE.detect.nocmig ? "<b>nocturnal</b>" : "";
        const archive = STATE.mode === "explore" ? "in the Archive" : "";
        generateAlert({
          message: `noDetectionsDetailed`,
          variables: { nocmig, archive, species, list: STATE.list },
        });
      }
    }
    (STATE.selection && topRankin !== STATE.topRankin) ||
      UI.postMessage({
        event: "database-results-complete",
        active,
        select: position?.start,
      });
  }
};

function exportAudacity(result, directory) {
  const { writeToPath } = require("@fast-csv/format");
  const groupedResult = result.reduce((acc, item) => {
    // Check if the file already exists as a key in acc
    const filteredItem = {
      start: item.position,
      end: item.end,
      cname: `${item.cname} ${item.score / 10}%`,
    };
    if (!acc[item.file]) {
      // If it doesn't, create an array for that file
      acc[item.file] = [];
    }
    // Push the item into the array for the matching file key
    acc[item.file].push(filteredItem);
    return acc;
  }, {});
  Object.keys(groupedResult).forEach((file) => {
    const suffix = p.extname(file);
    const filename = p.basename(file, suffix) + ".txt";
    const filePath = p.join(directory, filename);
    writeToPath(filePath, groupedResult[file], {
      headers: false,
      delimiter: "\t",
    })
      .on("error", (_err) =>
        generateAlert({
          type: "warning",
          message: "saveBlocked",
          variables: { filePath },
        })
      )
      .on("finish", () => {
        generateAlert({ message: "goodSave", variables: { filePath } });
      });
  });
}
/**
 * Exports data records to a CSV file.
 *
 * This asynchronous function processes data records in batches (up to 10,000 entries per batch), formatting each record according to the
 * specified export format ("text", "eBird", or "Raven"). In "Raven" mode, it assigns a sequential selection number and calculates cumulative file
 * offsets across entries. In "eBird" mode, it aggregates records by "Start Time", "Common name", and "Species" and sums their species counts.
 * The formatted data is then written as a CSV file using a write stream from the @fast-csv/format module, with the delimiter set to a tab for
 * "Raven" format and a comma for other formats.
 *
 * @async
 * @param {Array<Object>} result - An array of data records to be exported.
 * @param {string} filename - The output file path.
 * @param {string} format - The export format, which must be one of "text", "eBird", or "Raven".
 */
async function exportData(result, filename, format) {
  const formatFunctions = {
    text: "formatCSVValues",
    eBird: "formateBirdValues",
    Raven: "formatRavenValues",
  };
  let formattedValues = [];
  const BATCH_SIZE = 10_000;
  // For Raven
  let previousFile = null,
    cumulativeOffset = 0,
    fileDurations = {};
  const { writeToPath } = require("@fast-csv/format");
  const { ExportFormatter } = require("./js/utils/exportFormatter.js");
  const formatter = new ExportFormatter(STATE);
  const locationMap = await formatter.getAllLocations();
  // CSV export. Format the values
  for (let i = 0; i < result.length; i += BATCH_SIZE) {
    const batch = result.slice(i, i + BATCH_SIZE);
    const processedBatch = await Promise.all(
      batch.map(async (item, index) => {
        if (format === "Raven") {
          item = { ...item, selection: index + 1 }; // Add a selection number for Raven
          if (item.file !== previousFile) {
            // Positions need to be cumulative across files in Raven
            if (previousFile !== null) {
              cumulativeOffset += result.find(
                (r) => r.file === previousFile
              ).duration;
            }
            previousFile = item.file;
          }
          item.offset = cumulativeOffset;
        }
        return formatter[formatFunctions[format]](item, locationMap);
      })
    );
    formattedValues.push(...processedBatch);
  }

  if (format === "eBird") {
    // Group the data by "Start Time", "Common name", and "Species" and calculate total species count for each group
    const summary = formattedValues.reduce((acc, curr) => {
      const key = `${curr["Start Time"]}_${curr["Common name"]}_${curr["Species"]}`;
      if (!acc[key]) {
        acc[key] = {
          "Common name": curr["Common name"],
          // Include other fields from the original data
          Genus: curr["Genus"],
          Species: curr["Species"],
          "Species Count": 0,
          "Species Comments": curr["Species Comments"],
          "Location Name": curr["Location Name"],
          Latitude: curr["Latitude"],
          Longitude: curr["Longitude"],
          Date: curr["Date"],
          "Start Time": curr["Start Time"],
          "State/Province": curr["State/Province"],
          Country: curr["Country"],
          Protocol: curr["Protocol"],
          "Number of observers": curr["Number of observers"],
          Duration: curr["Duration"],
          "All observations reported?": curr["All observations reported?"],
          "Distance covered": curr["Distance covered"],
          "Area covered": curr["Area covered"],
          "Submission Comments": curr["Submission Comments"],
        };
      }
      // Increment total species count for the group
      acc[key]["Species Count"] += curr["Species Count"];
      return acc;
    }, {});
    // Convert summary object into an array of objects
    formattedValues = Object.values(summary);
  }
  const filePath = filename;
  // Create a write stream for the CSV file
  writeToPath(filePath, formattedValues, {
    headers: true,
    delimiter: format === "Raven" ? "\t" : ",",
  })
    .on("error", (_err) =>
      generateAlert({
        type: "warning",
        message: "saveBlocked",
        variables: { filePath },
      })
    )
    .on("finish", () => {
      generateAlert({ message: "goodSave", variables: { filePath } });
    });
}

const sendResult = (index, result, fromDBQuery) => {
  // Convert confidence back to % value
  result.score = (result.score / 10).toFixed(0);
  UI.postMessage({
    event: "new-result",
    file: result.file,
    result: result,
    index: index,
    isFromDB: fromDBQuery,
    selection: STATE.selection,
  });
};

const getSavedFileInfo = async (file) => {
  if (diskDB) {
    let row;
    try {
      const prefix = STATE.library.location + p.sep;
      // Get rid of archive (library) location prefix
      const archiveFile = file.replace(prefix, "");
      row = await diskDB.getAsync(
        `
          SELECT duration, filestart AS fileStart, metadata, locationID
          FROM files LEFT JOIN locations ON files.locationID = locations.id 
          WHERE name = ? OR archiveName = ?`,
        file,
        archiveFile
      );
      if (!row) {
        const baseName = file.replace(/^(.*)\..*$/g, "$1%");
        row = await diskDB.getAsync(
          "SELECT * FROM files LEFT JOIN locations ON files.locationID = locations.id WHERE name LIKE  (?)",
          baseName
        );
      }
    } catch (error) {
      console.warn(error);
    }
    return row;
  } else {
    generateAlert({ type: "error", message: "dbNotLoaded" });
    return undefined;
  }
};

/**
 *  Transfers data in memoryDB to diskDB
 * @returns {Promise<unknown>}
 */
const onSave2DiskDB = async ({ file }) => {
  const t0 = Date.now();
  if (STATE.db === diskDB) {
    generateAlert({ message: "NoOP" });
    return; // nothing to do. Also will crash if trying to update disk from disk.
  }
  const included = await getIncludedIDs(file);
  let filterClause = filtersApplied(included)
    ? `AND speciesID IN (${included})`
    : "";
  if (STATE.detect.nocmig) filterClause += " AND isDaylight = FALSE ";
  let response,
    errorOccurred = false;
  await dbMutex.lock();
  try {
    await memoryDB.runAsync("BEGIN");
    await memoryDB.runAsync(`
      INSERT OR REPLACE INTO disk.locations (id, lat, lon, place)
      SELECT id, lat, lon, place FROM locations;
    `);
    await memoryDB.runAsync(
      `INSERT OR IGNORE INTO disk.files SELECT * FROM files`
    );
    await memoryDB.runAsync(
      `INSERT OR IGNORE INTO disk.tags SELECT * FROM tags`
    );

    // Update the duration table
    response = await memoryDB.runAsync(
      "INSERT OR IGNORE INTO disk.duration SELECT * FROM duration"
    );
    DEBUG &&
      console.log(response.changes + " date durations added to disk database");
    // now update records
    response = await memoryDB.runAsync(`
            INSERT OR IGNORE INTO disk.records 
            SELECT * FROM records
            WHERE confidence >= ${STATE.detect.confidence} ${filterClause}`);
    DEBUG && console.log(response?.changes + " records added to disk database");
    await memoryDB.runAsync("END");
  } catch (error) {
    await memoryDB.runAsync("ROLLBACK");
    errorOccurred = true;
    console.log("Transaction error:", error);
  } finally {
    if (!errorOccurred) {
      if (response?.changes) {
        UI.postMessage({ event: "diskDB-has-records" });
        if (!DATASET) {
          // Now we have saved the records, set state to DiskDB
          await onChangeMode("archive");
          await getLocations({ file: file });
        }
        // Set the saved flag on files' METADATA
        Object.values(METADATA).forEach((file) => (file.isSaved = true));
      }
    }
    dbMutex.unlock();
    DEBUG && console.log("transaction ended successfully");
    const total = response.changes;
    const seconds = (Date.now() - t0) / 1000;
    generateAlert({
      message: "goodDBUpdate",
      variables: { total, seconds },
      updateFilenamePanel: true,
      database: true,
    });
  }
};

const filterLocation = () =>
  STATE.locationID ? ` AND files.locationID = ${STATE.locationID}` : "";

/**
 * getDetectedSpecies generates a list of species to use in dropdowns for chart and explore mode filters
 * It doesn't really make sense to use location specific filtering here, as there is a location filter in the
 * page. For now, I'm just going skip the included IDs filter if location mode is selected
 */
const getDetectedSpecies = () => {
  const range = STATE.explore.range;
  const confidence = STATE.detect.confidence;
  let sql = `SELECT sname || '_' || cname as label, locationID
    FROM records
    JOIN species ON species.id = records.speciesID 
    JOIN files on records.fileID = files.id`;

  if (STATE.mode === "explore") sql += ` WHERE confidence >= ${confidence}`;
  if (STATE.list !== "location" && filtersApplied(STATE.included)) {
    sql += ` AND speciesID IN (${STATE.included.join(",")})`;
  }
  if (range?.start)
    sql += ` AND datetime BETWEEN ${range.start} AND ${range.end}`;
  sql += filterLocation();
  sql += " GROUP BY cname ORDER BY cname";
  diskDB.all(sql, (err, rows) => {
    err
      ? console.log(err)
      : UI.postMessage({ event: "seen-species-list", list: rows });
  });
};

/**
 *  getValidSpecies generates a list of species included/excluded based on settings
 *  For week specific lists, we need the file
 * @returns Promise <void>
 */
const getValidSpecies = async (file) => {
  const included = await getIncludedIDs(file);
  let excludedSpecies, includedSpecies;
  let sql = `SELECT cname, sname FROM species`;
  // We'll ignore Unknown Sp. here, hence length < (LABELS.length *-1*)

  if (filtersApplied(included)) {
    sql += ` WHERE id IN (${included.join(",")})`;
  }
  sql += " GROUP BY cname ORDER BY cname";
  includedSpecies = await diskDB.allAsync(sql);

  if (filtersApplied(included)) {
    sql = sql.replace("IN", "NOT IN");
    excludedSpecies = await diskDB.allAsync(sql);
  }
  UI.postMessage({
    event: "valid-species-list",
    included: includedSpecies,
    excluded: excludedSpecies,
  });
};

const onUpdateFileStart = async (args) => {
  let file = args.file;
  const newfileMtime = new Date(
    Math.round(args.start + METADATA[file].duration * 1000)
  );

  const { utimesSync } = require("utimes");
  utimesSync(file, { atime: Date.now(), mtime: newfileMtime });

  METADATA[file].fileStart = args.start;
  delete METADATA[file].isComplete;
  let db = STATE.db;
  let row = await db.getAsync(
    "SELECT id, locationID FROM files  WHERE name = ?",
    file
  );

  if (!row) {
    DEBUG && console.log("File not found in database, adding.");
    const result = await db.runAsync(
      `INSERT INTO files (id, name, duration, filestart) values (?, ?, ?, ?) 
      ON CONFLICT(name) DO UPDATE SET 
      filestart = EXCLUDED.filestart,
      durartion = EXCLUDED.duration`,
      undefined,
      file,
      METADATA[file].duration,
      args.start
    );
    // update file metadata
    await setMetadata({ file });
    await insertDurations(file, result.lastID);
    // If no file, no records, so we're done.
  } else {
    const { id, locationID } = row;
    let { changes } = await db.runAsync(
      "UPDATE files SET filestart = ? where id = ?",
      args.start,
      id
    );
    DEBUG && console.log(changes ? `Changed ${file}` : `No changes made`);
    // update file metadata
    await setMetadata({ file });
    // Update dateDuration
    let result;
    result = await db.runAsync("DELETE FROM duration WHERE fileID = ?", id);
    console.log(result.changes, " entries deleted from duration");
    await insertDurations(file, id);
    try {
      // Begin transaction
      await db.runAsync("BEGIN TRANSACTION");

      // Create a temporary table with the same structure as the records table
      await db.runAsync(`
                CREATE TABLE temp_records AS
                SELECT * FROM records;
            `);

      // Update the temp_records table with the new filestart values
      await db.runAsync(
        "UPDATE temp_records SET dateTime = (position * 1000) + ? WHERE fileID = ?",
        args.start,
        id
      );

      // Check if temp_records exists and drop the original records table
      const tempExists = await db.getAsync(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='temp_records';`
      );

      if (tempExists) {
        // Drop the original records table
        await db.runAsync("DROP TABLE records;");
      }

      // Rename the temp_records table to replace the original records table
      await db.runAsync("ALTER TABLE temp_records RENAME TO records;");

      // Recreate the UNIQUE constraint on the new records table
      await db.runAsync(`
                CREATE UNIQUE INDEX idx_unique_record ON records (dateTime, fileID, speciesID);
            `);

      // Update the daylight flag if necessary
      let lat, lon;
      if (locationID) {
        const location = await STATE.db.getAsync(
          "SELECT lat, lon FROM locations WHERE id = ?",
          locationID
        );
        lat = location.lat;
        lon = location.lon;
      } else {
        lat = STATE.lat;
        lon = STATE.lon;
      }

      // Collect updates to be performed on each record
      const updatePromises = [];

      db.each(
        `
                SELECT rowid, dateTime, fileID, speciesID, confidence, isDaylight FROM records WHERE fileID = ${id}
            `,
        async (err, row) => {
          if (err) {
            throw err; // This will trigger rollback
          }
          const isDaylight = isDuringDaylight(row.dateTime, lat, lon) ? 1 : 0;
          // Update the isDaylight column for this record
          updatePromises.push(
            db.runAsync(
              "UPDATE records SET isDaylight = ? WHERE isDaylight != ? AND rowid = ?",
              isDaylight,
              isDaylight,
              row.rowid
            )
          );
        },
        async (err, count) => {
          if (err) {
            throw err; // This will trigger rollback
          }
          // Wait for all updates to finish
          await Promise.all(updatePromises);
          // Commit transaction once all rows are processed
          await db.runAsync("COMMIT");
          DEBUG && console.log(`File ${file} updated successfully.`);
          count && (await Promise.all([getResults(), getSummary()]));
        }
      );
    } catch (error) {
      // Rollback in case of error
      console.error(`Transaction failed: ${error.message}`);
      await db.runAsync("ROLLBACK");
    }
  }
};

async function onDelete({
  file,
  start,
  end,
  species,
  active,
  // need speciesfiltered because species triggers getSummary to highlight it
  speciesFiltered,
}) {
  const db = STATE.db;
  const { id, filestart } = await db.getAsync(
    "SELECT id, filestart from files WHERE name = ?",
    file
  );
  const datetime = filestart + parseFloat(start) * 1000;
  end = parseFloat(end);
  const params = [id, datetime, end];
  let sql = "DELETE FROM records WHERE fileID = ? AND datetime = ? AND end = ?";
  if (species) {
    sql += " AND speciesID = (SELECT id FROM species WHERE cname = ?)";
    params.push(species);
  }
  // let test = await db.allAsync('SELECT * from records WHERE speciesID = (SELECT id FROM species WHERE cname = ?)', species)
  // console.log('After insert: ',JSON.stringify(test));
  let { changes } = await db.runAsync(sql, ...params);
  if (changes) {
    if (STATE.mode !== "selection") {
      // Update the summary table
      if (speciesFiltered === false) {
        delete arguments[0].species;
      }
      await getSummary(arguments[0]);
    }
    // Update the seen species list
    if (db === diskDB) {
      getDetectedSpecies();
    } else {
      UI.postMessage({ event: "unsaved-records" });
    }
  }
}

async function onDeleteSpecies({
  species,
  // need speciesfiltered because species triggers getSummary to highlight it
  speciesFiltered,
}) {
  const db = STATE.db;
  const params = [species];
  let SQL = `DELETE FROM records 
    WHERE speciesID = (SELECT id FROM species WHERE cname = ?)`;
  if (STATE.mode === "analyse") {
    const rows = await db.allAsync(
      `SELECT id FROM files WHERE NAME IN (${prepParams(
        STATE.filesToAnalyse
      )})`,
      ...STATE.filesToAnalyse
    );
    const ids = rows.map((row) => row.id).join(",");
    SQL += ` AND fileID in (${ids})`;
  } else if (STATE.mode === "explore") {
    const { start, end } = STATE.explore.range;
    if (start) SQL += ` AND dateTime BETWEEN ${start} AND ${end}`;
  }
  let { changes } = await db.runAsync(SQL, ...params);
  if (changes) {
    if (db === diskDB) {
      // Update the seen species list
      getDetectedSpecies();
    } else {
      UI.postMessage({ event: "unsaved-records" });
    }
  }
}

async function onFileUpdated(oldName, newName) {
  const newDuration = Math.round(await getDuration(newName));
  try {
    const result = await STATE.db.runAsync(
      `UPDATE files SET name = ? WHERE name = ? AND duration BETWEEN ? - 1 and ? + 1`,
      newName,
      oldName,
      newDuration,
      newDuration
    );
    if (result.changes) {
      generateAlert({ message: "fileLocationUpdated" });
    } else {
      generateAlert({ type: "error", message: "durationMismatch" });
    }
  } catch (err) {
    if (err.code === "SQLITE_CONSTRAINT" && err.message.includes("UNIQUE")) {
      // Unique constraint violation, show specific error message
      generateAlert({ type: "warning", message: "duplicateFile" });
    } else {
      // Other types of errors
      const message = err.message;
      generateAlert({
        type: "error",
        message: "fileUpdateError",
        variables: { message },
      });
    }
  }
}

const onFileDelete = async (fileName) => {
  const result = await diskDB.runAsync(
    "DELETE FROM files WHERE name = ?",
    fileName
  );
  if (result.changes) {
    //await onChangeMode('analyse');
    getDetectedSpecies();
    generateAlert({
      message: "goodFilePurge",
      variables: { file: fileName },
      updateFilenamePanel: true,
    });
    await Promise.all([getResults(), getSummary()]);
  } else {
    generateAlert({
      message: "failedFilePurge",
      variables: { file: fileName },
    });
  }
};

const dbMutex = new Mutex();
/**
 * Update species common names in the database using provided label mappings.
 *
 * Parses an array of label strings formatted as "speciesName_commonName" and updates the corresponding
 * entries in the species table. For the "birdnet" model, a direct update query is executed; for other models,
 * existing common names are retrieved and conditionally updated based on matching parenthesized tokens.
 * All operations are executed within a single transaction to ensure atomicity. If any update fails, the
 * transaction is rolled back and the error is propagated.
 *
 * @param {object} db - A database connection object that supports asynchronous methods (runAsync, prepare, and finalize).
 * @param {Array<string>} labels - An array of label strings in the format "speciesName_commonName".
 * @returns {Promise<void>} A promise that resolves when all updates are successfully committed.
 *
 * @throws {Error} If any database operation fails during the transaction.
 *
 * @example
 * // For a 'birdnet' model, updating a species 'sparrow' to a common name 'House Sparrow'
 * await _updateSpeciesLocale(db, ["sparrow_House Sparrow"]);
 */
async function _updateSpeciesLocale(db, labels) {
  const updatePromises = [];
  await dbMutex.lock();
  const updateStmt = db.prepare("UPDATE species SET cname = ? WHERE sname = ?");
  const updateChirpityStmt = db.prepare(
    "UPDATE species SET cname = ? WHERE sname = ? AND cname LIKE ?"
  );
  const speciesSelectStmt = db.prepare(
    "SELECT cname FROM species WHERE sname = ?"
  );
  await db.runAsync("BEGIN");

  if (STATE.model === "birdnet") {
    for (const label of labels) {
      const [sname, cname] = label.trim().split("_");
      updatePromises.push(updateStmt.runAsync(cname, sname));
    }
  } else {
    for (const label of labels) {
      const [sname, newCname] = label.split("_");
      const existingCnameResult = await speciesSelectStmt.allAsync(sname);
      if (existingCnameResult.length) {
        for (const { cname: existingCname } of existingCnameResult) {
          const existingCnameMatch = existingCname.match(/\(([^)]+)\)$/);
          const newCnameMatch = newCname.match(/\(([^)]+)\)$/);
          if (newCnameMatch) {
            if (newCnameMatch[0] === existingCnameMatch[0]) {
              const callTypeMatch = "%" + newCnameMatch[0] + "%";
              updatePromises.push(
                updateChirpityStmt.runAsync(newCname, sname, callTypeMatch)
              );
            }
          } else {
            let appendedCname = newCname;
            if (existingCnameMatch) {
              const bracketedWord = existingCnameMatch[0];
              appendedCname += ` ${bracketedWord}`;
              const callTypeMatch = "%" + bracketedWord + "%";
              updatePromises.push(
                updateChirpityStmt.runAsync(appendedCname, sname, callTypeMatch)
              );
            } else {
              updatePromises.push(
                updatePromises.push(updateStmt.runAsync(appendedCname, sname))
              );
            }
          }
        }
      }
    }
  }

  try {
    await Promise.all(updatePromises);
    await db.runAsync("END");
  } catch (error) {
    console.error(`_updateSpeciesLocale Transaction failed: ${error.message}`);
    await db.runAsync("ROLLBACK");
    throw error;
  } finally {
    dbMutex.unlock();
    updateStmt.finalize();
    updateChirpityStmt.finalize();
    speciesSelectStmt.finalize();
  }
}

/**
 * Updates the application's locale by modifying state and database entries, and optionally refreshes analysis results.
 *
 * This asynchronous function updates the global state with the new locale, applies the new locale to both the
 * disk and memory databases by updating their species labels, and optionally refreshes the application's results
 * and summary if requested. It ensures that database operations are performed within a locked context for concurrency
 * safety, and performs a rollback in case of any error during the update process.
 *
 * @async
 * @param {string} locale - The new locale identifier (e.g., "en-US").
 * @param {Object} labels - An object mapping species IDs to their localized labels.
 * @param {boolean} refreshResults - Indicates whether to refresh the results and summary following the locale update.
 * @returns {Promise<void>} A promise that resolves when the locale update process is completed.
 * @throws {Error} Propagates any error encountered during the update process after rolling back the database transaction.
 */
async function onUpdateLocale(locale, labels, refreshResults) {
  if (DEBUG) t0 = Date.now();
  let db;
  try {
    STATE.update({ locale: locale });
    for (db of [diskDB, memoryDB]) {
      if (db.locale !== locale) {
        db.locale = locale;
        await _updateSpeciesLocale(db, labels);
      }
    }
    if (refreshResults) await Promise.all([getResults(), getSummary()]);
  } catch (error) {
    throw error;
  } finally {
    DEBUG &&
      console.log(`Locale update took ${(Date.now() - t0) / 1000} seconds`);
    updateSpeciesLabelLocale();
  }
}

async function updateSpeciesLabelLocale() {
  // Get labels in the new locale
  DEBUG && console.log("Getting labels from disk db");
  const included = await getIncludedIDs();
  const scope = filtersApplied(included)
    ? `WHERE id in (${included.join(",")}) `
    : "";
  const res = await diskDB.allAsync(
    `SELECT sname || '_' || cname AS labels FROM species ${scope} ORDER BY id `
  );
  const labels = res.map((obj) => obj.labels); // these are the labels in the preferred locale
  UI.postMessage({ event: "labels", labels: labels });
}

async function onSetCustomLocation({
  lat,
  lon,
  place,
  files,
  db = STATE.db,
  overwritePlaceName = true,
}) {
  if (!place) {
    // Delete the location
    const row = await db.getAsync(
      "SELECT id FROM locations WHERE lat = ? AND lon = ?",
      lat,
      lon
    );
    if (row) {
      await db.runAsync("DELETE FROM locations WHERE id = ?", row.id);
    }
  } else {
    const SQL = overwritePlaceName
      ? `INSERT INTO locations VALUES (?, ?, ?, ?)
         ON CONFLICT(lat, lon) DO UPDATE SET place = excluded.place`
      : `INSERT OR IGNORE INTO locations VALUES (?, ?, ?, ?)`;

    const result = await db.runAsync(SQL, undefined, lat, lon, place);
    const { id } = await db.getAsync(
      "SELECT ID FROM locations WHERE lat = ? AND lon = ?",
      lat,
      lon
    );

    for (const file of files) {
      const result = await db.runAsync(
        `INSERT INTO files (id, name, locationID) values (?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET locationID = EXCLUDED.locationID`,
        undefined,
        file,
        id
      );
      // we may not have set the METADATA for the file
      METADATA[file] = { ...(METADATA[file] || {}), locationID: id };
      // tell the UI the file has a location id
      UI.postMessage({ event: "file-location-id", file, id });
    }
  }
  await getLocations({ file: files[0] });
}

async function getLocations({ file, db = STATE.db }) {
  let locations = await db.allAsync("SELECT * FROM locations ORDER BY place");
  locations ??= [];
  UI.postMessage({
    event: "location-list",
    locations: locations,
    currentLocation: METADATA[file]?.locationID,
  });
}

/**
 * Retrieves a filtered list of species IDs based on the current state and file metadata.
 *
 * For "location" or "nocturnal" lists when local mode is enabled, if a file identifier is provided, the function uses
 * its metadata to extract latitude (lat), longitude (lon), and week information (derived from fileStart if STATE.useWeek is true).
 * The latitude and longitude are concatenated to form a location key. If the corresponding cache entry in STATE.included is missing,
 * setIncludedIDs is invoked to populate it. For other list types, if the cache is absent, setIncludedIDs is called without parameters.
 *
 * @async
 * @param {*} [file] - Optional key for retrieving file metadata from METADATA. Expected metadata should include properties like `fileStart`, `lat`, and `lon`.
 * @returns {Promise<number[]>} Promise resolving to an array of species IDs included in the current filtered results.
 */
async function getIncludedIDs(file) {
  let lat, lon, week;
  if (
    STATE.list === "location" ||
    (STATE.list === "nocturnal" && STATE.local)
  ) {
    if (file) {
      file = METADATA[file];
      week = STATE.useWeek ? new Date(file.fileStart).getWeekNumber() : "-1";
      lat = file.lat || STATE.lat;
      lon = file.lon || STATE.lon;
      STATE.week = week;
    } else {
      // summary context: use the week, lat & lon from the first file??
      (lat = STATE.lat), (lon = STATE.lon);
      week = STATE.useWeek ? STATE.week : "-1";
    }
    const location = lat.toString() + lon.toString();
    if (
      STATE.included?.[STATE.model]?.[STATE.list]?.[week]?.[location] ===
      undefined
    ) {
      // Cache miss
      await setIncludedIDs(lat, lon, week);
    }
    const included = STATE.included[STATE.model][STATE.list][week][location];
    return included;
  } else {
    if (STATE.included?.[STATE.model]?.[STATE.list] === undefined) {
      // The object lacks the week / location
      LIST_WORKER && (await setIncludedIDs());
    }
    return STATE.included[STATE.model][STATE.list];
  }
}
/**

 * setIncludedIDs
 * Calls list_worker for a new list, checks to see if a pending promise already exists
 * @param {*} lat
 * @param {*} lon
 * @param {*} week
 * @returns {Array.<(Number[])>}
 */

let LIST_CACHE = {};

async function setIncludedIDs(lat, lon, week) {
  const key = `${lat}-${lon}-${week}-${STATE.model}-${STATE.list}`;
  if (LIST_CACHE[key]) {
    // If a promise is in the cache, return it
    return await LIST_CACHE[key];
  }
  console.log("calling for a new list");
  // Store the promise in the cache immediately
  LIST_CACHE[key] = (async () => {
    const { result, messages } = await LIST_WORKER({
      message: "get-list",
      model: STATE.model,
      listType: STATE.list,
      customLabels: STATE.customLabels,
      lat: lat || STATE.lat,
      lon: lon || STATE.lon,
      week: week || STATE.week,
      useWeek: STATE.useWeek,
      localBirdsOnly: STATE.local,
      threshold: STATE.speciesThreshold,
    });
    // Add the index of "Unknown Sp." to all lists
    STATE.list !== "everything" && result.push(LABELS.length - 1);

    let includedObject = {};
    if (
      STATE.list === "location" ||
      (STATE.list === "nocturnal" && STATE.local)
    ) {
      const location = lat.toString() + lon.toString();
      includedObject = {
        [STATE.model]: {
          [STATE.list]: {
            [week]: {
              [location]: result,
            },
          },
        },
      };
    } else {
      includedObject = {
        [STATE.model]: {
          [STATE.list]: result,
        },
      };
    }

    if (STATE.included === undefined) STATE.included = {};
    STATE.included = merge(STATE.included, includedObject);
    messages.forEach((message) => {
      message.model = message.model.replace("chirpity", "Nocmig");
      generateAlert({
        type: "warning",
        message: "noSnameFound",
        variables: {
          sname: message.sname,
          line: message.line,
          model: message.model,
        },
      });
    });
    if (messages.length) throw new Error("Unrecognised labels in custom list");
    return STATE.included;
  })();

  // Await the promise
  return await LIST_CACHE[key];
}

///////// Database compression and archive ////

const pLimit = require("p-limit");

/**
 * Organizes and converts audio files.
 *
 * This asynchronous function verifies that the archive directory exists and is writable before proceeding.
 * It retrieves file records from the database—optionally filtering to include only those with associated detection
 * records when library clips mode is active—and computes target output directories based on each file's recording date
 * and sanitized location. For files that exist and have not already been converted, the function schedules conversion
 * tasks with a configurable concurrency limit (defaulting to 4), while generating alerts for any encountered issues.
 * Upon completion of all tasks, it updates the UI with final progress and a summary alert detailing the counts of
 * successful and failed conversions.
 *
 * 1. Pull files from db that do not have archiveName
 * 2.
 *
 * @param {number} [threadLimit=4] - Maximum number of concurrent file conversion tasks.
 * @returns {Promise<boolean|undefined>} Resolves to false if the archive directory is missing or unwritable; otherwise,
 * the promise resolves when all conversion tasks have been processed.
 */
async function convertAndOrganiseFiles(threadLimit = 4) {
  // SANITY checks: archive location exists and is writeable?
  if (!fs.existsSync(STATE.library.location)) {
    generateAlert({
      type: "error",
      message: "noArchive",
      variables: { location: STATE.library.location },
    });
    return false;
  }
  try {
    fs.accessSync(STATE.library.location, fs.constants.W_OK);
  } catch {
    generateAlert({
      type: "error",
      message: "noWriteArchive",
      variables: { location: STATE.library.location },
    });
    return false;
  }
  const limit = pLimit(threadLimit);

  const db = diskDB;
  const fileProgressMap = {};
  const conversions = []; // Array to hold the conversion promises

  // Query the files & records table to get the necessary data
  let query =
    "SELECT DISTINCT f.id, f.name, f.archiveName, f.duration, f.filestart, l.place FROM files f LEFT JOIN locations l ON f.locationID = l.id";
  // If just saving files with records
  if (STATE.library.clips) query += " INNER JOIN records r ON r.fileID = f.id";
  if (!STATE.library.backfill) query += " WHERE f.archiveName is NULL";
  t0 = Date.now();
  const rows = await db.allAsync(query);
  console.log(`db query took ${Date.now() - t0}ms`);
  const ext = "." + STATE.library.format;
  for (const row of rows) {
    row.place ??= STATE.place;
    const fileDate = new Date(row.filestart);
    const year = String(fileDate.getFullYear());
    const month = fileDate.toLocaleString("default", { month: "long" });
    const place = row.place?.replace(/[\/\\?%*:|"<>]/g, "_").trim();

    const inputFilePath = row.name;
    const outputDir = p.join(place, year, month);
    const outputFileName =
      p.basename(inputFilePath, p.extname(inputFilePath)) + ext;

    const fullPath = p.join(STATE.library.location, outputDir);
    const fullFilePath = p.join(fullPath, outputFileName);
    const dbArchiveName = p.join(outputDir, outputFileName);

    const archiveName = row.archiveName;
    if (archiveName === dbArchiveName && fs.existsSync(fullFilePath)) {
      // TODO: just check for the file, if archvive name is null, add archive name to the db (if it is complete)
      DEBUG &&
        console.log(
          `File ${inputFilePath} already converted. Skipping conversion.`
        );
      continue;
    }

    if (!fs.existsSync(fullPath)) {
      try {
        fs.mkdirSync(fullPath, { recursive: true });
      } catch (err) {
        generateAlert({
          type: "error",
          message: "mkDirFailed",
          variables: { path: fullPath, error: err.message },
        });
        continue;
      }
    }

    // Does the file we want to convert exist?
    if (!fs.existsSync(inputFilePath)) {
      generateAlert({
        type: "warning",
        variables: { file: inputFilePath },
        message: `fileToConvertNotFound`,
      });
      continue;
    }
    // Add the file conversion to the pool
    fileProgressMap[inputFilePath] = 0;
    conversions.push(
      limit(() =>
        convertFile(
          inputFilePath,
          fullFilePath,
          row,
          db,
          dbArchiveName,
          fileProgressMap
        )
      )
    );
  }

  Promise.allSettled(conversions).then((results) => {
    // Oftentimes, the final percent.progress reported is < 100. So when finished, send 100 so the progress panel can be hidden
    UI.postMessage({
      event: "conversion-progress",
      progress: { percent: 100 },
      text: "",
    });
    // Summarise the results
    let successfulConversions = 0;
    let failedConversions = 0;
    let failureReasons = [];

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        successfulConversions++;
      } else {
        failedConversions++;
        failureReasons.push(result.reason); // Collect the reason for the failure
      }
    });
    const attempted = successfulConversions + failedConversions;
    // Create a summary message
    let summaryMessage;
    let type = "info";

    if (attempted) {
      generateAlert({
        message: "conversionComplete",
        variables: {
          successTotal: successfulConversions,
          failedTotal: failedConversions,
        },
      });
      //    if (failedConversions > 0) {
      //         type = 'warning';
      //         summaryMessage += `<br>Failed conversion reasons:<br><ul>`;
      //         failureReasons.forEach(reason => {
      //             summaryMessage += `<li>${reason}</li>`;
      //         });
      //         summaryMessage += `</ul>`;
      //     }
    } else {
      generateAlert({ message: "libraryUpToDate" });
    }
  });
}

/**
 * Converts an audio file to the target archive format using FFmpeg, with optional trimming.
 *
 * The function configures FFmpeg’s encoding parameters based on global settings. When converting to "ogg", it applies
 * preset audio settings (128k bitrate, mono channel, 30000 Hz sample rate). If trimming is enabled, the function adjusts
 * the audio duration according to computed start and end boundaries and issues alerts for atypical recording lengths.
 * Progress is tracked via a provided map, and upon successful conversion, the file’s modification timestamp and
 * corresponding database record are updated.
 *
 * @param {string} inputFilePath - Path to the input audio file.
 * @param {string} fullFilePath - Destination path for the converted file.
 * @param {object} row - File metadata including properties such as `id`, `duration`, and `filestart`; the duration may be updated if trimming is applied.
 * @param {string} dbArchiveName - Archive name to record in the database.
 * @param {Object.<string, number>} fileProgressMap - Map tracking conversion progress, keyed by file paths.
 * @returns {Promise<void>} Resolves when conversion and database updates complete.
 *
 * @throws {Error} If an error occurs during the FFmpeg conversion process.
 *
 * @example
 * convertFile('/path/to/input.wav', '/path/to/output.ogg', fileRecord, db, 'archive123', progressMap)
 *   .then(() => console.log('Conversion completed successfully.'))
 *   .catch(err => console.error('Conversion failed:', err));
 */
async function convertFile(
  inputFilePath,
  fullFilePath,
  row,
  db,
  dbArchiveName,
  fileProgressMap
) {
  METADATA[inputFilePath] || (await setMetadata({ file: inputFilePath }));
  const boundaries = await setStartEnd(inputFilePath);

  return new Promise((resolve, reject) => {
    let command = ffmpeg("file:" + inputFilePath);

    if (STATE.library.format === "ogg") {
      command
        .audioBitrate("128k")
        .audioChannels(1) // Set to mono
        .audioFrequency(30_000); // Set sample rate for BirdNET
    }

    let scaleFactor = 1;
    if (STATE.library.trim) {
      if (boundaries.length > 1) {
        generateAlert({
          type: "warning",
          message: "multiDay",
          variables: { file: inputFilePath },
        });
      } else {
        const { start, end } = boundaries[0];
        if (start === end) {
          generateAlert({
            type: "warning",
            message: "allDaylight",
            variables: { file: inputFilePath },
          });
          return resolve();
        }
        command.seekInput(start).duration(end - start);
        scaleFactor = row.duration / (end - start);
        row.duration = end - start;
      }
    }
    command
      .output(fullFilePath)
      .on("start", function (commandLine) {
        DEBUG && console.log("FFmpeg command: " + commandLine);
      })
      .on("end", () => {
        const newfileMtime = new Date(
          Math.round(row.filestart + row.duration * 1000)
        );

        const { utimesSync } = require("utimes");
        utimesSync(fullFilePath, { atime: Date.now(), mtime: newfileMtime });

        db.run(
          "UPDATE files SET archiveName = ?, duration = ? WHERE id = ?",
          [dbArchiveName, row.duration, row.id],
          (err) => {
            if (err) {
              console.error("Error updating the database:", err);
            } else if (DEBUG) {
              generateAlert({
                message: "conversionDone",
                variables: { file: inputFilePath },
              });
            }
            resolve();
          }
        );
      })
      .on("error", (err) => {
        generateAlert({
          type: "error",
          message: "badConversion",
          variables: { file: inputFilePath, error: err },
        });
        reject(err);
      })
      .on("progress", (progress) => {
        if (!isNaN(progress.percent)) {
          fileProgressMap[inputFilePath] = progress.percent * scaleFactor;
          const values = Object.values(fileProgressMap);
          const sum = values.reduce(
            (accumulator, currentValue) => accumulator + currentValue,
            0
          );
          const average = sum / values.length;
          UI.postMessage({
            event: `conversion-progress`,
            progress: { percent: average },
            text: `Archive file conversion progress: ${average.toFixed(1)}%`,
          });
        }
      })
      .run();
  });
}
