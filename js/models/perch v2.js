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

async function loadModel(mpath, backend) {
    const providers = backend === 'tensorflow' ? ['cpu'] : ['webgpu', 'cpu'];
    const sessionOptions = { executionProviders: providers, enableGraphCapture: true };
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
      case "load": {
        if (!session) {
          backend = e.data.backend;
          await loadModel(modelPath, backend);
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
const K = 5; // top-K
const topValuesBuf = new Float32Array(K);
const topIndicesBuf = new Int32Array(K);
const batchedIndices = Array.from({ length: batchSize });
const batchedProbs   = Array.from({ length: batchSize });

/**
 * Predict batch post-process: returns [keys, batchedIndices, batchedProbs]
 * - flat: Float32Array of length batchSize * numClasses (logits)
 * - batchSize, numClasses, sampleRate available in outer scope / params
 */
async function predictBatch(audio, keys) {
  const prediction = await session.run({ inputs: audio });
  const flat = prediction.label.cpuData; // assume Float32Array



  // reuse arrays per batch to avoid allocating inside hot loop
  for (let b = 0; b < batchSize; b++) {
    const offset = b * numClasses;
    // pass 1: find max and top-K indices on logits
    // initialise top-K buffers (lowest-first so values[K-1] is smallest)
    for (let i = 0; i < K; i++) {
      topValuesBuf[i] = -Infinity;
      topIndicesBuf[i] = -1;
    }

    let max = -Infinity;
    for (let i = 0; i < numClasses; i++) {
      const v = flat[offset + i];
      if (v > max) max = v;

      // insert into top-K if better than current smallest
      if (v > topValuesBuf[K - 1]) {
        topValuesBuf[K - 1] = v;
        topIndicesBuf[K - 1] = i;
        // bubble up
        for (let j = K - 1; j > 0 && topValuesBuf[j] > topValuesBuf[j - 1]; j--) {
          const tv = topValuesBuf[j];
          const ti = topIndicesBuf[j];
          topValuesBuf[j] = topValuesBuf[j - 1];
          topIndicesBuf[j] = topIndicesBuf[j - 1];
          topValuesBuf[j - 1] = tv;
          topIndicesBuf[j - 1] = ti;
        }
      }
    }

    // pass 2: compute sumExp and capture exponentials for top-K
    let sumExp = 0;
    // temp to store exp for top-k; index order matches topIndicesBuf
    const topExp = new Float32Array(K);

    for (let i = 0; i < numClasses; i++) {
      const e = Math.exp(flat[offset + i] - max);
      sumExp += e;

      // if 'i' is one of topIndicesBuf, store its exp
      // K is small -> linear scan across K is cheap
      for (let t = 0; t < K; t++) {
        if (topIndicesBuf[t] === i) {
          topExp[t] = e;
          break;
        }
      }
    }

    // compute final probabilities for top-K
    const probs = Array.from({ length: K });
    const indices = Array.from({ length: K });
    const invSum = 1 / sumExp;
    for (let t = 0; t < K; t++) {
      indices[t] = topIndicesBuf[t];
      probs[t] = topExp[t] * invSum;
    }
    batchedIndices[b] = indices;
    batchedProbs[b] = probs;
  }

  // convert keys to time strings once (not in the inner loop)
  const scale = sampleRate; // or sampleRate * scaleFactor
  for (let i = 0; i < keys.length; i++) {
    keys[i] = (keys[i] / scale).toFixed(3);
  }

  return [keys, batchedIndices, batchedProbs];
}


function getKeys(numSamples, start) {
    return [...Array(numSamples).keys()].map((i) => start + chunkLength * i);
}