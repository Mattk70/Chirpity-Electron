let ort = require ("onnxruntime-node");

const fs = require("node:fs");
const path = require("node:path");

let session;
let labels;
let backend;
const chunkLength = 160000; // 5 seconds at 32kHz
let batchSize = 8;
const sampleRate = 32000;
const numClasses = 14795;
const DEBUG = false;
let modelPath;

async function loadModel(mpath, backend, batchSize) {
  const gpu = backend === 'webgpu';
  const providers = gpu ? [ 'webgpu', 'cpu'] : ['cpu'];
  const freeDimensionOverrides = { 'batch': batchSize };
  const   preferredOutputLocation = {
    'label': 'cpu',         // keep label & embedding on CPU. This is the only output we use.
    'embedding': 'cpu',   
    'spatial_embedding': 'gpu-buffer',   // keep other outputs on GPU buffer to save copying effort
    'spectrogram': 'gpu-buffer'
  }
  const threadOptions = gpu ? { intraOpNumThreads: 1, interOpNumThreads: 1 } : {};
//  const executionProviderConfig = gpu ? { webgpu: {  preferredLayout: 'NCHW',  validationMode: 'wgpuOnly' } } : {};
  const sessionOptions = { 
    executionProviders: providers,
    enableGraphCapture: true, 
    ...threadOptions,
    preferredOutputLocation,
  };
  const modelPath = path.join(mpath, 'perch_v2.onnx')
  session = await ort.InferenceSession.create(modelPath, sessionOptions);
}
onmessage = async (e) => {
  const data = e.data;
  const modelRequest = data.message;
  const worker = data.worker;
  modelPath = data.modelPath ?? modelPath;
  let response;
  try {
    switch (modelRequest) {
      case 'terminate': {
        batchSize = data.batchSize || batchSize;
        if (data.backend) {
            if (backend !== data.backend) {
              if (session) {
                try { session.release() } catch (e) { console.error(e) }
              }
              backend = data.backend;
              await loadModel(modelPath, backend, batchSize);
            }
        }
        break;
      }
      case "change-threads": {
        // Optimal threads are set - can ignore this message
        break;
      }
      case "load": {
        if (!session) {
          backend = data.backend;
          batchSize = data.batchSize;
          await loadModel(modelPath, backend, batchSize);
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
          } = data;
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
const batchedEmbeds    = Array.from({ length: batchSize });

async function disposeGPUTensors(prediction) {
  const {spectrogram, spatial_embedding} = prediction;
  spectrogram.dispose();
  spatial_embedding.dispose();
}

let duration = 0, sDuration = 0;
/**
 * Predict batch post-process: returns [keys, batchedIndices, batchedProbs]
 * - flat: Float32Array of length batchSize * numClasses (logits)
 * - batchSize, numClasses, sampleRate available in outer scope / params
 */
async function predictBatch(audio, keys) {
    const prediction = await session.run({ inputs: audio })
    const flatID = prediction.label.cpuData; // Float32Array
    const flatEmbeds = prediction.embedding.cpuData;
    const dim = prediction.embedding.dims[1]
    
    for (let b = 0; b < batchSize; b++) {
      const offset = b * numClasses;
      const bOffset = b * dim;
      const logits = flatID.subarray(offset, offset + numClasses);
      const embedding = flatEmbeds.subarray(bOffset, bOffset + dim);
      const t0 = Date.now();
      const {probs, idx} = topK(logits);
      duration += Date.now() - t0;
      console.log(`Topk so far ${duration/1000} seconds`)
      batchedIndices[b] = idx;
      batchedProbs[b] = probs;
      l2Normalize(embedding);
      const f16 = new Float16Array(embedding.length);
      f16.set(embedding);   // automatic float32 → float16 conversion
      batchedEmbeds[b] = f16;
    }
    disposeGPUTensors(prediction)
    // convert keys to time strings once (not in the inner loop)
    for (let i = 0; i < keys.length; i++) {
      keys[i] = Math.round((keys[i] / sampleRate) * 1000) / 1000;
    }
    return [keys, batchedIndices, batchedProbs, batchedEmbeds];
}

function l2Normalize(vec) {
  let sum = 0.0;
  // Compute squared norm
  for (let i = 0; i < vec.length; i++) {
    const v = vec[i];
    sum += v * v;
  }
  const norm = Math.sqrt(sum);
  if (norm > 0) {
    const inv = 1.0 / norm;
    for (let i = 0; i < vec.length; i++) {
      vec[i] *= inv;
    }
  }
  return vec;
}
function getKeys(numSamples, start) {
    return [...Array(numSamples).keys()].map((i) => start + chunkLength * i);
}

const loadTopK = require("../utils/topKWASM.js");
const { topK } = await loadTopK();

