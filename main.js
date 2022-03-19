const {app, dialog, autoUpdater, ipcMain, BrowserWindow} = require('electron');
const fs = require("fs");
require('update-electron-app')();

//Updater
const server = 'https://chirpity-electron-releases.vercel.app';
console.log('process platform ' + process.platform)
console.log('app version  ' + app.getVersion())
const url = `${server}/update/${process.platform}/${app.getVersion()}`

autoUpdater.setFeedURL({url})


//Update handling
autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
    const dialogOpts = {
        type: 'info',
        buttons: ['Restart', 'Later'],
        title: 'Application Update',
        message: process.platform === 'win32' ? releaseNotes : releaseName,
        detail: 'A new version has been downloaded. Restart the application to apply the updates.'
    }

    dialog.showMessageBox(dialogOpts).then((returnValue) => {
        if (returnValue.response === 0) autoUpdater.quitAndInstall()
    })
})

autoUpdater.on('error', message => {
    console.error('There was a problem updating the application')
    console.error(message)
})

let mainWindow;
let workerWindow;

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        show: false,
        width: 1280,
        height: 768,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
        }
    })

    // Set icon
    mainWindow.setIcon(__dirname + '/img/icon/icon.png');

    // Hide nav bar
    mainWindow.setMenuBarVisibility(false);

    // and load the index.html of the app.
    mainWindow.loadFile('index.html')

    // Open the DevTools. Comment out for release
    //mainWindow.webContents.openDevTools()

    mainWindow.once('ready-to-show', () => {
        mainWindow.show()
    })
    // Emitted when the window is closed.
    mainWindow.on('closed', () => {
        app.quit()
    })
}


function createWorker() {
    // hidden worker
    workerWindow = new BrowserWindow({
        show: false,
        height: 800,
        width: 1200,
        webPreferences: {
            nodeIntegration: true,
            nodeIntegrationInWorker: true,
            enableRemoteModule: false,
            contextIsolation: false,
        }
    });
    workerWindow.setIcon(__dirname + '/img/icon/icon.png');
    workerWindow.loadFile('worker.html');

    workerWindow.on('closed', () => {
        workerWindow = null;
    });

    //workerWindow.webContents.openDevTools();

    console.log("worker created");
}

// This method will be called when Electron has finished

app.on('ready', () => {
    createWorker();
    createWindow();

    mainWindow.webContents.on('new-window', function (e, url) {
        e.preventDefault();
        require('electron').shell.openExternal(url);
    });

    workerWindow.webContents.on('crashed', (e, d) => {
        console.log(e);
        const dialogOpts = {
            type: 'warning',
            title: 'File too large',
            detail: 'The file loaded was too long. Currently, Chirpity is limited to analysing files with the following limits:\n' +
                'Sample Rate     Maximum Duration\n' +
                '48000Hz            3 hours 6 minutes and 20 seconds\n' +
                '44100Hz            3 hours 22 minutes and 49 seconds\n' +
                '24000Hz            6 hours 12 minutes 40 seconds'
        }

        dialog.showMessageBox(dialogOpts).then((returnValue) => {
            if (returnValue.response === 0) {
                app.relaunch();
                app.quit()
            }
        })
    });

    setInterval(() => {
        autoUpdater.checkForUpdates()
    }, 600000)
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }

    if (workerWindow == null) {
        createWorker();
    }
});

ipcMain.on('load-model', async (event, arg) => {
    const useWhitelist = arg.useWhitelist;
    console.log('Main received load-model, using whitelist: ' + arg.useWhitelist)
    workerWindow.webContents.send('load-model', {useWhitelist: useWhitelist});
});

ipcMain.on('file-load-request', async (event, arg) => {
    const currentFile = arg.message;
    console.log('Main received file-load-request: ' + arg.message)
    workerWindow.webContents.send('file-load-request', {message: currentFile});
});

ipcMain.on('worker-loaded', async (event, arg) => {
    const currentFile = arg.message;
    console.log('Main received worker-loaded: ' + arg.message)
    mainWindow.webContents.send('worker-loaded', {message: currentFile});
});

ipcMain.on('analyze', async (event, arg) => {
    console.log('Main received go signal: ' + arg.confidence)
    workerWindow.webContents.send('analyze', {start: arg.start, end: arg.end, confidence: arg.confidence});
});

ipcMain.on('prediction-ongoing', (event, arg) => {
    const result = arg.result;
    const index = arg.index
    mainWindow.webContents.send('prediction-ongoing', arg);
});

ipcMain.on('prediction-done', (event, arg) => {
    const labels = arg.labels;
    mainWindow.webContents.send('prediction-done', {labels});
});

ipcMain.on('model-ready', (event, arg) => {
    const results = arg.message;
    mainWindow.webContents.send('model-ready', {results});
});

ipcMain.on('progress', (event, arg) => {
    const progress = arg.progress;
    mainWindow.webContents.send('progress', {progress});
});

ipcMain.on('save', (event, arg) => {
    workerWindow.webContents.send('save', arg);
});

ipcMain.on('post', (event, arg) => {
    workerWindow.webContents.send('post', arg);
});

ipcMain.on('abort', (event, arg) => {
    console.log('Main received abort: ' + arg.abort)
    workerWindow.webContents.send('abort', arg);
});

ipcMain.on('path', (event) => {
    const appPath = app.getPath('userData')
    mainWindow.webContents.send('path', {appPath});
    workerWindow.webContents.send('path', {appPath});
});

ipcMain.on('openFiles', (event) => {
    // Show file dialog to select audio file
    dialog.showOpenDialog({
        filters: [{
            name: 'Audio Files',
            extensions: ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'mpga', 'mpeg']
        }],
        properties: ['openFile', 'multiSelections']
    }).then(result => {
        if (!result.canceled) {
            console.log('files', result.filePaths)
            mainWindow.webContents.send('openFiles', {filePaths: result.filePaths});
        }
    })
})

ipcMain.on('saveFile', (event, arg) => {
    // Show file dialog to select audio file
    let currentFile = arg.currentFile.substr(0, arg.currentFile.lastIndexOf(".")) + ".txt";
    dialog.showSaveDialog({
        filters: [{name: 'Text Files', extensions: ['txt']}],
        defaultPath: currentFile
    }).then(file => {
        // Stating whether dialog operation was cancelled or not.
        //console.log(file.canceled);
        if (!file.canceled) {
            const AUDACITY_LABELS = arg.labels;
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
    mainWindow.webContents.send('saveFile', {message: 'file saved!'});
})
