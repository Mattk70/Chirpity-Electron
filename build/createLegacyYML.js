const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
exports.default = async function (context) {
    const {outDir, artifactPaths} = context;
    const dest = path.join(outDir, `latest.yml`);
    let filePath = artifactPaths.find(path => path.includes('Setup'))
    if (!filePath) return;
    filePath = filePath.replace('.blockmap', '');
    console.log(filePath);
    const baseName = path.basename(filePath); // e.g. "Chirpity Setup 5.6.2.exe"

    // Use a regex to find version number (format: X.Y.Z)
    const match = baseName.match(/(\d+\.\d+\.\d+)/);
let version;
    if (match) {
        version = match[1];
        console.log("Version:", version); // "5.6.2"
    } else {
        console.log("Version not found in filename");
        return
    }

function getFileSize(filePath) {
  const stats = fs.statSync(filePath);
  return stats.size;
}
function getSha512(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha512");
    const stream = fs.createReadStream(filePath);

    stream.on("error", reject);
    stream.on("data", chunk => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("base64"))); // Electron Builder expects base64
  });
}
const date = new Date().toISOString();
const sha512 = await getSha512(filePath).catch(err => console.error(err));;
console.log("SHA-512:", sha512);
const size = getFileSize(filePath)


    const yaml = `version: ${version}
files:
    - url: Chirpity-Setup-${version}.exe
      sha512: ${sha512}
      size: ${size}
path: Chirpity-Setup-${version}.exe
sha512: ${sha512}
releaseDate: '${date}'
`

fs.writeFileSync(dest, yaml);
console.log(`Created legacy update file: ${dest}`);
};