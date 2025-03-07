const DEBUG = false;
const filterLocation = (state) =>
    state.locationID ? ` AND files.locationID = ${state.locationID}` : "";

const getSeasonRecords = async (diskDB, state, species, season) => {
    // Add Location filter
    const locationFilter = filterLocation(state);
    // Because we're using stmt.prepare, we need to unescape quotes
    const seasonMonth = { spring: "< '07'", autumn: " > '06'" };
    return new Promise(function (resolve, reject) {
      const stmt = diskDB.prepare(`
          SELECT MAX(SUBSTR(DATE(records.dateTime/1000, 'unixepoch', 'localtime'), 6)) AS maxDate,
          MIN(SUBSTR(DATE(records.dateTime/1000, 'unixepoch', 'localtime'), 6)) AS minDate
          FROM records
          JOIN species ON species.id = records.speciesID
          JOIN files ON files.id = records.fileID
          WHERE species.cname = (?) ${locationFilter}
          AND STRFTIME('%m',
          DATETIME(records.dateTime / 1000, 'unixepoch', 'localtime'))
          ${seasonMonth[season]}`);
      stmt.get(species, (err, row) => {
        if (err) {
          stmt.finalize();
          reject(err);
        } else {
          stmt.finalize();
          resolve(row);
        }
      });
    });
  };
  
  const getMostCalls = (diskDB, state, species) => {
    return new Promise(function (resolve, reject) {
      // Add Location filter
      const locationFilter = filterLocation(state);
      diskDB.get(
        `
          SELECT COUNT(*) as count, 
          DATE(dateTime/1000, 'unixepoch', 'localtime') as date
          FROM records 
          JOIN species on species.id = records.speciesID
          JOIN files ON files.id = records.fileID
          WHERE species.cname = ? ${locationFilter}
          GROUP BY STRFTIME('%Y', DATETIME(dateTime/1000, 'unixepoch', 'localtime')),
          STRFTIME('%W', DATETIME(dateTime/1000, 'unixepoch', 'localtime')),
          STRFTIME('%d', DATETIME(dateTime/1000, 'unixepoch', 'localtime'))
          ORDER BY count DESC LIMIT 1`,
        species,
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  };
  
  const getChartTotals = ({
    diskDB,
    state,
    species = undefined,
    range = {},
    aggregation = "Week",
  }) => {
    // Add Location filter
    const locationFilter = filterLocation(state);
    const dateRange = range;
  
    // Work out sensible aggregations from hours difference in date range
    const hours_diff = dateRange.start
      ? Math.round((dateRange.end - dateRange.start) / (1000 * 60 * 60))
      : 745;
    DEBUG && console.log(hours_diff, "difference in hours");
  
    const dateFilter = dateRange.start
      ? ` AND dateTime BETWEEN ${dateRange.start} AND ${dateRange.end} `
      : "";
  
    // Default values for grouping
    let groupBy = "Year, Week";
    let orderBy = "Year";
    let dataPoints = Math.max(52, Math.round(hours_diff / 24 / 7));
    let startDay = 0;
  
    // Update grouping based on aggregation parameter
    if (aggregation === "Day") {
      groupBy += ", Day";
      orderBy = "Year, Week";
      dataPoints = Math.round(hours_diff / 24);
      const date =
        dateRange.start !== undefined
          ? new Date(dateRange.start)
          : new Date(Date.UTC(2020, 0, 0, 0, 0, 0));
      startDay = Math.floor(
        (date - new Date(date.getFullYear(), 0, 0, 0, 0, 0)) / 1000 / 60 / 60 / 24
      );
    } else if (aggregation === "Hour") {
      groupBy = "Hour";
      orderBy = "CASE WHEN Hour >= 12 THEN Hour - 12 ELSE Hour + 12 END";
      dataPoints = 24;
      const date =
        dateRange.start !== undefined
          ? new Date(dateRange.start)
          : new Date(Date.UTC(2020, 0, 0, 0, 0, 0));
      startDay = Math.floor(
        (date - new Date(date.getFullYear(), 0, 0, 0, 0, 0)) / 1000 / 60 / 60 / 24
      );
    }
  
    return new Promise(function (resolve, reject) {
      diskDB.all(
        `SELECT CAST(STRFTIME('%Y', DATETIME(dateTime / 1000, 'unixepoch', 'localtime')) AS INTEGER) AS Year, 
          CAST(STRFTIME('%W', DATETIME(dateTime/1000, 'unixepoch', 'localtime')) AS INTEGER) AS Week,
          CAST(STRFTIME('%j', DATETIME(dateTime/1000, 'unixepoch', 'localtime')) AS INTEGER) AS Day, 
          CAST(STRFTIME('%H', DATETIME(dateTime/1000, 'unixepoch', 'localtime')) AS INTEGER) AS Hour,    
          COUNT(*) as count
          FROM records
          JOIN species ON species.id = speciesID
          JOIN files ON files.id = fileID
          WHERE species.cname = ? ${dateFilter} ${locationFilter}
          GROUP BY ${groupBy}
          ORDER BY ${orderBy}`,
        species,
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve([rows, dataPoints, aggregation, startDay]);
          }
        }
      );
    });
  };
  
  const getRate = (diskDB, state, species) => {
    return new Promise(function (resolve, reject) {
      const calls = Array.from({ length: 52 }).fill(0);
      const total = Array.from({ length: 52 }).fill(0);
      // Add Location filter
      const locationFilter = filterLocation(state);
  
      diskDB.all(
        `select STRFTIME('%W', DATE(dateTime / 1000, 'unixepoch', 'localtime')) as week, COUNT(*) as calls
          from records
          JOIN species ON species.id = records.speciesID
          JOIN files ON files.id = records.fileID
          WHERE species.cname = ? ${locationFilter}
          group by week;`,
        species,
        (err, rows) => {
          for (let i = 0; i < rows.length; i++) {
            calls[parseInt(rows[i].week) - 1] = rows[i].calls;
          }
          diskDB.all(
            "select STRFTIME('%W', DATE(duration.day / 1000, 'unixepoch', 'localtime')) as week, cast(sum(duration) as real)/3600  as total from duration group by week;",
            (err, rows) => {
              for (let i = 0; i < rows.length; i++) {
                // Round the total to 2 dp
                total[parseInt(rows[i].week) - 1] =
                  Math.round(rows[i].total * 100) / 100;
              }
              let rate = [];
              for (let i = 0; i < calls.length; i++) {
                total[i] > 0
                  ? (rate[i] = Math.round((calls[i] / total[i]) * 100) / 100)
                  : (rate[i] = 0);
              }
              if (err) {
                reject(err);
              } else {
                resolve([total, rate]);
              }
            }
          );
        }
      );
    });
  };
  async function onChartRequest(args) {
    const {diskDB, state, species, UI} = args;
    DEBUG &&
      console.log(
        `Getting chart for ${species} starting ${args.range.start}`
      );
    const dateRange = args.range,
      results = {},
      dataRecords = {};
    // Escape apostrophes
    if (species) {
      t0 = Date.now();
      await getSeasonRecords(diskDB, state, species, "spring")
        .then((result) => {
          dataRecords.earliestSpring = result["minDate"];
          dataRecords.latestSpring = result["maxDate"];
        })
        .catch((error) => {
          console.log(error);
        });
  
      await getSeasonRecords(diskDB, state, species, "autumn")
        .then((result) => {
          dataRecords.earliestAutumn = result["minDate"];
          dataRecords.latestAutumn = result["maxDate"];
        })
        .catch((error) => {
          console.log(error);
        });
  
      DEBUG &&
        console.log(
          `Season chart generation took ${(Date.now() - t0) / 1000} seconds`
        );
      t0 = Date.now();
      await getMostCalls(diskDB, state, species)
        .then((row) => {
          row
            ? (dataRecords.mostDetections = [row.count, row.date])
            : (dataRecords.mostDetections = ["N/A", "Not detected"]);
        })
        .catch((error) => {
          console.log(error);
        });
  
      DEBUG &&
        console.log(
          `Most calls  chart generation took ${(Date.now() - t0) / 1000} seconds`
        );
      t0 = Date.now();
    }

    const [dataPoints, aggregation] = await getChartTotals(args)
      .then(([rows, dataPoints, aggregation, startDay]) => {
        for (let i = 0; i < rows.length; i++) {
          const year = rows[i].Year;
          const week = rows[i].Week;
          const day = rows[i].Day;
          const hour = rows[i].Hour;
          const count = rows[i].count;
          // stack years
          if (!(year in results)) {
            results[year] = Array.from({ length: dataPoints }).fill(0);
          }
          if (aggregation === "Week") {
            results[year][parseInt(week) - 1] = count;
          } else if (aggregation === "Day") {
            results[year][parseInt(day) - startDay] = count;
          } else {
            // const d = new Date(dateRange.start);
            // const hoursOffset = d.getHours();
            // const index = ((parseInt(day) - startDay) * 24) + (parseInt(hour) - hoursOffset);
            results[year][hour] = count;
          }
        }
        return [dataPoints, aggregation];
      })
      .catch((error) => {
        console.log(error);
      });
  
    DEBUG &&
      console.log(
        `Chart series generation took ${(Date.now() - t0) / 1000} seconds`
      );
    t0 = Date.now();
    // If we have a years worth of data add total recording duration and rate
    let total, rate;
    if (dataPoints === 52) [total, rate] = await getRate(diskDB, state, species);
    DEBUG &&
      console.log(
        `Chart rate generation took ${(Date.now() - t0) / 1000} seconds`
      );
    const pointStart = (dateRange.start ??= Date.UTC(2020, 0, 0, 0, 0, 0));
    UI.postMessage({
      event: "chart-data", // Restore species name
      species,
      results,
      rate,
      total,
      records: dataRecords,
      dataPoints,
      pointStart,
      aggregation,
    });
  }
  module.exports = { onChartRequest };