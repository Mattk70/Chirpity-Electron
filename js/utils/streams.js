const { Transform, Writable } = require("stream");
const DEBUG = false;
class PCMChunker extends Transform {
  constructor({
    highWaterMarkBytes,
    sampleRate,
    startTime = 0,
    file,
    endTime,
    trimSeconds = 0,
    alertFn,
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

    this.remainingTrim =
      trimSeconds > 0 ? Math.floor(this.bytesPerSecond * trimSeconds) : 0;
  }

  _getMonoChannelData(audio) {
    if (audio.length % 2 !== 0) {
      this.alertFn({
        message: `WAV audio sample length must be even, got ${audio.length}`,
        type: "error",
      });
      throw new Error(`Audio length must be even, got ${audio.length}`);
    }
    const int16 = new Int16Array(
      audio.buffer,
      audio.byteOffset,
      audio.byteLength / 2,
    );
    const out = new Float32Array(int16.length);
    const s = 1 / 32768;
    const n = int16.length;
    const end = n - (n % 8);
    let i = 0;
    // Unroll for speed
    for (; i < end; i += 8) {
      out[i] = int16[i] * s;
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
        const toCopy = Math.min(remainingSpace, chunk.length - offset);

        chunk.copy(this.buffer, this.bufferIndex, offset, offset + toCopy);

        this.bufferIndex += toCopy;
        offset += toCopy;

        if (this.bufferIndex === this.frameSize) {
          const channelData = this._getMonoChannelData(
            this.buffer.subarray(0, this.frameSize),
          );

          const samplesInFrame = this.frameSize / 2;

          const job = {
            channelData,
            chunkStart: this.totalSamples,
            file: this.file,
            endTime: this.endTime,
          };

          this.totalSamples += samplesInFrame;
          this.bufferIndex = 0;

          this.push(job);
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
          this.buffer.subarray(0, this.bufferIndex),
        );

        const samplesInFrame = this.bufferIndex / 2;

        this.push({
          channelData,
          chunkStart: this.totalSamples,
          file: this.file,
          endTime: this.endTime,
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
  constructor(sendToModel, { concurrency = 2, maxConcurrency = 32, minConcurrency = 1 }) {
    super({ objectMode: true });

    this.sendToModel = sendToModel;
    this.concurrency = concurrency;       // starts conservative
    this.maxConcurrency = maxConcurrency;
    this.minConcurrency = minConcurrency;

    this.inFlight = 0;
    this.queue = [];
    this.finalCallback = null;

    // Throughput tracking
    this._completedSinceLastCheck = 0;
    this._totalDuration = 0;
    this._logInterval = setInterval(() => this._adjustConcurrency(), 2000);
  }

  _adjustConcurrency() {
    const completed = this._completedSinceLastCheck;
    if (completed === 0) return;

    const avgDuration = this._totalDuration / completed;
    const queuePressure = this.queue.length;

    if (queuePressure === 0 && this.inFlight >= this.concurrency && this.concurrency < this.maxConcurrency) {
      // Workers are keeping up and we're saturated — try adding a slot
      this.concurrency++;
      DEBUG && console.log(`[PredictionWritable] concurrency ↑ ${this.concurrency} (avg job: ${avgDuration.toFixed(0)}ms)`);
    } else if (queuePressure > 0 && this.concurrency > this.minConcurrency) {
      // Queue is building — back off
      this.concurrency--;
      DEBUG && console.log(`[PredictionWritable] concurrency ↓ ${this.concurrency} (queue: ${queuePressure})`);
    }

    this._completedSinceLastCheck = 0;
    this._totalDuration = 0;
  }

  _write(chunk, _, callback) {
    if (this.inFlight >= this.concurrency) {
      // Hold the callback to apply backpressure upstream until a slot is free
      this.queue.push({ chunk, callback });
      return;
    }

    this._dispatch(chunk, callback);
  }

  _dispatch(chunk, callback) {
    this.inFlight++;
    callback();

    const t0 = Date.now();
    const { channelData, chunkStart, file, endTime } = chunk;

    this.sendToModel(channelData, chunkStart, file, endTime)
      .catch((e) => {
        if (!["Prediction aborted", "Queue cancelled"].includes(e.message)) {
          console.error("Error in sendtomodel", e);
        }
      })
      .finally(() => {
        this.inFlight--;
        this._completedSinceLastCheck++;
        this._totalDuration += Date.now() - t0;

        if (this.queue.length > 0) {
          const { chunk, callback } = this.queue.shift();
          this._dispatch(chunk, callback);
        } else if (this.inFlight === 0 && this.finalCallback) {
          this.finalCallback();
        }
      });
  }

  _final(callback) {
    clearInterval(this._logInterval);
    if (this.inFlight === 0) {
      callback();
    } else {
      this.finalCallback = callback;
    }
  }

  _destroy(err, callback) {
    callback(err);
  }
}


/**
 * @param {*} workers An array of web workers
 * @param {*} consumer A function to handle worker output
 * @param {Object} timeoutMs a timeout for worker responses
 * @returns
 */
function createMultiWorkerQueue(
  workers,
  consumer,
  { timeoutMs = 60_000 } = {},
) {
  let nextId = 1;
  let nextWorker = 0;
  let cancelled = false;
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
        Promise.resolve(consumer(e.data))
          .then(() => entry.resolve(result))
          .catch((consumeErr) => entry.reject(consumeErr));
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
  function cancelAll(reason = "Aborted") {
    cancelled = true;
    for (const { reject, timeout } of pending.values()) {
      clearTimeout(timeout);
      reject(new Error(reason));
    }
    pending.clear();
  }
  function send(payload, transfer = []) {
    if (cancelled) {
        return Promise.reject(new Error("Queue cancelled"));
    }
    const id = nextId++;
    const workerIndex = nextWorker;
    nextWorker = (nextWorker + 1) % workers.length;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const entry = pending.get(id);
        if (!entry) return;
        pending.delete(id);
        // Mark this chunk as completed with empty output so file progress can advance.
        consumer({ file: payload.file, worker: workerIndex, result: [] }).catch(
          () => {},
        );
        entry.reject(new Error("Worker timeout"));
      }, timeoutMs);

      pending.set(id, {
        resolve,
        reject,
        timeout,
        file: payload.file,
        workerIndex,
      });

      workers[workerIndex].postMessage(
        { ...payload, worker: workerIndex, id },
        transfer,
      );
    });
  }

  return { send, cancelAll };
}

class FileQueueManager {
  constructor() {
    this.statuses = ["pending", "inProgress", "complete", "missing", "invalid"];
    this.byStatus = {};
    for (const s of this.statuses) this.byStatus[s] = new Set();
  }

  /** Add new files with a given status or all start as pending */
  setFiles(filePaths, status) {
    status ??= "pending";
    this._checkStatusValue(status);
    this._reset();
    for (const path of filePaths) {
      this.byStatus[status].add(path);
    }
  }

  /** Add new files with a given status or all start as pending */
  addFile(file, status) {
    status ??= "pending";
    this._checkStatusValue(status);
    this.byStatus[status].add(file);
  }

  /** Get the current status of a file */
  getStatus(path) {
    for (const status in this.byStatus) {
      if (this.byStatus[status].has(path)) {
        return status;
      }
    }
    return null; // not found
  }

  /** Transition only if current status matches expected */
  transition(path, fromStatus, toStatus) {
    this._checkStatusValue(toStatus);
    this._checkStatusValue(fromStatus);
    if (this.byStatus[fromStatus]?.has(path)) {
      this.byStatus[fromStatus].delete(path);
      this.byStatus[toStatus].add(path);
      return true;
    }
    return false;
  }

  /**
   * Move all files from one or more statuses to a new status
   * @param {string|string[]} fromStatuses - status or array of statuses to move from
   * @param {string} toStatus - status to move to
   */
  moveAll(fromStatuses, toStatus) {
    const toSet = this.byStatus[toStatus];
    if (!toSet) throw new Error(`Invalid target status: ${toStatus}`);

    // ensure fromStatuses is an array
    const sources = Array.isArray(fromStatuses) ? fromStatuses : [fromStatuses];

    for (const fromStatus of sources) {
      if (fromStatus === toStatus) continue;
      const fromSet = this.byStatus[fromStatus];
      if (!fromSet) throw new Error(`Invalid source status: ${fromStatus}`);
      for (const path of fromSet) {
        toSet.add(path);
      }
      fromSet.clear();
    }
  }

  markComplete(path) {
    return this.transition(path, "inProgress", "complete");
  }
  renameFile(oldPath, newPath) {
    for (const status in this.byStatus) {
      const set = this.byStatus[status];
      if (set.has(oldPath)) {
        set.delete(oldPath);
        set.add(newPath);
        return true; // renamed successfully
      }
    }
    return false; // file not found
  }

  _checkStatusValue = (status) => {
    if (!this.byStatus[status]) throw new Error(`Invalid status: ${status}`);
  };
  /** Update a file’s status */
  setStatus(path, newStatus) {
    this._checkStatusValue(newStatus);
    for (const status of this.statuses) {
      if (this.byStatus[status].delete(path)) {
        this.byStatus[newStatus].add(path);
        return true; // updated
      }
    }
    return false; // file not found
  }

  /** Set a new status for all files in the queue */
  setAll(newStatus) {
    this._checkStatusValue(newStatus);
    for (const status of this.statuses) {
      if (status === newStatus) continue;
      const set = this.byStatus[status];
      for (const path of set) {
        this.byStatus[newStatus].add(path);
      }
      // Clear the old status set
      set.clear();
    }
  }
  /** Reset all sets (clear all files) */
  _reset() {
    for (const status of this.statuses) {
      this.byStatus[status].clear();
    }
  }

  /** Check if any files have a given status */
  any(status) {
    this._checkStatusValue(status);
    return this.byStatus[status]?.size > 0;
  }

  /** Check if all files are complete */
  allComplete() {
    const totalFiles = this.getSize();
    const doneStatuses = ["complete", "missing", "invalid"];
    const finished = doneStatuses.reduce(
      (sum, status) => sum + (this.byStatus[status]?.size || 0),
      0,
    );
    return finished === totalFiles;
  }

  /** Get an array of all paths (optionally filtered by status) */
  getAllPaths(status) {
    if (status) {
      this._checkStatusValue(status);
      return [...(this.byStatus[status] || [])];
    }
    return this.statuses.flatMap((s) => [...this.byStatus[s]]);
  }

  /** Get the size of the queue (optionally for 'status') */
  getSize(status) {
    if (status) {
      this._checkStatusValue(status);
      return this.byStatus[status].size;
    }
    return this.statuses.reduce(
      (sum, status) => sum + this.byStatus[status].size,
      0,
    );
  }

  /** Get current counts per status */
  getCounts() {
    const counts = {};
    for (const status of this.statuses) {
      counts[status] = this.byStatus[status].size;
    }
    return counts;
  }
}

export {
  PCMChunker,
  PredictionWritable,
  createMultiWorkerQueue,
  FileQueueManager,
};
