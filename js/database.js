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
      if (err) return reject(err, console.log(err, this.sql));
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

async function upgrade_to_v1(diskDB, dbMutex) {
  let t0 = Date.now();
  try {
    await dbMutex.lock();
    await diskDB.runAsync("PRAGMA foreign_keys=OFF");
    await diskDB.runAsync("BEGIN");
    //1.10.x update
    await diskDB.runAsync(
      "CREATE INDEX IF NOT EXISTS idx_species_sname ON species(sname)"
    );
    await diskDB.runAsync(
      "CREATE INDEX IF NOT EXISTS idx_species_cname ON species(cname)"
    );
    const fileColumns = (await diskDB.allAsync("PRAGMA table_info(files)")).map(
      (row) => row.name
    );
    if (!fileColumns.includes("archiveName")) {
      await diskDB.runAsync("ALTER TABLE files ADD COLUMN archiveName TEXT");
    }
    if (!fileColumns.includes("metadata")) {
      await diskDB.runAsync("ALTER TABLE files ADD COLUMN metadata TEXT");
    }

    await diskDB.runAsync(
      "CREATE TABLE IF NOT EXISTS tags(id INTEGER PRIMARY KEY, name TEXT NOT NULL, UNIQUE(name))"
    );
    await diskDB.runAsync(
      "INSERT OR IGNORE INTO tags VALUES(0, 'Nocmig'), (1, 'Local')"
    );
    await diskDB.runAsync("ALTER TABLE records ADD COLUMN tagID INTEGER");
    await diskDB.runAsync(
      "UPDATE records SET tagID = 0 WHERE label = 'Nocmig'"
    );
    await diskDB.runAsync("UPDATE records SET tagID = 1 WHERE label = 'Local'");
    await diskDB.runAsync("ALTER TABLE records DROP COLUMN label");
    // Change label names to labelIDs
    await diskDB.runAsync("ALTER TABLE records ADD COLUMN reviewed INTEGER");

    await diskDB.runAsync(`CREATE TABLE records_temp( dateTime INTEGER, position INTEGER, fileID INTEGER, speciesID INTEGER, confidence INTEGER, 
      comment  TEXT, end INTEGER, callCount INTEGER, isDaylight INTEGER, reviewed INTEGER, tagID INTEGER,
      UNIQUE (dateTime, fileID, speciesID), 
      CONSTRAINT fk_files FOREIGN KEY (fileID) REFERENCES files(id) ON DELETE CASCADE,
      CONSTRAINT fk_species FOREIGN KEY (speciesID) REFERENCES species(id),
      CONSTRAINT fk_tags FOREIGN KEY (tagID) REFERENCES tags(id) ON DELETE SET NULL)`);
    await diskDB.runAsync("INSERT INTO records_temp SELECT * from records");
    await diskDB.runAsync("DROP TABLE records");
    await diskDB.runAsync("ALTER TABLE records_temp RENAME TO records");
    // Add old files table update
    await diskDB.runAsync(`
      CREATE TABLE files_new (
          id INTEGER PRIMARY KEY, 
          name TEXT NOT NULL, 
          duration REAL,
          filestart INTEGER, 
          locationID INTEGER, 
          archiveName TEXT, 
          metadata TEXT, 
          UNIQUE (name),
          CONSTRAINT fk_locations FOREIGN KEY (locationID) REFERENCES locations(id) ON DELETE SET NULL
      )`);
    await diskDB.runAsync("INSERT INTO files_new SELECT * FROM files");
    await diskDB.runAsync("DROP TABLE files");
    await diskDB.runAsync("ALTER TABLE files_new RENAME TO files");
    await diskDB.runAsync("UPDATE schema_version SET version = 1");
    await diskDB.runAsync("END");
    await diskDB.runAsync("PRAGMA foreign_keys=ON");
    await diskDB.runAsync("PRAGMA integrity_check");
    await diskDB.runAsync("PRAGMA foreign_key_check");
    console.info(
      "Migrated tags and added 'reviewed' column to ",
      diskDB.filename
    );
  } catch (e) {
    console.error("Error adding column and updating version", e.message, e);
    await diskDB.runAsync("ROLLBACK");
  } finally {
    await checkpoint(diskDB);
    dbMutex.unlock();
    console.info(`DB migration took ${Date.now() - t0}ms`);
  }
}

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

const createDB = async ({file, LABELS, diskDB, memoryDB, dbMutex}) => {
  const archiveMode = !!file;
  if (file) {
    fs.openSync(file, "w");
    diskDB = new sqlite3.Database(file);
    DEBUG && console.log("Created disk database", diskDB.filename);
  } else {
    memoryDB = new sqlite3.Database(":memory:");
    DEBUG && console.log("Created new in-memory database");
  }
  const db = archiveMode ? diskDB : memoryDB;

  await dbMutex.lock();
  try {
    db.locale = "en";
    await db.runAsync("BEGIN");
    await db.runAsync(
      "CREATE TABLE tags(id INTEGER PRIMARY KEY, name TEXT NOT NULL, UNIQUE(name))"
    );
    await db.runAsync("INSERT INTO tags VALUES(0, 'Nocmig'), (1, 'Local')");
    await db.runAsync(
      "CREATE TABLE species(id INTEGER PRIMARY KEY, sname TEXT NOT NULL, cname TEXT NOT NULL, UNIQUE(cname, sname))"
    );
    await db.runAsync(
      `CREATE TABLE locations( id INTEGER PRIMARY KEY, lat REAL NOT NULL, lon  REAL NOT NULL, place TEXT NOT NULL, UNIQUE (lat, lon))`
    );
    await db.runAsync(`CREATE TABLE files(id INTEGER PRIMARY KEY, name TEXT NOT NULL, duration REAL, filestart INTEGER, locationID INTEGER, archiveName TEXT, metadata TEXT, UNIQUE (name),
            CONSTRAINT fk_locations FOREIGN KEY (locationID) REFERENCES locations(id) ON DELETE SET NULL)`);
    // Ensure place names are unique too
    await db.runAsync(
      "CREATE UNIQUE INDEX idx_unique_place ON locations(lat, lon)"
    );
    await db.runAsync(`CREATE TABLE records( dateTime INTEGER, position INTEGER, fileID INTEGER, speciesID INTEGER, confidence INTEGER, 
      comment  TEXT, end INTEGER, callCount INTEGER, isDaylight INTEGER, reviewed INTEGER, tagID INTEGER,
      UNIQUE (dateTime, fileID, speciesID), 
      CONSTRAINT fk_files FOREIGN KEY (fileID) REFERENCES files(id) ON DELETE CASCADE,
      CONSTRAINT fk_species FOREIGN KEY (speciesID) REFERENCES species(id),
      CONSTRAINT fk_tags FOREIGN KEY (tagID) REFERENCES tags(id) ON DELETE SET NULL)`);
    await db.runAsync(
      `CREATE TABLE duration( day INTEGER, duration INTEGER, fileID INTEGER, UNIQUE (day, fileID), CONSTRAINT fk_files FOREIGN KEY (fileID) REFERENCES files(id) ON DELETE CASCADE)`
    );
    await db.runAsync("CREATE INDEX idx_species_sname ON species(sname)");
    await db.runAsync("CREATE INDEX idx_species_cname ON species(cname)");
    if (archiveMode) {
      await diskDB.runAsync(
        "CREATE TABLE schema_version (version INTEGER NOT NULL)"
      );
      await diskDB.runAsync("INSERT INTO schema_version (version) VALUES (2)");
      const stmt = db.prepare("INSERT INTO species VALUES (?, ?, ?)");
      try {
        // Only called when creating a new archive database
        for (let i = 0; i < LABELS.length; i++) {
          const [sname, cname] = LABELS[i].split("_");
          await stmt.runAsync(i, sname, cname);
        }
      } finally {
        // Ensure stmt is finalized
        stmt.finalize();
      }
    } else {
      const filename = diskDB?.filename;
      await db.runAsync("ATTACH ? as disk", filename);
      let response = await db.runAsync(
        "INSERT INTO files SELECT * FROM disk.files"
      );
      response = await db.runAsync(
        "INSERT INTO locations SELECT * FROM disk.locations"
      );
      DEBUG &&
        console.log(response.changes + " locations added to memory database");
      DEBUG &&
        console.log(response.changes + " files added to memory database");
      response = await db.runAsync(
        "INSERT INTO species SELECT * FROM disk.species"
      );
      DEBUG &&
        console.log(response.changes + " species added to memory database");

      response = await db.runAsync(
        "INSERT OR IGNORE INTO tags SELECT * FROM disk.tags"
      );
      DEBUG && console.log(response.changes + " tags added to memory database");
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


export {
  sqlite3,
  createDB,
  closeDatabase,
  checkpoint,
  upgrade_to_v1,
  upgrade_to_v2,
  Mutex,
};
