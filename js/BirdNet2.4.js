let tf, BACKEND;
try {
  tf = require("@tensorflow/tfjs-node");
} catch {
  tf = require("@tensorflow/tfjs");
  BACKEND = "webgpu";
}
const fs = require("node:fs");
const path = require("node:path");
let DEBUG = false;

import { BaseModel } from "./BaseModel.js";

//GLOBALS
let myModel;

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
            path.join(__dirname, `../${version}_model_config.json`),
            "utf8"
          )
        );
        const appPath = "../" + location + "/";
        const list = e.data.list;
        const batch = e.data.batchSize;
        const backend = BACKEND || e.data.backend;
        backend === "webgpu" && require("@tensorflow/tfjs-backend-webgpu");
        let labels;
        const labelFile = `../labels/V2.4/BirdNET_GLOBAL_6K_V2.4_Labels_en.txt`;
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
            `model received load instruction. Using list: ${list}, batch size ${batch}`
          );

        tf.setBackend(backend).then(async () => {
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
            labels: labels,
            worker: worker,
          });
        });
        break;
      }
      case "get-spectrogram": {
        const buffer = e.data.buffer;
        if (buffer.length < myModel.chunkLength / 2) {
          DEBUG && console.log("Short spec, bailing");
          return;
        }
        const specFile = e.data.file;
        const filepath = e.data.filepath;
        const spec_height = e.data.height;
        const spec_width = e.data.width;
        let image;
        image = tf.tidy(() => {
          const signal = tf.tensor1d(buffer, "float32");
          // const bufferTensor = myModel.normalise_audio(signal);
          const imageTensor = tf.tidy(() => {
            return myModel.makeSpectrogram(signal);
          });
          let spec = myModel.fixUpSpecBatch(
            tf.expandDims(imageTensor, 0),
            spec_height,
            spec_width
          );
          return spec.dataSync();
        });

        response = {
          message: "spectrogram",
          width: 384, //myModel.inputShape[2],
          height: 256, //myModel.inputShape[1],
          channels: 1, //myModel.inputShape[3],
          image: image,
          file: specFile,
          filepath: filepath,
          worker: worker,
        };
        postMessage(response);
        DEBUG && console.log("Made a spectrogram", tf.memory().numTensors);
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

  // Define the layer's forward pass
  call(inputs) {
    return tf.tidy(() => {
      // inputs is a tensor representing the input data
      inputs = inputs[0];
      return tf.stack(
        inputs.split(inputs.shape[0]).map((input) => {
          input = input.squeeze();
          // Normalize values between -1 and 1
          input = tf.sub(input, tf.min(input, -1, true));
          input = tf.div(input, tf.max(input, -1, true).add(0.000001));
          input = tf.sub(input, 0.5);
          input = tf.mul(input, 2.0);

          // Perform STFT and cast result to float
          let spec = tf.signal
            .stft(
              input,
              this.frameLength,
              this.frameStep,
              this.frameLength,
              tf.signal.hannWindow
            )
            .cast("float32");

          // Apply mel filter bank
          spec = spec
            .matMul(this.melFilterbank)

            // Convert to power spectrogram
            .pow(2.0)

            // Apply nonlinearity
            .pow(tf.div(1.0, tf.add(1.0, tf.exp(this.magScale.read()))))

            // Flip the spectrogram
            .reverse(-1)

            // Swap axes to fit input shape
            .transpose()

            // Adding the channel dimension
            .expandDims(-1);

          return spec;
        })
      );
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
function logmeanexp(x, axis, keepdims, sharpness) {
  return tf.add(
    tf.div(
      tf.log(
        tf.mean(
          tf.exp(x.mul(sharpness, x.sub(tf.max(x, axis, true)))),
          axis,
          keepdims
        )
      ),
      sharpness
    ),
    tf.max(x, axis, keepdims)
  );
}
class GlobalLogExpPooling2D extends tf.layers.Layer {
  constructor(config) {
    super(config);
  }

  build(inputShape) {
    this.sharpness = this.addWeight(
      "sharpness",
      [1],
      "float32",
      tf.initializers.constant({ value: 2 })
    );
  }

  computeOutputShape(inputShape) {
    return [inputShape[0], inputShape[3]];
  }

  call(input, kwargs) {
    return logmeanexp(input[0], [1, 2], false, this.sharpness.read()); //.read().dataSync()[0]);
  }

  static get className() {
    return "GlobalLogExpPooling2D";
  }
}

tf.serialization.registerClass(GlobalLogExpPooling2D);

/////////////////////////  Build Sigmoid Layer  /////////////////////////
class SigmoidLayer extends tf.layers.Layer {
  constructor(config) {
    super(config);
    this.config = config;
  }

  build(inputShape) {
    this.kernel = this.addWeight(
      "scale_factor",
      [1],
      "float32",
      tf.initializers.constant({ value: 1 })
    );
  }

  computeOutputShape(inputShape) {
    return inputShape;
  }

  call(input, kwargs) {
    // Since sigmoid is always 1, we simplify here
    //return tf.sigmoid(tf.mul(input[0], CONFIG.sigmoid))
    return tf.sigmoid(input[0]);
  }

  static get className() {
    return "SigmoidLayer";
  }
}

tf.serialization.registerClass(SigmoidLayer);
