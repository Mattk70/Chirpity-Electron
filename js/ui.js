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