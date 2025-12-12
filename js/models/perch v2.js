let ort = require ("onnxruntime-node");

const fs = require("node:fs");
const path = require("node:path");

let session;
let labels;
let backend;
const chunkLength = 160000; // 5 seconds at 32kHz
let batchSize = 1;
const sampleRate = 32000;
const numClasses = 14795;
const DEBUG = false;
let modelPath;

/**
 * Initialize an ONNX InferenceSession for the Perch model and configure execution options.
 *
 * Creates an InferenceSession for the file "perch_v2.onnx" located in the provided model directory,
 * configures execution providers, batch-size override, preferred output locations, and thread options,
 * and stores the created session in the module-level `session` variable.
 *
 * @param {string} mpath - Path to the directory containing `perch_v2.onnx`.
 * @param {string} backend - Execution backend identifier; use `'webgpu'` to enable GPU providers, otherwise CPU-only providers are used.
 * @param {number} batchSize - Batch size to apply to the model's free `batch` dimension.
 * @param {number} threads - Requested thread count for session configuration (applied to session thread options when supported).
 */
async function loadModel(mpath, backend, batchSize, threads) {
  const gpu = backend === 'webgpu';
  const providers = gpu ? [ 'webgpu', 'cpu'] : ['cpu'];
  const freeDimensionOverrides = { 'batch': batchSize };
  const   preferredOutputLocation = {
    'label': 'cpu',         // keep label on CPU. This is the only output we use.
    'embedding': 'gpu-buffer',   // keep other outputs on GPU buffer to save copying effort
    'spatial_embedding': 'gpu-buffer',   
    'spectrogram': 'gpu-buffer'
  }
  const threadOptions = gpu ? { intraOpNumThreads: 1, interOpNumThreads: 1 } : {};
//  const executionProviderConfig = gpu ? { webgpu: {  preferredLayout: 'NCHW',  validationMode: 'wgpuOnly' } } : {};
  const sessionOptions = { 
    executionProviders: providers,
    enableGraphCapture: true, 
    ...threadOptions,
    freeDimensionOverrides,
    preferredOutputLocation,
    // enableProfiling: true,
    // profileFilePrefix: 'perch_v2-profile'
  };
  const modelPath = path.join(mpath, 'perch_v2.onnx')
  session = await ort.InferenceSession.create(modelPath, sessionOptions);

}
onmessage = async (e) => {
  const modelRequest = e.data.message;
  const worker = e.data.worker;
  modelPath = e.data.modelPath ?? modelPath;
  let response;
  try {
    switch (modelRequest) {
      case 'terminate': {
        batchSize = e.data.batchSize || batchSize;
        if (e.data.backend) {
            if (backend !== e.data.backend) {
              if (session) {
                try { session.release(); } catch { /* ignore */ }
              }
              backend = e.data.backend;
              await loadModel(modelPath, backend);
            }
        }
        break;
      }
      case "change-threads": {
        const {threads} = e.data;
        await loadModel(modelPath, backend, batchSize, threads);
        break;
      }
      case "load": {
        if (!session) {
          backend = e.data.backend;
          const threads = e.data.threads;
          await loadModel(modelPath, backend, batchSize, threads);
          batchSize = e.data.batchSize;
          DEBUG && console.log(`Using backend: ${backend}`);

          const labelFile = path.join(modelPath,"labels.txt");
          const fileContents = fs.readFileSync(labelFile, 'utf-8');
          labels = fileContents.trim().split(/\r?\n/);
          DEBUG && console.log(
              `Model received load instruction. Using batch size ${batchSize}`
            );

        }
        postMessage({
        message: "model-ready",
        sampleRate,
        chunkLength,
        backend,
        labels,
        worker,
        });

        break;
      }
      case "predict": {
          const {
            chunks,
            start,
            fileStart,
            file,
            confidence,
            worker,
            resetResults,
          } = e.data;
          const selection = !resetResults;
          const [result, filename, startPosition] = await predictChunk(
            chunks,
            start,
            fileStart,
            file,
            confidence
          );
          response = {
            message: "prediction",
            file: filename,
            result,
            fileStart: startPosition,
            worker,
            selection,
          };
          postMessage(response);
        }
        break;
    }
  } catch (error) {
    // If worker was respawned
    console.log(error);
  }
};

const padAudio = (audio) => {
    const samples = batchSize * chunkLength;
    const remainder = audio.length % samples;
    if (remainder) {
        // Create a new array with the desired length
        const paddedAudio = new Float32Array(
        audio.length + (samples - remainder)
        );
        // Copy the existing values into the new array
        paddedAudio.set(audio);
        return paddedAudio;
    } else return audio;
};

const createAudioTensorBatch = (audio) => {
    audio = padAudio(audio);
    const numSamples = audio.length / chunkLength;
    return [new ort.Tensor('float32', audio, [numSamples, chunkLength]), numSamples];
};
/**
 * Prepare an audio buffer as a batched tensor, run batched prediction, and return the prediction alongside file metadata.
 * @param {Float32Array} audioBuffer - Raw audio samples for prediction; may be padded to fill batch-aligned chunks.
 * @param {number} start - Start position in samples used to compute time keys for each chunk in the batch.
 * @param {number} fileStart - Original file-relative start position in samples associated with this buffer.
 * @param {string} file - The source filename associated with the audioBuffer.
 * @returns {Array} A tuple [predictionResult, file, fileStart] where `predictionResult` is the value returned by predictBatch (keys and top-k indices/probabilities), `file` is the source filename, and `fileStart` is the file-relative start position in samples.
 */
async function predictChunk(
    audioBuffer,
    start,
    fileStart,
    file
  ) {
    const [audioBatch, numSamples] = createAudioTensorBatch(audioBuffer);
    const batchKeys = getKeys(numSamples, start);
    const result = await predictBatch(
      audioBatch,
      batchKeys
    );
    return [result, file, fileStart];
}

// Configure once (reuse these across calls)
const batchedIndices = Array.from({ length: batchSize });
const batchedProbs   = Array.from({ length: batchSize });

/**
 * Release GPU-backed tensors produced by a model prediction.
 *
 * @param {Object} prediction - Model output object that contains GPU-backed tensors.
 *   Must include `spectrogram`, `embedding`, and `spatial_embedding`, each exposing a `dispose()` method.
 */
async function disposeGPUTensors(prediction) {
  const {spectrogram, embedding, spatial_embedding} = prediction;
  spectrogram.dispose();
  embedding.dispose();
  spatial_embedding.dispose();
}

/**
 * Run the model on a batched audio tensor and produce the top prediction index and probability for each batch entry.
 * @param {object} audio - Batched audio tensor passed to the session (shape [numSamples, chunkLength]).
 * @param {Array<number|string>} keys - Array of start positions (in samples). This array is mutated in-place to contain time strings in seconds with three decimal places.
 * @returns {[Array<string>, Int32Array, Float32Array]} A tuple: `[keys, batchedIndices, batchedProbs]` where `keys` are the formatted time strings, `batchedIndices` is an Int32Array of top class indices for each batch entry, and `batchedProbs` is a Float32Array of the corresponding probabilities.
 */
async function predictBatch(audio, keys) {
  return new Promise((resolve) => {
    session.run({ inputs: audio }).then((prediction) => {
      const flat = prediction.label.cpuData; // Float32Array
      for (let b = 0; b < batchSize; b++) {
        const offset = b * numClasses;
        const logits = flat.subarray(offset, offset + numClasses);
        const {probs, idx} = topK(logits);
        batchedIndices[b] = idx;
        batchedProbs[b] = probs;
      }
      resolve([keys, batchedIndices, batchedProbs]);
      disposeGPUTensors(prediction)
      })
    // convert keys to time strings once (not in the inner loop)
    for (let i = 0; i < keys.length; i++) {
      keys[i] = (keys[i] / sampleRate).toFixed(3);
    }
  });
}


/**
 * Compute sample-offset keys for a sequence of audio chunks.
 * @param {number} numSamples - Number of chunk keys to generate.
 * @param {number} start - Starting sample index used as the base offset.
 * @returns {number[]} An array of sample indices for each chunk; each entry equals `start + chunkLength * i` for i from 0 to numSamples-1.
 */
function getKeys(numSamples, start) {
    return [...Array(numSamples).keys()].map((i) => start + chunkLength * i);
}

const loadTopK = require("../utils/topKWASM.js");
const { topK } = await loadTopK();
