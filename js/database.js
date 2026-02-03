/**
 * @file Utility functions for database interaction.
 */

const DEBUG = false;

const sqlite3 = DEBUG ? require("sqlite3").verbose() : require("sqlite3");

// Promisify some methods
sqlite3.Database.prototype.runAsync = function (sql, ...params) {
  return new Promise((resolve, reject) => {
    this.run(sql, params, function (err) {
      if (err) return reject(err, console.log(err, sql));
      resolve(this);
    });
  });
};

sqlite3.Statement.prototype.runAsync = function (...params) {
  if (DEBUG) console.log("SQL\n", this.sql, "\nParams\n", params);
  return new Promise((resolve, reject) => {
    this.run(params, (err) => {
      if (err) return reject(err, console.log(err, this.sql, params));
      // if (DEBUG) console.log('\nRows:', rows)
      resolve(this);
    });
  });
};

sqlite3.Database.prototype.allAsync = function (sql, ...params) {
  return new Promise((resolve, reject) => {
    this.all(sql, params, (err, rows) => {
      if (err) return reject(err, console.log(err, sql));
      resolve(rows);
    });
  });
};

sqlite3.Statement.prototype.allAsync = function (...params) {
  if (DEBUG) console.log("SQL\n", this.sql, "\nParams\n", params);
  return new Promise((resolve, reject) => {
    this.all(params, (err, rows) => {
      if (err) return reject(err, console.log(err, this.sql));
      if (DEBUG) console.log("\nRows:", rows);
      resolve(rows);
    });
  });
};
sqlite3.Statement.prototype.getAsync = function (...params) {
  if (DEBUG) console.log("SQL\n", this.sql, "\nParams\n", params);
  return new Promise((resolve, reject) => {
    this.get(params, (err, row) => {
      if (err) return reject(err, console.log(err, this.sql));
      if (DEBUG) console.log("\nRow:", row);
      resolve(row);
    });
  });
};

sqlite3.Database.prototype.getAsync = function (sql, ...params) {
  if (DEBUG) console.log("SQL\n", sql, "\nParams\n", params);
  return new Promise((resolve, reject) => {
    this.get(sql, params, (err, row) => {
      if (err) return reject(err, console.log(err, sql));
      resolve(row);
    });
  });
};

class Mutex {
  constructor() {
    this.queue = [];
    this.locked = false;
  }

  lock() {
    return new Promise((resolve) => {
      if (this.locked) {
        this.queue.push(resolve);
        console.log("mutex queue ", this.queue.length);
      } else {
        this.locked = true;
        resolve();
      }
    });
  }

  unlock() {
    if (this.queue.length > 0) {
      const nextResolve = this.queue.shift();
      console.log("mutex queue shifted", this.queue.length);
      nextResolve();
    } else {
      this.locked = false;
    }
  }
}

/**
 * Performs a Write-Ahead Logging (WAL) checkpoint on the provided SQLite database.
 *
 * If a valid database instance is supplied, this function executes the SQL command
 * "PRAGMA wal_checkpoint(TRUNCATE);" to perform a checkpoint, truncating the WAL log.
 * In the event of an error during execution, the error is logged and the returned Promise
 * is rejected with the error. If no database instance is provided, the Promise resolves immediately.
 *
 * @param {Object|null|undefined} db - The SQLite database instance on which to perform the checkpoint.
 *   If no database instance is provided (null or undefined), the checkpoint operation is skipped.
 * @returns {Promise<void>} A Promise that resolves when the checkpoint completes successfully or
 *   immediately if no database is provided, and rejects with an error if the checkpoint operation fails.
 *
 * @example
 * checkpoint(database)
 *   .then(() => console.log("WAL checkpoint completed successfully."))
 *   .catch(err => console.error("Error running WAL checkpoint:", err));
 */
function checkpoint(db) {
  return new Promise((resolve, reject) => {
    if (!db) resolve();
    else {
      db.exec("PRAGMA wal_checkpoint(TRUNCATE);", (err) => {
        if (err) {
          console.error("Error running WAL checkpoint:", err.message);
          reject(err);
        } else {
          console.log("WAL checkpoint completed.");
          resolve();
        }
      });
    }
  });
}

/**
 * Closes a SQLite database connection.
 *
 * This function attempts to close the provided database connection. If no database instance
 * is provided, the promise resolves immediately. In case of an error during the close operation,
 * the error is logged and the promise is rejected with the encountered error.
 *
 * @param {object|null|undefined} db - The SQLite database instance to close. If falsy, no action is taken.
 * @return {Promise<void>} A promise that resolves when the database is successfully closed or if no
 * database is provided, and rejects if an error occurs during the close operation.
 *
 * @example
 * closeDatabase(db)
 *   .then(() => console.log("Database closed successfully."))
 *   .catch(err => console.error("Error closing database:", err));
 */
function closeDatabase(db) {
  return new Promise((resolve, reject) => {
    if (!db) resolve();
    else {
      db.close((err) => {
        if (err) {
          console.error("Error closing database:", err.message);
          reject(err);
        } else {
          console.log("Database connection closed.");
          resolve();
        }
      });
    }
  });
}



/**
 * Migrates the database schema to version 2 by adding a unique constraint on the `species` table.
 *
 * Recreates the `species` table with a unique constraint on the combination of `cname` and `sname`, updates the schema version, and performs integrity checks. The migration is executed within a mutex lock to ensure concurrency safety.
 *
 * @remark Rolls back the transaction if an error occurs during migration.
 */
async function upgrade_to_v2(diskDB, dbMutex) {
  let t0 = Date.now();
  try {
    await dbMutex.lock();
    await diskDB.runAsync("PRAGMA foreign_keys=OFF");
    await diskDB.runAsync("BEGIN");
    await diskDB.runAsync(
      "CREATE TABLE species_new(id INTEGER PRIMARY KEY, sname TEXT NOT NULL, cname TEXT NOT NULL, UNIQUE(cname, sname))"
    );
    await diskDB.runAsync("INSERT INTO species_new SELECT * FROM species");
    await diskDB.runAsync("DROP TABLE species");
    await diskDB.runAsync("ALTER TABLE species_new RENAME TO species");

    await diskDB.runAsync("UPDATE schema_version SET version = 2");
    await diskDB.runAsync("END");
    await diskDB.runAsync("PRAGMA foreign_keys=ON");
    await diskDB.runAsync("PRAGMA integrity_check");
    await diskDB.runAsync("PRAGMA foreign_key_check");
    console.info(`Adding species unique constraint took ${Date.now() - t0}ms`);
  } catch (e) {
    console.error("Error adding unique constraint ", e.message, e);
    await diskDB.runAsync("ROLLBACK");
  } finally {
    await checkpoint(diskDB);
    dbMutex.unlock();
  }
}

/**
 * Migrates the database schema to version 4 by dropping datetime from the `records` table.
 *
 * @remark Rolls back the transaction if an error occurs during migration.
 */
async function upgrade_to_v4(diskDB, dbMutex) {
  let t0 = Date.now();
  try {
    await dbMutex.lock();
    await diskDB.runAsync("PRAGMA foreign_keys=OFF");
    await diskDB.runAsync("BEGIN");
    await diskDB.runAsync(
      `CREATE TABLE records_new
        (position REAL, fileID INT, speciesID INT, modelID INT, 
        confidence INT, comment TEXT, end REAL, callcount INT, isDaylight BOOL, 
        reviewed BOOL, tagID INT,
        UNIQUE (position, fileID, speciesID, modelID), 
        CONSTRAINT fk_files FOREIGN KEY (fileID) REFERENCES files(id) ON DELETE CASCADE, 
        CONSTRAINT fk_tags FOREIGN KEY (tagID) REFERENCES tags(id) ON DELETE SET NULL)`
    );
    await diskDB.runAsync(
      `INSERT OR IGNORE INTO records_new (position, fileID, speciesID, modelID, confidence, 
        comment, end, callcount, isDaylight, reviewed, tagid)
        SELECT position, fileID, speciesID, modelID, confidence, 
        comment, end, callcount, isDaylight, reviewed, tagid FROM records;`
    );
    await diskDB.runAsync("DROP TABLE records");
    await diskDB.runAsync("ALTER TABLE records_new RENAME TO records");
    await diskDB.runAsync("CREATE INDEX idx_records_modelID ON records(modelID)");
    await diskDB.runAsync("UPDATE schema_version SET version = 4");
    await diskDB.runAsync("PRAGMA foreign_keys=ON");
    await diskDB.runAsync("PRAGMA integrity_check");
    await diskDB.runAsync("PRAGMA foreign_key_check");
    await diskDB.runAsync("END");
    console.info(`Dropping records datetime took ${Date.now() - t0}ms`);
  } catch (e) {
    console.error("Error dropping datetime", e.message, e);
    await diskDB.runAsync("ROLLBACK");
  } finally {
    await checkpoint(diskDB);
    dbMutex.unlock();
  }
}

const createDB = async ({file, diskDB, dbMutex}) => {
  const archiveMode = !!file;
  let memoryDB;
  if (archiveMode) {
    const {openSync} = require('node:fs');
    openSync(file, "w");
    diskDB = new sqlite3.Database(file);
    DEBUG && console.log("Created disk database", diskDB.filename);
  } else {
    memoryDB = new sqlite3.Database(":memory:");
    DEBUG && console.log("Created new in-memory database");
  }
  const db = archiveMode ? diskDB : memoryDB;

  await dbMutex.lock();
  try {
    await db.runAsync("BEGIN");
    await db.runAsync(
      `CREATE TABLE tags(
        id INTEGER PRIMARY KEY, 
        name TEXT NOT NULL, 
        UNIQUE(name)
      )`
    );
    await db.runAsync("INSERT INTO tags VALUES(0, 'Nocmig'), (1, 'Local')");
    await db.runAsync(`
      CREATE TABLE models (
        id INTEGER PRIMARY KEY, 
        name TEXT NOT NULL, UNIQUE(name)
      )`
    );
    await db.runAsync("INSERT INTO models VALUES(0, 'user')");
    await db.runAsync(
      `CREATE TABLE species(
        id INTEGER PRIMARY KEY, 
        sname TEXT NOT NULL, 
        cname TEXT NOT NULL, 
        modelID INTEGER NOT NULL,
        classIndex INTEGER NOT NULL,
        UNIQUE (modelID, classIndex),
        UNIQUE (modelID, sname, cname),
        FOREIGN KEY (modelID) REFERENCES models(id) ON DELETE CASCADE
      )`
    );
    await db.runAsync(`
      CREATE TABLE  confidence_overrides(
      speciesID INTEGER PRIMARY KEY, 
      minConfidence INTEGER)`);
    await db.runAsync(
      `CREATE TABLE locations(
        id INTEGER PRIMARY KEY, 
        lat REAL NOT NULL,
        lon REAL NOT NULL,
        place TEXT NOT NULL,
        UNIQUE (lat, lon)
      )`
    );
    await db.runAsync(
      `CREATE TABLE files(
        id INTEGER PRIMARY KEY, 
        name TEXT NOT NULL, 
        duration REAL, 
        filestart INTEGER, 
        locationID INTEGER, 
        archiveName TEXT, 
        metadata TEXT, 
        UNIQUE (name),
        CONSTRAINT fk_locations FOREIGN KEY (locationID) REFERENCES locations(id) ON DELETE SET NULL
      )`
    );

    await db.runAsync(
      `CREATE TABLE records( 
        position INTEGER,
        fileID INTEGER, 
        speciesID INTEGER,
        modelID INTEGER,
        confidence INTEGER, 
        comment TEXT,
        end INTEGER,
        callCount INTEGER, 
        isDaylight INTEGER, 
        reviewed INTEGER, 
        tagID INTEGER,
        UNIQUE (position, fileID, speciesID, modelID), 
        CONSTRAINT fk_files FOREIGN KEY (fileID) REFERENCES files(id) ON DELETE CASCADE,
        CONSTRAINT fk_tags FOREIGN KEY (tagID) REFERENCES tags(id) ON DELETE SET NULL
      )`
    );
    await db.runAsync(
      `CREATE TABLE duration(
        day INTEGER, 
        duration INTEGER, 
        fileID INTEGER, 
        UNIQUE (day, fileID), 
        CONSTRAINT fk_files FOREIGN KEY (fileID) REFERENCES files(id) ON DELETE CASCADE
      )`
    );
    await db.runAsync("CREATE INDEX idx_species_sname ON species(sname)");
    await db.runAsync("CREATE INDEX idx_species_cname ON species(cname)");
    if (archiveMode) {
      await diskDB.runAsync(
        `CREATE TABLE schema_version(
          version INTEGER NOT NULL
        )`
      );
      await diskDB.runAsync("INSERT INTO schema_version (version) VALUES (4)");
      console.log('version table created')
    } else {
      const filename = diskDB?.filename;
      await db.runAsync("ATTACH ? as disk", filename);
      let response = await db.runAsync(
        "INSERT INTO files SELECT * FROM disk.files"
      );
      DEBUG &&
        console.log(response.changes + " files added to memory database");
      response = await db.runAsync(
        "INSERT INTO locations SELECT * FROM disk.locations"
      );
      DEBUG &&
        console.log(response.changes + " locations added to memory database");
      response = await db.runAsync(
        "INSERT INTO species SELECT * FROM disk.species"
      );
      DEBUG &&
        console.log(response.changes + " species added to memory database");

      response = await db.runAsync(
        "INSERT OR IGNORE INTO tags SELECT * FROM disk.tags"
      );
      DEBUG && console.log(response.changes + " tags added to memory database");

      response = await db.runAsync(
        "INSERT OR IGNORE INTO models SELECT * FROM disk.models"
      );
      DEBUG && console.log(response.changes + " models added to memory database");
    }
    await db.runAsync("END");
  } catch (error) {
    console.error("Error during DB transaction:", error);
    await db.runAsync("ROLLBACK"); // Rollback the transaction in case of error
  } finally {
    dbMutex.unlock();
  }
  return db;
};


const addNewModel = async ({model, db = diskDB, dbMutex, labelsLocation}) => {
  let modelID;
  try {
    await dbMutex.lock();
    await db.runAsync('BEGIN');
    let result = await db.runAsync('INSERT INTO models (name) VALUES (?)', model)
    modelID = result.lastID;
    // We need to get the default labels from the config file
    // There may not be a db, or the db may not have the labels required 
    let labels;
    const {readFileSync} = require('node:fs');
    const path = require('node:path');
    if (model === "birdnet") {
      const labelFile = path.join(__dirname, "labels", "V2.4",
         "BirdNET_GLOBAL_6K_V2.4_Labels_en.txt");
        const fileContents = readFileSync(labelFile, "utf8");
          labels = fileContents.trim().split(/\r?\n/);
    } else if (['chirpity', 'nocmig'].includes(model)){
      labels = JSON.parse(
        readFileSync(path.join(__dirname, `${model}_model_config.json`), "utf8")
      ).labels;
    } else {
      // Custom model
      const labelFile = labelsLocation
      const fileContents = readFileSync(labelFile, "utf8");
      // Trim whitespace and split by new lines, ignoring empty lines
      labels = fileContents.split(/\r?\n/).map(line => line.trim()).filter(line => line.length);
    }
    const perch = model === 'perch v2';
    const splitChar = perch ? '~' : '_'; // Perch uses ~, others use _
    const expectedParts = perch ? 3 : 2; // Perch labels include Taxon
    // Add Unknown Sp.
    if (perch) labels.push(`Unknown Sp.${splitChar}Unknown Sp.${splitChar}None`);
    else labels.push(`Unknown Sp.${splitChar}Unknown Sp.`);

    // Insert labels in batches to avoid exceeding SQLite parameter limits
    const MAX_PARAMS = 25000;
    const PARAMS_PER_ROW = 4;
    const MAX_ROWS_PER_BATCH = Math.floor(MAX_PARAMS / PARAMS_PER_ROW);
    for (let i = 0; i < labels.length; i += MAX_ROWS_PER_BATCH) {
      const batch = labels.slice(i, i + MAX_ROWS_PER_BATCH);

      let insertQuery = `INSERT INTO species (sname, cname, modelID, classIndex) VALUES `;
      const params = [];
      batch.forEach((entry, index) => {
        const parts = entry.split(splitChar);
        if (parts.length < 2 || parts.length > expectedParts) {
          const err = `Invalid label: '${entry}' on line ${i + index + 1}. Expected 'scientific name${splitChar}common name[${splitChar}taxon]' format.`;
          throw new Error(err);
        }
        const [sname, cname] = parts.map(s => s.trim());  // taxon (3rd part) not currently in DB schema
        insertQuery += '(?, ?, ?, ?),';
        params.push(sname, cname, modelID, i + index);
      });

      insertQuery = insertQuery.slice(0, -1); // Remove trailing comma
      await db.runAsync(insertQuery, ...params);
    }
    await db.runAsync('COMMIT');
  } catch (err) {
    await db.runAsync('ROLLBACK');
    console.error(`Error inserting species for "${model}":`, err.message);
    modelID = err;
  } finally {
    dbMutex.unlock();
  }
  return modelID;
}

const mergeDbIfNeeded = async ({diskDB, model, appPath, dbMutex, labelsLocation}) => {
  // Check if we have this model already
  const modelRow = await diskDB.getAsync(`SELECT id FROM models WHERE name = ?`, model);

  if (modelRow) return [modelRow.id, false]
  // If not, let's look for a legacy database
  const models = {birdnet: '6523', chirpity: '409', nocmig: '432'}
  const p = require('node:path');
  const legacyDbPath = p.join(appPath, 'archive' + models[model] + '.sqlite')
  // Check if model DB exists
  const {existsSync} = require('node:fs');
  const dbNotFound = !existsSync(legacyDbPath);
  const isCustomDB = !diskDB.filename.includes(appPath);
  DEBUG && console.log('isCustomDB:', isCustomDB);
  if (dbNotFound) {
    console.log(`Model database not found: ${legacyDbPath}`);
    const modelID = await addNewModel({model, db:diskDB, dbMutex, labelsLocation})
    // translation needed
    return [modelID, true]
  }
  let modelID;
  // Migration. Step 1: Attach the old model db
  try {
    // Run schema update on existing database if needed
    const legacyDB = new sqlite3.Database(legacyDbPath)
    // Add empty version table if not exists
    await legacyDB.runAsync(
      "CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)"
    );
    const row = await legacyDB.getAsync(`SELECT version FROM schema_version`);
    let user_version;
    if (!row) {
      let res = await legacyDB.getAsync("PRAGMA user_version");
      user_version =  res?.version || 0;
      await legacyDB.runAsync(
        "INSERT INTO schema_version (version) VALUES (?)",
        user_version
      );
    } else {
      user_version = row.version;
    }

    if (user_version < 2) {
      await upgrade_to_v2(legacyDB, dbMutex);
    }

    await dbMutex.lock();
    await diskDB.runAsync('BEGIN');
    await diskDB.runAsync('ATTACH DATABASE ? AS modelDb', legacyDbPath)
    let result = await diskDB.runAsync('INSERT INTO models (name) VALUES (?)', model)
    modelID = result.lastID;
    // Copy species across
    await diskDB.runAsync(`
      INSERT INTO species (sname, cname, modelID, classIndex)
      SELECT sname, cname, ?, id
      FROM modelDb.species
      `,  modelID);
    if (!isCustomDB){
      // Migrate and de-duplicate tags
      await diskDB.runAsync(`
        INSERT OR IGNORE INTO tags (name)
        SELECT name FROM modelDb.tags
      `)

      // Create temporary mapping table for tags
      await diskDB.runAsync(`
          CREATE TEMP TABLE tag_map AS
          SELECT modelDb.tags.id AS oldID, unified.id AS newID
          FROM modelDb.tags
          JOIN tags AS unified
            ON modelDb.tags.name = unified.name
        `);

      // Migrate and de-duplicate locations
      await diskDB.runAsync(`
        INSERT OR IGNORE INTO locations (lat, lon, place)
        SELECT lat, lon, place FROM modelDb.locations
      `);

      // Create temporary mapping table for locations
      await diskDB.runAsync(`
        CREATE TEMP TABLE location_map AS
        SELECT modelDb.locations.id AS oldID, unified.id AS newID
        FROM modelDb.locations
        JOIN locations AS unified
          ON modelDb.locations.lat = unified.lat
        AND modelDb.locations.lon = unified.lon
      `);

      // Migrate and de-duplicate files
      await diskDB.runAsync(`
        INSERT OR IGNORE INTO files (name, duration, filestart, locationID, archiveName, metadata)
        SELECT f.name, f.duration, f.filestart, lm.newID, f.archiveName, f.metadata
        FROM modelDb.files f
        LEFT JOIN location_map lm ON f.locationID = lm.oldID
      `);

      // Create temporary mapping table for files
      await diskDB.runAsync(`
        CREATE TEMP TABLE file_map AS
        SELECT modelDb.files.id AS oldID, unified.id AS newID
        FROM modelDb.files
        JOIN files AS unified
          ON modelDb.files.name = unified.name
      `);



      // Create temporary mapping table for species
      await diskDB.runAsync(`
        CREATE TEMP TABLE species_map AS
        SELECT modelDb.species.id AS oldID, unified.id AS newID
        FROM modelDb.species
        JOIN species AS unified
          ON modelDb.species.sname = unified.sname
          AND modelDb.species.cname = unified.cname
          AND unified.modelID = ?
        `, modelID);


      // Migrate records with updated foreign keys
      await diskDB.runAsync(`
        INSERT INTO records (position, fileID, speciesID, modelID, confidence, comment, end, callCount, isDaylight, reviewed, tagID)
        SELECT r.position, fm.newID, sm.newID, ?, r.confidence, r.comment, r.end, r.callCount, r.isDaylight, r.reviewed, tm.newID
        FROM modelDb.records r
        JOIN file_map fm ON r.fileID = fm.oldID
        JOIN species_map sm ON r.speciesID = sm.oldID
        LEFT JOIN tag_map tm ON r.tagID = tm.oldID
      `, modelID);

      // Tidy up
      await diskDB.runAsync(`DROP TABLE location_map`);
      await diskDB.runAsync(`DROP TABLE file_map`);
      await diskDB.runAsync(`DROP TABLE tag_map`);
      await diskDB.runAsync(`DROP TABLE species_map`);
    }
    await diskDB.runAsync('END');
    await diskDB.runAsync(`DETACH DATABASE modelDb`);
  } catch (err) {
    console.error(`Error migrating model "${model}":`, err.message);
    await diskDB.runAsync('ROLLBACK');
  } finally {
    dbMutex.unlock()
  }
  // Set the local to English after migration so all labels will get the translation treatment
  diskDB.locale = 'en'
  return [modelID, false]
}

export {
  sqlite3,
  createDB,
  closeDatabase,
  checkpoint,
  Mutex,
  mergeDbIfNeeded,
  addNewModel,
  upgrade_to_v4
};
