// ---------------------------------------------------------
// SIMD utilities
// ---------------------------------------------------------

@inline
/**
 * Reads a single-precision (32-bit) floating-point value from linear memory at the address `ptr` plus `i` 32-bit-element offsets.
 *
 * @param ptr - Base memory address (byte offset) of the float array
 * @param i - Index of the 32-bit float element to read (number of elements from `ptr`)
 * @returns The 32-bit float stored at the computed address
 */
function readF32(ptr: usize, i: i32): f32 {
  return load<f32>(ptr + (<usize>i << 2));
}

@inline
/**
 * Computes the exponential of a 32-bit float.
 *
 * @param x - The input value
 * @returns The exponential of `x` as an `f32`
 */
function exp_f32(x: f32): f32 {
  return <f32>Mathf.exp(x);   // AS always promotes → explicit cast required
}

export {__alloc}
// ---------------------------------------------------------
// main
/**
 * Computes the top-k softmax over a logits array and writes the top indices and probabilities to provided memory.
 *
 * Performs a three-phase routine: (1) identifies the top k logits and their indices while tracking the maximum logit for numerical stability, (2) computes the normalization constant using a 4-lane SIMD accumulator for exp(logit - max), and (3) writes the top-k indices and corresponding softmax probabilities to the output pointers in descending-score order.
 *
 * @param logitsPtr - Pointer to the input logits buffer (contiguous f32 values)
 * @param numClasses - Number of logits in the input buffer
 * @param k - Number of top elements to select (assumes 0 < k <= numClasses)
 * @param probsPtr - Pointer to the output buffer for probabilities (will be written as contiguous f32 values)
 * @param idxPtr - Pointer to the output buffer for indices (will be written as contiguous i32 values)
 */
export function topk_softmax(
  logitsPtr: usize,
  numClasses: i32,
  k: i32,
  probsPtr: usize,
  idxPtr: usize
): void {

  // --- top-k staging ---
  const vals = new StaticArray<f32>(k);
  const ids  = new StaticArray<i32>(k);

  for (let i = 0; i < k; i++) {
    unchecked(vals[i] = -Infinity);
    unchecked(ids[i] = -1);
  }

  let max: f32 = -Infinity;

  // -------------------------------------------------------
  // PHASE 1 — scalar top-k + max
  // -------------------------------------------------------
  for (let i = 0; i < numClasses; i++) {
    const v = readF32(logitsPtr, i);

    if (v > max) max = v;

    if (v > unchecked(vals[k - 1])) {
      unchecked(vals[k - 1] = v);
      unchecked(ids[k - 1]  = i);

      for (let j = k - 1;
           j > 0 && unchecked(vals[j]) > unchecked(vals[j - 1]);
           j--) {

        const tv = unchecked(vals[j]);
        const ti = unchecked(ids[j]);

        unchecked(vals[j]     = vals[j - 1]);
        unchecked(ids[j]      = ids[j - 1]);
        unchecked(vals[j - 1] = tv);
        unchecked(ids[j - 1]  = ti);
      }
    }
  }

  // -------------------------------------------------------
  // PHASE 2 — SIMD sum of exp(logit - max)
  // -------------------------------------------------------

  let sum: f32 = 0;

  let i = 0;

  const lanes = 4;

  // vector accumulator
  let acc = f32x4.splat(0);

  // vectorised loop
  for (; i + lanes <= numClasses; i += lanes) {
    const v0 = readF32(logitsPtr, i + 0) - max;
    const v1 = readF32(logitsPtr, i + 1) - max;
    const v2 = readF32(logitsPtr, i + 2) - max;
    const v3 = readF32(logitsPtr, i + 3) - max;

    // apply exp scalar (cannot SIMD yet)
    const e0 = exp_f32(v0);
    const e1 = exp_f32(v1);
    const e2 = exp_f32(v2);
    const e3 = exp_f32(v3);

    const vec = f32x4.replace_lane(
      f32x4.replace_lane(
        f32x4.replace_lane(
          f32x4.replace_lane(f32x4.splat(0), 0, e0),
          1, e1),
        2, e2),
      3, e3);

    acc = f32x4.add(acc, vec);
  }

  // horizontal sum
  sum +=
    f32x4.extract_lane(acc, 0) +
    f32x4.extract_lane(acc, 1) +
    f32x4.extract_lane(acc, 2) +
    f32x4.extract_lane(acc, 3);

  // tail
  for (; i < numClasses; i++) {
    sum += exp_f32(readF32(logitsPtr, i) - max);
  }

  const inv = 1.0 / sum;

  // -------------------------------------------------------
  // PHASE 3 — scalar top-k softmax output
  // -------------------------------------------------------
  for (let t = 0; t < k; t++) {
    const v = unchecked(vals[t]);
    const id = unchecked(ids[t]);

    store<i32>(idxPtr   + (<usize>t << 2), id);
    store<f32>(
        probsPtr + (<usize>t << 2),
        <f32>(Mathf.exp(v - max) * inv)
    );
  }
}