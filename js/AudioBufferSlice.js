const audioContext = new window.AudioContext;

function AudioBufferSlice(buffer, begin, end, callback) {
    if (!(this instanceof AudioBufferSlice)) {
        return new AudioBufferSlice(buffer, begin, end, callback);
    }

    let error = null;

    const duration = buffer.duration;
    const channels = buffer.numberOfChannels;
    const rate = buffer.sampleRate;

    if (typeof end === 'function') {
        callback = end;
        end = duration;
    }

    // handle short clips and beginning /end of files
    if (end > duration) end = duration;
    if (begin < 0) begin = 0;

    if (typeof callback !== 'function') {
        error = new TypeError('callback must be a function');
    }

    const startOffset = rate * begin;
    const endOffset = rate * end;
    const frameCount = endOffset - startOffset;
    let newArrayBuffer;

    try {
        newArrayBuffer = audioContext.createBuffer(channels, endOffset - startOffset, rate);
        const anotherArray = new Float32Array(frameCount);
        const offset = 0;

        for (let channel = 0; channel < channels; channel++) {
            buffer.copyFromChannel(anotherArray, channel, startOffset);
            newArrayBuffer.copyToChannel(anotherArray, channel, offset);
        }
    } catch (e) {
        error = e;
    }

    callback(error, newArrayBuffer);
}

module.exports = AudioBufferSlice;