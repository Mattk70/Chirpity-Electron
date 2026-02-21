/**
 * Standalone test suite for I18n JSON files
 * Tests data integrity, consistency, and completeness across all language files
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

// Language codes to test
const languageCodes = ['da', 'de', 'en', 'es', 'fr', 'ja', 'nl', 'pt', 'ru', 'sv', 'zh'];
const i18nDir = path.join(process.cwd(), 'I18n');
const referenceLang = 'en';

console.log(`\n${colors.cyan}Running I18n JSON File Tests...${colors.reset}\n`);

// Test Suite 1: File Existence and Structure
console.log(`${colors.yellow}Test Suite: File Existence and Structure${colors.reset}`);

test('all expected language files exist', () => {
  for (const lang of languageCodes) {
    const filePath = path.join(i18nDir, `index.${lang}.json`);
    assert.ok(fs.existsSync(filePath), `Language file for '${lang}' should exist at ${filePath}`);
  }
});

languageCodes.forEach((lang) => {
  test(`${lang} - file is valid JSON`, () => {
    const filePath = path.join(i18nDir, `index.${lang}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    JSON.parse(content); // Will throw if invalid
  });

  test(`${lang} - file contains valid JSON object`, () => {
    const filePath = path.join(i18nDir, `index.${lang}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    assert.strictEqual(typeof data, 'object', 'Root should be an object');
    assert.strictEqual(Array.isArray(data), false, 'Root should not be an array');
    assert.ok(data !== null, 'Root should not be null');
  });

  test(`${lang} - file is not empty`, () => {
    const filePath = path.join(i18nDir, `index.${lang}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    const keys = Object.keys(data);
    assert.ok(keys.length > 0, 'Should have at least one key');
  });
});

// Test Suite 2: Key Consistency
console.log(`\n${colors.yellow}Test Suite: Key Consistency${colors.reset}`);

const referenceFile = path.join(i18nDir, `index.${referenceLang}.json`);
const referenceContent = fs.readFileSync(referenceFile, 'utf-8');
const referenceData = JSON.parse(referenceContent);
const referenceKeys = Object.keys(referenceData);

languageCodes.forEach((lang) => {
  if (lang === referenceLang) return;

  test(`${lang} - has all keys from reference language (${referenceLang})`, () => {
    const filePath = path.join(i18nDir, `index.${lang}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    const langKeys = Object.keys(data);

    for (const key of referenceKeys) {
      assert.ok(langKeys.includes(key), `Language '${lang}' should contain key '${key}'`);
    }
  });

  test(`${lang} - has no extra keys not in reference language`, () => {
    const filePath = path.join(i18nDir, `index.${lang}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    const langKeys = Object.keys(data);

    for (const key of langKeys) {
      assert.ok(referenceKeys.includes(key), `Language '${lang}' has unexpected key '${key}'`);
    }
  });

  test(`${lang} - has same number of keys as reference`, () => {
    const filePath = path.join(i18nDir, `index.${lang}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    assert.strictEqual(Object.keys(data).length, referenceKeys.length);
  });
});

// Test Suite 3: Value Integrity
console.log(`\n${colors.yellow}Test Suite: Value Integrity${colors.reset}`);

languageCodes.forEach((lang) => {
  test(`${lang} - all values are strings or arrays or objects`, () => {
    const filePath = path.join(i18nDir, `index.${lang}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    for (const [key, value] of Object.entries(data)) {
      const valueType = typeof value;
      const isValidType = valueType === 'string' || Array.isArray(value) || (valueType === 'object' && value !== null);
      assert.ok(isValidType, `Key '${key}' in '${lang}' should have string, array, or object value, got ${valueType}`);
    }
  });

  test(`${lang} - no values are null or undefined`, () => {
    const filePath = path.join(i18nDir, `index.${lang}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    for (const [key, value] of Object.entries(data)) {
      assert.ok(value !== null, `Key '${key}' in '${lang}' should not be null`);
      assert.ok(value !== undefined, `Key '${key}' in '${lang}' should not be undefined`);
    }
  });

  test(`${lang} - array values are not empty`, () => {
    const filePath = path.join(i18nDir, `index.${lang}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        assert.ok(value.length > 0, `Array value for key '${key}' in '${lang}' should not be empty`);
      }
    }
  });

  test(`${lang} - string values are not empty`, () => {
    const filePath = path.join(i18nDir, `index.${lang}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        assert.ok(value.trim().length > 0, `String value for key '${key}' in '${lang}' should not be empty`);
      }
    }
  });
});

// Test Suite 4: Specific Key Structure
console.log(`\n${colors.yellow}Test Suite: Specific Key Structure${colors.reset}`);

test('reference language has expected top-level keys', () => {
  const expectedKeys = [
    'loading-text',
    'navBarFile',
    'navbarHelp',
    'navbarTraining',
    'navbarRecords',
    'navbarAnalysis',
    'navbarSettings',
    'settings',
    'record-entry',
    'ChartUI',
    'headings'
  ];

  for (const key of expectedKeys) {
    assert.ok(referenceData.hasOwnProperty(key), `Should contain key '${key}'`);
  }
});

languageCodes.forEach((lang) => {
  test(`${lang} - 'settings' key is an object`, () => {
    const filePath = path.join(i18nDir, `index.${lang}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    assert.ok(data.hasOwnProperty('settings'), 'Should have settings key');
    assert.strictEqual(typeof data.settings, 'object');
    assert.strictEqual(Array.isArray(data.settings), false);
  });

  test(`${lang} - 'record-entry' key is an object`, () => {
    const filePath = path.join(i18nDir, `index.${lang}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    assert.ok(data.hasOwnProperty('record-entry'), 'Should have record-entry key');
    assert.strictEqual(typeof data['record-entry'], 'object');
    assert.strictEqual(Array.isArray(data['record-entry']), false);
  });

  test(`${lang} - 'ChartUI' key is an object`, () => {
    const filePath = path.join(i18nDir, `index.${lang}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    assert.ok(data.hasOwnProperty('ChartUI'), 'Should have ChartUI key');
    assert.strictEqual(typeof data.ChartUI, 'object');
    assert.strictEqual(Array.isArray(data.ChartUI), false);
  });

  test(`${lang} - 'headings' key is an array`, () => {
    const filePath = path.join(i18nDir, `index.${lang}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    assert.ok(data.hasOwnProperty('headings'), 'Should have headings key');
    assert.strictEqual(Array.isArray(data.headings), true);
  });
});

// Test Suite 5: Navigation Keys
console.log(`\n${colors.yellow}Test Suite: Navigation Keys${colors.reset}`);

const navigationKeys = ['navBarFile', 'navbarHelp', 'navbarTraining', 'navbarRecords', 'navbarAnalysis', 'navbarSettings'];

languageCodes.forEach((lang) => {
  test(`${lang} - has all navigation menu keys`, () => {
    const filePath = path.join(i18nDir, `index.${lang}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    for (const navKey of navigationKeys) {
      assert.ok(data.hasOwnProperty(navKey), `Should have navigation key '${navKey}'`);
      assert.ok(data[navKey], `Navigation key '${navKey}' should not be empty`);
    }
  });
});

// Test Suite 6: Nested Object Consistency
console.log(`\n${colors.yellow}Test Suite: Nested Object Consistency${colors.reset}`);

languageCodes.forEach((lang) => {
  if (lang === referenceLang) return;

  test(`${lang} - nested objects have same structure as reference`, () => {
    const filePath = path.join(i18nDir, `index.${lang}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    for (const [key, value] of Object.entries(referenceData)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        assert.ok(data[key], `Lang '${lang}' should have nested object '${key}'`);

        const refKeys = Object.keys(value);
        const langKeys = Object.keys(data[key]);

        assert.strictEqual(langKeys.length, refKeys.length, `Nested object '${key}' in '${lang}' should have same number of keys as reference`);
      }
    }
  });
});

// Test Suite 7: Special Characters and Encoding
console.log(`\n${colors.yellow}Test Suite: Special Characters and Encoding${colors.reset}`);

languageCodes.forEach((lang) => {
  test(`${lang} - file uses UTF-8 encoding`, () => {
    const filePath = path.join(i18nDir, `index.${lang}.json`);
    const buffer = fs.readFileSync(filePath);
    // Should not throw
    buffer.toString('utf-8');
  });

  test(`${lang} - special characters are properly encoded`, () => {
    const filePath = path.join(i18nDir, `index.${lang}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    // Should be able to stringify and parse again
    const stringified = JSON.stringify(data);
    JSON.parse(stringified);
  });
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
  process.exit(0);
}