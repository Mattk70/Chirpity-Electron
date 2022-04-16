const {app, dialog, ipcMain, MessageChannelMain, BrowserWindow} = require('electron');
const fs = require("fs");
const path = require('path')

//require('update-electron-app')();
global.sharedObject = {prop1: process.argv};
let files = [];
//Updater
//const server = 'https://chirpity-electron-releases.vercel.app';
//console.log('process platform ' + process.platform)
//console.log('app version  ' + app.getVersion())
//const url = `${server}/update/${process.platform}/${app.getVersion()}`
//
//autoUpdater.setFeedURL({url})

//Update handling
//autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
//    const dialogOpts = {
//        type: 'info',
//        buttons: ['Restart', 'Later'],
//        title: 'Application Update',
//        message: process.platform === 'win32' ? releaseNotes : releaseName,
//        detail: 'A new version has been downloaded. Restart the application to apply the updates.'
//    }
//
//    dialog.showMessageBox(dialogOpts).then((returnValue) => {
//        if (returnValue.response === 0) autoUpdater.quitAndInstall()
//    })
//})


let mainWindow;
let workerWindow;


function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        show: false,
        title: "Chirpity Nocmig",
        width: 1280,
        height: 768,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false
        }
    })

    // Set icon
    mainWindow.setIcon(__dirname + '/img/icon/icon.png');

    // Hide nav bar
    mainWindow.setMenuBarVisibility(false);

    // and load the index.html of the app.
    mainWindow.loadFile('index.html')

    // Open the DevTools. Comment out for release
    mainWindow.webContents.openDevTools()

    mainWindow.once('ready-to-show', () => {
        mainWindow.show()
    })

    // Emitted when the window is closed.
    mainWindow.on('closed', () => {
        app.quit()
    })
}


async function createWorker() {
    // hidden worker
    workerWindow = new BrowserWindow({
        show: true,
        height: 800,
        width: 1200,
        webPreferences: {
            nodeIntegration: true,
            nodeIntegrationInWorker: true,
            contextIsolation: false,
            backgroundThrottling: false
        }
    });
    workerWindow.setIcon(__dirname + '/img/icon/icon.png');
    await workerWindow.loadFile('worker.html');

    workerWindow.on('closed', () => {
        workerWindow = null;
    });
    workerWindow.webContents.openDevTools();
    console.log("worker created");

}

// This method will be called when Electron has finished
app.whenReady().then(async () => {
    ipcMain.handle('getPath', () => app.getPath("userData"));
    ipcMain.handle('getVersion', () => app.getVersion());
    await createWorker();
    createWindow();
    // We'll be sending one end of this channel to the main world of the
    // context-isolated page.

    // We can't use ipcMain.handle() here, because the reply needs to transfer a
    // MessagePort.
    ipcMain.on('request-worker-channel', (event) => {
        // For security reasons, let's make sure only the frames we expect can
        // access the worker.
        if (event.senderFrame === mainWindow.webContents.mainFrame) {
            // Create a new channel ...
            const {port1, port2} = new MessageChannelMain()
            // ... send one end to the worker ...
            workerWindow.webContents.postMessage('new-client', null, [port1])
            // ... and the other end to the UI window.
            event.senderFrame.postMessage('provide-worker-channel', null, [port2])
            // Now the main window and the worker can communicate with each other
            // without going through the main process!
        }
    });
    ipcMain.on('file-to-load', (event) => {
        // THe UI has asked for it, so now is a good time to ask the UI to load a results file if needed:
        if (event.senderFrame === mainWindow.webContents.mainFrame) {
            const args = sharedObject.prop1;
            if (args.length > 1 || (process.platform === 'darwin' && args.length > 0)) {
                console.log('Asking UI to load a file')
                event.senderFrame.postMessage('load-results', {file: args[args.length - 1]});
            }
        }
    });

    if (process.platform === 'darwin') {
        //const appIcon = new Tray('./img/icon/icon.png')
        app.dock.setIcon(__dirname + '/img/icon/icon.png');
        app.dock.bounce();
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWorker();
            createWindow();
        }
    })


    mainWindow.webContents.on('new-window', function (e, url) {
        e.preventDefault();
        require('electron').shell.openExternal(url); // .then(r => console.log(r));
    });

    workerWindow.webContents.on('crashed', (e) => {
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

//
//    setInterval(() => {
//        autoUpdater.checkForUpdates()
//    }, 6000000)

//    autoUpdater.on('error', message => {
//        mainWindow.webContents.send('update-error', {error: message});
//        console.error('There was a problem updating the application')
//        console.error(message)
//    })
//
//    autoUpdater.on('update-not-available', message => {
//        mainWindow.webContents.send('update-not-available', {message: 'update-not-available'});
//    })
//
//    autoUpdater.on('update-available', message => {
//        mainWindow.webContents.send('update-available', {message: 'update-available'});
//    })
});


app.on('open-file', (event, path) => {
    files.push(path);
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

ipcMain.handle('dialog', (event, method, params) => {
    dialog[method](mainWindow, params);
});

ipcMain.handle('openFiles', async (event) => {
    // Show file dialog to select audio file
    const result = await dialog.showOpenDialog(mainWindow, {
        filters: [{
            name: 'Audio Files',
            extensions: ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'mpga', 'mpeg', 'mp4']
        }],
        properties: ['openFile', 'multiSelections']
    });
    return result;
})
ipcMain.handle('saveFile', (event, arg) => {
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
