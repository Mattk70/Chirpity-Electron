const ort = require ("onnxruntime-node");
const fs = require("node:fs");

let session = null;
let currentGeneration = 0;
let cancelled = false;
let labels;
let backend;
let chunkLength = 96000; // 3 seconds at 32kHz
let batchSize = 8;
const sampleRate = 32000;
const numClasses = 11560;
const DEBUG = false;
let modelPath;
 
async function loadModel(_mpath, backend, batchSize) {
  const gpu = backend === 'webgpu';
  const providers = gpu ? ['webgpu', 'cpu'] : ['cpu'];
  const freeDimensionOverrides = { 'batch': batchSize };
  const   preferredOutputLocation = {
    'predictions': 'cpu'
  }
  const threadOptions = { intraOpNumThreads:2, interOpNumThreads: 1 };
 const executionProviderConfig = gpu ? { webgpu: { validationMode: 'basic' } } : {};
  const sessionOptions = { 
    executionProviders: providers,
    logSeverityLevel: DEBUG ? 0 : 4,
    enableGraphCapture: true, 
    ...threadOptions,
    executionProviderConfig,
    executionMode: 'sequential',
    enableCpuMemArena: true,
    freeDimensionOverrides,
    preferredOutputLocation,
  };
  const modelPath = './BirdNET3/birdnet_gem_webgpu_fast.onnx';
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
      case "change-window-size": {
        chunkLength = data.windowSize * sampleRate;
        break;
      }
      case "load": {
        if (!session) {
          backend = data.backend;
          batchSize = data.batchSize;
          chunkLength = data.windowSize * sampleRate;
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
function topKProbs(probs) {
  // Initialise with first five values
  let p0 = probs[0], i0 = 0;
  let p1 = probs[1], i1 = 1;
  let p2 = probs[2], i2 = 2;
  let p3 = probs[3], i3 = 3;
  let p4 = probs[4], i4 = 4;

  // Find current minimum
  let minPos = 0;
  let minVal = p0;

  if (p1 < minVal) { minVal = p1; minPos = 1; }
  if (p2 < minVal) { minVal = p2; minPos = 2; }
  if (p3 < minVal) { minVal = p3; minPos = 3; }
  if (p4 < minVal) { minVal = p4; minPos = 4; }

  for (let i = 5; i < probs.length; i++) {
    const p = probs[i];

    if (p <= minVal)
      continue;

    // Replace current minimum
    switch (minPos) {
      case 0: p0 = p; i0 = i; break;
      case 1: p1 = p; i1 = i; break;
      case 2: p2 = p; i2 = i; break;
      case 3: p3 = p; i3 = i; break;
      case 4: p4 = p; i4 = i; break;
    }

    // Recompute minimum
    minPos = 0;
    minVal = p0;

    if (p1 < minVal) { minVal = p1; minPos = 1; }
    if (p2 < minVal) { minVal = p2; minPos = 2; }
    if (p3 < minVal) { minVal = p3; minPos = 3; }
    if (p4 < minVal) { minVal = p4; minPos = 4; }
  }

  // Sort descending (only five values)
  function swap(a, b) {
    switch ((a << 3) | b) {
      case 0b000001: if (p0 < p1) { [p0,p1]=[p1,p0]; [i0,i1]=[i1,i0]; } break;
      case 0b000010: if (p0 < p2) { [p0,p2]=[p2,p0]; [i0,i2]=[i2,i0]; } break;
      case 0b000011: if (p0 < p3) { [p0,p3]=[p3,p0]; [i0,i3]=[i3,i0]; } break;
      case 0b000100: if (p0 < p4) { [p0,p4]=[p4,p0]; [i0,i4]=[i4,i0]; } break;
      case 0b001010: if (p1 < p2) { [p1,p2]=[p2,p1]; [i1,i2]=[i2,i1]; } break;
      case 0b001011: if (p1 < p3) { [p1,p3]=[p3,p1]; [i1,i3]=[i3,i1]; } break;
      case 0b001100: if (p1 < p4) { [p1,p4]=[p4,p1]; [i1,i4]=[i4,i1]; } break;
      case 0b010011: if (p2 < p3) { [p2,p3]=[p3,p2]; [i2,i3]=[i3,i2]; } break;
      case 0b010100: if (p2 < p4) { [p2,p4]=[p4,p2]; [i2,i4]=[i4,i2]; } break;
      case 0b011100: if (p3 < p4) { [p3,p4]=[p4,p3]; [i3,i4]=[i4,i3]; } break;
    }
  }

  // Bubble-sort network for 5 elements
  swap(0,1); swap(0,2); swap(0,3); swap(0,4);
  swap(1,2); swap(1,3); swap(1,4);
  swap(2,3); swap(2,4);
  swap(3,4);

  return {
    probs: [p0, p1, p2, p3, p4],
    idx:   [i0, i1, i2, i3, i4]
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

