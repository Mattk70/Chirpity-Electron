/**
 * @file Helper functions for managing Matomo tracking.
 */

const ID_SITE = 3;
let VISITOR;
/**
 * Logs an event to the Matomo analytics system.
 *
 * Constructs and dispatches an asynchronous GET request to the Matomo tracking API using the provided event details.
 * The event name is sanitized by replacing any digits following "result" with an empty string, and the action parameter
 * is adjusted: a single space converts to "Spacebar" and a plus sign converts to "Plus". The request URL embeds the
 * current time (hours, minutes, seconds), site ID, visitor UUID, event category, action, and optional event name and value.
 *
 * The function initiates an asynchronous fetch; if the network response is not OK, an error is thrown internally and
 * then logged to the console.
 *
 * @param {string} uuid - Unique identifier of the visitor.
 * @param {string} event - Event category for classification.
 * @param {string} action - Event action; " " becomes "Spacebar" and "+" becomes "Plus".
 * @param {string} [name] - Optional event name; any digits following "result" are removed.
 * @param {(string|number)} [value] - Optional event value providing additional context.
 *
 * @example
 * trackEvent('user-123', 'navigation', ' ', 'result45', 100);
 */
function trackEvent(uuid, event, action, name, value){
    // Squash result numbers
    name = typeof name == 'string' ? name.replace(/result\d+/, 'result') : name;
    if (action === ' ') action = 'Spacebar';
    else if (action === '+') action = 'Plus';
    const t = new Date()
    name = name ? `&e_n=${name}` : '';
    value = value ? `&e_v=${value}` : '';
    fetch(`https://analytics.mattkirkland.co.uk/matomo.php?h=${t.getHours()}&m=${t.getMinutes()}&s=${t.getSeconds()}
        &action_name=Settings%20Change&idsite=${ID_SITE}&rand=${Date.now()}&rec=1&uid=${uuid}&apiv=1
        &e_c=${event}&e_a=${action}${name}${value}`)
        .then(response => {
            if (! response.ok) throw new Error('Network response was not ok', response);
                    })
        .catch(error => console.log('Error posting tracking:', error))
}

function trackVisit(config){
    const {UUID, selectedModel, list, useWeek, locale, speciesThreshold, filters, audio, models, detect, CPU, RAM, VERSION} = config;
    VISITOR = UUID;
    const {width, height} = window.screen;
    fetch(`https://analytics.mattkirkland.co.uk/matomo.php?idsite=${ID_SITE}&rand=${Date.now()}&rec=1&uid=${UUID}&apiv=1
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
            &dimension13=${RAM}`)
        .then(response => {
            if (! response.ok) throw new Error('Network response was not ok', response);
        })
        .catch(error => console.log('Error posting tracking:', error))
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

    fetch(`${url}?${params.toString()}`, {
        method: 'GET'
    }).then(() => {
        console.log('Heartbeat sent');
    }).catch(error => {
        console.log('Error sending heartbeat:', error);
    });
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