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

function showElement(id, makeFlex=true, empty=false) {

    $('#' + id).removeClass('d-none');
    if (makeFlex) $('#' + id).addClass('d-flex');
    if (empty) $('#' + id).empty();

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
    hideElement('loadFileHintLog')

    // Waveform and spec
    hideElement('waveformContainer');
    hideElement('specContainer');

    // Controls    
    hideElement('controlsWrapper');

    // Result table
    hideElement('resultTableContainer');

}

function log(element, text) {

    $('#' + element).html('</br>' + text);

}


 /////////////////////////  DO AFTER LOAD ////////////////////////////
 window.onload = function () {

    // Set footer year
    $('#year').text(new Date().getFullYear());

    // Load model
    loadModel()

};

/*
$(window).resize(function() {
    adjustSpecHeight(true);
});
*/

$(function() {
    var $window = $(window);
    var width = $window.width();
    var height = $window.height();

    setInterval(function () {
        if ((width != $window.width()) || (height != $window.height())) {
            width = $window.width();
            height = $window.height();

            adjustSpecHeight(true);
        }
    }, 1000);
});

