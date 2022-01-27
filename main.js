const {app, dialog, ipcMain, BrowserWindow} = require('electron');
let mainWindow;
let workerWindow;

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
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

    // Always maximize
    //mainWindow.maximize()

    // Hide nav bar
    mainWindow.setMenuBarVisibility(false);

    // and load the index.html of the app.
    mainWindow.loadFile('index.html')

    // Open the DevTools. Comment out for release
    mainWindow.webContents.openDevTools()

    // Emitted when the window is closed.
    mainWindow.on('closed', () => {
        app.quit()
    })
}


function createWorker() {
    // hidden worker
    workerWindow = new BrowserWindow({
        //show: false,
        show: true,
        height: 80,
        width: 120,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true
        }
    });
    workerWindow.loadFile('worker.html');

    workerWindow.on('closed', () => {
        workerWindow = null;
    });

    workerWindow.webContents.openDevTools();

    console.log("worker created");
}

// This method will be called when Electron has finished
app.on('ready', () => {
    createWorker();
    createWindow();
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


ipcMain.on('file-loaded', async (event, arg) => {
    const currentFile = arg.message;
    console.log('Main received file-loaded: ' + arg.message)
    workerWindow.webContents.send('file-loaded', {message: currentFile});
});

ipcMain.on('analyze', async (event, arg) => {
    const currentFile = arg.message;
    console.log('Main received go signal: ' + arg.message)
    workerWindow.webContents.send('analyze', {message: 'go', start: arg.start, end: arg.end});
});

ipcMain.on('prediction-ongoing', (event, arg) => {
    const result = arg.result;
    const index = arg.index
    mainWindow.webContents.send('prediction-ongoing', {result, index});
});

ipcMain.on('prediction-done', (event, arg) => {
    const labels = arg.labels;
    mainWindow.webContents.send('prediction-done', {labels});
});

ipcMain.on('model-ready', (event, arg) => {
    const results = arg.results;
    mainWindow.webContents.send('model-ready', {results});
});

ipcMain.on('progress', (event, arg) => {
    const progress = arg.progress;
    mainWindow.webContents.send('progress', {progress});
});