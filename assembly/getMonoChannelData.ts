// assembly/index.ts
// AssemblyScript: convert little-endian 16-bit PCM bytes -> Float32Array (mono)
// Exports a function that takes (ptr, byteLength) and returns pointer to Float32Array data.
// It also exports lastOutLength which you must read from the module to know the returned length.

export var lastOutLength: i32 = 0;

/**
 * Convert little-endian 16-bit PCM bytes at `ptr` into a newly allocated mono Float32Array and return its data pointer.
 *
 * The function sets `lastOutLength` to the number of output samples produced.
 *
 * @param ptr - Pointer to the input buffer of 16-bit little-endian PCM bytes
 * @param byteLength - Length in bytes of the input buffer; must be even (2 bytes per sample)
 * @returns Pointer to the start of the returned Float32Array's underlying data (32-bit float elements)
 * @throws Traps (unreachable) if `byteLength` is not an even number
 */
export function getMonoChannelData(ptr: usize, byteLength: i32): usize {
  // Ensure even number of bytes (16-bit samples)
  if ((byteLength & 1) != 0) {
    // throw will trap; caller should ensure even length.
    unreachable();
  }

  const sampleCount: i32 = byteLength >> 1; // byteLength / 2
  lastOutLength = sampleCount;

  // Allocate a Float32Array for output
  const out = new Float32Array(sampleCount);
  const outPtr: usize = out.dataStart;

  // Input pointer to the byte buffer
  let inPtr: usize = ptr;

  // Reciprocal scale (multiply is slightly faster than divide)
  const scale: f32 = 1.0 / 32768.0;

  // Process in blocks of 8 samples (unrolled)
  let i: i32 = 0;
  const end: i32 = sampleCount - (sampleCount & 7);

  for (; i < end; i += 8) {
    // load<i16> reads a signed 16-bit value from memory (little-endian on WASM)
    let a0: f32 = <f32>load<i16>(inPtr + ((i     ) << 1)) * scale;
    let a1: f32 = <f32>load<i16>(inPtr + ((i + 1 ) << 1)) * scale;
    let a2: f32 = <f32>load<i16>(inPtr + ((i + 2 ) << 1)) * scale;
    let a3: f32 = <f32>load<i16>(inPtr + ((i + 3 ) << 1)) * scale;
    let a4: f32 = <f32>load<i16>(inPtr + ((i + 4 ) << 1)) * scale;
    let a5: f32 = <f32>load<i16>(inPtr + ((i + 5 ) << 1)) * scale;
    let a6: f32 = <f32>load<i16>(inPtr + ((i + 6 ) << 1)) * scale;
    let a7: f32 = <f32>load<i16>(inPtr + ((i + 7 ) << 1)) * scale;

    // store<f32>(address, value)
    store<f32>(outPtr + ((i     ) << 2), a0);
    store<f32>(outPtr + ((i + 1 ) << 2), a1);
    store<f32>(outPtr + ((i + 2 ) << 2), a2);
    store<f32>(outPtr + ((i + 3 ) << 2), a3);
    store<f32>(outPtr + ((i + 4 ) << 2), a4);
    store<f32>(outPtr + ((i + 5 ) << 2), a5);
    store<f32>(outPtr + ((i + 6 ) << 2), a6);
    store<f32>(outPtr + ((i + 7 ) << 2), a7);
  }

  // Remaining samples
  for (; i < sampleCount; i++) {
    let v: f32 = <f32>load<i16>(inPtr + (i << 1)) * scale;
    store<f32>(outPtr + (i << 2), v);
  }

  // Return pointer to start of Float32 data; JS caller can read it as:
  // new Float32Array(wasmMemory.buffer, returnedPtr, lastOutLength)
  return outPtr;
}