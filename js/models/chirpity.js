let tf, BACKEND;
try {
  tf = require("@tensorflow/tfjs-node");
} catch {
  tf = require("@tensorflow/tfjs");
  require("@tensorflow/tfjs-backend-webgpu");
  BACKEND = "webgpu";
}

import { BaseModel } from "./BaseModel.js";
const fs = require("node:fs");
const path = require("node:path");
let DEBUG = false;

//GLOBALS
let myModel;

const CONFIG = {
  sampleRate: 24_000,
  specLength: 3,
  sigmoid: 1,
};

/**
 * Loads the model configuration, sets up the TensorFlow.js backend, and initializes the global model instance for inference.
 *
 * Reads the model configuration based on the specified version, configures the TensorFlow.js backend with environment flags, creates a mask tensor for filtering prediction indexes, and loads and warms up the model. Sends a "model-ready" message to the specified worker with model details upon completion.
 *
 * @param {Object} params - Parameters for loading the model.
 * @param {string} params.model - Version identifier used to locate the model configuration file.
 * @param {number} params.batchSize - Batch size used for warming up the model.
 * @param {string} [params.backend] - Optional TensorFlow.js backend; defaults to the global backend if not provided.
 * @param {*} params.worker - Identifier of the worker to receive the "model-ready" message.
 */
function loadModel(params) {
  const version = params.model;
  if (DEBUG) {
    console.log("load request to worker");
  }
  const { height, width, labels, location } = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, `../../${version}_model_config.json`),
      "utf8"
    )
  );
  const appPath = "../../" + location + "/";
  const batch = params.batchSize;
  const backend = BACKEND || params.backend;
  backend === "webgpu" && require("@tensorflow/tfjs-backend-webgpu");
  if (DEBUG) {
    console.log(
      `model received load instruction. Using batch size ${batch}`
    );
  }
  tf.setBackend(backend).then(async () => {
    if (backend === "webgl") {
      tf.env().set("WEBGL_FORCE_F16_TEXTURES", true);
      tf.env().set("WEBGL_EXP_CONV", true);
      tf.env().set("TOPK_K_CPU_HANDOFF_THRESHOLD", 128);
      tf.env().set("TOPK_LAST_DIM_CPU_HANDOFF_SIZE_THRESHOLD", 128);
    } else if (backend === "webgpu") {
      tf.env().set("WEBGPU_DEFERRED_SUBMIT_BATCH_SIZE", 64); // Affects GPU RAM at expense of speed
      tf.env().set("WEBGPU_CPU_HANDOFF_SIZE_THRESHOLD", 1000); // MatMulPackedProgram
    }
    tf.enableProdMode();
    //tf.enableDebugMode();
    if (DEBUG) {
      console.log(tf.env());
      console.log(tf.env().getFlags());
    }
    myModel = new ChirpityModel(appPath, version);
    myModel.height = height;
    myModel.width = width;

    // Create a mask tensor where the specified indexes are set to 0 and others to 1
    const indexesToZero = [25, 30, 110, 319, 378, 403, 404, 405, 406];

    myModel.mask = tf.tensor2d(
      Array.from({ length: 408 }, (_, i) =>
        indexesToZero.includes(i) ? 0 : 1
      ),
      [1, 408]
    );
    myModel.labels = labels;
    await myModel.loadModel();
    myModel.warmUp(batch);
    BACKEND = tf.getBackend();
    postMessage({
      message: "model-ready",
      sampleRate: myModel.config.sampleRate,
      chunkLength: myModel.chunkLength,
      backend: tf.getBackend(),
      labels: labels,
      worker: params.worker,
    });
  });
}
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
        loadModel(e.data);
        break;
      }
      case "predict": {
        if (!myModel?.model_loaded) {
          return console.log(
            "worker",
            worker,
            "received a prediction request before it was ready"
          );
        }
        const {
          chunks,
          start,
          fileStart,
          file,
          snr,
          confidence,
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
        break;
      }
      case "get-spectrogram": {
        const buffer = e.data.buffer;
        if (buffer.length < myModel.chunkLength) {
          return;
        }
        const specFile = e.data.file;
        const filepath = e.data.filepath;
        const spec_height = e.data.height;
        const spec_width = e.data.width;
        let image;
        image = tf.tidy(() => {
          const signal = tf.tensor1d(buffer, "float32");
          const bufferTensor = myModel.normalise_audio(signal);
          const imageTensor = tf.tidy(() => {
            return myModel.makeSpectrogram(bufferTensor);
          });
          let spec = myModel.fixUpSpecBatch(
            tf.expandDims(imageTensor, 0),
            spec_height,
            spec_width
          );
          const spec_max = tf.max(spec);
          return spec.mul(255).div(spec_max).dataSync();
        });
        response = {
          message: "spectrogram",
          width: myModel.inputShape[2],
          height: myModel.inputShape[1],
          channels: myModel.inputShape[3],
          image: image,
          file: specFile,
          filepath: filepath,
          worker: worker,
        };
        postMessage(response);
        break;
      }
      case "terminate": {
        tf.backend().dispose();
        self.close(); // Terminate the worker
      }
    }
  } catch (error) {
    // If worker was respawned
    console.log(error);
  }
};

class ChirpityModel extends BaseModel {
  /**
   * Creates an instance of the ChirpityModel.
   * @param {string} appPath - The path to the application directory.
   * @param {string} version - The version of the model to be used.
   */
  constructor(appPath, version) {
    super(appPath, version);
  }


  getSNR(spectrograms) {
    return tf.tidy(() => {
      const { mean, variance } = tf.moments(spectrograms, 2);
      const peak = tf.div(variance, mean);
      let snr = tf.squeeze(tf.max(peak, 1));
      return snr;
    });
  }

  addContext(prediction, tensor, confidence) {
    // Create a set of images from the batch, offset by half the width of the original images
    const [_, height, width, channel] = tensor.shape;
    return tf.tidy(() => {
      const firstHalf = tensor.slice([0, 0, 0, 0], [-1, -1, width / 2, -1]);
      const secondHalf = tensor.slice(
        [0, 0, width / 2, 0],
        [-1, -1, width / 2, -1]
      );
      const paddedSecondHalf = tf.concat(
        [tf.zeros([1, height, width / 2, channel]), secondHalf],
        0
      );
      secondHalf.dispose();
      // prepend padding tensor
      const [droppedSecondHalf, _] = paddedSecondHalf.split([
        paddedSecondHalf.shape[0] - 1,
        1,
      ]); // pop last tensor
      paddedSecondHalf.dispose();
      const combined = tf.concat([droppedSecondHalf, firstHalf], 2); // concatenate adjacent pairs along the width dimension
      firstHalf.dispose();
      droppedSecondHalf.dispose();
      const rshiftPrediction = this.model.predict(combined, {
        batchSize: this.batchSize,
      });
      combined.dispose();
      // now we have predictions for both the original and rolled images
      const [padding, remainder] = tf.split(rshiftPrediction, [1, -1]);
      const lshiftPrediction = tf.concat([remainder, padding]);
      // Get the highest predictions from the overlapping images
      const surround = tf.maximum(rshiftPrediction, lshiftPrediction);
      lshiftPrediction.dispose();
      rshiftPrediction.dispose();
      // Mask out where these are below the threshold
      const indices = tf.greater(surround, confidence);
      return prediction.where(indices, 0);
    });
  }

  async predictBatch(TensorBatch, keys, threshold, confidence) {
    // const TensorBatch = this.fixUpSpecBatch(specs); // + 1 tensor
    // specs.dispose(); // - 1 tensor
    let paddedTensorBatch, maskedTensorBatch;
    if (
      BACKEND === "webgl" &&
      TensorBatch.shape[0] < this.batchSize &&
      !this.selection
    ) {
      // WebGL backend works best when all batches are the same size
      paddedTensorBatch = this.padBatch(TensorBatch); // + 1 tensor
    } else if (threshold && BACKEND === "tensorflow" && !this.selection) {
    // This whole block is for SNR and currently unused
      if (this.version !== "v1") threshold *= 4;
      const keysTensor = tf.stack(keys); // + 1 tensor
      const snr = this.getSNR(TensorBatch);
      const condition = tf.greaterEqual(snr, threshold); // + 1 tensor
      if (DEBUG) console.log("SNR is:", await snr.data());
      snr.dispose();
      // Avoid mask cannot be scalar error at end of predictions
      let newCondition;
      if (condition.rankType === "0") {
        newCondition = tf.expandDims(condition); // + 1 tensor
        condition.dispose(); // - 1 tensor
      }
      const c = newCondition || condition;
      let maskedKeysTensor;
      [maskedTensorBatch, maskedKeysTensor] = await Promise.all([
        tf.booleanMaskAsync(TensorBatch, c),
        tf.booleanMaskAsync(keysTensor, c),
      ]); // + 2 tensor
      c.dispose(); // - 1 tensor
      keysTensor.dispose(); // - 1 tensor

      if (!maskedTensorBatch.size) {
        maskedTensorBatch.dispose(); // - 1 tensor
        maskedKeysTensor.dispose(); // - 1 tensor
        TensorBatch.dispose(); // - 1 tensor
        if (DEBUG)
          console.log(
            "No surviving tensors in batch",
            maskedTensorBatch.shape[0]
          );
        return [];
      } else {
        keys = Array.from(await maskedKeysTensor.data());
        maskedKeysTensor.dispose(); // - 1 tensor
        if (DEBUG)
          console.log("surviving tensors in batch", maskedTensorBatch.shape[0]);
      }
    }

    const tb = paddedTensorBatch || maskedTensorBatch || TensorBatch;
    const rawPrediction = this.model.predict(tb, { batchSize: this.batchSize });

    // Zero prediction values for silence
    const zerosMask = tf.tidy(() => {
      // Get the max value for each tensor in the batch
      const maxValues = tb.max([1, 2]);
      // Create a mask where max value is zero (true for tensors with max > 0)
      return maxValues.notEqual(0);
    });
    // Set predictions to zero for the tensors where the max value was zero
    const prediction = tf.tidy(() => {
      return rawPrediction.mul(zerosMask);
    });
    // Dispose tensors after using them to avoid memory leaks
    zerosMask.dispose();
    rawPrediction.dispose();

    let newPrediction;
    if (this.selection) {
      newPrediction = tf.max(prediction, 0, true);
      prediction.dispose();
      keys = keys.splice(0, 1);
    } else if (this.useContext && this.batchSize > 1 && threshold === 0) {
      newPrediction = this.addContext(prediction, tb, confidence);
      prediction.dispose();
    }
    TensorBatch.dispose();
    if (paddedTensorBatch) paddedTensorBatch.dispose();
    if (maskedTensorBatch) maskedTensorBatch.dispose();

    const finalRawPrediction = newPrediction || prediction;
    const finalPrediction = finalRawPrediction.mul(this.mask);
    finalRawPrediction.dispose();
    const { indices, values } = tf.topk(finalPrediction, 5, true);

    const [topIndices, topValues] = await Promise.all([
      indices.array(),
      values.array(),
    ]).catch((err) => console.log("Data transfer error:", err));
    indices.dispose();
    values.dispose();
    finalPrediction.dispose();
    newPrediction && newPrediction.dispose();
    keys = keys.map((key) => (key / CONFIG.sampleRate).toFixed(3));
    return [keys, topIndices, topValues];
  }

  fixUpSpecBatch(specBatch, h, w) {
    const img_height = h || this.height;
    const img_width = w || this.width;
    return tf.tidy(() => {
      /*
            Try out taking log of spec when SNR is below threshold?
            */
      //specBatch = tf.log1p(specBatch).mul(20);
      // Swap axes to fit output shape
      specBatch = tf.transpose(specBatch, [0, 2, 1]);
      specBatch = tf.reverse(specBatch, [1]);
      // Add channel axis
      specBatch = tf.expandDims(specBatch, -1);
      //specBatch = tf.slice4d(specBatch, [0, 1, 0, 0], [-1, img_height, img_width, -1]);
      specBatch = tf.image.resizeBilinear(
        specBatch,
        [img_height, img_width],
        true
      );
      return this.normalise(specBatch);
    });
  }
  normalise_audio_batch = (tensor) => {
    return tf.tidy(() => {
      const sigMax = tf.max(tensor, 1, true);
      const sigMin = tf.min(tensor, 1, true);
      const normalized = tensor
        .sub(sigMin)
        .divNoNan(sigMax.sub(sigMin))
        .mul(tf.scalar(2))
        .sub(tf.scalar(1));
      return normalized;
    });
  };

  //Used by get-spectrogram
  normalise_audio = (signal) => {
    return tf.tidy(() => {
      //signal = tf.tensor1d(signal, 'float32');
      const sigMax = tf.max(signal);
      const sigMin = tf.min(signal);
      const range = sigMax.sub(sigMin);
      //return signal.sub(sigMin).div(range).mul(tf.scalar(8192.0, 'float32')).sub(tf.scalar(4095, 'float32'))
      return signal
        .sub(sigMin)
        .divNoNan(range)
        .mul(tf.scalar(2))
        .sub(tf.scalar(1));
    });
  };


  async predictChunk(
    audioBuffer,
    start,
    fileStart,
    file,
    threshold,
    confidence
  ) {
    if (DEBUG) console.log("predictCunk begin", tf.memory().numTensors);
    audioBuffer = this.padAudio(audioBuffer);
    audioBuffer = tf.tensor1d(audioBuffer);
    const numSamples = audioBuffer.shape / this.chunkLength;
    let buffers = tf.reshape(audioBuffer, [numSamples, this.chunkLength]);
    audioBuffer.dispose();
    const bufferList =  this.normalise_audio_batch(buffers);
    const specBatch = tf.tidy(() => {
      const bufferArray = tf.unstack(bufferList);
      const toStack = bufferArray.map((x) => {
        return this.makeSpectrogram(x);
      });
      return this.fixUpSpecBatch(tf.stack(toStack));
    });
    buffers.dispose();
    bufferList.dispose();
    //const specBatch = tf.stack(bufferList);
    const batchKeys = [...Array(numSamples).keys()].map(
      (i) => start + this.chunkLength * i
    );
    const result = await this.predictBatch(
      specBatch,
      batchKeys,
      threshold,
      confidence
    );
    return [result, file, fileStart];
  }
}
