let tf;

try {
  tf = require("@tensorflow/tfjs-node");
} catch {
  tf = require("@tensorflow/tfjs");
}

// Import override for tf.signal.stft
require("./fft.js");

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
    this.scaleFactor = this.version.includes('bats') ? 10 : 1;
    this.selection = false;
    this.scalarFive = tf.scalar(5);
    this.two  = tf.scalar(2);
    this.one = tf.scalar(1);
    this.topN = 5;
    this.backend = tf.getBackend();
    this.embeddingsDIM = undefined;
  }

  async loadModel(type) {
    DEBUG && console.log("loading model");
    if (this.model_loaded === false) {
      // Model files must be in a different folder than the js, assets files
      DEBUG && console.log("loading model from", this.appPath + "/model.json");
      const load = type === "layers" ? tf.loadLayersModel : tf.loadGraphModel;
      this.model = await load(this.appPath + "/model.json", {
        weightPathPrefix: this.appPath + '/',
      });
      if (type === 'layers'){
        // Set up BirdNET embedding model
        const baseModel = this.model;
        const predictions = baseModel.outputs[0];
        const embeddings = baseModel.getLayer('GLOBAL_AVG_POOL').output;
        const combinedModel = tf.model({
          inputs: baseModel.inputs,
          outputs: [predictions, embeddings],
        });
        this.model = combinedModel;
      }
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
    if (tf.getBackend() === "webgpu") {
      // tf.env().set("WEBGPU_ENGINE_COMPILE_ONLY", true); <- this is literally 40% slower for some reason
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

  normalise = (spec) => spec.mul(255).divNoNan(spec.max([1, 2], true));

  l2Normalise(embeddings) {
    return tf.tidy(() => {
      const norms = embeddings.norm('euclidean', 1, true);
      return embeddings.divNoNan(norms);
    });
  }
  normalise_audio_batch = (tensor) => {
  return tf.tidy(() => {
    const sigMax = tf.max(tensor, -1, true);
    const sigMin = tf.min(tensor, -1, true);
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
  const { topIndices, topValues, embeddingsValues } = tf.tidy(() => {
    const [prediction, embeddings] =
      this.model.predict(audio, { batchSize: this.batchSize });
    let output = prediction;
    if (this.selection) {
      output = tf.max(output, 0, true);
    }
    if (this.bgMask) {
      output = output.mul(this.bgMask);
    }
    const topN = Math.min(output.shape[1], 5);
    const { indices, values } = tf.topk(output, topN, true);
    const normEmbeddings = this.l2Normalise(embeddings);
    return {
      topIndices: indices,
      topValues: values,
      embeddingsValues: normEmbeddings
    };
  });

  audio.dispose();
  const embeddingDim = embeddingsValues.shape[1];
  this.embeddingsDIM = embeddingDim;
  const [indicesData, valuesData, embeddingsData] = await Promise.all([
    topIndices.data(),
    topValues.data(),
    embeddingsValues.data()
  ]);
  topIndices.dispose();
  topValues.dispose();
  embeddingsValues.dispose();
  // Fix keys trimming
  if (this.selection) {
    keys = keys.slice(0, 1);
  }

  keys = keys.map(
    key => Math.round((key / (this.config.sampleRate * this.scaleFactor)) * 10000) / 10000
  );
  const adjustedBatchSize = keys.length;
  const topN = this.topN;
  // Reshape manually without expensive array()
  const reshapedIndices = [];
  const reshapedValues = [];
  const reshapedEmbeddings = [];
  for (let i = 0; i < adjustedBatchSize; i++) {
    reshapedIndices.push(
      indicesData.slice(i * topN, (i + 1) * topN)
    );
    reshapedValues.push(
      valuesData.slice(i * topN, (i + 1) * topN)
    );
    reshapedEmbeddings.push(
      embeddingsData.slice(
        i * this.embeddingsDIM,
        (i + 1) * this.embeddingsDIM
      )
    );
  }
  return [keys, reshapedIndices, reshapedValues, reshapedEmbeddings];
}

  makeSpectrogram = (input) => {
    return this.backend === "tensorflow" 
    ? tf.abs(tf.signal.stft(input, this.frame_length, this.frame_step))
    : tf.abs(tf.signal.stft(input, this.frame_length, this.frame_step, this.frame_length, tf.signal.hannWindow))
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
    const samples = this.backend === 'webgpu' ? this.chunkLength * this.batchSize : this.chunkLength;
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

  createAudioTensorBatch = (audio) => {
    return tf.tidy(() => {
      audio = this.padAudio(audio);
      const numSamples = audio.length / this.chunkLength;
      audio = tf.tensor1d(audio);
      return tf.reshape(audio, [numSamples, this.chunkLength]);
    });
  };

  getKeys = (numSamples, start) =>
    [...Array(numSamples).keys()].map((i) => start + this.chunkLength * i);
}
export { BaseModel };
