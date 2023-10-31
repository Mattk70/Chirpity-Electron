const terser = require('terser');
const fs = require('fs');
const path = require('path');

const minifyOptions = {
    parse: {
        // parse options
    },
    compress: {
        // compress options
    },
    mangle: {
        // mangle options
        toplevel: true,
        properties: {
            // mangle property options
        }
    },
    format: {
        // format options (can also use `output` for backwards compatibility)
    },
    sourceMap: {
        // source map options
    },
    ecma: 2016, // specify one of: 5, 2015, 2016, etc.
    enclose: false, // or specify true, or "args:values"
    keep_classnames: false,
    keep_fnames: false,
    ie8: false,
    module: false,
    nameCache: null, // or specify a name cache object
    safari10: false,
    toplevel: true
}
// Directory containing your JavaScript files
const directory = process.cwd();

// Function to recursively minify JavaScript files
function minifyFiles(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(async  file => {
        const filePath = path.join(dir, file);

        if (fs.statSync(filePath).isDirectory() && ! filePath.endsWith('node_modules')) {
            // If it's a directory, recursively process its contents
            minifyFiles(filePath);
        } else if (filePath.endsWith('.js') && !fs.existsSync(filePath + '.map') && !filePath.endsWith('min.js')) {
            // If it's a JavaScript file, minify it and rename to *.min.js
            const inputCode = fs.readFileSync(filePath, 'utf8');
            const minifiedCode = await terser.minify(inputCode);
            if (minifiedCode.error) {
                console.error('Error minifying JavaScript:', minifiedCode.error);
            } else {
                // Rename the file to *.min.js
                const minifiedFilePath = filePath.replace(/\.js$/, '.min.js');
                console.log(filePath, minifiedFilePath)
                fs.writeFileSync(minifiedFilePath, minifiedCode.code, 'utf8');
                console.log(`Minified and renamed: ${minifiedFilePath}`);
            }
        }
    });
}

// Start minification from the root directory
minifyFiles(directory);
