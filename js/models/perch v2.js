let ort = require ("onnxruntime-node");

const fs = require("node:fs");
const path = require("node:path");

let session = null;
let currentGeneration = 0;
let cancelled = false;
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
  const providers = gpu ? ['webgpu', 'cpu'] : ['cpu'];
  const freeDimensionOverrides = { 'batch': batchSize };
  const   preferredOutputLocation = {
    'label': 'cpu',         // keep label & embedding on CPU. This is the only output we use.
    'embedding': 'cpu',   
    'spatial_embedding': 'gpu-buffer',   // keep other outputs on GPU buffer to save copying effort
    'spectrogram': 'gpu-buffer'
  }
  const threadOptions = gpu ? { intraOpNumThreads:1, interOpNumThreads: 1 } : {};
 const executionProviderConfig = gpu ? { webgpu: {  validationMode: 'disabled' } } : {};
  const sessionOptions = { 
    executionProviders: providers,
    enableGraphCapture: true, 
    ...threadOptions,
    executionProviderConfig,
    executionMode: 'sequential',
    enableCpuMemArena: true,
    freeDimensionOverrides,
    preferredOutputLocation,
  };
  const modelPath = path.join(mpath, 'perch_v2.onnx')
  session = await ort.InferenceSession.create(modelPath, sessionOptions);
  cancelled = false;
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
        cancelled = true;
        currentGeneration++;
        batchSize = data.batchSize || batchSize;
        backend = data.backend || backend;
        if (session) {
          try { await session.release() } catch (e) { console.error(e) }
          session = null;
        }
    
        await loadModel(modelPath, backend, batchSize);
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
            id
          } = data;
          const selection = !resetResults;
          if (cancelled) return;
          const myGeneration = currentGeneration;
          const result = await predictChunk(
            chunks,
            start
          );
          if (cancelled || myGeneration !== currentGeneration) {
            return; // Ignore stale results
          }
          response = {
            message: "prediction",
            id,
            file,
            result,
            fileStart,
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


const createAudioTensorBatch = (audioArray) => {
    const batch = audioArray.length;
    const data = new Float32Array(batch * chunkLength);
    for (let i = 0; i < batch; i++) {
      const audio = audioArray[i];
      if (audio.length >= chunkLength) {
        data.set(audio.subarray(0, chunkLength), i * chunkLength);
      } else {
        data.set(audio, i * chunkLength);
        // remaining samples already zero (silence)
      }
    }
    return new ort.Tensor('float32', data, [batch, chunkLength]);
};

async function predictChunk(audioBuffer, startSamples) {
    const audioBatch = createAudioTensorBatch(audioBuffer);
    const result = await predictBatch( audioBatch, startSamples );
    return result;
}


async function disposeGPUTensors(prediction) {
  const {spectrogram, spatial_embedding} = prediction;
  spectrogram.dispose();
  spatial_embedding.dispose();
}

/**
 * Predict batch post-process: returns [keys, batchedIndices, batchedProbs]
 * - flat: Float32Array of length batchSize * numClasses (logits)
 * - batchSize, numClasses, sampleRate available in outer scope / params
 */
async function predictBatch(audio, keys) {
    const length = keys.length;
    const batchedEmbeds  = Array.from({ length });
    const batchedIndices  = Array.from({ length });
    const batchedProbs  = Array.from({ length });
    const prediction = await session.run({ inputs: audio })
    const flatID = prediction.label.cpuData; // Float32Array
    const flatEmbeds = prediction.embedding.cpuData;
    const dim = prediction.embedding.dims[1]
    for (let b = 0; b < length; b++) {
      const offset = b * numClasses;
      const bOffset = b * dim;
      const logits = flatID.subarray(offset, offset + numClasses);
      const embedding = flatEmbeds.subarray(bOffset, bOffset + dim);
      const t0 = Date.now();
      const {probs, idx} = topK(logits);
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

const loadTopK = require("../utils/topKWASM.js");
const { topK } = await loadTopK();

