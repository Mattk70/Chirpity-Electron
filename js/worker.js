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
  addNewModel,
  upgrade_to_v4
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
let initialiseResolve;
let initialiseReject;

let INITIALISED = new Promise((resolve, reject) => {
  initialiseResolve = resolve;
  initialiseReject = reject;
});
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
  batchesToSend = {};
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
  } else {
    diskDB = new sqlite3.Database(file);
    await diskDB.runAsync(`CREATE TABLE IF NOT EXISTS 
      confidence_overrides (speciesID INTEGER PRIMARY KEY, minConfidence INTEGER)`);
    DEBUG && console.log("Opened and cleaned disk db " + file);
  }
  const labelsFile = 'labels.txt';
  const labelsLocation = modelPath ? p.join(modelPath, labelsFile) : null;
  [modelID, needsTranslation] = await mergeDbIfNeeded({diskDB, model, appPath, dbMutex, labelsLocation });
  try {
    const user_version_row = await diskDB.getAsync(`SELECT version FROM schema_version`);
    const user_version = user_version_row?.version ?? 0;
    if (user_version === 3) {
      await upgrade_to_v4(diskDB, dbMutex);
    }
  } catch (error) {
    // no schema_version table, catch it next time
    console.info("No schema_version table found in database.", error);
  }

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

  const row = await diskDB.getAsync("SELECT 1 FROM records LIMIT 1");
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
 * Dispatches incoming worker messages by action and performs the requested application operation.
 *
 * Waits for initialisation when required, then delegates actions such as model initialization, analysis/prediction control, worker management, audio file operations, database updates, import/export, tagging and list/locale updates, and UI notifications. Expects the event's data to include an `action` string and action-specific parameters.
 *
 * @param {Object} e - Message event whose `data` property contains an `action` field and associated parameters.
 * @returns {Promise<void>} Resolves when the requested action has been processed.
 */
async function handleMessage(e) {
  const args = e.data;
  const action = args.action;
  DEBUG && console.log("message received", action);
  if (! ["_init_", "update-state","create message port"].includes(action)) {
    // Wait until _init_ or onLaunch completes before processing other messages
    await INITIALISED;
  }
  switch (action) {
    case "_init_": {
      let { model, batchSize, threads, backend, list, modelPath } = args;
      const t0 = Date.now();
      STATE.detect.backend = backend;
      try {
        await (async () => {
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
        initialiseResolve();        // resolve INITIALISED
      } catch (err) {
        console.error("Initialisation failed:", err);
        initialiseReject(err);      // propagate failure
      }
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
        await Promise.all([getSummary(), getResults()]);
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
        args.updateSummary && (await getSummary(args));
        await getResults(args);
        args.included = await getIncludedIDs(args.file);
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
        getSummary({ species: args.speciesFiltered }),
        getResults({ position: args.position, species: args.speciesFiltered }),
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
      onSetLocation(args);
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
      await diskDB.runAsync('DELETE FROM confidence_overrides');
      if (args.list === "custom") {
        STATE.customLabels = args.customLabels;
        STATE.customLabelsMap = Object.fromEntries(
          await Promise.all(
            args.customLabels.map(async (line) => {
              let [_sname, cname, start, end, confidence] =
                line.split(",").map(v => v.trim());

              if (!args.member) {
                start = undefined;
                end = undefined;
                confidence = undefined;
              } else {
                // Sanity check start/end
                [start, end].forEach((val) => {
                  if (val && !/^\d{1,2}-\d{1,2}$/.test(val)) {
                    const message =
                      `Custom list start/end value malformed, it should be 'DD-MM': ${line}`;
                    generateAlert({ message, type: 'warning' });
                    console.warn(message);
                    start = undefined;
                    end = undefined;
                  }
                });

                if (confidence && (isNaN(confidence) || confidence < 0 || confidence > 1)) {
                  const message =
                    `Custom list confidence value must be a number between 0 and 1: ${line}`;
                  generateAlert({ message, type: 'warning' });
                  console.warn(message);
                  confidence = undefined;
                } else if (confidence){
                  const result = await diskDB.runAsync(
                    `
                    INSERT OR IGNORE INTO confidence_overrides (speciesID, minConfidence)
                    SELECT id, ?
                    FROM species
                    WHERE cname = ?
                    `,
                    Number(confidence)*1000,
                    cname
                  );
                }
              }
              return [
                cname,
                {
                  start,
                  end,
                  confidence: confidence && Number(confidence) * 1000 || null
                }
              ];
            })
          )
        );
      }
      // Clear the LIST_CACHE & STATE.included keys to force list regeneration
      LIST_CACHE = {};
      STATE.included = {}
      STATE.globalOffset = 0;
      STATE.filteredOffset = {};
      await INITIALISED;
      await setLabelState({regenerate:true});
      LIST_WORKER && (await getIncludedIDs());
      
      args.refreshResults && (await Promise.all([getSummary(), getResults()]));
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
      const {path, temp, lat, lon, place} = args;
      appPath = path || appPath;
      tempPath = temp || tempPath;
      if (lat !== undefined && lon !== undefined && place) {
        onSetLocation({ lat, lon, place });
      }
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
          getSummary({ species }),
          getResults({ species, offset: 0 }),
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
 * savedFileCheckAsync(files).then(result => {
 *   if (result === true) {
 *     console.log('All files exist in the database.');
 *   } else if (result === false) {
 *     console.log('Some files are missing in the database.');
 *   } else {
 *     console.log('Database not loaded.');
 *   }
 * });
 */
async function savedFileCheckAsync(fileList) {
  if (diskDB) {
    // Slice the list into a # of params SQLITE can handle
    const batchSize = 10_000;
    let totalFilesChecked = 0;
    fileList = fileList.map(f => (METADATA[f]?.name || f));
    const library = STATE.library.location + p.sep;
    for (let i = 0; i < fileList.length; i += batchSize) {
      const fileSlice = fileList.slice(i, i + batchSize);
      let query; 
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
    UI.postMessage({
      event: "all-files-saved-check-result",
      result: allSaved,
    });
    return allSaved;
  } else {
    generateAlert({ type: "error", message: "dbNotLoaded" });
    return false;
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
 * Initialize application state, databases, and prediction workers for the specified model.
 *
 * Loads or creates the disk and memory databases as needed, sets the runtime sample rate and detection backend, updates global STATE with model and database info, regenerates label state, and spawns prediction workers.
 *
 * @param {Object} options - Launch configuration.
 * @param {string} [options.model="chirpity"] - Model identifier; determines sample rate and which labels/species to load.
 * @param {number} [options.batchSize=32] - Number of audio samples per prediction batch.
 * @param {number} [options.threads=1] - Number of prediction worker threads to spawn.
 * @param {string} [options.backend="tensorflow"] - Detection backend to use.
 * @param {string} [options.modelPath] - Filesystem path containing model files and label definitions; used when adding a new model.
 */

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
        for (const file of dirFiles) {
          filePaths.push(file);
        }
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
  const allSaved = checkSaved ? await savedFileCheckAsync(filePaths) : false;
  if (allSaved) {
    await onChangeMode("archive");
    if (STATE.detect.autoLoad){
      STATE.filesToAnalyse = filePaths;
      STATE.originalFiles = filePaths;
      await Promise.all([getSummary(), getResults()]);
    }
  }
  // Start gathering metadata for new files
  processFilesInBatches(filePaths, 10);
  return filePaths;
};

/**
 * Process a list of files in concurrent batches to gather metadata and update aggregate state.
 *
 * Processes filePaths in groups of up to batchSize, invoking setMetadata for each file and accumulating
 * per-file durations into STATE.allFilesDuration and estimated batch counts into STATE.totalBatches.
 * Files that fail metadata extraction are skipped.
 *
 * @param {string[]} filePaths - Array of file paths to process.
 * @param {number} [batchSize=20] - Maximum number of files to process concurrently per batch.
 */
async function processFilesInBatches(filePaths, batchSize = 20) {
  STATE.totalBatches = 0;
  STATE.allFilesDuration = 0;
  const t0 = Date.now();
  for (let i = 0; i < filePaths.length; i += batchSize) {
    const batch = filePaths.slice(i, i + batchSize);
    // Run the batch in parallel
    const results = await Promise.all(
      batch.map(file =>
        setMetadata({ file }).then(fileMetadata => {
          const duration = fileMetadata.duration || 0;
          STATE.allFilesDuration += duration;
          STATE.totalBatches += Math.ceil(duration / (BATCH_SIZE * WINDOW_SIZE));
          return fileMetadata;
        }).catch ((_e) => {
          console.warn(`Failed to get metadata for file: ${file}`);
          return null; // or handle the error as needed
        }
      ))
    );

    DEBUG && console.log(`Processed ${i + results.length} of ${filePaths.length}`);
  }
  DEBUG && console.log(`All files processed in ${Date.now() - t0}ms`);
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
 * Map CNAMES (including variants with suffixes like " (call)" or " (fc)") to species IDs for the current model.
 * @param {string[]} cnames - CNAMES to resolve; elements may include suffixes (e.g., "Species (call)").
 * @returns {number[]} Matching species IDs for STATE.modelID; an empty array if no matches.
 */
async function getMatchingIds(cnames) {
  const parsed = parseCnames(cnames);

  // Collect all possible cname values
  const nameSet = new Set();
  for (const { full, base, suffix } of parsed) {
    nameSet.add(full);
    if (suffix && suffix !== "-") nameSet.add(base);
  }
  if (nameSet.size === 0) return [];
  const names = [...nameSet];

  // Chunk if too many parameters
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
 * Build an SQL fragment that filters species according to the current STATE.list selection.
 *
 * When STATE.list is "everything" the function returns an empty string. For other lists it resolves the set
 * of included species IDs (handling the special "birds" exclusion case and CNAMES with suffixes) and
 * returns an SQL snippet that restricts s.id to that set.
 *
 * @returns {Promise<string>} An SQL fragment restricting species by id (for example " AND s.id IN (1,2) "),
 * or an empty string when no filtering is required.
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
 * Append SQL qualifiers to a WHERE clause based on current application STATE (file range, species/tags, selection, location, and daylight filters).
 *
 * @param {string} stmt - Initial SQL text to augment (typically a WHERE or subquery fragment).
 * @param {Object} [range] - Optional time range to constrain results; when omitted in explore mode the explore.range is used.
 * @param {string} [caller] - Caller context that can alter behavior (e.g., when 'results' and a selection exists a file filter is applied).
 * @returns {[string, any[]]} A two-element array: the augmented SQL string and an ordered array of parameters for prepared statements.
 */
async function addQueryQualifiers(stmt, range, caller) {
  const {list, mode, explore, labelFilters, detect, locationID, selection} = STATE;
  
  const params = list === "custom" ? [0] : [detect.confidence];
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
  if (detect.nocmig) {
    stmt += ` AND isDaylight = ${detect.nocmig === 'day' ? 1 : 0} `;
  }
  if (locationID !== undefined) {
    stmt += locationID === 0 ? " AND locationID IS NULL " : " AND locationID = ? ";
    locationID !== 0 && params.push(locationID);
  }
  return [stmt, params];
}

const prepSummaryStatement = async () => {
  const { detect } = STATE;
  const topRankin = detect.topRankin;

  const partition = detect.merge ? '' : ', r.modelID';
  let summaryStatement = `
    WITH ranked_records AS (
        SELECT r.position * 1000 + f.filestart as dateTime, r.confidence, f.name as file, f.archiveName, cname, sname, classIndex, COALESCE(callCount, 1) as callCount, isDaylight, tagID,
        RANK() OVER (PARTITION BY fileID${partition}, r.position ORDER BY r.confidence DESC) AS rank
        FROM records r
        JOIN files f ON f.id = r.fileID
        JOIN species s ON s.id = r.speciesID
        WHERE confidence >=  ? `;

  let [stmt, params] = await addQueryQualifiers(summaryStatement);
  summaryStatement = stmt;
  summaryStatement += `
    )
    SELECT cname, sname, confidence AS score, dateTime AS timestamp, callcount
    FROM ranked_records
    WHERE ranked_records.rank <= ${topRankin}`;

  return {sql: summaryStatement, params};
};


const prepResultsStatement = async (
  species,
  noLimit,
  offset,
  topRankin,
  format
) => {
  const {mode, list, limit, explore, resultsMetaSortOrder, resultsSortOrder, detect, selection} = STATE;
  const partition = detect.merge ? '' : ', r.modelID'; 
  let resultStatement = `
    WITH ranked_records AS (
        SELECT 
        r.position * 1000 + f.filestart as dateTime, 
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
        RANK() OVER (PARTITION BY fileID${partition}, r.position ORDER BY r.confidence DESC) AS rank
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
    position * 1000 + filestart as timestamp, 
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
  // Because custom list doesn't limit the results, it can get v slow when the archive is large.
  // But, we can use the limit clause if the user is not using a custom list
  noLimit = list === 'custom' || noLimit;
  const limitClause = noLimit  ? " " : " LIMIT ?  OFFSET ? ";
  noLimit || params.push(limit, offset);
  const metaSort = resultsMetaSortOrder
    ? `${resultsMetaSortOrder}, `
    : "";
  resultStatement += format ==='audio'
    ? ` ORDER BY RANDOM() ${limitClause}`
    : ` ORDER BY ${metaSort}  ${resultsSortOrder} ${limitClause}`;
  
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
 * Prepare and start analysis for the specified audio files, deciding whether to reuse cached results or run fresh processing.
 *
 * If all files are present in the disk database (or `circleClicked` is true) this will retrieve summary and results from the archive; otherwise it initializes analysis state, updates metadata, populates the processing queue, and dispatches files to worker processors.
 *
 * @param {Object} params - Analysis parameters.
 * @param {string[]} [params.filesInScope=[]] - File paths to include in the analysis.
 * @param {number} [params.start] - Optional start time (seconds) to limit analysis range for the first file.
 * @param {number} [params.end] - Optional end time (seconds) to limit analysis range for the first file.
 * @param {boolean} [params.reanalyse=false] - Force reanalysis even if cached results exist.
 * @param {boolean} [params.circleClicked=false] - If true, retrieve top results/summary from the archive instead of running a full analysis.
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
  STATE.clippedBatches = 0;
  STATE.clippedFilesDuration = 0;
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
  batchesToSend = {};
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
    // Check duration and expected batches of files
    processFilesInBatches(filesInScope, 10);
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
    const allSaved = await savedFileCheckAsync(FILE_QUEUE);
    METADATA = await updateMetadata(FILE_QUEUE)
    const retrieveFromDatabase =
      (allSaved && !reanalyse && !STATE.selection) || circleClicked;
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
        await Promise.all([getSummary(), getResults()] );
      }
      return;
    }
  }
  DEBUG &&
    console.log("FILE_QUEUE has", FILE_QUEUE.length, "files", count, "files ignored");
  STATE.selection || await onChangeMode("analyse");

  filesBeingProcessed = [...FILE_QUEUE];
  for (let i = 0; i < NUM_WORKERS; i++) {
    processNextFile({ start, end, worker: i });
  }
}

/**
 * Stop ongoing audio processing and prediction, clear in-memory queues and transient tracking state, and (unless the model is "perch v2") restart prediction workers using the specified model.
 *
 * This sets the abort flag, clears file and prediction queues, cancels backlog intervals, terminates existing prediction workers, and spawns a fresh set of workers for the provided model identifier.
 *
 * @param {Object} params - Options for aborting and restarting.
 * @param {string} [params.model=STATE.model] - Model identifier to use when restarting prediction workers; if equal to `"perch v2"`, workers are not restarted.
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
          if (!audio || audio.length === 0) {
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
  const {list, db, detect} = STATE;
  const partition = detect.merge ? "" : ', r.modelID';
  const customList = list === "custom";
  const confidence = customList ? 0 : detect.confidence;
  const params = [confidence, file, start, end];
  const includedSQL = await getSpeciesSQLAsync();

  let SQL =     `
        WITH RankedRecords AS (
            SELECT 
                position AS start, 
                end, 
                cname, 
                ROW_NUMBER() OVER (PARTITION BY fileID${partition}, r.position * 1000 + f.filestart ORDER BY confidence DESC) AS rank,
                confidence as score,
                name,
                position * 1000 + f.filestart as timestamp,
                speciesID,
                classIndex
            FROM records r
            JOIN species s ON speciesID = s.ID
            JOIN files f ON fileID = f.id
            WHERE confidence >= ?
            AND name = ? 
            AND start BETWEEN ? AND ?
            ${includedSQL}
        )
        SELECT start, end, cname, score, timestamp
        FROM RankedRecords
        WHERE rank <= ${detect.topRankin}
        `;
  
  let result = await db.allAsync(SQL,...params);
  if (customList){
    result = result.map( (r) => allowedByList(r) ? r : null).filter(r => r !== null);
  }

  UI.postMessage({
    event: "window-detections",
    detections: result,
    goToRegion,
  });
}

const roundedFloat = (string) => Math.round(parseFloat(string) * 10000) / 10000;

/**
 * Parse BExt origination date and time strings into a local timestamp.
 * 
 * @param {string} originationDate - Date string in "YYYY-MM-DD" format from BExt metadata.
 * @param {string} originationTime - Time string in "HH:MM:SS" format from BExt metadata.
 * @returns {number|undefined} The local epoch timestamp (milliseconds) corresponding to the parsed date/time, or `undefined` if parsing fails.
 */
function parseBextLocalDate(originationDate, originationTime) {
  const [year, month, day] = originationDate.split('-').map(Number);
  const [hour, minute, second] = originationTime.split(':').map(Number);
  // month is 0-based in JS
  const parsedDate =  new Date(year, month - 1, day, hour, minute, second);
  const timestamp = parsedDate.getTime()
  return isNaN(timestamp) ? undefined : timestamp;
}

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

  // Create a promise for the current run and store it
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
    const nearby = await getNearbyLocations(51.9026, -0.3995, 0.1);
    let guanoTimestamp, bextTimestamp, recorderModel;
    // savedMeta may just have a locationID if it was set by onSetLocation
    if (!savedMeta?.duration) {
      fileMeta.duration = await getDuration(file);
      if (file.toLowerCase().endsWith("wav")) {
        const { extractWaveMetadata } = require("./js/utils/metadata.js");
        const t0 = Date.now();
        const wavMetadata = await extractWaveMetadata(file).catch(error => {
          if (error.code !== 'ENOENT') console.warn("Error extracting GUANO", error.message);
          return
        });
        const metaKeys = wavMetadata ? Object.keys(wavMetadata): [];
        if (metaKeys.length){
          if (metaKeys.includes("guano")) {
            const guano = wavMetadata.guano;
            recorderModel = guano.Model;
            const location = guano["Loc Position"];
            if (location) {
              const [lat, lon] = location.split(" ");
              await onSetLocation({
                lat,
                lon,
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
          else if (metaKeys.includes("bext")) {
            const {Originator, OriginationDate, OriginationTime} = wavMetadata.bext;
            // Remove trailing null chars
            recorderModel = Originator?.replace(/\0+$/, '');
            if (OriginationDate && OriginationTime){
              bextTimestamp = parseBextLocalDate(OriginationDate, OriginationTime)
            }
          }
          fileMeta.metadata = JSON.stringify(wavMetadata);
          DEBUG &&
            console.log(`GUANO search took: ${(Date.now() - t0) / 1000} seconds`);
        }
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
    } else if (bextTimestamp) {
      // Then BEXT 3rd
      if (recorderModel?.includes("ZOOM") || STATE.fileStartMtime){
        fileStart = new Date(bextTimestamp);
        fileEnd = new Date(bextTimestamp + fileMeta.duration * 1000);
      } else {
        fileEnd = new Date(bextTimestamp);
        fileStart = new Date(bextTimestamp - fileMeta.duration * 1000);
      }
    } else {
      // Least preferred
      const stat = fs.statSync(source_file);
      if (STATE.fileStartMtime) {
        fileStart = new Date(stat.mtimeMs);
        fileEnd = new Date(stat.mtimeMs + fileMeta.duration * 1000);
      } else {
        fileEnd = new Date(stat.mtimeMs);
        fileStart = new Date(stat.mtimeMs - fileMeta.duration * 1000);
      }
    }
    fileMeta.fileStart = fileStart.getTime();

    if (recorderModel && recorderModel !== STATE.recorderModel) {
      STATE.recorderModel = recorderModel;
      console.info('Recorder model', recorderModel);
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
 * Stream audio from a file, split it into model-sized chunks, and queue those chunks for prediction.
 *
 * Processes the specified time range of the file into byte-aligned buffers, applies configured audio filters, handles encoder padding for compressed formats, and manages backpressure to limit in-memory backlog while feeding prepared batches to the prediction queue.
 *
 * @param {string} file - Path to the audio file to process.
 * @param {number} start - Start time in seconds for extraction (may be adjusted slightly to compensate encoder padding).
 * @param {number} end - End time in seconds for extraction.
 * @param {number} chunkStart - Index (in samples) of the first sample for the first chunk produced from this stream.
 * @param {number} highWaterMark - Number of bytes per chunk buffer used to accumulate PCM before sending to the model.
 * @param {number} samplesInBatch - Number of audio samples contained in each batch sent to the model.
 * @returns {Promise<void>} Resolves when all audio chunks for the requested range have been prepared and queued for prediction.
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
        batchesToSend[file] = Math.ceil(
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
  if (isNaN(start)) throw new Error(`fetchAudioBuffer: start is NaN: ${start}`);

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
  if (!batModel && (highPass || (lowPass < 15_000 && lowPass > 0))) {
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
 * Start prediction for a segment of an audio file and notify the UI of the segment duration.
 *
 * @param {Object} params - Prediction parameters.
 * @param {string} params.file - Path to the audio file.
 * @param {number} [params.start=0] - Segment start time in seconds.
 * @param {number|null} [params.end=null] - Segment end time in seconds, or `null` to indicate the file's end.
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
    value: end - start,
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
  let db2ResultSQL = `SELECT position * 1000 + f.filestart AS timestamp, 
    f.duration, 
    f.filestart,
    f.name AS file, 
    position,
    s.sname, 
    s.cname, 
    r.confidence AS score, 
    tagID, 
    comment
    FROM records r
    JOIN species s
    ON species.id = records.speciesID
    JOIN files f ON records.fileID = files.id
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
 * Spawns multiple Web Workers for parallel AI model prediction.
 *
 * Initializes the specified number of prediction worker threads, each loading the given AI model (using "BirdNet2.4" for "birdnet"). Workers are configured with batch size and backend settings, and set up for asynchronous communication and error handling.
 *
 * @param {string} model - The AI model to load for prediction; "birdnet" uses the "BirdNet2.4" worker script.
 * @param {number} batchSize - Number of items each worker processes per batch.
 * @param {number} threads - Number of worker threads to spawn.
 */
function spawnPredictWorkers(model, batchSize, threads) {
  const isPerch = model === 'perch v2';
  STATE.perchWorker = predictWorkers.filter(w => w.name === 'perch v2');
  if (isPerch && STATE.perchWorker?.length) {
    predictWorkers = STATE.perchWorker;
    setLabelState({regenerate: true})
    return
  }
  predictWorkers = [];
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
  const datetime = fileStart + (start * 1000);
  const isDaylight = isDuringDaylight(datetime, STATE.lat, STATE.lon);

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
        `DELETE FROM records WHERE position = ? AND speciesID in (${placeholders}) AND fileID = ?`,
        start,
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
        WHERE position = ? AND fileID = ? AND speciesID = ?`,
      tagID,
      comment,
      start,
      fileID,
      speciesID
    );
  } else {
    const result = await db.runAsync(
      `INSERT OR REPLACE INTO records (position, fileID, speciesID, modelID, confidence, tagID, comment, end, callCount, isDaylight, reviewed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

const generateInsertQuery = async (keysArray, speciesIDBatch, confidenceBatch, file, modelID, customList) => {
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
        const modelSpeciesID = speciesIDArray[j];
        const speciesID = STATE.speciesMap.get(modelID).get(modelSpeciesID);

        if (!speciesID) continue; // Skip unknown species
        if (customList){
          const cname = STATE.allLabels[modelSpeciesID].split(getSplitChar())[1];
          if (! allowedByList({cname, timestamp, score: confidence})) continue;
        } else if (confidence < minConfidence) break;

        insertPlaceholders.push("(?, ?, ?, ?, ?, ?, ?, ?)");
        insertValues.push(key, fileID, speciesID, modelID, confidence, key + predictionLength, isDaylight, 0);
      }
    }

    if (insertValues.length) {
      await db.runAsync(
        `INSERT OR IGNORE INTO records 
         (position, fileID, speciesID, modelID, confidence, end, isDaylight, reviewed) 
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
  const customList = STATE.list === 'custom';
  if (!selection)
    await generateInsertQuery(keysArray, speciesIDBatch, confidenceBatch, file, modelID, customList).catch((error) =>
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
        const species = speciesIDArray[j]
        const speciesID = species + 1; //STATE.speciesMap.get(modelID).get(species);
        updateUI = selection || !included.length || included.includes(speciesID);
        if (updateUI) {
          let end;
          if (selection) {
            const duration = (selection.end - selection.start) / 1000;
            end = key + duration;
          } else { end = key + predictionLength }

          const [sname, cname] = STATE.allLabels[species].split(getSplitChar());
          const lat = METADATA[file].lat || STATE.lat;
          const lon = METADATA[file].lon || STATE.lon;
          const isDaylight = isDuringDaylight(timestamp, lat, lon);
          const result = {
            timestamp,
            position: key,
            end,
            file,
            cname,
            sname,
            isDaylight,
            score: confidence,
            model: STATE.model,
          };
          if (customList && !selection){
            if (!allowedByList(result)) continue;
          } else if (confidence < loopConfidence) break;

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
  const batches = batchesToSend[file] || 1;
  const fileProgress = predictionsReceived[file] / batches;
  if (!selection && STATE.increment() === 0) {
    getSummary({ interim: true });
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


/**
 * Estimate remaining analysis time from processed batches and post localized progress to the UI footer.
 *
 * Computes progress, estimated minutes remaining, and processing speed based on the global analysis start
 * timestamp and STATE counters, then sends a `footer-progress` message to the UI with percent and localized text.
 *
 * @param {number} batchesReceived - Number of analysis batches processed so far for the current run.
 */
async function estimateTimeRemaining(batchesReceived) {
  if (! STATE.totalBatches) return;
  const {totalBatches, clippedBatches} = STATE;
  const remainingBatches = totalBatches - clippedBatches;
  const progress = remainingBatches > 0 ? batchesReceived / remainingBatches : 0;
  if (progress === 0 || remainingBatches === 0) return; // No batches to process
  const elapsedMinutes = (Date.now() - t0_analysis) / 60_000;
  const estimatedTime = elapsedMinutes / progress;
  const processedMinutes = ((STATE.allFilesDuration - STATE.clippedFilesDuration) / 60) * progress;
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

/**
 * Dispatches and handles messages received from worker threads, updating worker state,
 * forwarding results to parsers, emitting UI events, and generating alerts as appropriate.
 *
 * Accepts messages with a `data.message` field such as `"model-ready"`, `"prediction"`,
 * `"spectrogram"`, `"training-progress"`, and `"training-results"` and performs the
 * corresponding application updates (marking workers ready/available, parsing predictions
 * and advancing file processing, producing spectrogram files, posting footer progress,
 * and creating alerts).
 *
 * @param {MessageEvent} e - Worker message event whose `data` object contains the message type and payload.
 */
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
    case "model-error": {
      if (!SEEN_MODEL_READY) {
        SEEN_MODEL_READY = true;
        const error = response.error || "Unknown error";
        if (error.message === "Failed to fetch") {
          error.message = "Model files missing or inaccessible";
        }
        generateAlert({ type: "error", message: error.message });
        UI.postMessage({
          event: "model-ready",
          message: "Model failed to load",
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
            batchesToSend[response.file] -
              predictionsReceived[response.file]
          );
        const remaining =
          predictionsReceived[response.file] - batchesToSend[response.file];
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
 * Mark a file as finished processing and notify the UI when all files are complete.
 *
 * Removes the given file from the internal filesBeingProcessed list; if the list becomes
 * empty, triggers a summary update when no selection is active and posts an
 * "analysis-complete" message to the UI.
 *
 * @param {string|object} file - File identifier (file path or file record) to remove from the processing list.
 */
function updateFilesBeingProcessed(file) {
  // This method to determine batch complete
  const fileIndex = filesBeingProcessed.indexOf(file);
  if (fileIndex !== -1) {
    filesBeingProcessed.splice(fileIndex, 1);
    if (DEBUG) console.log("filesbeingprocessed length is:",
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
 * Dequeues the next file from the prediction queue, determines analysis time boundaries, and schedules prediction for each boundary segment.
 *
 * If a file cannot be located or processed, posts a warning and continues with the next file. Updates UI progress state and internal counters as segments are dispatched.
 *
 * @param {Object} [options] - Options to override default boundary selection and worker assignment.
 * @param {number} [options.start] - Explicit start time (seconds) for analysis on the dequeued file; when provided, a single boundary segment from `start` to `end` is used.
 * @param {number} [options.end] - Explicit end time (seconds) for analysis on the dequeued file; used together with `start`.
 * @param {Worker} [options.worker] - Prediction worker to handle the scheduled prediction, if a specific worker is required.
 */
async function processNextFile({
  start = undefined,
  end = undefined,
  worker = undefined,
} = {}) {
  if (FILE_QUEUE.length) {
    let file = FILE_QUEUE.shift();
    predictionsReceived[file] = 0;
    predictionsRequested[file] = 0;
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
      else {
        boundaries.push({ start: start, end: end });
        const batches = Math.ceil((end - start - EPSILON) / (BATCH_SIZE * WINDOW_SIZE));
        batchesToSend[file] = batches;
      }
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
          await doPrediction({start, end, file, worker})
            .catch((error) => console.warn("Error in doPrediction", error.message));
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

/**
 * Compute active time intervals within a file for a given daylight period ("day" or "night") and update batching/clipping state.
 *
 * Calculates one or more intervals (in seconds, relative to the file start) where the requested period is active inside the file's time range. Clips day/night boundaries to the file start/end, records how much time was excluded, updates STATE.clippedBatches and STATE.clippedFilesDuration, and sets batchesToSend[file] to the number of processing batches for the kept intervals.
 *
 * @param {string} file - Identifier or path of the file used as key in batchesToSend.
 * @param {number} fileStart - File start timestamp in milliseconds (local time).
 * @param {number} fileEnd - File end timestamp in milliseconds (local time).
 * @param {number} latitude - Latitude used for sunrise/sunset calculations.
 * @param {number} longitude - Longitude used for sunrise/sunset calculations.
 * @param {'day'|'night'} period - Period to compute intervals for; "day" returns dawn→dusk intervals, "night" returns dusk→next dawn intervals.
 * @returns {Array<{start: number, end: number}>} Array of intervals in seconds relative to the file start; returns [{start:0, end:0}] when no active period is found.
 */

function calculateTimeBoundaries(
  file,
  fileStartMs,
  fileEndMs,
  latitude,
  longitude,
  period
) {
  const intervals = getIntervals(fileStartMs, fileEndMs, latitude, longitude, period);
  // Handle files entirely outside the requested period
  if (
    !intervals.length &&
    isDuringDaylight(fileStartMs, latitude, longitude) ===
      (period === 'day')
  ) intervals.push({ start: 0, end: 0 });

  const fileDurationSeconds = (fileEndMs - fileStartMs) / 1000;
  // Sum kept (active) time
  const keptSeconds = intervals.reduce((sum, i) => sum + (i.end - i.start), 0);
  // Amount clipped from the file
  const clippedSeconds = Math.max(0, fileDurationSeconds - keptSeconds);
  // Update global state
  STATE.clippedBatches += Math.ceil(clippedSeconds / (BATCH_SIZE * WINDOW_SIZE));
  STATE.clippedFilesDuration += clippedSeconds;
  const batches = Math.ceil((keptSeconds - EPSILON) / (BATCH_SIZE * WINDOW_SIZE));
  batchesToSend[file] = batches;
  return intervals.length ? intervals : [{ start: 0, end: 0 }];
}

function getIntervals(fileStartMs, fileEndMs, latitude, longitude, period) {
  const intervals = [];
  const startDay = new Date(fileStartMs);
  startDay.setHours(12, 0, 0, 0);
  if (period !== 'day') {
    startDay.setDate(startDay.getDate() - 1);
  }
  const endDay = new Date(fileEndMs);
  endDay.setHours(12, 0, 0, 0);
  for (
    let day = new Date(startDay);
    day <= endDay;
    day.setDate(day.getDate() + 1)
  ) {
    const today = SunCalc.getTimes(day, latitude, longitude);
    let periodStart, periodEnd;
    if (period === 'day') {
      // day
      periodStart = today.dawn.getTime();
      periodEnd = today.dusk.getTime();
    } else {
      const nextDay = new Date(day);
      nextDay.setDate(day.getDate() + 1);
      const tomorrow = SunCalc.getTimes(nextDay, latitude, longitude);
      periodStart = today.dusk.getTime();
      periodEnd = tomorrow.dawn.getTime();
    }

    // Clip to file range
    const clippedStart = Math.max(periodStart, fileStartMs);
    const clippedEnd = Math.min(periodEnd, fileEndMs);
    if (clippedStart < clippedEnd) {
      intervals.push({
        start: (clippedStart - fileStartMs) / 1000,
        end: (clippedEnd - fileStartMs) / 1000,
      });
    }
  }
  return intervals;
}

/**
 * Compute active time intervals for an audio file based on its metadata and detection mode.
 *
 * When nocturnal-migration mode is enabled, returns intervals clipped to the computed day/night boundaries for the file (using file start/end and location). When nocturnal-migration is disabled, returns a single interval covering the entire file duration and updates batchesToSend[file] with the number of processing batches (at least 1).
 *
 * @param {string} file - Key or filename used to look up the file's metadata in METADATA.
 * @returns {Promise<Array<{start: number, end: number}>>} An array of intervals with `start` and `end` expressed in seconds relative to the file.
 */
async function setStartEnd(file) {
  const meta = METADATA[file];
  const nocmig = STATE.detect.nocmig;
  let boundaries; 
  //let start, end;
  if (nocmig) {
    const fileEnd = meta.fileStart + meta.duration * 1000;
    // Note diskDB used here
    const result = await STATE.db.getAsync(
      "SELECT * FROM locations WHERE id = ?",
      meta.locationID
    );
    const { lat, lon } = result
      ? { lat: result.lat, lon: result.lon }
      : { lat: STATE.lat, lon: STATE.lon };
    boundaries = calculateTimeBoundaries(
      file,
      meta.fileStart,
      fileEnd,
      lat,
      lon,
      nocmig
    );
  } else {
    boundaries = [{ start: 0, end: meta.duration }];
    const batches = Math.ceil((meta.duration - EPSILON) / (BATCH_SIZE * WINDOW_SIZE));
    batchesToSend[file] = Math.max(1, batches);
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
  const rows = await STATE.db.allAsync(sql, ...params);
  const allowedRows =
    STATE.list === 'custom'
      ? rows.filter(allowedByList)
      : rows;
  let summary = {};

  for (const row of allowedRows) {
    const key = row.cname;

    if (!summary[key]) {
      summary[key] = {
        cname: row.cname,
        sname: row.sname,
        count: 0,
        calls: 0,
        max: 0
      };
    }

    summary[key].count += 1;
    summary[key].calls += row.callCount || 1;
    summary[key].max = Math.max(summary[key].max, row.score);
  }
  const [field, direction] = STATE.summarySortOrder.split(" ");
  const sortFunctions = {
    count: (a, b) => direction === "ASC" ? a.count - b.count : b.count - a.count, 
    calls: (a, b) => direction === "ASC" ? a.calls - b.calls : b.calls - a.calls,
    max: (a, b) => direction === "ASC" ? a.max - b.max : b.max - a.max,
    cname: (a, b) => direction === "ASC" ? a.cname.localeCompare(b.cname) : b.cname.localeCompare(a.cname),
    sname: (a, b) => direction === "ASC" ? a.sname.localeCompare(b.sname) : b.sname.localeCompare(a.sname),
  };
  summary = Object.values(summary).sort(sortFunctions[field]);
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
 * @param topRankin: return results >= to this rank for each position
 * @param path: if set, will export audio or text of the returned results to this folder
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
    offset = (position.page - 1) * limit;
    // We want to consistently move to the next record. If results are sorted by time, this will be row + 1.
    active = position.row; //+ 1;
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

  let result = await STATE.db.allAsync(sql, ...params);
  // Apply custom list filtering
  if (STATE.list === 'custom'){
    result = result.map( (r) => allowedByList(r) ? r : null).filter(r => r !== null).slice(offset, offset + limit);
  }
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
          `SELECT COUNT(*) as count FROM records WHERE position = ?
                AND confidence >= ? and fileID = ?`,
          r.position,
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
        const i18 = {
          en: { night: 'nocturnal', day: 'diurnal' },
          da: { night: 'nataktiv', day: 'dagaktiv' },
          de: { night: 'nachtaktiv', day: 'tagaktiv' },
          es: { night: 'nocturno', day: 'diurno' },
          fr: { night: 'nocturne', day: 'diurne' },
          ja: { night: '夜行性', day: '昼行性' },
          nl: { night: 'nachtactief', day: 'dagactief' },
          pt: { night: 'noturno', day: 'diurno' },
          ru: { night: 'ночной', day: 'дневной' },
          sv: { night: 'nattaktiv', day: 'dagaktiv' },
          zh: { night: '夜行性', day: '昼行性' }
        };
        let period, nocmigMode = STATE.detect.nocmig;
        if (nocmigMode) {
          period = nocmigMode === true ? 'night' : 'day';
          period = (i18[STATE.locale] || i18["en"])[period];
        }
        const nocmig = STATE.detect.nocmig ? `<b>${period}</b>` : "";
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
 * Export detection or summary records to a CSV file in the specified format.
 *
 * Supports formats: "text", "eBird", "Raven", and "summary". "Raven" output uses a tab delimiter and assigns selection numbers and cumulative file offsets. "eBird" output aggregates species counts by Start Time, Common name, and Species. "summary" output applies the provided header mapping and converts the `max` field by dividing it by 1000.
 *
 * @param {Array<Object>} result - Array of detection or summary records to export.
 * @param {string} filename - Destination filesystem path for the exported CSV.
 * @param {string} format - Export format: "text", "eBird", "Raven", or "summary".
 * @param {Object} [headers] - Optional mapping of source keys to column headers (used for "summary" format).
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

/**
 * Compute the day-of-year for a given Date.
 * @param {Date} date - The date to evaluate.
 * @returns {number} The day number within the year (1 through 365, or 366 in a leap year).
 */
function dayOfYear(date) {
  const monthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const year = date.getFullYear();
  // Leap year adjustment
  if (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) {
    monthLengths[1] = 29;
  }
  let day = date.getDate();
  for (let m = 0; m < date.getMonth(); m++) {
    day += monthLengths[m];
  }
  return day;
}


/**
 * Convert a day-month string into the corresponding day-of-year for a given year.
 *
 * @param {string} dayMonth - Day and month in the form "D-M" or "DD-MM" (e.g., "5-1" or "05-01").
 * @param {number} year - Four-digit year used to account for leap years.
 * @returns {number} The 1-based day of year corresponding to the provided date.
 */
function dayMonthToDayOfYear(dayMonth, year) {
  const [day, month] = dayMonth.split("-").map(Number);
  return dayOfYear(new Date(year, month - 1, day));
}

/**
 * Determine whether a timestamp falls within an inclusive day/month range, correctly handling ranges that wrap across the end of the year.
 * @param {number} epochMs - Timestamp in milliseconds since the Unix epoch.
 * @param {*} startDM - Start day/month specifier accepted by dayMonthToDayOfYear (e.g., a "MM-DD" string or equivalent format used by that helper).
 * @param {*} endDM - End day/month specifier accepted by dayMonthToDayOfYear.
 * @returns {boolean} `true` if the timestamp's day-of-year is between startDM and endDM inclusive, `false` otherwise.
 */
function epochInDayMonthRange(epochMs, startDM, endDM) {
  const date = new Date(epochMs);
  const year = date.getFullYear();

  const targetDay = dayOfYear(date);
  const startDay = dayMonthToDayOfYear(startDM, year);
  const endDay = dayMonthToDayOfYear(endDM, year);

  // Normal range (e.g. Mar → Oct)
  if (startDay <= endDay) {
    return targetDay >= startDay && targetDay <= endDay;
  }

  // Wraps year boundary (e.g. Oct → Mar)
  return targetDay >= startDay || targetDay <= endDay;
}

/**
 * Determine whether a detection is permitted by the active custom label list.
 *
 * Checks that the detection's species (cname) exists in STATE.customLabelsMap, that the detection timestamp falls within the species' optional start/end day-month range, and that the detection score meets the species-specific confidence threshold (falls back to STATE.detect.confidence when no species-specific threshold is set).
 * @param {{timestamp:number, cname:string, score:number}} result - Detection object with epoch milliseconds `timestamp`, canonical species name `cname`, and detection confidence `score`.
 * @returns {boolean} `true` if the detection passes the custom-list filters, `false` otherwise.
 */
function allowedByList(result){
  // Handle enhanced lists
  const {timestamp, cname, score} = result;
  // Try exact match first
  let conditions = STATE.customLabelsMap[cname];
  // Fallback: if no exact match and model uses suffixes, try base name
  if (!conditions && ['nocmig', 'chirpity'].includes(STATE.model)) {
    const baseName = cname.replace(/\s*\(.*?\)\s*$/g, '');
    conditions = STATE.customLabelsMap[baseName];
  }

  if (!conditions) return false; // Species not in the custom list

  const {start, end, confidence} = conditions;
  if (start && end) {
    if (!epochInDayMonthRange(timestamp, start, end)) return false;
  }
  // Confidence check (species-specific overrides global)
  const minConfidence = confidence != null ? confidence : STATE.detect.confidence;
  return score >= minConfidence;
}

const sendResult = (index, result, fromDBQuery) => {
  const model = result.model.includes('bats')  
  ? 'bats'
  : ['birdnet', 'nocmig', 'chirpity', 'perch v2', 'user'].includes(result.model)
    ? result.model
    : 'custom';
  result.model = model.replace(' v2','');

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
        ` SELECT duration, filestart AS fileStart, metadata, locationID
          FROM files LEFT JOIN locations ON files.locationID = locations.id 
          WHERE name = ? OR archiveName = ?`,
        file,
        archiveFile
      );
      if (!row) {
        const baseName = file.replace(/^(.*)\..*$/g, "$1%");
        row = await diskDB.getAsync(
          "SELECT * FROM files LEFT JOIN locations ON files.locationID = locations.id WHERE name LIKE (?)",
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

  if (STATE.detect.nocmig) {
    const condition = STATE.detect.nocmig === 'day';
    filterClause += ` AND isDaylight = ${condition} `;
  }
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
      `INSERT OR REPLACE INTO disk.files SELECT * FROM files`
    );
    await memoryDB.runAsync(
      `INSERT OR IGNORE INTO disk.tags SELECT * FROM tags`
    );

    // Update the duration table
    response = await memoryDB.runAsync(
      "INSERT OR REPLACE INTO disk.duration SELECT * FROM duration"
    );
    DEBUG &&
      console.log(response.changes + " date durations added to disk database");
    // now update records
    response = await memoryDB.runAsync(`
            INSERT OR IGNORE INTO disk.records (
              position, fileID, speciesID, modelID, confidence, 
              comment, end, callCount, isDaylight, reviewed, tagID
            )
            SELECT 
                r.position, r.fileID, r.speciesID, r.modelID, r.confidence, 
                r.comment, r.end, r.callCount, r.isDaylight, r.reviewed, r.tagID
            FROM records r
            JOIN species s ON r.speciesID = s.id  
            LEFT JOIN disk.confidence_overrides co ON co.speciesID = r.speciesID
            WHERE r.confidence >= COALESCE(co.minConfidence, ${STATE.detect.confidence}) 
            ${filterClause}`);
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
    sql += ` AND position * 1000 + files.filestart BETWEEN ${range.start} AND ${range.end}`;
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
    delete METADATA[file];
    await setMetadata({ file });
    // Update dateDuration
    let result;
    result = await db.runAsync("DELETE FROM duration WHERE fileID = ?", id);
    DEBUG && console.log(result.changes, " entries deleted from duration");
    await insertDurations(file, id);
    // Update file records isDaylight info
    const fileStart = METADATA[file].fileStart;
    const fileEnd = fileStart + METADATA[file].duration * 1000;
    if (locationID) {
      row = await db.getAsync(
        "SELECT lat, lon FROM locations WHERE id = ?",
        locationID
      );
    } else row = null;
    const { lat, lon } = row || { lat: STATE.lat, lon: STATE.lon };
    const intervals = getIntervals(fileStart, fileEnd, parseFloat(lat), parseFloat(lon), 'day');
    if (!intervals.length) { intervals.push({start:0, end:0}); } // no daylight
    // Build SQL fragments
    const conditions = intervals
      .map(() => `(position BETWEEN ? AND ?)`)
      .join(' OR ');

    // Flatten params
    const params = intervals.flatMap(i => [i.start, i.end]);

    const sql = `
      UPDATE records
      SET isDaylight =
        CASE
          WHEN ${conditions} THEN 1
          ELSE 0
        END
      WHERE fileID = ?
    `;
    result = await db.runAsync(sql, ...params, id);
    DEBUG && console.log(result.changes, " records updated with new isDaylight");

  }
  await Promise.all([getResults(), getSummary()])
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
  end = parseFloat(end); start = parseFloat(start);
  const params = [id, start, end];
  let sql = "DELETE FROM records WHERE fileID = ? AND position = ? AND end = ?";
  if (! (STATE.detect.merge || STATE.detect.combine)){
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
      SQL += ` AND position * 1000 + files.filestart BETWEEN ? AND ?`;
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

async function onDeleteConfidence({start, end, species, confidence, modelID}) {
  // Implement the logic for deleting by confidence here
  const db = STATE.db;
  let SQL = "DELETE FROM records JOIN files on records.fileID = files.id WHERE confidence <= ?";
  const params = [confidence];
  if (start && end) {
    SQL += " AND position * 1000 + files.filestart BETWEEN ? AND ?";
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
    await Promise.all([getSummary(), getResults()]);
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
    if (refreshResults) await Promise.all([getSummary(), getResults()]);
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
async function onSetLocation({
  lat,
  lon,
  place,
  files,
  db = STATE.db,
  overwritePlaceName = true,
}) {
  lat = roundedFloat(lat);
  lon = roundedFloat(lon);
  if (!files) {
    await INITIALISED;
    // Default location update
    await diskDB.runAsync(`INSERT OR REPLACE INTO locations (id, lat, lon, place) VALUES (0, ?, ?, ?)`, lat, lon, place.trim())
    await memoryDB.runAsync(`INSERT OR REPLACE INTO locations (id, lat, lon, place) VALUES (0, ?, ?, ?)`, lat, lon, place.trim());
    return;
  }
  if (!overwritePlaceName) {
    const nearby = await getNearbyLocations(lat, lon, 0.1);
    if (nearby.length) {
      console.info(`Nearby locations exist: ${nearby.flatMap(x => x.distance).join(", ")}`);
    }
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

async function getLocations({ file, db = STATE.db, id }) {
  let locations = await db.allAsync("SELECT * FROM locations ORDER BY place");
  // Default location
  locations ??= [{ id: 0, lat: STATE.lat, lon: STATE.lon, place: STATE.place.trim() }];
  UI.postMessage({
    id,
    event: "location-list",
    data: locations,
    currentLocation: METADATA[file]?.locationID,
  });
}

/**
 * getNearbyLocations
 * Fetches locations from the database that are within a specified radius of given latitude and longitude using the Haversine formula.
 * @param {number} lat
 * @param {number} lon
 * @param {number} radius in km
 * @returns {Promise<Array.<{id: number, lat: number, lon: number, place: string, distance: number}>>}
*/

async function getNearbyLocations(lat, lon, radius = 0.1) {
  const miles = STATE.distanceUnit === 'miles';
  const R = miles ? 3959 : 6371; // Radius of the Earth in miles or km
  const locations = await STATE.db.allAsync(`
    SELECT id, lat, lon, place,
      (${R} * acos(
        cos(radians(?)) * cos(radians(lat)) * cos(radians(lon) - radians(?)) +
        sin(radians(?)) * sin(radians(lat))
      )) AS distance
    FROM locations
    WHERE (${R} * acos(
      cos(radians(?)) * cos(radians(lat)) * cos(radians(lon) - radians(?)) +
      sin(radians(?)) * sin(radians(lat))
    )) <= ?
    ORDER BY distance ASC;`, lat, lon, lat, lat, lon, lat, radius);
  return locations;
}

/**
 * Retrieves the list of included species IDs based on the current STATE settings and optional file context.
 *
 * Depending on the STATE.list type and whether a specific file is provided, this function determines the appropriate latitude, longitude, and week number to use for location-specific or seasonal inclusion lists. It checks if the relevant inclusion data is already cached in STATE.included; if not, it invokes setIncludedIDs to fetch and cache the data from the list worker. Finally, it returns the array of included species IDs for the specified model and list type.
 *
 * @param {string} [file] - Optional file identifier to provide context for location-specific or seasonal lists.
 * @returns {Promise<number[]>} An array of species IDs that are included based on the current STATE settings.
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
 * Load and cache species IDs included for a given location and week and merge them into global STATE.
 *
 * Requests an inclusion list from the list worker using the current model, labels, list settings and the provided
 * latitude/longitude/week (falling back to STATE values), merges the resulting IDs into STATE.included, caches the
 * in-flight promise to avoid duplicate requests, and emits warnings for any unrecognized labels reported by the worker.
 *
 * @param {number|string} lat - Latitude to use for location-specific lists (falls back to STATE.lat if falsy).
 * @param {number|string} lon - Longitude to use for location-specific lists (falls back to STATE.lon if falsy).
 * @param {number|string} week - Week number for seasonal filtering (falls back to STATE.week if falsy).
 * @returns {Promise<Object>} The updated STATE.included object after merging the retrieved included species IDs.
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
    messages.splice(5) // Prevent spanning with 1000's messages, limit to 5
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
    if (messages.length) {
      const {sname, model} = messages[0];
      console.warn(`Unrecognised labels in ${model} custom list, e.g:`, sname);
    }
    return STATE.included;
  })();

  // Await the promise
  return await LIST_CACHE[key];
}

///////// Database compression and archive ////

const pLimit = require("p-limit");

/**
 * Convert and organize audio files into the configured archive using year/month/place folders.
 *
 * @param {number} [threadLimit=4] - Maximum number of concurrent conversion tasks.
 * @returns {boolean|undefined} `false` if the archive directory is missing or not writable; otherwise `undefined` after scheduling and completing conversion tasks.
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

    // Does the file we want to convert exist?
    if (!fs.existsSync(inputFilePath)) {
      generateAlert({
        type: "warning",
        variables: { file: inputFilePath },
        message: `fileToConvertNotFound`,
        file: inputFilePath,
      });
      continue;
    }

    const outputDir = p.join(place, year, month);
    const outputFileName =
      p.basename(inputFilePath, p.extname(inputFilePath)) + ext;

    const fullPath = p.join(STATE.library.location, outputDir);
    const fullFilePath = p.join(fullPath, outputFileName);
    const dbArchiveName = p.join(outputDir, outputFileName);

    const archiveName = row.archiveName;
    if (archiveName === dbArchiveName && fs.existsSync(fullFilePath)) {
      DEBUG &&
        console.log(
          `File ${inputFilePath} already converted. Skipping conversion.`
        );
      continue;
    }


    // Ensure the output directory exists
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

    let type = "info";

    if (attempted) {
      generateAlert({
        message: "conversionComplete",
        variables: {
          successTotal: successfulConversions,
          failedTotal: failedConversions,
        },
        autohide: false
      });
      if (failedConversions > 0) {
          // Create a summary message
        let summaryMessage = `There were ${failedConversions} failures. `;
        type = 'warning';
        summaryMessage += `<br>Failed conversion reasons:<br><ul>`;
        failureReasons.forEach(reason => {
            summaryMessage += `<li>${reason}</li>`;
        });
        summaryMessage += `</ul>`;
        generateAlert({message: summaryMessage, type:'warning'})
      }
    } else {
      generateAlert({ message: "libraryUpToDate" });
    }
  });
}

/**
 * Convert an audio file into the archive format, optionally trim it to computed boundaries, update the file's mtime and database record, and report conversion progress.
 *
 * @param {string} inputFilePath - Path to the source audio file.
 * @param {string} fullFilePath - Destination path for the converted file.
 * @param {object} row - File metadata object containing at least `id`, `duration`, and `filestart`. If trimming is applied, `row.duration` will be updated to the trimmed duration.
 * @param {object} db - SQLite database handle used to update the file record.
 * @param {string} dbArchiveName - Archive name to store in the database for the converted file.
 * @param {Object.<string, number>} fileProgressMap - Map tracking per-file conversion progress (percent values), keyed by input file path; used to compute aggregate progress reported to the UI.
 * @returns {Promise<void>} Resolves when the conversion, file timestamp update, and database update complete.
 * @throws {Error} If FFmpeg reports an error during conversion (promise will reject).
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
        .audioFrequency(32_000); // Set sample rate for BirdNET/Perch
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