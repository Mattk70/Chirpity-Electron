// topKWASM.js
const fs = require("fs");
const p = require('node:path');

async function loadTopK(path = p.join(__dirname, "../../topK.wasm")) {
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
