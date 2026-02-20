const fs = require("fs");
const path = require("path");

// Define the directory where your source files are located
const SOURCE_DIR = process.cwd(); 

/**
 * Recursively scans a directory tree and checks JavaScript files for any of the provided regular-expression patterns.
 *
 * Only files with a ".js" extension are inspected; directories named "node_modules" are skipped during recursion.
 *
 * @param {string} directory - Path to the directory to scan.
 * @param {RegExp[]} patterns - Array of regular expressions to test against each JavaScript file's contents.
 * @throws {Error} If any pattern matches a file's contents; the error message includes the matching pattern and the file path.
 */
function searchPatterns(directory, patterns) {
  const files = fs.readdirSync(directory);

  files.forEach((file) => {
    const filePath = path.join(directory, file);
    const stats = fs.statSync(filePath);
    if (stats.isDirectory() || file.endsWith(".js")) {
      if (stats.isDirectory()) {
        if (!(filePath.includes("node_modules") || filePath.includes("unittest")) ) {
          searchPatterns(filePath, patterns);
        }
      } else if (stats.isFile()) {
        const content = fs.readFileSync(filePath, "utf8");
        patterns.forEach((pattern) => {
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
  /ID_SITE\s*=\s*3/,
  /DATASET\s*=\s*true/,
  // Add more patterns as needed
];

// Search for the patterns in the source directory
try {
  searchPatterns(SOURCE_DIR, patterns);
  searchPatterns(SOURCE_DIR + "/node_modules/fluent-ffmpeg/lib", [
    /ffmpegProc\.kill\(\);?\s+\},\s*\d{1,3}\s*\);?/,
  ]);
  console.log("No patterns found. Proceeding with the build...");
} catch (error) {
  console.error(
    "An error occurred while searching for the patterns:",
    error.message
  );
  console.error("One or more patterns found. Aborting the build.");
  process.exit(1);
}

//Todo: insert app release date logic