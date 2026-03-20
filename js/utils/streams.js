const { Transform, Writable } = require("stream");
const DEBUG = false;
class PCMChunker extends Transform {
  constructor({
    sampleRate,
    windowSeconds,
    overlap = 0,
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

    this.bytesPerSample = 2;

    this.windowSamples = Math.floor(sampleRate * windowSeconds);
    this.stepSamples = Math.ceil(this.windowSamples * (1 - overlap));

    this.windowBytes = this.windowSamples * this.bytesPerSample;
    this.stepBytes = this.stepSamples * this.bytesPerSample;

    this.bufferBytes = this.windowBytes * 2;
    this.buffer = Buffer.alloc(this.bufferBytes);

    this.writePos = 0;
    this.readPos = 0;

    this.availableBytes = 0;

    // NEW: how many bytes have been logically consumed (like nextWindowStart)
    this.consumedBytes = 0;

    this.totalSamples = startTime;

    this.remainingTrim =
      trimSeconds > 0 ? Math.floor(sampleRate * trimSeconds * 2) : 0;
  }

  _getMonoChannelData(audio) {
    const int16 = new Int16Array(
      audio.buffer,
      audio.byteOffset,
      audio.byteLength / 2
    );

    const out = new Float32Array(int16.length);
    const s = 1 / 32768;

    for (let i = 0; i < int16.length; i++) {
      out[i] = int16[i] * s;
    }

    return out;
  }

  _readWindow(offset) {
    if (offset + this.windowBytes <= this.bufferBytes) {
      return this.buffer.subarray(offset, offset + this.windowBytes);
    }

    const part1 = this.buffer.subarray(offset);
    const part2 = this.buffer.subarray(
      0,
      this.windowBytes - part1.length
    );

    const tmp = Buffer.alloc(this.windowBytes);
    part1.copy(tmp, 0);
    part2.copy(tmp, part1.length);
    return tmp;
  }

  _emitAvailableWindows() {
    while (
      this.availableBytes - this.consumedBytes >= this.windowBytes
    ) {
      const window = this._readWindow(this.readPos);

      const channelData = this._getMonoChannelData(window);

      this.push({
        channelData,
        chunkStart: this.totalSamples,
        file: this.file,
        endTime: this.endTime,
      });

      // advance logical read position
      this.readPos =
        (this.readPos + this.stepBytes) % this.bufferBytes;

      this.consumedBytes += this.stepBytes;
      this.totalSamples += this.stepSamples;
    }

    // now discard only what is no longer needed
    if (this.consumedBytes > 0) {
      this.availableBytes -= this.consumedBytes;
      this.consumedBytes = 0;
    }
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
        const space = this.bufferBytes - this.writePos;
        const toCopy = Math.min(space, chunk.length - offset);

        chunk.copy(
          this.buffer,
          this.writePos,
          offset,
          offset + toCopy
        );

        this.writePos = (this.writePos + toCopy) % this.bufferBytes;
        this.availableBytes += toCopy;

        offset += toCopy;

        this._emitAvailableWindows();
      }

      callback();
    } catch (err) {
      callback(err);
    }
  }

  _flush(callback) {
    try {
      this._emitAvailableWindows();

      let remaining = this.availableBytes;

      let offset = this.readPos;
      let startSamples = this.totalSamples;

      while (remaining > 0) {
        const tmp = Buffer.alloc(this.windowBytes);

        const part = this._readWindow(offset);
        part.copy(tmp);

        const channelData = this._getMonoChannelData(tmp);

        this.push({
          channelData,
          chunkStart: startSamples,
          file: this.file,
          endTime: this.endTime,
        });

        offset = (offset + this.stepBytes) % this.bufferBytes;
        startSamples += this.stepSamples;

        remaining -= this.stepBytes;
      }

      callback();
    } catch (err) {
      callback(err);
    }
  }
}

class PredictionWritable extends Writable {
  constructor(
    sendToModel,
    { batchSize = 8, concurrency = 2, maxConcurrency = 32, minConcurrency = 1 }
  ) {
    super({ objectMode: true });

    this.sendToModel = sendToModel;

    this.batchSize = batchSize;
    this.batch = [];

    this.concurrency = concurrency;
    this.maxConcurrency = maxConcurrency;
    this.minConcurrency = minConcurrency;

    this.inFlight = 0; 
    this.pendingCallbacks = [];

    this._completedSinceLastCheck = 0;
    this._totalDuration = 0;

    this._logInterval = setInterval(() => this._adjustConcurrency(), 2000);
  }

  _adjustConcurrency() {
    const completed = this._completedSinceLastCheck;
    if (!completed) return;

    const avgDuration = this._totalDuration / completed;

    if (this.inFlight >= this.concurrency && this.concurrency < this.maxConcurrency) {
      this.concurrency++;
      DEBUG && console.log(`[PredictionWritable] concurrency ↑ ${this.concurrency} (${avgDuration.toFixed(0)}ms)`);
    } else if (this.inFlight < this.concurrency && this.concurrency > this.minConcurrency) {
      this.concurrency--;
      DEBUG && console.log(`[PredictionWritable] concurrency ↓ ${this.concurrency}`);
    }

    this._completedSinceLastCheck = 0;
    this._totalDuration = 0;
  }

  _write(chunk, _, callback) {
    this.batch.push(chunk);

    if (this.batch.length < this.batchSize) {
      callback();
      return;
    }

    const batch = this.batch;
    this.batch = [];

    this._sendBatch(batch, callback);
  }

  _sendBatch(batch, callback) {
    if (this.inFlight >= this.concurrency) {
      this.pendingCallbacks.push(() => this._sendBatch(batch, callback));
      return;
    }

    this.inFlight++;
    callback();

    const t0 = Date.now();

    const channelData = batch.map(j => j.channelData);
    const chunkStarts = batch.map(j => j.chunkStart);
    const file = batch[0].file;
    const endTime = batch[0].endTime;

    this.sendToModel(channelData, chunkStarts, file, endTime)
      .catch(e => {
        if (!["Prediction aborted", "Queue cancelled"].includes(e.message)) {
          console.error("Error in sendToModel", e);
        }
      })
      .finally(() => {
        this.inFlight--;
        this._completedSinceLastCheck++;
        this._totalDuration += Date.now() - t0;

        if (this.pendingCallbacks.length > 0) {
          const next = this.pendingCallbacks.shift();
          next();
        } else if (this.finalCallback && this.inFlight === 0) {
          this.finalCallback();
        }
      });
  }

  _final(callback) {
    clearInterval(this._logInterval);

    if (this.batch.length > 0) {
      this._sendBatch(this.batch, () => {});
      this.batch = [];
    }

    if (this.inFlight === 0) {
      callback();
    } else {
      this.finalCallback = callback;
    }
  }

  _destroy(err, callback) {
    clearInterval(this._logInterval);
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
    for (const entry of pending.values()) {
      if (!entry) continue;
      const { reject, timeout } = entry;
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
