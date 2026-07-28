let ort = require ("onnxruntime-node");

const fs = require("node:fs");
const path = require("node:path");

let session = null;
let currentGeneration = 0;
let cancelled = false;
let labels;
let backend;
const chunkLength = 96000; // 3 seconds at 32kHz
let batchSize = 8;
const sampleRate = 32000;
const numClasses = 11560;
const DEBUG = false;
let modelPath;
 
async function loadModel(mpath, backend, batchSize) {
  const gpu = backend === 'webgpu';
  const providers = gpu ? ['webgpu', 'cpu'] : ['wasm', 'cpu'];
  const freeDimensionOverrides = { 'batch': batchSize };
  const   preferredOutputLocation = {
    'predictions': 'cpu'
  }
  const threadOptions = gpu ? { intraOpNumThreads:1, interOpNumThreads: 1 } : {};
 const executionProviderConfig = gpu ? { webgpu: { validationMode: 'full' } } : {};
  const sessionOptions = { 
    executionProviders: providers,
    enableGraphCapture: 1, 
    graphOptimizationLevel: 'all',
    ...threadOptions,
    executionProviderConfig,
    executionMode: 'sequential',
    enableCpuMemArena: true,
    freeDimensionOverrides,
    preferredOutputLocation,
  };
  const modelPath = './BirdNET3/BirdNET_GeM_WebGPU.onnx';
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

          const labelFile = './BirdNET3/BirdNET+_V3.0-preview3.1_Global_11K_Labels.csv';
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
            id,
            batchIndex
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
            batchIndex
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
  // const {spectrogram, spatial_embedding} = prediction;
  // spectrogram.dispose();
  // spatial_embedding.dispose();
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
    const prediction = await session.run({ input: audio })
    const flatID = prediction.predictions.cpuData; // Float32Array
    const flatEmbeds = prediction.embeddings_out.cpuData;
    const dim = prediction.embeddings_out.dims[1]
    for (let b = 0; b < length; b++) {
      const offset = b * numClasses;
      const bOffset = b * dim;
      const scores = flatID.subarray(offset, offset + numClasses);
      const embedding = flatEmbeds.subarray(bOffset, bOffset + dim);
      const t0 = Date.now();
      const {probs, idx} = topKProbs(scores);
      batchedIndices[b] = idx;
      batchedProbs[b] = probs;
      l2Normalize(embedding);
      const f16 = new Float16Array(embedding.length);
      f16.set(embedding);   // automatic float32 → float16 conversion
      batchedEmbeds[b] = f16;
    }
    // convert keys to time strings once (not in the inner loop)
    for (let i = 0; i < keys.length; i++) {
      keys[i] = Math.round((keys[i] / sampleRate) * 1000) / 1000;
    }
    return [keys, batchedIndices, batchedProbs, batchedEmbeds];
}

function topKProbs(probs, k = 5) {
  const top = [];

  for (let i = 0; i < probs.length; i++) {
    const p = probs[i];

    if (top.length < k) {
      top.push({ prob: p, idx: i });
      top.sort((a, b) => a.prob - b.prob); // smallest first
    } else if (p > top[0].prob) {
      top[0] = { prob: p, idx: i };
      top.sort((a, b) => a.prob - b.prob);
    }
  }

  top.sort((a, b) => b.prob - a.prob);

  return {
    probs: top.map(x => x.prob),
    idx: top.map(x => x.idx)
  };
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

