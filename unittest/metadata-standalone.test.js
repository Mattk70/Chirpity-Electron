const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { extractWaveMetadata } = require("../js/utils/metadata.js");

function createChunk(id, content) {
  const header = Buffer.alloc(8);
  header.write(id, 0, 4, "ascii");
  header.writeUInt32LE(content.length, 4);
  return Buffer.concat([
    header,
    content,
    content.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0),
  ]);
}

async function run() {
  const filePath = path.join(
    os.tmpdir(),
    `chirpity-metadata-${process.pid}-${Date.now()}.wav`
  );
  const audioData = createChunk("data", Buffer.from([1, 2, 3, 4]));
  const guanoText = Buffer.from("Make: TestRecorder\n");
  const guanoChunk = createChunk("guan", guanoText);
  const body = Buffer.concat([Buffer.from("WAVE"), audioData, guanoChunk]);
  const header = Buffer.alloc(8);
  header.write("RIFF", 0, 4, "ascii");
  header.writeUInt32LE(body.length, 4);
  fs.writeFileSync(filePath, Buffer.concat([header, body]));

  const guanoOffset = 12 + audioData.length + 8;
  const originalOpen = fs.promises.open;
  fs.promises.open = async function (file, ...args) {
    const handle = await originalOpen.call(this, file, ...args);
    if (file === filePath) {
      const read = handle.read.bind(handle);
      handle.read = async (...readArgs) => {
        if (readArgs[3] === guanoOffset) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        return read(...readArgs);
      };
    }
    return handle;
  };

  try {
    const metadata = await extractWaveMetadata(filePath);
    assert.equal(metadata.guano.Make, "TestRecorder");
    console.log("✓ waits for delayed GUANO chunk reads before returning");
  } finally {
    fs.promises.open = originalOpen;
    fs.unlinkSync(filePath);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
