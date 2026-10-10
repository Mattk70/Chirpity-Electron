const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const appData = process.platform === 'win32'
    ? process.env.APPDATA
    : process.platform === 'darwin'
        ? path.join(os.homedir(), 'Library', 'Application Support')
        : process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
const userData = path.join(appData, 'Chirpity');
const imageJsonPath = path.resolve(__dirname, '..', '..', 'BirdNET3', 'imageData', 'avicommons-2025-filtered.json');
const thumbnailDir = path.join(userData, 'thumbnails', 'cached');
let imageJSON = null;
async function parseImageJSON() {
    let imageJSON;
    try {
        const json = await fs.readFile(imageJsonPath, 'utf8');
        imageJSON = JSON.parse(json);
    } catch (error) {
        console.error('Failed to load image sources:', error);
        imageJSON = {};
    }
    return imageJSON
}

async function getAviCommonsImage(sciName) {
    imageJSON ??= await parseImageJSON();
    const source = imageJSON?.[sciName];

    if (!source?.code || !source?.key) {
        throw new Error(`No Avicommons image source found for ${sciName}`);
    }
    const {code, key, by, license} = source;
    const url = `https://static.avicommons.org/${code}-${key}-320.jpg`;
    const filePath = path.join(thumbnailDir, `${sciName}.jpg`);

    await fs.mkdir(thumbnailDir, { recursive: true });

    const response = await fetch(url).catch(console.warn);

    if (!response.ok) {
        throw new Error(`Failed to fetch image for ${sciName}: HTTP ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    return [filePath, license, by];
}

async function retrieveThumbnail(sciName) {
    imageJSON ??= await parseImageJSON();
    const filePath = path.join(thumbnailDir, `${sciName}.jpg`);

    try {
        await fs.access(filePath);
        const {license, by} = imageJSON[sciName];
        return [filePath, license, by];
    } catch {
        return await getAviCommonsImage(sciName);
    }
}

module.exports = { retrieveThumbnail };