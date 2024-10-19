const ID_SITE = 3;

function trackEvent(uuid, event, action, name, value){
    // Squash result numbers
    name = typeof name == 'string' ? name.replace(/result\d+/, 'result') : name;
    if (action === ' ') action = 'Spacebar';
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
    const {width, height} = window.screen;
    fetch(`https://analytics.mattkirkland.co.uk/matomo.php?idsite=${ID_SITE}&rand=${Date.now()}&rec=1&uid=${config.UUID}&apiv=1
            &res=${width}x${height}
            &dimension1=${config.model}
            &dimension2=${config.list}
            &dimension3=${config.useWeek}
            &dimension4=${config[config.model].locale}
            &dimension5=${config.speciesThreshold}
            &dimension6=${JSON.stringify(config.filters)}
            &dimension7=${JSON.stringify(config.audio)}
            &dimension8=${JSON.stringify(config[config[config.model].backend])}
            &dimension9=${JSON.stringify(config.detect)}
            &dimension11=${config.VERSION}
            &dimension12=${config.CPU}
            &dimension13=${config.RAM}`)
        .then(response => {
            if (! response.ok) throw new Error('Network response was not ok', response);
        })
        .catch(error => console.log('Error posting tracking:', error))
}

export {trackEvent, trackVisit}