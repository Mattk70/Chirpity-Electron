const {app, BrowserWindow} = require('electron')
let win

function createWindow() {
    // Create the browser window.
    win = new BrowserWindow({
        width: 1280,
        height: 768,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
        }
    })

    // Set icon
    win.setIcon(__dirname + '/img/icon/icon.png');

    // Always maximize
    win.maximize()

    // Hide nav bar
    win.setMenuBarVisibility(false);

    // and load the index.html of the app.
    win.loadFile('index.html')

    // Open the DevTools. Comment out for release
    win.webContents.openDevTools()

    // Emitted when the window is closed.
    win.on('closed', () => {
        win = null
    })
}

// This method will be called when Electron has finished
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (win === null) {
        createWindow()
    }
})
