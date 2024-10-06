////////// GUANO Support /////////////



/**
 * Extract GUANO metadata from a WAV file, without reading the entire file into memory.
 * @param {string} filePath - Path to the WAV file.
 * @returns {Promise<object|null>} - The extracted GUANO metadata or null if not found.
 */
function extractGuanoMetadata(filePath) {
    return new Promise((resolve, reject) => {
        // Open the file
        fs.open(filePath, 'r', (err, fd) => {
            if (err) return reject(err);

            const buffer = Buffer.alloc(12); // Initial buffer for RIFF header and first chunk header

            // Read the RIFF header (12 bytes)
            fs.read(fd, buffer, 0, 12, 0, (err) => {
                if (err) return reject(err);

                const chunkId = buffer.toString('utf-8', 0, 4); // Should be "RIFF"
                const format = buffer.toString('utf-8', 8, 12); // Should be "WAVE"

                if (chunkId !== 'RIFF' || format !== 'WAVE') {
                    return reject(new Error('Invalid WAV file'));
                }

                let currentOffset = 12; // Start after the RIFF header

                // Function to read the next chunk header
                function readNextChunk() {
                    const chunkHeaderBuffer = Buffer.alloc(8); // 8 bytes for chunk ID and size
                    fs.read(fd, chunkHeaderBuffer, 0, 8, currentOffset, (err) => {
                        if (err) return reject(err);

                        const chunkId = chunkHeaderBuffer.toString('utf-8', 0, 4); // Chunk ID
                        const chunkSize = chunkHeaderBuffer.readUInt32LE(4); // Chunk size
                        if (chunkSize === 0) return resolve(null) // No GUANO found

                        currentOffset += 8; // Move past the chunk header

                        if (chunkId === 'guan') {
                            // GUANO chunk found, read its content
                            const guanoBuffer = Buffer.alloc(chunkSize);
                            fs.read(fd, guanoBuffer, 0, chunkSize, currentOffset, (err) => {
                                if (err) return reject(err);

                                // GUANO data is UTF-8 encoded
                                const guanoText = guanoBuffer.toString('utf-8');
                                const guanoMetadata = _parseGuanoText(guanoText);
                                resolve(guanoMetadata);

                                fs.close(fd, () => {}); // Close the file descriptor
                            });
                        } else if (chunkId === 'data') {
                            // Skip over the data chunk (just move the offset)
                            currentOffset += chunkSize;
                            // Handle padding if chunkSize is odd
                            if (chunkSize % 2 !== 0) currentOffset += 1;
                            readNextChunk(); // Continue reading after skipping the data chunk
                        } else {
                            // Skip over any other chunk
                            currentOffset += chunkSize;
                            // Handle padding if chunkSize is odd
                            if (chunkSize % 2 !== 0) currentOffset += 1;
                            readNextChunk(); // Continue reading
                        }
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
function _parseGuanoText(guanoText) {
    const guanoMetadata = {};
    const lines = guanoText.split('\n');

    lines.forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
            const key = line.slice(0, colonIndex).trim();
            const value = line.slice(colonIndex + 1).trim();
            
            try {
                // Attempt to parse JSON-like values
                if ((value.startsWith('[') && value.endsWith(']')) ||
                    (value.startsWith('{') && value.endsWith('}'))) {
                    guanoMetadata[key] = JSON.parse(value);
                } else {
                    guanoMetadata[key] = value;
                }
            } catch {
                guanoMetadata[key] = value;
            }
        }
    });

    return guanoMetadata;
}


export {extractGuanoMetadata}