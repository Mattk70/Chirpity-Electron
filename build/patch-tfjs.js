const fs = require("fs");
const path = require("path");

const target = path.join(
  __dirname,
  "..",
  "node_modules",
  "@tensorflow",
  "tfjs-node",
  "dist",
  "nodejs_kernel_backend.js"
);

if (!fs.existsSync(target)) {
  console.warn("TFJS target file not found:", target);
  process.exit(0);
}

let code = fs.readFileSync(target, "utf8");

// guard: already patched?
if (code.includes("util_1.isNullOrUndefined = (x) => x === null || x === undefined;")) {
  console.log("TFJS util shim already applied.");
  process.exit(0);
}

// 1. ensure require("util") exists
// (safe: replace or insert after existing requires)
if (!code.includes('require("util")')) {
  // try to inject after other requires
  code = code.replace(
    /(var\s+.*require\(["']util["']\);?\s*\n)?/,
    (match) => {
      if (match.includes("require")) return match;
      return match + 'var util_1 = require("util");\n';
    }
  );

  // fallback if not inserted
  if (!code.includes('var util_1 = require("util")')) {
    code = 'var util_1 = require("util");\n' + code;
  }
}

// 2. patch missing functions
const shim = `
util_1.isArray = Array.isArray;
util_1.isNullOrUndefined = (x) => x === null || x === undefined;
`;

code += "\n" + shim;

fs.writeFileSync(target, code, "utf8");

console.log("TFJS util shim applied successfully."); 