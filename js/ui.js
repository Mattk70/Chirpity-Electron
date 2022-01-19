const {dialog} = require('electron').remote;
const remote = require('electron').remote;
const fs = require('fs');

let currentFile = null
let region = null

async function showOpenDialog() {

    // Show file dialog to select audio file
    const fileDialog = await dialog.showOpenDialog({

        filters: [{name: 'Audio Files', extensions: ['mp3', 'wav']}], // , 'ogg', 'aac', 'flac']}],
        properties: ['openFile']
    });

    // Load audio file  
    if (fileDialog.filePaths.length > 0) {
        loadAudioFile(fileDialog.filePaths[0]);
        currentFile = fileDialog.filePaths[0];
    }


}


async function showSaveDialog() {
    // Show file dialog to save Audacity label file
    currentFile = currentFile.substr(0, currentFile.lastIndexOf(".")) + ".txt";
    const fileDialog = await dialog.showSaveDialog({
        filters: [{name: 'Text Files', extensions: ['txt']}],
        defaultPath: currentFile
    }).then(file => {
        // Stating whether dialog operation was cancelled or not.
        console.log(file.canceled);
        if (!file.canceled) {
            console.log(file.filePath.toString());
            let str = ""
            // Format results
            for (let i = 0; i < AUDACITY_LABELS.length; i++) {
                str += AUDACITY_LABELS[i].timestamp + "\t";
                str += " " + AUDACITY_LABELS[i].cname;
                // str += " " + AUDACITY_LABELS[i].sname ;
                str += " " + (parseFloat(AUDACITY_LABELS[i].score) * 100).toFixed(0) + "%\r\n";
            }

            fs.writeFile(file.filePath.toString(),
                str, function (err) {
                    if (err) throw err;
                    console.log('Saved!');
                });
        }
    }).catch(err => {
        console.log(err)
    });
}


function exitApplication() {

    remote.getCurrentWindow().close()

}

function enableMenuItem(id) {
    $('#' + id).removeClass('disabled');
}

function disableMenuItem(id) {
    $('#' + id).addClass('disabled');
}

function saveLabelFile(path) {

}

function showElement(id, makeFlex = true, empty = false) {

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
    hideElement('modelWarmUpText')
    hideElement('loadFileHint');
    hideElement('loadFileHintText');
    hideElement('loadFileHintSpinner');
    hideElement('loadFileHintLog')

    // Waveform and spec
    hideElement('waveform');
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

window.addEventListener('resize', WindowResize);


function WindowResize() {
    var $window = $(window);
    var width = $window.width();
    var height = $window.height();
    console.log('window resized')

    setInterval(function () {
        if ((width != $window.width()) || (height != $window.height())) {
            width = $window.width();
            height = $window.height();

            adjustSpecHeight(true);
        }
    }, 1000);
}

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
        if (RESULTS.length > 0) {
            showSaveDialog();
        }
    },
    Home: function () {
        wavesurfer.seekAndCenter(0);
        wavesurfer.pause()
    },
    End: function () {
        wavesurfer.seekAndCenter(1);
        wavesurfer.pause()
    },
    KeyP: function () {
        (typeof region !== 'undefined') ? region.play() : console.log('Region undefined')
    }
};

// Bind actions to buttons and keypresses
document.addEventListener('DOMContentLoaded', function () {
    document.addEventListener('keydown', function (e) {
        let action = e.code;
        if (action in GLOBAL_ACTIONS) {
            if (document == e.target || document.body == e.target || e.target.attributes["data-action"]) {
                e.preventDefault();
            }
            GLOBAL_ACTIONS[action](e);
        }
    });

    [].forEach.call(document.querySelectorAll('[data-action]'), function (el) {
        el.addEventListener('click', function (e) {
            let action = e.currentTarget.dataset.action;
            if (action in GLOBAL_ACTIONS) {
                e.preventDefault();
                GLOBAL_ACTIONS[action](e);
            }
        });
    });
});
