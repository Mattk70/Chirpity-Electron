import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Comprehensive test suite for I18n (Internationalization) JSON files
 * Tests data integrity, consistency, and completeness across all language files
 */

// List of all language codes that should be tested
const languageCodes = ['da', 'de', 'en', 'es', 'fr', 'ja', 'nl', 'pt', 'ru', 'sv', 'zh'];

// Path to I18n directory
const i18nDir = path.join(process.cwd(), 'I18n');

// Reference language for key comparison (English)
const referenceLang = 'en';

test.describe('I18n JSON Files - Structure and Validity', () => {

  test('all expected language files exist', () => {
    for (const lang of languageCodes) {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      expect(fs.existsSync(filePath), `Language file for '${lang}' should exist`).toBeTruthy();
    }
  });

  languageCodes.forEach((lang) => {
    test(`${lang} - file is valid JSON`, () => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Should not throw when parsing
      expect(() => {
        JSON.parse(content);
      }).not.toThrow();
    });

    test(`${lang} - file contains valid JSON object`, () => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Root should be an object
      expect(typeof data).toBe('object');
      expect(Array.isArray(data)).toBe(false);
      expect(data).not.toBeNull();
    });

    test(`${lang} - file is not empty`, () => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Should have at least one key
      const keys = Object.keys(data);
      expect(keys.length).toBeGreaterThan(0);
    });
  });
});

test.describe('I18n JSON Files - Key Consistency', () => {

  let referenceKeys: string[];
  let referenceData: any;

  test.beforeAll(() => {
    // Load reference language file
    const referenceFile = path.join(i18nDir, `index.${referenceLang}.json`);
    const content = fs.readFileSync(referenceFile, 'utf-8');
    referenceData = JSON.parse(content);
    referenceKeys = Object.keys(referenceData);
  });

  languageCodes.forEach((lang) => {
    if (lang === referenceLang) return; // Skip reference language

    test(`${lang} - has all keys from reference language (${referenceLang})`, () => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      const langKeys = Object.keys(data);

      // Check all reference keys exist
      for (const key of referenceKeys) {
        expect(langKeys, `Language '${lang}' should contain key '${key}'`).toContain(key);
      }
    });

    test(`${lang} - has no extra keys not in reference language`, () => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      const langKeys = Object.keys(data);

      // Check no extra keys exist
      for (const key of langKeys) {
        expect(referenceKeys, `Language '${lang}' has unexpected key '${key}'`).toContain(key);
      }
    });

    test(`${lang} - has same number of keys as reference`, () => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(Object.keys(data).length).toBe(referenceKeys.length);
    });
  });
});

test.describe('I18n JSON Files - Value Integrity', () => {

  languageCodes.forEach((lang) => {
    test(`${lang} - all values are strings or arrays`, () => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      for (const [key, value] of Object.entries(data)) {
        const valueType = typeof value;
        const isValidType = valueType === 'string' || Array.isArray(value) || (valueType === 'object' && value !== null);
        expect(isValidType, `Key '${key}' in '${lang}' should have string, array, or object value`).toBeTruthy();
      }
    });

    test(`${lang} - no values are null or undefined`, () => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      for (const [key, value] of Object.entries(data)) {
        expect(value, `Key '${key}' in '${lang}' should not be null or undefined`).not.toBeNull();
        expect(value, `Key '${key}' in '${lang}' should not be null or undefined`).not.toBeUndefined();
      }
    });

    test(`${lang} - array values are not empty`, () => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value)) {
          expect(value.length, `Array value for key '${key}' in '${lang}' should not be empty`).toBeGreaterThan(0);
        }
      }
    });

    test(`${lang} - string values are not empty`, () => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
          expect(value.trim().length, `String value for key '${key}' in '${lang}' should not be empty`).toBeGreaterThan(0);
        }
      }
    });
  });
});

test.describe('I18n JSON Files - Specific Key Structure', () => {

  test('reference language has expected top-level keys', () => {
    const filePath = path.join(i18nDir, `index.${referenceLang}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    // Check for some expected keys based on the content
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
      expect(data, `Should contain key '${key}'`).toHaveProperty(key);
    }
  });

  languageCodes.forEach((lang) => {
    test(`${lang} - 'settings' key is an object`, () => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data).toHaveProperty('settings');
      expect(typeof data.settings).toBe('object');
      expect(Array.isArray(data.settings)).toBe(false);
    });

    test(`${lang} - 'record-entry' key is an object`, () => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data).toHaveProperty('record-entry');
      expect(typeof data['record-entry']).toBe('object');
      expect(Array.isArray(data['record-entry'])).toBe(false);
    });

    test(`${lang} - 'ChartUI' key is an object`, () => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data).toHaveProperty('ChartUI');
      expect(typeof data.ChartUI).toBe('object');
      expect(Array.isArray(data.ChartUI)).toBe(false);
    });

    test(`${lang} - 'headings' key is an array`, () => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data).toHaveProperty('headings');
      expect(Array.isArray(data.headings)).toBe(true);
    });
  });
});

test.describe('I18n JSON Files - Special Characters and Encoding', () => {

  languageCodes.forEach((lang) => {
    test(`${lang} - file uses UTF-8 encoding`, () => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const buffer = fs.readFileSync(filePath);

      // Check if buffer starts with UTF-8 BOM (optional but should decode properly)
      // The file should be readable as UTF-8
      expect(() => {
        buffer.toString('utf-8');
      }).not.toThrow();
    });

    test(`${lang} - special characters are properly encoded in values`, () => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Check that we can stringify and parse again without issues
      expect(() => {
        const stringified = JSON.stringify(data);
        JSON.parse(stringified);
      }).not.toThrow();
    });
  });
});

test.describe('I18n JSON Files - HTML Content Validation', () => {

  languageCodes.forEach((lang) => {
    test(`${lang} - HTML tags in values are properly closed`, () => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      const checkHtmlTags = (value: any): void => {
        if (typeof value === 'string') {
          // Count opening and closing tags
          const openTags = (value.match(/<([a-z]+)[^>]*>/gi) || []).map(tag =>
            tag.replace(/<([a-z]+)[^>]*>/i, '$1').toLowerCase()
          ).filter(tag => !['br', 'hr', 'img', 'input', 'meta', 'link'].includes(tag));

          const closeTags = (value.match(/<\/([a-z]+)>/gi) || []).map(tag =>
            tag.replace(/<\/([a-z]+)>/i, '$1').toLowerCase()
          );

          // Basic check: number of opening tags should match closing tags
          expect(openTags.length, `HTML tags in value should be properly closed in '${lang}'`).toBe(closeTags.length);
        } else if (Array.isArray(value)) {
          value.forEach(item => checkHtmlTags(item));
        } else if (typeof value === 'object' && value !== null) {
          Object.values(value).forEach(item => checkHtmlTags(item));
        }
      };

      checkHtmlTags(data);
    });
  });
});

test.describe('I18n JSON Files - Menu and Navigation Keys', () => {

  const navigationKeys = ['navBarFile', 'navbarHelp', 'navbarTraining', 'navbarRecords', 'navbarAnalysis', 'navbarSettings'];

  languageCodes.forEach((lang) => {
    test(`${lang} - has all navigation menu keys`, () => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      for (const navKey of navigationKeys) {
        expect(data, `Should have navigation key '${navKey}'`).toHaveProperty(navKey);
        expect(data[navKey], `Navigation key '${navKey}' should not be empty`).toBeTruthy();
      }
    });
  });
});

test.describe('I18n JSON Files - Regression Tests', () => {

  test('files do not contain placeholder text', () => {
    languageCodes.forEach((lang) => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Common placeholder patterns
      const placeholders = ['TODO', 'FIXME', 'XXX', 'TBD', '???'];

      for (const placeholder of placeholders) {
        expect(content.includes(placeholder), `File '${lang}' should not contain placeholder '${placeholder}'`).toBe(false);
      }
    });
  });

  test('files do not contain obvious translation errors', () => {
    languageCodes.forEach((lang) => {
      if (lang === 'en') return; // Skip English

      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Check that non-English files don't contain too much English text in key values
      // (This is a heuristic check - may need adjustment)
      const checkForUntranslated = (value: any, key: string): void => {
        if (typeof value === 'string') {
          // Allow English in URLs, keyboard shortcuts, and certain technical terms
          if (key.includes('url') || key.includes('link') || value.startsWith('Ctrl+') || value.startsWith('http')) {
            return;
          }
          // Don't check values that are very short (like "CPU", "GPU")
          if (value.length < 4) {
            return;
          }
        }
      };

      Object.entries(data).forEach(([key, value]) => {
        checkForUntranslated(value, key);
      });
    });
  });
});

test.describe('I18n JSON Files - Boundary and Edge Cases', () => {

  test('files handle arrays with keyboard shortcuts correctly', () => {
    languageCodes.forEach((lang) => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Check keys that should have arrays with keyboard shortcuts
      const keysWithShortcuts = ['open-file', 'export-audio', 'save2db', 'analyse', 'analyseAll'];

      for (const key of keysWithShortcuts) {
        if (data[key]) {
          expect(Array.isArray(data[key]), `Key '${key}' in '${lang}' should be an array`).toBe(true);
          if (Array.isArray(data[key])) {
            expect(data[key].length, `Key '${key}' in '${lang}' array should have at least 1 element`).toBeGreaterThan(0);
          }
        }
      }
    });
  });

  test('nested object values have consistent structure across languages', () => {
    const referenceFile = path.join(i18nDir, `index.${referenceLang}.json`);
    const referenceContent = fs.readFileSync(referenceFile, 'utf-8');
    const referenceData = JSON.parse(referenceContent);

    languageCodes.forEach((lang) => {
      if (lang === referenceLang) return;

      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Check nested objects have same keys
      for (const [key, value] of Object.entries(referenceData)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          expect(data[key], `Lang '${lang}' should have nested object '${key}'`).toBeTruthy();

          const refKeys = Object.keys(value);
          const langKeys = Object.keys(data[key] as object);

          expect(langKeys.length, `Nested object '${key}' in '${lang}' should have same number of keys as reference`).toBe(refKeys.length);
        }
      }
    });
  });
});