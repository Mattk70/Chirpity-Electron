let tf;

try {
  tf = require("@tensorflow/tfjs-node");
} catch {
  tf = require("@tensorflow/tfjs");
}

const {stft, custom_stft} = require("./custom-ops.js");
const DEBUG = false;
class BaseModel {
  constructor(appPath, version) {
    this.model = undefined;
    this.labels = undefined;
    this.height = undefined;
    this.width = undefined;
    this.config = { sampleRate: 24_000, specLength: 3, sigmoid: 1 };
    this.chunkLength = this.config.sampleRate * this.config.specLength;
    this.model_loaded = false;
    this.frame_length = 512;
    this.frame_step = 186;
    this.appPath = appPath;
    this.useContext = undefined;
    this.version = version;
    this.selection = false;
    this.scalarFive = tf.scalar(5);
    this.two  = tf.scalar(2);
    this.one = tf.scalar(1);
  }

  async loadModel(type) {
    DEBUG && console.log("loading model");
    if (this.model_loaded === false) {
      // Model files must be in a different folder than the js, assets files
      DEBUG && console.log("loading model from", this.appPath + "model.json");
      const load = type === "layers" ? tf.loadLayersModel : tf.loadGraphModel;
      this.model = await load(this.appPath + "model.json", {
        weightPathPrefix: this.appPath,
      });
      this.model_loaded = true;
      this.inputShape = [...this.model.inputs[0].shape];
    }
  }

  async warmUp(batchSize) {
    this.batchSize = parseInt(batchSize);
    this.inputShape[0] = this.batchSize;
    DEBUG && console.log("WarmUp begin", tf.memory().numTensors);
    const input = tf.zeros(this.inputShape);

    // Parallel compilation for faster warmup
    // https://github.com/tensorflow/tfjs/pull/7755/files#diff-a70aa640d286e39c922aa79fc636e610cae6e3a50dd75b3960d0acbe543c3a49R316
    if (tf.getBackend() === "webgl") {
      // tf.env().set("ENGINE_COMPILE_ONLY", true);
      const compileRes = this.model.predict(input, {
        batchSize: this.batchSize,
      });
      // tf.env().set("ENGINE_COMPILE_ONLY", false);
      await tf.backend().checkCompileCompletionAsync();
      tf.backend().getUniformLocations();
      tf.dispose(compileRes);
      input.dispose();
    } else if (tf.getBackend() === "webgpu") {
      // tf.env().set("WEBGPU_ENGINE_COMPILE_ONLY", true);
      const compileRes = this.model.predict(input, {
        batchSize: this.batchSize,
      });
      await tf.backend().checkCompileCompletionAsync();
      tf.dispose(compileRes);
      tf.env().set("WEBGPU_ENGINE_COMPILE_ONLY", false);
    } else {
      // Tensorflow backend
      // const compileRes = this.model.predict(input);
      // tf.dispose(compileRes);
    }
    input.dispose();
    DEBUG && console.log("WarmUp end", tf.memory().numTensors);
    return true;
  }

  normalise = (spec) => spec.mul(255).div(spec.max([1, 2], true));

  
  normalise_audio_batch = (tensor) => {
  return tf.tidy(() => {
    const sigMax = tf.max(tensor, 1, true);
    const sigMin = tf.min(tensor, 1, true);
    const range = sigMax.sub(sigMin);

    const normalized = tensor
      .sub(sigMin)
      .divNoNan(range)
      .mul(this.two)
      .sub(this.one);
    return normalized;
  });
};

  padBatch(tensor) {
    return tf.tidy(() => {
      DEBUG &&
        console.log(
          `Adding ${this.batchSize - tensor.shape[0]} tensors to the batch`
        );
      const shape = [...tensor.shape];
      shape[0] = this.batchSize - shape[0];
      const padding = tf.zeros(shape);
      return tf.concat([tensor, padding], 0);
    });
  }

  async predictBatch(audio, keys) {
    const prediction = this.model.predict(audio, { batchSize: this.batchSize });
    audio.dispose();
    let newPrediction;
    if (this.selection) {
      newPrediction = tf.max(prediction, 0, true);
      prediction.dispose();
      keys = keys.splice(0, 1);
    }

    const finalPrediction = newPrediction || prediction;

    const { indices, values } = tf.topk(finalPrediction, 5, true);
    finalPrediction.dispose();
    // The GPU backend is *so* slow with BirdNET, let's not queue up predictions
    const [topIndices, topValues] = await Promise.all([
      indices.array(),
      values.array(),
    ]).catch((err) => console.log("Data transfer error:", err));
    indices.dispose();
    values.dispose();

    keys = keys.map((key) => (key / this.config.sampleRate).toFixed(3));
    return [keys, topIndices, topValues];
  }

  makeSpectrogram = (input) => {
    return this.backend !== "tensorflow" 
    ? tf.abs(custom_stft(input, this.frame_length, this.frame_step, this.frame_length, tf.signal.hannWindow))
    : tf.abs(tf.signal.stft(input, this.frame_length, this.frame_step))
  };


  fixUpSpecBatch(specBatch, h, w) {
    const img_height = h || this.height;
    const img_width = w || this.width;
    return tf.tidy(() => {
      // Preprocess tensor

      specBatch = specBatch
        .slice([0, 0, 0], [-1, img_width, img_height])
        .transpose([0, 2, 1])
        .reverse([1]);

      // Split into main part and bottom rows
      const [mainPart, bottomRows] = tf.split(
        specBatch,
        [img_height - 10, 10],
        1
      );

      // Concatenate after adjusting bottom rows
      return this.normalise(
        tf.concat([mainPart, bottomRows.div(this.scalarFive)], 1)
      ).expandDims(-1);
    });
  }

  padAudio = (audio) => {
    const remainder = audio.length % this.chunkLength;
    if (remainder) {
      // Create a new array with the desired length
      const paddedAudio = new Float32Array(
        audio.length + (this.chunkLength - remainder)
      );
      // Copy the existing values into the new array
      paddedAudio.set(audio);
      return paddedAudio;
    } else return audio;
  };

  createAudioTensorBatch = (audio) => {
    return tf.tidy(() => {
      audio = this.padAudio(audio);
      const numSamples = audio.length / this.chunkLength;
      audio = tf.tensor1d(audio);
      return [tf.reshape(audio, [numSamples, this.chunkLength]), numSamples];
    });
  };

  getKeys = (numSamples, start) =>
    [...Array(numSamples).keys()].map((i) => start + this.chunkLength * i);
}
export { BaseModel, stft };
