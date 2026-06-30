const fs = require("fs");
const path = require("path");

// Define the directory where your source files are located
const SOURCE_DIR = process.cwd(); 

/**
 * Recursively scans a directory tree and checks JavaScript files for any of the provided regular-expression patterns.
 *
 * Only files with a ".js" extension are inspected; directories named "node_modules" or "unittest" are skipped during recursion.
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


// Strip UTF-8 BOM from files:

// Extensions we consider text (add more as needed) 
const textExt = new Set(['.txt', '.md', '.json', '.plist', '.js', '.jsx', '.ts', '.tsx']);

function stripBOMFromFile(file) { 
  try { 
    const buf = fs.readFileSync(file); // check for UTF-8 BOM (0xEF 0xBB 0xBF) 
    if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) { 
      const newBuf = buf.slice(3); 
      fs.writeFileSync(file, newBuf); 
      console.log('Stripped BOM:', file); } 
    } catch (err) { 
      // ignore binary read errors 
    } 
  }

function walk(dir) { 
  const entries = fs.readdirSync(dir, { withFileTypes: true }); 
  for (const e of entries) { 
    const full = path.join(dir, e.name); 
    if (e.isDirectory()) { 
      if (full.includes('node_modules') || full.includes('.git')) continue; 
      walk(full);
    } else { 
      const ext = path.extname(e.name).toLowerCase(); 
      if (textExt.has(ext) || e.name === 'LICENSE' || e.name === 'LICENSE.txt') { 
        stripBOMFromFile(full);
      } 
    } 
  } 
}

walk(process.cwd());

//Todo: insert app release date logic