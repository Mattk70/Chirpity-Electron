const tf = require("@tensorflow/tfjs");
require("@tensorflow/tfjs-backend-webgpu");

/**
 * Computes the product of all elements in an array.
 *
 * @param {number[]} arr - Array of numbers to multiply.
 * @returns {number} The product of all elements in {@link arr}.
 */
function arrayProduct(arr) {
  let product = 1;
  for (let i = 0; i < arr.length; i++) {
    product *= arr[i];
  }
  return product;
}
/**
 * Creates a dispatch layout object mapping each dimension index of a tensor shape to an array `x`.
 *
 * @param {number[]} shape - The shape of the tensor.
 * @returns {{x: number[]}} An object with property `x` containing the indices of each dimension in {@link shape}.
 */
function flatDispatchLayout(shape) {
  return { x: shape.map((d, i) => i) };
}
/**
 * Calculates the dispatch size for GPU kernel execution based on the provided layout, output shape, workgroup size, and elements processed per thread.
 *
 * @param {Object} layout - An object specifying the mapping of output shape dimensions to dispatch axes (`x`, `y`, `z`).
 * @param {number[]} outputShape - The shape of the output tensor.
 * @param {number[]} [workgroupSize=[1, 1, 1]] - The size of each workgroup along each axis.
 * @param {number[]} [elementsPerThread=[1, 1, 1]] - The number of elements processed by each thread along each axis.
 * @returns {number[]} An array of three numbers representing the dispatch size along the x, y, and z axes.
 */
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


tf.registerKernel({
  kernelName: "batchFrame",
  backendName: "webgpu",
  kernelFunc: ({ backend, inputs: { input, frameLength, frameStep } }) => {
    const [batchSize, signalLength] = input.shape;
    const outputLength = (signalLength - frameLength + frameStep) / frameStep | 0;
    const outputShape = [batchSize, outputLength, frameLength];
    const workgroupSize = [64, 1, 1]; // tune as needed
    const dispatchLayout = flatDispatchLayout(outputShape);
    const dispatch = computeDispatch(dispatchLayout, outputShape, workgroupSize);
    return backend.runWebGPUProgram(
      {
        variableNames: ["x"],
        outputShape,
        workgroupSize,
        dispatchLayout,
        dispatch,
        shaderKey: `frame_batched_${frameLength}_${frameStep}`,
        getUserCode: () => `
          fn main( index: i32) {
            let globalId = getOutputCoords();
            let b = i32(globalId.x);  // batch index
            let f = i32(globalId.y);  // frame index
            let l = i32(globalId.z);  // position within frame

            let signalIndex = f * ${frameStep} + l;

            // Get the value from input[b, signalIndex]
            setOutputAtCoords(b, f, l, getX(b, signalIndex));
          }`
      }, [input], "float32");
  },
});


/**
 * Computes the short-time Fourier transform (STFT) of a batched signal tensor using a custom GPU-accelerated FFT kernel.
 * Adapted from https://github.com/georg95/birdnet-web/blob/main/birdnet.js
 * Frames the input signal, applies a window function, and computes the real FFT for each frame. Returns the complex frequency-domain representation for each frame, retaining only the non-redundant half of the spectrum.
 *
 * @param {tf.Tensor} signal - Input tensor of shape [batch, signalLength].
 * @param {number} frameLength - Length of each frame for STFT.
 * @param {number} frameStep - Step size between consecutive frames.
 * @param {number} fftLength - Length of the FFT to compute for each frame.
 * @param {function} windowFn - Function that generates a window tensor of length {@link frameLength}.
 * @returns {tf.Tensor} STFT output tensor of shape [batch, numFrames, halfFftLength, 2], where the last dimension contains real and imaginary parts.
 */
function stft(signal, frameLength, frameStep, fftLength, windowFn) {
    const framedSignal = tf.engine().runKernel('batchFrame', {input: signal, frameLength, frameStep })
    const window = windowFn(frameLength).reshape([1, 1, frameLength]);
    const input = tf.mul(framedSignal, window);
    const shape = input.shape;
    const realValues = tf.engine().runKernel('FFT2', {input: input.reshape([-1, frameLength])})
    const half = frameLength / 2 + 1; // here we assume that frameLength is a power of 2
    const realComplexConjugate = tf.split(
        realValues, [half, frameLength - half],
        realValues.shape.length - 1);
    shape[shape.length - 1] = half;
    return tf.reshape(realComplexConjugate[0], shape)
}

// Credit for this FFT kernel goes to https://github.com/georg95

tf.registerKernel({
    kernelName: 'FFT2',
    backendName: 'webgpu',
    kernelFunc: ({ backend, inputs: { input } }) => {
        // const innerDim = input.shape[input.shape.length - 1] / 2
        const [batch, width] = input.shape;
        const innerDim = width / 2;
        const workgroupSize = [64, 1, 1]
        const dispatchLayout = flatDispatchLayout([batch, width])
        const dispatch = computeDispatch(dispatchLayout, [batch, width], workgroupSize, [2, 1, 1])
        let currentTensor = backend.runWebGPUProgram({
            variableNames: ['X'],
            outputShape: [batch, width],
            workgroupSize,
            shaderKey: `fft_permut_${innerDim}`,
            dispatchLayout,
            dispatch,
            getUserCode: () => `
              fn main(index: i32) {
                let batch = index / ${innerDim};
                let p = index % ${innerDim};
                let outIndexReal = batch * ${width} + p;
                let outIndexImag = outIndexReal + ${innerDim};
                var k = 0;
                for (var i: u32 = 0; i < ${Math.log2(innerDim)}; i = i + 1) {
                    if ((p & (1 << i)) != 0) { k |= (1 << (${Math.log2(innerDim) - 1} - i)); }
                }
                setOutputAtIndex(outIndexReal, getX(batch, 2 * k));
                setOutputAtIndex(outIndexImag, getX(batch, 2 * (k % ${innerDim}) + 1));
              }`
        }, [input], 'float32');
        for (let len = 1; len < innerDim; len *= 2) {
            let prevTensor = currentTensor
            currentTensor = backend.runWebGPUProgram({
                variableNames: [`value`],
                outputShape: [batch, innerDim * 2],
                workgroupSize,
                shaderKey: `fft_step_${innerDim}_${len}`,
                dispatchLayout,
                dispatch,
                getUserCode: () => `
                  fn main(index: i32) {
                    let batch = index / ${innerDim};
                    let i = index % ${innerDim};
                    let outIndexReal = batch * ${width} + i;
                    let outIndexImag = outIndexReal + ${innerDim};
                    let k = i % ${innerDim};
                    let isHigh = (k % (${len} * 2)) / ${len};
                    let highSign = (1 - isHigh * 2);
                    let baseIndex = k - isHigh * ${len};
                    let t = ${Math.PI} / f32(${len}) * f32(k % ${len});
                    let a = cos(t);
                    let b = sin(-t);
                    let oddK_re = getValue(batch, baseIndex + ${len});
                    let oddK_im = getValue(batch, baseIndex + ${len} + ${innerDim});

                    let evenK_re = getValue(batch, baseIndex);
                    let outpR = (evenK_re + (oddK_re * a - oddK_im * b) * f32(highSign));
                    setOutputAtIndex(outIndexReal, outpR);
                    let evenK_im = getValue(batch, baseIndex + ${innerDim});
                    let outpI = (evenK_im + (oddK_re * b + oddK_im * a) * f32(highSign));
                    setOutputAtIndex(outIndexImag, outpI);
                  }`
                }, [currentTensor], 'float32')
            backend.disposeData(prevTensor.dataId)
        }
        let prevTensor = currentTensor
        currentTensor = backend.runWebGPUProgram({
            variableNames: ['x'],
            outputShape: [batch, innerDim * 2],
            workgroupSize,
            shaderKey: `fft_post_${innerDim}`,
            dispatchLayout,
            dispatch: computeDispatch(flatDispatchLayout([batch, width]), [batch, width], workgroupSize, [1, 1, 1]),
            getUserCode: () => `
                fn main(index: i32) {
                  let coords = getOutputCoords();
                  let i = coords[1];
                  let batch = coords[0];
                  var k = i;
                  if (i > ${innerDim}) {
                    k = ${width} - i;
                  }
                  let zI = k % ${innerDim};
                  let conjI = (${innerDim} - k) % ${innerDim};
                  let Zk0 = getX(batch, zI);
                  let Zk_conj0 = getX(batch, conjI);
                  let t = ${-2 * Math.PI} * f32(k) / f32(${width});
                  let result = (Zk0 + Zk_conj0 + cos(t) * (getX(batch, zI+${innerDim}) + getX(batch, conjI+${innerDim})) + sin(t) * (Zk0 - Zk_conj0)) * 0.5;
                  setOutputAtIndex(index, result);
                }`}, [currentTensor], 'float32')
        backend.disposeData(prevTensor.dataId)
        return currentTensor
    }
})

module.exports = {stft, flatDispatchLayout, computeDispatch, tf};