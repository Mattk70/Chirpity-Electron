const fs = require('node:fs');
const csv = require('@fast-csv/parse');


async function importData({db, file, format, METADATA, defaultLocation, setMetadata}){
    const caches = {
        models: new Map(),
        species: new Map(),
        tags: new Map(),
        locations: new Map(),
        files: new Map()
      };
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
  
  async function prepInsertParams({ db, row, defaultLocation, METADATA, setMetadata, caches }) {
    let { file, time, endTime, cname, confidence, label, comment, callCount, position, lat, lon, place, model } = row;
    const {defaultLat, defaultLon, defaultPlace} = defaultLocation;
    lat = parseFloat(lat);
    lon = parseFloat(lon);
    position = parseFloat(position);
    const dateTime = Date.parse(time);
    endTime = Date.parse(endTime);
    confidence *= 1000;
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
        error.variables = { model };
        throw error;
      }
      modelID = res.id;
      caches.models.set(model, modelID);
    }
  
    // Get speciesID from cache or DB
    const speciesKey = `${cname}_${modelID}`;
    let speciesID = caches.species.get(speciesKey);
    if (!speciesID) {
      const res = await db.getAsync('SELECT id FROM species WHERE cname = ? AND modelID = ?', cname, modelID);
      if (!res) {
        const error = new Error('noSpecies');
        error.variables = { cname };
        throw error;
      }
      speciesID = res.id;
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
        dateTime, position, fileID, speciesID, 
        modelID, confidence, comment, end, callCount, tagID
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      dateTime, position, fileID, speciesID, modelID, confidence, comment, end, callCount || undefined, tagID
    );
  
    return METADATA;
  }
  
module.exports = { importData }