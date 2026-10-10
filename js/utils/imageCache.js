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
/**
 * Read the bundled lookup of image metadata by scientific name.
 * @returns {Promise<Object>} Parsed metadata, or an empty object if reading or parsing fails.
 */
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

/**
 * Download an AviCommons thumbnail and overwrite its file in the user thumbnail cache.
 *
 * @param {string} sciName - Exact scientific-name key in the bundled image metadata.
 * @returns {Promise<Array>} Local JPEG path, license, and photographer, in that order.
 * @throws {Error} Rejects if source metadata is missing or the HTTP response is unsuccessful,
 * or if creating the cache directory, reading the response body, or writing the file fails.
 * @throws {TypeError} Rejects on a network failure after the original fetch error is caught.
 */
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

/**
 * Return a cached thumbnail and its attribution, downloading it when cache access or
 * metadata lookup fails. An existing file is downloaded again if metadata is not yet loaded.
 *
 * @param {string} sciName - Exact scientific-name key in the bundled image metadata.
 * @returns {Promise<Array>} Local JPEG path, license, and photographer, in that order.
 * @throws {Error} Rejects with download or cache-write errors from {@link getAviCommonsImage}.
 */
async function retrieveThumbnail(sciName) {
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