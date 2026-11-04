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
  const originalOpen = fs.open;
  const originalRead = fs.read;
  const watchedFds = new Set();
  fs.open = function (file, ...args) {
    const callback = args.pop();
    return originalOpen.call(this, file, ...args, (err, fd) => {
      if (!err && file === filePath) watchedFds.add(fd);
      callback(err, fd);
    });
  };
  fs.read = function (fd, buffer, offset, length, position, callback) {
  if (watchedFds.has(fd) && position === guanoOffset) {
      return setTimeout(
        () => originalRead.call(this, fd, buffer, offset, length, position, callback),
        50
      );
    }
    return originalRead.call(this, fd, buffer, offset, length, position, callback);
  };

  try {
    const metadata = await extractWaveMetadata(filePath);
    assert.equal(metadata.guano.Make, "TestRecorder");
    console.log("✓ waits for delayed GUANO chunk reads before returning");
  } finally {
    fs.open = originalOpen;
    fs.read = originalRead;
    fs.unlinkSync(filePath);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
