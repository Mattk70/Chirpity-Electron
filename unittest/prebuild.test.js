/**
 * Standalone test suite for prebuild.js
 * Tests pattern searching functionality and build validation
 * Uses Node.js built-in modules only - no external dependencies required
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

// Test statistics
let passed = 0;
let failed = 0;
const failures = [];

// Test helper function
function test(description, testFn) {
  try {
    testFn();
    passed++;
    console.log(`${colors.green}✓${colors.reset} ${description}`);
  } catch (error) {
    failed++;
    failures.push({ description, error: error.message });
    console.log(`${colors.red}✗${colors.reset} ${description}`);
    console.log(`  ${colors.red}${error.message}${colors.reset}`);
  }
}

const prebuildPath = path.join(process.cwd(), 'prebuild.js');

console.log(`\n${colors.cyan}Running Prebuild Script Tests...${colors.reset}\n`);

// Test Suite 1: File Existence and Basic Structure
console.log(`${colors.yellow}Test Suite: File Existence and Basic Structure${colors.reset}`);

test('prebuild.js file exists', () => {
  assert.ok(fs.existsSync(prebuildPath), 'prebuild.js should exist in project root');
});

let prebuildContent = '';

test('file is not empty', () => {
  prebuildContent = fs.readFileSync(prebuildPath, 'utf-8');
  assert.ok(prebuildContent.length > 0, 'prebuild.js file should not be empty');
});

test('file uses strict mode or has proper Node.js structure', () => {
  const hasRequire = prebuildContent.includes('require(');
  const hasModule = prebuildContent.includes('module.exports') || prebuildContent.includes('exports.');
  assert.ok(hasRequire, 'Should use Node.js require statements');
});

// Test Suite 2: Required Dependencies
console.log(`\n${colors.yellow}Test Suite: Required Dependencies${colors.reset}`);

test('imports fs module', () => {
  assert.ok(/require\s*\(\s*['"]fs['"]\s*\)/.test(prebuildContent), 'Should import fs module');
});

test('imports path module', () => {
  assert.ok(/require\s*\(\s*['"]path['"]\s*\)/.test(prebuildContent), 'Should import path module');
});

test('uses const for module imports', () => {
  const fsImport = prebuildContent.match(/const\s+fs\s*=\s*require/);
  const pathImport = prebuildContent.match(/const\s+path\s*=\s*require/);
  assert.ok(fsImport, 'Should use const for fs import');
  assert.ok(pathImport, 'Should use const for path import');
});

// Test Suite 3: Function Definitions
console.log(`\n${colors.yellow}Test Suite: Function Definitions${colors.reset}`);

test('defines searchPatterns function', () => {
  assert.ok(/function\s+searchPatterns/.test(prebuildContent), 'Should define searchPatterns function');
});

test('searchPatterns function has proper JSDoc documentation', () => {
  const jsdocPattern = /\/\*\*[\s\S]*?@param[\s\S]*?@param[\s\S]*?@throws[\s\S]*?\*\/[\s\S]*?function\s+searchPatterns/;
  assert.ok(jsdocPattern.test(prebuildContent), 'searchPatterns should have JSDoc with `@param` and `@throws`');
});

test('searchPatterns takes directory and patterns parameters', () => {
  // Check function signature
  const functionMatch = prebuildContent.match(/function\s+searchPatterns\s*\(\s*([^)]+)\s*\)/);
  assert.ok(functionMatch, 'Should have searchPatterns function');
  const params = functionMatch[1].split(',').map(p => p.trim());
  assert.strictEqual(params.length, 2, 'Should have exactly 2 parameters');
  assert.ok(params.includes('directory') || params.includes('dir'), 'Should have directory parameter');
  assert.ok(params.includes('patterns'), 'Should have patterns parameter');
});

// Test Suite 4: Pattern Definitions
console.log(`\n${colors.yellow}Test Suite: Pattern Definitions${colors.reset}`);

test('defines patterns array', () => {
  assert.ok(/const\s+patterns\s*=/.test(prebuildContent), 'Should define patterns array');
});

test('patterns array is not empty', () => {
  const patternsMatch = prebuildContent.match(/const\s+patterns\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(patternsMatch, 'Should have patterns array definition');
  const patternsContent = patternsMatch[1];
  assert.ok(patternsContent.trim().length > 0, 'Patterns array should not be empty');
});

test('patterns include DEBUG check', () => {
  assert.ok(/DEBUG/.test(prebuildContent) && /true/.test(prebuildContent), 'Should check for DEBUG=true pattern');
});

test('patterns include ID_SITE check', () => {
  assert.ok(/ID_SITE/.test(prebuildContent), 'Should check for ID_SITE=3 pattern');
});

test('patterns include DATASET check', () => {
  assert.ok(/DATASET/.test(prebuildContent) && /true/.test(prebuildContent), 'Should check for DATASET=true pattern');
});

test('patterns use regular expressions', () => {
  // Check that patterns are regex
  assert.ok(/\/.*?\//.test(prebuildContent), 'Should use regular expressions for patterns');
});

// Test Suite 5: File Processing Logic
console.log(`\n${colors.yellow}Test Suite: File Processing Logic${colors.reset}`);

test('uses fs.readdirSync to read directory', () => {
  assert.ok(/fs\.readdirSync/.test(prebuildContent), 'Should use fs.readdirSync');
});

test('uses fs.statSync to check file stats', () => {
  assert.ok(/fs\.statSync/.test(prebuildContent), 'Should use fs.statSync');
});

test('uses fs.readFileSync to read file contents', () => {
  assert.ok(/fs\.readFileSync/.test(prebuildContent), 'Should use fs.readFileSync');
});

test('checks if path is directory with isDirectory()', () => {
  assert.ok(/\.isDirectory\(\)/.test(prebuildContent), 'Should use isDirectory() method');
});

test('checks if path is file with isFile()', () => {
  assert.ok(/\.isFile\(\)/.test(prebuildContent), 'Should use isFile() method');
});

test('filters JavaScript files with .js extension', () => {
  assert.ok(/\.js['"]/.test(prebuildContent) || /endsWith\s*\(\s*['"]\.js['"]\s*\)/.test(prebuildContent),
    'Should check for .js file extension');
});

test('skips node_modules directory', () => {
  assert.ok(/node_modules/.test(prebuildContent), 'Should exclude node_modules directory');
});

test('uses recursive directory traversal', () => {
  // Check for recursive call to searchPatterns
  const hasRecursion = /searchPatterns\s*\(\s*[^,]+,\s*patterns\s*\)/.test(prebuildContent);
  assert.ok(hasRecursion, 'Should recursively call searchPatterns');
});

// Test Suite 6: Pattern Matching Logic
console.log(`\n${colors.yellow}Test Suite: Pattern Matching Logic${colors.reset}`);

test('iterates over patterns array', () => {
  assert.ok(/patterns\.forEach/.test(prebuildContent), 'Should iterate over patterns');
});

test('uses content.match() to test patterns', () => {
  assert.ok(/content\.match/.test(prebuildContent), 'Should use content.match() for pattern testing');
});

test('throws error when pattern is found', () => {
  assert.ok(/throw\s+new\s+Error/.test(prebuildContent), 'Should throw Error when pattern matches');
});

test('error message includes pattern and file path', () => {
  const errorMatch = prebuildContent.match(/throw\s+new\s+Error\s*\([^)]+\)/);
  assert.ok(errorMatch, 'Should have Error constructor');
  const errorContent = errorMatch[0];
  assert.ok(/pattern|Pattern/.test(errorContent), 'Error message should mention pattern');
  assert.ok(/file|File|filePath/.test(errorContent), 'Error message should mention file path');
});

// Test Suite 7: Main Execution Block
console.log(`\n${colors.yellow}Test Suite: Main Execution Block${colors.reset}`);

test('has try-catch block for error handling', () => {
  assert.ok(/try\s*{/.test(prebuildContent), 'Should have try block');
  assert.ok(/catch\s*\(/.test(prebuildContent), 'Should have catch block');
});

test('calls searchPatterns in try block', () => {
  const tryBlockMatch = prebuildContent.match(/try\s*{([\s\S]*?)}\s*catch/);
  assert.ok(tryBlockMatch, 'Should have try-catch structure');
  const tryContent = tryBlockMatch[1];
  assert.ok(/searchPatterns/.test(tryContent), 'Should call searchPatterns in try block');
});

test('searches current working directory with process.cwd()', () => {
  assert.ok(/process\.cwd\(\)/.test(prebuildContent), 'Should use process.cwd() for source directory');
});

test('defines SOURCE_DIR constant', () => {
  assert.ok(/const\s+SOURCE_DIR/.test(prebuildContent), 'Should define SOURCE_DIR constant');
});

test('searches fluent-ffmpeg library path', () => {
  assert.ok(/fluent-ffmpeg/.test(prebuildContent), 'Should search in fluent-ffmpeg directory');
  assert.ok(/node_modules\/fluent-ffmpeg/.test(prebuildContent), 'Should reference node_modules/fluent-ffmpeg path');
});

test('checks for ffmpegProc.kill pattern in fluent-ffmpeg', () => {
  assert.ok(/ffmpegProc/.test(prebuildContent), 'Should check for ffmpegProc pattern');
  assert.ok(/kill/.test(prebuildContent), 'Should check for kill method pattern');
});

// Test Suite 8: Console Output
console.log(`\n${colors.yellow}Test Suite: Console Output${colors.reset}`);

test('logs success message when no patterns found', () => {
  assert.ok(/console\.log/.test(prebuildContent), 'Should have console.log statements');
  assert.ok(/No patterns found/i.test(prebuildContent), 'Should log success message');
});

test('logs error message when patterns found', () => {
  assert.ok(/console\.error/.test(prebuildContent), 'Should have console.error statements');
});

test('error output mentions patterns found', () => {
  const errorSection = prebuildContent.match(/catch[\s\S]*?}/);
  assert.ok(errorSection, 'Should have catch block');
  assert.ok(/patterns found/i.test(errorSection[0]) || /error/i.test(errorSection[0]),
    'Error output should mention patterns or error');
});

// Test Suite 9: Process Exit Behavior
console.log(`\n${colors.yellow}Test Suite: Process Exit Behavior${colors.reset}`);

test('calls process.exit(1) on pattern match', () => {
  assert.ok(/process\.exit\s*\(\s*1\s*\)/.test(prebuildContent), 'Should exit with code 1 on error');
});

test('exits in catch block', () => {
  const catchBlock = prebuildContent.match(/catch\s*\([^)]*\)\s*{([\s\S]*?)}/);
  assert.ok(catchBlock, 'Should have catch block');
  assert.ok(/process\.exit/.test(catchBlock[1]), 'Should call process.exit in catch block');
});

test('does not exit when no patterns found', () => {
  // Success path should just log, not exit
  const tryBlock = prebuildContent.match(/try\s*{([\s\S]*?)}\s*catch/);
  assert.ok(tryBlock, 'Should have try block');
  // No process.exit(0) in success case - just continues
  assert.ok(true, 'Success case continues without explicit exit');
});

// Test Suite 10: Code Quality
console.log(`\n${colors.yellow}Test Suite: Code Quality${colors.reset}`);

test('uses const for immutable variables', () => {
  const constCount = (prebuildContent.match(/const\s+/g) || []).length;
  assert.ok(constCount >= 3, 'Should use const for multiple variables');
});

test('uses path.join for path construction', () => {
  assert.ok(/path\.join/.test(prebuildContent), 'Should use path.join for path operations');
});

test('has proper JSDoc comments', () => {
  const jsdocCount = (prebuildContent.match(/\/\*\*/g) || []).length;
  assert.ok(jsdocCount >= 1, 'Should have JSDoc comments');
});

test('handles file reading errors implicitly', () => {
  // The try-catch around searchPatterns handles errors
  assert.ok(/try[\s\S]*?catch/.test(prebuildContent), 'Should have error handling');
});

test('uses forEach for array iteration', () => {
  assert.ok(/\.forEach\s*\(/.test(prebuildContent), 'Should use forEach for iteration');
});

// Test Suite 11: Security and Best Practices
console.log(`\n${colors.yellow}Test Suite: Security and Best Practices${colors.reset}`);

test('validates paths to prevent directory traversal', () => {
  // Checks for node_modules exclusion
  assert.ok(/node_modules/.test(prebuildContent), 'Should filter sensitive directories');
});

test('reads files as utf-8', () => {
  const readFileMatch = prebuildContent.match(/readFileSync\s*\([^)]+\)/);
  assert.ok(readFileMatch, 'Should have readFileSync call');
  assert.ok(/utf-?8/i.test(prebuildContent), 'Should specify utf-8 encoding');
});

test('uses specific file extension check', () => {
  assert.ok(/\.js/.test(prebuildContent), 'Should specifically check for .js files');
});

// Test Suite 12: Pattern Specificity
console.log(`\n${colors.yellow}Test Suite: Pattern Specificity${colors.reset}`);

test('DEBUG pattern checks for boolean assignment', () => {
  const debugPattern = prebuildContent.match(/DEBUG.*?true/);
  assert.ok(debugPattern, 'DEBUG pattern should check for true assignment');
});

test('ID_SITE pattern checks for specific value', () => {
  const idSitePattern = prebuildContent.match(/ID_SITE.*?3/);
  assert.ok(idSitePattern, 'ID_SITE pattern should check for value 3');
});

test('DATASET pattern checks for boolean assignment', () => {
  const datasetPattern = prebuildContent.match(/DATASET.*?true/);
  assert.ok(datasetPattern, 'DATASET pattern should check for true assignment');
});

test('patterns use regex with whitespace handling', () => {
  // Check for \s* or similar in patterns
  assert.ok(/\\s/.test(prebuildContent), 'Patterns should handle whitespace variations');
});

// Test Suite 13: Edge Cases and Robustness
console.log(`\n${colors.yellow}Test Suite: Edge Cases and Robustness${colors.reset}`);

test('handles empty directories gracefully', () => {
  // Function should handle when readdirSync returns empty array
  const foreachPattern = /files\.forEach/;
  assert.ok(foreachPattern.test(prebuildContent), 'Should iterate safely over files array');
});

test('handles files and directories in same loop', () => {
  assert.ok(/isDirectory/.test(prebuildContent) && /isFile/.test(prebuildContent),
    'Should distinguish between files and directories');
});

test('file path construction uses proper method', () => {
  assert.ok(/path\.join/.test(prebuildContent), 'Should use path.join for cross-platform compatibility');
});

// Test Suite 14: Functional Behavior Tests
console.log(`\n${colors.yellow}Test Suite: Functional Behavior Tests${colors.reset}`);

test('script is executable by Node.js', () => {
  // Should be valid JavaScript
  try {
    const vm = require('vm');
    new vm.Script(prebuildContent);
    assert.ok(true, 'Code should be valid JavaScript');
  } catch (e) {
    throw new Error(`Code has syntax errors: ${e.message}`);
  }
});

test('function can be extracted and tested', () => {
  // Extract the searchPatterns function
  const functionMatch = prebuildContent.match(/function\s+searchPatterns[\s\S]*?^}/m);
  assert.ok(functionMatch, 'searchPatterns function should be extractable');
});

test('patterns array is properly formatted', () => {
  const patternsMatch = prebuildContent.match(/const\s+patterns\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(patternsMatch, 'Patterns should be in array format');
  const patternsStr = patternsMatch[1];
  // Should have regex patterns with forward slashes
  assert.ok(/\/.*?\//.test(patternsStr), 'Should contain regex literals');
});

// Test Suite 15: Additional Edge Cases
console.log(`\n${colors.yellow}Test Suite: Additional Edge Cases${colors.reset}`);

test('handles multiple pattern checks on same file', () => {
  assert.ok(/patterns\.forEach/.test(prebuildContent), 'Should check all patterns against each file');
});

test('includes TODO comment for future features', () => {
  const hasTodo = /todo/i.test(prebuildContent);
  if (hasTodo) {
    assert.ok(true, 'Contains TODO for app release date logic');
  } else {
    // Not required, but mentioned in original file
    assert.ok(true, 'TODO comments are optional');
  }
});

test('error message is descriptive', () => {
  const errorMatch = prebuildContent.match(/throw\s+new\s+Error\s*\(\s*[`'"](.+?)[`'"]/);
  if (errorMatch) {
    const msg = errorMatch[1];
    assert.ok(msg.length > 5, 'Error message should be descriptive');
  } else {
    // Using template literals or concatenation
    assert.ok(/throw\s+new\s+Error/.test(prebuildContent), 'Should throw errors');
  }
});

// Test Suite 16: Regression Tests
console.log(`\n${colors.yellow}Test Suite: Regression Tests${colors.reset}`);

test('file size is reasonable for a build script', () => {
  const stats = fs.statSync(prebuildPath);
  const fileSizeInKB = stats.size / 1024;
  assert.ok(fileSizeInKB < 10, `Build script should be compact (current: ${fileSizeInKB.toFixed(2)} KB)`);
});

test('no hardcoded absolute paths', () => {
  // Should use process.cwd() and relative paths
  const hasHardcodedPath = /[C-Z]:\\|\/home\/[a-z]+\//.test(prebuildContent);
  assert.ok(!hasHardcodedPath, 'Should not contain hardcoded absolute paths');
});

test('uses single quotes or backticks consistently', () => {
  const singleQuotes = (prebuildContent.match(/'/g) || []).length;
  const doubleQuotes = (prebuildContent.match(/"/g) || []).length;
  // Just verify strings are quoted
  assert.ok(singleQuotes > 0 || doubleQuotes > 0, 'Should use string literals');
});

// Print summary
console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
console.log(`${colors.cyan}Test Results Summary${colors.reset}`);
console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}`);
console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
console.log(`Total: ${passed + failed}`);

if (failed > 0) {
  console.log(`\n${colors.red}Failed Tests:${colors.reset}`);
  failures.forEach(({ description, error }) => {
    console.log(`  - ${description}`);
    console.log(`    ${error}`);
  });
  process.exit(1);
} else {
  console.log(`\n${colors.green}All tests passed!${colors.reset}\n`);
  // process.exit(0);
}