const DEBUG = false;

const sqlite3 = DEBUG ? require('sqlite3').verbose() : require('sqlite3');

// Promisify some methods
sqlite3.Database.prototype.runAsync = function (sql, ...params) {
    return new Promise((resolve, reject) => {
        this.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve(this);
        });
    });
};

sqlite3.Database.prototype.allAsync = function (sql, ...params) {
    return new Promise((resolve, reject) => {
        this.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
};

sqlite3.Statement.prototype.allAsync = function (...params) {
    if (DEBUG) console.log('SQL\n', this.sql, '\nParams\n', params)
    return new Promise((resolve, reject) => {
        this.all(params, (err, rows) => {
            if (err) return reject(err);
            console.log('\nRows:', rows)
            resolve(rows);
        });
    });
};

sqlite3.Database.prototype.getAsync = function (sql, ...params) {
    return new Promise((resolve, reject) => {
        this.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
};

export {sqlite3}