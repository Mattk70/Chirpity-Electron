const fs = require("fs");
const path = require("path");

// Define the directory where your source files are located
let SOURCE_DIR = process.cwd(); //"C:/Users/simpo/PycharmProjects/Chirpity-Electron";
if (!fs.existsSync(SOURCE_DIR))
  SOURCE_DIR = "/Users/matthew/PycharmProjects/Chirpity-Electron";
// Function to recursively search for patterns in files
function searchPatterns(directory, patterns) {
  const files = fs.readdirSync(directory);

  files.forEach((file) => {
    const filePath = path.join(directory, file);
    const stats = fs.statSync(filePath);
    if (stats.isDirectory() || file.endsWith(".js")) {
      if (stats.isDirectory()) {
        if (!filePath.includes("node_modules")) {
          searchPatterns(filePath, patterns);
        }
      } else if (stats.isFile()) {
        console.log(filePath);
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
    /ffmpegProc.kill\(\);?\s+\},\s*\d{1,3}\s*\);?/,
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
