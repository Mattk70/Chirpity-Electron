const fs = require('node:fs');
const p = require('node:path');

// const TEST_PATH = "E:/DATASETS/Chirpity-Hoplite"

let DIM, BIN_PATH, BYTES_PER_VECTOR;
// const BIN_PATH = p.join(TEST_PATH,'embeddings.bin')
let fd;


async function createEmbeddingTable(db, path, dim){
  DIM = dim;
  BYTES_PER_VECTOR = dim * 2;
  await db.runAsync(`
      CREATE TEMPORARY TABLE IF NOT EXISTS embeddings (
          id INTEGER PRIMARY KEY,
          fileID INTEGER NOT NULL,
          offset REAL NOT NULL,
          vectorIndex INTEGER NOT NULL,
          FOREIGN KEY (fileID) REFERENCES files(id),
          UNIQUE(fileID, offset)
      );`)
  await db.runAsync('DELETE FROM embeddings');
  BIN_PATH = p.join(path, 'embeddings.bin')
  if (fd !== undefined) {
    fs.closeSync(fd);
    fd = undefined;
  }
  fs.rmSync(BIN_PATH, { force: true });
  fd = fs.openSync(BIN_PATH, 'w')
}
async function storeEmbeddings({db, dbMutex, fileID, embeddings, keys}) {
  if (embeddings.length !== keys.length) {
    throw new Error('Embedding and key array mismatch');
  }

  await dbMutex.lock();

  const initialSize = fs.fstatSync(fd).size;
  let currentIndex = Math.floor(initialSize / BYTES_PER_VECTOR);
  try {
    const placeholders = [];
    const values = [];
    for (let i = 0; i < embeddings.length; i++) {
        placeholders.push('(?, ?, ?)');
        values.push(
            fileID,
            parseFloat(keys[i]),
            currentIndex + i
        );
    }
    await db.runAsync('BEGIN');
    const sql = `
      INSERT OR IGNORE INTO embeddings
      (fileID, offset, vectorIndex)
      VALUES ${placeholders.join(',')}
    `;
    const result = await db.runAsync(sql, ...values);
    if (result.changes !== embeddings.length){
        await db.runAsync('ROLLBACK');
        return
    }
    for (let i = 0; i < embeddings.length; i++) {
        const vector = embeddings[i];  // Float32Array length = DIM
        const offset = keys[i];

        if (vector.length !== DIM) {
        throw new Error('Wrong embedding dimension');
        }
        const f16Vector = new Float16Array(vector)
        // Convert Float32Array → Buffer (zero copy)
        const buffer = Buffer.from(
        f16Vector.buffer,
        f16Vector.byteOffset,
        f16Vector.byteLength
        );

        // Append to binary file
        fs.writeSync(fd, buffer);
      }
    await db.runAsync('END');
  } catch (error) {
    fs.ftruncateSync(fd, initialSize);
    await db.runAsync('ROLLBACK');
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