const { app, Menu, dialog, ipcMain, MessageChannelMain, BrowserWindow, powerSaveBlocker } = require('electron');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
// WebGPU flags needed for Linux
app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch('enable-features','Vulkan');

const { autoUpdater } = require("electron-updater");
const log = require('electron-log');

const fs = require("node:fs");
const path = require('node:path');
const settings = require('electron-settings');
process.env['TF_ENABLE_ONEDNN_OPTS'] = "1";

//require('update-electron-app')();
let files = [];
let DEBUG = false;
let unsavedRecords = false;


//-------------------------------------------------------------------
// Logging

// This logging setup is not required for auto-updates to work,
// but it sure makes debugging easier :)
//-------------------------------------------------------------------

console.log = log.log;
console.warn = log.warn;
console.error = log.error;
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
// Define the menu template
const isMac = process.platform === 'darwin'; // macOS check
const template = [
    ...(isMac ? [{
      label: 'Chirpity',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    }
  ];

const menu = Menu.buildFromTemplate(template);

Menu.setApplicationMenu(menu);
// Updates
// Function to fetch release notes from GitHub API
async function fetchReleaseNotes(version) {
    try {
        const response = await fetch('https://api.github.com/repos/Mattk70/Chirpity-Electron/releases/latest');
        
        if (response.ok) {
            const data = await response.json();
            if (data && data.body) {
                return data.body;
            }
        } else {
            console.error('Error fetching release notes:', response.statusText);
        }
    } catch (error) {
        console.error('Error fetching release notes:', error);
    }
    return 'Release notes not available.';
}


if (! isMac){  // The auto updater doesn't work for .pkg installers
    autoUpdater.on('checking-for-update', function () {
        logUpdateStatus('Checking for update...');
        if (process.env.PORTABLE_EXECUTABLE_DIR){
            logUpdateStatus('This is a portable exe')
        } 
    });

    autoUpdater.on('update-available', async function (info) {
        if (!process.env.PORTABLE_EXECUTABLE_DIR){
            autoUpdater.downloadUpdate();
        } else {
            
            // Fetch release notes from GitHub API
            const releaseNotes = await fetchReleaseNotes(info.version);
            dialog.showMessageBox({
                type: 'info',
                title: 'Update Available',
                message: `A new version (${info.version}) is available.\n\nRelease Notes:\n${releaseNotes}`,
                buttons: ['OK'],
                defaultId: 1,
                noLink: true
            })
        }
    });

    autoUpdater.on('update-not-available', function (info) {
        logUpdateStatus('Update not available.');
    });

    autoUpdater.on('error', function (err) {
        logUpdateStatus('Error in auto-updater:' + err);
    });

    autoUpdater.on('download-progress', function (progressObj) {
        mainWindow.webContents.send('download-progress', progressObj);
    });


    autoUpdater.on('update-downloaded', async function (info) {
        // Fetch release notes from GitHub API
        const releaseNotes = await fetchReleaseNotes(info.version);
        log.info(JSON.stringify(info))
        // Display dialog to the user with release notes
        dialog.showMessageBox({
            type: 'info',
            title: 'Update Available',
            message: `A new version (${info.version}) is available.\n\nRelease Notes:\n${releaseNotes}\n\nDo you want to install it now?`,
            buttons: ['Quit and Install', 'Install after Exit'],
            defaultId: 1,
            noLink: true
        }).then((result) => {
            if (result.response === 0) {
                // User clicked 'Yes', start the download
                autoUpdater.quitAndInstall();
            }
        });
    });

    function logUpdateStatus(message) {
        console.log(message);
    }
}

process.stdin.resume();//so the program will not close instantly

async function exitHandler(options, exitCode) {
    if (options.cleanup) {
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
                            DEBUG && console.log('Deleted file:', file);
                        }
                    });
                }
            });
        });
        // Remove old logs - commented out as logs are rotated
        // const logs = path.join(app.getPath('userData'), 'logs');
        // fs.readdir(logs, (err, files) => {
        //     if (err) {
        //         console.error('Error reading folder:', err);
        //         return;
        //     }
        //     files.forEach((file) => {
        //         fs.unlink(path.join(logs, file), (err) => {
        //             if (err) {
        //                 console.error('Error deleting file:', err);
        //             } else {
        //                 DEBUG && console.log('Deleted file:', file);
        //             }
        //         });
        //     });
        // });
        // Disable debug mode here?
    } else {
        DEBUG && console.log('no clean')
        
    }
    if (exitCode || exitCode === 0) {
        DEBUG && console.log(exitCode);
    }
    if (options.exit) {
        process.exit();
    }
}

//do something when app is closing
process.on('exit', exitHandler.bind(undefined, { cleanup: true }));
//catches ctrl+c event (but not in main process!)
process.on('SIGINT', exitHandler.bind(undefined, { exit: true }));
// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(undefined, { exit: true }));
process.on('SIGUSR2', exitHandler.bind(undefined, { exit: true }));
//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(undefined, { exit: true }));

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
        try {
            await settings.set(`windowState.${windowName}`, windowState);
        } catch {} // do nothing
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
    
    // Hide nav bar except in ci mode

    mainWindow.setMenuBarVisibility(!!process.env.CI);
    
    // and load the index.html of the app.
    mainWindow.loadFile('index.html');
    
   
    mainWindow.once('ready-to-show', () => {
        mainWindow.show()
        DEBUG && mainWindow.webContents.openDevTools({ mode: 'detach' });
    })
    DEBUG && console.log("main window created");
    // Emitted when the window is closed.
    if (process.platform !== 'darwin') {
        mainWindow.on('closed', () => {
            app.quit()
        })
    }
    
    mainWindow.on('close', (e) => {
        if (unsavedRecords && !process.env.CI){
            const choice = dialog.showMessageBoxSync(mainWindow, {
                type: 'warning',
                buttons: ['Yes', 'No'],
                title: 'Unsaved Records',
                message: 'There are unsaved records, are you sure you want to exit?',
            });
            
            if (choice === 1) {
                e.preventDefault(); // Prevent the app from closing
            }
        }
    });
    
}


async function createWorker() {
    // hidden worker
    // Get window state
    const mainWindowStateKeeper = await windowStateKeeper('worker');
    workerWindow = new BrowserWindow({
        show: false,
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
        workerWindow = undefined;
    });
    workerWindow.once('ready-to-show', () => {
        if (DEBUG) {
            workerWindow.show();
            workerWindow.webContents.openDevTools();
        }
    })
    DEBUG && console.log("worker created");
}

// This method will be called when Electron has finished loading
app.whenReady().then(async () => {
    // Update the userData path for portable app
    if (process.env.PORTABLE_EXECUTABLE_DIR) {
        app.setPath ('userData', path.join(process.env.PORTABLE_EXECUTABLE_DIR, "chirpity-data"));
        ipcMain.handle('getVersion', () => app.getVersion() + ' (Portable)');
    } else {
        ipcMain.handle('getVersion', () => app.getVersion());
    }

    ipcMain.handle('getPath', () => app.getPath('userData'));
    ipcMain.handle('getLocale', () => app.getLocale());
    ipcMain.handle('getTemp', () => app.getPath('temp'));
    ipcMain.handle('isMac', () => process.platform === 'darwin');
    ipcMain.handle('getAudio', () => path.join(__dirname.replace('app.asar', ''), 'Help', 'example.mp3'));
    ipcMain.handle('exitApplication', () => app.quit()); 
    
    // Debug mode
    try {
        // Specify the file path
        const filePath = path.join(app.getPath('userData'), 'config.json');
        
        // Read the contents of the file synchronously
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const config = JSON.parse(fileContent);
        DEBUG =   process.env.CI === 'e2e' ? false : config.debug;
        DEBUG && console.log('CI mode' , process.env.CI)
    }
    catch (error) {
        // Handle errors, for example, file not found
        console.warn('Error reading file:', error.message);
    }
    await createWorker();
    await createWindow();
    
    if (process.platform === 'darwin') {
        //const appIcon = new Tray('./img/icon/icon.png')
        app.dock.setIcon(__dirname + '/img/icon/icon.png');
        app.dock.bounce();
    } else {
        // Quit when all windows are closed.
        app.setAppUserModelId('chirpity')
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
        DEBUG && console.log('file passed to open:', path)
    });
    
    ipcMain.handle('openFiles', async (_event, _method, config) => {
        const {type, fileOrFolder, multi, buttonLabel, title} = config;
        let options;
        if (type === 'audio') {
             options = {
                filters: [
                    { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'mpga', 'mpeg', 'mp4', 'opus', 'mov'] } 
                ],
                properties: [fileOrFolder, multi] ,
                buttonLabel: buttonLabel,
                title: title
            }
        } else {
            options = {
                filters: [
                    { name: 'Text Files', extensions: ['txt'] }
                ],
                properties: ['openFile']
            }
        }
        // Show file dialog 
        return await dialog.showOpenDialog(mainWindow, options);
    })
    
    
    ipcMain.handle('selectDirectory', async (_e, path) => {
        // Show file dialog to select a directory
        return await dialog.showOpenDialog(mainWindow, {
            // From docs:
            // Note: On Windows and Linux an open dialog can not be both a file selector and a directory selector,
            // so if you set properties to ['openFile', 'openDirectory'] on these platforms,
            // a directory selector will be shown.
            defaultPath: path,
            properties: ['openDirectory']
        });
    })


    
    mainWindow.webContents.setWindowOpenHandler(({ url, frameName }) => {
        require('electron').shell.openExternal(url);
        return {
            action: 'deny',
        }
    });
    
    workerWindow.webContents.once('render-process-gone', (e, details) => {
        DEBUG && console.log(details);
        const dialogOpts = {
            type: 'warning',
            title: 'Crash report',
            detail: 'Oh no! Chirpity has crashed. It is most likely that it has run out of memory.\nTry lowering the batch size and / or number of threads in settings'
        };
        
        dialog.showMessageBox(dialogOpts).then((returnValue) => {
            if (returnValue.response === 0) {
                //app.relaunch();
                app.quit();
            }
        })
    });
    //Update handling
    if (isMac ||  process.env.CI) {
        console.log('Auto-updater disabled in CI and Mac environments.');
    } else {
        autoUpdater.autoDownload = false;
        autoUpdater.checkForUpdatesAndNotify().catch(error => console.warn('Error checking for updates', error))
    }
    // Allow multiple instances of Chirpity - experimental! This alone doesn't work:
    //app.releaseSingleInstanceLock()

});


app.on('activate', async () => {
    if (mainWindow === null) {
        await createWindow();
    }
    
    if (workerWindow == undefined) {
        await createWorker();
    }
});

ipcMain.handle('request-worker-channel', async (_event) =>{
           // Create a new channel ...
           const { port1, port2 } = new MessageChannelMain()
           // ... send one end to the worker ...
           workerWindow.webContents.postMessage('new-client', undefined, [port1])
           // ... and the other end to the UI window.
           mainWindow.webContents.postMessage('provide-worker-channel', undefined, [port2])
           // Now the main window and the worker can communicate with each other
           // without going through the main process!
})

ipcMain.handle('unsaved-records', (_event, data) => {
    unsavedRecords = data.newValue; // Update the variable with the new value
});

ipcMain.handle('saveFile', async (event, arg) => {
    // Show file dialog to select audio file
    if (arg.type === 'audacity'){
        let currentFile = arg.currentFile.substr(0, arg.currentFile.lastIndexOf(".")) + ".txt";
        dialog.showSaveDialog({
            filters: [{ name: 'Text Files', extensions: ['txt'] }],
            defaultPath: currentFile
        }).then(file => {
            // Stating whether dialog operation was cancelled or not.
            //DEBUG && console.log(file.canceled);
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
                    DEBUG && console.log('Saved!');
                });
            }
        }).catch(error => {
            console.warn(error)
        });
    } else {
        const {file, filename, extension} = arg;
        dialog.showSaveDialog({
            title: 'Save File',
            filters: [{ name: 'Audio files', extensions: [extension] }],
            defaultPath: filename
        }).then( saveObj => {
            // Check if the user cancelled the operation
            const {canceled, filePath} = saveObj;
            if (canceled) {
                DEBUG && console.log('User cancelled the save operation.');
                fs.rmSync(file);
                return;
            }
            try {
                // Copy file to the destination
                fs.copyFileSync(file, filePath);
                
                // Remove the original file
                fs.unlinkSync(file);
                DEBUG && console.log(`File moved from ${file} to ${filePath}`);
            } catch (error) {
                console.error(`Error moving file: ${error}`);
            }
        })
    }

});


let powerSaveID = powerSaveBlocker.start('prevent-app-suspension');
powerSaveBlocker.stop(powerSaveID);
ipcMain.handle('powerSaveControl', (e, on) => {
    if (on){
        powerSaveID = powerSaveBlocker.start('prevent-app-suspension')
        //DEBUG && console.log(powerSaveBlocker.isStarted(powerSaveID), powerSaveID)
    } else {
        powerSaveBlocker.stop(powerSaveID)
        //DEBUG && console.log(powerSaveBlocker.isStarted(powerSaveID), powerSaveID)
    }
})