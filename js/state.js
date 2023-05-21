const sqlite3 = require('sqlite3');

export class State {
    constructor(db) {
        this.db = db,
            this.mode = 'analyse', // analyse, explore, chart
            this.sortOrder = 'dateTime',
            this.filesToAnalyse = [],
            this.limit = 500,
            this.saved = new Set(), // list of files requested that are in the disk database
            this.globalOffset = 0, // Current start number for unfiltered results
            // filteredOffset is the only propoerty that is updated directly
            this.filteredOffset = {}, // Current species start number for filtered results
            this.selection = false,
            this.blocked = [-1],
            this.audio = { format: 'mp3', bitrate: 128, padding: false, fade: false, downmix: false, quality: 5, },
            this.filters = { highPassFrequency: 0, lowShelfFrequency: 0, lowShelfAttenuation: -6, SNR: 0 },
            this.detect = { nocmig: false, contextAware: false, confidence: 450 },
            this.chart = { range: { start: undefined, end: undefined }, species: undefined },
            this.explore = { range: { start: undefined, end: undefined } },
            this.model = null,
            this.predictionCount = 0,
            this.topRankin = 1,
            this.GET_RESULT_SQL = undefined
    }


    update(updates) {
        function updateState(currentState, updatedValues) {
            for (let key in updatedValues) {
                if (Object.hasOwn(currentState, key)) {
                    if (Array.isArray(updatedValues[key]) ||
                        updatedValues[key] instanceof sqlite3.Database) {
                        currentState[key] = updatedValues[key];
                    }
                    else if (
                        typeof currentState[key] === 'object' &&
                        typeof updatedValues[key] === 'object' 
                    ) {
                        // We don't want to look into the database objects
                        updateState(currentState[key], updatedValues[key]);
                    } else {
                        if (key === 'confidence')  updatedValues[key]*= 10;
                        currentState[key] = updatedValues[key];
                    }
                } else if (!['action', 'path', 'temp', 'lat', 'lon'].includes(key)) {
                    //if (key.startsWith('_')) break
                    console.warn(`Attempted to update state with invalid property: ${key}, ${updatedValues[key]} `);
                }
            }
        }
        updateState(this, updates);
    }

    changeMode({ mode, disk, memory }) {
        this.mode = mode;
        // Modes: analyse, chart, explore, selection, saved-analysis
        if (['analyse', 'selection'].includes(mode)) {
            this.db = memory;
        } else {
            this.db = disk;
        }
        // Reset pagination offsets
        this.globalOffset = 0;
        this.filteredOffset = {};
    }


    setFiles(files) {
        console.log("Setting STATE, filesToAnalyse " + files);
        this.update({ filesToAnalyse: files });
    }

    increment() {
        if (++this.predictionCount === 5) {
            this.predictionCount = 0
        }
        return this.predictionCount;
    }

}