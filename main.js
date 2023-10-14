const { app, dialog, ipcMain, MessageChannelMain, BrowserWindow, globalShortcut } = require('electron');
const { autoUpdater } = require("electron-updater")
const log = require('electron-log');
//app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096');
const fs = require("fs");
const os = require('os');
const path = require('path');
const settings = require('electron-settings');
//require('update-electron-app')();
let files = [];
let DEBUG = false;


//-------------------------------------------------------------------
// Logging

// This logging setup is not required for auto-updates to work,
// but it sure makes debugging easier :)
//-------------------------------------------------------------------
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// Updates
autoUpdater.setFeedURL({
    provider: "github",
    owner: "Mattk70",
    repo: "Chirpity-Electron",
    private: true
});

autoUpdater.autoDownload = true;
log.transports.file.resolvePathFn = () => path.join(APP_DATA, 'logs/main.log');
log.info('App starting...');


autoUpdater.on('checking-for-update', function () {
    sendStatusToWindow('Checking for update...');
});

autoUpdater.on('update-available', function (info) {
    // Display dialog to the user
    dialog.showMessageBox({
        type: 'info',
        title: 'Update Available',
        message: 'A new version is available. Do you want to download it now?',
        buttons: ['Yes', 'No']
    }).then((result) => {
        if (result.response === 0) {
            // User clicked 'Yes', start the download
            autoUpdater.downloadUpdate();
        }
    });
});

autoUpdater.on('update-not-available', function (info) {
    sendStatusToWindow('Update not available.');
});

autoUpdater.on('error', function (err) {
    sendStatusToWindow('Error in auto-updater.');
});

autoUpdater.on('download-progress', function (progressObj) {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + parseInt(progressObj.percent) + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    sendStatusToWindow(log_message);
});


autoUpdater.on('update-downloaded', function (info) {
    // Display dialog for installing now or later
    dialog.showMessageBox({
        type: 'info',
        title: 'Update Downloaded',
        message: 'Update downloaded; do you want to install it now?',
        buttons: ['Yes', 'Later']
    }).then((result) => {
        if (result.response === 0) {
            // User clicked 'Yes', install the update
            autoUpdater.quitAndInstall();
        }
    });
});

function sendStatusToWindow(message) {
    console.log(message);
}

// Debug mode
try {
    // Specify the file path
    const filePath = path.join(app.getPath('userData'), 'config.json');

    // Read the contents of the file synchronously
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const config = JSON.parse(fileContent);
    DEBUG = config.debug;
}
catch (error) {
    // Handle errors, for example, file not found
    console.error('Error reading file:', error.message);
}





process.stdin.resume();//so the program will not close instantly


const clearCache = (file_cache) => {
    return new Promise((resolve) => {
        // clear & recreate file cache folder
        fs.rmSync(file_cache, { recursive: true, force: true });
        fs.mkdir(file_cache, (err, path) => {
            resolve(path);
        })
    })
}



async function exitHandler(options, exitCode) {
    if (options.cleanup) {
        const tmp = path.join(app.getPath('temp'), 'chirpity');
        // size of cache
        await clearCache(tmp);
        console.log('cleaned ' + tmp)
        // clean up settings.json litter
        const conf = app.getPath('userData');
        fs.readdir(conf, (err, files) => {
            if (err) {
                console.error('Error reading folder:', err);
                return;
            }
            files.forEach((file) => {
                if (file.startsWith('settings.json.')) {
                    fs.unlink(path.join(conf, file), (err) => {
                        if (err) {
                            console.error('Error deleting file:', err);
                        } else {
                            console.log('Deleted file:', file);
                        }
                    });
                }
            });
        });
        // Remove old logs
        const logs = path.join(app.getPath('userData'), 'logs');
        fs.readdir(logs, (err, files) => {
            if (err) {
                console.error('Error reading folder:', err);
                return;
                }
            files.forEach((file) => {
                    fs.unlink(path.join(logs, file), (err) => {
                        if (err) {
                            console.error('Error deleting file:', err);
                        } else {
                            console.log('Deleted file:', file);
                        }
                    });
            });
        });
    } else {
        console.log('no clean')

    }
    if (exitCode || exitCode === 0) {
        console.log(exitCode);
    }
    if (options.exit) {
        process.exit();
    }
}

//do something when app is closing
process.on('exit', exitHandler.bind(null, { cleanup: true }));
//catches ctrl+c event (but not in main process!)
process.on('SIGINT', exitHandler.bind(null, { exit: true }));
// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, { exit: true }));
process.on('SIGUSR2', exitHandler.bind(null, { exit: true }));
//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, { exit: true }));

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
    });
    // Track window state
    mainWindowStateKeeper.track(mainWindow);

    // Set icon
    mainWindow.setIcon(__dirname + '/img/icon/icon.png');

    // Hide nav bar
    mainWindow.setMenuBarVisibility(false);

    // and load the index.html of the app.
    mainWindow.loadFile('index.html');

    // Open the DevTools. Comment out for release
    if (DEBUG) mainWindow.webContents.openDevTools();

    mainWindow.once('ready-to-show', () => {
        mainWindow.show()
    })
    console.log("main window created");
    // Emitted when the window is closed.
    if (process.platform !== 'darwin') {
        mainWindow.on('closed', () => {
            app.quit()
        })
    }
}


async function createWorker() {
    // hidden worker
    // Get window state
    const mainWindowStateKeeper = await windowStateKeeper('worker');
    workerWindow = new BrowserWindow({
        show: DEBUG,
        x: mainWindowStateKeeper.x,
        y: mainWindowStateKeeper.y,
        width: mainWindowStateKeeper.width,
        height: mainWindowStateKeeper.height,
        webPreferences: {
            nodeIntegration: true,
            nodeIntegrationInWorker: true,
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
    if (DEBUG) workerWindow.webContents.openDevTools();
    console.log("worker created");
}

// This method will be called when Electron has finished
app.whenReady().then(async () => {
    ipcMain.handle('getPath', () => app.getPath('userData'));
    ipcMain.handle('getTemp', () => app.getPath('temp'));
    ipcMain.handle('getVersion', () => app.getVersion());
    ipcMain.handle('getAudio', () => path.join(__dirname.replace('app.asar', ''), 'Help', 'example.mp3'));

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
            const { port1, port2 } = new MessageChannelMain()
            // ... send one end to the worker ...
            workerWindow.webContents.postMessage('new-client', null, [port1])
            // ... and the other end to the UI window.
            event.senderFrame.postMessage('provide-worker-channel', null, [port2])
            // Now the main window and the worker can communicate with each other
            // without going through the main process!
        }
    });


    if (process.platform === 'darwin') {
        //const appIcon = new Tray('./img/icon/icon.png')
        app.dock.setIcon(__dirname + '/img/icon/icon.png');
        app.dock.bounce();
        // Close app on Command+Q on OSX
        globalShortcut.register('Command+Q', () => {
            app.quit();
        })
    } else {
        // Quit when all windows are closed.
        app.on('window-all-closed', () => {
            app.quit()
        })
    }

    app.on('activate', async () => {
        const windowsOpen = BrowserWindow.getAllWindows().length
        if (!windowsOpen) {
            await createWorker();
            await createWindow();
        } else if (windowsOpen === 1) {
            await createWindow();
        }
    });

    app.on('open-file', (event, path) => {
        files.push(path);
    });


    mainWindow.webContents.setWindowOpenHandler(({ url, frameName }) => {
        require('electron').shell.openExternal(url);
        return {
            action: 'deny',
        }
    });

    workerWindow.webContents.on('render-process-gone', (e, details) => {
        console.log(e);
        console.log(details);
        const dialogOpts = {
            type: 'warning',
            title: 'Crash report',
            detail: 'Oh no! The model has crashed. Try lowering the batch size and / or number of threads in settings'
        };

        dialog.showMessageBox(dialogOpts).then((returnValue) => {
            if (returnValue.response === 0) {
                //app.relaunch();
                app.quit();
            }
        })
    });
    //Update handling
    autoUpdater.checkForUpdatesAndNotify()

});


app.on('activate', async () => {
    if (mainWindow === null) {
        await createWindow();
    }

    if (workerWindow == null) {
        await createWorker();
    }
});


ipcMain.handle('openFiles', async (config) => {
    // Show file dialog to select audio file
    return await dialog.showOpenDialog(mainWindow, {
        filters: [{
            name: 'Audio Files',
            extensions: ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'mpga', 'mpeg', 'mp4', 'opus']
        }],
        // From docs:
        // Note: On Windows and Linux an open dialog can not be both a file selector and a directory selector,
        // so if you set properties to ['openFile', 'openDirectory'] on these platforms,
        // a directory selector will be shown.
        properties: ['openFile', 'multiSelections'],
    });
})

ipcMain.handle('selectDirectory', async (config) => {
    // Show file dialog to select a directory
    return await dialog.showOpenDialog(mainWindow, {
        // From docs:
        // Note: On Windows and Linux an open dialog can not be both a file selector and a directory selector,
        // so if you set properties to ['openFile', 'openDirectory'] on these platforms,
        // a directory selector will be shown.
        properties: ['openDirectory']
    });
})

ipcMain.handle('saveFile', (event, arg) => {
    // Show file dialog to select audio file
    let currentFile = arg.currentFile.substr(0, arg.currentFile.lastIndexOf(".")) + ".txt";
    dialog.showSaveDialog({
        filters: [{ name: 'Text Files', extensions: ['txt'] }],
        defaultPath: currentFile
    }).then(file => {
        // Stating whether dialog operation was cancelled or not.
        //console.log(file.canceled);
        if (!file.canceled) {
            const AUDACITY_LABELS = arg.labels;
            let str = "";
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
    mainWindow.webContents.send('saveFile', { message: 'file saved!' });
});
