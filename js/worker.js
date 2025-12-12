/**
* @file Backbone of the app. Functions to process audio, manage database interaction
 * and interact with the AI models
 */

const { ipcRenderer } = require("electron");
const fs = require("node:fs");
const p = require("node:path");
const SunCalc = require("suncalc");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path.replace(
  "app.asar",
  "app.asar.unpacked"
);
ffmpeg.setFfmpegPath(ffmpegPath);
const merge = require("lodash.merge");
import { WorkerState as State } from "./utils/state.js";
import {
  sqlite3,
  createDB,
  checkpoint,
  closeDatabase,
  Mutex,
  mergeDbIfNeeded,
  addNewModel
} from "./database.js";
import { customURLEncode, installConsoleTracking, trackEvent as _trackEvent } from "./utils/tracking.js";
import { onChartRequest }  from "./components/charts.js";
import { getAudioMetadata } from "./models/training.js";
let isWin32 = false;

const dbMutex = new Mutex();
const DATASET = false;
const DATABASE = "archive_test";
const adding_chirpity_additions = true;
const DATASET_SAVE_LOCATION =
  "C:/Users/simpo/Downloads";
let ntsuspend;
if (process.platform === "win32") {
  ntsuspend = require("ntsuspend");
  isWin32 = true;
}

let DEBUG;
let SEEN_MODEL_READY = false;
let METADATA = {};
let index = 0,
  predictionStart;
let sampleRate; // Should really make this a property of the model
let predictWorkers = [],
  aborted = false;
let UI;
let FILE_QUEUE = [];
let INITIALISED = null;
const EPSILON = 0.025;
let t0_analysis = 0;
const generateAlert = ({
  message,
  type,
  autohide,
  variables,
  file,
  updateFilenamePanel,
  complete,
  history,
  model
}) => {
  UI.postMessage({
    event: "generate-alert",
    type: type || "info",
    message,
    autohide,
    variables,
    file,
    updateFilenamePanel,
    complete,
    history,
    model
  });
};

// Is this CI / playwright? Disable tracking
const isTestEnv = process.env.TEST_ENV;
isTestEnv || installConsoleTracking(() => STATE.UUID, "Worker");
const trackEvent = isTestEnv ? () => {} : _trackEvent;
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
    "Unhandled Worker PR",
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
    "Handled Worker PR",
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


let predictionsRequested = {},
  predictionsReceived = {},
  filesBeingProcessed = [];
let diskDB, memoryDB;

let t0; // Application profiler

const setupFfmpegCommand = async ({
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
  // todo: consider whether to exponse bat model training
  const training = false
  if (STATE.model.includes('bats')) { 
    // No sample rate is supplied when exporting audio.
    // If the sampleRate is 256k, Wavesurfer will handle the tempo/pitch conversion
    if ((training || sampleRate) && sampleRate !== 256000) {
      const {bitrate} = await getAudioMetadata(file);
      const MIN_EXPECTED_BITRATE = 96000; // Lower bitrates aren't capturing ultrasonic frequencies
      if (bitrate < MIN_EXPECTED_BITRATE) console.warn(file, 'has bitrate', bitrate)
      const rate = Math.floor(bitrate/10)
      command.audioFilters([`asetrate=${rate}`]);
    }
    // if (training && !sampleRate){
    //   // We'll export dilated so we need to reset the duration:needs testing
    //   end = (end - start) / 10 + start;
    // }
  } 
  let duration = end - start;
  if (training) duration *= 10 // Dilate 10x for bat training
  
  additionalFilters.forEach(filter => command.audioFilters(filter))
    
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

  sampleRate && command.audioFilters([`aresample=${sampleRate}`]);
  // Set codec if provided
  if (audioCodec) command.audioCodec(audioCodec);

  // Set bitRate if provided
  if (audioBitrate) command.audioBitrate(audioBitrate);

  // Add any additional output options
  if (outputOptions.length) command.addOutputOptions(...outputOptions);

  command.seekInput(start).duration(duration);
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
 * Load and initialize the application's SQLite archive database and prepare species mappings for the current model.
 *
 * @param {string} [modelPath] - Path to the active model folder; if provided, its `labels.txt` is used to align database labels.
 * @returns {sqlite3.Database} The initialized archive database instance.
 */
async function loadDB(modelPath) {
  const path = STATE.database.location || appPath;
  DEBUG && console.log("Loading db " + path);
  const model = STATE.model;
  let modelID, needsTranslation;
  const file = p.join(path, `archive.sqlite`);
  if (!fs.existsSync(file)) {
    DEBUG && console.log("No db file: ", file);
    try {
        diskDB = await createDB({file, dbMutex});
    } catch (error) {
      console.error("Error creating database:", error);
      generateAlert({
        type: "error",
        message: `Database creation failed: ${error.message}`
      });
      throw error;
    }
    DEBUG && console.log("DB created at : ", file);
    STATE.modelID = modelID;
  } else {
    diskDB = new sqlite3.Database(file);
    DEBUG && console.log("Opened and cleaned disk db " + file);
  }
  const labelsFile = 'labels.txt';
  const labelsLocation = modelPath ? p.join(modelPath, labelsFile) : null;
  ([modelID, needsTranslation] = await mergeDbIfNeeded({diskDB, model, appPath, dbMutex, labelsLocation }) )
  checkNewModel(modelID) && (STATE.modelID = modelID);
  STATE.update({ db: diskDB });
  diskDB.locale = STATE.locale;
  await diskDB.runAsync("VACUUM");
  await diskDB.runAsync("CREATE INDEX IF NOT EXISTS idx_records_modelID ON records(modelID)");
  await diskDB.runAsync("CREATE INDEX IF NOT EXISTS idx_species_modelID ON species(modelID)");
  await diskDB.runAsync("PRAGMA foreign_keys = ON");
  await diskDB.runAsync("PRAGMA journal_mode = WAL");
  await diskDB.runAsync("PRAGMA busy_timeout = 5000");
  if (needsTranslation){
    UI.postMessage({ event: "label-translation-needed", locale: STATE.locale });
  } else {
    await setLabelState({regenerate:true})
  }

  // Set mapping from model IDs to db species ids
  const speciesResults = await diskDB.allAsync(
    "SELECT id, classIndex, modelID FROM species ORDER BY id"
  );
  // Populate speciesMap for each model
  speciesResults.forEach(({ modelID, classIndex, id }) => {
    if (!STATE.speciesMap.has(modelID)) {
      STATE.speciesMap.set(modelID, new Map());
    }
    STATE.speciesMap.get(modelID).set(classIndex, id);
  });

  const row = await diskDB.getAsync(
    "SELECT 1 FROM records LIMIT 1"
  );
  if (row) {
    UI.postMessage({ event: "diskDB-has-records" });
  }
  return diskDB;
}

const getSplitChar = () => STATE.model.includes('perch') ? '~' : '_';
/**
 * Updates the application's species label list based on current inclusion filters.
 *
 * Retrieves all species labels from the database and caches them if regeneration is requested or labels are not yet loaded. Filters the labels according to the current inclusion list and sends the filtered labels to the UI.
 *
 * @param {Object} options
 * @param {boolean} options.regenerate - If true, forces reloading of labels from the database.
 */
async function setLabelState({ regenerate }) {
  if (regenerate || !STATE.allLabelsMap) {
    DEBUG && console.log("Getting labels from disk db");
    const splitChar = getSplitChar();
    const res = await diskDB.allAsync(
      `SELECT classIndex + 1 as id, sname || '${splitChar}' || cname AS labels, modelID 
      FROM species WHERE modelID = ? ORDER BY id`, STATE.modelID
    );

    // Map from species ID to label
    STATE.allLabelsMap = new Map(res.map(obj => [obj.id, obj.labels]));

    // Also keep a flat list of all labels (optional, if still useful for 'everything')
    STATE.allLabels = res.map(obj => obj.labels);
  }

  const included = await getIncludedIDs(); // assumes array of species.id values

  STATE.filteredLabels = STATE.list === 'everything'
    ? STATE.allLabels
    : included.map(id => STATE.allLabelsMap.get(id)).filter(Boolean);

  UI.postMessage({ event: "labels", labels: STATE.filteredLabels });
}


/**
 * Dispatches incoming worker messages to perform audio processing, model control, database operations, and UI communication.
 *
 * Waits for initialization before handling non-initial messages and delegates action-specific work (for example: initialization, analysis, model loading, file I/O, dataset import/export, tag/location management, and state updates) to the appropriate internal handlers.
 *
 * @param {Object} e - Message event whose `data` contains an `action` string and action-specific parameters.
 * @returns {Promise<void>} Resolves when the requested action has been handled.
 */
async function handleMessage(e) {
  const args = e.data;
  const action = args.action;
  DEBUG && console.log("message received", action);
  if (action !== "_init_" ) {
    // Wait until _init_ or onLaunch completes before processing other messages
    await INITIALISED;
  }
  switch (action) {
    case "_init_": {
      let { model, batchSize, threads, backend, list, modelPath } = args;
      const t0 = Date.now();
      STATE.detect.backend = backend;
      INITIALISED = (async () => {
        LIST_WORKER = await spawnListWorker(); // this can change the backend if tfjs-node isn't available
        DEBUG && console.log("List worker took", Date.now() - t0, "ms to load");
        await onLaunch({
          model,
          batchSize,
          threads,
          backend,
          list,
          modelPath
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
      onAbort({});
      break;
    }
    case "change-threads": {
      // if (STATE.model.includes('perch')) break; // perch v2 only works with 1 thread
      const delta = args.threads - predictWorkers.length;
      NUM_WORKERS += delta;
      if (delta > 0) {
        spawnPredictWorkers(STATE.model, BATCH_SIZE, delta);
      } else {
        for (let i = delta; i < 0; i++) {
          const worker = predictWorkers.pop();
          worker.terminate();
        }
      }
      break;
    }
    case "change-mode": {
      const mode = args.mode;
      INITIALISED = await onChangeMode(mode);
      break;
    }
    case "chart": {

      Object.assign(args, { diskDB, state: STATE, UI });
      await onChartRequest(args);
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
    case "delete-confidence": {
      await onDeleteConfidence(args);
      break;
    }
    case "delete-species": {
      await onDeleteSpecies(args);
      break;
    }
    case "export-results": {
      args.format === 'summary'
      ? await getSummary(args) 
      : await getResults(args);
      break;
    }
    case "import-results": {
      const {importData} = require('./js/utils/importer.js');
      const {file, format} = args;
      const { lat, lon, place } = STATE;
      const defaultLocation = { defaultLat:lat, defaultLon:lon, defaultPlace:place };
      const result = await importData({db:memoryDB, file, format, defaultLocation, METADATA, setMetadata, UI })
        .catch(error => {
          const {message, variables} = error;
          generateAlert({message, type: 'error', variables})
          
        })
      if (result) {
        const {files, meta} = result;
        METADATA = meta;
        STATE.filesToAnalyse = await getFiles({files, preserveResults:true, checkSaved: false});
        await Promise.all([getResults(), getSummary(), getTotal()])
      }
      UI.postMessage({ event: "clear-loading"})
      break;
    }
    case "file-load-request": {
      STATE.corruptFiles = [];
      const {preserveResults, file, model} = args;
      index = 0;
      filesBeingProcessed.length && onAbort({model});
      DEBUG && console.log("Worker received audio " + file);
      await loadAudioFile(args).catch((_e) =>
        console.warn("Error opening file:", file)
      );
      if (!preserveResults) {
        // Clear records from the memory db
        await memoryDB.runAsync("DELETE FROM records; VACUUM");
        const mode = METADATA[file]?.isSaved ? "archive" : "analyse";
        await onChangeMode(mode);
      }
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
      getLocations(args);
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
        if (tag?.name) {
          const query = await STATE.db.runAsync(
            `INSERT INTO tags (id, name) VALUES (?, ?)
            ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
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
      await getFiles({files: args.files});
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
      if (STATE.model === 'perch v2') {
        STATE.backend = args.backend;
        predictWorkers[0].postMessage({ message: "terminate", backend: args.backend });
      } else {
        if (filesBeingProcessed.length) {
          onAbort(args);
        } else {
          predictWorkers.length && terminateWorkers();
        }
      }
      INITIALISED = onLaunch(args);
      break;
    }
    case "expunge-model": {
      onDeleteModel(args.model)
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
      STATE.library.auto && convertAndOrganiseFiles();
      break;
    }
    case "set-custom-file-location": {
      onSetCustomLocation(args);
      break;
    }
    case "train-model":{
      const worker = predictWorkers[0];
      worker.postMessage({ message: "train-model", ...args });
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
      LIST_CACHE = {};
      STATE.included = {}
      await INITIALISED;
      await setLabelState({regenerate:true});
      LIST_WORKER && (await getIncludedIDs());
      
      args.refreshResults && (await Promise.all([getResults(), getSummary(), getTotal()]));
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
        for (const key in STATE.included) {
          if (STATE.included[key]?.location) {
            STATE.included[key].location = {};
          }
        }
      }
      // likewise, if we change the "use local birds" setting we need to flush the migrants cache"
      if (args.local !== undefined) {
        for (const key in STATE.included) {
          if (STATE.included[key]?.nocturnal) {
            delete STATE.included[key].nocturnal;
          }
        }
      }
      STATE.update(args);
      // Call new db functions when not initial state update (where UUID is sent)
      if (args.database && !args.UUID) {
        // load a new database
        diskDB = await loadDB(STATE.modelPath)
        // Create a fresh memoryDB to attach to it
        memoryDB = await createDB({file: null, diskDB, dbMutex})
      }
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
    const batchSize = 10_000;
    let totalFilesChecked = 0;
    fileList = fileList.map(f => (METADATA[f]?.name || f));
    for (let i = 0; i < fileList.length; i += batchSize) {
      const fileSlice = fileList.slice(i, i + batchSize);
      let query; const library = STATE.library.location + p.sep;
      const newList = fileSlice.map(file => file.replace(library, ''));
      // detect if any changes were made
      const libraryFiles = newList.filter((item, i) => item !== fileSlice[i]);
      const params = prepParams(newList);
      let countResult;
      if (libraryFiles.length) {
        const archiveParams = prepParams(libraryFiles);
        query = `SELECT COUNT(*) AS count FROM files WHERE name IN (${params}) or archiveName IN (${archiveParams})`;
        countResult = await diskDB.getAsync(query, ...fileSlice, ...libraryFiles);
      } else {
        query = `SELECT COUNT(*) AS count FROM files WHERE name IN (${params})`;
        countResult = await diskDB.getAsync(query, ...fileSlice);
      }

      // Execute the query with the slice as parameters
      
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
    if (allSaved) {
      await onChangeMode("archive");
      if (STATE.detect.autoLoad){
        STATE.filesToAnalyse = fileList;
        STATE.originalFiles = fileList
        await Promise.all([getResults(), getSummary(), getTotal()]);
      }
    }
  } else {
    generateAlert({ type: "error", message: "dbNotLoaded" });
  }
}

function setGetSummaryQueryInterval(threads) {
  STATE.incrementor =
    STATE.detect.backend !== "tensorflow" ? threads * 10 : threads;
}

/**
 * Switches the application to a new operational mode, initializing the in-memory database if needed and notifying the UI.
 *
 * If the mode is different from the current state, this function ensures the memory database is available, updates the application state to reflect the new mode, and posts a "mode-changed" event to the UI.
 *
 * @param {string} mode - The new mode to activate.
 */
async function onChangeMode(mode) {
  if (!memoryDB){
    memoryDB = await createDB({file: null, diskDB, dbMutex});
  }
  STATE.changeMode({
    mode: mode,
    disk: diskDB,
    memory: memoryDB,
  });
  UI.postMessage({ event: "mode-changed", mode: mode });
}

const filtersApplied = (list) => {
  return STATE.list !== 'everything';
};

/**
 * Prepare and initialize the app for a detection model: load/create databases, set runtime sample rate and backend, update global STATE, refresh labels, and start prediction workers.
 *
 * @param {Object} options - Launch configuration.
 * @param {string} [options.model="chirpity"] - Model identifier to use.
 * @param {number} [options.batchSize=32] - Number of audio samples per prediction batch.
 * @param {number} [options.threads=1] - Number of prediction worker threads to spawn.
 * @param {string} [options.backend="tensorflow"] - Detection backend to use.
 * @param {string} [options.modelPath] - Filesystem path containing model artifacts and label definitions; used when adding or validating a model.

async function onLaunch({
  model = "chirpity",
  batchSize = 32,
  threads = 1,
  backend = "tensorflow",
  modelPath,
}) {
  SEEN_MODEL_READY = false;
  LIST_CACHE = {};
  const sampleRates = {
    chirpity: 24_000,
    nocmig: 24_000,
    'perch v2': 32_000,
  };
  let perch = model === 'perch v2';
  // Check correct perch model being used
  if (perch && ! fs.existsSync(p.join(modelPath, 'perch_v2.onnx'))) {
    let message = `<b>'perch_v2.onnx'</b> was not found in ${modelPath}. `;
    if (fs.existsSync(p.join(modelPath, '_internal'))){
      message += 'The version of Perch you have is not compatible with this version of Chirpity. '
    } 
    message += `You can download a working version from the <a href="https://chirpity.mattkirkland.co.uk#classifiers" target='_blank'>website</a>.
    For now, the BirdNET model will be loaded instead.`
    model = 'birdnet'; perch = false; modelPath = null;
    generateAlert({message, type:'error'})
  }
  WINDOW_SIZE = perch ? 5 : 3;
  // threads = perch ? 1 : threads;

  sampleRate = sampleRates[model] || 48_000;
  STATE.detect.backend = backend;
  BATCH_SIZE = batchSize;
  STATE.update({ model, modelPath });
  const result = await diskDB?.getAsync('SELECT id FROM models WHERE NAME = ?', model)
  if (!result){
    // The model isn't in the db
    diskDB = await loadDB(modelPath); // load the diskdb with the model species added
  } else {
    STATE.modelID = result.id;
  }
  const {combine, merge} = STATE.detect;
  if (!memoryDB || !(combine || merge)){
    memoryDB = await createDB({file: null, diskDB, dbMutex}); // create new memoryDB
  } else if (!result){
    const labelsLocation = modelPath ? p.join(modelPath, 'labels.txt') : null;
    addNewModel({model, db:memoryDB, dbMutex, labelsLocation}).then(modelID => {
      checkNewModel(modelID)
    });
  }
  const db = STATE.mode === 'analyse'
    ? memoryDB
    : diskDB;
  STATE.update({ db });
  NUM_WORKERS = perch ? 1 : threads;
  spawnPredictWorkers(model, batchSize, threads);
}

/**
 * Validate a model load result and emit an error alert if loading failed.
 *
 * If `modelID` is not an integer, posts an error alert (with a specific message when
 * `modelID.code === "SQLITE_CONSTRAINT"`) and logs the message to the console.
 *
 * @param {number|Object} modelID - The model identifier on success, or an error-like object on failure.
 */
function checkNewModel(modelID){
  if (!Number.isInteger(modelID) ) {
    let message;
    if (modelID.code === "SQLITE_CONSTRAINT"){
      message = 'Model addition failed: There are duplicate species in the label file.';
    } else {
      message = `Cannot load model: ${modelID.message}.`;
    }
    message += ' <b>Remove the model to prevent further errors</b>.';
    // Show an error alert        
    generateAlert({
      type: "error",
      message
    });
    console.error(message);
    return false
  }
  return true
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
const getFiles = async ({files, image, preserveResults, checkSaved = true}) => {
  const supportedFiles = image ? [".png"] : SUPPORTED_FILES;
  let folderDropped = false;
  let filePaths = [];

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
        filePaths.push(...dirFiles);
      } else if (
        !p.basename(path).startsWith(".") &&
        supportedFiles.some((ext) => path.toLowerCase().endsWith(ext))
      ) {
        filePaths.push(path);
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
  trackEvent(STATE.UUID, "UI", "Drop", fileOrFolder, filePaths.length);
  UI.postMessage({ event: "files", filePaths, preserveResults, checkSaved });
  // Start gathering metadata for new files
  STATE.totalDuration = 0;
  STATE.allFilesDuration = 0;
  await processFilesInBatches(filePaths, 10, checkSaved);
  return filePaths;
};

async function processFilesInBatches(filePaths, batchSize = 20, checkSaved = true) {
  for (let i = 0; i < filePaths.length; i += batchSize) {
    const batch = filePaths.slice(i, i + batchSize);

    // Run the batch in parallel
    const results = await Promise.all(
      batch.map(file =>
        setMetadata({ file }).then(fileMetadata => {
          const duration = fileMetadata.duration || 0;
          STATE.allFilesDuration += duration;
          STATE.totalDuration += Math.ceil(duration / (BATCH_SIZE * WINDOW_SIZE)) * (BATCH_SIZE * WINDOW_SIZE);
          return fileMetadata;
        }).catch ((error) => {
          console.error(`Error processing file ${file}:`, error);
          return null; // or handle the error as needed
        }
      ))
    );
    DEBUG && console.log(`Processed ${i + results.length} of ${filePaths.length}`);

  }
  if (checkSaved) savedFileCheck(filePaths);
  DEBUG && console.log('All files processed');
}

const getFilesInDirectory = async (dir) => {
  const files = [];
  const stack = [dir];
  const { readdir } = require("node:fs/promises");
  while (stack.length) {
    const currentDir = stack.pop();
    let dirents;
    try {
      dirents = await readdir(currentDir, { withFileTypes: true });
    } catch (err) {
      if (err.code === "EPERM" || err.code === "EACCES") {
        console.warn(`Skipping unreadable folder due to permissions: ${currentDir}`);
        continue; // skip this folder and move on
      } else {
        throw err; // rethrow other errors
      }
    }    
    for (const dirent of dirents) {
      const path = p.join(currentDir, dirent.name);
      if (dirent.isDirectory()) {
        stack.push(path);
      } else {
        const filename = p.basename(path);
        filename.startsWith(".") || files.push(path);
      }
    }
  }
  return files;
};

const prepParams = (list) => "?".repeat(list.length).split("").join(",");

/**
 * Constructs an SQL filter clause and parameter list for file record queries based on date range and application mode.
 *
 * If a date range is provided, filters records by `dateTime` between the specified start (inclusive) and end (exclusive) values.
 * In "archive" mode, filters records where the file name or archive name matches entries in the current analysis file list, adjusting paths as needed.
 * In "analyse" mode, filters by file name if applicable.
 *
 * @param {Object} [range] - Optional date range for filtering.
 * @param {(number|string)} range.start - Inclusive start of the date range.
 * @param {(number|string)} range.end - Exclusive end of the date range.
 * @returns {[string, any[]]} An array containing the SQL condition string and its associated parameter values.
 */
function getFileSQLAndParams(range) {
  const params = [];
  let SQL = "";
  if (range?.start) {
    // Prioritise range queries
    SQL += " AND dateTime >= ? AND dateTime < ? ";
    params.push(range.start, range.end);
  } else {
    const fileParams = prepParams(STATE.filesToAnalyse);
    SQL += ` AND ( file IN  (${fileParams}) `;
    STATE.originalFiles ??= STATE.filesToAnalyse.map((item) => (METADATA[item]?.name || item));
    params.push(...STATE.originalFiles);
    SQL += ` OR archiveName IN  (${fileParams}) ) `;
    const archivePath = STATE.library.location + p.sep;
    const archive_names = STATE.filesToAnalyse.map((item) => item.replace(archivePath, ""));
    params.push(...archive_names);
  }
  return [SQL, params];
}
/**
 * Compute indices between 1 and fullRange (inclusive) that are not present in the sorted `included` list.
 *
 * @param {number[]} included - Sorted array of indices to include.
 * @param {number} [fullRange=STATE.allLabels.length] - Maximum index to check (inclusive).
 * @returns {number[]} Array of indices between 1 and `fullRange` (inclusive) that are not in `included`.
 */
function getExcluded(included, fullRange = STATE.allLabels.length) {
  const missing = [];
  let currentIndex = 0;

  for (let i = 1; i <= fullRange; i++) {
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


/**
 * Convert an array of CNAMES into objects containing the original name, the base name with any trailing parenthesized suffix removed, and a flag indicating presence of that suffix.
 * @param {string[]} cnames - Array of names which may include a trailing parenthesized suffix (e.g., "Species (call)").
 * @returns {{full: string, base: string, hasSuffix: boolean}[]} Array of objects each with `full` (original cname), `base` (trimmed name without a trailing parenthesized suffix), and `hasSuffix` (`true` if a parenthesized suffix was present).
 */
function parseCnames(cnames) {
  return cnames.map(cname => {
    const match = cname.match(/^(.*?)(\s*\(.*\)|-)?$/);
    return {
      full: cname,
      base: match[1].trim(),
      suffix: match[2]
    };
  });
}


/**
 * Map a list of CNAMES (possibly containing suffixes) to species IDs for the current model.
 * @param {string[]} cnames - Array of CNAMES; elements may include suffixes such as " (call)" or " (fc)".
 * @returns {number[]} Array of matching species IDs for STATE.modelID, empty if no matches.
 */
async function getMatchingIds(cnames) {
  const parsed = parseCnames(cnames);

  // Collect all possible cname values
  const nameSet = new Set();
  for (const { full, base, suffix } of parsed) {
    nameSet.add(full);
    if (suffix && suffix !== "-") nameSet.add(base);
  }

  const names = [...nameSet];
  if (names.length === 0) return [];

  // Chunk if too many parameters (SQLite has a 999 parameter limit)
  const chunkSize = 999;
  const results = [];

  for (let i = 0; i < names.length; i += chunkSize) {
    const chunk = names.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => "?").join(",");
    const sql = `
      SELECT id FROM species
      WHERE modelID = ?
        AND cname IN (${placeholders})
    `;
    const rows = await STATE.db.allAsync(sql, STATE.modelID, ...chunk);
    results.push(...rows.map(r => r.id));
  }

  return results;
}

/**
 * Produce an SQL fragment that restricts species rows according to the current STATE.list selection.
 *
 * For list "everything" returns an empty string. For other lists it resolves the set of included species
 * IDs (handling the special "birds"/"Animalia" exclusion case and CNAMES with suffixes) and returns an
 * SQL snippet that filters s.id to that set.
 *
 * @returns {string} An SQL fragment restricting species by id (for example ` AND s.id IN (1,2) `), or an empty string when no filtering is required.
 */
async function getSpeciesSQLAsync(){
  let not = "", SQL = "";
  const {list, allLabels} = STATE;
  if (list !== 'everything') {
    let included = await getIncludedIDs();
    if (["birds", 'Animalia'].includes(list)) {
      included = getExcluded(included);
      if (!included.length) return SQL; // nothing filtered out
      not = "NOT";
    }
    // Get the speciesID for all models
    const result = await STATE.db.allAsync(`SELECT cname FROM species WHERE classIndex + 1 IN (${included}) AND modelID = ${STATE.modelID}`);
    const cnames = result.map(row => row.cname);
    included = cnames.length ? await getMatchingIds(cnames) : [-1];
    DEBUG &&
      console.log("included", included.length, "# labels", allLabels.length);
    SQL = ` AND s.id ${not} IN (${included}) `;
  }
  return SQL
}

/**
 * Augments an SQL statement with application-specific qualifiers (file/time range, label filters, species constraints, nocmig/daylight exclusion, and location) derived from current STATE and the supplied range/caller context.
 * @param {string} stmt - SQL fragment to append qualifiers to (for example a WHERE clause or CTE qualifier).
 * @param {{start?: number, end?: number}|undefined} range - Optional file/time range to restrict results; if undefined and STATE.mode is "explore", the explore range is used.
 * @param {string} [caller] - Caller context that can alter behavior (when 'results', the file is restricted to the active file queue entry).
 * @returns {[string, Array]} A tuple where the first element is the augmented SQL string and the second is an array of parameter values. The parameters array begins with the detection confidence threshold from STATE and includes any additional values required by the appended qualifiers.
 */
async function addQueryQualifiers(stmt, range, caller) {
  const {mode, explore, labelFilters, detect, locationID, selection} = STATE;
  let params = [detect.confidence];
  range ??= mode === "explore" ? explore.range : undefined;
  if (mode === 'archive' || range?.start){
    const [SQLtext, fileParams] = getFileSQLAndParams(range);
    (stmt += SQLtext), params.push(...fileParams);
  }
  if (labelFilters.length) {
    stmt += ` AND tagID in (${prepParams(labelFilters)}) `;
    params.push(...labelFilters);
  }
  if (selection && caller === 'results') {
    stmt += ` AND file = ? `;
    params.push(FILE_QUEUE[0]);
  } else {
    stmt += await getSpeciesSQLAsync()
  }
  if (detect.nocmig) stmt += " AND COALESCE(isDaylight, 0) != 1 ";
  if (locationID !== undefined) {
    stmt += locationID === 0 ? " AND locationID IS NULL " : " AND locationID = ? ";
    locationID !== 0 && params.push(locationID);
  }
  return [stmt, params];
}

const prepSummaryStatement = async () => {
  const { detect, summarySortOrder} = STATE;
  const topRankin = detect.topRankin;
  // const range = mode === "explore" ? explore.range : undefined;
  // let params = [detect.confidence];
  const partition = detect.merge ? '' : ', r.modelID';
  let summaryStatement = `
    WITH ranked_records AS (
        SELECT r.dateTime, r.confidence, f.name as file, f.archiveName, cname, sname, classIndex, COALESCE(callCount, 1) as callCount, isDaylight, tagID,
        RANK() OVER (PARTITION BY fileID${partition}, dateTime ORDER BY r.confidence DESC) AS rank
        FROM records r
        JOIN files f ON f.id = r.fileID
        JOIN species s ON s.id = r.speciesID
        WHERE confidence >=  ? `;

  let [stmt, params] = await addQueryQualifiers(summaryStatement);
  summaryStatement = stmt;
  summaryStatement += `
    )
    SELECT cname, sname, COUNT(cname) as count, SUM(callcount) as calls, MAX(ranked_records.confidence) as max
    FROM ranked_records
    WHERE ranked_records.rank <= ${topRankin}
    GROUP BY cname ORDER BY ${summarySortOrder}`;

  return {sql: summaryStatement, params};
};

const getTotal = async ({
  species = undefined,
  offset = undefined,
} = {}) => {
  
  const {db, mode, explore, filteredOffset, globalOffset, detect} = STATE;
  const topRankin = detect.topRankin;
  const range = mode === "explore" ? explore.range : undefined;
  const partition = detect.merge ? '' : ', r.modelID';
  offset ?? (species !== undefined ? filteredOffset[species] : globalOffset);

  let SQL = ` WITH MaxConfidencePerDateTime AS (
        SELECT confidence,
        speciesID, classIndex, f.name as file, tagID,
        RANK() OVER (PARTITION BY fileID${partition}, dateTime ORDER BY r.confidence DESC) AS rank
        FROM records r
        JOIN species s ON r.speciesID = s.id
        JOIN files f ON r.fileID = f.id 
        WHERE confidence >= ? `;

  let [stmt, params] = await addQueryQualifiers(SQL, range, 'results');
  SQL = stmt;
  SQL += " ) ";
  SQL += `SELECT COUNT(confidence) AS total FROM MaxConfidencePerDateTime WHERE rank <= ${topRankin}`;

  if (species) {
    params.push(species);
    SQL += " AND speciesID IN (SELECT id from species WHERE cname = ?) ";
  }
  const { total } = await db.getAsync(SQL, ...params);
  UI.postMessage({
    event: "total-records",
    total: total,
    offset: offset,
    species: species,
  });
};

const prepResultsStatement = async (
  species,
  noLimit,
  offset,
  topRankin,
  format
) => {
  const {mode, explore, limit, resultsMetaSortOrder, resultsSortOrder, detect, selection} = STATE;
  const partition = detect.merge ? '' : ', r.modelID'; 
  let resultStatement = `
    WITH ranked_records AS (
        SELECT 
        r.dateTime, 
        f.duration, 
        f.filestart, 
        fileID,
        f.name as file,
        f.archiveName,
        f.locationID,
        r.position, 
        r.speciesID,
        models.name as modelName,
        models.id as modelID,
        s.sname,
        s.cname,
        s.classIndex,
        r.confidence as score, 
        tagID,
        tags.name as label, 
        r.comment, 
        r.end,
        r.callCount,
        r.isDaylight,
        r.reviewed,
        RANK() OVER (PARTITION BY fileID${partition}, dateTime ORDER BY r.confidence DESC) AS rank
        FROM records r
        JOIN species s ON r.speciesID = s.id 
        JOIN files f ON r.fileID = f.id 
        JOIN models ON r.modelID = models.id
        LEFT JOIN tags ON r.tagID = tags.id
        WHERE confidence >= ? 
        `;
  // // Prioritise selection ranges
  const range = selection?.start
    ? selection
    : mode === "explore"
    ? explore.range
    : null;

  let [stmt, params] = await addQueryQualifiers(resultStatement, range, 'results');
  resultStatement = stmt;

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
    modelName as model,
    modelID,
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
  noLimit || params.push(limit, offset);
  const metaSort = resultsMetaSortOrder
    ? `${resultsMetaSortOrder}, `
    : "";
  resultStatement += format ==='audio'
    ? ` ORDER BY RANDOM()  ${limitClause}`
    : ` ORDER BY ${metaSort} ${resultsSortOrder} ${limitClause} `;
  
  return {sql: resultStatement, params};
};

// Helper to chunk an array
function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size));
  }
  return result;
}

/**
 * Retrieves and merges metadata for a list of audio files from the database and in-memory cache.
 *
 * For each file name, fetches file details, associated location, and per-day durations from the database, then merges these with any existing in-memory metadata. Returns an object keyed by file name containing the combined metadata.
 *
 * @param {string[]} fileNames - List of audio file names to retrieve metadata for.
 * @returns {Promise<Object>} An object mapping each file name to its metadata, including duration, start time, location, and completion status.
 */
async function updateMetadata(fileNames) {
  const batchSize = 10000;
  const batches = chunkArray(fileNames, batchSize);
  const finalResult = {};
  for (let batch of batches) {
    // Build placeholders (?, ?, ?) dynamically based on number of file names
    const placeholders = prepParams(batch);
    if (STATE.library.location) {
      const prefix = STATE.library.location + p.sep;
      batch = batch.map(fileName => fileName.replace(prefix, '')  );
    }

    // 1. Get files and locations
    const fileQuery = `
        SELECT 
            f.id,
            f.name,
            f.archiveName,
            f.duration,
            f.filestart as fileStart,
            f.metadata,
            f.locationID,
            l.lat,
            l.lon
        FROM files f
        LEFT JOIN locations l ON f.locationID = l.id
        WHERE f.name IN (${placeholders}) OR f.archiveName IN (${placeholders})
    `;

    const fileRows = await diskDB.allAsync(fileQuery, ...batch, ...batch);

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
      let {name, archiveName, duration, fileStart, metadata, locationID, lat, lon} = row;

      const complete = !!duration && !!fileStart;
      finalResult[name] = {
            archiveName,
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

/**
 * Initiates analysis of a set of audio files, handling selection state, caching, and dispatching processing tasks to workers.
 *
 * If all files are already analyzed and cached, retrieves results from the database or summary as needed. Otherwise, prepares files for analysis, updates relevant state, and distributes processing tasks to available workers.
 *
 * @param {Object} params - Analysis parameters.
 * @param {string[]} [params.filesInScope=[]] - List of audio files to analyze.
 * @param {number} [params.start] - Optional start time for analysis (in seconds).
 * @param {number} [params.end] - Optional end time for analysis (in seconds).
 * @param {boolean} [params.reanalyse=false] - If true, forces reanalysis even if results are cached.
 * @param {boolean} [params.circleClicked=false] - If true, triggers a special retrieval mode for results.
 */
async function onAnalyse({
  filesInScope = [],
  start = undefined,
  end = undefined,
  reanalyse = false,
  circleClicked = false,
}) {
  // Now we've asked for a new analysis, clear the aborted flag
  aborted = false;
  STATE.incrementor = 1;
  STATE.corruptFiles = [];
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
  t0_analysis = Date.now();
  if (!STATE.selection) {
    const {combine, merge} = STATE.detect;
    // Clear records from the memory db
    if (!(combine || merge)){
      await memoryDB.runAsync("DELETE FROM records; VACUUM");
    }
    // Clear any location filters set in explore/charts
    STATE.locationID = undefined;
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
      let file = FILE_QUEUE[i];
      if (STATE.library.location) {
        const prefix = STATE.library.location + p.sep;
        const newFile = file.replace(prefix, '');
        if (file !== newFile) {
          const match = Object.values(METADATA).find(
            entry => entry.archiveName === newFile
          );
          if (match && !METADATA[file]){
            METADATA[file] = match;
          }
        }
      }

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
        await getResults({ topRankin: 5, offset: 0 });
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
  STATE.selection || await onChangeMode("analyse");

  filesBeingProcessed = [...FILE_QUEUE];
  
  for (let i = 0; i < NUM_WORKERS; i++) {
    processNextFile({ start, end, worker: i });
  }
}

/**
 * Abort all in-progress audio processing and prediction work, clear related queues and transient state, and restart prediction workers for the specified model.
 *
 * This cancels active prediction jobs, clears in-memory queues and tracking structures, terminates existing worker processes, and spawns a fresh set of prediction workers for the provided model.
 *
 * @param {Object} params - Options for aborting and restarting.
 * @param {string} [params.model=STATE.model] - Model identifier to use when restarting prediction workers; defaults to the current STATE.model.
 */
function onAbort({ model = STATE.model }) {
  predictWorkers.forEach(worker => worker.postMessage({
    message: 'terminate', 
    batchSize: BATCH_SIZE,
    backend: STATE.detect.backend}));
  aborted = true;
  FILE_QUEUE = [];
  predictQueue = [];
  filesBeingProcessed = [];
  predictionsReceived = {};
  predictionsRequested = {};
  index = 0;
  DEBUG && console.log("abort received");
  Object.keys(STATE.backlogInterval || {}).forEach((pid) => {
    clearInterval(STATE.backlogInterval[pid]);
  });
  //restart the workers
  if (model !== 'perch v2'){
    terminateWorkers();
    setTimeout(
      () => spawnPredictWorkers(model, BATCH_SIZE, NUM_WORKERS),
      200
    );
  }
}

const measureDurationWithFfmpeg = (src, type) => {
  console.info('Measuring duration', `${src}: ${type}`);
  return new Promise((resolve, reject) => {
    const { PassThrough } = require("node:stream");
    const stream = new PassThrough();
    let totalBytes = 0;

    const sampleRate = 24000; // Hz
    const channels = 1;       // mono
    const bytesPerSample = 2; // s16le = 2 bytes

    const bytesPerSecond = sampleRate * channels * bytesPerSample;

    ffmpeg(src)
      .format("s16le") // raw PCM
      .audioChannels(channels)
      .audioFrequency(sampleRate)
      .on("error", (err) => {
        STATE.corruptFiles.push(src);
        if (STATE.corruptFiles.length === 1){
          generateAlert({
            type: "error",
            message: "corruptFile"
          });
        }
        stream.destroy();
        reject(err);
      })
      .pipe(stream);

    stream.on("data", (chunk) => {
      totalBytes += chunk.length;
    });

    stream.on("end", () => {
      const duration = totalBytes / bytesPerSecond;
      stream.destroy();
      resolve(duration);
    });
    stream.on("error", (err) => {
      generateAlert({
        type: "error",
        message: `Audio stream error: ${err.message}`,
      });
      stream.destroy();
      reject(err);
    });
  });
};

const getDuration = async (src) => {
  let audio;
  return new Promise(function (resolve, reject) {
    audio = new Audio();

    audio.src = src.replaceAll("#", "%23").replaceAll("?", "%3F"); // allow hash and ? in the path (https://github.com/Mattk70/Chirpity-Electron/issues/98)
    audio.addEventListener("loadedmetadata", function () {
      const duration = audio.duration;
      if (duration === Infinity || !duration || isNaN(duration)) {
        // Fallback: decode entire file with ffmpeg
        measureDurationWithFfmpeg(src, duration)
          .then((realDuration) => resolve(realDuration))
          .catch((err) => {
            err.message = `${err.message} (file: ${src})`;
            return reject(err)
          });
      } else {
        resolve(duration);
      }
      audio.remove();
    });
    audio.addEventListener("error", (error) => {
      measureDurationWithFfmpeg(src, 'error')
          .then((realDuration) => resolve(realDuration))
          .catch((err) => {
            err.message = `${err.message} (file: ${src})`;
            return reject(err)
          });
      audio.remove();
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
 * Attempts to locate a missing file by searching the archive or the original directory for files with the same base name and a supported extension.
 *
 * If the file is archived, returns its path in the library location. Otherwise, searches the original directory for a file with the same base name and a supported audio extension.
 *
 * @param {string} file - The full path of the missing file.
 * @returns {Promise<string|null>} The full path to the located file, or null if not found.
 *
 * @remark Generates an error alert if the directory cannot be read.
 */
async function locateFile(file) {
  // Check if the file has been archived
  const row = await diskDB.getAsync(
    "SELECT archiveName from files WHERE name = ?",
    file
  );
  if (row?.archiveName) {
    if (STATE.library.location){
      const fullPathToFile = p.join(STATE.library.location, row.archiveName);
      if (fs.existsSync(fullPathToFile)) {
        return fullPathToFile;
      }
    } else {
      console.warn('Library location is not set') // TODO: Needs translations
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
        variables: { match: match[0] },
      });
      // generateAlert({ type: "info", message: "cancelled" });
      onAbort({ model: STATE.model })
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
 * Loads an audio segment from a file, posts audio data and metadata to the UI, and triggers detection processing.
 *
 * Fetches the specified segment of an audio file, sends the audio buffer and associated metadata to the UI, and initiates detection result posting for the segment. Also updates the UI with the current file's week number if applicable. Generates an error alert and rejects the promise if the file is missing or an error occurs during processing.
 *
 * @param {Object} options - Options for loading the audio file.
 * @param {string} [options.file=""] - Path to the audio file.
 * @param {number} [options.start=0] - Start time (in seconds) of the segment.
 * @param {number} [options.end=20] - End time (in seconds) of the segment.
 * @param {number} [options.position=0] - Playback position offset.
 * @param {boolean} [options.play=false] - Whether to play the audio after loading.
 * @param {boolean} [options.goToRegion=true] - Whether the UI should navigate to a specific region.
 * @returns {Promise<void>} Resolves when the audio is loaded and processed; rejects with an error alert if loading fails.
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
          if (!audio) {
            return reject('no file duration') 
          }
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
              play: play,
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
 * Retrieves detection records for a specified audio file and time range, filtered by confidence and species, and sends the top-ranked results to the UI.
 *
 * Queries the database for detections within the given segment of the audio file, applies relevant filters, and posts the results for display or navigation.
 *
 * @param {string} file - Identifier of the audio file.
 * @param {number} start - Start time in seconds from the beginning of the file.
 * @param {number} end - End time in seconds from the beginning of the file.
 * @param {boolean} goToRegion - If true, instructs the UI to navigate to the detected region.
 */
async function sendDetections(file, start, end, goToRegion) {
  const {db, detect} = STATE;
  const partition = detect.merge ? "" : ', r.modelID';
  const params = [STATE.detect.confidence, file, start, end];
  const includedSQL = await getSpeciesSQLAsync();
  const results = await db.allAsync(
    `
        WITH RankedRecords AS (
            SELECT 
                position AS start, 
                end, 
                cname AS label, 
                ROW_NUMBER() OVER (PARTITION BY fileID${partition}, dateTime ORDER BY confidence DESC) AS rank,
                confidence,
                name,
                dateTime,
                speciesID,
                classIndex
            FROM records r
            JOIN species s ON speciesID = s.ID
            JOIN files ON fileID = files.ID
            WHERE confidence >= ?
            AND name = ? 
            AND start BETWEEN ? AND ?
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

const metadataLocks = {}; // file -> Promise

const setMetadata = async ({ file, source_file = file }) => {
  // If another call is already running for this file, wait for it
  if (metadataLocks[file]) {
    return metadataLocks[file];
  }

    ``// Create a promise for the current run and store it
    const run = (async () => {
    let fileMeta = METADATA[file] || {};
    if (fileMeta.isComplete) return fileMeta;
    // CHeck the database first, so we honour any manual updates.
    const savedMeta = await getSavedFileInfo(file).catch((error) =>
      console.warn("getSavedFileInfo error", error)
    );
    if (savedMeta) {
      fileMeta = savedMeta;
      if (savedMeta.locationID)
        UI.postMessage({
          event: "file-location-id",
          file,
          id: savedMeta.locationID,
        });
      fileMeta.isSaved = true; // Queried by UI to establish saved state of file.
    } 
    let guanoTimestamp;
    // savedMeta may just have a locationID if it was set by onSetCUstomLocation
    if (!savedMeta?.duration) {
      fileMeta.duration = await getDuration(file);
      if (file.toLowerCase().endsWith("wav")) {
        const { extractWaveMetadata } = require("./js/utils/metadata.js");
        const t0 = Date.now();
        const wavMetadata = await extractWaveMetadata(file).catch(error => console.warn("Error extracting GUANO", error.message));
        if (wavMetadata && Object.keys(wavMetadata).includes("guano")) {
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
            fileMeta.lat = roundedFloat(lat);
            fileMeta.lon = roundedFloat(lon);
          }
          guanoTimestamp = Date.parse(guano.Timestamp);
          if (guanoTimestamp) fileMeta.fileStart = guanoTimestamp;
          if (guano.Length){
            fileMeta.duration = parseFloat(guano.Length);
          }
        }
        if (wavMetadata && Object.keys(wavMetadata).length > 0) {
          fileMeta.metadata = JSON.stringify(wavMetadata);
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
      fileEnd = new Date(fileStart.getTime() + fileMeta.duration * 1000);
    } else if (guanoTimestamp) {
      // Guano has second priority
      fileStart = new Date(guanoTimestamp);
      fileEnd = new Date(guanoTimestamp + fileMeta.duration * 1000);
    } else {
      // Least preferred
      const stat = fs.statSync(source_file);
      const meta = fileMeta.metadata
        ? JSON.parse(fileMeta.metadata)
        : {};
      const H1E = meta.bext?.Originator?.includes("H1essential");
      if (STATE.fileStartMtime || H1E) {
        // Zoom H1E apparently sets mtime to be the start of the recording
        fileStart = new Date(stat.mtimeMs);
        fileMeta.fileStart = fileStart.getTime();
        fileEnd = new Date(stat.mtimeMs + fileMeta.duration * 1000);
      } else {
        fileEnd = new Date(stat.mtimeMs);
        fileStart = new Date(stat.mtimeMs - fileMeta.duration * 1000);
        fileMeta.fileStart = fileStart.getTime();
      }
    }

    // split  the duration of this file across any dates it spans
    fileMeta.dateDuration = {};
    const key = new Date(fileStart);
    key.setHours(0, 0, 0, 0);
    const keyCopy = addDays(key, 0).getTime();
    if (fileStart.getDate() === fileEnd.getDate()) {
      fileMeta.dateDuration[keyCopy] = fileMeta.duration;
    } else {
      const key2 = addDays(key, 1);
      const key2Copy = addDays(key2, 0).getTime();
      fileMeta.dateDuration[keyCopy] = (key2Copy - fileStart) / 1000;
      fileMeta.dateDuration[key2Copy] =
        fileMeta.duration - fileMeta.dateDuration[keyCopy];
    }
    // If we haven't set METADATA.file.fileStart by now we need to create it from a Date
    fileMeta.fileStart ??= fileStart.getTime();
    if (fileMeta.duration) {
      // Set complete flag
      fileMeta.isComplete = true;
    }
    METADATA[file] = fileMeta;
    return fileMeta;
    })();

  metadataLocks[file] = run;

  try {
    const result = await run;
    return result;
  } finally {
    // Free the lock once finished
    delete metadataLocks[file];
  }
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
      DEBUG && console.log("paused ", pid);
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
      DEBUG && console.log("resumed ", pid);
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
  
  let fileDuration = METADATA[file].duration;
  const slow = STATE.model.includes("bats");
  if (slow) {
    end = (end - start) * 10 + start;
  } else {
    end = Math.min(fileDuration, end);

  }
  if (start > fileDuration) {
    return;
  }
  const duration = end - start;
  
  const rawChunks = Math.ceil((duration - EPSILON) / (BATCH_SIZE * WINDOW_SIZE));
  batchChunksToSend[file] = Math.max(1, rawChunks);
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

/**
 * Read audio from a file and time range, split it into fixed-size buffers, and enqueue each buffer for model prediction.
 *
 * Compensates for encoder padding on compressed formats, manages ffmpeg backpressure and an internal backlog limit, and updates per-file metadata (expected chunk counts) based on the actual processed duration.
 *
 * @param {string} file - Path to the audio file to process.
 * @param {number} start - Start time in seconds for extraction.
 * @param {number} end - End time in seconds for extraction.
 * @param {number} chunkStart - Initial sample index used when assigning chunks to prediction batches.
 * @param {number} highWaterMark - Buffer size in bytes for each audio chunk.
 * @param {number} samplesInBatch - Number of audio samples per batch sent to the model.
 * @returns {Promise<void>} Resolves when all audio chunks have been processed and queued for prediction.
 */
async function processAudio(
  file,
  start,
  end,
  chunkStart,
  highWaterMark,
  samplesInBatch
) {
  // Find a balance between performance and memory usage
  const MAX_CHUNKS = Math.max(12, Math.min(NUM_WORKERS * 2, 36));
  return new Promise((resolve, reject) => {
    // Many compressed files start with a small section of silence due to encoder padding, which affects predictions
    // To compensate, we move the start back a small amount, and slice the data to remove the silence
    let remainingTrim;
    if (!(file.endsWith(".wav") || file.endsWith(".flac"))) {
      const adjustment = 0.05;
      if (start >= adjustment) {
        remainingTrim = sampleRate * 2 * adjustment;
        start -= adjustment;
      }
    }
    let currentIndex = 0,
      duration = 0,
      bytesPerSecond = 2 * sampleRate;
    const audioBuffer = Buffer.allocUnsafe(highWaterMark);
    const additionalFilters = STATE.filters.sendToModel
      ? setAudioFilters()
      : [];
    setupFfmpegCommand({
      file,
      start,
      end,
      sampleRate,
      additionalFilters,
    }).then(command => {
    command.on("error", (error) => {
      if ((error.message === "Output stream closed") & !aborted) {
        console.warn(`processAudio: ${file} ${error}`);
      } else {
        if (error.message.includes("SIGKILL"))
          DEBUG && console.log("FFMPEG process shut down at user request");
        reject(error);
      }
    });

    const STREAM = command.pipe();

    STREAM.on("data", (chunk) => {
      const pid = command.ffmpegProc?.pid;
      duration += chunk.length / bytesPerSecond;
      if (!STATE.processingPaused[pid] && AUDIO_BACKLOG >= MAX_CHUNKS) {
      pauseFfmpeg(command, pid);

      // avoid creating multiple intervals for the same pid
      if (STATE.backlogInterval[pid]) {
        clearInterval(STATE.backlogInterval[pid]);
      }

      STATE.backlogInterval[pid] = setInterval(() => {
        DEBUG && console.log(`[${pid}] backlog check: AUDIO_BACKLOG=${AUDIO_BACKLOG}`);

        if (AUDIO_BACKLOG <= 4) {
          DEBUG && console.log(`[${pid}] resuming ffmpeg (normal), backlog=${AUDIO_BACKLOG}`);
          resumeFfmpeg(command, pid);
          clearInterval(STATE.backlogInterval[pid]);
          STATE.backlogInterval[pid] = null;
          return;
        }

      }, 200); // 200ms interval
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
      if (start === 0 && end === metaDuration && isFinite(duration) && duration + EPSILON < metaDuration) {
        // If we have a short file (header duration > processed duration)
        // *and* were looking for the whole file, we'll fix # of expected chunks here
        batchChunksToSend[file] = Math.ceil(
          (duration - EPSILON) / (BATCH_SIZE * WINDOW_SIZE)
        );

        const diff = Math.abs(metaDuration - duration);
        if (diff > 3) {
          if (fs.existsSync(file)) console.warn("File duration mismatch", diff)
          else console.warn("File duration mismatch", "File missing");
        }

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
      DEBUG && console.log("stream error: ", err);
      err.code === "ENOENT" && notifyMissingFile(file);
    });      
  })

  }).catch((error) => console.error(error));
}

/**
 * Convert interleaved 16-bit PCM audio bytes into a Float32Array of normalized samples.
 *
 * Converts the provided byte buffer (interpreted as little-endian signed 16-bit PCM) into
 * a Float32Array where each sample is scaled to the range [-1, 1).
 *
 * @param {Uint8Array} audio - Interleaved 16-bit PCM audio bytes.
 * @returns {Float32Array} Normalized float samples corresponding to the input PCM16 data.
 * @throws {Error} If `audio.length` is not an even number (incomplete 16-bit samples).
 */
function getMonoChannelData(audio) {
  if (audio.length % 2 !== 0) {
    generateAlert({message: `WAV audio sample length must be even, got ${audio.length}`, type: 'error'})
    throw new Error(`Audio length must be even, got ${audio.length}`);
  }
  const int16 = new Int16Array(audio.buffer, audio.byteOffset, audio.byteLength / 2);
  const out = new Float32Array(int16.length);
  const s = 1 / 32768;
  const n = int16.length;
  const end = n - (n % 8);
  let i = 0;
  // Unroll for speed
  for (; i < end; i += 8) {
    out[i]     = int16[i]     * s;
    out[i + 1] = int16[i + 1] * s;
    out[i + 2] = int16[i + 2] * s;
    out[i + 3] = int16[i + 3] * s;
    out[i + 4] = int16[i + 4] * s;
    out[i + 5] = int16[i + 5] * s;
    out[i + 6] = int16[i + 6] * s;
    out[i + 7] = int16[i + 7] * s;
  }
  // Deal with remainder
  for (; i < n; i++) {
    out[i] = int16[i] * s;
  }
  return out;
}

/**
 * Queue mono channel audio data for model prediction for a specific file segment.
 *
 * Increments the pending-predictions counter for the given file and enqueues
 * the segment's mono channel PCM data for processing by the prediction pipeline.
 *
 * @param {AudioBuffer|Object} audio - Decoded audio buffer containing one or more channels of PCM samples.
 * @param {string} file - Identifier or filename for the source audio file.
 * @param {number} end - End time (in seconds) of the audio segment.
 * @param {number} chunkStart - Start time (in seconds) of the audio segment.
 */
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
const fetchAudioBuffer = async ({ file = "", start = 0, end, format = 'wav', sampleRate }) => {
  if (!fs.existsSync(file)) {
    const result = await getWorkingFile(file);
    if (!result) throw new Error(`Cannot locate ${file}`);
    file = result;
  }
  if (!sampleRate) sampleRate = STATE.model.includes("bats") ? 256_000 : 24_000;
  await setMetadata({ file });
  const fileDuration = METADATA[file].duration// (STATE.model === 'bats') ? METADATA[file].duration*10 : METADATA[file].duration;
  if (!fileDuration) return [null, start]
  end ??= fileDuration;

  if (start < 0) {
    // Work back from file end
    start += fileDuration;
    end += fileDuration;
  }

  // Ensure start is a minimum 0.1 seconds from the end of the file, and >= 0
  start =
    fileDuration < 0.1
      ? 0
      : Math.min(fileDuration - 0.1, start);
  end = Math.min(end, fileDuration);

  // Validate start time
  if (isNaN(start)) throw new Error("fetchAudioBuffer: start is NaN");

  return new Promise((resolve, reject) => {
    const additionalFilters = setAudioFilters();
    setupFfmpegCommand({
      file,
      start,
      end,
      sampleRate,
      format,
      channels: 1,
      additionalFilters,
    }).then(command => {
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
    })

    
  });
};

/**
 * Constructs an array of audio filter configurations based on the current filter settings in application state.
 * 
 * The returned filter chain may include high-pass, low-pass, low-shelf, gain, and normalization filters, depending on which options are enabled.
 * 
 * @returns {Array<Object>} An array of filter configuration objects for use with ffmpeg or similar audio processing tools.
 */
function setAudioFilters() {
  const {
    active,
    lowShelfAttenuation: attenuation,
    lowShelfFrequency: lowShelf,
    highPassFrequency: highPass,
    lowPassFrequency: lowPass,
    normalise
  } = STATE.filters;

  if (!active) return [];

  const filters = [];

  // === Filter chain logic ===
  const batModel = STATE.model === 'bats';
  if (!batModel && (highPass || lowPass < 15_000)) {
    const options = {};
    if (highPass) options.hp = highPass;
    if (lowPass < 15_000) options.lp = lowPass;
    // Use sinc + afir
    filters.push(
      {
        filter: 'sinc',
        options: { ...options, att: 80 },
        outputs: 'ir'
      },
      { filter: 'afir', inputs: ['a', 'ir'] }
    );
  }
  // Low shelf filter
  if (lowShelf && attenuation) {
    filters.push({
      filter: "lowshelf",
      options: `gain=${attenuation}:f=${lowShelf}`
    });
  }

  // Gain
  if (STATE.audio.gain > 0) {
    filters.push({
      filter: "volume",
      options: `volume=${STATE.audio.gain}dB`
    });
  }

  // Normalisation
  if (normalise) {
    filters.push({
      filter: "loudnorm",
      options: "I=-16:LRA=11:TP=-1.5"
    });
  }

  return filters;
}


// Helper function to check if a given time is within daylight hours
function isDuringDaylight(datetime, lat, lon) {
  const date = new Date(datetime);
  const { dawn, dusk } = SunCalc.getTimes(date, lat, lon);
  return datetime >= dawn && datetime <= dusk;
}

async function feedChunksToModel(channelData, chunkStart, file, end) {
  // pick a worker - this round robin method is faster than looking for available workers
  if (++workerInstance >= predictWorkers.length) workerInstance = 0;
  const worker = workerInstance;
  predictWorkers[worker].isAvailable = false;
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
  
  predictWorkers[worker].postMessage(objData, [channelData.buffer]);
}
/**
 * Initiates AI prediction on a specified audio file segment and updates the UI with the audio duration.
 * @param {Object} params - Parameters for prediction.
 * @param {string} params.file - The path to the audio file.
 * @param {number} [params.start=0] - The start time (in seconds) of the segment to analyze.
 * @param {number|null} [params.end=null] - The end time (in seconds) of the segment to analyze.
 */
async function doPrediction({
  file = "",
  start = 0,
  end = null,
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
      DEBUG && console.log(`File found: ${filePath}`);
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
      DEBUG && console.log(`File found: ${filePath}`);

      return [filePath, found_calltype];
    }
  }

  DEBUG && console.log("File not found in any directory");
  return [null, null];
}
const convertSpecsFromExistingSpecs = async (path) => {
  path ??=
    "/media/matt/36A5CC3B5FA24585/DATASETS/MISSING/NEW_DATASET_WITHOUT_ALSO_MERGED";
  const file_list = await getFiles({files:[path], image:true});
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
      "/Users/matthew/Downloads/converted" +
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
  const exportType = 'audio';
  const rootDirectory = DATASET_SAVE_LOCATION;
  sampleRate = 48_000; //STATE.model === "birdnet" ? 48_000 : 24_000;
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
          let end = start + WINDOW_SIZE;

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
              await saveAudio(
                result.file,
                start,
                end,
                file.replace(".png", ".wav"),
                { Artist: "Chirpity" },
                filepath
              );
            else {
              const [AudioBuffer, _] = await fetchAudioBuffer({
                start,
                end,
                file: result.file,
                format: "s16le",
                sampleRate
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
  const p = require("path");
  channels ??= 1; // Default to greyscale if not specified
  await mkdir(filepath, { recursive: true });
const colormap = ''; // Default colormap, can be set to 'hot', 'jet', etc.
  if (colormap){
    const colors = require("colormap");
    // Generate a colour map (e.g., "hot", "jet", "viridis", etc.)
    const map = colors({
      colormap: colormap,
      nshades: 256,
      format: "rgba",
      alpha: 1,
    });

    // Assume `data` is Uint8Array or similar with grayscale values from 0–255
    const rgbData = new Uint8ClampedArray(width * height * 4); // 4 channels (RGBA)

    for (let i = 0; i < data.length; i++) {
      const grayscale = data[i] ; // 0–255
      const [r, g, b, a] = map[Math.round(grayscale)];
      const offset = i * 4;
      rgbData[offset] = r;
      rgbData[offset + 1] = g;
      rgbData[offset + 2] = b;
      rgbData[offset + 3] = a * 255; // convert alpha from 0–1 to 0–255
    }
    data = rgbData; // Use the RGBA data for the image
    channels = 4; // RGBA
  }

  const image = png.encode({
    width,
    height,
    data,
    channels
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
  end = WINDOW_SIZE,
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
  const slow = STATE.model.includes("slow");
  if (slow) {
    end = (end - start) * 10 + start;
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
    await setMetadata({ file });

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
    let errorHandled = false
    setupFfmpegCommand({
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
    }).then(command => {
    const destination = p.join(folder || tempPath, filename);
    command.save(destination);

    command.on("start", function (commandLine) {
      DEBUG && console.log("FFmpeg command: " + commandLine);
    });
    if (format === "mp3" && ! STATE.audio.downmix) {
      command.on("codecData", function (data) {
        const channels = data.audio_details[2].toLowerCase();
        if (!['mono', 'stereo', '1.0', '2.0', 'dual mono'].includes(channels) ){
          const i18n = {
            en: "Cannot export multichannel audio to MP3. Either enable downmixing, or choose a different export format.",
            da: "Kan ikke eksportere multikanalslyd til MP3. Aktiver enten nedmiksning, eller vælg et andet eksportformat.",
            de: "Mehrkanal-Audio kann nicht als MP3 exportiert werden. Aktivieren Sie entweder das Downmixing oder wählen Sie ein anderes Exportformat.",
            es: "No se puede exportar audio multicanal a MP3. Active la mezcla descendente o elija un formato de exportación diferente.",
            fr: "Impossible d’exporter un audio multicanal en MP3. Activez le mixage vers le bas ou choisissez un autre format d’exportation.",
            ja: "マルチチャンネル音声をMP3に書き出すことはできません。ダウンミックスを有効にするか、別の書き出し形式を選択してください。",
            nl: "Kan geen meerkanaalsaudio exporteren naar MP3. Schakel downmixen in of kies een ander exportformaat.",
            pt: "Não é possível exportar áudio multicanal para MP3. Ative a mixagem para baixo ou escolha um formato de exportação diferente.",
            ru: "Невозможно экспортировать многоканальное аудио в MP3. Включите даунмиксинг или выберите другой формат экспорта.",
            sv: "Kan inte exportera flerkanalsljud till MP3. Aktivera antingen nedmixning eller välj ett annat exportformat.",
            zh: "无法将多声道音频导出为 MP3。请启用混缩，或选择其他导出格式。"
          };
          const error = i18n[STATE.locale] || i18n["en"];
          generateAlert({ type: "error", message: "ffmpeg", variables: {error}});
          errorHandled = true;
          return reject(console.warn("Export polyWAV to mp3 attempted."))
        }
      });
    }
    command.on("error", (err) => {
      if (errorHandled) return; // Prevent multiple error handling
      generateAlert({ type: "error", message: "ffmpeg", variables: { error: err.message } });
      reject(console.error("An ffmpeg error occurred: ", err.message));
    });
    command.on("end", function () {
      DEBUG && console.log(format + " file rendered");
      // ToDo: do we want to write guano metadata?
      // if (format === 'wav'){
      //   const { addGuano } = require("./js/utils/metadata.js");
      //   addGuano(destination)
      // }
      resolve(destination);
    });
    })


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
 * Spawn prediction workers to run the specified AI model in parallel.
 *
 * Creates and initializes worker threads that load the given model and accept prediction work. For models named "nocmig", "chirpity", or "perch v2" the corresponding worker script with the same name is used; other model names load the "BirdNet2.4" worker. When "perch v2" is used, at most one worker is created and existing perch workers are reused and informed of thread/size changes.
 *
 * @param {string} model - Model identifier (e.g., "birdnet", "perch v2", "nocmig", "chirpity"); determines which worker script is loaded.
 * @param {number} batchSize - Number of items each worker should process per batch.
 * @param {number} threads - Desired number of worker threads to spawn or inform the existing worker about.
 */
function spawnPredictWorkers(model, batchSize, threads) {
  const isPerch = model === 'perch v2';
  STATE.perchWorker = predictWorkers.filter(w => w.name === 'perch v2');
  if (isPerch && STATE.perchWorker?.length) {
    predictWorkers = STATE.perchWorker;
    predictWorkers[0].postMessage({
      message: "change-threads",
      threads: threads + 1,
      batchSize,
      backend: STATE.detect.backend,
      modelPath: STATE.modelPath
    });
    setLabelState({regenerate: true})
    return
  }
  for (let i = 0; i < threads; i++) {
    if (isPerch && i > 0) break; // Perch v2 only needs one worker, even if multiple threads requested
    const workerSrc = ['nocmig', 'chirpity', 'perch v2'].includes(model) ? model : "BirdNet2.4";
    const worker = new Worker(`./js/models/${workerSrc}.js`, { type: "module" });
    worker.isAvailable = true;
    worker.isReady = false;
    worker.name = model;
    predictWorkers.push(worker);
    DEBUG && console.log("loading a worker");
    worker.postMessage({
      message: "load",
      UUID: STATE.UUID,
      model,
      modelPath: STATE.modelPath,
      batchSize,
      threads,
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
        `Worker ${i} is suffering, shutting it down. The error was:`,
        e.message
      );
      predictWorkers.splice(i, 1);
      worker.terminate();
    };
  }
}

const terminateWorkers = () => {
  predictWorkers.forEach((worker) => {
    worker.postMessage({message: 'terminate'})
    if (worker.name !== 'perch v2') worker.terminate()
  });
  STATE.perchWorker = predictWorkers.filter(w => w.name === 'perch v2');
  predictWorkers = []
};

/**
 * Duplicates all detection records associated with a given identifier, inserting them as new manual records with a specified identifier and label.
 *
 * Retrieves existing records matching `originalCname`, then inserts each as a new manual record with the provided `cname` and `label`. All insertions are performed within a single transaction and mutex lock for atomicity. Triggers a UI update after the final insertion.
 *
 * @param {string} cname - The identifier to assign to the new manual records.
 * @param {string} label - The label to associate with each new record.
 * @param {Array} files - Reserved for future use; currently unused.
 * @param {string} originalCname - The identifier used to select existing records for duplication.
 * @returns {Promise<void>} Resolves when all records have been inserted.
 *
 * @throws {Error} Rolls back all changes if any error occurs during the transaction.
 */
async function batchInsertRecords(cname, label, files, originalCname) {
  const db = STATE.db;
  const t0 = Date.now();
  const {sql, params} = await prepResultsStatement(
    originalCname,
    true,
    undefined,
    STATE.detect.topRankin
  );
  const records = await STATE.db.allAsync(sql, ...params);
  let count = 0;

  await dbMutex.lock();
  try {
    await db.runAsync("BEGIN");
    for (let i = 0; i < records.length; i++) {
      const item = records[i];
      const { fileID, position, end, comment, callCount, modelID } =
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
        modelID,
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
  modelID,
  reviewed = true,
  calledByBatch,
  undo
}) => {
  if (batch)
    return batchInsertRecords(cname, label, file, originalCname, confidence);
  // (start = parseFloat(start)), (end = parseFloat(end));
  const startMilliseconds = Math.round(start * 1000);
  let fileID, fileStart;
  const db = STATE.db;
  const speciesFound = await db.allAsync(
    "SELECT id as speciesID, modelID FROM species WHERE cname = ?",
    cname
  );
  let speciesID;
  if (speciesFound.length) {
    const match = speciesFound.find(s => s.modelID === modelID);
    speciesID = (match || speciesFound[0]).speciesID;
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

  if (!res?.filestart) {
    // Manual records can be added off the bat, so there may be no record of the file in either db
    let duration, metadata;
    ({fileStart, duration, metadata} = METADATA[file]);
    res = await db.runAsync(
      `INSERT INTO files ( id, name, duration, filestart,  metadata ) VALUES (?,?,?,?,?)
        ON CONFLICT(name) DO UPDATE SET
        duration = EXCLUDED.duration,
        filestart = EXCLUDED.filestart,
        metadata = EXCLUDED.metadata
        `,
      fileID,
      file,
      duration,
      fileStart,
      metadata
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
    const result = await db.allAsync(
      `SELECT id as originalSpeciesID FROM species WHERE cname = ?`,
      originalCname
    );
    if (result.length) {
      const ids = result.map(r => r.originalSpeciesID);
      const placeholders = ids.map(() => '?').join(',');
      const res = await db.runAsync(
        `DELETE FROM records WHERE datetime = ? AND speciesID in (${placeholders}) AND fileID = ?`,
        dateTime,
        ...ids,
        fileID
      );
      if (!undo){
        // Manual record
        modelID = 0;
        confidence = 2000; 
      }
    }
  } else {
    // New record
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
      `INSERT INTO records (dateTime, position, fileID, speciesID, modelID, confidence, tagID, comment, end, callCount, isDaylight, reviewed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(dateTime, fileID, speciesID, modelID) DO UPDATE SET 
          confidence = excluded.confidence, 
          tagID = excluded.tagID,
          comment = excluded.comment,
          callCount = excluded.callCount,
          reviewed = excluded.reviewed;`,
      dateTime,
      start,
      fileID,
      speciesID,
      modelID,
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

const generateInsertQuery = async (keysArray, speciesIDBatch, confidenceBatch, file, modelID) => {
  const db = STATE.db;
  const { fileStart, metadata, duration } = METADATA[file];
  const predictionLength = STATE.model.includes("bats") ? 0.3 : WINDOW_SIZE;
  let fileID;
  await dbMutex.lock();
  try {
    await db.runAsync("BEGIN");
    // Fetch or Insert File ID
    const res = await db.getAsync("SELECT id, filestart, locationID FROM files WHERE name = ?", file);
    fileID = res?.id; 
    let locationID = res?.locationID;
    const start = res?.filestart;

    if (!start) {
      // If we need it, extract location from GUANO metadata
      if (!locationID && metadata) {
        const meta = JSON.parse(metadata);
        const guano = meta.guano;
        if (guano && guano["Loc Position"]) {
          const [lat, lon] = guano["Loc Position"].split(" ");
          const place = guano["Site Name"] || guano["Loc Position"];

          // Use INSERT OR IGNORE + RETURNING to avoid extra SELECT
          const result = await db.getAsync(
            `INSERT OR IGNORE INTO locations (lat, lon, place) 
             VALUES (?, ?, ?) RETURNING id`,
            roundedFloat(lat),
            roundedFloat(lon),
            place
          );

          locationID = result?.id;
        }
      }

      // Use RETURNING to get fileID immediately
      const fileInsert = await db.getAsync(
        `INSERT INTO files (name, duration, filestart, locationID, metadata) 
         VALUES (?, ?, ?, ?, ?) 
         ON CONFLICT(name) DO UPDATE SET 
         duration = EXCLUDED.duration,
         filestart = EXCLUDED.filestart,
         metadata = EXCLUDED.metadata 
         RETURNING id`,
        file, duration, fileStart, locationID, metadata
      );

      fileID = fileInsert.id;

      // Insert duration information
      await insertDurations(file, fileID);
    }

    // Extract species and confidence data
    const minConfidence = Math.min(STATE.detect.confidence, 150); 



    // **Use batch inserts instead of string concatenation**
    const insertValues = [];
    const insertPlaceholders = [];

    for (let i = 0; i < keysArray.length; i++) {
      const key = parseFloat(keysArray[i]);
      const timestamp = fileStart + key * 1000;
      const isDaylight = isDuringDaylight(timestamp, STATE.lat, STATE.lon);
      const confidenceArray = confidenceBatch[i];
      const speciesIDArray = speciesIDBatch[i];

      for (let j = 0; j < confidenceArray.length; j++) {
        const confidence = Math.round(confidenceArray[j] * 1000);
        if (confidence < minConfidence) break;

        const modelSpeciesID = speciesIDArray[j];
        const speciesID = STATE.speciesMap.get(modelID).get(modelSpeciesID);

        if (!speciesID) continue; // Skip unknown species

        insertPlaceholders.push("(?, ?, ?, ?, ?, ?, ?, ?, ?)");
        insertValues.push(timestamp, key, fileID, speciesID, modelID, confidence, key + predictionLength, isDaylight, 0);
      }
    }

    if (insertValues.length) {
      await db.runAsync(
        `INSERT OR IGNORE INTO records 
         (dateTime, position, fileID, speciesID, modelID, confidence, end, isDaylight, reviewed) 
         VALUES ${insertPlaceholders.join(", ")}`,
        ...insertValues
      );
    }

    await db.runAsync("END");
  } catch (error) {
    await db.runAsync("ROLLBACK");
    console.error("Transaction error:", error);
  } finally {
    dbMutex.unlock();
  }

};


const parsePredictions = async (response) => {
  const {file, worker, result:latestResult} = response;
  const predictionLength = STATE.model.includes("bats") ? 0.3 : WINDOW_SIZE;
  AUDIO_BACKLOG--;
  if (!latestResult.length) {
    predictionsReceived[file]++;
    return worker;
  }
  DEBUG && console.log("worker being used:", worker);
  const [keysArray, speciesIDBatch, confidenceBatch] = latestResult;
  const {modelID, selection, detect} = STATE;

  if (!selection)
    await generateInsertQuery(keysArray, speciesIDBatch, confidenceBatch, file, modelID).catch((error) =>
      console.warn("Error generating insert query", error)
    );
  if (index < 500) {
    const included = await getIncludedIDs(file).catch((error) =>
      console.warn("Error getting included IDs", error)
    );
    const loopConfidence =  selection ? 50 : detect.confidence;
    for (let i = 0; i < keysArray.length; i++) {
      let updateUI = false;
      let key = parseFloat(keysArray[i]);
      const timestamp = METADATA[file].fileStart + key * 1000;
      const confidenceArray = confidenceBatch[i];
      const speciesIDArray = speciesIDBatch[i];
      for (let j = 0; j < confidenceArray.length; j++) {
        let confidence = Math.round(confidenceArray[j] * 1000);
        if (confidence < loopConfidence) break;
        const species = speciesIDArray[j]
        const speciesID = species + 1; //STATE.speciesMap.get(modelID).get(species);
        updateUI = selection || !included.length || included.includes(speciesID);
        if (updateUI) {
          let end;
          if (selection) {
            const duration =
              (selection.end - selection.start) / 1000;
            end = key + duration;
          } else { end = key + predictionLength }

          const [sname, cname] = STATE.allLabels[species].split(getSplitChar()) 
          const result = {
            timestamp: timestamp,
            position: key,
            end: end,
            file: file,
            cname: cname,
            sname: sname,
            score: confidence,
            model: STATE.model,
          };
          sendResult(++index, result, false);
          if (index > 499) {
            setGetSummaryQueryInterval(NUM_WORKERS);
            DEBUG &&
              console.log("Reducing summary updates to one every", STATE.incrementor);
          }
          // Only show the highest confidence detection, unless it's a selection analysis
          if (!selection) break;
        }
      }
    }
  } else if (index++ === 5_000) {
    STATE.incrementor = 1000;
    DEBUG && console.log("Reducing summary updates to one every 1000");
  }
  predictionsReceived[file]++;
  const received = sumObjectValues(predictionsReceived);
  if (!selection && worker === 0) estimateTimeRemaining(received);
  const fileProgress = predictionsReceived[file] / batchChunksToSend[file];
  if (!selection && STATE.increment() === 0) {
    getSummary({ interim: true });
    getTotal();
  }
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

  return worker;
};


async function estimateTimeRemaining(batchesReceived) {
  if (! STATE.totalDuration) return;
  const totalBatches = Math.ceil(STATE.totalDuration / (BATCH_SIZE * WINDOW_SIZE));
  const progress = batchesReceived / totalBatches;
  const elapsedMinutes = (Date.now() - t0_analysis) / 60_000;
  const estimatedTime = elapsedMinutes / progress;
  const processedMinutes = (STATE.allFilesDuration / 60) * progress;
  const remaining = estimatedTime - elapsedMinutes;
  const speed = (processedMinutes / elapsedMinutes).toFixed(0);
  const i18n = {
    en: { less: 'Less than a minute remaining', min: 'minutes remaining' },
    da: { less: 'Mindre end et minut tilbage', min: 'minutter tilbage' },
    de: { less: 'Weniger als eine Minute verbleibend', min: 'Minuten verbleibend' },
    es: { less: 'Queda menos de un minuto', min: 'minutos restantes' },
    fr: { less: 'Moins d’une minute restante', min: 'minutes restantes' },
    ja: { less: '残り1分未満', min: '分残り' },
    nl: { less: 'Minder dan een minuut resterend', min: 'minuten resterend' },
    pt: { less: 'Menos de um minuto restante', min: 'minutos restantes' },
    ru: { less: 'Осталось меньше минуты', min: 'минут осталось' },
    sv: { less: 'Mindre än en minut kvar', min: 'minuter kvar' },
    zh: { less: '剩余不到一分钟', min: '分钟剩余' }
  }  
  const locale = STATE.locale in i18n ? STATE.locale : 'en';
  const text =
    remaining < 1
      ? `${i18n[locale].less} (${speed}x)`
      : `${remaining.toFixed(0)} ${i18n[locale].min} (${speed}x)`;

  UI.postMessage({
    event: 'footer-progress',
    progress: { percent: progress * 100 },
    text
  });
}

async function parseMessage(e) {
  const response = e.data;
  switch (response["message"]) {
    case "model-ready": {
      const worker = response.worker || 0;
      predictWorkers[worker].isReady = true;
      predictWorkers[worker].isAvailable = true;
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
        DEBUG &&  console.log("Error parsing predictions", error)
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
    case "training-progress": {
      UI.postMessage({
        event: "footer-progress", //use this handler to send footer progress updates
        progress: response.progress,
        text: response.text,
      });
      break;
    }
    case "training-results": {
      generateAlert({
        type: response.type,
        autohide: response.autohide,
        message: response.notice,
        variables: response.variables,
        complete: response.complete,
        history: response.history
      });
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

/**
 * Processes the next audio file in the prediction queue, handling file retrieval, analysis boundaries, and error conditions.
 *
 * Attempts to retrieve the next file for analysis, determines the appropriate analysis boundaries, and invokes prediction. If a file is missing or cannot be processed, generates a warning and continues to the next file. Recursively processes all files in the queue until none remain.
 *
 * @param {Object} [options] - Optional arguments.
 * @param {number} [options.start] - Start time for analysis, if specified.
 * @param {number} [options.end] - End time for analysis, if specified.
 * @param {Worker} [options.worker] - Prediction worker to use, if specified.
 */
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
      let boundaries = [];
      if (start === undefined)
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
          const duration = METADATA[file].duration;
          STATE.totalDuration -= Math.ceil(duration / (BATCH_SIZE * WINDOW_SIZE)) * (BATCH_SIZE * WINDOW_SIZE);
          STATE.allFilesDuration -= duration;
          DEBUG && console.log("Recursion: start = end");
          await processNextFile(arguments[0]).catch((error) =>
            console.warn("Error in processNextFile call", error)
          );
        } else {
          if (!STATE.selection && !sumObjectValues(predictionsReceived)) {
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
            UI.postMessage({
              event: "footer-progress",
              text: awaiting[STATE.locale] || awaiting["en"],
              progress: {percent: 0},
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

/**
 * Determines the active time boundaries for a given audio file based on its metadata and detection mode.
 *
 * If nocturnal migration detection is enabled, calculates nighttime intervals using the file's start time, duration, and associated location coordinates. Otherwise, returns the full duration of the file as a single interval.
 *
 * @param {string} file - The file name or identifier for which to compute boundaries.
 * @returns {Promise<Array<{start: number, end: number}>>} An array of time interval objects representing active boundaries in seconds.
 */
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
  format,
  path,
  headers,
  species,
  active,
  interim,
  action,
} = {}) => {
  const {sql, params} = await prepSummaryStatement();
  const offset = species ? STATE.filteredOffset[species] : STATE.globalOffset;

  const summary = await STATE.db.allAsync(sql, ...params);
  if (format){ // Export called
    await exportData(summary, path, format, headers);
  } else {
    const event = interim ? "update-summary" : "summary-complete";
    UI.postMessage({
      event: event,
      summary: summary,
      offset: offset,
      filterSpecies: species,
      active: active,
      action: action,
    });
  }
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
  topRankin = STATE.detect.topRankin,
  path = undefined,
  format = undefined,
  active = undefined,
  position = undefined,
} = {}) => {
  let confidence = STATE.detect.confidence;
  if (position) {
    //const position = await getPosition({species: species, dateTime: select.dateTime, included: included});
    offset = (position.page - 1) * limit;
    // We want to consistently move to the next record. If results are sorted by time, this will be row + 1.
    active = position.row; //+ 1;
    // update the pagination
    await getTotal({ species, offset });
  }
  offset =
    offset ??
    (species ? STATE.filteredOffset[species] ?? 0 : STATE.globalOffset);
  if (species) STATE.filteredOffset[species] = offset;
  else STATE.update({ globalOffset: offset });

  let index = offset;

  const {sql, params} = await prepResultsStatement(
    species,
    limit === Infinity,
    offset,
    topRankin,
    format
  );

  const result = await STATE.db.allAsync(sql, ...params);
  if (["text", "eBird", "Raven"].includes(format)) {
    await exportData(result, path, format);
  } else if (format === "Audacity") {
    exportAudacity(result, path);
  } else {
    let count = 0;
    for (let i = 0; i < result.length; i++) {
      count++;
      const r = result[i];
      if (format === "audio") {
        if (limit) {
          // Audio export. Format date to YYYY-MM-DD-HH-MM-ss
          const date = new Date(r.timestamp);
          const dateArray = date.toString().split(" ");
          const dateString = dateArray
            .slice(0, 5)
            .join(" ")
            .replaceAll(":", "_");

          const filename = `${r.cname.replaceAll('/', '-')}_${dateString}.${count}.${STATE.audio.format}`;
          DEBUG &&
            console.log(
              `Exporting from ${r.file}, position ${r.position}, into folder ${path}`
            );
          await saveAudio(
            r.file,
            r.position,
            r.end,
            filename,
            { Artist: "Chirpity" },
            path
          );
          // Progress updates
          UI.postMessage({
            event: "footer-progress", //use this handler to send footer progress updates
            progress: {percent: (count / result.length)*100},
            text: 'Saving files:',
          });

          i === result.length - 1 &&
            generateAlert({
              message: "goodAudioExport",
              variables: { number: result.length, path },
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
    (STATE.selection && topRankin !== STATE.detect.topRankin) ||
      UI.postMessage({
        event: "database-results-complete",
        active,
        select: position?.start,
      });
  }
};

/**
 * Exports detection results as Audacity label track files grouped by audio file.
 *
 * Each output file contains tab-delimited start and end times with species names and confidence scores, formatted for Audacity label import.
 *
 * @param {Array<Object>} result - Detection results to export, each containing file, position, end, cname, and score.
 * @param {string} directory - Directory where the label track files will be saved.
 */
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
 * Exports detection or summary records to a CSV file in the specified format.
 *
 * Supports "text", "eBird", "Raven", and "summary" formats, applying format-specific transformations and batching for large datasets. In "Raven" format, assigns selection numbers and cumulative offsets; in "eBird" format, aggregates species counts by group. For "summary", applies custom headers and unit conversions as needed. Writes the resulting data to a CSV file with the appropriate delimiter and notifies the UI on completion or error.
 *
 * @async
 * @param {Array<Object>} result - The records to export.
 * @param {string} filename - The destination file path.
 * @param {string} format - The export format: "text", "eBird", "Raven", or "summary".
 * @param {Object} [headers] - Optional column header mapping for "summary" format.
 */
async function exportData(result, filename, format, headers) {
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
  if (format === 'summary'){
    formattedValues = result.map(item => {
      const renamedItem = {};
      for (const key in headers) {
        key === 'max' && (item[key] /= 1000)
        renamedItem[headers[key]] = item[key];
      }
      return renamedItem;
    });
  } else {
    const { ExportFormatter } = require("./js/utils/exportFormatter.js");
    const formatter = new ExportFormatter(STATE);
    const locationMap = await formatter.getAllLocations();
    // CSV export. Format the values
    for (let i = 0; i < result.length; i += BATCH_SIZE) {
      const batch = result.slice(i, i + BATCH_SIZE);
      const processedBatch = await Promise.all(
        batch.map(async (item, index) => {
          if (format === "Raven") {
            item = { ...item, selection: index + i +  1 }; // Add a selection number for Raven
            if (item.file !== previousFile) {
              // Positions need to be cumulative across files in Raven
              // todo?: fix bug where offsets are out due to intervening fles without recorods
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
  }
  const filePath = filename;
  // Create a write stream for the CSV file
  writeToPath(filePath, formattedValues, {
    headers: true,
    writeBOM: format !== "Raven", // Raven doesn't like BOM
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
  const model = result.model.includes('bats')  
  ? 'bats'
  : ['birdnet', 'nocmig', 'chirpity', 'perch v2'].includes(result.model)
    ? result.model
    : 'custom';
  result.model = model.replace(' v2','');
  // if (!fromDBQuery) {result.model = model, result.modelID = STATE.modelID};
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
  let filterClause = await getSpeciesSQLAsync();

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
            INSERT OR IGNORE INTO disk.records (
              dateTime, position, fileID, speciesID, modelID, confidence, 
              comment, end, callCount, isDaylight, reviewed, tagID
            )
            SELECT 
                r.dateTime, r.position, r.fileID, r.speciesID, r.modelID, r.confidence, 
                r.comment, r.end, r.callCount, r.isDaylight, r.reviewed, r.tagID
            FROM records r
            JOIN species s ON r.speciesID = s.id  
            WHERE confidence >= ${STATE.detect.confidence} ${filterClause}`);
    DEBUG && console.log(response?.changes + " records added to disk database");
    await memoryDB.runAsync("END");
  } catch (error) {
    await memoryDB.runAsync("ROLLBACK");
    errorOccurred = true;
    console.error("Transaction error:", error);
  } finally {
    dbMutex.unlock();
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
    DEBUG && console.log("transaction ended successfully");
    const total = response?.changes || 0;
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
const getDetectedSpecies = async () => {
  const range = STATE.explore.range;
  const confidence = STATE.detect.confidence;
  const splitChar = getSplitChar();
  let sql = `SELECT sname || '${splitChar}' || cname as label, locationID
    FROM records
    JOIN species ON species.id = records.speciesID 
    JOIN files on records.fileID = files.id`;

  if (STATE.mode === "explore") sql += ` WHERE confidence >= ${confidence}`;
  // if (!["location", "everything"].includes(STATE.list)) {
  //   const included = await getIncludedIDs();
  //   sql += ` AND speciesID IN (${included.join(",")})`;
  // }
  if (range?.start)
    sql += ` AND datetime BETWEEN ${range.start} AND ${range.end}`;
  sql += filterLocation();
  sql += " GROUP BY cname ORDER BY cname";
  diskDB.all(sql, (err, rows) => {
    err
      ? console.error(err)
      : UI.postMessage({ event: "seen-species-list", list: rows });
  });
};

/**
 *  getValidSpecies generates a list of species included/excluded based on settings
 *  For week specific lists, we need the file
 * @returns Promise <void>
 */
const getValidSpecies = async (file) => {
  const included = await getIncludedIDs(file); // classindex values
  const locationID = METADATA[file]?.locationID || STATE.locationID;
  const {place} = locationID
    ? await STATE.db.getAsync(
        "SELECT place FROM locations WHERE id = ?",
        locationID
      )
    : { place: STATE.place };
  const includedSpecies = [];
  const excludedSpecies = [];
  for (const [index, speciesName] of STATE.allLabels.entries()) {
    const i = index + 1;
    const [cname, sname] = speciesName.split(getSplitChar()).reverse();
    if (cname.includes("ackground") || cname.includes("Unknown")) continue; // skip background and unknown species
    (!included.length || included.includes(i)) 
      ? includedSpecies.push({cname, sname})
      : excludedSpecies.push({cname, sname});
  }

  // Sort both arrays by cname
  includedSpecies.sort((a, b) => a.cname.localeCompare(b.cname));
  excludedSpecies.sort((a, b) => a.cname.localeCompare(b.cname));

  UI.postMessage({
    event: "valid-species-list",
    included: includedSpecies,
    excluded: excludedSpecies,
    place
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
      duration = EXCLUDED.duration`,
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
    DEBUG && console.log(result.changes, " entries deleted from duration");
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
          count && (await Promise.all([getResults(), getSummary(), getTotal()]));
        }
      );
    } catch (error) {
      // Rollback in case of error
      console.error(`Transaction failed: ${error.message}`);
      await db.runAsync("ROLLBACK");
    }
  }
};

/**
 * Deletes detection records from the database matching the specified file, time range, species, and model.
 *
 * If records are deleted, updates the summary and detected species list or notifies the UI of unsaved records, depending on the database context.
 *
 * @param {Object} params - Parameters specifying which records to delete, including file name, start and end times, species name, model ID, and filtering options.
 */
async function onDelete({
  file,
  start,
  end,
  species,
  modelID,
  active,
  // need speciesfiltered because species triggers getSummary to highlight it
  speciesFiltered,
}) {
  const {db} = STATE;
  const { id } = await db.getAsync(
    "SELECT id from files WHERE name = ?",
    file
  );
  // const datetime = Math.round(filestart + (parseFloat(start) * 1000));
  end = parseFloat(end); start = parseFloat(start);
  const params = [id, start, end];
  let sql = "DELETE FROM records WHERE fileID = ? AND position = ? AND end = ?";
  if (! STATE.detect.merge){
    params.push(modelID)
    sql += " AND modelID = ?";
  }
  if (species) {
    sql += " AND speciesID IN (SELECT id FROM species WHERE cname = ?)";
    params.push(species);
  }
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

/**
 * Deletes all detection records for a specified species from the database, applying current mode filters.
 *
 * In "analyse" mode, only records from files currently being analyzed are deleted. In "explore" mode, deletions are limited to the selected date range. After deletion, updates the detected species list or notifies the UI if records remain unsaved.
 *
 * @param {Object} params
 * @param {string} params.species - The common name of the species to delete records for.
 * @param {string} [params.speciesFiltered] - Used for UI highlighting; does not affect deletion logic.
 */
async function onDeleteSpecies({
  species,
  // need speciesFiltered because species triggers getSummary to highlight it
  speciesFiltered,
}) {
  const db = STATE.db;
  const params = [species];
  let SQL = `DELETE FROM records 
    WHERE speciesID IN (SELECT id FROM species WHERE cname = ?)`;
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
    if (start) {
      SQL += ` AND dateTime BETWEEN ? AND ?`;
      params.push(start, end);
    }
    if (STATE.locationID) {
      SQL += ` AND fileID IN (SELECT id FROM files WHERE locationID = ?)`;
      params.push(STATE.locationID);
    }
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

/**
 * Delete detection records with confidence less than or equal to the given threshold, optionally restricted by time range, species, model, and current location.
 *
 * When records are removed from the persistent disk database this refreshes the detected-species list; when removed from the in-memory database it notifies the UI of unsaved changes.
 *
 * @param {Object} params - Function parameters.
 * @param {string|Date} [params.start] - Start of the time range (inclusive); accepted as a Date or a string suitable for the database `dateTime` column.
 * @param {string|Date} [params.end] - End of the time range (inclusive); accepted as a Date or a string suitable for the database `dateTime` column.
 * @param {string} [params.species] - Species canonical name (`cname`) to restrict deletions to a specific species.
 * @param {number} params.confidence - Confidence threshold; records with confidence <= this value will be deleted.
 * @param {number} [params.modelID] - Model identifier to restrict deletions to records produced by a specific model.
 */
async function onDeleteConfidence({start, end, species, confidence, modelID}) {
  // Implement the logic for deleting by confidence here
  const db = STATE.db;
  let SQL = "DELETE FROM records WHERE confidence <= ?";
  const params = [confidence];
  if (start && end) {
    SQL += " AND dateTime BETWEEN ? AND ?";
    params.push(start, end);
  }
  if (species) {
    SQL += " AND speciesID IN (SELECT id FROM species WHERE cname = ?)";
    params.push(species);
  }
  if (modelID) {
    SQL += " AND modelID = ?";
    params.push(modelID);
  }
  if (STATE.locationID){
    SQL += ` AND fileID IN (SELECT id FROM files WHERE locationID = ?)`;
    params.push(STATE.locationID);
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
/**
 * Update a file record's name in the database when the underlying file has been renamed.
 *
 * Finds the file row with the given old name that has a duration within ±1 second of the
 * actual duration of the renamed file, updates its name to the new name, and posts UI alerts
 * describing the outcome.
 *
 * @param {string} oldName - The previous filename stored in the database.
 * @param {string} newName - The new filename on disk to update the record to.
 */
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
  if (result?.changes) {
    // remove the saved flag
    delete METADATA[fileName]?.isSaved;
    //await onChangeMode('analyse');
    getDetectedSpecies();
    generateAlert({
      message: "goodFilePurge",
      variables: { file: fileName },
      updateFilenamePanel: true,
    });
    await Promise.all([getResults(), getSummary(), getTotal()]);
  } else {
    generateAlert({
      message: "failedFilePurge",
      variables: { file: fileName },
    });
  }
};

/**
 * Updates species common names in the database based on provided label mappings.
 *
 * For each label in the format "speciesName_commonName", updates the corresponding species entry's common name (`cname`) in the database. Handles call type suffixes in common names and applies updates per model ID, ensuring that only changed values are written. All updates are performed within a single transaction for atomicity.
 *
 * @param {object} db - Database connection supporting async methods (`runAsync`, `prepare`, `finalize`).
 * @param {Array<string>} labels - Array of label strings in the format "speciesName_commonName".
 * @returns {Promise<void>} Resolves when all updates are committed.
 *
 * @throws {Error} If any database operation fails during the transaction.
 */

async function _updateSpeciesLocale(db, labels) {
  await dbMutex.lock();

  const updateStmt = db.prepare(
    "UPDATE species SET cname = ? WHERE sname = ? AND cname = ? AND modelID = ?"
  );

  try {
    await db.runAsync("BEGIN");

    // 1. Build a map: sname => translated cname (label version)
    const labelMap = new Map();
    for (const label of labels) {
      const [sname, translatedCname] = label.split(getSplitChar());
      labelMap.set(sname, translatedCname); // only one cname per sname in labels
    }

    // 2. Query all matching species rows
    const snames = [...labelMap.keys()];
    const placeholders = snames.map(() => "?").join(",");
    const speciesRows = await db.allAsync(
      `SELECT sname, cname, modelID FROM species WHERE sname IN (${placeholders})`,
      ...snames
    );

    // 3. Helpers
    const extractCallType = str => str.match(/\s+\([^)]+\)$|-$/u)?.[0] || "";
    // const stripCallType = str => str.replace(/\s+\([^)]+\)$|[^\p{L}\p{N}\s]+$/u, "");

    // 4. Determine required updates
    const updatePromises = [];

    for (const row of speciesRows) {
      const { sname, cname, modelID } = row;
      const translatedBase = labelMap.get(sname); // cname from labels (no call type)
      if (!translatedBase) continue;

      const existingCallType = extractCallType(cname);
      const newCname = translatedBase + existingCallType;

      if (newCname !== cname) {
        updatePromises.push(
          updateStmt.runAsync(newCname, sname, cname, modelID)
        );
      }
    }

    await Promise.all(updatePromises);
    await db.runAsync("END");
  } catch (error) {
    console.error(`_updateSpeciesLocale Transaction failed: ${error.message}`);
    await db.runAsync("ROLLBACK");
    throw error;
  } finally {
    dbMutex.unlock();
    updateStmt.finalize();
  }
}



/**
 * Updates the application's locale and species labels, and optionally refreshes analysis results.
 *
 * Sets the new locale in the global state and updates species labels in both disk and memory databases. If requested, refreshes the application's results and summary to reflect the new locale.
 *
 * @param {string} locale - The locale identifier to set (e.g., "en-US").
 * @param {Object} labels - Mapping of species IDs to localized labels.
 * @param {boolean} refreshResults - Whether to refresh results and summary after updating the locale.
 */
async function onUpdateLocale(locale, labels, refreshResults) {
  if (DEBUG) t0 = Date.now();
  let db;
  try {
    STATE.update({ locale });
    for (db of [diskDB, memoryDB]) {
      db.locale = locale;
      await _updateSpeciesLocale(db, labels);
    }
    if (refreshResults) await Promise.all([getResults(), getSummary()]);
  } catch (error) {
    throw error;
  } finally {
    DEBUG &&
      console.log(`Locale update took ${(Date.now() - t0) / 1000} seconds`);
    
  }
  await setLabelState({regenerate:true})
}

/**
 * Sets or removes a custom location for a group of files and updates their metadata and UI.
 *
 * If a place name is provided, inserts or updates the location in the database and assigns its ID to each file. If no place is provided, deletes the location matching the given latitude and longitude. Updates in-memory metadata and notifies the UI of changes.
 *
 * @param {Object} params - Parameters for setting or removing the location.
 * @param {number} params.lat - Latitude of the location.
 * @param {number} params.lon - Longitude of the location.
 * @param {string} [params.place] - Name of the location. If omitted, the location is deleted.
 * @param {string[]} params.files - List of file names to update.
 * @param {Object} [params.db] - Database instance to use.
 * @param {boolean} [params.overwritePlaceName=true] - Whether to overwrite the place name if the location already exists.
 */
async function onSetCustomLocation({
  lat,
  lon,
  place,
  files,
  db = STATE.db,
  overwritePlaceName = true,
}) {
  if (lat === STATE.lat && lon === STATE.lon && place.trim() === STATE.place.trim()) {
    // Don't add default location
    return;
  }
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
    ? `INSERT INTO locations (lat, lon, place) VALUES (?, ?, ?)
       ON CONFLICT(lat, lon) DO UPDATE SET place = excluded.place
       RETURNING id;`
    : `INSERT OR IGNORE INTO locations (lat, lon, place) VALUES (?, ?, ?)
       RETURNING id;`;
  
    const result = await db.getAsync(SQL, lat, lon, place);
    const id = result?.id ?? (
      await db.getAsync("SELECT id FROM locations WHERE lat = ? AND lon = ?", lat, lon)
    )?.id;
  
// TODO: check if file in audio library and update its location on disk and in library
// await checkLibrary(file, lat,lon, place)
    // Upsert the file location id in the db
    const placeholders = files.map(() => "(?, ?)").join(",");
    const res = await db.runAsync(
      `INSERT INTO files (name, locationID) VALUES ${placeholders}
        ON CONFLICT(name) DO UPDATE SET locationID = excluded.locationID `,
      ...files.flatMap(f => [f, id]));

    for (const file of files) {
      // we may not have set the METADATA for the file
      METADATA[file] = { ...METADATA[file], locationID: id, lat, lon };
      // tell the UI the file has a location id
      UI.postMessage({ event: "file-location-id", file, id });
    }
  }
  await getLocations({ file: files[0] });
}

/**
 * Fetches location entries, prepends the current in-app default location, and sends them to the UI.
 *
 * Retrieves all rows from the `locations` table ordered by `place`, inserts a default entry
 * (id 0) using the application's current lat/lon/place, and posts a message with event
 * `"location-list"` containing the assembled list and the `currentLocation` for the given file.
 *
 * @param {Object} params
 * @param {string} params.file - File identifier used to look up the file's stored location ID.
 * @param {Object} [params.db=STATE.db] - Database client with an `allAsync(sql)` method.
 * @param {string|number} params.id - Message id used when posting the UI message.
 */
async function getLocations({ file, db = STATE.db, id }) {
  let locations = await db.allAsync("SELECT * FROM locations ORDER BY place");
  locations ??= [];
  // Default location
  locations.unshift({ id: 0, lat: STATE.lat, lon: STATE.lon, place: STATE.place.trim() });
  UI.postMessage({
    id,
    event: "location-list",
    data: locations,
    currentLocation: METADATA[file]?.locationID,
  });
}

/**
 * Returns a promise resolving to the array of species IDs included in the current filter context, based on the active list type and file metadata.
 *
 * For "location" or "nocturnal" lists in local mode, determines latitude, longitude, and week from the file's metadata or global state, and ensures the inclusion cache is populated for those parameters. For other list types, retrieves included species IDs from the cache, populating it if necessary.
 *
 * @param {*} [file] - Optional file identifier used to extract metadata for location-based filtering.
 * @returns {Promise<number[]>} Promise resolving to the included species IDs for the current filter context.
 */
async function getIncludedIDs(file) {
  if (STATE.list === "everything") return [];
  let latitude, longitude, week;
  const {list, local, lat, lon, useWeek, included, model, modelID, speciesMap} = STATE;
  if (
    list === "location" ||
    (list === "nocturnal" && local)
  ) {
    if (file) {
      file = METADATA[file];
      week = useWeek ? new Date(file.fileStart).getWeekNumber() : "-1";
      latitude = file.lat || lat;
      longitude = file.lon || lon;
      STATE.week = week;
    } else {
      // summary context: use the week, lat & lon from the first file??
      (latitude = lat), (longitude = lon);
      week = useWeek ? STATE.week : "-1";
    }
    const location = latitude.toString() + longitude.toString();
    if (
      included?.[model]?.[list]?.[week]?.[location] ===
      undefined
    ) {
      // Cache miss
      await LIST_WORKER;
      await setIncludedIDs(latitude, longitude, week);
    }
    let include;
    if (file) include =  STATE.included[model][list][week][location];
    else {
      include = deepMergeLists(model, list)
    }
    return include;
  } else {
    if (included?.[model]?.[list] === undefined) {
      // The object lacks the week / location
      await LIST_WORKER;
      await setIncludedIDs();
    }
    let include = STATE.included[model][list];
    return include
  }
}

/**
 * Recursively merges all numeric species IDs from a nested inclusion list for a given model into a flat array.
 *
 * @param {string|number} model - The model identifier.
 * @param {string} list - The inclusion list key.
 * @returns {number[]} An array of unique species IDs included for the specified model and list.
 */
function deepMergeLists(model, list) {
  if (!STATE.included?.[model]?.[list]) return [];
  let mergedSet = new Set();
  function collectValues(obj) {
      if (Array.isArray(obj)) {
          obj.forEach(num => mergedSet.add(num));
      } else if (typeof obj === 'object' && obj !== null) {
          Object.values(obj).forEach(collectValues);
      }
  }
  collectValues(STATE.included[model][list]);
  return [...mergedSet];
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

/**
 * Retrieves and caches the included species IDs for a given location and week, updating the global state.
 *
 * Requests a species inclusion list from the list worker based on model, labels, location, and week, merges the result into the global included species state, and caches the promise to avoid redundant requests. Generates alerts for any unrecognized labels and throws an error if such labels are found.
 *
 * @param {number|string} lat - Latitude for location-based filtering.
 * @param {number|string} lon - Longitude for location-based filtering.
 * @param {number|string} week - Week number for seasonal filtering.
 * @returns {Promise<Object>} The updated included species object in the global state.
 *
 * @throws {Error} If unrecognized labels are found in the custom list.
 */
async function setIncludedIDs(lat, lon, week) {
  const key = `${lat}-${lon}-${week}-${STATE.model}-${STATE.list}`;
  if (LIST_CACHE[key]) {
    // If a promise is in the cache, return it
    return await LIST_CACHE[key];
  }
  DEBUG && console.log("calling for a new list");
  // Store the promise in the cache immediately
  LIST_CACHE[key] = (async () => {
    const { model, modelPath, allLabels:labels, list:listType, customLabels, local:localBirdsOnly, speciesThreshold:threshold, useWeek } = STATE;
    const { result, messages } = await LIST_WORKER({
      message: "get-list",
      model,
      modelPath,
      labels,
      listType,
      customLabels: customLabels,
      lat: lat || STATE.lat,
      lon: lon || STATE.lon,
      week: week || STATE.week,
      useWeek,
      localBirdsOnly,
      threshold,
    });
    // // Add the *label* id of "Unknown Sp." to all lists
    STATE.list !== "everything" 
      && result.push(STATE.allLabels.indexOf('Unknown Sp._Unknown Sp.') + 1);

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
          splitChar: getSplitChar(),
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
  DEBUG && console.log(`db query took ${Date.now() - t0}ms`);
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
      event: "footer-progress",
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
 * Converts an audio file to the archive format using FFmpeg, with optional trimming and progress tracking.
 *
 * Applies preset encoding parameters for "ogg" format and trims the audio based on calculated boundaries if enabled. Updates the file's modification time and corresponding database record upon successful conversion. Progress is reported via the provided map and UI messages.
 *
 * @param {string} inputFilePath - Path to the source audio file.
 * @param {string} fullFilePath - Destination path for the converted file.
 * @param {object} row - File metadata, including `id`, `duration`, and `filestart`; `duration` may be updated if trimming is applied.
 * @param {string} dbArchiveName - Archive name to record in the database.
 * @param {Object.<string, number>} fileProgressMap - Map tracking conversion progress, keyed by file paths.
 * @returns {Promise<void>} Resolves when conversion and database updates are complete.
 *
 * @throws {Error} If FFmpeg encounters an error during conversion.
 *
 * @remark Issues alerts for multi-day or all-daylight recordings when trimming boundaries are atypical.
 */
async function convertFile(
  inputFilePath,
  fullFilePath,
  row,
  db,
  dbArchiveName,
  fileProgressMap
) {
  await setMetadata({ file: inputFilePath });
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
            event: `footer-progress`,
            progress: { percent: average },
            text: `Archive file conversion progress: ${average.toFixed(1)}%`,
          });
        }
      })
      .run();
  });
}

async function onDeleteModel(model){
  let message, type;
  let diskTransactionStarted = false;
  let memoryTransactionStarted = false;
  await dbMutex.lock();
  try {
    for (const db of  [diskDB, memoryDB]) {
      let row = await db.getAsync('SELECT id FROM models WHERE name = ?', model);
      if (row){
        if (db === diskDB) diskTransactionStarted = true;
        if (db === memoryDB) memoryTransactionStarted = true;
        await db.runAsync("PRAGMA foreign_keys = OFF");
        await db.runAsync('BEGIN');
        await db.runAsync('DELETE FROM records WHERE modelID = ?', row.id);
        await db.runAsync('DELETE FROM species WHERE modelID = ?', row.id);
        await db.runAsync('DELETE FROM models WHERE name = ?', model);
        await db.runAsync('COMMIT');
        message = `Model ${model} successfully removed`;
      } else {
        message =  `Model ${model} was not found in the database`;
        type = 'error';
        break;
      }
    }
  } catch (e) {
    if (diskTransactionStarted) await diskDB.runAsync('ROLLBACK');
    if (memoryTransactionStarted) await memoryDB.runAsync('ROLLBACK');
    console.error(e)
    message =  `Failed to remove model <b>${model}</b>: ${e.message}`;
    type = 'error'
  } finally {
    if (diskTransactionStarted) await diskDB.runAsync("PRAGMA foreign_keys = ON");
    if (memoryTransactionStarted) await memoryDB.runAsync("PRAGMA foreign_keys = ON");
    dbMutex.unlock()
    generateAlert({message, type, model})
  }
}