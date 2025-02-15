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
    else {  db.exec("PRAGMA wal_checkpoint(TRUNCATE);", (err) => {
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
export { sqlite3, closeDatabase, checkpoint, Mutex };
