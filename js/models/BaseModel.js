let tf;

try {
  tf = require("@tensorflow/tfjs-node");
} catch {
  tf = require("@tensorflow/tfjs");
}

/*
Credit for these functions goes to https://github.com/georg95/birdnet-web.
*/
function arrayProduct(arr) {
    let product = 1;
  for (let i = 0; i < arr.length; i++) {
    product *= arr[i];
  }
    return product;
}
function flatDispatchLayout(shape) {
  return { x: shape.map((d, i) => i) };
}
function computeDispatch(
  layout,
  outputShape,
  workgroupSize = [1, 1, 1],
  elementsPerThread = [1, 1, 1]
) {
  return [
    Math.ceil(
      arrayProduct(layout.x.map((d) => outputShape[d])) /
        (workgroupSize[0] * elementsPerThread[0])
    ),
    layout.y
      ? Math.ceil(
          arrayProduct(layout.y.map((d) => outputShape[d])) /
            (workgroupSize[1] * elementsPerThread[1])
        )
      : 1,
    layout.z
      ? Math.ceil(
          arrayProduct(layout.z.map((d) => outputShape[d])) /
            (workgroupSize[2] * elementsPerThread[2])
        )
      : 1,
  ];
}


function bitReverse(num, bits) {
  let reversed = 0;
  for (let i = 0; i < bits; i++) {
    if (num & (1 << i)) {
        reversed |= 1 << (bits - 1 - i);
    }
    }
    return reversed;
}

tf.registerKernel({
  kernelName: "FFT2",
  backendName: "webgl",
  kernelFunc: ({ backend, inputs: { input } }) => {
    const innerDim = input.shape[input.shape.length - 1];
    const batch = tf.util.sizeFromShape(input.shape) / innerDim;
    const reorderMap = Array.from({ length: innerDim }, (_, i) =>
      bitReverse(i, Math.log2(innerDim))
    );
    let currentTensor = backend.runWebGLProgram(
      {
        variableNames: ["mapvalue"],
            outputShape: [batch, innerDim * 2],
            userCode: `
              int reorderMap[${innerDim}] = int[](${reorderMap.join(", ")});
              void main() {
                ivec2 coords = getOutputCoords();
                int batch = coords[0];
                int k = reorderMap[coords[1] % ${innerDim}];
                float result = coords[1] < ${innerDim} ? getMapvalue(batch, k) : 0.0;
                setOutput(result);
              }`,
      },
      [input],
      "float32"
    );
    for (let len = 1; len < innerDim; len *= 2) {
      let prevTensor = currentTensor;
      currentTensor = backend.runWebGLProgram(
        {
                variableNames: [`value_${len}`],
          outputShape: [batch, len * 2 >= innerDim ? innerDim : innerDim * 2],
                userCode: `void main() {
                            ivec2 coords = getOutputCoords();
                            int batch = coords[0];
                            int i = coords[1];
                            int k = i % ${innerDim};
                            int isHigh = (k % ${len * 2}) / ${len};
                            int isImag = i / ${innerDim};
                            int isReal = 1 - isImag;
                            int highSign = (1 - isHigh * 2);
                            int baseIndex = k - isHigh * ${len};
                            float t = ${Math.PI / len} * float(k % ${len});
                            float a = cos(t);
                            float b = sin(-t);
                            float evenK_re = getValue_${len}(batch, baseIndex);
                            float oddK_re = getValue_${len}(batch, baseIndex + ${len});
                            float evenK_im = getValue_${len}(batch, baseIndex + ${innerDim});
                            float oddK_im = getValue_${len}(batch, baseIndex + ${len + innerDim});
                            float outp = (evenK_im + (oddK_re * b + oddK_im * a) * float(highSign)) * float(isImag)
                            + (evenK_re + (oddK_re * a - oddK_im * b) * float(highSign)) * float(isReal);
                            setOutput(outp);
                            }`,
        },
        [currentTensor],
        "float32"
      );
      backend.disposeIntermediateTensorInfo(prevTensor);
    }
    return currentTensor;
  },
});
tf.registerKernel({
  kernelName: "FFT2",
  backendName: "webgpu",
    kernelFunc: ({ backend, inputs: { input } }) => {
    const innerDim = input.shape[input.shape.length - 1] / 2;
    const batch = tf.util.sizeFromShape(input.shape) / innerDim / 2;
    const workgroupSize = [64, 1, 1];
    const dispatchLayout = flatDispatchLayout([batch, innerDim * 2]);
    const dispatch = computeDispatch(
      dispatchLayout,
      [batch, innerDim * 2],
      workgroupSize,
      [2, 1, 1]
    );
    let currentTensor = backend.runWebGPUProgram(
      {
        variableNames: ["X"],
        outputShape: [batch, innerDim * 2],
        workgroupSize,
        shaderKey: `fft_permut_${innerDim}`,
        dispatchLayout,
        dispatch,
        getUserCode: () => `
          fn main(index: i32) {
          let batch = index / ${innerDim};
          let p = index % ${innerDim};
          let outIndexReal = batch * ${innerDim * 2} + p;
          let outIndexImag = outIndexReal + ${innerDim};
          var k = 0;
          for (var i: u32 = 0; i < ${Math.log2(innerDim)}; i = i + 1) {
              if ((p & (1 << i)) != 0) { k |= (1 << (${
                Math.log2(innerDim) - 1
              } - i)); }
          }
          setOutputAtIndex(outIndexReal, getX(batch, 2 * k));
          setOutputAtIndex(outIndexImag, getX(batch, 2 * (k % ${innerDim}) + 1));
          }`,
      },
      [input],
      "float32"
    );
        for (let len = 1; len < innerDim; len *= 2) {
      let prevTensor = currentTensor;
      currentTensor = backend.runWebGPUProgram(
        {
          variableNames: [`value`],
          outputShape: [batch, innerDim * 2],
          workgroupSize,
          shaderKey: `fft_step_${innerDim}_${len}`,
          dispatchLayout,
          dispatch,
          getUserCode: () => `fn main(index: i32) {
              let batch = index / ${innerDim};
              let i = index % ${innerDim};
              let outIndexReal = batch * ${innerDim * 2} + i;
              let outIndexImag = outIndexReal + ${innerDim};
              let k = i % ${innerDim};
              let isHigh = (k % (${len} * 2)) / ${len};
              let highSign = (1 - isHigh * 2);
              let baseIndex = k - isHigh * ${len};
              let t = ${Math.PI} / f32(${len}) * f32(k % ${len});
              let a = cos(t);
              let b = sin(-t);
              let oddK_re = getValue(batch, baseIndex + ${len});
              let oddK_im = getValue(batch, baseIndex + ${len + innerDim});

              let evenK_re = getValue(batch, baseIndex);
              let outpR = (evenK_re + (oddK_re * a - oddK_im * b) * f32(highSign));
              setOutputAtIndex(outIndexReal, outpR);
              let evenK_im = getValue(batch, baseIndex + ${innerDim});
              let outpI = (evenK_im + (oddK_re * b + oddK_im * a) * f32(highSign));
              setOutputAtIndex(outIndexImag, outpI);
              }`,
        },
        [currentTensor],
        "float32"
      );
      backend.disposeData(prevTensor.dataId);
    }
    let prevTensor = currentTensor;
    currentTensor = backend.runWebGPUProgram(
      {
        variableNames: ["x"],
        outputShape: [batch, innerDim * 2],
        workgroupSize,
        shaderKey: `fft_post_${innerDim}`,
        dispatchLayout,
        dispatch: computeDispatch(
          flatDispatchLayout([batch, innerDim * 2]),
          [batch, innerDim * 2],
          workgroupSize,
          [1, 1, 1]
        ),
        getUserCode: () => `
          fn main(index: i32) {
              let coords = getOutputCoords();
              let i = coords[1];
              let batch = coords[0];
              var k = i;
              if (i > ${innerDim}) {
                k = ${innerDim * 2} - i;
              }
              let zI = k % ${innerDim};
              let conjI = (${innerDim} - k) % ${innerDim};
              let Zk0 = getX(batch, zI);
              let Zk_conj0 = getX(batch, conjI);
              let t = ${-2 * Math.PI} * f32(k) / f32(${innerDim * 2});
              let result = (Zk0 + Zk_conj0 + cos(t) * (getX(batch, zI+${innerDim}) + getX(batch, conjI+${innerDim})) + sin(t) * (Zk0 - Zk_conj0)) * 0.5;
              setOutputAtIndex(index, result);
          }`,
      },
      [currentTensor],
      "float32"
    );
    backend.disposeData(prevTensor.dataId);
    return currentTensor;
  },
});

tf.registerKernel({
  kernelName: "FRAME",
  backendName: "webgpu",
    kernelFunc: ({ backend, inputs: { input, frameLength, frameStep } }) => {
    const workgroupSize = [64, 1, 1];
    const outputLength =
      ((input.size - frameLength + frameStep) / frameStep) | 0;
    const dispatchLayout = flatDispatchLayout([outputLength, frameLength]);
    return backend.runWebGPUProgram(
      {
        variableNames: ["x"],
        outputShape: [outputLength, frameLength],
        workgroupSize,
        shaderKey: `frame_${frameLength}_${frameStep}`,
        dispatchLayout,
        dispatch: computeDispatch(
          dispatchLayout,
          [outputLength, frameLength],
          workgroupSize
        ),
        getUserCode: () => `
          fn main(i: i32) {
              setOutputAtIndex(i, getX((i / ${frameLength}) * ${frameStep} + i % ${frameLength}));
          }`,
      },
      [input],
      "float32"
    );
  },
});

tf.registerKernel({
  kernelName: "FRAME",
  backendName: "webgl",
    kernelFunc: ({ backend, inputs: { input, frameLength, frameStep } }) => {
    const outputLength =
      ((input.size - frameLength + frameStep) / frameStep) | 0;
        
    return backend.runWebGLProgram(
      {
        variableNames: ["x"],
        outputShape: [outputLength, frameLength],
        userCode: `
          void main() {
            ivec2 coords = getOutputCoords();
            int j = coords[1];
            int b = coords[0];
            int i = b * ${frameLength} + j;
            setOutput(getX((i / ${frameLength}) * ${frameStep} + i % ${frameLength}));
          }`,
      },
      [input],
      "float32"
    );
  },
});

function stft(
  signal,
  frameLength,
  frameStep,
  fftLength = frameLength,
  windowFn = tf.signal.hannWindow
) {
  const framedSignal = tf
    .engine()
    .runKernel("FRAME", { input: signal, frameLength, frameStep });
  const input = tf.mul(framedSignal, windowFn(frameLength));
  let innerDim = input.shape[input.shape.length - 1];
  const batch = input.size / innerDim;
  const realValues = tf
    .engine()
    .runKernel("FFT2", { input: tf.reshape(input, [batch, innerDim]) });
  const half = Math.floor(innerDim / 2) + 1;
  const realComplexConjugate = tf.split(
    realValues,
    [half, innerDim - half],
    realValues.shape.length - 1
  );
  const outputShape = input.shape.slice();
  outputShape[input.shape.length - 1] = half;
  return tf.reshape(realComplexConjugate[0], outputShape);
}

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
      tf.env().set("WEBGPU_ENGINE_COMPILE_ONLY", true);
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

  // makeSpectrogram = (input) => {
  //   return this.backend === "webgpu" 
  //   ? tf.abs(stft(input, this.frame_length, this.frame_step))
  //   : tf.abs(tf.signal.stft(input, this.frame_length, this.frame_step))
  // };

  makeSpectrogram = (input) => tf.abs(tf.signal.stft(input, this.frame_length, this.frame_step))


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
