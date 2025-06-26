
let transferModel, tf, DEBUG = false;

const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')
try {
  tf = require("@tensorflow/tfjs-node");
} catch {
  tf = require("@tensorflow/tfjs");
}
const abortController = require('../utils/abortController.js');

function cosineDecay(initialLearningRate, globalStep, decaySteps) {
  const step = Math.min(globalStep, decaySteps);
  const cosineDecay = 0.5 * (1 + Math.cos(Math.PI * step / decaySteps));
  return initialLearningRate * cosineDecay;
}

async function trainModel({
  Model, 
  lr:initialLearningRate,
  batchSize = 32,
  dropout, epochs, hidden,
  dataset, cache:cacheFolder, modelLocation:saveLocation, modelType, 
  useCache, validation, mixup, decay, roll:useRoll, useWeights, useFocal, labelSmoothing}) {
  const {files:allFiles, classWeights} = getFilesWithLabelsAndWeights(dataset);
  if (!allFiles.length){
    throw new Error(`No files found in any label folders in ${dataset}` )
  }
  const baseModel = Model.model;
  const labels = Object.keys(classWeights); //[...new Set(allFiles.map(f => f.label))];
  const labelToIndex = Object.fromEntries(labels.map((l, i) => [l, i]));
  const t0 = Date.now();
  const cacheRecords = useCache;
  const metrics = [ tf.metrics.categoricalAccuracy ];
  const optimizer = tf.train.adam(initialLearningRate);
  let bestLoss = Infinity;
  // Cache in the dataset folder if not selected
  cacheFolder = cacheFolder || dataset;

  // Get base model input and outputs
  const input = baseModel.inputs[0];
  const originalOutput = baseModel.outputs[0];
  // Freeze base layers
  for (const layer of baseModel.layers) {
    layer.trainable = false;
  }


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

  const classWeightsTensor = tf.tensor1d(
    Object.entries(classWeights)
      .sort(([a], [b]) => a.localeCompare(b)) // ensure consistent class order
      .map(([, weight]) => weight)
  );

  const lossWithWeights = (labels, preds) => {
    return tf.tidy(() => {
      let exampleWeights;
      if (useWeights && !useFocal){
        const labelIndices = labels.argMax(-1); // [batch_size]
        exampleWeights = useWeights ? classWeightsTensor.gather(labelIndices) : undefined; // [batch_size]
      }
       return useFocal
        ? categoricalFocalCrossentropy({yTrue:labels, yPred:preds})
        : tf.losses.softmaxCrossEntropy(labels, preds, exampleWeights, labelSmoothing);
    });
  };
  // Compile the model
  transferModel.compile({
    optimizer,
    loss: lossWithWeights,
    metrics,
  });


  const trainBin = path.join(cacheFolder, "train_ds.bin");
  const valBin = path.join(cacheFolder, "val_ds.bin");

  let trainFiles, valFiles;

  if (validation) {
    ({ trainFiles, valFiles } = stratifiedSplit(allFiles, validation));
  } else {
    trainFiles = allFiles;
  }

  if (!cacheRecords || !fs.existsSync(trainBin)) {
    await writeBinaryGzipDataset(trainFiles, trainBin, labelToIndex, postMessage, "Preparing training data");
  }

  if (validation && (!cacheRecords || !fs.existsSync(valBin))) {
    await writeBinaryGzipDataset(valFiles, valBin, labelToIndex, postMessage, "Preparing validation data");
  }
  let melSpec1Config, melSpec2Config, finalModel;
  const saveModelAsync = async () => {
      let mergedModel, mergedLabels;
      if (modelType === 'append'){
        const combinedOutput = tf.layers.concatenate({ axis: -1 }).apply([originalOutput, newClassifier]);
        mergedModel = tf.model({
          inputs: baseModel.inputs,
          outputs: combinedOutput,
          name: 'merged_model'
        });
        mergedLabels = Model.labels.concat(labels);
      }
      // Save labels
      const labelData = (mergedLabels || labels).join('\n');
      // Write to a file
      fs.writeFileSync(path.join(saveLocation, 'labels.txt'), labelData, 'utf8');
      finalModel =  mergedModel || transferModel;  
      await finalModel.save('file://' + saveLocation);
      // Read BirdNET config to extract mel_Spec configs to inject into custom model config
      if (!melSpec1Config){
        const modelPath = path.resolve(__dirname, '../../BirdNET_GLOBAL_6K_V2.4_Model_TFJS/static/model/model.json');
        const bnConfig = JSON.parse(fs.readFileSync(modelPath, 'utf-8'));
        melSpec1Config = bnConfig.modelTopology.model_config.config.layers[1].config;
        melSpec2Config = bnConfig.modelTopology.model_config.config.layers[2].config;
      }
      const customConfig = JSON.parse(fs.readFileSync(path.join(saveLocation, 'model.json')))
      customConfig.modelTopology.config.layers[1].config = melSpec1Config;
      customConfig.modelTopology.config.layers[2].config = melSpec2Config;
      fs.writeFileSync(path.join(saveLocation, 'model.json'), JSON.stringify(customConfig), 'utf8')
  }
  
  // Callbacks
  const earlyStopping = tf.callbacks.earlyStopping({monitor: 'val_loss', minDelta: 0.0001, patience: 3})
  const events = new tf.CustomCallback({
    onYield: (epoch, batch, _logs) =>{
      batch += 1;
      const batchesInEpoch = Math.floor(trainFiles.length / batchSize);
      const progress = (batch / batchesInEpoch) * 100
      postMessage({
            message: "training-progress", 
            progress: {percent: Math.min(progress, 99)},
            text: `Epoch ${epoch + 1} / ${epochs}: `
      });
    },
    onEpochEnd: (epoch, logs) => {
      decay && (transferModel.optimizer.learningRate = Math.max(1e-6, cosineDecay(initialLearningRate, epoch+1, epochs)) );
      const {loss, val_loss, val_categoricalAccuracy, categoricalAccuracy} = logs;
      // Save best weights
      if (val_loss < bestLoss){
        bestLoss = loss;
        saveModelAsync()
      }
      let notice = `<table class="table table-striped">
            <tr><th colspan="2">Epoch ${epoch + 1}:</th></tr>
            <tr><td>Loss</td> <td>${loss.toFixed(4)}</td></tr>
            <tr><td>Accuracy</td><td>${(categoricalAccuracy*100).toFixed(2)}%</td></tr>`;
      val_loss && (notice +=
        `<tr><td>Validation Loss</td><td>${val_loss.toFixed(4)}</td></tr>
        <tr><td>Validation Accuracy</td><td>${(val_categoricalAccuracy*100).toFixed(2)}%</td></tr>`)
      notice += "</table>";
      console.log(`Tensors in memory: ${tf.memory().numTensors}`);
      postMessage({ message: "training-results", notice });
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

  const train_ds = mixup 
    ? createMixupStreamDataset({ds:trainBin, labels, useRoll}).batch(batchSize)
    : createStreamDataset(trainBin, labels).map(x => useRoll ? roll(x) : x).batch(batchSize)


  if (DEBUG){
    train_ds.take(1).forEachAsync(({ xs, ys }) => {
      return tf.tidy(() =>{
        const first = tf.slice(xs, [0, 0], [1, xs.shape[1]]);
        Model.getSpectrogram({buffer:first, filepath:saveLocation,file:`sample.png`})
        xs.print();
        ys.print();
      })
    });
  }
  let val_ds;
  if (validation){
    val_ds = tf.tidy(() => tf.data.generator(() => readBinaryGzipDataset(valBin, labels)).batch(batchSize));
  }
  // Train on your new data
  // Assume `xTrain` and `yTrain` are your input and combined output labels
  const history = await transferModel.fitDataset(train_ds, {
    batchSize,
    epochs,
    validationData: validation ? val_ds : undefined,
    callbacks: [earlyStopping, events],
    verbosity: 0
  });


  let notice ='', type = '';
  if (history.epoch.length < epochs){
      notice += `Training halted at Epoch ${history.epoch.length} due to no further improvement. <br>`;
      type = 'warning';
  }
  const {loss:l, val_loss, categoricalAccuracy:Acc, val_categoricalAccuracy} = history.history;
  notice += `
Metrics:<br>
  Loss = ${l[l.length -1].toFixed(4)}<br>
  Accuracy = ${(Acc[Acc.length -1]* 100).toFixed(2)}%<br>`
  val_loss && (notice += `
  Validation Loss = ${val_loss[val_loss.length -1].toFixed(4)}<br>
  Validation Accuracy = ${(val_categoricalAccuracy[val_categoricalAccuracy.length -1]*100).toFixed(2)}%<br>
  <br>Training completed! Model saved in:<br>
  ${saveLocation}`);

  const message = {message: "training-results", notice, type, autohide:false, complete: true, history: history.history}

  notice += `

Settings:
  Epochs:${epochs} 
  Learning rate: ${initialLearningRate}
  Cosine learning rate decay: ${decay}
  Focal Loss: ${useFocal}
Classifier:  
  Hidden units:${hidden}
  Dropout: ${dropout}
Augmentations:
  Mixup: ${mixup}
  Roll: ${useRoll}
`
  fs.writeFileSync(path.join(saveLocation, `training_metrics_${Date.now()}.txt`), notice.replaceAll('<br>', ''), 'utf8');

  DEBUG && console.log(`Tensors in memory before: ${tf.memory().numTensors}`);
  baseModel.dispose()
  classWeightsTensor.dispose()
  finalModel.layers.forEach(layer => {
    try{ 
      layer.dispose();
    } catch {
      // Skip previously disposed layers
    }
  })
  optimizer.dispose();
  // console.log(`Tensors in memory after: ${tf.memory().numTensors}`);
  Model.model_loaded = false;
  Model.one.dispose(), Model.two.dispose(), Model.scalarFive.dispose();
  await Model.loadModel("layers");
  // console.log(`Tensors in memory new model: ${JSON.stringify(tf.memory())}`);
  console.log('new model made')
  return message
}

/// UTILITIES ///


function getFilesWithLabelsAndWeights(rootDir) {
  const files = [];
  const labelCounts = {};
  const folders = fs.readdirSync(rootDir);

  for (const folder of folders) {
    if (folder.startsWith('.')) continue;
    const folderPath = path.join(rootDir, folder);
    const stats = fs.statSync(folderPath);
    if (stats.isDirectory()) {
      const audioFiles = fs.readdirSync(folderPath);
      for (const file of audioFiles) {
        if (file.startsWith('.')) continue;
        const label = folder;
        files.push({
          filePath: path.join(folderPath, file),
          label: label
        });

        labelCounts[label] = (labelCounts[label] || 0) + 1;
      }
    }
  }

  // Compute class weights: inverse frequency normalised to 1
  const total = files.length;
  const classWeights = {};
  for (const [label, count] of Object.entries(labelCounts)) {
    classWeights[label] = total / (Object.keys(labelCounts).length * count);
  }

  return {
    files,         // [{ filePath, label }]
    classWeights   // { label1: weight1, label2: weight2, ... }
  };
}


/**
 * Writes a compressed binary dataset where each record is:
 *   - audio: Float32Array of 144000 samples (576000 bytes)
 *   - label: UInt8 (1 byte)
 * Total per record: 576001 bytes
 */
async function writeBinaryGzipDataset(fileList, outputPath, labelToIndex, postMessage, description = "Preparing data") {
  const t0 = Date.now()
  const pLimit = require('p-limit');
  const limit = pLimit(8); // Or whatever your CPU/I/O can handle

  const gzip = zlib.createGzip();
  const { once } = require('node:events');
  const writeStream = fs.createWriteStream(outputPath);
  gzip.pipe(writeStream);
  let completed = 0;
  const onAbort = () => {
    console.log("Abort received");
    gzip.end();
    fs.unlink(outputPath, () => {});
  };

  abortController.once('abort', onAbort);

  const tasks = fileList.map(({ filePath, label }) =>
    limit(async () => {
      let audioArray;
      try {
        audioArray = await decodeAudio(filePath);
      } catch (err) {
        postMessage({
          message: "training-results", 
          notice: `Error loading file:<br>${filePath}<br>${err}`,
          type: 'error'
        });
        
        completed++;
        return;
      }

      const expectedSamples = 48000 * 3;
      if (audioArray.length !== expectedSamples) {
        const padded = new Float32Array(expectedSamples);
        const start = Math.max(audioArray.length - expectedSamples, 0);
        padded.set(audioArray.slice(start), expectedSamples - (audioArray.length - start));
        audioArray = padded;
      }

      const audioBuffer = Buffer.from(audioArray.buffer);
      const labelIndex = labelToIndex[label];
      if (typeof labelIndex !== 'number' || labelIndex < 0 || labelIndex > 65535) {
        console.error(`Invalid labelIndex for "${label}" → ${labelIndex}`);
      }

      // Up to 65536 labels
      const labelBuf = Buffer.alloc(2);
      labelBuf.writeUInt16LE(labelIndex);

      const recordBuf = Buffer.concat([audioBuffer, labelBuf]);
      if (!gzip.write(recordBuf)) {
        await once(gzip, 'drain');
      }


      completed++;
      postMessage({
        message: "training-progress", 
        progress: { percent: (completed / fileList.length) * 100 },
        text: `${description}: `
      });
    })
  );



  await Promise.all(tasks);
  gzip.end();
  abortController.off('abort', onAbort);
  console.log(`Dataset preparation took: ${((Date.now() - t0)/ 1000).toFixed(0)} seconds. ${completed} files processed.`)
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
  const RECORD_SIZE = 576002; // 144000 * 4 + 2 bytes for the label
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
      const labelIndex = record.readUInt16LE(RECORD_SIZE - 2);

      const audio = new Float32Array(audioBuf.buffer, audioBuf.byteOffset, 144000);

      if (labelIndex >= labels.length) {
        console.error(`Invalid label index: ${labelIndex}. Max allowed: ${labels.length - 1}`);
      }
      yield {
        xs: tf.tensor1d(audio),
        ys: tf.oneHot(labelIndex, labels.length)
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

const ffmpeg = require('fluent-ffmpeg')
async function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    let gotDuration = false;
    const command = ffmpeg(filePath)
      .on('codecData', data => {
        if (data.duration) {
          const parts = data.duration.split(':'); // format: HH:MM:SS.xx
          const seconds =
            parseInt(parts[0], 10) * 3600 +
            parseInt(parts[1], 10) * 60 +
            parseFloat(parts[2]);
          gotDuration = true;
          command.kill(); // Stop the process early
          resolve(seconds);
        }
      })
      .on('error', err => {
        if (!gotDuration) reject(err);
      })
      .on('end', () => {
        if (!gotDuration) resolve(0); // If no duration was found, assume 0
      })
      .format('null') // dummy output
      .output('-')
      .run();
  });
}

async function decodeAudio(filePath) {
  const duration = await getAudioDuration(filePath);
  const seekTime = duration > 3 ? (duration / 2) - 1.5 : 0;

  return new Promise((resolve, reject) => {
    const chunks = [];

    ffmpeg(filePath)
      .format('wav')
      .audioCodec('pcm_s16le')
      .audioChannels(1)
      .audioFrequency(48000)
      .seekInput(seekTime)
      .duration(3.0)
      .on('error', reject)
      .on('end', () => {
        const wavBuffer = Buffer.concat(chunks);
        try {
          const int16Array = new Int16Array(wavBuffer.buffer, wavBuffer.byteOffset, wavBuffer.length / 2);
          const float32Array = new Float32Array(int16Array.length);
          for (let i = 0; i < int16Array.length; i++) {
            float32Array[i] = int16Array[i] / 32768;
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


function roll(x) {
    const {xs, ys} = x;
    const size = xs.shape[0];
    const maxShift = size / 4;
    const shift = Math.floor(Math.random() * maxShift); // random int from 0 to maxShift
    if (shift === 0) return x;

    const [left, right] = tf.split(xs, [size - shift, shift], 0);
    const rolled = tf.concat([right, left], 0)
    left.dispose(), right.dispose();
    const label = ys.clone();
    xs.dispose(), ys.dispose();
    return { xs: rolled, ys: label };
}

/**
 * Computes the categorical focal crossentropy loss.
 *
 * @param {tf.Tensor} yTrue - Ground truth labels.
 * @param {tf.Tensor} yPred - Predictions (either logits or probabilities).
 * @param {number} alpha - Balancing factor (default 0.25).
 * @param {number} gamma - Modulating factor (default 2.0).
 * @param {boolean} fromLogits - Whether `yPred` is expected to be logits.
 * @returns {tf.Tensor} - A tensor representing the focal loss per example.
 */
function categoricalFocalCrossentropy({
  yTrue,
  yPred,
  alpha = 0.25,
  gamma = 2.0,
  fromLogits = false,
  labelSmoothing = 0.0,
  axis = -1
}) {
  return tf.tidy(() => {
    if (fromLogits) {
      yPred = tf.softmax(yPred, axis);
    }
    if (labelSmoothing > 0) {
      const numClasses = yTrue.shape[1];
      const smoothPos = 1.0 - labelSmoothing;
      const smoothNeg = labelSmoothing / numClasses;
      yTrue = tf.add(tf.mul(yTrue, smoothPos), smoothNeg);
    }
    const output = tf.div(yPred, tf.sum(yPred, axis, true));
    const crossEntropy = tf.mul(yTrue, tf.log(output.add(1e-7)).neg());
    const modulatingFactor = tf.pow(tf.sub(1.0, output), gamma);
    const weightingFactor = tf.mul(modulatingFactor, alpha);
    const focalLoss = tf.sum(tf.mul(weightingFactor, crossEntropy), axis);
    return focalLoss;
  });
}

const createStreamDataset = (ds, labels) => 
  tf.data.generator(() => readBinaryGzipDataset(ds, labels))

function createMixupStreamDataset({useRoll, ds, labels, alpha = 0.4}) {
    return tf.tidy(() => {
      const ds1 = createStreamDataset(ds, labels).map(x => useRoll ? roll(x) : x).shuffle(100, 42);
      const ds2 = createStreamDataset(ds, labels).map(x => useRoll ? roll(x) : x).shuffle(100, 1337); // new generator instance
      return tf.data
        .zip({ a: ds1, b: ds2 })
        .map(({ a, b }) => {
          const lambda = tf.randomGamma([1], alpha, alpha).squeeze();
          const oneMinusLambda = tf.sub(1, lambda);

          const xMixed = tf.add(tf.mul(lambda, a.xs), tf.mul(oneMinusLambda, b.xs));
          const yMixed = tf.add(tf.mul(lambda, a.ys), tf.mul(oneMinusLambda, b.ys));
          return { xs: xMixed, ys: yMixed };
        })
    })
}
module.exports = {trainModel}