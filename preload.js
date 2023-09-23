const {contextBridge, ipcRenderer} = require("electron");
const fs = require('fs');
const colormap = require("colormap");
const p = require('path');
const SunCalc = require('suncalc2');
const {v4: uuidv4} = require("uuid");
const os = require('os')

// We need to wait until the UI  is ready to receive the message before
// sending the port. We create this promise in the preload, so it's guaranteed
// to register the onload listener before the load event is fired.
const windowLoaded = new Promise(resolve => {
    window.onload = resolve
})

// We request that the main process sends us a channel we can use to
// communicate with the worker.
ipcRenderer.send('request-worker-channel');
// now see if we have files to load
ipcRenderer.send('file-to-load');

ipcRenderer.once('load-results', async (event, args) => {
    // make sure our ui is ready to receive the message
    await windowLoaded;
    console.log('Posting file to UI');
    window.postMessage({args: args}, '/')
})
ipcRenderer.once('provide-worker-channel', async (event) => {
    // make sure our ui is ready to receive the message
    await windowLoaded;
    // Once we receive the reply, we can take the port...
    const [port] = event.ports

    // ... register a handler to receive results ...
    port.onmessage = (event) => {
        console.log('received result:', event.data)
    }
    // now transfer the port
    window.postMessage('provide-worker-channel', '/', event.ports)
})


contextBridge.exposeInMainWorld('electron', {
    saveFile: (args) => ipcRenderer.invoke('saveFile', args),
    selectDirectory: () => ipcRenderer.invoke('selectDirectory'),
    openDialog: (method, config) => ipcRenderer.invoke('openFiles', method, config),
    powerSaveBlocker: (on) => ipcRenderer.invoke('powerSaveBlocker', on),
    getPath: () => ipcRenderer.invoke('getPath'),
    getTemp: () => ipcRenderer.invoke('getTemp'),
    getVersion: () => ipcRenderer.invoke('getVersion'),
    getAudio: () => ipcRenderer.invoke('getAudio'),
});

contextBridge.exposeInMainWorld('module', {
    fs: fs,
    colormap: colormap,
    p: p,
    SunCalc: SunCalc,
    uuidv4: uuidv4,
    os: os
});
