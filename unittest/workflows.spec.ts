import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Comprehensive test suite for GitHub Actions workflow files
 * Tests YAML syntax, structure, and configuration validity
 *
 * Note: These tests use basic text parsing for YAML validation.
 * For full YAML parsing, install the 'yaml' package: npm install yaml --save-dev
 */

const workflowsDir = path.join(process.cwd(), '.github', 'workflows');
const workflowFiles = [
  'Build-for-Intel-Mac.yml',
  'check-installation.yml'
];

test.describe('GitHub Workflows - File Existence and Validity', () => {

  test('.github/workflows directory exists', () => {
    expect(fs.existsSync(workflowsDir), '.github/workflows directory should exist').toBeTruthy();
  });

  workflowFiles.forEach((filename) => {
    test(`${filename} exists`, () => {
      const filePath = path.join(workflowsDir, filename);
      expect(fs.existsSync(filePath), `${filename} should exist`).toBeTruthy();
    });

    test(`${filename} is not empty`, () => {
      const filePath = path.join(workflowsDir, filename);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content.length, `${filename} should not be empty`).toBeGreaterThan(0);
    });

    test(`${filename} has valid YAML structure`, () => {
      const filePath = path.join(workflowsDir, filename);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Basic YAML validation - check for common syntax errors
      expect(content, 'Should not have tabs (YAML uses spaces)').not.toContain('\t');

      // Check for balanced brackets
      const openBrackets = (content.match(/\[/g) || []).length;
      const closeBrackets = (content.match(/]/g) || []).length;
      expect(openBrackets, 'Square brackets should be balanced').toBe(closeBrackets);

      const openBraces = (content.match(/\{/g) || []).length;
      const closeBraces = (content.match(/}/g) || []).length;
      expect(openBraces, 'Curly braces should be balanced').toBe(closeBraces);
    });

    test(`${filename} has YAML document structure`, () => {
      const filePath = path.join(workflowsDir, filename);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Should have key: value pairs
      expect(content).toMatch(/\w+:/);

      // Should not have obvious syntax errors
      expect(content, 'Should not have multiple colons without quotes').not.toMatch(/: .*: .*: /);
    });
  });
});

test.describe('GitHub Workflows - Required Top-Level Keys', () => {

  workflowFiles.forEach((filename) => {
    test(`${filename} has 'name' field`, () => {
      const filePath = path.join(workflowsDir, filename);
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toMatch(/^name:/m);
      expect(content).toMatch(/^name:\s*.+$/m);
    });

    test(`${filename} has 'on' trigger configuration`, () => {
      const filePath = path.join(workflowsDir, filename);
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toMatch(/^on:/m);
    });

    test(`${filename} has 'jobs' section`, () => {
      const filePath = path.join(workflowsDir, filename);
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toMatch(/^jobs:/m);
    });

    test(`${filename} has 'permissions' section`, () => {
      const filePath = path.join(workflowsDir, filename);
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toMatch(/^permissions:/m);
    });
  });
});

test.describe('GitHub Workflows - Trigger Configuration', () => {

  test('Build-for-Intel-Mac.yml triggers on correct branches', () => {
    const filePath = path.join(workflowsDir, 'Build-for-Intel-Mac.yml');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toMatch(/push:/);
    expect(content).toMatch(/branches:/);
    expect(content).toContain("'Development'");
    expect(content).toContain("'bug-fix'");
  });

  test('check-installation.yml triggers on master branch', () => {
    const filePath = path.join(workflowsDir, 'check-installation.yml');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toMatch(/push:/);
    expect(content).toMatch(/branches:/);
    expect(content).toContain("'master'");
  });

  test('workflows have concurrency control', () => {
    workflowFiles.forEach((filename) => {
      const filePath = path.join(workflowsDir, filename);
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toMatch(/^concurrency:/m);
      expect(content).toMatch(/group:/);
      expect(content).toMatch(/cancel-in-progress:\s*true/);
    });
  });
});

test.describe('GitHub Workflows - Jobs Configuration', () => {

  workflowFiles.forEach((filename) => {
    test(`${filename} jobs have 'runs-on' specified`, () => {
      const filePath = path.join(workflowsDir, filename);
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toMatch(/runs-on:/);
    });

    test(`${filename} jobs have 'steps' array`, () => {
      const filePath = path.join(workflowsDir, filename);
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toMatch(/steps:/);
      expect(content).toMatch(/- name:/);
    });

    test(`${filename} has checkout step`, () => {
      const filePath = path.join(workflowsDir, filename);
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('actions/checkout');
    });

    test(`${filename} has Node.js setup step`, () => {
      const filePath = path.join(workflowsDir, filename);
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('actions/setup-node');
    });
  });
});

test.describe('GitHub Workflows - Environment Variables and Secrets', () => {

  test('Build-for-Intel-Mac.yml uses required secrets', () => {
    const filePath = path.join(workflowsDir, 'Build-for-Intel-Mac.yml');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toMatch(/env:/);
    expect(content).toContain('GH_TOKEN');
    expect(content).toContain('APPLE_ID');
    expect(content).toContain('CSC_LINK');
  });

  test('check-installation.yml uses GH_TOKEN', () => {
    const filePath = path.join(workflowsDir, 'check-installation.yml');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toMatch(/env:/);
    expect(content).toContain('GH_TOKEN');
    expect(content).toMatch(/CI:\s*true/);
  });

  test('workflows set CI environment variable', () => {
    workflowFiles.forEach((filename) => {
      const filePath = path.join(workflowsDir, filename);
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toMatch(/CI:\s*true/);
    });
  });
});

test.describe('GitHub Workflows - Specific Steps Validation', () => {

  test('Build-for-Intel-Mac.yml installs npm dependencies', () => {
    const filePath = path.join(workflowsDir, 'Build-for-Intel-Mac.yml');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('npm install');
  });

  test('workflows run unit tests', () => {
    workflowFiles.forEach((filename) => {
      const filePath = path.join(workflowsDir, filename);
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('npm run unittest');
    });
  });

  test('Build-for-Intel-Mac.yml builds application', () => {
    const filePath = path.join(workflowsDir, 'Build-for-Intel-Mac.yml');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('npm run build');
  });

  test('Build-for-Intel-Mac.yml sets up Python', () => {
    const filePath = path.join(workflowsDir, 'Build-for-Intel-Mac.yml');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('actions/setup-python');
  });
});

test.describe('GitHub Workflows - Runner Configuration', () => {

  test('Build-for-Intel-Mac.yml uses macOS Intel runner', () => {
    const filePath = path.join(workflowsDir, 'Build-for-Intel-Mac.yml');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('macos-15-intel');
  });

  test('check-installation.yml uses matrix strategy', () => {
    const filePath = path.join(workflowsDir, 'check-installation.yml');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toMatch(/strategy:/);
    expect(content).toMatch(/matrix:/);
    expect(content).toMatch(/os:/);
  });

  test('check-installation.yml matrix includes multiple OS', () => {
    const filePath = path.join(workflowsDir, 'check-installation.yml');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('windows-latest');
    expect(content).toContain('macos-latest');
    expect(content).toContain('ubuntu-latest');
  });
});

test.describe('GitHub Workflows - Caching and Optimization', () => {

  test('workflows use caching for dependencies', () => {
    workflowFiles.forEach((filename) => {
      const filePath = path.join(workflowsDir, filename);
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('actions/cache');
    });
  });

  test('Perch model is cached', () => {
    workflowFiles.forEach((filename) => {
      const filePath = path.join(workflowsDir, filename);
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('Cache Perch');
    });
  });
});

test.describe('GitHub Workflows - Step Names and Documentation', () => {

  workflowFiles.forEach((filename) => {
    test(`${filename} steps have descriptive names or run commands`, () => {
      const filePath = path.join(workflowsDir, filename);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Steps should have name, run, or uses
      const hasStepStructure = content.match(/- name:/g) || content.match(/- uses:/g) || content.match(/run:/g);
      expect(hasStepStructure, 'Steps should have name, run, or uses').toBeTruthy();
    });
  });
});

test.describe('GitHub Workflows - Node.js Version Configuration', () => {

  test('workflows use Node.js version 22.16.0', () => {
    workflowFiles.forEach((filename) => {
      const filePath = path.join(workflowsDir, filename);
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toMatch(/node-version:\s*['"]?22\.16\.0['"]?/);
    });
  });
});

test.describe('GitHub Workflows - Testing Configuration', () => {

  test('workflows run Playwright tests', () => {
    workflowFiles.forEach((filename) => {
      const filePath = path.join(workflowsDir, filename);
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('npm test');
    });
  });

  test('check-installation.yml sets up Xvfb for Linux', () => {
    const filePath = path.join(workflowsDir, 'check-installation.yml');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toMatch(/Xvfb/);
    expect(content).toMatch(/if:/);
  });
});

test.describe('GitHub Workflows - Regression and Edge Cases', () => {

  test('workflows have reasonable number of steps', () => {
    workflowFiles.forEach((filename) => {
      const filePath = path.join(workflowsDir, filename);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Count step markers
      const stepMatches = content.match(/- name:/g) || [];
      expect(stepMatches.length, 'Should have reasonable number of steps').toBeLessThan(50);
      expect(stepMatches.length, 'Should have at least one step').toBeGreaterThan(0);
    });
  });

  test('workflow files are reasonably sized', () => {
    workflowFiles.forEach((filename) => {
      const filePath = path.join(workflowsDir, filename);
      const stats = fs.statSync(filePath);
      const fileSizeInKB = stats.size / 1024;

      expect(fileSizeInKB, `${filename} should not be excessively large`).toBeLessThan(50);
    });
  });

  test('workflows do not contain secrets in plaintext', () => {
    workflowFiles.forEach((filename) => {
      const filePath = path.join(workflowsDir, filename);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Should not contain actual secret values (patterns that look like tokens)
      expect(content, `${filename} should not contain plaintext secrets`).not.toMatch(/ghp_[a-zA-Z0-9]{36}/);
      expect(content, `${filename} should not contain API keys`).not.toMatch(/AKIA[0-9A-Z]{16}/);
    });
  });
});

test.describe('GitHub Workflows - Conditional Execution', () => {

  test('check-installation.yml skips Linux for certain steps', () => {
    const filePath = path.join(workflowsDir, 'check-installation.yml');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toMatch(/if:/);
    expect(content).toContain("runner.os != 'Linux'");
  });

  test('workflows have OS-specific conditional steps', () => {
    const filePath = path.join(workflowsDir, 'check-installation.yml');
    const content = fs.readFileSync(filePath, 'utf-8');

    const hasOSCondition = content.includes('runner.os') || content.includes('matrix.os');
    expect(hasOSCondition, 'Should have OS-specific conditional steps').toBe(true);
  });
});