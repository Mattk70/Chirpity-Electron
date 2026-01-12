import {installConsoleTracking } from "../utils/tracking.js";

let tf, DEBUG = false;

const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')
try {
  tf = require("@tensorflow/tfjs-node");
} catch {
  tf = require("@tensorflow/tfjs");
}
import abortController from '../utils/abortController.js';

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
    this.mels = config.melFilterbank;
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
      let interim = result
        .matMul(this.melFilterbank)
        .pow(this.two)
        .pow(tf.div(this.one, tf.add(this.one, tf.exp(this.magScale.read()))))
        .reverse(-1)
        .transpose([0, 2, 1])
        .expandDims(-1);
      return interim
    });
  }

  // Optionally, include the `className` method to provide a machine-readable name for the layer
  static get className() {
    return "MelSpecLayerSimple";
  }

  getConfig() {
    const baseConfig = super.getConfig();
    return Object.assign(baseConfig, {
      sampleRate: this.sampleRate,
      specShape: this.specShape,
      frameStep: this.frameStep,
      frameLength: this.frameLength,
      fmin: this.fmin,
      fmax: this.fmax,
      melFilterbank: this.mels,
    });
  }
}

/**
 * Computes a cosine decay learning rate based on the current training step.
 *
 * The learning rate decreases from the initial value to zero following a half-cosine curve over the specified number of decay steps.
 *
 * @param {number} initialLearningRate - The starting learning rate before decay.
 * @param {number} globalStep - The current training step.
 * @param {number} decaySteps - The total number of steps over which to decay the learning rate.
 * @return {number} The decayed learning rate for the current step.
 */
function cosineDecay(initialLearningRate, globalStep, decaySteps) {
  const step = Math.min(globalStep, decaySteps);
  const cosineDecay = 0.5 * (1 + Math.cos(Math.PI * step / decaySteps));
  return initialLearningRate * cosineDecay;
}

/**
 * Trains a transfer learning audio classification model with configurable augmentation, loss, and caching options.
 *
 * Freezes the base model, adds a new classifier head, and trains using the provided dataset with support for mixup, noise blending, rolling augmentation, class weighting, focal loss, and label smoothing. Handles dataset preparation, caching, validation split, progress reporting, early stopping, and model saving with updated configuration and license files. Returns a summary message with training metrics and settings.
 *
 * @param {Object} options - Training configuration options.
 * @param {Object} options.Model - The model wrapper object containing the base model and utility methods.
 * @param {number} options.lr - Initial learning rate.
 * @param {number} [options.batchSize=32] - Batch size for training.
 * @param {number} options.dropout - Dropout rate for hidden layers.
 * @param {number} options.epochs - Number of training epochs.
 * @param {number} options.hidden - Number of units in the optional hidden dense layer.
 * @param {string} options.dataset - Path to the dataset directory.
 * @param {string} options.cache - Path to the cache folder for binary datasets.
 * @param {string} options.modelLocation - Directory to save the trained model.
 * @param {string} options.modelType - Model saving mode ('append' to merge outputs).
 * @param {boolean} options.useCache - Whether to use cached binary datasets if available.
 * @param {number} options.validation - Validation split ratio (0–1).
 * @param {boolean} options.mixup - Whether to apply mixup augmentation.
 * @param {boolean} options.decay - Whether to use cosine learning rate decay.
 * @param {boolean} options.useWeights - Whether to use class weights in the loss function.
 * @param {boolean} options.useFocal - Whether to use focal loss.
 * @param {boolean} options.useNoise - Whether to blend background noise into training samples.
 * @param {number} options.labelSmoothing - Amount of label smoothing to apply in the loss.
 * @returns {Promise<Object>} A message object summarizing training results, metrics, and settings.
 */
async function trainModel({
      Model, 
      lr:initialLearningRate,
      batchSize = 32,
      dropout, epochs, hidden,
      dataset, cache:cacheFolder, modelLocation:saveLocation, modelType, 
      useCache, validation, mixup, decay, 
      useWeights, useFocal, useNoise, labelSmoothing}) {
  installConsoleTracking(() => Model.UUID, "Training");
  const {files:allFiles, classWeights} = getFilesWithLabelsAndWeights(dataset);
  if (!allFiles.length){
    throw new Error(`The selected training folder: ${dataset} does not have folders representing class / species labels containing audio files.` )
  }
  const baseModel = Model.model;

  const labels = Object.keys(classWeights); //[...new Set(allFiles.map(f => f.label))];
  const labelToIndex = Object.fromEntries(labels.map((l, i) => [l, i]));
  const t0 = Date.now();
  const cacheRecords = useCache;
  const metrics = [ tf.metrics.categoricalAccuracy ];
  const optimizer = tf.train.adam(initialLearningRate);
  let bestAccuracy, bestLoss = Infinity;
  // Cache in the dataset folder if not selected
  cacheFolder = cacheFolder || dataset;

  // Get embeddings from BirdNET
  let embeddingModel = tf.model({
    inputs: baseModel.inputs,
    outputs: baseModel.getLayer('GLOBAL_AVG_POOL').output,
    name: baseModel.name + "_embeddings"
  });

  // Create the new classifier head
  const transferModel = tf.sequential();
  transferModel.add(tf.layers.inputLayer({inputShape: [1024]}));
  transferModel.add(tf.layers.batchNormalization({name:'CUSTOM_BN_1'}));
  // L2 regularization
  const regularizer = tf.regularizers.l2({l2: 1e-5});
  if (hidden) {
    if (dropout){
      transferModel.add(tf.layers.dropout({rate: dropout, name:'CUSTOM_DROP_1'}));
    }
    transferModel.add(tf.layers.dense({units: hidden, activation: 'mish', kernelRegularizer: regularizer, kernelInitializer: 'heNormal', name: 'CUSTOM_HIDDEN' }));
    if (dropout) {
      transferModel.add(tf.layers.dropout({rate: dropout, name:'CUSTOM_DROP_2'}));
    }
  }
  transferModel.add(tf.layers.dense({units: labels.length, kernelRegularizer: regularizer, kernelInitializer: 'glorotUniform', name: 'CUSTOM_CLASSES' }));
  transferModel.add(tf.layers.activation({activation: 'sigmoid', name: 'CUSTOM_SIGMOID'}));

  const classWeightsTensor = tf.tensor1d(
    Object.entries(classWeights)
      .sort(([a], [b]) => a.localeCompare(b)) // ensure consistent class order
      .map(([, weight]) => weight)
  );

  const lossWithWeights = (labels, preds) => {
    return tf.tidy(() => {
      let exampleWeights;
      if (useWeights && !useFocal){
        const labelIndices = labels.argMax(-1);
        exampleWeights = useWeights ? classWeightsTensor.gather(labelIndices) : undefined;
      }
       return useFocal
        ? categoricalFocalCrossEntropy({yTrue:labels, yPred:preds, labelSmoothing})
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
  const noiseBin = path.join(cacheFolder, "background_ds.bin");


  let trainFiles, valFiles, noiseFiles;

  if (validation) {
    ({ trainFiles, valFiles } = stratifiedSplit(allFiles, validation));
  } else {
    trainFiles = allFiles;
  }

  if (useNoise && (!fs.existsSync(noiseBin) || !cacheRecords)){
    noiseFiles = allFiles.filter(file => file.label.toLowerCase().includes('background'))
    if (!noiseFiles || noiseFiles.length === 0){
      const notice = 'noBackground' 
      postMessage({ message: "training-results", notice, type:'error' });
      return
    }
    await writeBinaryGzipDataset(embeddingModel, noiseFiles, noiseBin, labelToIndex, postMessage, "Preparing noise data");
  }
  let noise_ds;
  if (useNoise) noise_ds = tf.data.generator(() => readBinaryGzipDataset(noiseBin, labels)).repeat();

  if (!cacheRecords || !fs.existsSync(trainBin)) {
    if (valFiles){
      // Check same number of classes in train and val data
      // Step 1: Create sets of labels
      const labels1 = new Set(trainFiles.map(item => item.label));
      const labels2 = new Set(valFiles.map(item => item.label));

      // Step 2: Find missing labels from
      let error;
      const missing1 = [...labels1].filter(label => !labels2.has(label));
      if (missing1.length) error = 'Validation set is missing examples of: <b>' + missing1.toString() +'</b>. ';
      const missing2 = [...labels2].filter(label => !labels1.has(label));
      if (missing2.length) error = 'Training set is missing examples of: <b>' + missing2.toString() +'</b>. ';
      if (error){
        error += 'To have both training and validation data, at least two examples are needed per class.'
        postMessage({ message: "training-results", notice: error, type: 'error', autohide:false });
        return
      }
    }
    await writeBinaryGzipDataset(embeddingModel, trainFiles, trainBin, labelToIndex, postMessage, "Preparing training data");
  }

  if (validation && (!cacheRecords || !fs.existsSync(valBin))) {
    await writeBinaryGzipDataset(embeddingModel, valFiles, valBin, labelToIndex, postMessage, "Preparing validation data");
  }
  let mergedModel, modelSavePromise;
  const saveModelAsync = async () => {
      let mergedLabels = labels;
      const intermediate = transferModel.apply(baseModel.getLayer('GLOBAL_AVG_POOL').output);
      let output = intermediate;
      if (modelType === 'append'){
        output = tf.layers.concatenate({ axis: -1 }).apply([baseModel.output, intermediate]);
        mergedLabels = Model.labels.concat(labels);
      }
      mergedModel = tf.model({
          inputs: baseModel.inputs,
          outputs: output,
          name: 'transfer_model'
        });
      // Write labels to a file
      const labelData = mergedLabels.join('\n');
      fs.writeFileSync(path.join(saveLocation, 'labels.txt'), labelData, 'utf8');
      // Save the model
      await mergedModel.save('file://' + saveLocation);
  }
  
  // Callbacks
  const valueToMonitor = validation ? 'val_loss' : 'loss';
  const earlyStopping = tf.callbacks.earlyStopping({monitor: valueToMonitor, minDelta: 0.0001, patience: 5})
  const events = new tf.CustomCallback({
    onYield: (epoch, batch, _logs) =>{
      batch += 1;
      const batchesInEpoch = Math.floor(trainFiles.length / batchSize);
      const progress = (batch / batchesInEpoch) * 100
      postMessage({
            message: "training-progress", 
            progress: {percent: Math.min(progress, 99.5)},
            text: `Epoch ${epoch + 1} / ${epochs}: `
      });
    },
    onEpochEnd: (epoch, logs) => {
      decay && (transferModel.optimizer.learningRate = Math.max(1e-6, cosineDecay(initialLearningRate, epoch+1, epochs)) );
      const {loss, val_loss, val_categoricalAccuracy, categoricalAccuracy} = logs;
      const monitoredLoss = val_loss || loss;
      // Save best weights
      if (monitoredLoss < bestLoss){
        bestLoss = monitoredLoss;
        bestAccuracy = val_categoricalAccuracy || categoricalAccuracy;
        modelSavePromise = saveModelAsync()
      }
      let notice = `<table class="table table-striped">
            <tr><th colspan="2">Epoch ${epoch + 1}:</th></tr>
            <tr><td>Loss</td> <td>${loss.toFixed(4)}</td></tr>
            <tr><td>Accuracy</td><td>${(categoricalAccuracy*100).toFixed(2)}%</td></tr>`;
      val_loss && (notice +=
        `<tr><td>Validation Loss</td><td>${val_loss.toFixed(4)}</td></tr>
        <tr><td>Validation Accuracy</td><td>${(val_categoricalAccuracy*100).toFixed(2)}%</td></tr>`)
      notice += "</table>";
      // console.log(`Tensors in memory`, tf.memory());
      postMessage({ message: "training-results", notice });
    },
    onTrainEnd: (logs) => {
      postMessage({
        message: "training-progress", 
        progress: {percent: 100},
        text: ''
      });
      const t1 = Date.now();
      console.info(`Training completed in ${((t1 - t0) / 1000).toFixed(2)} seconds`);
      return logs
    }
  })

  let train_ds = mixup 
    ? createMixupStreamDataset({ds:trainBin, labels})
    : createStreamDataset(trainBin, labels);

  const augmented_ds = useNoise 
    ? tf.data.generator(() => blendedGenerator(train_ds, noise_ds)).batch(batchSize).prefetch(3)
    : train_ds.batch(batchSize).prefetch(3);

  if (DEBUG){
    augmented_ds.take(1).forEachAsync(async ({ xs, ys }) => {
      const first = tf.slice(xs, [0, 0], [1, xs.shape[1]]);
      await Model.getSpectrogram({buffer:first, filepath:saveLocation,file:`sample.png`})
      first.dispose();
    });
  }
  let val_ds;
  if (validation){
    val_ds = tf.data.generator(() => readBinaryGzipDataset(valBin, labels)).batch(batchSize);
  }
  // Train the model
  const history = await transferModel.fitDataset(augmented_ds, {
    batchSize,
    epochs,
    validationData: validation ? val_ds : undefined,
    callbacks: [earlyStopping, events],
    verbosity: 0
  });
  await modelSavePromise;

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
  Validation Loss = ${bestLoss.toFixed(4)}<br>
  Validation Accuracy = ${(bestAccuracy*100).toFixed(2)}%<br>
  <br>Training completed! Model saved in:<br>
  ${saveLocation}`);

  const message = {message: "training-results", notice, type, autohide:false, complete: true, history: history.history}

  notice += `

Settings:
  Batch Size: ${batchSize}
  Epochs:${epochs} 
  Learning rate: ${initialLearningRate}
  Cosine learning rate decay: ${decay}
  Focal Loss: ${useFocal}
  Class Weights: ${useWeights}
  LabelSmoothing: ${labelSmoothing}
Classifier:  
  Hidden units:${hidden}
  Dropout: ${dropout}
Augmentations:
  Mixup: ${mixup}
  Background noise: ${useNoise}
`
  fs.writeFileSync(path.join(saveLocation, `training_metrics_${Date.now()}.txt`), notice.replaceAll('<br>', ''), 'utf8');

  // Generate a LICENSE
  const license = `This model is derived from BirdNET, developed by the K. Lisa Yang Center for Conservation Bioacoustics 
at the Cornell Lab of Ornithology in collaboration with Chemnitz University of Technology.

Use of the model is governed by the terms of the 
Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License 
(CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/.
`

  fs.writeFileSync(path.join(saveLocation, `LICENSE.txt`), license, 'utf8');
  baseModel.dispose()
  classWeightsTensor.dispose()
  mergedModel.layers.forEach(layer => {
    try{ 
      if (layer.getClassName() === 'MelSpecLayerSimple') {
        layer.one.dispose(), layer.two.dispose(), layer.melFilterbank.dispose();
      }
      layer.dispose();
    } catch {
      // Skip previously disposed layers
    }
  })
  transferModel.layers.forEach(layer => layer.dispose());
  optimizer.dispose();
  Model.model_loaded = false;
  Model.one.dispose(), Model.two.dispose(), Model.scalarFive.dispose();
  DEBUG && console.log(`Tensors in memory after: ${tf.memory().numTensors}`);
  await Model.loadModel("layers");
  console.info('Custom model saved.', `Loss: ${bestLoss.toFixed(4)}, Accuracy: ${bestAccuracy.toFixed(4)}`)
  return message
}

/**
 * Scans a root directory for labeled subfolders, collecting audio file paths and computing normalized class weights.
 *
 * Each subfolder is treated as a label, and all non-hidden, non-binary files within are included. Class weights are calculated as the inverse frequency of each label, normalized by the total number of samples and number of classes.
 *
 * @param {string} rootDir - Path to the root directory containing labeled subfolders.
 * @returns {{files: Array<{filePath: string, label: string}>, classWeights: Object<string, number>}} An object containing the list of files with labels and the computed class weights.
 */


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
        if (file.startsWith('.') || file.endsWith('.bin')) continue;
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
    console.log(`Label "${label}" has ${count} samples`);
    // Normalize by total samples and number of classes
    classWeights[label] = total / (Object.keys(labelCounts).length * count);
  }

  return {
    files,         // [{ filePath, label }]
    classWeights   // { label1: weight1, label2: weight2, ... }
  };
}


/**
 * Converts a list of labeled audio files into a gzip-compressed binary dataset for efficient training.
 *
 * Each record consists of a 3-second (144,000-sample) Float32 audio array and a 2-byte label index. Audio shorter than 1.5 seconds is skipped; shorter samples are left-padded to 3 seconds. Progress is reported via the provided callback, and the process supports aborting.
 *
 * @param {Array} fileList - List of objects with `filePath` and `label` properties.
 * @param {string} outputPath - Destination path for the compressed binary dataset.
 * @param {Object} labelToIndex - Mapping from label names to numeric indices.
 * @param {Function} postMessage - Callback for progress and error reporting.
 * @param {string} [description] - Optional description for progress updates.
 */
async function writeBinaryGzipDataset(embeddingModel, fileList, outputPath, labelToIndex, postMessage, description = "Preparing data") {
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
        console.error("Training: decode audio", err)
        completed++;
        return;
      }

      const expectedSamples = 48000 * 3;
      if (audioArray.length !== expectedSamples) {
        if (audioArray.length < 72000) return // don't includes samples less than 1.5 seconds        )
        const padded = new Float32Array(expectedSamples);
        const start = Math.max(audioArray.length - expectedSamples, 0);
        padded.set(audioArray.slice(start), expectedSamples - (audioArray.length - start));
        audioArray = padded;
      }
      // Get embeddings from BirdNET
      const input = tf.tensor2d(audioArray, [1, audioArray.length]);
      const embeddingTensor = await embeddingModel.predict(input);
      const embeddings = await embeddingTensor.data();
      const embeddingsBuffer = Buffer.from(embeddings.buffer);
      const labelIndex = labelToIndex[label];
      if (typeof labelIndex !== 'number' || labelIndex < 0 || labelIndex > 65535) {
        console.error(`Invalid labelIndex for "${label}" → ${labelIndex}`);
      }

      // Write labels
      const labelBuf = Buffer.alloc(4);
      labelBuf.writeFloatLE(labelIndex);

      const recordBuf = Buffer.concat([embeddingsBuffer, labelBuf]);
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
  console.info(`Dataset preparation took: ${((Date.now() - t0)/ 1000).toFixed(0)} seconds. ${completed} files processed.`)
}


/**
 * Splits a list of labeled files into stratified training and validation sets, preserving label proportions.
 * Ensures each label is represented by at least one sample in the validation set.
 * @param {Array} allFiles - Array of file objects, each containing a `label` property.
 * @param {number} [valRatio=0.2] - Fraction of samples per label to allocate to the validation set.
 * @return {{trainFiles: Array, valFiles: Array}} Object containing shuffled training and validation file arrays.
 */
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

async function* readBinaryGzipDataset(gzippedPath, labels, roll = false) {
  const RECORD_SIZE = 4100; // 1024 * 4 + 4 bytes for the label
  const gunzip = zlib.createGunzip();
  const stream = fs.createReadStream(gzippedPath).pipe(gunzip);
  let leftover = Buffer.alloc(0);
  for await (const chunk of stream) {
    const data = Buffer.concat([leftover, chunk]);
    const total = Math.floor(data.length / RECORD_SIZE) * RECORD_SIZE;
    let offset = 0;

    while (offset + RECORD_SIZE <= total) {
      const record = data.subarray(offset, offset + RECORD_SIZE);
      const audioBuf = record.subarray(0, 1024 * 4);
      const labelIndex = record.readFloatLE(RECORD_SIZE - 4);

      const embedding = new Float32Array(audioBuf.buffer, audioBuf.byteOffset, 1024);
      if (labelIndex >= labels.length) {
        console.error(`Invalid label index: ${labelIndex}. Max allowed: ${labels.length - 1}`);
      }
      yield {
        xs: tf.tensor1d(embedding),
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
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path.replace("app.asar","app.asar.unpacked");
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Extracts the duration (in seconds) and bitrate (in Hz) from an audio file using ffmpeg.
 * @param {string} filePath - Path to the audio file.
 * @return {Promise<{duration: number, bitrate: number}>} Resolves with the audio duration and bitrate.
 */
async function getAudioMetadata(filePath) {
  return new Promise((resolve, reject) => {
    let gotDuration = false, seconds = 0, bitrate = 0;

    const command = ffmpeg(filePath)
      .on('codecData', data => {
        const {duration, audio_details} = data;
        if (duration) {
          const parts = duration.split(':'); // format: HH:MM:SS.xx
          seconds =
            parseInt(parts[0], 10) * 3600 +
            parseInt(parts[1], 10) * 60 +
            parseFloat(parts[2]);
          gotDuration = true;
          command.kill(); // Stop the process early
        }
        if (audio_details){
          try {
            if (audio_details[1] && typeof audio_details[1] === 'string') {
              bitrate = parseInt(audio_details[1].replace(/[^0-9]/g, ''));
            }
          } catch (err) {
            console.warn('Failed to parse bitrate:', err);
          }
        }
        resolve({duration:seconds, bitrate});
      })
      .on('error', err => {
        if (!gotDuration) reject(err);
      })
      .on('end', () => {
        resolve({duration:seconds, bitrate}); // If no duration was found, assume 0
      })
      .format('wav') // dummy output
      .output('-')
      .run();
  });
}

/**
 * Decodes an audio file to a normalized Float32Array of mono PCM samples at 48kHz for a 3-second segment.
 *
 * Extracts a 3-second mono segment from the center of the audio file (or from the start if shorter), resamples to 48kHz, and normalizes the output to the range [-1, 1].
 *
 * @param {string} filePath - Path to the audio file to decode.
 * @returns {Promise<Float32Array>} A promise that resolves to a Float32Array containing the decoded audio samples.
 */
async function decodeAudio(filePath) {
  const {duration, bitrate:rate} = await getAudioMetadata(filePath);
  const seekTime = duration > 3 ? (duration / 2) - 1.5 : 0;

  return new Promise((resolve, reject) => {
    const chunks = [];

    ffmpeg(filePath)
      .format('s16le')
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



/**
 * Randomly shifts the contents of a Float32Array audio buffer by up to one quarter of its length.
 * 
 * This augmentation simulates temporal shifts in audio data by rolling the array contents left or right.
 * If the random shift is zero, the original array is returned.
 * @param {Float32Array} audio - The audio buffer to roll.
 * @return {Float32Array} The rolled audio buffer.
 */
function rollFloat32(audio) {
  const size = audio.length;
  const maxShift = Math.floor(size/4);
  let shift = Math.round(Math.random() * maxShift);
  if (shift === 0) {
    DEBUG && console.log('No shift applied');
    return audio; // or audio.slice() if you want to avoid referencing the same buffer
  }

  const rolled = new Float32Array(size);
  if (shift > 0) {
    // Roll right
    rolled.set(audio.subarray(size - shift, size), 0);       // End to start
    rolled.set(audio.subarray(0, size - shift), shift);      // Start to shifted position
  } else {
    // Roll left
    shift = -shift;
    rolled.set(audio.subarray(shift, size), 0);              // Middle to end
    rolled.set(audio.subarray(0, shift), size - shift);      // Start to end
  }
  return rolled;
}

/**
 * Calculates the categorical focal cross-entropy loss for multi-class classification tasks.
 *
 * Supports optional label smoothing and logits input. Returns the focal loss per example as a tensor.
 *
 * @param {tf.Tensor} yTrue - One-hot encoded ground truth labels.
 * @param {tf.Tensor} yPred - Model predictions (probabilities or logits).
 * @param {number} [alpha=0.25] - Balancing factor for class imbalance.
 * @param {number} [gamma=2.0] - Modulating factor to focus on hard examples.
 * @param {boolean} [fromLogits=false] - If true, applies softmax to logits.
 * @param {number} [labelSmoothing=0.0] - Amount of label smoothing to apply.
 * @param {number} [axis=-1] - Axis along which to compute the loss.
 * @returns {tf.Tensor} Tensor of focal loss values for each example.
 */
function categoricalFocalCrossEntropy({
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
  tf.data.generator(() => readBinaryGzipDataset(ds, labels)).prefetch(3);

/**
 * Creates a TensorFlow.js dataset with mixup augmentation by randomly blending pairs of samples and their labels.
 * 
 * Two independently shuffled datasets are zipped and mixed using a gamma-distributed coefficient, producing augmented samples for robust model training.
 * 
 * @param {AsyncGenerator} ds - The source dataset generator.
 * @param {string[]} labels - Array of label names.
 * @param {number} [alpha=0.4] - Mixup alpha parameter controlling the strength of blending.
 * @return {tf.data.Dataset} A dataset yielding mixed input-label pairs.
 */
function createMixupStreamDataset({ds, labels, alpha = 0.4}) {
      const ds1 = createStreamDataset(ds, labels).shuffle(100, 42).prefetch(1);
      const ds2 = createStreamDataset(ds, labels).shuffle(100, 1337).prefetch(1);
      return tf.data
        .zip({ a: ds1, b: ds2 })
        .map(({ a, b }) => {
          const lambda = tf.randomGamma([1], alpha, alpha).squeeze();
          const oneMinusLambda = tf.sub(1, lambda);

          const xMixed = tf.add(tf.mul(lambda, a.xs), tf.mul(oneMinusLambda, b.xs));
          const yMixed = tf.add(tf.mul(lambda, a.ys), tf.mul(oneMinusLambda, b.ys));
          return { xs: xMixed, ys: yMixed };
        })
}

async function* blendedGenerator(train_ds, noise_ds) {
  const [trainIt, noiseIt] = await Promise.all([
    train_ds.iterator(),
    noise_ds.iterator()
  ]);

  while (true) {
    const [clean, noise] = await Promise.all([
      trainIt.next(),
      noiseIt.next()
    ]);
    if (clean.done) {
      noise.value.xs.dispose();
      noise.value.ys.dispose();
      break;
    }
    
    const result = tf.tidy(() => {
      // Random weight between 0.5 and 1.0 for the clean signal
      const cleanWeight = Math.random() * 0.5 + 0.5;
      const noiseWeight = 1.0 - cleanWeight;

      const blendedXs = clean.value.xs.mul(cleanWeight).add(noise.value.xs.mul(noiseWeight));

      return {
        xs: blendedXs,
        ys: clean.value.ys
      };
    });

    clean.value.xs.dispose();
    noise.value.xs.dispose();
    noise.value.ys.dispose();
    yield result;
  }
}

export {trainModel, getAudioMetadata};