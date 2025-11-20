const ort = require ("onnxruntime-node");

const fs = require("node:fs");
const path = require("node:path");
// Load the model and create InferenceSession
const modelPath = "BirdNET_GLOBAL_6K_V2.4_Model_TFJS/birdnet.onnx";
let session;
let labels;
const chunkLength = 144000; // 3 seconds at 48kHz
let batchSize = 1;
const sampleRate = 48000;
const numClasses = 6522;
const backend = 'tensorflow';
const DEBUG = false;
onmessage = async (e) => {
  const modelRequest = e.data.message;
  const worker = e.data.worker;
  let response;
  try {
    switch (modelRequest) {
      case "load": {
        const version = e.data.model;
        const isBirdNET = version === 'birdnet';
        DEBUG && console.log("load request to worker");
        let appPath = e.data.modelPath;
        if (isBirdNET){
          const {location} = JSON.parse(
            fs.readFileSync(
              path.join(__dirname, `../../${version}_model_config.json`),
              "utf8"
            )
          );
          appPath = "../../" + location + "/";
        }
        const sessionOptions = { executionProviders: ['webgpu'] };
        session = await ort.InferenceSession.create(modelPath, sessionOptions);
        batchSize = e.data.batchSize;
        DEBUG && console.log(`Using backend: ${backend}`);

        const labelFile = isBirdNET 
          ? path.resolve(__dirname, '../../labels/V2.4/BirdNET_GLOBAL_6K_V2.4_Labels_en.txt')
          : path.join(appPath, 'labels.txt');
        const fileContents = fs.readFileSync(labelFile, 'utf-8');
        labels = fileContents.trim().split(/\r?\n/);
        DEBUG &&
          console.log(
            `Model received load instruction. Using batch size ${batchSize}`
          );

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
    file,
    threshold,
    confidence
  ) {
    const [audioBatch, numSamples] = createAudioTensorBatch(audioBuffer);
    const batchKeys = getKeys(numSamples, start);
    const result = await predictBatch(
      audioBatch,
      batchKeys,
      threshold,
      confidence
    );
    return [result, file, fileStart];
}

  const getKeys = (numSamples, start) =>
    [...Array(numSamples).keys()].map((i) => start + chunkLength * i);

  async function predictBatch(audio, keys) {    
    const prediction = await session.run({ input: audio });
    const batchedPredictions = reshapeBatches(sigmoid(prediction.output.cpuData), batchSize, numClasses);
    const batchedIndices = [];
    const batchedValues = [];
    for (let i = 0; i < batchedPredictions.length; i++) {
      const {indices, values} = topK(batchedPredictions[i], 5);
      batchedIndices.push(indices);
      batchedValues.push(values);
    }
    const scaleFactor = 1;
    keys = keys.map((key) => (key / (sampleRate * scaleFactor)).toFixed(3));
    return [keys, batchedIndices, batchedValues];
  }

function reshapeBatches(flat, batchSize, numClasses) {
  const batches = new Array(batchSize);
  for (let b = 0; b < batchSize; b++) {
    const start = b * numClasses;
    batches[b] = Array.from(flat.subarray(start, start + numClasses));
  }
  return batches;
}

function sigmoid(arr) {
  for (let i = 0; i < arr.length; i++) {
    arr[i] = 1 / (1 + Math.exp(-arr[i]));
  }
  return arr;
}

function topK(result, k) {
  const indexed = Array.from(result, (v, i) => ({ index: i, value: v }));
  indexed.sort((a, b) => b.value - a.value);
  const sliced =  indexed.slice(0, k);
    // Split into two arrays
  const indices = sliced.map(x => x.index);
  const values    = sliced.map(x => x.value);
  return { indices, values };
}
