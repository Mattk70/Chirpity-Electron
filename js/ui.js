const { dialog } = require('electron').remote;
const remote = require('electron').remote;

async function showFileDialog() {

    // Show file dialog to select audio file
    const fileDialog = await dialog.showOpenDialog({

        filters: [{name: 'Audio Files', extensions: ['mp3', 'wav'] }],
        properties: ['openFile']
    });

    // Load audio file  
    if (fileDialog.filePaths.length > 0) loadAudioFile(fileDialog.filePaths[0]);

}

function exitApplication() {

    remote.getCurrentWindow().close()

}

function showElement(id) {

    $('#' + id).removeClass('d-none');
    $('#' + id).addClass('d-flex');

}

function hideElement(id) {
    
    $('#' + id).removeClass('d-flex');
    $('#' + id).addClass('d-none');

}

function hideAll() {

    // File hint div
    hideElement('loadFileHint');
    hideElement('loadFileHintText');
    hideElement('loadFileHintSpinner');

    // Waveform and spec
    hideElement('waveformContainer');
    hideElement('specContainer');

    // Controls    
    hideElement('controlsWrapper');

}


// Event listener
//window.addEventListener('resize', drawSpectrogram(CURRENT_ADUIO_BUFFER), false);