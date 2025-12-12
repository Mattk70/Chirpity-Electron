/**
 * @file Helper functions for managing state.
 */
const sqlite3 = require("sqlite3");
export class WorkerState {

  constructor() {
    (this.db = null),
    (this.mode = "analyse"), // archive, explore, chart
    (this.resultsSortOrder = "dateTime"),
    this.resultsMetaSortOrder = '',
    (this.summarySortOrder = "cname ASC"),
    (this.filesToAnalyse = []),
    (this.limit = 500),
    (this.saved = new Set()), // list of files requested that are in the disk database
    (this.globalOffset = 0), // Current start number for unfiltered results
    // filteredOffset is the only property that is updated directly
    (this.filteredOffset = {}), // Current species start number for filtered results
    (this.selection = false),
    (this.audio = {
      gain: 0,
      format: "mp3",
      bitrate: 128,
      padding: false,
      fade: false,
      downmix: false,
      quality: 5,
      notification: true,
      frequencyMax: 11950,
      frequencyMin: 0,
    }),
    (this.filters = {
      active: false,
      highPassFrequency: 0,
      lowPassFrequency: 15000,
      lowShelfFrequency: 0,
      lowShelfAttenuation: 0,
      SNR: 0,
      normalise: false,
      sendToModel: false,
    }),
    (this.detect = {
      backend: "webgpu",
      nocmig: false,
      autoLoad: false,
      contextAware: false,
      confidence: 450,
      merge: false, // Whether to layer model analyses
      combine: true, // Whether to split or merge results from different models
      iucn: false,
      iucnScope: "Global",
      topRankin: 1
    }),
    (this.chart = {
      range: { start: undefined, end: undefined },
      species: undefined,
      aggregation: "week",
      stackYears: false,
    }),
    (this.explore = {
      species: undefined,
      range: { start: undefined, end: undefined },
    }),
    (this.database = {
      location: undefined
    }),
    (this.model = undefined),
    (this.modelPath = undefined),
    (this.modelID = null),
    (this.predictionCount = 0),
    (this.lat = undefined),
    (this.lon = undefined),
    (this.place = undefined),
    (this.locationID = undefined),
    (this.locale = "en"),
    (this.speciesThreshold = undefined),
    (this.useWeek = false),
    (this.week = -1),
    (this.list = "everything"),
    (this.customList = undefined),
    (this.notFound = {}), // try to prevent spamming errors
    (this.local = true),
    (this.incrementor = 2),
    (this.UUID = 0),
    (this.track = true),
    (this.powerSaveBlocker = false),
    (this.library = {
      location: undefined,
      format: "ogg",
      auto: false,
      trim: false,
      clips: false,
    }),
    (this.useGUANO = true),
    (this.debug = false),
    (this.fileStartMtime = false),
    (this.specDetections = false),
    (this.labelFilters = []),
    (this.speciesMap = new Map()),
    (this.totalDuration = 0),
    (this.allFilesDuration = 0),
    (this.corruptFiles = []),
    (this.originalFiles = undefined);
  }

  update(updates) {
    function updateState(currentState, updatedValues) {
      for (let key in updatedValues) {
        if (Object.hasOwn(currentState, key)) {
          if (
            Array.isArray(updatedValues[key]) ||
            updatedValues[key] instanceof sqlite3.Database
          ) {
            currentState[key] = updatedValues[key];
          } else if (
            typeof currentState[key] === "object" &&
            typeof updatedValues[key] === "object"
          ) {
            // We don't want to look into the database objects
            updateState(currentState[key], updatedValues[key]);
          } else {
            if (key === "confidence") updatedValues[key] *= 10;
            currentState[key] = updatedValues[key];
          }
        } else if (!["action", "path", "temp", "lat", "lon"].includes(key)) {
          //if (key.startsWith('_')) break
          console.warn(
            `Attempted to update state with invalid property: ${key}, ${updatedValues[key]} `
          );
        }
      }
    }
    updateState(this, updates);
  }
  // Separate from update-state as we're passing a database handle
  changeMode({ mode, disk, memory }) {
    this.mode = mode;
    // Modes: analyse, chart, explore, selection, archive
    this.db = ["chart", "explore", "archive"].includes(mode) ? disk : memory;
    // Reset pagination offsets
    this.globalOffset = 0;
    this.filteredOffset = {};
    this.originalFiles = undefined;
  }

  setFiles(files) {
    //console.log("Setting STATE, filesToAnalyse " + files);
    this.update({ filesToAnalyse: files });
  }

  // Used to decrease calls to get summary when prepping a dataset
  // because it's an expensive op when the memory db is v. large
  increment() {
    if (++this.predictionCount >= this.incrementor) {
      this.predictionCount = 0;
    }
    return this.predictionCount;
  }
}
