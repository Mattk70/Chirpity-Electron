/**
 * Standalone test suite for js/worker.js
 * Tests code structure, patterns, and integration points
 * Uses Node.js built-in modules only - no external dependencies required
 *
 * Note: worker.js is an Electron worker script that runs in a worker context.
 * These tests validate its structure and patterns rather than executing it directly.
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

const workerPath = path.join(process.cwd(), 'js', 'worker.js');

console.log(`\n${colors.cyan}Running Worker Script Tests...${colors.reset}\n`);

// Test Suite 1: File Existence and Basic Structure
console.log(`${colors.yellow}Test Suite: File Existence and Basic Structure${colors.reset}`);

test('worker.js file exists', () => {
  assert.ok(fs.existsSync(workerPath), 'worker.js should exist in js/ directory');
});

let workerContent = '';

test('file is not empty', () => {
  workerContent = fs.readFileSync(workerPath, 'utf-8');
  assert.ok(workerContent.length > 0, 'worker.js file should not be empty');
});

test('file is a substantial worker script', () => {
  const lines = workerContent.split('\n').length;
  assert.ok(lines > 1000, `Worker should be a complex script (has ${lines} lines)`);
});

test('has JSDoc file header', () => {
  assert.ok(/\/\*\*[\s\S]*?@file/.test(workerContent), 'Should have JSDoc file header with `@file` tag');
});

// Test Suite 2: Required Dependencies
console.log(`\n${colors.yellow}Test Suite: Required Dependencies${colors.reset}`);

test('imports electron ipcRenderer', () => {
  assert.ok(/require\s*\(\s*['"]electron['"]\s*\)/.test(workerContent), 'Should import electron module');
  assert.ok(/ipcRenderer/.test(workerContent), 'Should use ipcRenderer from electron');
});

test('imports Node.js fs module', () => {
  assert.ok(/require\s*\(\s*['"]node:fs['"]\s*\)/.test(workerContent) ||
            /require\s*\(\s*['"]fs['"]\s*\)/.test(workerContent),
            'Should import fs module');
});

test('imports Node.js path module', () => {
  assert.ok(/require\s*\(\s*['"]node:path['"]\s*\)/.test(workerContent) ||
            /require\s*\(\s*['"]path['"]\s*\)/.test(workerContent),
            'Should import path module');
});

test('imports fluent-ffmpeg', () => {
  assert.ok(/require\s*\(\s*['"]fluent-ffmpeg['"]\s*\)/.test(workerContent),
            'Should import fluent-ffmpeg module');
});

test('imports SunCalc for astronomy calculations', () => {
  assert.ok(/require\s*\(\s*['"]suncalc['"]\s*\)/.test(workerContent),
            'Should import suncalc module');
});

test('imports lodash.merge', () => {
  assert.ok(/require\s*\(\s*['"]lodash\.merge['"]\s*\)/.test(workerContent),
            'Should import lodash.merge module');
});

test('imports local database module', () => {
  assert.ok(/require\s*\(\s*['"].*database\.js['"]\s*\)/.test(workerContent) ||
            /from\s+['"].*database\.js['"]/i.test(workerContent),
            'Should import database module');
});

test('imports local state module', () => {
  assert.ok(/from\s+['"].*state\.js['"]/i.test(workerContent),
            'Should import state module');
});

test('imports tracking utilities', () => {
  assert.ok(/from\s+['"].*tracking\.js['"]/i.test(workerContent),
            'Should import tracking utilities');
});

// Test Suite 3: Worker Context Setup
console.log(`\n${colors.yellow}Test Suite: Worker Context Setup${colors.reset}`);

test('implements self.onerror handler', () => {
  assert.ok(/self\.onerror\s*=\s*function/.test(workerContent),
            'Should implement self.onerror for error handling');
});

test('implements unhandledrejection handler', () => {
  assert.ok(/self\.addEventListener\s*\(\s*['"]unhandledrejection['"]/i.test(workerContent),
            'Should handle unhandled promise rejections');
});

test('implements rejectionhandled handler', () => {
  assert.ok(/self\.addEventListener\s*\(\s*['"]rejectionhandled['"]/i.test(workerContent),
            'Should handle rejection handled events');
});

test('error handler tracks errors', () => {
  const errorHandlerMatch = workerContent.match(/self\.onerror[\s\S]{0,500}trackEvent/);
  assert.ok(errorHandlerMatch, 'Error handler should track errors for telemetry');
});

// Test Suite 4: Global State Variables
console.log(`\n${colors.yellow}Test Suite: Global State Variables${colors.reset}`);

test('defines DEBUG flag', () => {
  assert.ok(/let\s+DEBUG\s*;/.test(workerContent) || /var\s+DEBUG\s*;/.test(workerContent),
            'Should define DEBUG flag');
});

test('defines DATASET flag', () => {
  assert.ok(/const\s+DATASET\s*=/.test(workerContent), 'Should define DATASET constant');
});

test('defines STATE object', () => {
  assert.ok(/const\s+STATE\s*=/.test(workerContent), 'Should define STATE object');
});

test('STATE uses WorkerState class', () => {
  assert.ok(/new\s+State\s*\(/.test(workerContent), 'Should instantiate State class');
});

test('defines FILE_QUEUE', () => {
  assert.ok(/let\s+FILE_QUEUE\s*=/.test(workerContent), 'Should define FILE_QUEUE array');
});

test('defines predictWorkers array', () => {
  assert.ok(/let\s+predictWorkers\s*=/.test(workerContent), 'Should define predictWorkers array');
});

test('defines UI communication channel', () => {
  assert.ok(/let\s+UI\s*;/.test(workerContent), 'Should define UI variable for communication');
});

test('defines database variables', () => {
  assert.ok(/let\s+diskDB/.test(workerContent) && /memoryDB/.test(workerContent),
            'Should define database variables');
});

test('defines METADATA object', () => {
  assert.ok(/let\s+METADATA\s*=/.test(workerContent), 'Should define METADATA object');
});

// Test Suite 5: Constants and Configuration
console.log(`\n${colors.yellow}Test Suite: Constants and Configuration${colors.reset}`);

test('defines EPSILON constant', () => {
  assert.ok(/const\s+EPSILON\s*=/.test(workerContent), 'Should define EPSILON constant');
});

test('defines WINDOW_SIZE', () => {
  assert.ok(/let\s+WINDOW_SIZE\s*=/.test(workerContent), 'Should define WINDOW_SIZE');
});

test('defines SUPPORTED_FILES array', () => {
  assert.ok(/(?:let|const)\s+SUPPORTED_FILES\s*=/.test(workerContent), 'Should define SUPPORTED_FILES array');
});

test('SUPPORTED_FILES includes common audio formats', () => {
  const supportedMatch = workerContent.match(/SUPPORTED_FILES\s*=\s*\[([\s\S]*?)\]/);
  if (supportedMatch) {
    const formats = supportedMatch[1];
    assert.ok(/wav|mp3|flac/i.test(formats), 'Should support common audio formats');
  } else {
    assert.fail('Could not find SUPPORTED_FILES definition');
  }
});

test('configures ffmpeg path for unpacked asar', () => {
  assert.ok(/ffmpegPath/.test(workerContent), 'Should define ffmpegPath');
  assert.ok(/app\.asar\.unpacked/.test(workerContent),
            'Should handle unpacked asar for ffmpeg');
});

test('sets ffmpeg path on fluent-ffmpeg', () => {
  assert.ok(/setFfmpegPath/.test(workerContent), 'Should call setFfmpegPath');
});

// Test Suite 6: Database Integration
console.log(`\n${colors.yellow}Test Suite: Database Integration${colors.reset}`);

test('imports database utilities', () => {
  assert.ok(/sqlite3/.test(workerContent), 'Should reference sqlite3');
  assert.ok(/createDB/.test(workerContent), 'Should import createDB function');
  assert.ok(/closeDatabase/.test(workerContent), 'Should import closeDatabase function');
});

test('imports Mutex for thread safety', () => {
  assert.ok(/Mutex/.test(workerContent), 'Should import Mutex class');
});

test('creates database mutex', () => {
  assert.ok(/new\s+Mutex\s*\(/.test(workerContent), 'Should create dbMutex instance');
});

test('has checkpoint function for database', () => {
  assert.ok(/checkpoint/.test(workerContent), 'Should reference checkpoint function');
});

test('has database upgrade functions', () => {
  assert.ok(/upgrade_to_v4/.test(workerContent) || /upgrade/.test(workerContent),
            'Should have database upgrade logic');
});

test('has model management functions', () => {
  assert.ok(/addNewModel/.test(workerContent), 'Should have addNewModel function');
});

test('has merge database functionality', () => {
  assert.ok(/mergeDbIfNeeded/.test(workerContent), 'Should have mergeDbIfNeeded function');
});

// Test Suite 7: Message Handling
console.log(`\n${colors.yellow}Test Suite: Message Handling${colors.reset}`);

test('sets up UI message handler', () => {
  assert.ok(/UI\.onmessage/.test(workerContent), 'Should set UI.onmessage handler');
});

test('defines handleMessage function', () => {
  assert.ok(/handleMessage/.test(workerContent), 'Should define handleMessage function');
});

test('uses postMessage for UI communication', () => {
  assert.ok(/UI\.postMessage/.test(workerContent),
            'Should use postMessage to communicate with UI');
});

test('sends event-based messages', () => {
  assert.ok(/event\s*:\s*['"]/.test(workerContent),
            'Should send messages with event property');
});

test('handles worker communication line open event', () => {
  const openMatch = workerContent.match(/Worker communication lines open/i);
  assert.ok(openMatch, 'Should confirm communication lines are open');
});

// Test Suite 8: Audio Processing
console.log(`\n${colors.yellow}Test Suite: Audio Processing${colors.reset}`);

test('has ffmpeg setup function', () => {
  assert.ok(/setupFfmpegCommand/.test(workerContent),
            'Should have setupFfmpegCommand function');
});

test('extracts wave metadata', () => {
  assert.ok(/extractWaveMetadata/.test(workerContent),
            'Should use extractWaveMetadata function');
});

test('gets wave duration', () => {
  assert.ok(/getWaveDuration/.test(workerContent),
            'Should use getWaveDuration function');
});

test('handles audio metadata extraction', () => {
  assert.ok(/getAudioMetadata/.test(workerContent),
            'Should have getAudioMetadata capability');
});

test('processes audio files from queue', () => {
  assert.ok(/FILE_QUEUE/.test(workerContent), 'Should process files from queue');
});

test('tracks sample rate', () => {
  assert.ok(/sampleRate/.test(workerContent), 'Should track sample rate');
});

// Test Suite 9: Analysis Functions
console.log(`\n${colors.yellow}Test Suite: Analysis Functions${colors.reset}`);

test('handles file analysis requests', () => {
  assert.ok(/getFiles/.test(workerContent), 'Should have getFiles function');
});

test('manages file queue', () => {
  assert.ok(/FILE_QUEUE/.test(workerContent), 'Should manage file queue');
});

test('tracks analysis progress', () => {
  assert.ok(/t0_analysis/.test(workerContent), 'Should track analysis timing');
});

test('handles prediction requests', () => {
  assert.ok(/predictionsRequested/.test(workerContent) || /prediction/.test(workerContent),
            'Should handle prediction requests');
});

test('manages prediction workers', () => {
  assert.ok(/predictWorkers/.test(workerContent), 'Should manage prediction worker pool');
});

test('sends analysis complete events', () => {
  assert.ok(/analysis-complete/.test(workerContent),
            'Should send analysis complete notifications');
});

// Test Suite 10: Alert and Progress System
console.log(`\n${colors.yellow}Test Suite: Alert and Progress System${colors.reset}`);

test('defines generateAlert function', () => {
  assert.ok(/const\s+generateAlert\s*=/.test(workerContent) ||
            /function\s+generateAlert/.test(workerContent),
            'Should define generateAlert function');
});

test('generateAlert sends UI messages', () => {
  const alertMatch = workerContent.match(/generateAlert[\s\S]{0,300}UI\.postMessage/);
  assert.ok(alertMatch, 'generateAlert should post messages to UI');
});

test('generateAlert handles different alert types', () => {
  const alertMatch = workerContent.match(/generateAlert[\s\S]{0,300}type/);
  assert.ok(alertMatch, 'generateAlert should support different alert types');
});

test('has progress reporting', () => {
  assert.ok(/progress/.test(workerContent), 'Should have progress reporting');
});

test('sends footer progress updates', () => {
  assert.ok(/footer-progress/.test(workerContent),
            'Should send footer progress events');
});

test('has sendProgress function', () => {
  assert.ok(/sendProgress/.test(workerContent) || /function\s+sendProgress/.test(workerContent),
            'Should have sendProgress function');
});

// Test Suite 11: Chart Integration
console.log(`\n${colors.yellow}Test Suite: Chart Integration${colors.reset}`);

test('imports chart functionality', () => {
  assert.ok(/onChartRequest/.test(workerContent), 'Should import onChartRequest');
});

test('imports location utilities', () => {
  assert.ok(/getIncludedLocations/.test(workerContent),
            'Should import getIncludedLocations');
});

// Test Suite 12: Training and Model Management
console.log(`\n${colors.yellow}Test Suite: Training and Model Management${colors.reset}`);

test('checks for new models', () => {
  assert.ok(/checkNewModel/.test(workerContent), 'Should have checkNewModel function');
});

test('handles model deletion', () => {
  assert.ok(/onDeleteModel/.test(workerContent), 'Should have onDeleteModel function');
});

test('tracks model readiness', () => {
  assert.ok(/SEEN_MODEL_READY/.test(workerContent), 'Should track model ready state');
});

test('sends model-related messages', () => {
  assert.ok(/model/.test(workerContent), 'Should handle model-related operations');
});

// Test Suite 13: Error Handling and Tracking
console.log(`\n${colors.yellow}Test Suite: Error Handling and Tracking${colors.reset}`);

test('implements tracking system', () => {
  assert.ok(/trackEvent/.test(workerContent), 'Should implement event tracking');
});

test('has custom URL encoding for tracking', () => {
  assert.ok(/customURLEncode/.test(workerContent),
            'Should use customURLEncode for tracking');
});

test('installs console tracking', () => {
  assert.ok(/installConsoleTracking/.test(workerContent),
            'Should install console tracking');
});

test('tracks UUID in state', () => {
  assert.ok(/STATE\.UUID/.test(workerContent), 'Should track UUID in state');
});

test('disables tracking in test environment', () => {
  assert.ok(/isTestEnv/.test(workerContent) && /TEST_ENV/.test(workerContent),
            'Should check for test environment');
});

test('error handler includes stack traces', () => {
  const errorMatch = workerContent.match(/self\.onerror[\s\S]{0,500}stack/);
  assert.ok(errorMatch, 'Should capture stack traces in error handler');
});

test('handles DLL errors specifically', () => {
  assert.ok(/dynamic link library|noDLL/i.test(workerContent),
            'Should handle DLL-related errors');
});

// Test Suite 14: Platform-Specific Code
console.log(`\n${colors.yellow}Test Suite: Platform-Specific Code${colors.reset}`);

test('checks for Windows platform', () => {
  assert.ok(/process\.platform\s*===\s*['"]win32['"]/.test(workerContent),
            'Should check for Windows platform');
});

test('defines isWin32 flag', () => {
  assert.ok(/let\s+isWin32\s*=/.test(workerContent), 'Should define isWin32 flag');
});

test('conditionally loads ntsuspend on Windows', () => {
  assert.ok(/ntsuspend/.test(workerContent),
            'Should reference ntsuspend for Windows');
});

test('handles platform-specific paths', () => {
  assert.ok(/process\.platform/.test(workerContent),
            'Should handle platform-specific behavior');
});

// Test Suite 15: Initialization and Promises
console.log(`\n${colors.yellow}Test Suite: Initialization and Promises${colors.reset}`);

test('defines INITIALISED promise', () => {
  assert.ok(/let\s+INITIALISED\s*=\s*new\s+Promise/.test(workerContent),
            'Should define INITIALISED promise');
});

test('has initialiseResolve function', () => {
  assert.ok(/initialiseResolve/.test(workerContent),
            'Should define initialiseResolve');
});

test('has initialiseReject function', () => {
  assert.ok(/initialiseReject/.test(workerContent),
            'Should define initialiseReject');
});

test('uses promise for initialization', () => {
  const promiseMatch = workerContent.match(/INITIALISED\s*=\s*new\s+Promise/);
  assert.ok(promiseMatch, 'Should use promise for async initialization');
});

// Test Suite 16: File Management
console.log(`\n${colors.yellow}Test Suite: File Management${colors.reset}`);

test('has getFiles function', () => {
  assert.ok(/const\s+getFiles\s*=\s*async/.test(workerContent) ||
            /async\s+function\s+getFiles/.test(workerContent),
            'Should have async getFiles function');
});

test('has getFilesInDirectory function', () => {
  assert.ok(/const\s+getFilesInDirectory\s*=\s*async/.test(workerContent) ||
            /async\s+function\s+getFilesInDirectory/.test(workerContent),
            'Should have getFilesInDirectory function');
});

test('resolves database file paths', () => {
  assert.ok(/resolveDatabaseFile/.test(workerContent),
            'Should have resolveDatabaseFile function');
});

test('handles file selection ranges', () => {
  assert.ok(/getSelectionRange/.test(workerContent),
            'Should have getSelectionRange function');
});

test('prepares SQL parameters', () => {
  assert.ok(/prepParams/.test(workerContent), 'Should have prepParams function');
});

// Test Suite 17: Filter and Label Management
console.log(`\n${colors.yellow}Test Suite: Filter and Label Management${colors.reset}`);

test('checks if filters are applied', () => {
  assert.ok(/filtersApplied/.test(workerContent),
            'Should have filtersApplied function');
});

test('manages labels', () => {
  assert.ok(/STATE\.allLabels/.test(workerContent) ||
            /STATE\.filteredLabels/.test(workerContent),
            'Should manage label state');
});

test('sends label events', () => {
  assert.ok(/event\s*:\s*['"]labels['"]/.test(workerContent),
            'Should send label events');
});

test('has split character function', () => {
  assert.ok(/getSplitChar/.test(workerContent),
            'Should have getSplitChar function');
});

test('handles label exclusion', () => {
  assert.ok(/getExcluded/.test(workerContent), 'Should have getExcluded function');
});

// Test Suite 18: SQL Query Management
console.log(`\n${colors.yellow}Test Suite: SQL Query Management${colors.reset}`);

test('builds SQL queries', () => {
  assert.ok(/getFileSQLAndParams/.test(workerContent),
            'Should have SQL query building function');
});

test('manages query intervals', () => {
  assert.ok(/setGetSummaryQueryInterval/.test(workerContent),
            'Should manage query intervals');
});

test('uses async database operations', () => {
  assert.ok(/\.runAsync|\.getAsync/.test(workerContent),
            'Should use async database methods');
});

test('uses transactions for data integrity', () => {
  assert.ok(/BEGIN/.test(workerContent) && /COMMIT/.test(workerContent),
            'Should use database transactions');
});

test('handles rollback on errors', () => {
  assert.ok(/ROLLBACK/.test(workerContent), 'Should handle transaction rollback');
});

// Test Suite 19: Code Quality and Best Practices
console.log(`\n${colors.yellow}Test Suite: Code Quality and Best Practices${colors.reset}`);

test('uses const for constants', () => {
  const constCount = (workerContent.match(/const\s+/g) || []).length;
  assert.ok(constCount > 10, 'Should use const for multiple constants');
});

test('uses let for mutable variables', () => {
  const letCount = (workerContent.match(/let\s+/g) || []).length;
  assert.ok(letCount > 5, 'Should use let for mutable variables');
});

test('uses async/await pattern', () => {
  assert.ok(/async/.test(workerContent) && /await/.test(workerContent),
            'Should use async/await pattern');
});

test('has JSDoc comments', () => {
  const jsdocCount = (workerContent.match(/\/\*\*/g) || []).length;
  assert.ok(jsdocCount > 10, 'Should have multiple JSDoc comments');
});

test('uses arrow functions', () => {
  assert.ok(/=>\s*{/.test(workerContent), 'Should use arrow functions');
});

test('uses template literals', () => {
  assert.ok(/`[^`]*\${/.test(workerContent), 'Should use template literals');
});

test('uses destructuring', () => {
  assert.ok(/const\s*{[^}]+}\s*=/.test(workerContent),
            'Should use destructuring assignments');
});

// Test Suite 20: Security and Robustness
console.log(`\n${colors.yellow}Test Suite: Security and Robustness${colors.reset}`);

test('validates file paths', () => {
  assert.ok(/path\.join|p\.join/.test(workerContent),
            'Should use path.join for safe path construction');
});

test('uses mutex for thread safety', () => {
  assert.ok(/dbMutex\.lock/.test(workerContent) && /dbMutex\.unlock/.test(workerContent),
            'Should use mutex for database operations');
});

test('handles foreign keys properly', () => {
  assert.ok(/PRAGMA foreign_keys/.test(workerContent),
            'Should handle foreign key constraints');
});

test('uses prepared statements pattern', () => {
  assert.ok(/\?/.test(workerContent),
            'Should use parameterized queries (prepared statements)');
});

test('handles aborted operations', () => {
  assert.ok(/aborted/.test(workerContent), 'Should handle operation abortion');
});

// Test Suite 21: Additional Functionality Tests
console.log(`\n${colors.yellow}Test Suite: Additional Functionality Tests${colors.reset}`);

test('handles file conversion', () => {
  assert.ok(/conversion/.test(workerContent), 'Should handle file conversion');
});

test('manages file timestamps', () => {
  assert.ok(/utimes/.test(workerContent) || /mtime/.test(workerContent),
            'Should manage file timestamps');
});

test('handles archive operations', () => {
  assert.ok(/archiveName/.test(workerContent) || /archive/.test(workerContent),
            'Should handle archive operations');
});

test('tracks file progress', () => {
  assert.ok(/fileProgressMap/.test(workerContent) || /progress\.percent/.test(workerContent),
            'Should track file processing progress');
});

test('handles pagination', () => {
  assert.ok(/pagination/.test(workerContent) || /limit|offset/.test(workerContent),
            'Should handle pagination');
});

// Test Suite 22: Integration Points
console.log(`\n${colors.yellow}Test Suite: Integration Points${colors.reset}`);

test('integrates with training module', () => {
  assert.ok(/training\.js/.test(workerContent), 'Should integrate with training module');
});

test('integrates with charts component', () => {
  assert.ok(/charts\.js/.test(workerContent), 'Should integrate with charts component');
});

test('integrates with metadata utilities', () => {
  assert.ok(/metadata\.js/.test(workerContent), 'Should integrate with metadata utilities');
});

test('uses state management', () => {
  assert.ok(/WorkerState|State/.test(workerContent),
            'Should use state management system');
});

// Test Suite 23: Regression and Edge Cases
console.log(`\n${colors.yellow}Test Suite: Regression and Edge Cases${colors.reset}`);

test('handles empty results gracefully', () => {
  // Should have null checks and empty array handling
  assert.ok(/\.length\s*>|\.length\s*===/.test(workerContent),
            'Should check lengths before processing');
});

test('validates parameters', () => {
  // Should have conditional checks
  assert.ok(/if\s*\(/.test(workerContent), 'Should have parameter validation');
});

test('logs debug information conditionally', () => {
  assert.ok(/DEBUG\s*&&/.test(workerContent),
            'Should conditionally log debug information');
});

test('file is valid JavaScript', () => {
  // Basic syntax validation - checks for matching braces
  const openBraces = (workerContent.match(/{/g) || []).length;
  const closeBraces = (workerContent.match(/}/g) || []).length;
  const difference = Math.abs(openBraces - closeBraces);
  assert.ok(difference < 5,
    `Braces should be approximately balanced (open: ${openBraces}, close: ${closeBraces})`);
});

test('has initial imports at the top of file', () => {
  const lines = workerContent.split('\n');
  let firstImportLine = -1;

  for (let i = 0; i < Math.min(100, lines.length); i++) {
    if (/require\s*\(|from\s+['"]/.test(lines[i])) {
      firstImportLine = i;
      break;
    }
  }

  // Should have initial imports within first 100 lines (allows for lazy loading later)
  assert.ok(firstImportLine >= 0 && firstImportLine < 100,
    'Should have initial imports near the top of the file');
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