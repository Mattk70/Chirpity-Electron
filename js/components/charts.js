const DEBUG = false;

const ZERO = new Date(1970, 0, 1)
const filterLocation = (location) =>
  location ? ` AND files.locationID = ${location}` : "";


function getWeekAndDayOfYearAndLeapLocal(ts) {
    const date = new Date(ts);
    const year = date.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    // ----- Leap year? -----
    const leapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    // ----- Day of year -----
    const dayOfYear = Math.floor((date - startOfYear) / 86400000) + 1;
    // ----- ISO week number (local time) -----
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    // ISO: Monday = 1, Sunday = 7
    const dayNum = d.getDay() === 0 ? 7 : d.getDay();
    // Move to Thursday of this ISO week
    d.setDate(d.getDate() + 4 - dayNum);
    // First day of that ISO week-year
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return { week, dayOfYear, leapYear };
}

const getSeasonRecords = async (diskDB, location, species, season) => {
  // Add Location filter
  const locationFilter = filterLocation(location);
  // Because we're using stmt.prepare, we need to unescape quotes
  const seasonMonth = { spring: "< '07'", autumn: " > '06'" };
  return new Promise(function (resolve, reject) {
    const stmt = diskDB.prepare(`
          SELECT MAX(SUBSTR(DATE(r.dateTime/1000, 'unixepoch', 'localtime'), 6)) AS maxDate,
          MIN(SUBSTR(DATE(r.dateTime/1000, 'unixepoch', 'localtime'), 6)) AS minDate
          FROM records r
          JOIN species ON species.id = r.speciesID
          JOIN files ON files.id = r.fileID
          WHERE species.cname = (?) ${locationFilter}
          AND STRFTIME('%m',
          DATETIME(r.dateTime / 1000, 'unixepoch', 'localtime'))
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

const getMostCalls = (diskDB, location, species) => {
  return new Promise(function (resolve, reject) {
    // Add Location filter
    const locationFilter = filterLocation(location);
    diskDB.get(
      `SELECT COUNT(*) as count,
      DATE(r.dateTime/1000, 'unixepoch', 'localtime') as date
      FROM records r
      JOIN species on species.id = r.speciesID
      JOIN files ON files.id = r.fileID
      WHERE species.cname = ? ${locationFilter}
      GROUP BY STRFTIME('%Y', DATETIME(r.dateTime/1000, 'unixepoch', 'localtime')),
      STRFTIME('%W', DATETIME(r.dateTime/1000, 'unixepoch', 'localtime')),
      STRFTIME('%d', DATETIME(r.dateTime/1000, 'unixepoch', 'localtime'))
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
  location,
  species = undefined,
  range = {},
  aggregation = "Week",
}) => {
  // Add Location filter
  const locationFilter = filterLocation(location);
  const useRange = range.start !== undefined;
  // Work out sensible aggregations from hours difference in date range
  const intervalHours = useRange
    ? Math.round((range.end - range.start) / (1000 * 60 * 60))
    : Infinity;
  DEBUG && console.log(intervalHours, "difference in hours");
  const speciesSQL = species ? ` AND species.cname = '${species}' ` : "";
  const dateFilter = range.start
    ? ` AND dateTime BETWEEN ${range.start} AND ${range.end} `
    : "";
  const whereSQL = speciesSQL || dateFilter || locationFilter ? "WHERE 1 " : "";
  // Default values for grouping
  let groupBy = "week";
  let orderBy = "year";
  let dataPoints = 53;
  let startIndex = 1;
  switch (aggregation) {
    case "week": {
      dataPoints = Math.min(53, Math.ceil(intervalHours / 168));
      const {week} = useRange ? getWeekAndDayOfYearAndLeapLocal(range.start) : {week:1} 
      startIndex = week;
      break;
    }
    case "Day": {
      groupBy += ", day";
      orderBy += ", week";
      let yearDays = 365;
      let startDay = 0;
      if (useRange) {
          const { leapYear, dayOfYear } = getWeekAndDayOfYearAndLeapLocal(range.start);
          yearDays = leapYear ? 366 : 365;
          startDay = dayOfYear;
      }
      dataPoints = Math.min(yearDays, Math.ceil(intervalHours / 24));
      startIndex = startDay;
      break;
    }
    case "Hour": {
      groupBy = "hour";
      orderBy = "CASE WHEN hour >= 12 THEN hour - 12 ELSE hour + 12 END";
      dataPoints = Math.min(24, intervalHours);
      const date = useRange ? new Date(range.start) : new Date(ZERO);
      startIndex = date.getHours();
      break;
    }
  }

  return new Promise(function (resolve, reject) {
    diskDB.all(
      `SELECT CAST(STRFTIME('%Y', DATETIME(dateTime / 1000, 'unixepoch', 'localtime')) AS INTEGER) AS year, 
          CAST(STRFTIME('%W', DATETIME(dateTime/1000, 'unixepoch', 'localtime')) AS INTEGER) AS week,
          CAST(STRFTIME('%j', DATETIME(dateTime/1000, 'unixepoch', 'localtime')) AS INTEGER) AS day, 
          CAST(STRFTIME('%H', DATETIME(dateTime/1000, 'unixepoch', 'localtime')) AS INTEGER) AS hour,    
          COUNT(*) as count
          FROM records
          JOIN species ON species.id = speciesID
          JOIN files ON files.id = fileID
          ${whereSQL} ${speciesSQL} ${dateFilter} ${locationFilter}
          GROUP BY ${groupBy}
          ORDER BY ${orderBy}`,
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve([rows, dataPoints, aggregation, startIndex]);
        }
      }
    );
  });
};

const getRate = (diskDB, location, species) => {
  return new Promise(function (resolve, reject) {
    const calls = Array.from({ length: 53 }).fill(0);
    const total = Array.from({ length: 53 }).fill(0);
    // Add Location filter
    const locationFilter = filterLocation(location);

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
/**
 * Handles chart data requests by gathering seasonal records, call detections, and aggregated chart totals for a given species and date range, then sending the compiled data to the UI.
 *
 * This function performs multiple asynchronous database queries to:
 * - Retrieve the earliest and latest record dates for "spring" and "autumn" seasons.
 * - Determine the date with the highest number of detections.
 * - Aggregate record counts based on the provided date range and aggregation type.
 * - Optionally compute total recording duration and call rate when weekly data (53 data points) is available.
 *
 * The compiled data is then sent to the UI via a postMessage call.
 *
 * @example
 * onChartRequest({
 *   diskDB,
 *   location,
 *   species: 'sparrow',
 *   range: { start: '2020-01-01', end: '2020-12-31' },
 *   UI
 * });
 *
 * @param {object} args - Request parameters that must include:
 *   - species {string} The species identifier for which to query records.
 *   - range {object} An object specifying the query date range (with at least a start property).
 * Note: Other properties like diskDB, location, and UI are used internally.
 */
async function onChartRequest(args) {
  const { diskDB, species, UI, byYear, location } = args;
  DEBUG &&
    console.log(`Getting chart for ${species} starting ${args.range.start}`);
  const range = args.range,
    results = {},
    dataRecords = {};
  // Escape apostrophes
  if (species) {
    await getSeasonRecords(diskDB, location, species, "spring")
      .then((result) => {
        dataRecords.earliestSpring = result["minDate"];
        dataRecords.latestSpring = result["maxDate"];
      })
      .catch((error) => {
        console.log(error);
      });

    await getSeasonRecords(diskDB, location, species, "autumn")
      .then((result) => {
        dataRecords.earliestAutumn = result["minDate"];
        dataRecords.latestAutumn = result["maxDate"];
      })
      .catch((error) => {
        console.log(error);
      });

    await getMostCalls(diskDB, location, species)
      .then((row) => {
        row
          ? (dataRecords.mostDetections = [row.count, row.date])
          : (dataRecords.mostDetections = ["N/A", "Not detected"]);
      })
      .catch((error) => {
        console.log(error);
      });
  }

  const [rows, dataPoints, aggregation, startIndex] = await getChartTotals(args)
    .catch((error) => console.log(error));
  const years = [...new Set(rows.map(o => o.year))];
  const hasMultipleYears = years.length > 1;
  for (let i = 0; i < rows.length; i++) {
    const { year, week, day, hour, count } = rows[i];
    // stack years
    const groupYear = !byYear && hasMultipleYears ? "All years" : year;
    if (!(groupYear in results)) {
      results[groupYear] = Array.from({ length: dataPoints }).fill(0);
    }
    if (aggregation === "Week") {
      const j = week - startIndex;
      results[groupYear][j] = (results[groupYear][j] ?? 0) + count;
    } else if (aggregation === "Day") {
      const j = day - startIndex;
      results[groupYear][j] = (results[groupYear][j] ?? 0) + count;
    } else {
      const j = hour - startIndex;
      results[groupYear][j] = (results[groupYear][j] ?? 0) + count;
    }
  }
  

  // If we have a years worth of data add total recording duration and rate
  let total, rate;
  if (dataPoints === 53) [total, rate] = await getRate(diskDB, location, species);
  const pointStart = (range.start ??= ZERO);
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
    startX: startIndex
  });
}

function plotTrainingHistory(history) {
  // Remove existing modal if present
  const oldModal = document.getElementById('trainingHistoryModal');
  if (oldModal) oldModal.remove();

  // Create modal HTML
  const modalHtml = `
    <div class="modal fade" id="trainingHistoryModal" tabindex="-1" aria-labelledby="trainingHistoryLabel" aria-hidden="true">
      <div class="modal-dialog modal-xl modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="trainingHistoryLabel">Training History</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <canvas id="historyChart" style="height: 50vh; width: 100%;"></canvas>
          </div>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modal = new bootstrap.Modal(document.getElementById('trainingHistoryModal'));
  modal.show();

  // Wait for modal to be shown before drawing chart
  document.getElementById('trainingHistoryModal').addEventListener('shown.bs.modal', () => {
    const ctx = document.getElementById('historyChart').getContext('2d');
    const labels = history.loss.map((_, i) => `Epoch ${i + 1}`);

    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Loss', data: history.loss, borderColor: 'red', fill: true, tension: 0.3 },
          { label: 'Val Loss', data: history.val_loss, borderColor: 'gold', fill: true, tension: 0.3 },
          { label: 'Accuracy', data: history.categoricalAccuracy, borderColor: 'green', fill: true, tension: 0.3 },
          { label: 'Val Accuracy', data: history.val_categoricalAccuracy, borderColor: 'blue', fill: true, tension: 0.3 }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Model Training Metrics'
          }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }, { once: true });
}

function _getISOWeekFromEpoch(epochMs) {
    const date = new Date(epochMs);

    // Copy date so we don’t modify the original
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

    // ISO week date weeks start on Monday (1) — shift Sunday (0) to 7
    const dayNum = d.getUTCDay() || 7;

    // Move the date to the Thursday of this week
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);

    // Calculate week number
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);

    return weekNo;
}
export { onChartRequest, plotTrainingHistory };
