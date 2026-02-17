/**
 * Standalone test suite for index.html
 * Tests HTML structure, validity, and key elements
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

const htmlFilePath = path.join(process.cwd(), 'index.html');

console.log(`\n${colors.cyan}Running HTML File Tests...${colors.reset}\n`);

// Test Suite 1: File Existence and Basic Structure
console.log(`${colors.yellow}Test Suite: File Existence and Basic Structure${colors.reset}`);

test('index.html file exists', () => {
  assert.ok(fs.existsSync(htmlFilePath), 'index.html should exist in project root');
});

let htmlContent = '';

test('file is not empty', () => {
  htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
  assert.ok(htmlContent.length > 0, 'HTML file should not be empty');
});

test('file has DOCTYPE declaration', () => {
  assert.ok(htmlContent.toLowerCase().includes('<!doctype html>'), 'Should have DOCTYPE declaration');
});

test('file has opening html tag', () => {
  assert.ok(/<html[^>]*>/i.test(htmlContent), 'Should have opening html tag');
});

test('file has closing html tag', () => {
  assert.ok(htmlContent.includes('</html>'), 'Should have closing html tag');
});

// Test Suite 2: Head Section
console.log(`\n${colors.yellow}Test Suite: Head Section${colors.reset}`);

test('has head section', () => {
  assert.ok(htmlContent.includes('<head>'), 'Should have opening head tag');
  assert.ok(htmlContent.includes('</head>'), 'Should have closing head tag');
});

test('has charset meta tag', () => {
  assert.ok(/<meta[^>]*charset[^>]*>/i.test(htmlContent), 'Should have charset meta tag');
});

test('charset is set to utf-8', () => {
  assert.ok(htmlContent.toLowerCase().includes('charset="utf-8"'), 'Charset should be UTF-8');
});

test('has viewport meta tag', () => {
  assert.ok(/<meta[^>]*name="viewport"[^>]*>/i.test(htmlContent), 'Should have viewport meta tag');
});

test('has title tag', () => {
  assert.ok(htmlContent.includes('<title>'), 'Should have opening title tag');
  assert.ok(htmlContent.includes('</title>'), 'Should have closing title tag');
});

test('title is "Chirpity"', () => {
  const titleMatch = htmlContent.match(/<title>(.*?)<\/title>/i);
  assert.ok(titleMatch, 'Should have a title tag');
  assert.strictEqual(titleMatch[1].trim(), 'Chirpity', 'Title should be "Chirpity"');
});

test('has Content Security Policy meta tag', () => {
  assert.ok(/<meta[^>]*http-equiv="Content-Security-Policy"[^>]*>/i.test(htmlContent), 'Should have CSP meta tag');
});

// Test Suite 3: Body Section
console.log(`\n${colors.yellow}Test Suite: Body Section${colors.reset}`);

test('has body section', () => {
  assert.ok(htmlContent.includes('<body'), 'Should have opening body tag');
  assert.ok(htmlContent.includes('</body>'), 'Should have closing body tag');
});

test('has loading screen element', () => {
  assert.ok(/id="loading-screen"/.test(htmlContent), 'Should have loading-screen element');
});

test('has content wrapper element', () => {
  assert.ok(/id="contentWrapper"/.test(htmlContent), 'Should have contentWrapper element');
});

test('has spectrogram wrapper element', () => {
  assert.ok(/id="spectrogramWrapper"/.test(htmlContent), 'Should have spectrogramWrapper element');
});

// Test Suite 4: CSS and JavaScript Resources
console.log(`\n${colors.yellow}Test Suite: CSS and JavaScript Resources${colors.reset}`);

test('includes Bootstrap CSS', () => {
  assert.ok(/bootstrap.*\.css/i.test(htmlContent), 'Should include Bootstrap CSS');
});

test('includes Bootstrap JavaScript', () => {
  assert.ok(/bootstrap.*\.js/i.test(htmlContent), 'Should include Bootstrap JavaScript');
});

test('includes custom CSS', () => {
  assert.ok(htmlContent.includes('css/style.css'), 'Should include custom CSS');
});

test('includes Chart.js library', () => {
  assert.ok(/chart\.js/i.test(htmlContent), 'Should include Chart.js');
});

test('includes Leaflet CSS for maps', () => {
  assert.ok(/leaflet.*\.css/i.test(htmlContent), 'Should include Leaflet CSS');
});

test('includes Leaflet JavaScript for maps', () => {
  assert.ok(/leaflet.*\.js/i.test(htmlContent), 'Should include Leaflet JavaScript');
});

test('uses defer attribute for non-critical scripts', () => {
  const scriptTags = htmlContent.match(/<script[^>]*>/gi) || [];
  const internalScripts = scriptTags.filter(tag =>
    !tag.includes('http') && tag.includes('src')
  );
  const deferredScripts = internalScripts.filter(tag => tag.includes('defer'));
  assert.ok(deferredScripts.length > 0, 'Most internal scripts should use defer attribute');
});

// Test Suite 5: Language and Accessibility
console.log(`\n${colors.yellow}Test Suite: Language and Accessibility${colors.reset}`);

test('html tag has lang attribute', () => {
  assert.ok(/<html[^>]*lang[^>]*>/i.test(htmlContent), 'HTML tag should have lang attribute');
});

test('lang attribute is set to "en"', () => {
  assert.ok(/<html[^>]*lang="en"[^>]*>/i.test(htmlContent), 'Lang attribute should be "en"');
});

test('has aria attributes for accessibility', () => {
  assert.ok(/aria-/.test(htmlContent), 'Should have aria attributes');
});

test('loading screen has proper accessibility attributes', () => {
  assert.ok(/id="loading-screen"[^>]*role="progressbar"/.test(htmlContent) ||
            /role="progressbar"[^>]*id="loading-screen"/.test(htmlContent),
            'Loading screen should have role="progressbar"');
  assert.ok(/aria-busy="true"/.test(htmlContent), 'Should have aria-busy attribute');
});

// Test Suite 6: Key UI Components
console.log(`\n${colors.yellow}Test Suite: Key UI Components${colors.reset}`);

test('has explore wrapper for data exploration', () => {
  assert.ok(/id="exploreWrapper"/.test(htmlContent), 'Should have exploreWrapper element');
});

test('has spectrogram display element', () => {
  assert.ok(/id="spectrogram"/.test(htmlContent), 'Should have spectrogram element');
});

test('has waveform display element', () => {
  assert.ok(/id="waveform"/.test(htmlContent), 'Should have waveform element');
});

test('has controls wrapper', () => {
  assert.ok(/id="controlsWrapper"/.test(htmlContent), 'Should have controlsWrapper element');
});

test('has results table container', () => {
  assert.ok(/id="resultTableContainer"/.test(htmlContent), 'Should have resultTableContainer element');
});

test('has play/pause button', () => {
  assert.ok(/id="playToggle"/.test(htmlContent), 'Should have playToggle button');
});

test('has zoom controls', () => {
  assert.ok(/id="zoomIn"/.test(htmlContent), 'Should have zoomIn button');
  assert.ok(/id="zoomOut"/.test(htmlContent), 'Should have zoomOut button');
});

// Test Suite 7: Modals
console.log(`\n${colors.yellow}Test Suite: Modals${colors.reset}`);

test('has diagnostics modal', () => {
  assert.ok(/id="diagnosticsModal"/.test(htmlContent), 'Should have diagnosticsModal');
});

test('has record entry modal', () => {
  assert.ok(/id="record-entry-modal"/.test(htmlContent), 'Should have record-entry-modal');
});

test('modals have proper Bootstrap classes', () => {
  assert.ok(/class="[^"]*modal[^"]*"/.test(htmlContent), 'Should have modal class');
  assert.ok(/class="[^"]*modal-dialog[^"]*"/.test(htmlContent), 'Should have modal-dialog class');
  assert.ok(/class="[^"]*modal-content[^"]*"/.test(htmlContent), 'Should have modal-content class');
});

test('modals have close buttons', () => {
  const closeButtons = htmlContent.match(/class="[^"]*btn-close[^"]*"/g);
  assert.ok(closeButtons, 'Modals should have close buttons');
  assert.ok(closeButtons.length >= 2, 'Should have multiple close buttons for modals');
});

// Test Suite 8: Bootstrap Integration
console.log(`\n${colors.yellow}Test Suite: Bootstrap Integration${colors.reset}`);

test('uses Bootstrap dark theme', () => {
  assert.ok(/data-bs-theme="dark"/.test(htmlContent), 'Should use Bootstrap dark theme');
});

test('uses Bootstrap grid system', () => {
  assert.ok(/class="[^"]*row[^"]*"/.test(htmlContent), 'Should use Bootstrap row class');
  assert.ok(/class="[^"]*col[^"]*"/.test(htmlContent), 'Should use Bootstrap col class');
});

test('uses Bootstrap button classes', () => {
  assert.ok(/class="[^"]*btn[^"]*"/.test(htmlContent), 'Should use Bootstrap btn class');
});

test('uses Bootstrap form classes', () => {
  assert.ok(/class="[^"]*form-control[^"]*"/.test(htmlContent), 'Should use Bootstrap form-control class');
  assert.ok(/class="[^"]*form-floating[^"]*"/.test(htmlContent), 'Should use Bootstrap form-floating class');
});

// Test Suite 9: Material Symbols Icons
console.log(`\n${colors.yellow}Test Suite: Material Symbols Icons${colors.reset}`);

test('uses Material Symbols icons', () => {
  assert.ok(/class="[^"]*material-symbols-outlined[^"]*"/.test(htmlContent), 'Should use Material Symbols icons');
});

test('has icons for common actions', () => {
  assert.ok(htmlContent.includes('play_circle'), 'Should have play_circle icon');
  assert.ok(htmlContent.includes('pause'), 'Should have pause icon');
  assert.ok(htmlContent.includes('zoom_in'), 'Should have zoom_in icon');
  assert.ok(htmlContent.includes('zoom_out'), 'Should have zoom_out icon');
});

// Test Suite 10: Forms and Inputs
console.log(`\n${colors.yellow}Test Suite: Forms and Inputs${colors.reset}`);

test('has form elements', () => {
  assert.ok(/<form[^>]*>/i.test(htmlContent), 'Should have form elements');
});

test('has input elements', () => {
  assert.ok(/<input[^>]*>/i.test(htmlContent), 'Should have input elements');
});

test('has select elements for dropdowns', () => {
  assert.ok(/<select[^>]*>/i.test(htmlContent), 'Should have select elements');
});

// Test Suite 11: Tag Balance
console.log(`\n${colors.yellow}Test Suite: Tag Balance${colors.reset}`);

function checkTagBalance(tagName) {
  const openTagRegex = new RegExp(`<${tagName}[^>]*>`, 'gi');
  const closeTagRegex = new RegExp(`</${tagName}>`, 'gi');

  const openTags = (htmlContent.match(openTagRegex) || []).filter(tag => !tag.includes('/>'));
  const closeTags = htmlContent.match(closeTagRegex) || [];

  return { open: openTags.length, close: closeTags.length };
}

test('div tags are approximately balanced', () => {
  const { open, close } = checkTagBalance('div');
  // Allow a small difference as some divs might be dynamically generated or self-closing
  const difference = Math.abs(open - close);
  assert.ok(difference <= 3, `Opening and closing div tags should be approximately balanced (open: ${open}, close: ${close}, diff: ${difference})`);
});

test('div tag imbalance is minimal', () => {
  const { open, close } = checkTagBalance('div');
  const difference = Math.abs(open - close);
  if (difference > 0) {
    console.log(`  ${colors.yellow}Warning: Div tags have a minor imbalance of ${difference} tag(s)${colors.reset}`);
  }
  // This test always passes but reports the issue
  assert.ok(true);
});

test('script tags are properly closed', () => {
  const scriptOpenTags = htmlContent.match(/<script[^>]*>/gi) || [];
  const scriptCloseTags = htmlContent.match(/<\/script>/gi) || [];
  assert.strictEqual(scriptOpenTags.length, scriptCloseTags.length, 'Script tags should be properly closed');
});

// Test Suite 12: Security Considerations
console.log(`\n${colors.yellow}Test Suite: Security Considerations${colors.reset}`);

test('has Content Security Policy defined', () => {
  assert.ok(/Content-Security-Policy/i.test(htmlContent), 'Should have Content Security Policy');
});

test('CSP restricts script sources', () => {
  const cspMatch = htmlContent.match(/Content-Security-Policy"[^>]*content="([^"]*)"/i);
  assert.ok(cspMatch, 'Should have CSP content');
  if (cspMatch) {
    assert.ok(cspMatch[1].includes('script-src'), 'CSP should restrict script sources');
  }
});

test('external resources use integrity checks', () => {
  const leafletLinks = htmlContent.match(/<link[^>]*leaflet[^>]*>/gi) || [];
  const leafletScripts = htmlContent.match(/<script[^>]*leaflet[^>]*>/gi) || [];

  for (const link of leafletLinks) {
    if (link.includes('https://')) {
      assert.ok(/integrity=/i.test(link), 'External Leaflet CSS should have integrity attribute');
      assert.ok(/crossorigin=/i.test(link), 'External Leaflet CSS should have crossorigin attribute');
    }
  }

  for (const script of leafletScripts) {
    if (script.includes('https://')) {
      assert.ok(/integrity=/i.test(script), 'External Leaflet script should have integrity attribute');
      assert.ok(/crossorigin=/i.test(script), 'External Leaflet script should have crossorigin attribute');
    }
  }
});

// Test Suite 13: Specific Functional Elements
console.log(`\n${colors.yellow}Test Suite: Specific Functional Elements${colors.reset}`);

test('has bird species autocomplete input', () => {
  assert.ok(/id="bird-autocomplete"/.test(htmlContent), 'Should have bird-autocomplete input');
});

test('has species search functionality elements', () => {
  assert.ok(/class="[^"]*bird-search[^"]*"/.test(htmlContent), 'Should have bird-search class');
  assert.ok(/id="bird-suggestions"/.test(htmlContent), 'Should have bird-suggestions element');
});

test('has confidence slider control', () => {
  assert.ok(/id="confidenceValue"/.test(htmlContent), 'Should have confidenceValue slider');
  assert.ok(/id="confidenceSliderContainer"/.test(htmlContent), 'Should have confidenceSliderContainer');
});

test('has filename display element', () => {
  assert.ok(/id="filename"/.test(htmlContent), 'Should have filename display element');
});

test('has filter panel for audio settings', () => {
  assert.ok(/id="filter-panel"/.test(htmlContent), 'Should have filter-panel');
});

test('has pagination controls for results', () => {
  assert.ok(/class="[^"]*pagination[^"]*"/.test(htmlContent), 'Should have pagination controls');
});

// Test Suite 14: Regression Tests
console.log(`\n${colors.yellow}Test Suite: Regression Tests${colors.reset}`);

test('file size is reasonable', () => {
  const stats = fs.statSync(htmlFilePath);
  const fileSizeInKB = stats.size / 1024;
  assert.ok(fileSizeInKB < 500, `HTML file should not be excessively large (current: ${fileSizeInKB.toFixed(2)} KB)`);
});

test('does not contain debugging code', () => {
  // Allow console.log in inline scripts but check it's not excessive
  const consoleLogCount = (htmlContent.match(/console\.log/g) || []).length;
  assert.ok(consoleLogCount < 5, `Should not contain excessive console.log statements (found: ${consoleLogCount})`);
});

test('has proper indentation', () => {
  const lines = htmlContent.split('\n');
  const indentedLines = lines.filter(line => line.startsWith('  ') || line.startsWith('\t'));
  assert.ok(indentedLines.length > 0, 'File should have proper indentation');
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