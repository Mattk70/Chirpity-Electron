// electron/perch-webworker.js
// This worker spawns the perch-infer executable, reads stdout line-by-line, detects READY,
// parses newline-delimited JSON responses and resolves pending requests.

const { spawn } = require('child_process');
const path = require('node:path');
let proc = null;
let stdoutRemainder = '';
let workerId = 0;
const pending = [];
const sampleRate = 32_000;
const WINDOW_SIZE = 5; // seconds
const chunkLength = sampleRate * WINDOW_SIZE;
const DEBUG = false;

function startProcess(exePath) {
  if (proc) return { ok: true };
  if (!exePath) return { ok: false, error: 'perch exe not found; pass exePath or bundle dist/perch-infer' };
  const exe = path.join(exePath, 'perch-infer');

  proc = spawn(exe, [], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, env: Object.assign({}, process.env, { TF_CPP_MIN_LOG_LEVEL: '2' }) });

  proc.stdout.on('data', (chunk) => {
    const text = chunk.toString('utf8');
    const lines = (stdoutRemainder + text).split(/\r?\n/);
    stdoutRemainder = lines.pop();
    for (const line of lines) handleStdoutLine(line);
  });

  proc.stderr.on('data', (chunk) => {
    const text = chunk.toString('utf8');
    text.startsWith('WARNING') || console.error('perch-webworker stderr', text);
  });

  proc.on('exit', (code, sig) => {
    console.log('perch-webworker exit', { code, signal: sig });
    while (pending.length) {
      const p = pending.shift();
      clearTimeout(p.timer);
      p.reject(new Error('perch exited before response'));
    }
    proc = null;
  });

  proc.on('error', (err) => {
    console.error('perch-webworker error', { message: String(err) });
    while (pending.length) {
      const p = pending.shift();
      clearTimeout(p.timer);
      p.reject(err);
    }
    proc = null;
  });
  return { ok: true };
}

function handleStdoutLine(line) {
  if (!line || !line.trim()) return;
  DEBUG && console.debug('perch-webworker stdout line', line);
  if (line.includes('READY')) { 
    postMessage({
      message: "model-ready",
      sampleRate,
      chunkLength,
      backend: 'tensorflow'
    });
    return; 
}
  try {
    let obj = JSON.parse(line);
    if (pending.length) {
        const p = pending.shift();
        const numSamples = obj.label_topk_indices.length;
        const keys = Array.from({ length: numSamples }, (_, i) => (p.start + chunkLength * i) / sampleRate);
        obj.keys = keys;
        const result = [obj.keys, obj.label_topk_indices, obj.label_topk_scores];
        obj = null; // free memory
        clearTimeout(p.timer);
        p.resolve(obj);
        const response = {
          message: "prediction",
          file: p.file,
          result,
          fileStart: p.fileStart,
          worker: workerId
        };
        postMessage(response);
      return;
    }

  } catch (err) {
    // not JSON; ignore but surface in debug
    console.debug('perch-webworker non-JSON stdout line', err);
  }
}

/**
 * Send a JSON-serializable payload to the spawned perch-infer process via stdin.
 *
 * @param {any} payload - The value to serialize and send; must be JSON-serializable and will be written with a trailing newline.
 * @throws {Error} If the underlying child process or its stdin is not available or has been destroyed.
 */
function sendPayload(payload) {
  if (!proc || !proc.stdin || proc.stdin.destroyed) throw new Error('process not running');
  const t0 = Date.now();
  const test = JSON.stringify(payload) + '\n';
  DEBUG && console.log('perch sendPayload', { timeMs: Date.now() - t0, length: test.length });
  proc.stdin.write(test, 'utf8');
}

/**
 * Send an audio payload to the running inference process and wait for its matching response.
 *
 * @param {Array<number>|Uint8Array|Float32Array} audio - A contiguous audio buffer to be sent for inference; must represent samples matching the model's expected format.
 * @param {Object} [opts] - Optional request controls and metadata.
 * @param {string} [opts.requestId] - Custom id for this request; a timestamp-based id is generated when omitted.
 * @param {number} [opts.timeoutMs=300000] - Milliseconds to wait for a response before rejecting.
 * @param {string} [opts.file] - Optional file identifier associated with this request, included in responses.
 * @param {number} [opts.fileStart] - Optional file-offset timestamp included in responses.
 * @param {number} [opts.start] - Optional sample index (start) used to compute result timestamps.
 * @returns {Promise<any>} Resolves with the parsed inference response object when the process returns a matching result; rejects if the process is not running, sending fails, or the request times out.
 */
function requestResponse(audio, opts = {}) {
  return new Promise((resolve, reject) => {
    if (!proc) return reject(new Error('process not running'));
    const id = (opts && opts.requestId) || (Date.now().toString(36) + Math.random().toString(36).slice(2,8));
    const timeoutMs = (opts && opts.timeoutMs) || 300000;
    const timer = setTimeout(() => {
      const idx = pending.findIndex(x => x.id === id);
      if (idx >= 0) pending.splice(idx, 1);
      reject(new Error('timeout waiting for response'));
    }, timeoutMs);

    pending.push({ id, resolve, reject, timer, file: opts.file, fileStart: opts.fileStart, start: opts.start });
    try { 
        sendPayload({ input: audio }); 
    } catch (err) { 
        clearTimeout(timer); 
        const idx = pending.findIndex(x => x.id === id);
        if (idx >= 0) pending.splice(idx,1); 
        reject(err); 
    }
  });
}


onmessage = async (e) => {
  const { modelPath, message, worker } = e.data;
  try {
    switch (message) {
      case 'load': {
        const r = startProcess(modelPath);
        workerId = worker;
        DEBUG && console.log('start', r);
        break;
      }
      case 'predict': {
        let {
          chunks,
          start,
          fileStart,
          file,
        } = e.data;
        try {
            let audio = chunks;
            const remainder = audio.length % chunkLength;
            if (remainder !== 0) {
              chunks = new Float32Array(audio.length + (chunkLength - remainder));
              chunks.set(audio);
              audio = chunks;
            }
            const chunked = [];
            for (let i = 0; i < audio.length; i += chunkLength) {
                chunked.push(Array.from(audio.slice(i, i + chunkLength)));
            }
            await requestResponse(chunked, {fileStart, file, start});
        } catch (err) {
          console.error('requestResponse', { error: String(err) });
        }
        break;
      }
      case 'terminate': {
        if (proc) {
          try { proc.kill(); } catch (e) { DEBUG && console.error('perch-webworker error killing proc', e && e.message); }
          proc = null;
        }
        console.log('stopped', {});
        break;
      }
      case 'change-batch-size': {
        break;
      }
      default:
        console.error('error', { message: 'unknown cmd ' + message });
    }
  } catch (err) {
    console.error('error', { message: String(err) });
  }
};