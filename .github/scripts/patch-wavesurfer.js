const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../../node_modules/wavesurfer.js/dist/player.js');
let contents = fs.readFileSync(filePath, 'utf8');

contents = contents.replace(
  /return this\.media\.play\(\);/,
  `try {
        return this.media.play();
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        throw err;
      }`
);

fs.writeFileSync(filePath, contents);
console.log('✅ Patched wavesurfer.js play()');
