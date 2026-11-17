const fs = require('node:fs');
const p = require('node:path');

let DIM, BIN_PATH, BYTES_PER_VECTOR;
let fd;


/**
 * Initialize embedding storage: prepare the temporary database table and open the binary file used for vector storage.
 *
 * Sets the initial module-scoped DIM and BYTES_PER_VECTOR, creates (if needed) a TEMPORARY `embeddings` table and clears its rows, sets BIN_PATH to `<path>/embeddings.bin`, closes any previously opened descriptor, and opens the binary file for writing (assigning its descriptor to the module-scoped `fd`). The first stored batch can correct the initial dimension using its actual vector length.
 *
 * @param {object} db - SQLite database instance with `runAsync` method for executing SQL.
 * @param {string} path - Filesystem directory where `embeddings.bin` will be created/opened.
 * @param {number} dim - Expected embedding vector dimensionality; used until the first batch provides its actual dimension.
 */
async function createEmbeddingTable(db, path, dim){
  if (!Number.isInteger(dim) || dim < 1) {
    throw new Error(`Invalid embedding dimension: ${dim}`);
  }
  DIM = dim;
  BYTES_PER_VECTOR = dim * 2;
  await db.runAsync(`
      CREATE TEMPORARY TABLE IF NOT EXISTS embeddings (
          id INTEGER PRIMARY KEY,
          fileID INTEGER NOT NULL,
          offset REAL NOT NULL,
          vectorIndex INTEGER NOT NULL,
          UNIQUE(fileID, offset)
      );`)
  await db.runAsync('DELETE FROM embeddings');
  BIN_PATH = p.join(path, 'embeddings.bin')
  if (fd !== undefined) {
    fs.closeSync(fd);
    fd = undefined;
  }
  fd = fs.openSync(BIN_PATH, 'w')
}
/**
 * Persist a batch of embedding vectors and their offsets for a given file, storing vectors in the binary store and inserting corresponding metadata into the embeddings table atomically.
 *
 * This function appends each provided embedding (converted to Float16) to the on-disk embedding binary and creates a matching metadata row (fileID, offset, vectorIndex) for each vector. The actual batch dimension is authoritative; if it differs from the current dimension, incompatible stored vectors are cleared before the new batch is written. If metadata insertion does not affect all rows, or any error occurs while writing, the binary file is truncated back to its original size and the database transaction is rolled back.
 *
 * @param {number} fileID - Identifier of the file these embeddings belong to.
 * @param {Array<Array<number>>} embeddings - Array of embedding vectors; each vector must have length equal to the module DIM.
 * @param {Array<string|number>} keys - Array of offsets corresponding to each embedding; length must equal `embeddings.length`.
 * @throws {Error} If `embeddings` is empty or `embeddings.length !== keys.length`.
 * @throws {Error} If embeddings in the batch have inconsistent dimensions.
 * @throws {Error} If a filesystem or database error occurs while writing; on such errors the binary store and DB are rolled back to their prior state.
 */
async function storeEmbeddings({db, dbMutex, fileID, embeddings, keys}) {
  const emLength = embeddings.length;
  if ( ! emLength || emLength !== keys.length) {
    throw new Error('No Embeddings or Embeddings and key array mismatch:', emLength);
  }
  const embeddingDim = embeddings[0].length;
  if (!Number.isInteger(embeddingDim) || embeddingDim < 1 ||
      embeddings.some(vector => vector.length !== embeddingDim)) {
    throw new Error('Embedding batch contains inconsistent dimensions');
  }

  await dbMutex.lock();
  let initialSize;
  let transactionStarted = false;
  try {
    initialSize = fs.fstatSync(fd).size;
    if (embeddingDim !== DIM) {
      const {count} = await db.getAsync('SELECT COUNT(*) AS count FROM embeddings');
      if (initialSize || count) {
        await db.runAsync('DELETE FROM embeddings');
        fs.ftruncateSync(fd, 0);
        initialSize = 0;
      }
      console.warn(`Embedding dimension changed from ${DIM} to ${embeddingDim}; stored embeddings were reset`);
      DIM = embeddingDim;
      BYTES_PER_VECTOR = embeddingDim * 2;
    }
    const currentIndex = Math.floor(initialSize / BYTES_PER_VECTOR);
    const placeholders = [];
    const values = [];
    for (let i = 0; i < emLength; i++) {
        placeholders.push('(?, ?, ?)');
        values.push(
            fileID,
            parseFloat(keys[i]),
            currentIndex + i
        );
    }
    await db.runAsync('BEGIN');
    transactionStarted = true;
    const sql = `
      INSERT OR IGNORE INTO embeddings
      (fileID, offset, vectorIndex)
      VALUES ${placeholders.join(',')}
    `;
    const result = await db.runAsync(sql, ...values);
    if (result.changes !== emLength){
        await db.runAsync('ROLLBACK');
        transactionStarted = false;
        return
    }
    for (let i = 0; i < emLength; i++) {
        const vector = embeddings[i];
        const f16Vector = new Float16Array(vector)
        // Convert Float32Array → Buffer (zero copy)
        const buffer = Buffer.from(
        f16Vector.buffer,
        f16Vector.byteOffset,
        f16Vector.byteLength
        );

        // Append to binary file
        fs.writeSync(
          fd,
          buffer,
          0,
          buffer.byteLength,
          initialSize + i * BYTES_PER_VECTOR
        );
      }
    await db.runAsync('END');
    transactionStarted = false;
  } catch (error) {
    if (initialSize !== undefined) fs.ftruncateSync(fd, initialSize);
    if (transactionStarted) await db.runAsync('ROLLBACK');
    throw error;
  } finally {
      dbMutex.unlock();
  }
}

function searchTopN(query, embeddings, N, minScore) {
  if (!Number.isInteger(N) || N < 1) return [];
  if (!minScore || isNaN(minScore)) minScore = 0;
  else minScore /= 100; // Percent to fraction
  const top = [];
  const totalVectors = embeddings.byteLength / BYTES_PER_VECTOR;
  for (let i = 0; i < totalVectors; i++) {
    let dot = 0;
    const base = i * DIM;

    for (let d = 0; d < DIM; d++) {
      dot += query[d] * embeddings[base + d];
    }
    // Skip anything below threshold
    if (dot < minScore) continue;

    if (top.length < N) {
      top.push({ index: i, score: dot });
      if (top.length === N) {
        top.sort((a, b) => a.score - b.score); // smallest first
      }
    } else if (dot > top[0].score) {
      top[0] = { index: i, score: dot };
      top.sort((a, b) => a.score - b.score);
    }
  }

  // Return highest first
  return top.sort((a, b) => b.score - a.score);
}



async function queryEmbeddings(db, query, N, threshold){
  if (!BIN_PATH || !fs.existsSync(BIN_PATH)) {
      return [];
   }
  if (query.length !== DIM) {
    throw new Error(`Wrong query embedding dimension: expected ${DIM}, received ${query.length}`);
  }
  const buffer = fs.readFileSync(BIN_PATH);
  // Create a zero-copy Float16Array view
  const embeddings = new Float16Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength / 2
  );

  const totalVectors = embeddings.length / DIM;
  const vectorMeta = new Array(totalVectors);
  const rows = await db.allAsync("SELECT vectorIndex, fileID, offset FROM embeddings");
  for (const row of rows){
      const {vectorIndex, fileID, offset} = row;
      vectorMeta[vectorIndex] = {fileID, offset};
  }
  const result = searchTopN(query, embeddings, N, threshold)
  const matches = result
    .filter(r => vectorMeta[r.index] != null)
    .map(r => [vectorMeta[r.index].fileID, vectorMeta[r.index].offset , r.score])
  return matches;
}

export {storeEmbeddings, createEmbeddingTable, queryEmbeddings}