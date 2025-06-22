
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
  batchSize = 8,
  dropout, epochs, hidden,
  dataset, cache:cacheFolder, modelLocation:saveLocation, modelType, 
  useCache, validation, mixup, decay, roll:useRoll}) {
  const allFiles = getFilesWithLabels(dataset);
  if (!allFiles.length){
    throw new Error(`No files found in any label folders in ${dataset}` )
  }
  const baseModel = Model.model;
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

  // Callbacks
  const earlyStopping = tf.callbacks.earlyStopping({monitor: 'val_loss', minDelta: 0.0001, patience: 3})
  const events = new tf.CustomCallback({
    onYield: (epoch, batch, _logs) =>{
      batch += 1;
      const batchesInEpoch = Math.floor(trainFiles.length / 32);
      const progress = (batch / batchesInEpoch) * 100
      postMessage({
            message: "training-progress", 
            progress: {percent: Math.min(progress, 99)},
            text: `Epoch ${epoch + 1} / ${epochs}: `
      });
    },
    onEpochEnd: (epoch, logs) => {
      decay && (transferModel.optimizer.learningRate = cosineDecay(initialLearningRate, epoch+1, epochs) );
      const {loss, val_loss, val_categoricalAccuracy, precision, recall, val_precision, val_recall, categoricalAccuracy} = logs;
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

  const createStreamDataset = (useRoll) =>
      tf.data
          .generator(() => readBinaryGzipDataset(trainBin, labels))
          .map(x => useRoll ? roll(x) : x); // optional rolling before mixup

  function createMixupStreamDataset(useRoll, batchSize = 8, alpha = 0.4) {
      return tf.tidy(() => {
        const ds1 = createStreamDataset(useRoll).shuffle(50, 42);
        const ds2 = createStreamDataset(useRoll).shuffle(50, 1337); // new generator instance
        return tf.data
          .zip({ a: ds1, b: ds2 })
          .map(({ a, b }) => {
            const lambda = tf.randomGamma([1], alpha, alpha).squeeze();
            const oneMinusLambda = tf.sub(1, lambda);

            const xMixed = tf.add(tf.mul(lambda, a.xs), tf.mul(oneMinusLambda, b.xs));
            const yMixed = tf.add(tf.mul(lambda, a.ys), tf.mul(oneMinusLambda, b.ys));
            return { xs: xMixed, ys: yMixed };
          })
          .batch(batchSize);
      })
  }

  const train_ds = mixup ? createMixupStreamDataset(useRoll, batchSize).prefetch(1) : createStreamDataset().batch(batchSize);
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
    val_ds = tf.data.generator(() => readBinaryGzipDataset(valBin, labels)).batch(8);
  }
  // Train on your new data
  // Assume `xTrain` and `yTrain` are your input and combined output labels
  const history = await transferModel.fitDataset(train_ds, {
    batchSize,
    epochs,
    validationData: validation ? val_ds : undefined,
    callbacks: [earlyStopping, events]
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
  const finalModel = mergedModel || transferModel;   
  // Read BirdNET config to extract mel_Spec configs to inject into custom model config
  const modelPath = path.resolve(__dirname, '../../BirdNET_GLOBAL_6K_V2.4_Model_TFJS/static/model/model.json');
  const bnConfig = JSON.parse(fs.readFileSync(modelPath, 'utf-8'));
  const melSpec1Config = bnConfig.modelTopology.model_config.config.layers[1].config;
  const melSpec2Config = bnConfig.modelTopology.model_config.config.layers[2].config;
  await finalModel.save('file://' + saveLocation);
  const customConfig = JSON.parse(fs.readFileSync(path.join(saveLocation, 'model.json')))
  customConfig.modelTopology.config.layers[1].config = melSpec1Config;
  customConfig.modelTopology.config.layers[2].config = melSpec2Config;
  fs.writeFileSync(path.join(saveLocation, 'model.json'), JSON.stringify(customConfig), 'utf8')
  // Save labels
  const labelData = (mergedLabels || labels).join('\n');
  // Write to a file
  fs.writeFileSync(path.join(saveLocation, 'labels.txt'), labelData, 'utf8');
  notice += `

Settings:
  Epochs:${epochs} 
  Learning rate: ${initialLearningRate}
  Cosine learning rate decay: ${decay}
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
  const t0 = Date.now()
  const pLimit = require('p-limit');
  const limit = pLimit(8); // Or whatever your CPU/I/O can handle

  const gzip = zlib.createGzip();
  const { once } = require('node:events');
  const writeStream = fs.createWriteStream(outputPath);
  gzip.pipe(writeStream);
console.log('test')
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
        padded.set(audioArray.slice(0, expectedSamples));
        audioArray = padded;
      }

      const audioBuffer = Buffer.from(audioArray.buffer);
      const labelIndex = labelToIndex[label];

      // Up to 65536 labels
      const labelBuf = Buffer.alloc(2);
      labelBuf.writeUInt16LE(labelIndex);

      if (!gzip.write(audioBuffer)) {
        await once(gzip, 'drain');
      }

      if (!gzip.write(labelBuf)) {
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
      // .seekInput(1)
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

function roll(x) {
    return tf.tidy(() =>{
        const {xs, ys} = x;
        const size = xs.shape[0];
        const maxShift = Math.floor(size / 2);
        const shift = Math.floor(Math.random() * (maxShift + 1)); // random int from 0 to maxShift

        const [left, right] = tf.split(xs, [size - shift, shift], 0);
        return {xs:tf.concat([right, left], 0), ys};
  })
}

module.exports = {trainModel}