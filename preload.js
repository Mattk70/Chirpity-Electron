const {contextBridge, ipcRenderer} = require("electron");
const fs = require('fs');
const WaveSurfer = require("wavesurfer.js");
const SpectrogramPlugin = require('wavesurfer.js/dist/plugin/wavesurfer.spectrogram.min.js');
const SpecTimeline = require('wavesurfer.js/dist/plugin/wavesurfer.timeline.min.js');
const Regions = require('wavesurfer.js/dist/plugin/wavesurfer.regions.min.js');
const colormap = require("colormap");

const AudioBufferSlice = require('./js/AudioBufferSlice.js');
const p = require('path');
const SunCalc = require('suncalc2');
const {v4: uuidv4} = require("uuid");
const {gzip, ungzip} = require('node-gzip');
const si = require('systeminformation');


// We need to wait until the UI  is ready to receive the message before
// sending the port. We create this promise in the preload, so it's guaranteed
// to register the onload listener before the load event is fired.
const windowLoaded = new Promise(resolve => {
    window.onload = resolve
})

// We request that the main process sends us a channel we can use to
// communicate with the worker.
ipcRenderer.send('request-worker-channel')

ipcRenderer.once('provide-worker-channel', async(event) => {
    // make sure our ui is ready to receive the message
    await windowLoaded
    // Once we receive the reply, we can take the port...
    const [port] = event.ports

    // ... register a handler to receive results ...
    port.onmessage = (event) => {
        console.log('received result:', event.data)
    }
    // now transfer the port
    window.postMessage('provide-worker-channel', '*', event.ports)
})


contextBridge.exposeInMainWorld('electron', {
    openDialog: (method, config) => ipcRenderer.invoke('openFiles', method, config),
    getPath: () => ipcRenderer.invoke('getPath'),
    getVersion: () => ipcRenderer.invoke('getVersion')
});

contextBridge.exposeInMainWorld('module', {
    fs: fs,
    WaveSurfer: WaveSurfer,
    SpectrogramPlugin: SpectrogramPlugin,
    SpecTimeline: SpecTimeline,
    Regions: Regions,
    colormap: colormap,
    AudioBufferSlice: AudioBufferSlice,
    p: p,
    SunCalc: SunCalc,
    uuidv4: uuidv4,
    gzip: gzip,
    ungzip: ungzip,
    si: si
});
