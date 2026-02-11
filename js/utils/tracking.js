/**
 * @file Helper functions for managing Matomo tracking.
 */

const ID_SITE = 3;
let VISITOR;
/**
 * Send an analytics event to the Matomo server.
 *
 * Normalizes the provided event details, encodes optional name/value fields, and dispatches a tracking request to the Matomo endpoint.
 * The `action` value is normalized so a single space becomes "Spacebar" and "+" becomes "Plus". If `name` is a string, digits following
 * the substring "result" are removed (e.g., "result12" → "result").
 *
 * @param {string} uuid - Visitor UUID used to associate the event with a visitor.
 * @param {string} event - Event category.
 * @param {string} action - Event action (will be normalized as described above).
 * @param {string} [name] - Optional event name; digits after "result" will be removed when present.
 * @param {string|number} [value] - Optional event value providing additional context.
 */
function trackEvent(uuid, event, action, name, value){
    // Squash result numbers
    name = typeof name == 'string' ? name.replace(/result\d+/, 'result') : name;
    if (action === ' ') action = 'Spacebar';
    else if (action === '+') action = 'Plus';
    const t = new Date()
    name = name ? `&e_n=${name}` : '';
    value = value ? `&e_v=${value}` : '';
    navigator.sendBeacon(`https://analytics.mattkirkland.co.uk/matomo.php?h=${t.getHours()}&m=${t.getMinutes()}&s=${t.getSeconds()}
        &action_name=Settings%20Change&idsite=${ID_SITE}&rand=${Date.now()}&rec=1&uid=${uuid}&apiv=1
        &e_c=${event}&e_a=${action}${name}${value}`)
}

/**
 * Send an initial visit payload to the Matomo analytics endpoint, store the visitor ID, and start periodic heartbeats.
 *
 * Posts visit and device/application dimensions to the analytics server and schedules a heartbeat every 20 minutes.
 *
 * @param {Object} config - Visit and environment information.
 * @param {string} config.UUID - Visitor UUID to associate with the visit.
 * @param {string} config.selectedModel - Key of the selected model.
 * @param {string} config.list - Model list identifier.
 * @param {boolean} config.useWeek - Whether weekly usage is enabled.
 * @param {string} config.locale - Current locale.
 * @param {number} config.speciesThreshold - Species detection threshold.
 * @param {Object} config.filters - Active filters configuration.
 * @param {Object} config.audio - Audio-related settings.
 * @param {Object} config.models - Map of models; used to derive backend-specific data.
 * @param {Object} config.detect - Detection configuration/details.
 * @param {string|number} config.CPU - CPU identifier or description.
 * @param {string|number} config.RAM - RAM amount or description.
 * @param {string|number} config.GPUs - GPU identifiers or description.
 * @param {string} config.VERSION - Application version.
 */
function trackVisit(config){
    const {UUID, selectedModel, list, useWeek, locale, speciesThreshold, filters, audio, models, detect, CPU, RAM, GPUs, VERSION} = config;
    VISITOR = UUID;
    const {width, height} = window.screen;
    navigator.sendBeacon(`https://analytics.mattkirkland.co.uk/matomo.php?idsite=${ID_SITE}&rand=${Date.now()}&rec=1&uid=${UUID}&apiv=1
            &res=${width}x${height}
            &dimension1=${selectedModel}
            &dimension2=${list}
            &dimension3=${useWeek}
            &dimension4=${locale}
            &dimension5=${speciesThreshold}
            &dimension6=${JSON.stringify(filters)}
            &dimension7=${JSON.stringify(audio)}
            &dimension8=${JSON.stringify(config[models[selectedModel].backend])}
            &dimension9=${JSON.stringify(detect)}
            &dimension11=${VERSION}
            &dimension12=${CPU}
            &dimension13=${RAM}
            &dimension14=${GPUs}`)
    setInterval(sendHeartbeat, 20 * 60 * 1000); // Send ping every 20 mins
}

// Function to send the heartbeat request
function sendHeartbeat() {
    const url = 'https://analytics.mattkirkland.co.uk/matomo.php';
    const params = new URLSearchParams({
        idsite: ID_SITE,         //  Matomo site ID
        rec: '1',            // Required to record the request
        ping: '1',           // Indicates this is a heartbeat request
        visitorId: VISITOR 
    });

    navigator.sendBeacon(`${url}?${params.toString()}`)
}

function customURLEncode(str) {
  return encodeURIComponent(str)
    .replace(/[!'()*]/g, (c) => {
      // Replacing additional characters not handled by encodeURIComponent
      return "%" + c.charCodeAt(0).toString(16).toUpperCase();
    })
    .replace(/%20/g, "+"); // Replace space with '+' instead of '%20'
}

/**
 * Overrides console.info, console.warn, and console.error
 * @param {Function} getUUID - Function returning the current UUID (e.g. () => STATE.UUID)
 */
function installConsoleTracking(getUUID, scriptSrc) {
    const override = (level, label) => {
        const original = console[level];
        console[level] = function (...args) {
            original.apply(console, args);
            if (args.length >= 2 && typeof getUUID === 'function') {
                trackEvent(
                    getUUID(),
                    label,
                    args[0],
                    customURLEncode(args[1])
                );
            }
        };
    };

    override('info', `${scriptSrc} Information`);
    override('warn', `${scriptSrc} Warning`);
    override('error', `${scriptSrc} Error`);
}

export {customURLEncode, installConsoleTracking, trackEvent, trackVisit}