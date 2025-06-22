const { flatDispatchLayout, computeDispatch, tf } = require("./custom-ops.js");

function fftWebGPU({ backend, inputs: { input } }, inverse) {
  const innerDim = input.shape[input.shape.length - 1];
  const batch = tf.util.sizeFromShape(input.shape) / innerDim;
  const { real: realIn, imag: imagIn } = backend.tensorMap.get(
    input.dataId
  ).complexTensorInfos;
  let currentTensor = backend.runWebGPUProgram(
    new BitReverseGPU(batch, innerDim, true),
    [realIn, imagIn],
    "float32"
  );
  for (let len = 1; len * 2 < innerDim; len *= 2) {
    let prevTensor = currentTensor;
    currentTensor = backend.runWebGPUProgram(
      new CooleyTukeyStepGPU(batch, innerDim, len, "complex", inverse),
      [currentTensor],
      "float32"
    );
    backend.disposeData(prevTensor.dataId);
  }
  const real = backend.runWebGPUProgram(
    new CooleyTukeyStepGPU(batch, innerDim, innerDim / 2, "real", inverse),
    [currentTensor],
    "float32"
  );
  const imag = backend.runWebGPUProgram(
    new CooleyTukeyStepGPU(batch, innerDim, innerDim / 2, "imag", inverse),
    [currentTensor],
    "float32"
  );
  const complex = tf.engine().runKernel("Complex", { real, imag });
  backend.disposeData(currentTensor.dataId);
  backend.disposeData(real.dataId);
  backend.disposeData(imag.dataId);
  return complex;
}

const slowGpuFFTKernel = tf.getKernel("FFT", "webgpu").kernelFunc;
tf.unregisterKernel("FFT", "webgpu");
tf.registerKernel({
  kernelName: "FFT",
  backendName: "webgpu",
  kernelFunc: (arg) => {
    const innerDim = arg.inputs.input.shape[arg.inputs.input.shape.length - 1];
    if ((innerDim & (innerDim - 1)) !== 0) {
      console.warn(
        "Using slow FFT implementation, because tensor size is not power of 2"
      );
      return slowGpuFFTKernel(arg);
    }
    return fftWebGPU(arg, false);
  },
});

const slowGpuIFFTKernel = tf.getKernel("IFFT", "webgpu").kernelFunc;
tf.unregisterKernel("IFFT", "webgpu");
tf.registerKernel({
  kernelName: "IFFT",
  backendName: "webgpu",
  kernelFunc: (arg) => {
    const innerDim = arg.inputs.input.shape[arg.inputs.input.shape.length - 1];
    if ((innerDim & (innerDim - 1)) !== 0) {
      console.warn(
        "Using slow IFFT implementation, because tensor size is not power of 2"
      );
      return slowGpuIFFTKernel(arg);
    }
    return fftWebGPU(arg, true);
  },
});

class BitReverseGPU {
  workgroupSize = [64, 1, 1];
  constructor(batch, innerDim, readComplex = false) {
    this.variableNames = readComplex ? ["real", "imag"] : ["x"];
    this.innerDim = innerDim;
    this.readComplex = readComplex;
    this.outputShape = [batch, innerDim * 2];
    this.shaderKey = `fft_permut_${innerDim}_${readComplex}`;
    this.dispatchLayout = flatDispatchLayout(this.outputShape);
    this.dispatch = computeDispatch(
      this.dispatchLayout,
      this.outputShape,
      this.workgroupSize
    );
  }
  getUserCode() {
    const { innerDim, readComplex } = this;
    return `
            fn main(index: i32) {
                let batch = index / ${innerDim};
                let p = index % ${innerDim};
                var k = 0;
                for (var i: u32 = 0; i < ${Math.log2(innerDim)}; i = i + 1) {
                    if ((p & (1 << i)) != 0) { k |= (1 << (${
                      Math.log2(innerDim) - 1
                    } - i)); }
                }
                let iReal = batch * ${innerDim * 2} + p;
                let iImag = iReal + ${innerDim};
                ${
                  readComplex
                    ? `setOutputAtIndex(iReal, getReal(batch, k));
                     setOutputAtIndex(iImag, getImag(batch, k));`
                    : `setOutputAtIndex(iReal, getX(batch, 2 * k));
                     setOutputAtIndex(iImag, getX(batch, 2 * (k % ${innerDim}) + 1));`
                }
                
            }`;
  }
}

class CooleyTukeyStepGPU {
  variableNames = ["x"];
  workgroupSize = [64, 1, 1];
  constructor(batch, innerDim, len, output = "complex", inverse = false) {
    this.output = output;
    this.innerDim = innerDim;
    this.len = len;
    this.inverse = inverse;
    this.outputShape = [batch, output === "complex" ? innerDim * 2 : innerDim];
    this.shaderKey = `fft_step_${innerDim}_${len}_${output}_${inverse}`;
    this.dispatchLayout = flatDispatchLayout(this.outputShape);
    this.dispatch = computeDispatch(
      this.dispatchLayout,
      this.outputShape,
      this.workgroupSize,
      [output === "complex" ? 2 : 1, 1, 1]
    );
  }
  getUserCode() {
    const { innerDim, output, len, inverse } = this;
    return `fn main(index: i32) {
            let batch = index / ${innerDim};
            var i = index % ${innerDim};
            let outIndexReal = ${
              output === "real" ? `index` : `batch * ${innerDim * 2} + i`
            };
            let outIndexImag = ${
              output === "imag" ? `index` : `outIndexReal + ${innerDim}`
            };
            let isHigh = (i % (${len} * 2)) / ${len};
            let highSign = (1 - isHigh * 2);
            let baseIndex = i - isHigh * ${len};
            let t = ${
              inverse ? -Math.PI / len : Math.PI / len
            } * f32(i % ${len});
            let a = cos(t);
            let b = sin(-t);
            let oddK_re = getX(batch, baseIndex + ${len});
            let oddK_im = getX(batch, baseIndex + ${len} + ${innerDim});

            ${
              output !== "imag"
                ? `
                let evenK_re = getX(batch, baseIndex);
                let outpR = (evenK_re + (oddK_re * a - oddK_im * b) * f32(highSign));
                setOutputAtIndex(outIndexReal, ${
                  inverse && output === "real"
                    ? `outpR / f32(${innerDim})`
                    : "outpR"
                });
                `
                : ""
            }
            ${
              output !== "real"
                ? `
                let evenK_im = getX(batch, baseIndex + ${innerDim});
                let outpI = (evenK_im + (oddK_re * b + oddK_im * a) * f32(highSign));
                setOutputAtIndex(outIndexImag, ${
                  inverse && output === "imag"
                    ? `outpI / f32(${innerDim})`
                    : "outpI"
                });
                `
                : ""
            }
        }`;
  }
}

class RfftReassembleGPU {
  variableNames = ["x"];
  workgroupSize = [64, 1, 1];
  constructor(batch, innerDim, part) {
    this.innerDim = innerDim;
    this.part = part;
    this.outputShape = [batch, innerDim + 1];
    this.shaderKey = `rfft_reassemble_${innerDim}_${part}`;
    this.dispatchLayout = flatDispatchLayout(this.outputShape);
    this.dispatch = computeDispatch(
      this.dispatchLayout,
      this.outputShape,
      this.workgroupSize
    );
  }
  getUserCode() {
    const { innerDim, part } = this;
    return `fn main(index: i32) {
            let batch = index / ${innerDim + 1};
            let i = index % ${innerDim + 1};
            let k = i;
            let zI = k % ${innerDim};
            let conjI = (${innerDim} - k) % ${innerDim};
            let Zk0 = getX(batch, zI);
            let Zk1 = getX(batch, zI+${innerDim});
            let Zk_conj0 = getX(batch, conjI);
            let Zk_conj1 = -getX(batch, conjI+${innerDim});
            let t = ${-2 * Math.PI} * f32(k) / f32(${innerDim * 2});
            let diff0 = Zk0 - Zk_conj0;
            let diff1 = Zk1 - Zk_conj1;
            ${
              part === "real"
                ? `let result = (Zk0 + Zk_conj0 + cos(t) * diff1 + sin(t) * diff0) * 0.5;`
                : `let result = (Zk1 + Zk_conj1 - cos(t) * diff0 + sin(t) * diff1) * 0.5;`
            }
            setOutputAtIndex(index, result);
        }`;
  }
}

tf.registerKernel({
  kernelName: "RFFT",
  backendName: "webgpu",
  kernelFunc: ({ backend, inputs: { input } }) => {
    const innerDim = input.shape[input.shape.length - 1] / 2;
    const batch = tf.util.sizeFromShape(input.shape) / innerDim / 2;
    let currentTensor = backend.runWebGPUProgram(
      new BitReverseGPU(batch, innerDim),
      [input],
      "float32"
    );
    for (let len = 1; len < innerDim; len *= 2) {
      let prevTensor = currentTensor;
      currentTensor = backend.runWebGPUProgram(
        new CooleyTukeyStepGPU(batch, innerDim, len),
        [currentTensor],
        "float32"
      );
      backend.disposeData(prevTensor.dataId);
    }
    const real = backend.runWebGPUProgram(
      new RfftReassembleGPU(batch, innerDim, "real"),
      [currentTensor],
      "float32"
    );
    const imag = backend.runWebGPUProgram(
      new RfftReassembleGPU(batch, innerDim, "imag"),
      [currentTensor],
      "float32"
    );
    const complex = tf.engine().runKernel("Complex", { real, imag });
    backend.disposeData(currentTensor.dataId);
    backend.disposeData(real.dataId);
    backend.disposeData(imag.dataId);
    return complex;
  },
});

// ---------------------------------------- WEBGL

function fftWebGL({ backend, inputs: { input } }, inverse) {
  const innerDim = input.shape[input.shape.length - 1];
  const batch = tf.util.sizeFromShape(input.shape) / innerDim;
  const { real: realIn, imag: imagIn } = backend.texData.get(
    input.dataId
  ).complexTensorInfos;
  let currentTensor = backend.runWebGLProgram(
    new BitReverse(batch, innerDim, true),
    [realIn, imagIn],
    "float32"
  );
  for (let len = 1; len * 2 < innerDim; len *= 2) {
    let prevTensor = currentTensor;
    currentTensor = backend.runWebGLProgram(
      new CooleyTukeyStep(batch, innerDim, len, "complex", inverse),
      [currentTensor],
      "float32"
    );
    backend.disposeIntermediateTensorInfo(prevTensor);
  }
  const real = backend.runWebGLProgram(
    new CooleyTukeyStep(batch, innerDim, innerDim / 2, "real", inverse),
    [currentTensor],
    "float32"
  );
  const imag = backend.runWebGLProgram(
    new CooleyTukeyStep(batch, innerDim, innerDim / 2, "imag", inverse),
    [currentTensor],
    "float32"
  );
  const complex = tf.engine().runKernel("Complex", { real, imag });
  backend.disposeIntermediateTensorInfo(currentTensor);
  backend.disposeIntermediateTensorInfo(real);
  backend.disposeIntermediateTensorInfo(imag);
  return complex;
}

const slowFFTKernel = tf.getKernel("FFT", "webgl").kernelFunc;
tf.unregisterKernel("FFT", "webgl");
tf.registerKernel({
  kernelName: "FFT",
  backendName: "webgl",
  kernelFunc: (arg) => {
    const innerDim = arg.inputs.input.shape[arg.inputs.input.shape.length - 1];
    if ((innerDim & (innerDim - 1)) !== 0) {
      console.warn(
        "Using slow FFT implementation, because tensor size is not power of 2"
      );
      return slowFFTKernel(arg);
    }
    return fftWebGL(arg, false);
  },
});

const slowIFFTKernel = tf.getKernel("IFFT", "webgl").kernelFunc;
tf.unregisterKernel("IFFT", "webgl");
tf.registerKernel({
  kernelName: "IFFT",
  backendName: "webgl",
  kernelFunc: (arg) => {
    const innerDim = arg.inputs.input.shape[arg.inputs.input.shape.length - 1];
    if ((innerDim & (innerDim - 1)) !== 0) {
      console.warn(
        "Using slow IFFT implementation, because tensor size is not power of 2"
      );
      return slowIFFTKernel(arg);
    }
    return fftWebGL(arg, true);
  },
});

class CooleyTukeyStep {
  variableNames = ["x"];
  constructor(batch, innerDim, len, output = "complex", inverse) {
    this.outputShape = [batch, output === "complex" ? innerDim * 2 : innerDim];
    this.userCode = `void main() {
            ivec2 coords = getOutputCoords();
            int batch = coords[0];
            int i = ${
              output === "imag" ? `coords[1] + ${innerDim}` : "coords[1]"
            };
            int k = i % ${innerDim};
            int isHigh = (k % ${len * 2}) / ${len};
            int highSign = (1 - isHigh * 2);
            int baseIndex = k - isHigh * ${len};
            float t = ${
              inverse ? -Math.PI / len : Math.PI / len
            } * float(k % ${len});
            float a = cos(t);
            float b = sin(-t);
            float oddK_re = getX(batch, baseIndex + ${len});
            float oddK_im = getX(batch, baseIndex + ${len + innerDim});
            if (i < ${innerDim}) { // real
                float evenK_re = getX(batch, baseIndex);
                float outp = evenK_re + (oddK_re * a - oddK_im * b) * float(highSign);
                setOutput(${
                  inverse && output === "real"
                    ? `outp / float(${innerDim})`
                    : "outp"
                });
            } else { // imaginary
                float evenK_im = getX(batch, baseIndex + ${innerDim});
                float outp = evenK_im + (oddK_re * b + oddK_im * a) * float(highSign);
                setOutput(${
                  inverse && output === "imag"
                    ? `outp / float(${innerDim})`
                    : "outp"
                });
            }
        }`;
  }
}

class BitReverse {
  constructor(batch, innerDim, readComplex = false) {
    this.variableNames = readComplex ? ["real", "imag"] : ["x"];
    (this.outputShape = [batch, innerDim * 2]),
      (this.userCode = `void main() {
            ivec2 coords = getOutputCoords();
            int p = coords[1] % ${innerDim};
            int k = 0;
            for (int i = 0; i < ${Math.log2(innerDim)}; ++i) {
                if ((p & (1 << i)) != 0) { k |= (1 << (${
                  Math.log2(innerDim) - 1
                } - i)); }
            }
            if (coords[1] < ${innerDim}) {
                setOutput(${
                  readComplex
                    ? `getReal(coords[0], k)`
                    : `getX(coords[0], 2 * k)`
                });
            } else {
                setOutput(${
                  readComplex
                    ? `getImag(coords[0], k)`
                    : `getX(coords[0], 2 * (k % ${innerDim}) + 1)`
                });
            }
        }`);
  }
}

class RfftReassemble {
  variableNames = ["x"];
  constructor(batch, innerDim, part) {
    (this.outputShape = [batch, innerDim + 1]),
      (this.userCode = `void main() {
            ivec2 coords = getOutputCoords();
            int batch = coords[0];
            int i = coords[1];
            int zI = i % ${innerDim};
            int conjI = (${innerDim} - i) % ${innerDim};
            float Zk0 = getX(batch, zI);
            float Zk1 = getX(batch, zI+${innerDim});
            float Zk_conj0 = getX(batch, conjI);
            float Zk_conj1 = -getX(batch, conjI+${innerDim});
            float t = ${-2 * Math.PI} * float(i) / float(${innerDim * 2});
            float diff0 = Zk0 - Zk_conj0;
            float diff1 = Zk1 - Zk_conj1;
            ${
              part === "real"
                ? `float result = (Zk0 + Zk_conj0 + cos(t) * diff1 + sin(t) * diff0) * 0.5;`
                : `float result = (Zk1 + Zk_conj1 - cos(t) * diff0 + sin(t) * diff1) * 0.5;`
            }
            setOutput(result);
        }`);
  }
}

tf.registerKernel({
  kernelName: "RFFT",
  backendName: "webgl",
  kernelFunc: ({ backend, inputs: { input } }) => {
    const innerDim = input.shape[input.shape.length - 1] / 2;
    const batch = tf.util.sizeFromShape(input.shape) / innerDim / 2;
    let currentTensor = backend.runWebGLProgram(
      new BitReverse(batch, innerDim),
      [input],
      "float32"
    );
    for (let len = 1; len < innerDim; len *= 2) {
      let prevTensor = currentTensor;
      currentTensor = backend.runWebGLProgram(
        new CooleyTukeyStep(batch, innerDim, len),
        [currentTensor],
        "float32"
      );
      backend.disposeIntermediateTensorInfo(prevTensor);
    }
    const real = backend.runWebGLProgram(
      new RfftReassemble(batch, innerDim, "real"),
      [currentTensor],
      "float32"
    );
    const imag = backend.runWebGLProgram(
      new RfftReassemble(batch, innerDim, "imag"),
      [currentTensor],
      "float32"
    );
    const complex = tf.engine().runKernel("Complex", { real, imag });
    backend.disposeIntermediateTensorInfo(currentTensor);
    backend.disposeIntermediateTensorInfo(real);
    backend.disposeIntermediateTensorInfo(imag);
    return complex;
  },
});

// ----------------------------------------

const slowStft = tf.signal.stft;
tf.signal.stft = stft;
function stft(
  signal,
  frameLength,
  frameStep,
  fftLength,
  windowFn = tf.signal.hannWindow
) {
  const engine = tf.engine();
  if (!["webgl", "webgpu"].includes(engine.backendName)) {
    return slowStft(signal, frameLength, frameStep, fftLength, windowFn);
  }
  fftLength ??= frameLength;
  if (fftLength !== frameLength || (frameLength & (frameLength - 1)) !== 0) {
    console.warn(
      "STFT is slow when fftLength != frameLength, or frameLength is not power of 2"
    );
    return slowStft(signal, frameLength, frameStep, fftLength, windowFn);
  }
  const framedSignal = engine.runKernel("batchFrame", {
    input: signal,
    frameLength,
    frameStep,
  });
  const [batch, numFrames, frameLen] = framedSignal.shape;
  const reshaped = framedSignal.reshape([batch * numFrames, frameLen]);
  framedSignal.dispose();
  const FFT = engine.runKernel("RFFT", {
    input: tf.mul(reshaped, windowFn(frameLength)),
  });
  return FFT.reshape([batch, numFrames, fftLength / 2 + 1]);
}
