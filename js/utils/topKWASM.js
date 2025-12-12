// topKWASM.js
const fs = require("fs");

/**
 * Load and instantiate the topK WebAssembly module and prepare helpers to compute top-K softmax.
 *
 * @param {string} path - Filesystem path to the WebAssembly binary (defaults to "topK.wasm").
 * @returns {{wasm: Object, memory: WebAssembly.Memory, topK: function(Array|Float32Array): {probs: number[], idx: number[]}}} An object with the module exports (`wasm`), the module memory (`memory`), and `topK`, a function that accepts logits and returns an object with `probs` (top-K probabilities) and `idx` (top-K indices).
 */
async function loadTopK(path = "topK.wasm") {
  const bytes = fs.readFileSync(path);

  const imports = {
    env: {
      abort(msg, file, line, col) {
        throw new Error(`WASM abort at ${line}:${col}`);
      }
    }
  };

  const { instance } = await WebAssembly.instantiate(bytes, imports);

  const wasm = instance.exports;

  const memory = wasm.memory;

  // utilities -------------------------------------------------------------

  function allocFloat32(n) {
    return wasm.__alloc(n * 4, 4); // size, align
  }

  function allocInt32(n) {
    return wasm.__alloc(n * 4, 4);
  }

  function writeFloat32(ptr, data) {
    new Float32Array(memory.buffer).set(data, ptr >> 2);
  }

  function readFloat32(ptr, n) {
    return new Float32Array(memory.buffer, ptr, n);
  }

  function readInt32(ptr, n) {
    return new Int32Array(memory.buffer, ptr, n);
  }

  // main call -------------------------------------------------------------
    const CLASSES = 14795;
    const K = 5;
    const logitsPtr = allocFloat32(CLASSES);
    const probsPtr  = allocFloat32(K);
    const idxPtr    = allocInt32(K);
  function topK(logits) {
    // const num = logits.length;
    writeFloat32(logitsPtr, logits);

    wasm.topk_softmax(logitsPtr, CLASSES, K, probsPtr, idxPtr);

    const probs = readFloat32(probsPtr, K).slice();
    const idx   = readInt32(idxPtr, K).slice();

    return { probs, idx };
  }

  return {
    wasm,
    memory,
    topK
  };
}

module.exports = loadTopK;