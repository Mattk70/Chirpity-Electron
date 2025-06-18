let tf, BACKEND, myModel, DEBUG = false;
try {
  tf = require("@tensorflow/tfjs-node");
} catch {
  tf = require("@tensorflow/tfjs");
  BACKEND = "webgpu";
}
const fs = require("node:fs");
const path = require("node:path");
import { BaseModel } from "./BaseModel.js";
const {stft} = require("./custom-ops.js");
const abortController = require('../utils/abortController.js');


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
        
        // const appPath = "/Users/matthew/Documents/CustomClassifier/";
        const batch = e.data.batchSize;
        const backend = BACKEND || e.data.backend;
        BACKEND = backend;
        DEBUG && console.log(`Using backend: ${backend}`);
        backend === "webgpu" && require("@tensorflow/tfjs-backend-webgpu");
        let labels;
        if (isBirdNET) {
          const labelFile = `../../labels/V2.4/BirdNET_GLOBAL_6K_V2.4_Labels_en.txt`;
          // const labelFile = path.join(appPath, 'labels.txt')
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
          }
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
          isBirdNET && (myModel.labels = labels);
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
        const {trainModel} = require('./training.js');
        const args = e.data;
          trainModel({ ...args, Model: myModel}).then((history) => {
            postMessage({
              message: "training-results", 
              notice: "Training completed successfully! Model saved in:<br>" + args.modelLocation,
              complete: true,
              autohide: false,
              history
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
        abortController.abort();
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
