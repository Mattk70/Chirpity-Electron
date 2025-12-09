// ---------------------------------------------------------
// read a float32 from memory
// ---------------------------------------------------------
@inline
function readF32(ptr: usize, i: i32): f32 {
  return load<f32>(ptr + (<usize>i << 2));
}

// expose allocator to JS
export { __alloc };

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

  const vals = new StaticArray<f32>(k);
  const ids  = new StaticArray<i32>(k);

  for (let t = 0; t < k; t++) {
    unchecked(vals[t] = -Infinity);
    unchecked(ids[t]  = -1);
  }

  let max: f32 = -Infinity;

  // -------- stage 1 --------
  for (let i = 0; i < numClasses; i++) {
    const v = readF32(logitsPtr, i);

    if (v > max) max = v;

    if (v > unchecked(vals[k-1])) {
      unchecked(vals[k-1] = v);
      unchecked(ids[k-1]  = i);

      for (let j = k - 1;
           j > 0 && unchecked(vals[j]) > unchecked(vals[j-1]);
           j--) {5

        const tv = unchecked(vals[j]);
        const ti = unchecked(ids[j]);

        unchecked(vals[j]     = vals[j-1]);
        unchecked(ids[j]      = ids[j-1]);
        unchecked(vals[j-1]   = tv);
        unchecked(ids[j-1]    = ti);
      }
    }
  }

  // -------- stage 2 --------
  let sum: f32 = 0.0;

  for (let i = 0; i < numClasses; i++) {
    sum += <f32>Mathf.exp(readF32(logitsPtr, i) - max);
  }

  const inv = 1.0 / sum;

  // -------- stage 3 --------
  for (let t = 0; t < k; t++) {
    const v = unchecked(vals[t]);
    const id = unchecked(ids[t]);

    store<i32>(idxPtr + (<usize>t << 2), id);

    const prob = <f32>Mathf.exp(v - max) * inv;

    store<f32>(
        probsPtr + (<usize>t << 2),
        <f32>(Mathf.exp(v - max) * inv)
    );

  }
}
