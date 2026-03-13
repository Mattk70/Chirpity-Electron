let tf, BACKEND, Model, LOCALE, DEBUG = false;
try {
  tf = require("@tensorflow/tfjs-node");
} catch {
  tf = require("@tensorflow/tfjs");
  BACKEND = "webgpu";
}
const fs = require("node:fs");
const path = require("node:path");
import { BaseModel } from "./BaseModel.js";
import abortController from '../utils/abortController.js';


onmessage = async (e) => {
  const data = e.data;
  const modelRequest = data.message;
  const worker = data.worker;
  let response;
  try {
    switch (modelRequest) {
      case "change-batch-size": {
        Model.warmUp(data.batchSize);
        break;
      }
      case "load": {
        const version = data.model;
        DEBUG && console.log("load request to worker");
        let appPath = data.modelPath;
        const batch = data.batchSize;
        const backend = BACKEND || data.backend;
        BACKEND = backend;
        LOCALE  = e.data.locale; // for error messages
        DEBUG && console.log(`Using backend: ${backend}`);
        backend === "webgpu" && require("@tensorflow/tfjs-backend-webgpu");
        let labels;
        const labelFile =  path.join(appPath, 'labels.txt');
        const fileContents = fs.readFileSync(labelFile, 'utf-8');
        labels = fileContents.trim().split(/\r?\n/);
        DEBUG &&
          console.log(
            `Model received load instruction. Using batch size ${batch}`
          );

        tf.setBackend(backend).then(async () => {
          tf.enableProdMode();
          if (DEBUG) {
            console.log(tf.env());
            console.log(tf.env().getFlags());
          }
          Model = new NightHawkModel(appPath, version);
          Model.UUID = data.UUID
          Model.labels = labels;

          try {
            await Model.loadModel("graph");

            await Model.warmUp();
            BACKEND = tf.getBackend();
            postMessage({
              message: "model-ready",
              sampleRate: Model.config.sampleRate,
              chunkLength: Model.chunkLength,
              backend: BACKEND,
              labels,
              worker,
            });
          } catch (error) {
            console.error("Error loading model:", error);
            postMessage({
              message: "model-error",
              error,
            });
          }
        });
        break;
      }
      case "train-model":{
        const {trainModel} = require('./training.js');
          trainModel({ ...data, locale: LOCALE, Model: Model}).then((message) => {
            postMessage({...message})
          }).catch((err) => {
            postMessage({
              message: "training-results", 
              notice: `Error during model training: ${err}`,
              type: 'error',
              complete: true
            });
          })
        break;
      }
      case "get-spectrogram": {
        await Model.getSpectrogram(data)
        break;
      }

      case "predict": {
        if (Model?.model_loaded) {
          const {
            chunks,
            start,
            fileStart,
            file,
            worker,
            context,
            resetResults,
            id
          } = data;
          Model.useContext = context;
          Model.selection = !resetResults;
          const result = await Model.predictChunk(chunks, start);
          const response = {
            message: "prediction",
            id,
            file,
            result,
            fileStart,
            worker,
            selection: Model.selection,
          };
          postMessage(response);
          Model.result = [];
        }
        break;
      }
      case "terminate": {
        abortController.abort();
        tf.backend().dispose();
        self.close(); // Terminate the worker
      }
    }
  } catch (error) {
    // If worker was respawned
    console.error(error);
  }
};

class NightHawkModel extends BaseModel {
  constructor(appPath, version) {
    super(appPath, version);
    this.config = { sampleRate: 22_050, specLength: 1, sigmoid: 1 };
    this.batchSize = 1;
    this.chunkLength = this.config.sampleRate * this.config.specLength;
  }

    async warmUp() {

    DEBUG && console.log("WarmUp begin", tf.memory().numTensors);
    const input = tf.zeros(this.inputShape);

    // Parallel compilation for faster warmup
    // https://github.com/tensorflow/tfjs/pull/7755/files#diff-a70aa640d286e39c922aa79fc636e610cae6e3a50dd75b3960d0acbe543c3a49R316
    if (tf.getBackend() === "webgpu") {
      const compileRes = this.model.predict(input);
      await tf.backend().checkCompileCompletionAsync();
      tf.dispose(compileRes);
    } else {
      // Tensorflow backend
      // const compileRes = this.model.predict(input);
      // tf.dispose(compileRes);
    }
    input.dispose();
    DEBUG && console.log("WarmUp end", tf.memory().numTensors);
    return true;
  }

  createAudioTensor = (audio) => {
    return tf.tidy(() => {
      audio = this.padAudio(audio);
      return tf.tensor1d(audio);
    });
  };

  async predictChunk(audioBuffer, start) {
    DEBUG && console.log("predictChunk begin", tf.memory().numTensors);
    const audioBatch = this.createAudioTensor(audioBuffer);
    const maxKeys = Math.ceil(audioBuffer.length / this.chunkLength)
    const batchKeys = this.getKeys(maxKeys, start);
    const result = await this.predictBatch(audioBatch, batchKeys );
    DEBUG && console.log("predictChunk end", tf.memory().numTensors);
    return result;
  }

  async predictBatch(audio, keys) {
    const { topIndices, topValues } = tf.tidy(() => {
      const [family, species, order, group] =
        this.model.predict(audio);
      let output = species;
      if (this.selection) {
        output = tf.max(species, 0, true);
      }
      if (this.bgMask) {
        output = output.mul(this.bgMask);
      }
      const topN = Math.min(species.shape[1], 5);
      const { indices, values } = tf.topk(output, topN, true);
      return {
        topIndices: indices,
        topValues: tf.sigmoid(values),
      };
    });

    audio.dispose();
    // const embeddingDim = embeddingsValues.shape[1];
    // this.embeddingsDIM = embeddingDim;
    const [indicesData, valuesData] = await Promise.all([
      topIndices.data(),
      topValues.data(),
    ]);
    topIndices.dispose();
    topValues.dispose();
    // embeddingsValues.dispose();
    // Fix keys trimming
    if (this.selection) {
      keys = keys.slice(0, 1);
    }

    keys = keys.map(
      key => Math.round((key / (this.config.sampleRate)) * 10000) / 10000
    );
    const adjustedBatchSize = keys.length;
    const topN = this.topN;
    // Reshape manually without expensive array()
    const reshapedIndices = [];
    const reshapedValues = [];
    // const reshapedEmbeddings = [];
    for (let i = 0; i < adjustedBatchSize; i++) {
      reshapedIndices.push(
        indicesData.slice(i * topN, (i + 1) * topN)
      );
      reshapedValues.push(
        valuesData.slice(i * topN, (i + 1) * topN)
      );
      // reshapedEmbeddings.push(
      //   embeddingsData.slice(
      //     i * this.embeddingsDIM,
      //     (i + 1) * this.embeddingsDIM
      //   )
      // );
    }
    return [keys, reshapedIndices, reshapedValues];
  }
}

