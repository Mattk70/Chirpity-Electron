///////////// Nav bar Option handlers //////////////

$(document).on('click', '#loadSpectrogram', function (e) {
    if (config.spectrogram) {
        config.spectrogram = false;
        $('#loadSpectrogram .tick').hide()
        $('.specFeature').hide()
        hideElement('dummy');
        hideElement('timeline');
        hideElement('waveform');
        hideElement('spectrogram');
        $('.speccolor .timeline').addClass('disabled');
        //adjustSpecHeight(true);
        updatePrefs();
    } else {
        config.spectrogram = true;
        $('#loadSpectrogram .tick').show()
        $('.specFeature').show()
        if (wavesurfer && wavesurfer.isReady) {
            $('.speccolor .timeline').removeClass('disabled');
            showElement('dummy', false);
            showElement('timeline', false);
            showElement('waveform', false, false);
            showElement('spectrogram', false, false);
        } else {
            loadAudioFile(currentFile);
        }
        updatePrefs();
    }
})

$(document).on('click', '.speccolor', function (e) {
    wavesurfer.destroyPlugin('spectrogram');
    config.colormap = e.target.id;
    wavesurfer.addPlugin(SpectrogramPlugin.create({
        wavesurfer: wavesurfer,
        container: "#spectrogram",
        scrollParent: true,
        labels: false,
        colorMap: colormap({
            colormap: config.colormap, nshades: 256, format: 'float'
        })
    })).initPlugin('spectrogram');
    // set tick
    $('.speccolor .tick').addClass('d-none');
    $(this).children('span').removeClass('d-none');
    // refresh caches
    updateElementCache()
    adjustSpecHeight(true)
    updatePrefs();
})


$(document).on('click', '.timeline', function (e) {
    if (wavesurfer.timeline && wavesurfer.timeline.wrapper !== null) {
        wavesurfer.destroyPlugin('timeline');
        $('#loadTimeline .tick').hide()
        config.timeline = false;
        updatePrefs();
    } else {
        config.timeline = true;
        wavesurfer.addPlugin(SpecTimeline.create({
            wavesurfer: wavesurfer,
            container: "#timeline",
            formatTimeCallback: formatTimeCallback,
            timeInterval: timeInterval,
            primaryLabelInterval: primaryLabelInterval,
            secondaryLabelInterval: secondaryLabelInterval,
            primaryColor: 'black',
            secondaryColor: 'grey',
            primaryFontColor: 'black',
            secondaryFontColor: 'grey'
        })).initPlugin('timeline');
        $('#loadTimeline .tick').show()
        // refresh caches
        updateElementCache()
        adjustSpecHeight(true)
        updatePrefs();
    }
})

/////////// Keyboard Shortcuts  ////////////

const GLOBAL_ACTIONS = { // eslint-disable-line
    Space: function () {
        wavesurfer.playPause();
    },
    ArrowLeft: function () {
        wavesurfer.skipBackward();
    },
    ArrowRight: function () {
        wavesurfer.skipForward();
    },
    KeyO: function () {
        showOpenDialog();
    },
    KeyS: function () {
        if (AUDACITY_LABELS.length > 0) {
            showSaveDialog();
        }
    },
    Escape: function () {
        console.log('Operation aborted');
        ipcRenderer.send('abort', {'abort': true})
    },
    Home: function () {
        if (currentBuffer) {
            loadBufferSegment(currentBuffer, 0)
            wavesurfer.seekAndCenter(0);
            wavesurfer.pause()
        }
    },
    End: function () {
        if (currentBuffer) {
            loadBufferSegment(currentBuffer, currentBuffer.duration - windowLength)
            wavesurfer.seekAndCenter(1);
            wavesurfer.pause()
        }
    },
    PageUp: function () {
        if (wavesurfer) {
            const position = wavesurfer.getCurrentTime() / windowLength;
            loadBufferSegment(currentBuffer, bufferBegin -= windowLength)
            wavesurfer.seekAndCenter(position);
            wavesurfer.pause()
        }
    },
    PageDown: function () {
        if (wavesurfer) {
            const position = wavesurfer.getCurrentTime() / windowLength;
            loadBufferSegment(currentBuffer, bufferBegin += windowLength)
            wavesurfer.seekAndCenter(position);
            wavesurfer.pause()
        }
    },
    ArrowLeft: function () {
        if (wavesurfer) {
            wavesurfer.skipBackward(0.1);
            const position = wavesurfer.getCurrentTime();
            if (position < 0.1 && bufferBegin > 0) {
                loadBufferSegment(currentBuffer, bufferBegin -= windowLength / 2)
                wavesurfer.seekAndCenter(0.5);
                wavesurfer.pause()
            }
        }
    },
    ArrowRight: function () {
        if (wavesurfer) {
            wavesurfer.skipForward(0.1);
            const position = wavesurfer.getCurrentTime();
            if (position > windowLength - 0.1) {
                loadBufferSegment(currentBuffer, bufferBegin += windowLength / 2)
                wavesurfer.seekAndCenter(0.5);
                wavesurfer.pause()
            }
        }
    },
    KeyP: function () {
        (typeof region !== 'undefined') ? region.play() : console.log('Region undefined')
    }
};


// Electron Message handling

ipcRenderer.on('model-ready', async (event, arg) => {
    modelReady = true;
    if (fileLoaded) {
        enableMenuItem('analyze')
    }
})

ipcRenderer.on('worker-loaded', async (event, arg) => {
    if (!loadSpectrogram) {
        console.log('UI received worker-loaded: ' + arg.message)
        enableMenuItem('analyze')
        hideAll();
        showElement('controlsWrapper');
        hideElement('transport-controls');
        const filename = arg.message.replace(/^.*[\\\/]/, '')
        $('#filename').html('<span class="material-icons">description</span> ' + filename);
    }
})

ipcRenderer.on('progress', async (event, arg) => {
    progressDiv.show();
    let progress = (arg.progress * 100).toFixed(1);
    progressBar.width(progress + '%');
    progressBar.attr('aria-valuenow', progress);
    progressBar.html(progress + '%');
});

ipcRenderer.on('prediction-done', async (event, arg) => {
    AUDACITY_LABELS = arg.labels;
    progressDiv.hide();
    progressBar.width(0 + '%');
    progressBar.attr('aria-valuenow', 0);
    progressBar.html(0 + '%');
    completeDiv.show();
    enableMenuItem('saveLabels');
});

ipcRenderer.on('prediction-ongoing', async (event, arg) => {
    completeDiv.hide();
    const result = arg.result;
    const index = arg.index;
    if (index === 1) {
        // Remove old results
        $('#resultTableBody').empty();
    }
    let tr;
    showElement('resultTableContainer');

    if (result === "No detections found.") {
        tr = "<tr><td>" + result + "</td></tr>";
    } else {

        tr = "<tr  onmousedown='loadResultRegion(" + result.start + " , " + result.end + " )' class='border-top border-secondary'><th scope='row'>" + index + "</th>";
        tr += "<td><span class='material-icons rotate text-right' onclick='toggleAlternates(&quot;.subrow" + index + "&quot;)'>expand_more</span></td>";
        tr += "<td>" + result.timestamp + "</td>";
        tr += "<td>" + result.cname + "</td>";
        tr += "<td><i>" + result.sname + "</i></td>";
        tr += "<td class='text-center'>" + iconizeScore(result.score) + "</td>";
        tr += "<td class='specFeature text-center'><span class='material-icons-two-tone play'>play_circle_filled</span></td>";
        tr += "<td class='specFeature text-center'><span class='material-icons-outlined' onclick=\"ipcRenderer.send('save', {'start': " + result.start + ", 'end': " + result.end + ", 'filepath': 'test.mp3'})\">file_download</span></td>";
        tr += "</tr>";

        tr += "<tr  class='subrow" + index + "'  onclick='loadResultRegion(" + result.start + " , " + result.end + " )'><th scope='row'> </th>";
        tr += "<td> </td>";
        tr += "<td> </td>";
        tr += "<td>" + result.cname2 + "</td>";
        tr += "<td><i>" + result.sname2 + "</i></td>";
        tr += "<td class='text-center'>" + iconizeScore(result.score2) + "</td>";
        tr += "<td> </td>";
        tr += "</tr>";

        tr += "<tr  class='subrow" + index + "'  onclick='loadResultRegion(" + result.start + " , " + result.end + " )' ><th scope='row'> </th>";
        tr += "<td> </td>";
        tr += "<td> </td>";
        tr += "<td>" + result.cname3 + "</td>";
        tr += "<td><i>" + result.sname3 + "</i></td>";
        tr += "<td class='text-center'>" + iconizeScore(result.score3) + "</td>";
        tr += "<td> </td>";
        tr += "</tr>";

    }
    $('#resultTableBody').append(tr);
    if (!config.spectrogram) $('.specFeature').hide();
    $(".material-icons").click(function () {
        $(this).toggleClass("down");
    })
});

// create a dict mapping score to icon
const iconDict = {
    'low': '<span class="material-icons text-danger border border-secondary rounded" title="--%">signal_cellular_alt_1_bar</span>',
    'medium': '<span class="material-icons text-warning border border-secondary rounded" title="--%">signal_cellular_alt_2_bar</span>',
    'high': '<span class="material-icons text-success border border-secondary rounded" title="--%">signal_cellular_alt</span>',
}

function iconizeScore(score) {
    const tooltip = (parseFloat(score) * 100).toFixed(0).toString()
    if (parseFloat(score) < 0.65) return iconDict['low'].replace('--', tooltip)
    else if (parseFloat(score) < 0.85) return iconDict['medium'].replace('--', tooltip)
    else return iconDict['high'].replace('--', tooltip)
}