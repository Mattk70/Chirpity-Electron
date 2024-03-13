const fs = require('fs');
const path = require('path');

// Define the directory where your source files are located
const SOURCE_DIR = "C:/Users/simpo/PycharmProjects/Chirpity-Electron";

// Function to recursively search for patterns in files
function searchPatterns(directory, patterns) {
    const files = fs.readdirSync(directory);

    files.forEach(file => {
        const filePath = path.join(directory, file);
        console.log(filePath)
        const stats = fs.statSync(filePath);
        if (stats.isDirectory() || file.endsWith('.js')){
            if (stats.isDirectory()) {
                if (! filePath.includes('node_modules')) {
                    searchPatterns(filePath, patterns);
                }
            } else if (stats.isFile()) {
                const content = fs.readFileSync(filePath, 'utf8');
                patterns.forEach(pattern => {
                    if (content.match(pattern)) {
                        throw new Error(`Pattern '${pattern}' found in file: ${filePath}`);
                        // You can add further actions here if needed
                    }
                });
            }
        }
    });
}

// Define the patterns you want to search for
const patterns = [
    /DEBUG\s*=\s*true/,
    /ID_SITE\s*=\s*3/
    // Add more patterns as needed
];

// Search for the patterns in the source directory
try {
    searchPatterns(SOURCE_DIR, patterns);
    console.log("No patterns found. Proceeding with the build...");
} catch (error) {
    console.error("An error occurred while searching for the patterns:", error.message);
    console.error("One or more patterns found. Aborting the build.");
    process.exit(1);
}
