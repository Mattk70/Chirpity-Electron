
const fs = require('node:fs');
const path = require('node:path');
const csv = require('fast-csv');

const jsonFile = path.join(__dirname, '2025-filtered.json');
const csvFile = path.join(__dirname, '../BirdNET3/BirdNET3_geomodel_labels.csv');

const jsonOnlyFile = path.join(__dirname, 'json-only.json');
const csvOnlyFile = path.join(__dirname, 'csv-only-aves.json');

/**
 * Compare image metadata with BirdNET scientific names, write sorted unmatched-name
 * lists, and overwrite 2025-filtered.json with entries present in the CSV.
 * The CSV-only list includes only Aves; JSON entries are matched against all classes.
 *
 * @returns {Promise<void>} Resolves after writing the files. Rejects on JSON parsing,
 * CSV parser, or synchronous file I/O errors; completed writes are not rolled back.
 */
async function main() {
    // Load filtered JSON: scientific names are object keys
    const jsonData = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    const jsonNames = new Set(Object.keys(jsonData));

    // Collect scientific names from the CSV
    const csvNames = new Set();
    const avesNames = new Set();

    await new Promise((resolve, reject) => {
        fs.createReadStream(csvFile)
            .pipe(csv.parse({ headers: true, trim: true }))
            .on('error', reject)
            .on('data', row => {
                const sciName = row.sci_name?.trim();

                if (!sciName) return;

                csvNames.add(sciName);

                if (row.class_name?.trim() === 'Aves') {
                    avesNames.add(sciName);
                }
            })
            .on('end', resolve);
    });

    // Names in JSON but not anywhere in the CSV
    const jsonOnly = [...jsonNames]
        .filter(name => !csvNames.has(name))
        .sort();

    // Aves names in CSV but not in JSON
    const csvOnly = [...avesNames]
        .filter(name => !jsonNames.has(name))
        .sort();

    // Save unmatched names
    fs.writeFileSync(
        jsonOnlyFile,
        JSON.stringify(jsonOnly, null, 2) + '\n'
    );

    fs.writeFileSync(
        csvOnlyFile,
        JSON.stringify(csvOnly, null, 2) + '\n'
    );

    // Report results
    console.log('Cross-match results');
    console.log('===================');
    console.log(`Unique scientific names in JSON: ${jsonNames.size}`);
    console.log(`Unique scientific names in CSV: ${csvNames.size}`);
    console.log(`Unique Aves scientific names in CSV: ${avesNames.size}`);
    console.log();
    console.log(`In JSON but not in CSV: ${jsonOnly.length}`);
    console.log(`In CSV (Aves) but not in JSON: ${csvOnly.length}`);
    console.log();
    console.log(`Saved JSON-only names to: ${jsonOnlyFile}`);
    console.log(`Saved CSV-only Aves names to: ${csvOnlyFile}`);


    // Remove JSON entries whose scientific names are absent from the CSV
    let removedCount = 0;

    for (const sciName of Object.keys(jsonData)) {
        if (!csvNames.has(sciName)) {
            delete jsonData[sciName];
            removedCount++;
        }
    }

    // Overwrite the filtered JSON file
    fs.writeFileSync(
        jsonFile,
        JSON.stringify(jsonData, null, 2) + '\n'
    );

    console.log(`Removed ${removedCount} entries not found in the CSV.`);
    console.log(`Remaining entries: ${Object.keys(jsonData).length}`);


}

main().catch(error => {
    console.error('Error:', error.message);
    process.exitCode = 1;
});
