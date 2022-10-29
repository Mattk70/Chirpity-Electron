const {app, dialog, ipcMain, MessageChannelMain, BrowserWindow} = require('electron');
const fs = require("fs");
const path = require('path');
const settings = require('electron-settings');

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
process.stdin.resume();//so the program will not close instantly

function exitHandler(options, exitCode) {
    if (options.cleanup) console.log('clean');
    else {
        console.log('no clean')
    }
    if (exitCode || exitCode === 0) console.log(exitCode);
    if (options.exit) process.exit();
}

//do something when app is closing
process.on('exit', exitHandler.bind(null, {cleanup: false}));

let mainWindow;
let workerWindow;


async function windowStateKeeper(windowName) {
    let window, windowState;

    async function setBounds() {
        // Restore from settings
        if (await settings.has(`windowState.${windowName}`)) {
            windowState = await settings.get(`windowState.${windowName}`);
        } else {
            // Default
            windowState = {
                x: undefined,
                y: undefined,
                width: 1280,
                height: 768,
            };
        }
    }

    async function saveState() {
        if (!windowState.isMaximized) {
            windowState = window.getBounds();
        }
        windowState.isMaximized = window.isMaximized();
        await settings.set(`windowState.${windowName}`, windowState);
    }

    function track(win) {
        window = win;
        ['resize', 'move', 'close'].forEach(event => {
            win.on(event, saveState);
        });
    }

    await setBounds();
    return ({
        x: windowState.x,
        y: windowState.y,
        width: windowState.width,
        height: windowState.height,
        isMaximized: windowState.isMaximized,
        track,
    });
}

async function createWindow() {
    // Create the browser window.
    // Get window state
    const mainWindowStateKeeper = await windowStateKeeper('main');

    mainWindow = new BrowserWindow({
        show: false,
        title: "Chirpity Nocmig",
        x: mainWindowStateKeeper.x,
        y: mainWindowStateKeeper.y,
        width: mainWindowStateKeeper.width,
        height: mainWindowStateKeeper.height,

        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: true,
            backgroundThrottling: false
        }
    })
    // Track window state
    mainWindowStateKeeper.track(mainWindow);

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
        // Get window state
    const mainWindowStateKeeper = await windowStateKeeper('worker');
    workerWindow = new BrowserWindow({
        show: true,
        x: mainWindowStateKeeper.x,
        y: mainWindowStateKeeper.y,
        width: mainWindowStateKeeper.width,
        height: mainWindowStateKeeper.height,
        webPreferences: {
            nodeIntegration: true,
            nodeIntegrationInWorker: false,
            contextIsolation: false,
            backgroundThrottling: false
        }
    });
        // Track window state
    mainWindowStateKeeper.track(workerWindow);
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
    ipcMain.handle('getPath', () => app.getPath('userData'));
    ipcMain.handle('getTemp', () => app.getPath('temp'));
    ipcMain.handle('getVersion', () => app.getVersion());

    await createWorker();
    await createWindow();
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
    // ipcMain.on('file-to-load', (event) => {
    //     // THe UI has asked for it, so now is a good time to ask the UI to load a results file if needed:
    //     if (event.senderFrame === mainWindow.webContents.mainFrame) {
    //         const args = sharedObject.prop1;
    //         if (args.length > 2 || (process.platform === 'darwin' && args.length > 0)) {
    //             console.log('Asking UI to load a file', args)
    //             event.senderFrame.postMessage('load-results', {file: args[args.length - 1]});
    //         }
    //     }
    // });

    if (process.platform === 'darwin') {
        //const appIcon = new Tray('./img/icon/icon.png')
        app.dock.setIcon(__dirname + '/img/icon/icon.png');
        app.dock.bounce();
    }

    app.on('activate', async  () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            await createWorker();
            await createWindow();
        }
    })


    mainWindow.webContents.on('new-window', function (e, url) {
        e.preventDefault();
        require('electron').shell.openExternal(url); // .then(r => console.log(r));
    });

    workerWindow.webContents.on('render-process-gone', (e, details) => {
        console.log(e);
        console.log(details);
        const dialogOpts = {
            type: 'warning',
            title: 'Crash report',
            detail: 'Oh no! The model had crashed, restarting Chirpity'
        }

        dialog.showMessageBox(dialogOpts).then((returnValue) => {
            if (returnValue.response === 0) {
                app.relaunch();
                app.quit();
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
        app.quit();
    }
})

// app.on('before-quit', async () =>
// {
//     console.log('before quit fired')
//     workerWindow.webContents.postMessage('new-client', {action: 'clear-cache'})
//     await session.defaultSession.clearStorageData();
// })

app.on('activate', async () => {
    if (mainWindow === null) {
        await createWindow();
    }

    if (workerWindow == null) {
        await createWorker();
    }
});

ipcMain.handle('dialog', (event, method, params) => {
    dialog[method](mainWindow, params);
});

ipcMain.handle('openFiles', async () => {
    // Show file dialog to select audio file
    return await dialog.showOpenDialog(mainWindow, {
        filters: [{
            name: 'Audio Files',
            extensions: ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'mpga', 'mpeg', 'mp4', 'opus']
        }],
        properties: ['openFile', 'multiSelections']
    });
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
