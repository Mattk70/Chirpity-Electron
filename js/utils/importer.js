const fs = require('node:fs');
const csv = require('@fast-csv/parse');
const readline = require('readline');

async function countLines(filePath) {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  let lineCount = 0;
  for await (const _line of rl) {
    lineCount++;
  }
  return lineCount - 1; // Subtract 1 for header row
}

/**
   * Imports and processes CSV data into the database, resolving related entities and updating metadata.
   *
   * Reads a CSV file stream, parses each row sequentially, and inserts or updates records in the database. Utilizes in-memory caches to minimize redundant queries for models, species, tags, locations, and files. Tracks unique files referenced in the CSV and updates metadata as needed.
   *
   * @param {Object} options - Import options.
   * @param {string} options.file - Path to the CSV file to import.
   * @param {string} options.format - Format identifier for the import.
   * @param {Object} options.METADATA - Metadata object to be updated during import.
   * @param {Object} options.defaultLocation - Default location object used for new entries.
   * @param {Function} options.setMetadata - Callback to update metadata for new files.
   * @returns {Promise<{files: string[], meta: Object}>} Resolves with a list of unique files processed and the updated metadata.
   *
   * @throws {Error} If a parsing or database error occurs, or if required entities are missing.
   */
  async function importData({db, file, format, METADATA, defaultLocation, setMetadata, UI}){
    const caches = {
        models: new Map(),
        species: new Map(),
        tags: new Map(),
        locations: new Map(),
        files: new Map()
      };
    const totalLines = await countLines(file);
    let rowCounter = 0, lastPercentReported = -1;
    let t0 = Date.now()
    const stream = fs.createReadStream(file);
    const fileSet = new Set();
    let processing = Promise.resolve();
    return new Promise((resolve, reject) =>{
        csv.parseStream(stream, 
        {
            headers: ['file', 'time', 'endTime', 'cname', 
                    'sname', 'confidence', 'label', 'comment', 
                    'callCount', 'offset', 'position', 
                    'lat', 'lon', 'place', 'model'], 
            renameHeaders: true,
            trim: true
        }
        )
        .on('error', error => {
            console.error(error);
            return reject(error)
        })
        .on('data',  row =>  {
            // Chain processing to ensure sequential execution
            processing = processing.then(async () => {
            try {
                METADATA = await prepInsertParams({db, row, METADATA, setMetadata, defaultLocation, caches})
                rowCounter++;
                const percent = Math.floor((rowCounter / totalLines) * 100 );
                
                if (percent !== lastPercentReported ) {
                  lastPercentReported = percent;
                  UI.postMessage({event: 'footer-progress', progress: {percent}, text: 'Importing' });
                }
            } catch (error) {
                return reject(error)
            }
            fs.existsSync(row.file) && fileSet.add(row.file);
            });
        })
        .on('end', async rowCount => {
            await processing;
            console.log(`Parsed ${rowCount} rows in ${Date.now() - t0}ms`)
            resolve({files: Array.from(fileSet), meta:METADATA})
        });
    })
  }
  
  /**
   * Prepares and inserts a CSV row's data into the database, resolving and caching related entity IDs.
   *
   * Extracts and converts relevant fields from the input row, resolves or inserts associated model, species, file, location, and tag records as needed, and inserts a new record into the `records` table. Utilizes in-memory caches to minimize redundant database queries and updates file metadata if necessary.
   *
   * @param {Object} params - The parameters for processing the row.
   * @param {Object} params.row - The CSV row data to process and insert.
   * @param {Object} params.defaultLocation - Default location values for fallback.
   * @param {Object} params.METADATA - Metadata object to update with file information.
   * @param {Function} params.setMetadata - Function to set up file metadata if missing.
   * @param {Object} params.caches - In-memory caches for models, species, tags, locations, and files.
   * @returns {Object} The updated metadata object.
   *
   * @throws {Error} If the model specified in the row does not exist in the database.
   * @throws {Error} If the species specified in the row does not exist for the given model.
   */
  async function prepInsertParams({ db, row, defaultLocation, METADATA, setMetadata, caches }) {
    let { file, time, endTime, cname, sname, confidence, label, comment, callCount, position, lat, lon, place, model } = row;
    const {defaultLat, defaultLon, defaultPlace} = defaultLocation;
    lat = parseFloat(lat);
    lon = parseFloat(lon);
    position = parseFloat(position);
    const dateTime = Date.parse(time);
    endTime = Date.parse(endTime);
    // Handle special confidence values - 'confirmed' maps to confidence level 2.0
    if (confidence === 'confirmed') {
      confidence = 2.0;
    } else {
      confidence = parseFloat(confidence);
      if (isNaN(confidence)) {
          throw new Error(`CSV Import encountered an invalid confidence value: ${confidence}`);
      }
    }
    confidence = confidence * 1000;
    const detectionDuration = (endTime - dateTime) / 1000;
    const end = position + detectionDuration;
    callCount && (callCount = parseInt(callCount));
  

  
    // Get modelID from cache or DB
    let modelID = caches.models.get(model);
    if (!modelID) {
      const res = await db.getAsync('SELECT id FROM models WHERE name = ?', model);
      if (!res) {
        const message = model ? 'badModel' : 'noModel'
        const error = new Error(message);
        model = model.replace('nocmig', 'Nocmig (beta)').replace('chirpity', 'Nocmig')
        error.variables = { model };
        throw error;
      }
      modelID = res.id;
      caches.models.set(model, modelID);
    }
  
    // Get speciesID from cache or DB
    const speciesKey = `${sname}_${modelID}`;
    let speciesID = caches.species.get(speciesKey);
    if (!speciesID) {
      const res = await db.getAsync('SELECT id FROM species WHERE sname = ? AND modelID = ?', sname, modelID);
      if (res) {
          speciesID = res.id;
      } else {
        // Otherwise try all other models
        for (const [_name, otherModelID] of caches.models) {
            if (otherModelID === modelID) continue; // skip the one already tested
            const altRes = await db.getAsync(
                'SELECT id FROM species WHERE sname = ? AND modelID = ?',
                sname,
                otherModelID
            );
            if (altRes) {
                speciesID = altRes.id;
                break;
            }
        }
      }
      if (!speciesID) { // No species found
        const error = new Error('noSpecies');
        error.variables = { cname: `${cname} (<i>${sname}</i>)` };
        throw error;
      }
      caches.species.set(speciesKey, speciesID);
    }
  
    // File handling
    let fileID = caches.files.get(file);
    if (!fileID) {
      const res = await db.getAsync('SELECT id FROM files WHERE name = ?', file);
      fileID = res?.id;
    }
  
    let locationID;
    if (!fileID) {
        // Memoise file metadata setup
        if (fs.existsSync(file) && !METADATA[file]) {
            METADATA[file] = await setMetadata({ file });
        }
      // Location
      if (Number.isNaN(lat) || Number.isNaN(lon)) {
        ({lat, lon, place} = { lat:defaultLat, lon:defaultLon, place:defaultPlace}); 
      }
      const locationKey = `${lat}_${lon}`;
      locationID = caches.locations.get(locationKey);
      if (!locationID && !(lat === defaultLat && lon === defaultLon && place === defaultPlace)) {
        let res = await db.getAsync('SELECT id FROM locations WHERE lat = ? AND lon = ?', lat, lon);
        if (!res) {
          res = await db.runAsync('INSERT OR IGNORE INTO locations (lat, lon, place) VALUES (?, ?, ?)', lat, lon, place);
          locationID = res.lastID;
        } else {
          locationID = res.id;
        }
        caches.locations.set(locationKey, locationID);
      }
  
      // File insert
      const fileStart = dateTime - (position * 1000);
      const res = await db.runAsync(
        'INSERT OR IGNORE INTO files (name, filestart, duration, locationID) VALUES (?, ?, ?, ?)',
        file, fileStart, METADATA[file]?.duration, locationID
      );
      fileID = res.lastID;
      caches.files.set(file, fileID);
    }
  
    // Tag handling
    let tagID = null;
    if (label) {
      tagID = caches.tags.get(label);
      if (!tagID) {
        let res = await db.getAsync('SELECT id FROM tags WHERE name = ?', label);
        if (!res) {
          res = await db.runAsync('INSERT OR IGNORE INTO tags (name) VALUES (?)', label);
          tagID = res.lastID;
        } else {
          tagID = res.id;
        }
        caches.tags.set(label, tagID);
      }
    }
  
    // Final insert
    await db.runAsync(
      `INSERT OR IGNORE INTO records (
        position, fileID, speciesID, 
        modelID, confidence, comment, end, callCount, tagID
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      position, fileID, speciesID, modelID, confidence, comment, end, callCount || undefined, tagID
    );
  
    return METADATA;
  }
  
module.exports = { importData }