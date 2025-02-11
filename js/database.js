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

export { sqlite3, Mutex };
