const audioContext = new window.AudioContext({sampleRate: 24000});

function  AudioBufferSlice(buffer, begin, end, callback) {
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
};

const concat = (buffer1, buffer2) => {
  const tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);

  tmp.set(new Uint8Array(buffer1), 0);
  tmp.set(new Uint8Array(buffer2), buffer1.byteLength);

  return tmp.buffer;
};

const appendBuffer = (buffer1, buffer2, context) => {
  const numberOfChannels = Math.min( buffer1.numberOfChannels, buffer2.numberOfChannels );
  const tmp = context.createBuffer( numberOfChannels, (buffer1.length + buffer2.length), buffer1.sampleRate );
  for (let i=0; i<numberOfChannels; i++) {
    const channel = tmp.getChannelData(i);
    channel.set( buffer1.getChannelData(i), 0);
    channel.set( buffer2.getChannelData(i), buffer1.length);
  }
  return tmp;
};


const withWaveHeader = (data, numberOfChannels, sampleRate) => {
  const header = new ArrayBuffer(44);

  const d = new DataView(header);

  d.setUint8(0, "R".charCodeAt(0));
  d.setUint8(1, "I".charCodeAt(0));
  d.setUint8(2, "F".charCodeAt(0));
  d.setUint8(3, "F".charCodeAt(0));

  d.setUint32(4, data.byteLength / 2 + 44, true);

  d.setUint8(8, "W".charCodeAt(0));
  d.setUint8(9, "A".charCodeAt(0));
  d.setUint8(10, "V".charCodeAt(0));
  d.setUint8(11, "E".charCodeAt(0));
  d.setUint8(12, "f".charCodeAt(0));
  d.setUint8(13, "m".charCodeAt(0));
  d.setUint8(14, "t".charCodeAt(0));
  d.setUint8(15, " ".charCodeAt(0));

  d.setUint32(16, 16, true);
  d.setUint16(20, 1, true);
  d.setUint16(22, numberOfChannels, true);
  d.setUint32(24, sampleRate, true);
  d.setUint32(28, sampleRate * 1 * 2);
  d.setUint16(32, numberOfChannels * 2);
  d.setUint16(34, 16, true);

  d.setUint8(36, "d".charCodeAt(0));
  d.setUint8(37, "a".charCodeAt(0));
  d.setUint8(38, "t".charCodeAt(0));
  d.setUint8(39, "a".charCodeAt(0));
  d.setUint32(40, data.byteLength, true);

  return concat(header, data);
};

module.exports =  {AudioBufferSlice, withWaveHeader, appendBuffer};

//module.exports = AudioBufferSlice;