const {
  app,
  Menu,
  dialog,
  ipcMain,
  MessageChannelMain,
  BrowserWindow,
  powerSaveBlocker,
} = require("electron");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("force-high-performance-gpu");
app.commandLine.appendSwitch("xdg-portal-required-version", "4");
// WebGPU flags needed for Linux
app.commandLine.appendSwitch("enable-unsafe-webgpu");
app.commandLine.appendSwitch("enable-features", "Vulkan");

// Set the AppUserModelID (to prevent the two pinned icons bug)
app.setAppUserModelId('com.electron.chirpity');
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");

const fs = require("node:fs");
const path = require("node:path");
const settings = require("electron-settings");
const keytar = require('keytar');
const SERVICE = 'Chirpity';
const ACCOUNT = 'install-info';

async function getInstallInfo(date) {
  try {
    const raw = await keytar.getPassword(SERVICE, ACCOUNT);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.installedAt === "string") {
        // This is an ISO date string
        return parsed.installedAt;
      }
      console.warn("getInstallInfo: keychain entry missing valid installedAt, recreating.");
    }
  } catch (error) {
    console.warn("getInstallInfo: keychain read/parse failed, recreating:", error.message);
  }

  const crypto = require("node:crypto");
  let effectiveDate = date ? new Date(date) : new Date();
  if (Number.isNaN(effectiveDate.getTime())) {
    console.warn("getInstallInfo: invalid date provided, falling back to now.");
    effectiveDate = new Date();
  }

  const installInfo = {
    appId: crypto.randomUUID(),
    installedAt: effectiveDate.toISOString(),
  };

  try {
    await keytar.setPassword(SERVICE, ACCOUNT, JSON.stringify(installInfo));
  } catch (error) {
    console.warn("getInstallInfo: keychain write failed (using in‑memory date only):", error.message);
  }

  return installInfo.installedAt;
}

process.env["TF_ENABLE_ONEDNN_OPTS"] = "1";

//require('update-electron-app')();
let files = [];
let DEBUG = false;
let unsavedRecords = false;

// List of supported file for opening:
const SUPPORTED_FILES = [
  ".wav",
  ".flac",
  ".opus",
  ".m4a",
  ".mp3",
  ".mpga",
  ".ogg",
  ".aac",
  ".mpeg",
  ".mp4",
  ".mov",
];


//-------------------------------------------------------------------
// Logging

// This logging setup is not required for auto-updates to work,
// but it sure makes debugging easier :)
//-------------------------------------------------------------------

console.log = log.log;
console.warn = log.warn;
console.error = log.error;
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";
// Define the menu template
const isMac = process.platform === "darwin"; // macOS check
// Set membership URL here
process.env.MEMBERSHIP_API_ENDPOINT = 'https://subscriber.mattkirkland.co.uk/check-uuid_v2';
const template = [
  ...(isMac
    ? [
        {
          label: "Chirpity",
          submenu: [
            { role: "about" },
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        },
      ]
    : []),
  {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "selectAll" },
    ],
  },
];

const menu = Menu.buildFromTemplate(template);

Menu.setApplicationMenu(menu);
// Updates
// Function to fetch release notes from GitHub API
async function fetchReleaseNotes(version) {
  try {
    const response = await fetch(
      "https://api.github.com/repos/Mattk70/Chirpity-Electron/releases/latest"
    );

    if (response.ok) {
      const data = await response.json();
      if (data && data.body) {
        return data.body;
      }
    } else {
      console.error("Error fetching release notes:", response.statusText);
    }
  } catch (error) {
    console.error("Error fetching release notes:", error);
  }
  return "Release notes not available.";
}

if (!isMac) {
  // The auto updater doesn't work for .pkg installers
  autoUpdater.on("checking-for-update", function () {
    logUpdateStatus("Checking for update...");
    if (process.env.PORTABLE_EXECUTABLE_DIR) {
      logUpdateStatus("This is a portable exe");
    }
  });

  autoUpdater.on("update-available", async function (info) {
    if (!process.env.PORTABLE_EXECUTABLE_DIR) {
      autoUpdater.downloadUpdate();
    } else {
      // Fetch release notes from GitHub API
      const releaseNotes = await fetchReleaseNotes(info.version);
      dialog.showMessageBox({
        type: "info",
        title: "Update Available",
        message: `A new version (${info.version}) is available.\n\nRelease Notes:\n${releaseNotes}`,
        buttons: ["OK"],
        defaultId: 1,
        noLink: true,
      });
    }
  });

  autoUpdater.on("update-not-available", function (_info) {
    logUpdateStatus("Update not available.");
  });

  autoUpdater.on("error", function (err) {
    logUpdateStatus("Error in auto-updater:" + err);
  });

  autoUpdater.on("download-progress", function (progressObj) {
    mainWindow.webContents.send("download-progress", progressObj);
  });

  autoUpdater.on("update-downloaded", async function (info) {
    // Fetch release notes from GitHub API
    const releaseNotes = await fetchReleaseNotes(info.version);
    log.info(JSON.stringify(info));
    // Display dialog to the user with release notes
    dialog
      .showMessageBox({
        type: "info",
        title: "Update Available",
        message: `A new version (${info.version}) is available.\n\nRelease Notes:\n${releaseNotes}\n\nDo you want to install it now?`,
        buttons: ["Quit and Install", "Install after Exit"],
        defaultId: 1,
        noLink: true,
      })
      .then((result) => {
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

process.stdin.resume(); //so the program will not close instantly

function getFileFromArgs(args) {
    return args.find(arg => SUPPORTED_FILES.some(ext => arg.toLowerCase().endsWith(ext)));
}
async function exitHandler(options, exitCode) {
  if (options.cleanup) {
    // clean up settings.json litter
    const conf = app.getPath("userData");
    fs.readdir(conf, (err, files) => {
      if (err) {
        console.error("Error reading folder:", err);
        return;
      }
      files.forEach((file) => {
        if (file.startsWith("settings.json.")) {
          fs.unlink(path.join(conf, file), (err) => {
            if (err) {
              console.error("Error deleting file:", err);
            } else {
              DEBUG && console.log("Deleted file:", file);
            }
          });
        }
      });
    });

    // Disable debug mode here?
  } else {
    DEBUG && console.log("no clean");
  }
  if (exitCode || exitCode === 0) {
    DEBUG && console.log(exitCode);
  }
  if (options.exit) {
    process.exit();
  }
}

//do something when app is closing
process.on("exit", exitHandler.bind(undefined, { cleanup: true }));
//catches ctrl+c event (but not in main process!)
process.on("SIGINT", exitHandler.bind(undefined, { exit: true }));
// catches "kill pid" (for example: nodemon restart)
process.on("SIGUSR1", exitHandler.bind(undefined, { exit: true }));
process.on("SIGUSR2", exitHandler.bind(undefined, { exit: true }));
//catches uncaught exceptions
process.on("uncaughtException", exitHandler.bind(undefined, { exit: true }));

ipcMain.handle('getPath', () => app.getPath('userData'));
ipcMain.handle('getAppPath', () => app.getAppPath());
ipcMain.handle('trialPeriod', () => 14*24*3600*1000); // 14 days
ipcMain.handle('getLocale', () => app.getLocale());
ipcMain.handle('getTemp', () => app.getPath('temp'));
ipcMain.handle('isMac', () => process.platform === 'darwin');
ipcMain.handle('getAudio', () => path.join(__dirname.replace('app.asar', ''), 'Help', 'example.mp3'));
ipcMain.handle('exitApplication', () => app.quit()); 

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
    windowState.isFullScreen = window.isFullScreen();
    try {
      await settings.set(`windowState.${windowName}`, windowState);
    } catch {} // do nothing
  }
  function track(win) {
    window = win;
    ["resize", "move", "close", "maximize", "unmaximize"].forEach((event) => {
      win.on(event, saveState);
    });
  }
  await setBounds();
  return { ...windowState, track };
}


async function createWindow() {
  // Create the browser window.
  // Get window state
  const mainWindowStateKeeper = await windowStateKeeper("main");

  mainWindow = new BrowserWindow({
    show: false,
    title: "Chirpity Nocmig",
    x: mainWindowStateKeeper.x,
    y: mainWindowStateKeeper.y,
    width: mainWindowStateKeeper.width,
    height: mainWindowStateKeeper.height,

    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  mainWindow.setFullScreen(mainWindowStateKeeper.isFullScreen);
  mainWindowStateKeeper.isMaximized &&  mainWindow.maximize();

  // Track window state
  mainWindowStateKeeper.track(mainWindow);

  // Set icon
  mainWindow.setIcon(__dirname + "/img/icon/icon.png");

  // Hide nav bar except in ci mode

  mainWindow.setMenuBarVisibility(!!process.env.CI);

  // and load the index.html of the app.
  mainWindow.loadFile("index.html");

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    DEBUG && mainWindow.webContents.openDevTools({ mode: "detach" });
  });
  DEBUG && console.log("main window created");
  // Emitted when the window is closed.
  if (process.platform !== "darwin") {
    mainWindow.on("closed", () => {
      app.quit();
    });
  }

  mainWindow.on("close", (e) => {
    if (unsavedRecords && !process.env.CI) {
      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: "warning",
        buttons: ["Yes", "No"],
        title: "Unsaved Records",
        message: "There are unsaved records, are you sure you want to exit?",
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
  const mainWindowStateKeeper = await windowStateKeeper("worker");
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
      backgroundThrottling: false,
    },
  });
  // Track window state
  mainWindowStateKeeper.track(workerWindow);
  workerWindow.setIcon(__dirname + "/img/icon/icon.png");
  await workerWindow.loadFile("worker.html");

  workerWindow.on("closed", () => {
    workerWindow = undefined;
  });
  workerWindow.once("ready-to-show", () => {
    if (DEBUG) {
      workerWindow.show();
      workerWindow.webContents.openDevTools();
    }
  });
  DEBUG && console.log("worker created");
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (e, commandLine) => {
    // This event is emitted when a second instance is launched
    // Focus the primary instance's window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      const filePath = getFileFromArgs(commandLine)
      if (filePath) {
          mainWindow.webContents.send('open-file', filePath);
      }
    }
  });

  // This method will be called when Electron has finished loading
  app.whenReady().then(async () => {
    // Update the userData path for portable app
    if (process.env.PORTABLE_EXECUTABLE_DIR) {
      app.setPath(
        "userData",
        path.join(process.env.PORTABLE_EXECUTABLE_DIR, "chirpity-data")
      );
      ipcMain.handle("getVersion", () => app.getVersion() + " (Portable)");
    } else {
      ipcMain.handle("getVersion", () => app.getVersion());
    }

      ipcMain.handle('getInstallDate', (_e, date) => getInstallInfo(date));
      
      // Debug mode
      try {
          // Specify the file path
          filePath = path.join(app.getPath('userData'), 'config.json');
          // Read the contents of the file synchronously
          fileContent = fs.readFileSync(filePath, 'utf8');
          config = JSON.parse(fileContent);
          DEBUG =   process.env.CI === 'e2e' ? false : config.debug;
      } catch (error) {
        console.warn('CONFIG: Error reading file:', error.message);
      }
      
      DEBUG && console.log('CI mode' , process.env.CI)

      await createWorker();
      await createWindow();

      if (process.platform === 'darwin') {
          //const appIcon = new Tray('./img/icon/icon.png')
          app.dock.setIcon(__dirname + '/img/icon/icon.png');
          app.dock.bounce();
      } else {
          // Quit when all windows are closed.
          app.on('window-all-closed', () => {
              app.quit()
          })
          const filePath = getFileFromArgs(process.argv);
          if (filePath) {
              mainWindow.webContents.once('did-finish-load', () => {
                  mainWindow.webContents.send('open-file', filePath);
              });
          }
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
                  properties: [fileOrFolder, multi] ,
                  buttonLabel: buttonLabel,
                  title: title
              }
              if (fileOrFolder === 'openFile' ){
                  options.filters = [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'mpga', 'mpeg', 'mp4', 'opus', 'mov'] } ]
              }
          } else {
            const ext = type === 'Text' ? 'txt' : 'csv';
            options = {
                filters: [
                    { name: `${type} Files`, extensions: [ext] }
                ],
                properties: ['openFile']
            }
          }
          // Show file dialog 
          return await dialog.showOpenDialog(mainWindow, options);
      })
        
    /**
   * Retrieves the first file path from the given arguments that matches a supported file extension.
   *
   * This function iterates over an array of arguments and returns the first element that ends with any
   * of the file extensions defined in the global `SUPPORTED_FILES` array. The check is performed in a
   * case-insensitive manner.
   *
   * @param {string[]} args - An array of command line arguments potentially containing file paths.
   * @returns {string|undefined} The first matching file path with a supported extension, or `undefined` if none is found.
   */
    
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
    if (process.env.CI) {
        console.log('Auto-updater disabled in CI environment.');
    } else {
        autoUpdater.autoDownload = false;
        autoUpdater.checkForUpdatesAndNotify().catch(error => console.warn('Error checking for updates', error))
    }
});
}

app.on("activate", async () => {
  if (mainWindow === null) {
    await createWindow();
  }

  if (workerWindow == undefined) {
    await createWorker();
  }
});
let DB_CLOSED = false, QUITTING = false;
app.on('before-quit', async (event) => {
  if (DB_CLOSED || QUITTING) return
  event.preventDefault(); // Prevent default quit until cleanup is done
  QUITTING = true
  workerWindow.webContents.postMessage("close-database", null);
  // Add timeout to force quit after 5 seconds
  setTimeout(() => {
    if (!DB_CLOSED) {
      console.warn('Database closure timed out after 5 seconds, forcing quit...');
      DB_CLOSED = true;
      app.quit();
    }
  }, 5000);
});
  
ipcMain.on('database-closed', () =>{
  DB_CLOSED = true;
  app.quit()
 })
ipcMain.handle("request-worker-channel", async (_event) => {
  // Create a new channel ...
  const { port1, port2 } = new MessageChannelMain();
  // ... send one end to the worker ...
  workerWindow.webContents.postMessage("new-client", undefined, [port1]);
  // ... and the other end to the UI window.
  mainWindow.webContents.postMessage("provide-worker-channel", undefined, [
    port2,
  ]);
  // Now the main window and the worker can communicate with each other
  // without going through the main process!
});

ipcMain.handle("unsaved-records", (_event, data) => {
  unsavedRecords = data.newValue; // Update the variable with the new value
});

ipcMain.handle("exportData", async (event, arg) => {
  const {defaultPath} = arg;
  return await dialog
    .showSaveDialog(mainWindow, {
      filters: [{ name: "Text Files", extensions: ["txt", "csv"] }],
      defaultPath
    })
    .then((file) => file.filePath)
})


ipcMain.handle("saveFile", async (event, arg) => {
  // Show file dialog to select audio file
    const { file, filename, extension } = arg;
    dialog
      .showSaveDialog(mainWindow, {
        title: "Save File",
        filters: [{ name: "Audio files", extensions: [extension] }],
        defaultPath: filename,
      })
      .then((saveObj) => {
        // Check if the user cancelled the operation
        const { canceled, filePath } = saveObj;
        if (canceled) {
          DEBUG && console.log("User cancelled the save operation.");
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
      });
});

let powerSaveID = null;
ipcMain.handle("powerSaveControl", (e, on) => {
  if (on) {
    powerSaveID = powerSaveBlocker.start("prevent-app-suspension");
    //DEBUG && console.log(powerSaveBlocker.isStarted(powerSaveID), powerSaveID)
  } else {
    if (powerSaveID !== null) powerSaveBlocker.stop(powerSaveID);
    //DEBUG && console.log(powerSaveBlocker.isStarted(powerSaveID), powerSaveID)
  }
});
