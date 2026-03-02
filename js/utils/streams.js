const { Transform, Writable  } = require("stream");

class PCMChunker extends Transform {
  constructor({
    highWaterMarkBytes,
    sampleRate,
    startTime = 0,
    file,
    endTime,
    trimSeconds = 0,
    alertFn
  }) {
    super({ readableObjectMode: true });
    this.alertFn = alertFn;
    this.file = file;
    this.endTime = endTime;
    this.sampleRate = sampleRate;

    this.bytesPerSecond = 2 * sampleRate; // 16-bit mono
    this.frameSize = highWaterMarkBytes;

    this.buffer = Buffer.alloc(this.frameSize);
    this.bufferIndex = 0;

    // ✅ Single source of truth
    this.totalSamples = startTime;

    this.remainingTrim = trimSeconds > 0
      ? Math.floor(this.bytesPerSecond * trimSeconds)
      : 0;
  }

  _getMonoChannelData(audio) {
        if (audio.length % 2 !== 0) {
            this.alertFn({message: `WAV audio sample length must be even, got ${audio.length}`, type: 'error'})
            throw new Error(`Audio length must be even, got ${audio.length}`);
        }
        const int16 = new Int16Array(audio.buffer, audio.byteOffset, audio.byteLength / 2);
        const out = new Float32Array(int16.length);
        const s = 1 / 32768;
        const n = int16.length;
        const end = n - (n % 8);
        let i = 0;
        // Unroll for speed
        for (; i < end; i += 8) {
            out[i]     = int16[i]     * s;
            out[i + 1] = int16[i + 1] * s;
            out[i + 2] = int16[i + 2] * s;
            out[i + 3] = int16[i + 3] * s;
            out[i + 4] = int16[i + 4] * s;
            out[i + 5] = int16[i + 5] * s;
            out[i + 6] = int16[i + 6] * s;
            out[i + 7] = int16[i + 7] * s;
        }
        // Deal with remainder
        for (; i < n; i++) {
            out[i] = int16[i] * s;
        }
        return out;
    }
  _transform(chunk, _, callback) {
    try {
      if (this.remainingTrim > 0) {
        if (chunk.length <= this.remainingTrim) {
          this.remainingTrim -= chunk.length;
          return callback();
        } else {
          chunk = chunk.subarray(this.remainingTrim);
          this.remainingTrim = 0;
        }
      }

      let offset = 0;

      while (offset < chunk.length) {
        const remainingSpace = this.frameSize - this.bufferIndex;
        const toCopy = Math.min(
          remainingSpace,
          chunk.length - offset
        );

        chunk.copy(
          this.buffer,
          this.bufferIndex,
          offset,
          offset + toCopy
        );

        this.bufferIndex += toCopy;
        offset += toCopy;

        if (this.bufferIndex === this.frameSize) {
          const channelData = this._getMonoChannelData(
            this.buffer.subarray(0, this.frameSize)
          );

          const samplesInFrame = this.frameSize / 2;

          const job = {
            channelData,
            chunkStart: this.totalSamples,
            file: this.file,
            endTime: this.endTime
          };

          this.totalSamples += samplesInFrame;
          this.bufferIndex = 0;

          this.push(job)
        }
      }

      callback();
    } catch (err) {
      callback(err);
    }
  }

  _flush(callback) {
    try {
      if (this.bufferIndex > 0) {
        const channelData = this._getMonoChannelData(
          this.buffer.subarray(0, this.bufferIndex)
        );

        const samplesInFrame = this.bufferIndex / 2;

        this.push({
          channelData,
          chunkStart: this.totalSamples,
          file: this.file,
          endTime: this.endTime
        });

        this.totalSamples += samplesInFrame;
      }

      callback();
    } catch (err) {
      callback(err);
    }
  }
}

class PredictionWritable extends Writable {
  constructor(sendToModel, { concurrency = 6 }) {
    super({ objectMode: true });

    this.sendToModel = sendToModel;
    this.concurrency = concurrency;

    this.inFlight = 0;
    this.queue = [];
    this.finalCallback = null;
  }

  _write(chunk, _, callback) {
    if (this.inFlight >= this.concurrency) {
      // Queue chunk until capacity frees
      this.queue.push({ chunk, callback });
      return;
    }

    this._dispatch(chunk);
    callback(); // Allow stream to continue immediately
  }

  _dispatch(chunk) {
    this.inFlight++;

    const { channelData, chunkStart, file, endTime } = chunk;

    this.sendToModel(channelData, chunkStart, file, endTime)
      .catch((e) => {console.warn('Error in sendtomodel', e)})
      .finally(() => {
        this.inFlight--;

        if (this.queue.length > 0) {
          const { chunk, callback } = this.queue.shift();
          this._dispatch(chunk);
          callback();
        } else if (this.inFlight === 0 && this.finalCallback) {
          this.finalCallback();
        }
      });
  }

  _final(callback) {
    if (this.inFlight === 0) {
      callback();
    } else {
      this.finalCallback = callback;
    }
  }
}



/**
 * @param {*} workers An array of web workers 
 * @param {*} consumer A function to handle worker output
 * @param {Object} timeoutMs a timeout for worker responses
 * @returns 
 */
function createMultiWorkerQueue(workers, consumer, { timeoutMs = 60_000 } = {}) {
  let nextId = 1;
  let nextWorker = 0;

  const pending = new Map();

  workers.forEach((worker) => {
    const fallbackOnMessage = worker.onmessage;
    const fallbackOnError = worker.onerror;
    worker.onmessage = (e) => {
      const { id, result, error, message } = e.data || {};
      if (message !== "prediction" || id == null) {
        fallbackOnMessage?.(e);
        return;
      }
      const entry = pending.get(id);
      if (!entry) return;

      clearTimeout(entry.timeout);
      pending.delete(id);

      if (error) entry.reject(new Error(error));
      else {
        consumer(e.data)
        entry.resolve(result);
      }
    };

    worker.onerror = (err) => {
      fallbackOnError?.(err);
      for (const { reject, timeout } of pending.values()) {
        clearTimeout(timeout);
        reject(err);
      }
      pending.clear();
    };
  });

  function send(payload, transfer = []) {
    const id = nextId++;
    const workerIndex = nextWorker;
    nextWorker = (nextWorker + 1) % workers.length;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const entry = pending.get(id);
        if (!entry) return;
        pending.delete(id);
        // Mark this chunk as completed with empty output so file progress can advance.
        consumer({ file: payload.file, worker: workerIndex, result: [] }).catch(() => {});
        entry.reject(new Error("Worker timeout"));
      }, timeoutMs);

      pending.set(id, { resolve, reject, timeout, file: payload.file, workerIndex });

      workers[workerIndex].postMessage(
        { ...payload, worker: workerIndex, id },
        transfer
      );
    });
  }

  return { send };
}

export {PCMChunker, PredictionWritable, createMultiWorkerQueue}