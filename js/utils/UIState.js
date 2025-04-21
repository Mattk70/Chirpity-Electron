import { IUCNCache } from "../utils/IUCNcache.js";
const DEBUG = false;

export class UIState {
    constructor() {
      // Bind methods early to avoid 'this' loss
      this.onUpdate = this.onUpdate.bind(this);
      this.update = this.update.bind(this);
  
      this._state = {
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
        resultsMetaSortOrder: "",
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
          mode: 'analyse',
          species: null,
          offset: 0,
          active: null,
        },
        currentBuffer: null,
        currentFileDuration: null,
        windowLength: 20,
        windowOffsetSecs: 0,
        bufferStartTime: 0,
        fileLoaded: false,
        activeRegion: null,
        IUCNcache: IUCNCache,
        translations: ["da", "de", "es", "fr", "ja", "nl", "pt", "ru", "sv", "zh"],
        regionColour: "rgba(255, 255, 255, 0.1)",
        regionActiveColour: "rgba(255, 255, 0, 0.1)",
        regionsCompleted: true,
        labelColors: [
          "dark",
          "success",
          "warning",
          "info",
          "secondary",
          "danger",
          "primary",
        ],
      };
        // Proxy setup
      this.state = new Proxy(this._state, {
        get: (target, prop) => {
          return target[prop];
        },
        set: (target, prop, value) => {
          target[prop] = value;
          this.onUpdate(prop, value);
          return true;
        }
      });
    }
  
    onUpdate(prop, value) {
      // You can extend this easily:
      DEBUG && console.log(`State updated: ${prop} =`, value);
      // Trigger other updates, events, etc., if needed
    }
  
    update(updatedState) {
      for (const [key, value] of Object.entries(updatedState)) {
        this.state[key] = value; // This will trigger the proxy setter
      }
    }
  };