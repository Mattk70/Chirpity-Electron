
const fs = require('node:fs');
const path = require('node:path');

const inputFile = path.join(__dirname, '2025.json');
const outputFile = path.join(__dirname, '2025-filtered.json');

try {
    // Read and parse the input JSON
    const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

    if (!Array.isArray(data)) {
        throw new Error('Expected the JSON file to contain an array.');
    }

    const filtered = Object.create(null);
    const licenceCounts = Object.create(null);

    for (const { sciName, license, key, by, code } of data) {
        if (!sciName) {
            console.warn('Skipping record without a sciName.');
            continue;
        }

        // Store metadata keyed by scientific name
        filtered[sciName] = { license, key, by, code };

        // Count licence types
        const licence = license ?? '(missing)';
        licenceCounts[licence] = (licenceCounts[licence] || 0) + 1;
    }

    // Save the lookup object
    fs.writeFileSync(
        outputFile,
        JSON.stringify(filtered, null, 2) + '\n',
        'utf8'
    );

    // Report results
    console.log(`Read ${data.length} records.`);
    console.log(`Saved ${Object.keys(filtered).length} species to ${outputFile}\n`);

    console.log('Counts by licence type:');
    for (const [licence, count] of Object.entries(licenceCounts).sort()) {
        console.log(`  ${licence}: ${count}`);
    }

} catch (error) {
    console.error('Error:', error.message);
    process.exitCode = 1;
}
