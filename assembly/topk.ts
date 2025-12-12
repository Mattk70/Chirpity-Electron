// ---------------------------------------------------------
// SIMD utilities
// ---------------------------------------------------------

@inline
function readF32(ptr: usize, i: i32): f32 {
  return load<f32>(ptr + (<usize>i << 2));
}

@inline
function exp_f32(x: f32): f32 {
  return <f32>Mathf.exp(x);   // AS always promotes → explicit cast required
}

export {__alloc}
// ---------------------------------------------------------
// main
// ---------------------------------------------------------
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
