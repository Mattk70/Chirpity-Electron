/**
 * Initializes and configures the date picker elements for selecting date ranges.
 *
 * This function first removes any existing date picker instance stored in the global state,
 * then defines several preset date ranges (e.g., last night, this week, last month, etc.) based on the
 * current date. It creates new date pickers for the 'chartRange' and 'exploreRange' DOM elements using the easepick
 * library with Range, Preset, and Time plugins. Event listeners are attached to handle date selection,
 * clearing of the selection, button clicks, and visibility changes, updating the global state and communicating
 * with the worker as needed.
 *
 * @remark Relies on global variables (state, config, worker) and internationalization via get.
 */

import {Context, get} from '../utils/i18n.js';

/**
 * Initializes and configures date picker elements for both chart and explore UI controls.
 *
 * This function destroys any existing date picker instance held in the global state, computes preset date ranges
 * (e.g., this week, last month, last night), and creates a new easepick date picker with range, preset, and time
 * selection capabilities. It attaches event listeners to handle selection, clearing, clicks (for setting midnight or noon),
 * and visibility changes, updating the relevant state and communicating with a worker thread for subsequent processing.
 *
 * @param {Function} resetResults - Callback to reset the results UI by clearing summaries and pagination.
 * @param {Function} filterResults - Callback to update filtered results based on the newly selected date range.
 */
function initialiseDatePicker(state, worker, config, resetResults, filterResults) {
  let midnight = false;
  if (state.picker) {
    state.picker.destroy();
    delete state.picker;
  }
  const currentDate = new Date();

  const thisYear = () => {
    const d1 = new Date(currentDate.getFullYear(), 0, 1);
    return [d1, currentDate];
  };
  const lastYear = () => {
    const d1 = new Date(currentDate.getFullYear() - 1, 0, 1);
    const d2 = new Date(currentDate.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    return [d1, d2];
  };
  const thisMonth = () => {
    const startOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    return [startOfMonth, currentDate];
  };

  const lastMonth = () => {
    const startOfLastMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() - 1,
      1
    );
    const endOfLastMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      0,
      23,
      59,
      59,
      999
    );

    return [startOfLastMonth, endOfLastMonth];
  };
  const thisWeek = () => {
    const today = currentDate.getDay(); // 0 (Sunday) to 6 (Saturday)
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - today); // Move to the beginning of the week (Sunday)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Move to the end of the week (Saturday)
    return [startOfWeek, currentDate];
  };

  const lastWeek = () => {
    const today = currentDate.getDay(); // 0 (Sunday) to 6 (Saturday)
    const startOfLastWeek = new Date(currentDate);
    startOfLastWeek.setDate(currentDate.getDate() - today - 7); // Move to the beginning of the last week (Sunday)
    const endOfLastWeek = new Date(startOfLastWeek);
    endOfLastWeek.setDate(startOfLastWeek.getDate() + 6); // Move to the end of the last week (Saturday)
    return [startOfLastWeek, endOfLastWeek];
  };
  const lastNight = () => {
    const middayYesterday = new Date(currentDate);
    middayYesterday.setDate(currentDate.getDate() - 1);
    middayYesterday.setHours(12, 0, 0, 0); // Set to midday yesterday
    const middayToday = new Date(currentDate);
    middayToday.setHours(12, 0, 0, 0); // Set to midday today
    return [middayYesterday, middayToday];
  };
  const useMidnight = () => {
    return [new Date(), new Date()];
  };
  const useNoon = () => {
    return [new Date(), new Date()];
  };
  ["chartRange", "exploreRange"].forEach(function (element) {
    const i18 = get(Context);
    element = document.getElementById(element);
    state.picker = new easepick.create({
      element: element,
      lang: config.locale.replace(/_.*$/, ""),
      locale: {
        cancel: i18.cancel,
        apply: i18.apply,
      },
      css: ["./node_modules/@easepick/bundle/dist/index.css"],
      format: "H:mm MMM D, YYYY",
      zIndex: 10,
      calendars: 1,
      autoApply: false,
      plugins: ["RangePlugin", "PresetPlugin", "TimePlugin"],
      PresetPlugin: {
        customPreset: {
          [i18.lastNight]: lastNight(),
          [i18.thisWeek]: thisWeek(),
          [i18.lastWeek]: lastWeek(),
          [i18.thisMonth]: thisMonth(),
          [i18.lastMonth]: lastMonth(),
          [i18.thisYear]: thisYear(),
          [i18.lastYear]: lastYear(),
          [i18.midnight]: useMidnight(),
          [i18.noon]: useNoon(),
        },
      },
      RangePlugin: {
        locale: {
          one: i18.one,
          other: i18.other,
        },
      },
      TimePlugin: {
        format: "HH:mm",
      },
    });
    const picker = state.picker;
    picker.on("select", (e) => {
      const { start, end } = e.detail;
      //console.log("Range Selected!", JSON.stringify(e.detail));
      if (element.id === "chartRange") {
        state.chart.range = { start: start.getTime(), end: end.getTime() };
        worker.postMessage({ action: "update-state", chart: state.chart });
        t0 = Date.now();
        worker.postMessage({
          action: "chart",
          species: state.chart.species,
          range: state.chart.range,
          aggregation: state.chart.aggregation,
        });
      } else if (element.id === "exploreRange") {
        state.explore.range = { start: start.getTime(), end: end.getTime() };
        resetResults({
          clearSummary: true,
          clearPagination: true,
          clearResults: false,
        });
        worker.postMessage({
          action: "update-state",
          globalOffset: 0,
          filteredOffset: {},
          explore: state.explore,
        });
        filterResults({ range: state.explore.range });
      }

      // Update the seen species list
      worker.postMessage({ action: "get-detected-species-list" });
    });
    picker.on("clear", (e) => {
      console.log("Range Cleared!", JSON.stringify(e.detail));
      if (element.id === "chartRange") {
        state.chart.range = { start: undefined, end: undefined };
        worker.postMessage({ action: "update-state", chart: state.chart });
        t0 = Date.now();
        worker.postMessage({
          action: "chart",
          species: state.chart.species,
          range: state.chart.range,
          aggregation: state.chart.aggregation,
        });
      } else if (element.id === "exploreRange") {
        state.explore.range = { start: undefined, end: undefined };
        worker.postMessage({
          action: "update-state",
          globalOffset: 0,
          filteredOffset: {},
          explore: state.explore,
        });
        resetResults({
          clearSummary: true,
          clearPagination: true,
          clearResults: false,
        });
        filterResults({
          species: state.explore.species,
          range: state.explore.range,
        });
      }
    });
    picker.on("click", (e) => {
      const el = e.target;
      if (el.classList.contains("cancel-button")) {
        console.log("cancelled");
      } else if (el.textContent === `${i18.midnight}`) {
        midnight = true;
        picker.setEndTime('00:00')
        picker.setStartTime('00:00')
      } else if (el.textContent === `${i18.noon}`) {
        midnight = false;
        picker.setEndTime('12:00')
        picker.setStartTime('12:00')
      }
    });
    picker.on("show", () => {
      const time = midnight ? "00:00" :"12:00";
      picker.setStartTime(time);
      picker.setEndTime(time);
    });
    picker.on("hide", () => {
      const id = state.mode === "chart" ? "chartRange" : "exploreRange";
      const element = document.getElementById(id);
      if (!element.textContent) {
        // It's blank
        element.innerHTML = `<span class="material-symbols-outlined align-bottom">date_range</span><span>${state.i18n["explore-datefilter"]}</span> <span class="material-symbols-outlined float-end">expand_more</span>`;
      } else if (
        !element.textContent.includes(state.i18n["explore-datefilter"])
      ) {
        createDateClearButton(state, element, picker);
      }
    });
  });
}

/**
 * Appends a clear date filter button to a designated UI element.
 *
 * This function creates a clickable cancel icon that lets users clear an active date filter.
 * When clicked, it invokes the clear() method on the provided date picker instance and restores
 * the element's original content using localized text from the global state.
 *
 * @param {HTMLElement} element - The UI element displaying the active date filter.
 * @param {Object} picker - The date picker instance with a clear() method to remove the current selection.
 *
 * @example
 * // Assuming dateFilterElement is a valid HTMLElement and datePicker is a configured date picker instance:
 * createDateClearButton(state, dateFilterElement, datePicker);
 */
function createDateClearButton(state, element, picker) {
  const span = document.createElement("span");
  span.classList.add("material-symbols-outlined", "text-secondary", "ps-2");
  element.appendChild(span);
  span.textContent = "cancel";
  span.title = "Clear date filter";
  span.id = element.id + "-clear";
  span.addEventListener("click", (e) => {
    e.stopImmediatePropagation();
    picker.clear();
    element.innerHTML = `<span class="material-symbols-outlined align-bottom">date_range</span><span>${state.i18n["explore-datefilter"]}</span> <span class="material-symbols-outlined float-end">expand_more</span>`;
  });
}

export { initialiseDatePicker }