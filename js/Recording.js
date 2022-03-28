const SunCalc = require("suncalc2");
const fs = require("fs");

class Recording {

    constructor(path, sampleRate) {
        this.path = path;
        this.sampleRate = sampleRate;
        this.created = fs.statSync(path).mtime
        this.duration = null;
        this.start = null;
        this.buffer = null;
        this.detections = {};
        this.audioCtx = new AudioContext({latencyHint: 'interactive', sampleRate: sampleRate});
        this.controller = new AbortController();
        this.signal = this.controller.signal;
    }

    load = (path) =>
        fetch(path, {signal})
            .then((res => res.arrayBuffer()))
            .then((arrayBuffer) => this.audioCtx.decodeAudioData(arrayBuffer))
            .then((buffer) => {
                if (!this.controller.signal.aborted) {
                    let source = this.audioCtx.createBufferSource();
                    source.buffer = buffer;
                    this.duration = source.buffer.duration;
                    this.start = new Date(this.created - (this.duration * 1000));
                    const offlineCtx = new OfflineAudioContext(1, this.sampleRate * this.duration, this.sampleRate);
                    const offlineSource = offlineCtx.createBufferSource();
                    offlineSource.buffer = buffer;
                    offlineSource.connect(offlineCtx.destination);
                    offlineSource.start();
                    offlineCtx.startRendering().then(function (resampled) {
                        console.log('Rendering completed successfully');
                        // `resampled` contains an AudioBuffer resampled at sample rate.
                        // use resampled.getChannelData(x) to get an Float32Array for channel x.
                        this.buffer = resampled;
                    })
                } else {
                    throw new DOMException('Rendering cancelled at user request', "AbortError")
                }
            })
            .catch(function (e) {
                console.log("Error with decoding audio data " + e.message);
                if (e.name === "AbortError") {
                    // We know it's been canceled!
                    console.warn('Fetch aborted: sending message to worker')
                }
            })


}

module.exports = Recording;
