/**
 * @file Helper functions for wav file metadata extraction.
 */



////////// GUANO Support /////////////

const fs = require("node:fs");

/**
 * Extract metadata from a WAV file, without reading the entire file into memory.
 * @param {string} filePath - Path to the WAV file.
 * @returns {Promise<object|null>} - The extracted metadata or null if not found.
 */
function extractWaveMetadata(filePath) {
  let metadata = {};
  return new Promise((resolve, reject) => {
    // Open the file
    fs.open(filePath, "r", (err, fd) => {
      if (err) {
        return reject(err);
      }

      const buffer = Buffer.alloc(12); // Initial buffer for RIFF header and first chunk header

      // Read the RIFF header (12 bytes)
      fs.read(fd, buffer, 0, 12, 0, (err) => {
        if (err) {
          fs.close(fd, () => {}); // Close the file descriptor
          return reject(err);
        }

        const chunkId = buffer.toString("utf-8", 0, 4); // Should be "RIFF"
        const format = buffer.toString("utf-8", 8, 12); // Should be "WAVE"

        if (!(chunkId === "RIFF" || chunkId === "RF64") || format !== "WAVE") {
          fs.close(fd, () => {}); // Close the file descriptor
          return reject(new Error("Invalid WAV file: " + filePath));
        }

        let currentOffset = 12; // Start after the RIFF header

        // Function to read the next chunk header
        function readNextChunk() {
          const chunkHeaderBuffer = Buffer.alloc(8); // 8 bytes for chunk ID and size
          fs.read(fd, chunkHeaderBuffer, 0, 8, currentOffset, (err) => {
            if (err) {
              fs.close(fd, () => {}); // Close the file descriptor
              return reject(err);
            }

            const chunkId = chunkHeaderBuffer.toString("utf-8", 0, 4); // Chunk ID
            const chunkSize = chunkHeaderBuffer.readUInt32LE(4); // Chunk size
            if (chunkSize === 0) {
              fs.close(fd, () => {}); // Close the file descriptor
              return resolve(metadata); // No GUANO found
            }

            currentOffset += 8; // Move past the chunk header

            if (chunkId === "guan") {
              // GUANO chunk found, read its content
              const guanoBuffer = Buffer.alloc(chunkSize);
              fs.read(fd, guanoBuffer, 0, chunkSize, currentOffset, (err) => {
                if (err) {
                  fs.close(fd, () => {}); // Close the file descriptor
                  return reject(err);
                }

                // GUANO data is UTF-8 encoded
                const guanoText = guanoBuffer.toString("utf-8");
                const guano = _parseMetadataText(guanoText);
                metadata["guano"] = guano;
              });
            } else if (chunkId === "bext") {
              // GUANO chunk found, read its content
              const bextBuffer = Buffer.alloc(chunkSize);
              fs.read(fd, bextBuffer, 0, chunkSize, currentOffset, (err) => {
                if (err) {
                  fs.close(fd, () => {}); // Close the file descriptor
                  return reject(err);
                }
                const bext = {
                  Description: bextBuffer
                    .toString("ascii", 0, 256)
                    .replaceAll("\\u000", ""),
                  Originator: bextBuffer
                    .toString("ascii", 256, 288)
                    .replaceAll("\\u000", ""),
                  OriginatorReference: bextBuffer
                    .toString("ascii", 288, 320)
                    .replaceAll("\\u000", ""),
                  OriginationDate: bextBuffer
                    .toString("ascii", 320, 330)
                    .replaceAll("\\u000", ""),
                  OriginationTime: bextBuffer
                    .toString("ascii", 330, 338)
                    .trim(),
                  TimeReferenceLow: bextBuffer.readUInt32LE(338),
                  TimeReferenceHigh: bextBuffer.readUInt32LE(342),
                  Version: bextBuffer.readUInt16LE(346),
                  UMID: bextBuffer.subarray(348, 380).toString("hex").trim(),
                  LoudnessValue: bextBuffer.readUInt16LE(380),
                  LoudnessRange: bextBuffer.readUInt16LE(382),
                  MaxTruePeakLevel: bextBuffer.readUInt16LE(384),
                  MaxMomentaryLoudness: bextBuffer.readUInt16LE(386),
                  MaxShortTermLoudness: bextBuffer.readUInt16LE(388),
                };
                // bext data is UTF-8 encoded
                const bextText = bextBuffer
                  .subarray(392, chunkSize)
                  .toString("utf-8");
                const bextMetadata = _parseMetadataText(bextText);
                metadata["bext"] = { ...bext, ...bextMetadata };
                // Strip empty or null keys
                for (let key in metadata["bext"]) {
                  if (
                    ["", 0].includes(metadata.bext[key]) ||
                    /^0*$/.test(metadata.bext[key]) ||
                    /^\u0000*$/.test(metadata.bext[key])
                  ) {
                    delete metadata.bext[key];
                  }
                }
              });
            }
            if (chunkSize % 2 !== 0) currentOffset += 1;
            currentOffset += chunkSize;
            readNextChunk(); // Continue reading after skipping the data chunk
          });
        }
        // Start reading chunks after the RIFF header
        readNextChunk();
      });
    });
  });
}

/**
 * Helper function to parse GUANO text into key-value pairs
 * @param {string} guanoText - GUANO text data
 * @returns {object} Parsed GUANO metadata
 */
function _parseMetadataText(text) {
  const metadata = {};
  // According to the GUANO Spec, the note field can contain escaped newline characters '\\n'
  // So, we'll substitute a placeholder to avoid conflicts
  const _tempGuano = text.replaceAll("\\n", "\uFFFF");
  const lines = _tempGuano.split("\n");

  lines.forEach((line) => {
    const colonIndex = line.indexOf(":");
    if (colonIndex !== -1) {
      const key = line.slice(0, colonIndex).trim();
      // Replace the placeholder with '\n'
      const value = line
        .slice(colonIndex + 1)
        .trim()
        .replaceAll("\uFFFF", "\n");

      try {
        // Attempt to parse JSON-like values
        if (
          (value.startsWith("[") && value.endsWith("]")) ||
          (value.startsWith("{") && value.endsWith("}"))
        ) {
          metadata[key] = JSON.parse(value);
        } else {
          metadata[key] = value;
        }
      } catch {
        metadata[key] = value;
      }
    }
  });

  return metadata;
}

export { extractWaveMetadata };
