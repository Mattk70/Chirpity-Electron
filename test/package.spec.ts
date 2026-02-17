import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Comprehensive test suite for package.json
 * Tests JSON validity, structure, dependencies, and configuration
 */

const packagePath = path.join(process.cwd(), 'package.json');

test.describe('package.json - File Existence and Basic Structure', () => {

  test('package.json exists', () => {
    expect(fs.existsSync(packagePath), 'package.json should exist').toBeTruthy();
  });

  test('file is not empty', () => {
    const content = fs.readFileSync(packagePath, 'utf-8');
    expect(content.length, 'package.json should not be empty').toBeGreaterThan(0);
  });

  test('file is valid JSON', () => {
    const content = fs.readFileSync(packagePath, 'utf-8');

    expect(() => {
      JSON.parse(content);
    }, 'package.json should be valid JSON').not.toThrow();
  });

  test('parsed content is an object', () => {
    const content = fs.readFileSync(packagePath, 'utf-8');
    const data = JSON.parse(content);

    expect(typeof data).toBe('object');
    expect(data).not.toBeNull();
    expect(Array.isArray(data)).toBe(false);
  });
});

test.describe('package.json - Required Fields', () => {

  let packageData: any;

  test.beforeAll(() => {
    const content = fs.readFileSync(packagePath, 'utf-8');
    packageData = JSON.parse(content);
  });

  test('has name field', () => {
    expect(packageData).toHaveProperty('name');
    expect(typeof packageData.name).toBe('string');
    expect(packageData.name).toBe('Chirpity');
  });

  test('has version field', () => {
    expect(packageData).toHaveProperty('version');
    expect(typeof packageData.version).toBe('string');
    expect(packageData.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('has description field', () => {
    expect(packageData).toHaveProperty('description');
    expect(typeof packageData.description).toBe('string');
    expect(packageData.description.length).toBeGreaterThan(0);
  });

  test('has main entry point', () => {
    expect(packageData).toHaveProperty('main');
    expect(typeof packageData.main).toBe('string');
    expect(packageData.main).toBe('main.js');
  });

  test('has author field', () => {
    expect(packageData).toHaveProperty('author');
    expect(typeof packageData.author).toBe('string');
    expect(packageData.author).toBe('Matt Kirkland');
  });

  test('has license field', () => {
    expect(packageData).toHaveProperty('license');
    expect(typeof packageData.license).toBe('string');
    expect(packageData.license).toBe('CC-BY-NC-SA-4.0');
  });

  test('has homepage field', () => {
    expect(packageData).toHaveProperty('homepage');
    expect(typeof packageData.homepage).toBe('string');
    expect(packageData.homepage).toBe('https://chirpity.net');
  });
});

test.describe('package.json - Scripts Configuration', () => {

  let packageData: any;

  test.beforeAll(() => {
    const content = fs.readFileSync(packagePath, 'utf-8');
    packageData = JSON.parse(content);
  });

  test('has scripts section', () => {
    expect(packageData).toHaveProperty('scripts');
    expect(typeof packageData.scripts).toBe('object');
    expect(Object.keys(packageData.scripts).length).toBeGreaterThan(0);
  });

  test('has start script', () => {
    expect(packageData.scripts).toHaveProperty('start');
    expect(packageData.scripts.start).toContain('electron');
  });

  test('has build scripts', () => {
    expect(packageData.scripts).toHaveProperty('build');
    expect(packageData.scripts.build).toContain('electron-builder');
  });

  test('has test script', () => {
    expect(packageData.scripts).toHaveProperty('test');
    expect(packageData.scripts.test).toContain('playwright test');
  });

  test('has unittest script', () => {
    expect(packageData.scripts).toHaveProperty('unittest');
    expect(packageData.scripts.unittest).toContain('playwright test');
    expect(packageData.scripts.unittest).toContain('i18n.spec.ts');
    expect(packageData.scripts.unittest).toContain('html.spec.ts');
  });

  test('has prebuild script', () => {
    expect(packageData.scripts).toHaveProperty('prebuild');
    expect(packageData.scripts.prebuild).toContain('prebuild.js');
  });

  test('has postinstall script', () => {
    expect(packageData.scripts).toHaveProperty('postinstall');
    expect(packageData.scripts.postinstall).toContain('electron-builder install-app-deps');
  });

  test('build scripts use electron-builder', () => {
    const buildScripts = Object.keys(packageData.scripts).filter(key =>
      key.includes('build') || key.includes('export') || key.includes('AppImage')
    );

    for (const script of buildScripts) {
      if (!script.startsWith('pre') && !script.startsWith('post')) {
        expect(
          packageData.scripts[script],
          `Build script '${script}' should use electron-builder`
        ).toContain('electron-builder');
      }
    }
  });
});

test.describe('package.json - Dependencies', () => {

  let packageData: any;

  test.beforeAll(() => {
    const content = fs.readFileSync(packagePath, 'utf-8');
    packageData = JSON.parse(content);
  });

  test('has dependencies section', () => {
    expect(packageData).toHaveProperty('dependencies');
    expect(typeof packageData.dependencies).toBe('object');
    expect(Object.keys(packageData.dependencies).length).toBeGreaterThan(0);
  });

  test('has devDependencies section', () => {
    expect(packageData).toHaveProperty('devDependencies');
    expect(typeof packageData.devDependencies).toBe('object');
    expect(Object.keys(packageData.devDependencies).length).toBeGreaterThan(0);
  });

  test('includes Electron in devDependencies', () => {
    expect(packageData.devDependencies).toHaveProperty('electron');
    expect(packageData.devDependencies.electron).toMatch(/\^\d+\.\d+\.\d+/);
  });

  test('includes Playwright in devDependencies', () => {
    expect(packageData.devDependencies).toHaveProperty('@playwright/test');
    expect(packageData.devDependencies).toHaveProperty('playwright');
  });

  test('includes TensorFlow.js dependencies', () => {
    expect(packageData.dependencies).toHaveProperty('@tensorflow/tfjs');
    expect(packageData.dependencies).toHaveProperty('@tensorflow/tfjs-node');
    expect(packageData.dependencies).toHaveProperty('@tensorflow/tfjs-backend-webgpu');
  });

  test('includes Bootstrap', () => {
    expect(packageData.dependencies).toHaveProperty('bootstrap');
    expect(packageData.dependencies.bootstrap).toBe('5.2.3');
  });

  test('includes SQLite3', () => {
    expect(packageData.dependencies).toHaveProperty('sqlite3');
  });

  test('includes Chart.js', () => {
    expect(packageData.dependencies).toHaveProperty('chart.js');
  });

  test('includes wavesurfer.js', () => {
    expect(packageData.dependencies).toHaveProperty('wavesurfer.js');
    expect(packageData.dependencies['wavesurfer.js']).toBe('7.9.5');
  });

  test('includes ffmpeg installer', () => {
    expect(packageData.dependencies).toHaveProperty('@ffmpeg-installer/ffmpeg');
  });

  test('includes onnxruntime-node', () => {
    expect(packageData.dependencies).toHaveProperty('onnxruntime-node');
  });

  test('dependencies have valid version formats', () => {
    const allDeps = {
      ...packageData.dependencies,
      ...packageData.devDependencies
    };

    for (const [name, version] of Object.entries(allDeps)) {
      expect(
        typeof version,
        `Dependency '${name}' should have string version`
      ).toBe('string');

      // Should match semver patterns like ^1.2.3, ~1.2.3, 1.2.3, or >=1.2.3
      expect(
        version as string,
        `Dependency '${name}' version should be valid semver`
      ).toMatch(/^[\^~>=]*\d+\.\d+(\.\d+)?/);
    }
  });
});

test.describe('package.json - Electron Builder Configuration', () => {

  let packageData: any;

  test.beforeAll(() => {
    const content = fs.readFileSync(packagePath, 'utf-8');
    packageData = JSON.parse(content);
  });

  test('has build section', () => {
    expect(packageData).toHaveProperty('build');
    expect(typeof packageData.build).toBe('object');
  });

  test('has appId configured', () => {
    expect(packageData.build).toHaveProperty('appId');
    expect(packageData.build.appId).toBe('uk.co.mattkirkland.chirpity.Chirpity');
  });

  test('has publish configuration', () => {
    expect(packageData.build).toHaveProperty('publish');
    expect(Array.isArray(packageData.build.publish)).toBe(true);

    const githubPublish = packageData.build.publish.find((p: any) => p.provider === 'github');
    expect(githubPublish, 'Should have GitHub publish configuration').toBeTruthy();
    expect(githubPublish.owner).toBe('Mattk70');
    expect(githubPublish.repo).toBe('Chirpity-Electron');
  });

  test('has file associations configured', () => {
    expect(packageData.build).toHaveProperty('fileAssociations');
    expect(Array.isArray(packageData.build.fileAssociations)).toBe(true);

    const audioExtensions = ['mp3', 'wav', 'flac', 'ogg'];
    for (const ext of audioExtensions) {
      const association = packageData.build.fileAssociations.find((fa: any) => fa.ext === ext);
      expect(association, `Should have file association for .${ext}`).toBeTruthy();
    }
  });

  test('has macOS configuration', () => {
    expect(packageData.build).toHaveProperty('mac');
    expect(packageData.build.mac).toHaveProperty('target');
    expect(packageData.build.mac).toHaveProperty('icon');
    expect(packageData.build.mac).toHaveProperty('category');
  });

  test('has Windows configuration', () => {
    expect(packageData.build).toHaveProperty('win');
    expect(packageData.build.win).toHaveProperty('target');
    expect(packageData.build.win).toHaveProperty('icon');
  });

  test('has Linux configuration', () => {
    expect(packageData.build).toHaveProperty('linux');
    expect(packageData.build.linux).toHaveProperty('target');
    expect(Array.isArray(packageData.build.linux.target)).toBe(true);
    expect(packageData.build.linux.target).toContain('AppImage');
  });

  test('has NSIS configuration for Windows', () => {
    expect(packageData.build).toHaveProperty('nsis');
    expect(packageData.build.nsis).toHaveProperty('oneClick');
    expect(packageData.build.nsis).toHaveProperty('perMachine');
    expect(packageData.build.nsis).toHaveProperty('license');
  });

  test('excludes unnecessary files from build', () => {
    expect(packageData.build).toHaveProperty('files');
    expect(Array.isArray(packageData.build.files)).toBe(true);

    const excludedPatterns = packageData.build.files.filter((f: string) => f.startsWith('!'));
    expect(excludedPatterns.length, 'Should exclude test files and build artifacts').toBeGreaterThan(0);

    const excludesTests = excludedPatterns.some((p: string) => p.includes('test'));
    expect(excludesTests, 'Should exclude test files').toBe(true);
  });
});

test.describe('package.json - Repository Information', () => {

  let packageData: any;

  test.beforeAll(() => {
    const content = fs.readFileSync(packagePath, 'utf-8');
    packageData = JSON.parse(content);
  });

  test('has repository field', () => {
    expect(packageData).toHaveProperty('repository');
    expect(typeof packageData.repository).toBe('object');
  });

  test('repository type is git', () => {
    expect(packageData.repository).toHaveProperty('type');
    expect(packageData.repository.type).toBe('git');
  });

  test('repository URL is correct', () => {
    expect(packageData.repository).toHaveProperty('url');
    expect(packageData.repository.url).toContain('github.com/mattk70/Chirpity-Electron');
  });

  test('has bugs URL', () => {
    expect(packageData).toHaveProperty('bugs');
    expect(packageData.bugs).toHaveProperty('url');
    expect(packageData.bugs.url).toContain('github.com/mattk70/Chirpity-Electron/issues');
  });
});

test.describe('package.json - Keywords and Metadata', () => {

  let packageData: any;

  test.beforeAll(() => {
    const content = fs.readFileSync(packagePath, 'utf-8');
    packageData = JSON.parse(content);
  });

  test('has keywords array', () => {
    expect(packageData).toHaveProperty('keywords');
    expect(Array.isArray(packageData.keywords)).toBe(true);
  });

  test('keywords include relevant terms', () => {
    const expectedKeywords = ['Nocmig', 'Bioacoustics', 'Bird Calls'];
    for (const keyword of expectedKeywords) {
      expect(packageData.keywords, `Should include keyword '${keyword}'`).toContain(keyword);
    }
  });

  test('has DMG configuration for macOS', () => {
    expect(packageData).toHaveProperty('dmg');
    expect(packageData.dmg).toHaveProperty('contents');
    expect(Array.isArray(packageData.dmg.contents)).toBe(true);
  });
});

test.describe('package.json - Optional Dependencies', () => {

  let packageData: any;

  test.beforeAll(() => {
    const content = fs.readFileSync(packagePath, 'utf-8');
    packageData = JSON.parse(content);
  });

  test('has optionalDependencies section', () => {
    expect(packageData).toHaveProperty('optionalDependencies');
    expect(typeof packageData.optionalDependencies).toBe('object');
  });

  test('includes ntsuspend as optional dependency', () => {
    expect(packageData.optionalDependencies).toHaveProperty('ntsuspend');
  });
});

test.describe('package.json - TensorFlow.js Version Consistency', () => {

  let packageData: any;

  test.beforeAll(() => {
    const content = fs.readFileSync(packagePath, 'utf-8');
    packageData = JSON.parse(content);
  });

  test('TensorFlow.js packages use consistent versions', () => {
    const tfjsVersion = packageData.dependencies['@tensorflow/tfjs'];
    const tfjsCoreVersion = packageData.dependencies['@tensorflow/tfjs-core'];
    const tfjsNodeVersion = packageData.dependencies['@tensorflow/tfjs-node'];
    const tfjsWebGPUVersion = packageData.dependencies['@tensorflow/tfjs-backend-webgpu'];

    expect(tfjsVersion).toBe('4.22.0');
    expect(tfjsCoreVersion).toBe('4.22.0');
    expect(tfjsNodeVersion).toBe('4.22.0');
    expect(tfjsWebGPUVersion).toBe('4.22.0');
  });
});

test.describe('package.json - Regression Tests', () => {

  test('file size is reasonable', () => {
    const stats = fs.statSync(packagePath);
    const fileSizeInKB = stats.size / 1024;

    expect(fileSizeInKB, 'package.json should not be excessively large').toBeLessThan(20);
  });

  test('no duplicate dependencies', () => {
    const content = fs.readFileSync(packagePath, 'utf-8');
    const packageData = JSON.parse(content);

    const deps = new Set(Object.keys(packageData.dependencies));
    const devDeps = new Set(Object.keys(packageData.devDependencies));

    const intersection = [...deps].filter(dep => devDeps.has(dep));
    expect(
      intersection.length,
      `Should not have dependencies in both deps and devDeps: ${intersection.join(', ')}`
    ).toBe(0);
  });

  test('version string is valid semver', () => {
    const content = fs.readFileSync(packagePath, 'utf-8');
    const packageData = JSON.parse(content);

    const version = packageData.version;
    const semverRegex = /^(\d+)\.(\d+)\.(\d+)$/;

    expect(version, 'Version should match semver format').toMatch(semverRegex);

    const match = version.match(semverRegex);
    if (match) {
      const [, major, minor, patch] = match;
      expect(parseInt(major), 'Major version should be a number').toBeGreaterThanOrEqual(0);
      expect(parseInt(minor), 'Minor version should be a number').toBeGreaterThanOrEqual(0);
      expect(parseInt(patch), 'Patch version should be a number').toBeGreaterThanOrEqual(0);
    }
  });

  test('main entry point file should exist', () => {
    const content = fs.readFileSync(packagePath, 'utf-8');
    const packageData = JSON.parse(content);

    const mainFile = path.join(process.cwd(), packageData.main);
    expect(fs.existsSync(mainFile), `Main entry point '${packageData.main}' should exist`).toBeTruthy();
  });
});

test.describe('package.json - Build Configuration Edge Cases', () => {

  let packageData: any;

  test.beforeAll(() => {
    const content = fs.readFileSync(packagePath, 'utf-8');
    packageData = JSON.parse(content);
  });

  test('extraResources includes example audio', () => {
    expect(packageData.build).toHaveProperty('extraResources');
    expect(Array.isArray(packageData.build.extraResources)).toBe(true);

    const hasExampleAudio = packageData.build.extraResources.some((resource: string) =>
      resource.includes('example.mp3')
    );
    expect(hasExampleAudio, 'Should include example audio in extraResources').toBe(true);
  });

  test('macOS target includes arm64 architecture', () => {
    expect(packageData.build.mac.target).toHaveProperty('arch');
    expect(Array.isArray(packageData.build.mac.target.arch)).toBe(true);
    expect(packageData.build.mac.target.arch).toContain('arm64');
  });

  test('macOS hardened runtime is enabled', () => {
    expect(packageData.build.mac).toHaveProperty('hardenedRuntime');
    expect(packageData.build.mac.hardenedRuntime).toBe(true);
  });

  test('Windows build includes portable target', () => {
    expect(Array.isArray(packageData.build.win.target)).toBe(true);
    expect(packageData.build.win.target).toContain('nsis');
    expect(packageData.build.win.target).toContain('portable');
  });
});

test.describe('package.json - Node Version Compatibility', () => {

  let packageData: any;

  test.beforeAll(() => {
    const content = fs.readFileSync(packagePath, 'utf-8');
    packageData = JSON.parse(content);
  });

  test('Electron version is modern and supported', () => {
    const electronVersion = packageData.devDependencies.electron;
    const majorVersion = parseInt(electronVersion.replace(/\^/, ''));

    expect(majorVersion, 'Electron version should be modern').toBeGreaterThanOrEqual(20);
  });

  test('uses modern JavaScript features via TypeScript', () => {
    expect(packageData.devDependencies).toHaveProperty('@types/node');
  });
});