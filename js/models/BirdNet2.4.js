let tf, BACKEND, ABORTED;
try {
  tf = require("@tensorflow/tfjs-node");
} catch {
  tf = require("@tensorflow/tfjs");
  BACKEND = "webgpu";
}
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
let DEBUG = false;

import { BaseModel } from "./BaseModel.js";
const {stft} = require("./custom-ops.js");

//GLOBALS
let myModel

onmessage = async (e) => {
  const modelRequest = e.data.message;
  const worker = e.data.worker;
  let response;
  try {
    switch (modelRequest) {
      case "change-batch-size": {
        myModel.warmUp(e.data.batchSize);
        break;
      }
      case "load": {
        const version = e.data.model;
        DEBUG && console.log("load request to worker");
        const { height, width, location } = JSON.parse(
          fs.readFileSync(
            path.join(__dirname, `../../${version}_model_config.json`),
            "utf8"
          )
        );
        // const appPath = "../../" + location + "/";
        const appPath = "/Users/matthew/Documents/transfer-model/";
        const batch = e.data.batchSize;
        const backend = BACKEND || e.data.backend;
        BACKEND = backend;
        DEBUG && console.log(`Using backend: ${backend}`);
        backend === "webgpu" && require("@tensorflow/tfjs-backend-webgpu");
        let labels;
        const labelFile = `../../labels/V2.4/BirdNET_GLOBAL_6K_V2.4_Labels_en.txt`;
        await fetch(labelFile)
          .then((response) => {
            if (!response.ok) throw new Error("Network response was not ok");
            return response.text();
          })
          .then((filecontents) => {
            labels = filecontents.trim().split(/\r?\n/);
          })
          .catch((error) => {
            console.error(
              "There was a problem fetching the label file:",
              error
            );
          });
        DEBUG &&
          console.log(
            `Model received load instruction. Using batch size ${batch}`
          );

        tf.setBackend(backend).then(async () => {
          if (backend === "webgl") {
            tf.env().set("WEBGL_FORCE_F16_TEXTURES", true);
            tf.env().set("WEBGL_EXP_CONV", true);
          }
          tf.enableProdMode();
          if (DEBUG) {
            console.log(tf.env());
            console.log(tf.env().getFlags());
          }
          myModel = new BirdNETModel(appPath, version);
          myModel.height = height;
          myModel.width = width;
          myModel.labels = labels;
          await myModel.loadModel("layers");
          await myModel.warmUp(batch);
          BACKEND = tf.getBackend();
          postMessage({
            message: "model-ready",
            sampleRate: myModel.config.sampleRate,
            chunkLength: myModel.chunkLength,
            backend: BACKEND,
            labels,
            worker,
          });
        });
        break;
      }
      case "train-model":{
        const {lr, dropout, epochs, hidden, dataset, cache, 
          modelLocation, modelType, useCache} = e.data;
          trainModel({
            model: myModel.model,
            lr, dropout, epochs, hidden, dataset, cache, 
            modelLocation, modelType, useCache
          }).then((result) => {
            postMessage({
              message: "training-results", 
              notice: "Training completed successfully! Model saved in:<br>" + modelLocation,
              complete: true
            });
          }).catch((err) => {
            postMessage({
              message: "training-results", 
              notice: `Error during model training: ${err}`,
              type: 'error',
              complete: true
            });
            console.error("Error during model training:", err);
          })
        break;
      }
      case "get-spectrogram": {
        const buffer = e.data.buffer;
        if (buffer.length < myModel.chunkLength) {
          return;
        }
        const specFile = e.data.file;
        const filepath = e.data.filepath;
        const image = tf.tidy(() => {
          // Get the spec layer by name
          const concat = myModel.model.getLayer("concatenate");
          // Create a new model that outputs the MEL_SPEC1 layer
          const intermediateModel = tf.model({
              inputs: myModel.model.inputs,
              outputs: concat.output,
            });
          const signal = tf.tensor1d(buffer, "float32").reshape([1, 144000]);
            // Get the output of the MEL_SPEC1 layer
          
        let spec = myModel.normalise(intermediateModel.predict(signal));
        // Add a zero channel to the spectrogram so the resulting png has 3 channels and is in colour 
        const [b, h, w, _] = spec.shape;
        const zeroChannel = tf.zeros([b, h, w, 1], spec.dtype);
          return tf.concat([spec, zeroChannel], -1);
        });
        const [batch, height, width, channels] = image.shape;
        response = {
          message: "spectrogram",
          width: width,
          height: height,
          channels,
          image: await image.data(),
          file: specFile,
          filepath,
          worker,
        };
        postMessage(response);
        break;
    }
      case "predict": {
        if (myModel?.model_loaded) {
          const {
            chunks,
            start,
            fileStart,
            file,
            snr,
            confidence,
            worker,
            context,
            resetResults,
          } = e.data;
          myModel.useContext = context;
          myModel.selection = !resetResults;
          const [result, filename, startPosition] = await myModel.predictChunk(
            chunks,
            start,
            fileStart,
            file,
            snr,
            confidence / 1000
          );
          response = {
            message: "prediction",
            file: filename,
            result: result,
            fileStart: startPosition,
            worker: worker,
            selection: myModel.selection,
          };
          postMessage(response);
          myModel.result = [];
        }
        break;
      }
      case "terminate": {
        ABORTED = true;
        tf.backend().dispose();
        self.close(); // Terminate the worker
      }
    }
  } catch (error) {
    // If worker was respawned
    console.log(error);
  }
};

class BirdNETModel extends BaseModel {
  constructor(appPath, version) {
    super(appPath, version);
    this.config = { sampleRate: 48_000, specLength: 3, sigmoid: 1 };
    this.chunkLength = this.config.sampleRate * this.config.specLength;
  }

  async predictChunk(
    audioBuffer,
    start,
    fileStart,
    file,
    threshold,
    confidence
  ) {
    DEBUG && console.log("predictCunk begin", tf.memory());
    const [audioBatch, numSamples] = this.createAudioTensorBatch(audioBuffer);
    const test = audioBatch.arraySync();
    const batchKeys = this.getKeys(numSamples, start);
    const result = await this.predictBatch(
      audioBatch,
      batchKeys,
      threshold,
      confidence
    );
    DEBUG && console.log("predictCunk end", tf.memory());
    return [result, file, fileStart];
  }
}

/// Birdnet definitions

// Define custom layer for computing mel spectrograms
class MelSpecLayerSimple extends tf.layers.Layer {
  constructor(config) {
    super(config);

    // Initialize parameters
    this.sampleRate = config.sampleRate;
    this.specShape = config.specShape;
    this.frameStep = config.frameStep;
    this.frameLength = config.frameLength;
    this.fmin = config.fmin;
    this.fmax = config.fmax;
    this.melFilterbank = tf.tensor2d(config.melFilterbank);
    this.two = tf.scalar(2);
    this.one = tf.scalar(1);
  }

  build(inputShape) {
    // Initialize trainable weights, for example:
    this.magScale = this.addWeight(
      "magnitude_scaling",
      [],
      "float32",
      tf.initializers.constant({ value: 1.23 })
    );

    super.build(inputShape);
  }

  // Compute the output shape of the layer
  computeOutputShape(inputShape) {
    return [inputShape[0], this.specShape[0], this.specShape[1], 1];
  }

normalise_audio_batch = (tensor) => {
  return tf.tidy(() => {
    const sigMax = tf.max(tensor, -1, true);
    const sigMin = tf.min(tensor, -1, true);
    const range = sigMax.sub(sigMin);
    return tensor
      .sub(sigMin)
      .divNoNan(range)
      .mul(this.two)
      .sub(this.one);
  });
};

  // Define the layer's forward pass
  call(inputs) {
    return tf.tidy(() => {
      // inputs is a tensor representing the input data
      inputs = inputs[0];
      let result;
      if (BACKEND === 'tensorflow') {
        result = tf.stack(
          inputs.split(inputs.shape[0]).map((input) => {
            input = input.squeeze();
            
            // Normalize values between -1 and 1
            input = this.normalise_audio_batch(input);
            // Perform STFT and cast result to float
            return tf.signal.stft(
              input,
              this.frameLength,
              this.frameStep,
              this.frameLength,
              tf.signal.hannWindow
            ).cast("float32");
          })
        )
      } else {
        // Normalise batch
        inputs = this.normalise_audio_batch(inputs);
        //Custom optimized and batch-capable stft
        result = stft(
          inputs,
          this.frameLength,
          this.frameStep,
          this.frameLength,
          tf.signal.hannWindow
        )
      }
      return result
        .matMul(this.melFilterbank)
        .pow(this.two)
        .pow(tf.div(this.one, tf.add(this.one, tf.exp(this.magScale.read()))))
        .reverse(-1)
        .transpose([0, 2, 1])
        .expandDims(-1);
    });
  }

  // Optionally, include the `className` method to provide a machine-readable name for the layer
  static get className() {
    return "MelSpecLayerSimple";
  }
}

// Register the custom layer with TensorFlow.js
tf.serialization.registerClass(MelSpecLayerSimple);

/////////////////////////  Build GlobalExpPool2D Layer  /////////////////////////
// function logmeanexp(x, axis, keepdims, sharpness) {
//     const xmax = tf.max(x, axis, true);
//     const xmax2 = tf.max(x, axis, keepdims);
//     x = tf.mul(sharpness, tf.sub(x, xmax));
//     let y = tf.log(tf.mean(tf.exp(x), axis, keepdims));
//     y = tf.add(tf.div(y, sharpness), xmax2);
//     return y
// }
// function logmeanexp(x, axis, keepdims, sharpness) {
//   return tf.add(
//     tf.div(
//       tf.log(
//         tf.mean(
//           tf.exp(x.mul(sharpness, x.sub(tf.max(x, axis, true)))),
//           axis,
//           keepdims
//         )
//       ),
//       sharpness
//     ),
//     tf.max(x, axis, keepdims)
//   );
// }
// class GlobalLogExpPooling2D extends tf.layers.Layer {
//   constructor(config) {
//     super(config);
//   }

//   build(inputShape) {
//     this.sharpness = this.addWeight(
//       "sharpness",
//       [1],
//       "float32",
//       tf.initializers.constant({ value: 2 })
//     );
//   }

//   computeOutputShape(inputShape) {
//     return [inputShape[0], inputShape[3]];
//   }

//   call(input, kwargs) {
//     return logmeanexp(input[0], [1, 2], false, this.sharpness.read()); //.read().dataSync()[0]);
//   }

//   static get className() {
//     return "GlobalLogExpPooling2D";
//   }
// }

// tf.serialization.registerClass(GlobalLogExpPooling2D);

/////////////////////////  Build Sigmoid Layer  /////////////////////////
// class SigmoidLayer extends tf.layers.Layer {
//   constructor(config) {
//     super(config);
//     this.config = config;
//   }

//   build(inputShape) {
//     this.kernel = this.addWeight(
//       "scale_factor",
//       [1],
//       "float32",
//       tf.initializers.constant({ value: 1 })
//     );
//   }

//   computeOutputShape(inputShape) {
//     return inputShape;
//   }

//   call(input, kwargs) {
//     // Since sigmoid is always 1, we simplify here
//     return tf.sigmoid(tf.mul(input[0], CONFIG.sigmoid))
//     // return tf.sigmoid(input[0]);
//   }

//   static get className() {
//     return "SigmoidLayer";
//   }
// }

// tf.serialization.registerClass(SigmoidLayer);

let transferModel;

function cosineDecay(initialLearningRate, globalStep, decaySteps) {
  const step = Math.min(globalStep, decaySteps);
  const cosineDecay = 0.5 * (1 + Math.cos(Math.PI * step / decaySteps));
  return initialLearningRate * cosineDecay;
}

async function trainModel({
  model:baseModel, 
  lr:initialLearningRate, 
  dropout, epochs, hidden,
  dataset, cache:cacheFolder, modelLocation:saveLocation, modelType, useCache}) {
  const allFiles = getFilesWithLabels(dataset);
  if (!allFiles.length){
    throw new Error(`No files found in any label folders in ${dataset}` )
  }
  const labels = [...new Set(allFiles.map(f => f.label))];
  const labelToIndex = Object.fromEntries(labels.map((l, i) => [l, i]));
  const t0 = Date.now();
  const cacheRecords = useCache;
  const loss = tf.losses.softmaxCrossEntropy;
  const metrics = [ tf.metrics.categoricalAccuracy ];
  const optimizer = tf.train.adam(initialLearningRate);

  // Freeze base layers (optional)
  for (const layer of baseModel.layers) {
    layer.trainable = false;
  }

  // Get base model input and outputs
  const input = baseModel.inputs[0];
  const originalOutput = baseModel.outputs[0];

  // Get embeddings from BirdNET
  const embeddingLayer = baseModel.getLayer('GLOBAL_AVG_POOL');
  const embeddings = embeddingLayer.output;  // This will be input to the new classifier
  let x = embeddings;

  if (hidden) {
    if (dropout) {
      x = tf.layers.dropout({ rate: dropout, name: 'CUSTOM_DROP_1' }).apply(x);
    }
    x = tf.layers.dense({ units: hidden, activation: 'relu', name: 'CUSTOM_HIDDEN' }).apply(x);
    if (dropout) {
      x = tf.layers.dropout({ rate: dropout, name: 'CUSTOM_DROP_2' }).apply(x);
    }
  }

  const newClassifier = tf.layers.dense({ units: labels.length, activation: 'sigmoid', name: 'new_classes' }).apply(x);

  // Build a new model
  transferModel = tf.model({
    inputs: input,
    outputs: newClassifier,
  });

  // Compile the model
  transferModel.compile({
    optimizer,
    loss,
    metrics,
  });


  const trainBin = path.join(cacheFolder, "train_ds.bin");
  const valBin = path.join(cacheFolder, "val_ds.bin");

  if (! cacheRecords || ! fs.existsSync(trainBin)){
    const { trainFiles, valFiles } = stratifiedSplit(allFiles, 0.2);
    await writeBinaryGzipDataset(trainFiles, trainBin, labelToIndex, postMessage, "Preparing training data");
    await writeBinaryGzipDataset(valFiles, valBin, labelToIndex, postMessage, "Preparing validation data");
  }
  const train_ds = tf.data.generator(() => readBinaryGzipDataset(trainBin, labels)).batch(8);
  const val_ds = tf.data.generator(() => readBinaryGzipDataset(valBin, labels)).batch(8);
  const earlyStopping = tf.callbacks.earlyStopping({monitor: 'val_loss', minDelta: 0.0001, patience: 3})
  const events = new tf.CustomCallback({
    onYield: (epoch, batch, _logs) =>{
      batch += 1;
      const batchesInEpoch = Math.floor(allFiles.length / 32);
      const progress = (batch / batchesInEpoch) * 100
      postMessage({
            message: "training-progress", 
            progress: {percent: Math.min(progress, 99)},
            text: `Epoch ${epoch + 1} / ${epochs}: `
      });
    },
    onEpochEnd: (epoch, logs) => {
      // transferModel.optimizer.learningRate = cosineDecay(initialLearningRate, epoch+1, epochs)
      const {loss, val_loss, val_categoricalAccuracy, precision, recall, val_precision, val_recall, categoricalAccuracy} = logs;

      console.log(`Tensors in memory: ${tf.memory().numTensors}`);
      postMessage({
            message: "training-results", 
            notice: 
            `<table class="table table-striped">
            <tr><th colspan="2">Epoch ${epoch + 1}:</th></tr>
            <tr><td>Loss</td> <td>${loss.toFixed(4)}</td></tr>
            <tr><td>Accuracy</td><td>${(categoricalAccuracy*100).toFixed(2)}%</td></tr>
            <tr><td>Validation Loss</td><td>${val_loss.toFixed(4)}</td></tr>
            <tr><td>Validation Accuracy</td><td>${(val_categoricalAccuracy*100).toFixed(2)}%</td></tr>
            </table>`
          });
    },
    onTrainEnd: (logs) => {
      postMessage({
        message: "training-progress", 
        progress: {percent: 100},
        text: ''
      });
      const t1 = Date.now();
      console.log(`Training completed in ${((t1 - t0) / 1000).toFixed(2)} seconds`);
      return logs
    }
  })
  // Train on your new data
  // Assume `xTrain` and `yTrain` are your input and combined output labels
  const history = await transferModel.fitDataset(train_ds, {
    batchSize: 32,
    epochs,
    validationData: val_ds,
    callbacks: [earlyStopping, events]
  });
  let notice ='', type = '', autohide = true;
  if (history.epoch.length < epochs){
      notice += `Training halted at Epoch ${history.epoch.length} due to no further improvement: <br>`;
      type = 'warning',
      autohide = false
  }
  const {loss:l, val_loss, categoricalAccuracy:Acc, val_categoricalAccuracy} = history.history;
  notice +=
      `Loss = ${l[l.length -1].toFixed(4)}<br>
Accuracy = ${(Acc[Acc.length -1]* 100).toFixed(2)}%<br>
Validation Loss = ${val_loss[val_loss.length -1].toFixed(4)}<br>
Validation Accuracy = ${(val_categoricalAccuracy[val_categoricalAccuracy.length -1]*100).toFixed(2)}%`,
  postMessage({
      message: "training-results", 
      notice,
      type,
      autohide
      });
  // Save the new model

  let mergedModel, mergedLabels;
  if (modelType === 'append'){
    const combinedOutput = tf.layers.concatenate({ axis: -1 }).apply([originalOutput, newClassifier]);
    mergedModel = tf.model({
      inputs: baseModel.inputs,
      outputs: combinedOutput,
      name: 'merged_model'
    });
    mergedLabels = myModel.labels.concat(labels);
  }
  const finalModel = mergedModel || transferModel;
  const bnConfig = await fetch("../../BirdNET_GLOBAL_6K_V2.4_Model_TFJS/static/model/model.json")
          .then((response) => {
            if (!response.ok) throw new Error("Network response was not ok");
            return response.json();
          })       
  const melSpec1Config = bnConfig.modelTopology.model_config.config.layers[1].config;
  const melSpec2Config = bnConfig.modelTopology.model_config.config.layers[2].config;
  await finalModel.save('file://' + saveLocation);
  const custConfig = await fetch(`${saveLocation}/model.json`)
          .then((response) => {
            if (!response.ok) throw new Error("Network response was not ok");
            return response.json();
          })
  custConfig.modelTopology.config.layers[1].config = melSpec1Config;
  custConfig.modelTopology.config.layers[2].config = melSpec2Config;
  fs.writeFileSync(`${saveLocation}/model.json`, JSON.stringify(custConfig), 'utf8')
  // Save labels
  const labelData = (mergedLabels || labels).join('\n');
  // Write to a file
  fs.writeFileSync(saveLocation + 'labels.txt', labelData, 'utf8');
  notice += `
Settings:
Learning rate: ${initialLearningRate}
Epochs:${epochs}
Hidden units:${hidden}
Dropout: ${dropout}
`
  fs.writeFileSync(saveLocation + 'training_metrics.txt', notice.replaceAll('<br>', ''), 'utf8');

  console.log(`Tensors in memory before: ${tf.memory().numTensors}`);
  baseModel.dispose()
  finalModel.layers.forEach(layer => {
    try{ 
      layer.dispose();
    } catch {
      // Skip previously disposed layers
    }
  })
  optimizer.dispose();
  console.log(`Tensors in memory after: ${tf.memory().numTensors}`);
  myModel.model_loaded = false;
  await myModel.loadModel("layers");
  console.log(`Tensors in memory new model: ${JSON.stringify(tf.memory())}`);
  console.log('new model made')
}


// Get all files recursively and associate with label
function getFilesWithLabels(rootDir) {
  const files = [];
  const folders = fs.readdirSync(rootDir);
  for (const folder of folders) {
    if (folder.startsWith('.')) continue
    const folderPath = path.join(rootDir, folder);
    const stats = fs.statSync(folderPath);
    if (stats.isDirectory()) {
      const audioFiles = fs.readdirSync(folderPath);
      for (const file of audioFiles) {
        if (file.startsWith('.')) continue
        files.push({
          filePath: path.join(folderPath, file),
          label: folder
        });
      }
    }
  }
  return files;
}


/**
 * Writes a compressed binary dataset where each record is:
 *   - audio: Float32Array of 144000 samples (576000 bytes)
 *   - label: UInt8 (1 byte)
 * Total per record: 576001 bytes
 */
async function writeBinaryGzipDataset(fileList, outputPath, labelToIndex, postMessage, description = "Preparing data") {
  const gzip = zlib.createGzip();
  const writeStream = fs.createWriteStream(outputPath);
  gzip.pipe(writeStream);
  let count = 0;

  for (const { filePath, label } of fileList) {
    count++;
    postMessage({
      message: "training-progress", 
      progress: { percent: (count / fileList.length) * 100 },
      text: `${description}: `
    });
    let errored = false;
    let audioArray = await decodeAudio(filePath).catch(err => {
      postMessage({
        message: "training-results", 
        notice: `Error loading file:<br>${filePath}<br> ${err}`,
        type: 'error'
      });
      errored = true
    });
    if (errored) continue; // Be robust to errors, respect abort
    else if (ABORTED) {
      console.log("Abort received")
      break;
    }
    const expectedSamples = 48000 * 3;
    if (audioArray.length !== expectedSamples) {
      const padded = new Float32Array(expectedSamples);
      padded.set(audioArray.slice(0, expectedSamples));
      audioArray = padded;
    }

    const audioBuffer = Buffer.from(audioArray.buffer);
    gzip.write(audioBuffer);

    const labelIndex = labelToIndex[label];
    gzip.write(Buffer.from([labelIndex]));
  }

  gzip.end();
}


function stratifiedSplit(allFiles, valRatio = 0.2) {
  const byLabel = {};
  for (const item of allFiles) {
    const { label } = item;
    if (!byLabel[label]) byLabel[label] = [];
    byLabel[label].push(item);
  }

  const trainFiles = [];
  const valFiles = [];

  for (const label in byLabel) {
    const items = byLabel[label];
    tf.util.shuffle(items);
    const splitIndex = Math.max(1, Math.floor(items.length * valRatio)); // at least 1 item
    valFiles.push(...items.slice(0, splitIndex));
    trainFiles.push(...items.slice(splitIndex));
  }

  tf.util.shuffle(trainFiles);
  tf.util.shuffle(valFiles);
  return { trainFiles, valFiles };
}

async function* readBinaryGzipDataset(gzippedPath, labels) {
  const RECORD_SIZE = 576001; // 144000 * 4 + 1
  const gunzip = zlib.createGunzip();
  const stream = fs.createReadStream(gzippedPath).pipe(gunzip);

  let leftover = Buffer.alloc(0);

  for await (const chunk of stream) {
    const data = Buffer.concat([leftover, chunk]);
    const total = Math.floor(data.length / RECORD_SIZE) * RECORD_SIZE;
    let offset = 0;

    while (offset + RECORD_SIZE <= total) {
      const record = data.subarray(offset, offset + RECORD_SIZE);
      const audioBuf = record.subarray(0, 144000 * 4);
      const labelByte = record.readUInt8(RECORD_SIZE - 1);

      const audio = new Float32Array(audioBuf.buffer, audioBuf.byteOffset, 144000);

      yield {
        xs: tf.tensor1d(audio),
        ys: tf.oneHot(labelByte, labels.length)
      };

      offset += RECORD_SIZE;
    }

    leftover = data.subarray(offset); // save leftover for next chunk
  }
}




/**
 * Convert any audio file to WAV PCM and decode into a Tensor
 * @param {string} filePath - Path to the audio file (any format supported by ffmpeg)
 * @returns {Promise<tf.Tensor2D>} Tensor of shape [numSamples, numChannels]
 */
async function decodeAudio(filePath) {
  const ffmpeg = require('fluent-ffmpeg');
  return new Promise((resolve, reject) => {
    // Convert audio to WAV PCM 16-bit signed, mono, 16kHz
    const chunks = [];

    ffmpeg(filePath)
      .format('wav')
      .audioCodec('pcm_s16le')
      .audioChannels(1)
      .audioFrequency(48000)
      .seekInput(1)
      .duration(3.0) // Limit to 3 seconds
      .on('error', reject)
      .on('end', () => {
        const wavBuffer = Buffer.concat(chunks);
        try {
          // Interpret as Int16 values
          const int16Array = new Int16Array(wavBuffer.buffer, wavBuffer.byteOffset, wavBuffer.length / 2);
          // Convert to Float32 range [-1, 1]
          const float32Array = new Float32Array(int16Array.length);
          for (let i = 0; i < int16Array.length; i++) {
            float32Array[i] = int16Array[i] / 32768; // or 32767, depending on convention
          }
          resolve(float32Array);
        } catch (err) {
          reject(err);
        }
      })
      .pipe()
      .on('data', chunk => chunks.push(chunk));
  });
}