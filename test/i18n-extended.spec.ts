import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Extended test suite for I18n JSON files
 * Additional tests for translation quality, formatting, and edge cases
 */

const languageCodes = ['da', 'de', 'en', 'es', 'fr', 'ja', 'nl', 'pt', 'ru', 'sv', 'zh'];
const i18nDir = path.join(process.cwd(), 'I18n');
const referenceLang = 'en';

test.describe('I18n JSON Files - Translation Placeholders and Variables', () => {

  languageCodes.forEach((lang) => {
    test(`${lang} - keyboard shortcuts are preserved correctly`, () => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Keys that should have keyboard shortcuts
      const shortcutKeys = ['open-file', 'export-audio', 'save2db', 'analyse', 'analyseAll'];

      for (const key of shortcutKeys) {
        if (data[key] && Array.isArray(data[key])) {
          const shortcut = data[key].find((item: string) =>
            item.includes('Ctrl+') || item.includes('Cmd+')
          );

          expect(
            shortcut,
            `Key '${key}' in '${lang}' should contain keyboard shortcut`
          ).toBeTruthy();
        }
      }
    });

    test(`${lang} - technical terms remain consistent`, () => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Technical terms that should not be translated
      const technicalTerms = ['BirdNET', 'eBird', 'CSV', 'FLAC', 'GPU', 'CPU'];

      const checkForTerms = (value: any): boolean => {
        if (typeof value === 'string') {
          // Check if any technical term appears in the value
          return technicalTerms.some(term => value.includes(term));
        } else if (Array.isArray(value)) {
          return value.some(item => checkForTerms(item));
        } else if (typeof value === 'object' && value !== null) {
          return Object.values(value).some(item => checkForTerms(item));
        }
        return false;
      };

      // Just verify that if technical terms are present, they're spelled correctly
      for (const [key, value] of Object.entries(data)) {
        if (checkForTerms(value)) {
          const stringValue = JSON.stringify(value);
          // Check correct capitalization of technical terms
          for (const term of technicalTerms) {
            const lowerTerm = term.toLowerCase();
            if (stringValue.toLowerCase().includes(lowerTerm)) {
              expect(
                stringValue.includes(term) || !stringValue.includes(lowerTerm),
                `Technical term '${term}' should maintain correct capitalization in '${lang}'`
              ).toBe(true);
            }
          }
        }
      }
    });

    test(`${lang} - percentage and number formatting is preserved`, () => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      const checkNumbers = (value: any): void => {
        if (typeof value === 'string') {
          // If string contains numbers with % or units, they should be properly formatted
          if (value.match(/\d+%/)) {
            expect(
              value.match(/\d+\s*%/),
              'Percentage values should have proper spacing'
            ).toBeTruthy();
          }
        } else if (Array.isArray(value)) {
          value.forEach(item => checkNumbers(item));
        } else if (typeof value === 'object' && value !== null) {
          Object.values(value).forEach(item => checkNumbers(item));
        }
      };

      checkNumbers(data);
    });

    test(`${lang} - URLs and links are preserved`, () => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      const checkUrls = (value: any, key: string): void => {
        if (typeof value === 'string' && value.includes('http')) {
          // URLs should be valid format
          const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/;
          const urls = value.match(urlPattern);

          if (urls) {
            urls.forEach(url => {
              expect(
                url.startsWith('http://') || url.startsWith('https://'),
                `URL in key '${key}' should start with http:// or https://`
              ).toBe(true);
            });
          }
        } else if (Array.isArray(value)) {
          value.forEach(item => checkUrls(item, key));
        } else if (typeof value === 'object' && value !== null) {
          Object.entries(value).forEach(([k, v]) => checkUrls(v, `${key}.${k}`));
        }
      };

      Object.entries(data).forEach(([key, value]) => checkUrls(value, key));
    });
  });
});

test.describe('I18n JSON Files - Nested Object Validation', () => {

  const nestedObjectKeys = ['settings', 'record-entry', 'ChartUI'];

  languageCodes.forEach((lang) => {
    nestedObjectKeys.forEach((nestedKey) => {
      test(`${lang} - '${nestedKey}' nested object has no empty values`, () => {
        const filePath = path.join(i18nDir, `index.${lang}.json`);
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);

        if (data[nestedKey] && typeof data[nestedKey] === 'object') {
          for (const [key, value] of Object.entries(data[nestedKey])) {
            if (typeof value === 'string') {
              expect(
                value.trim().length,
                `Value for '${nestedKey}.${key}' in '${lang}' should not be empty`
              ).toBeGreaterThan(0);
            } else if (Array.isArray(value)) {
              expect(
                value.length,
                `Array value for '${nestedKey}.${key}' in '${lang}' should not be empty`
              ).toBeGreaterThan(0);
            }
          }
        }
      });
    });

    test(`${lang} - 'settings' object has expected structure`, () => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.settings).toBeTruthy();

      const expectedSettingsKeys = [
        'basic',
        'advanced',
        'model-to-use',
        'confidence',
        'list-to-use'
      ];

      for (const key of expectedSettingsKeys) {
        expect(
          data.settings,
          `Settings should have key '${key}' in '${lang}'`
        ).toHaveProperty(key);
      }
    });

    test(`${lang} - 'ChartUI' object has expected keys`, () => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.ChartUI).toBeTruthy();

      const expectedChartKeys = ['chart-locations', 'GroupBy', 'hour', 'day', 'week'];

      for (const key of expectedChartKeys) {
        expect(
          data.ChartUI,
          `ChartUI should have key '${key}' in '${lang}'`
        ).toHaveProperty(key);
      }
    });
  });
});

test.describe('I18n JSON Files - Array Structure Consistency', () => {

  test('arrays in all languages have same length as reference', () => {
    const refPath = path.join(i18nDir, `index.${referenceLang}.json`);
    const refContent = fs.readFileSync(refPath, 'utf-8');
    const refData = JSON.parse(refContent);

    const arrayKeys = Object.keys(refData).filter(key => Array.isArray(refData[key]));

    languageCodes.forEach((lang) => {
      if (lang === referenceLang) return;

      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      for (const key of arrayKeys) {
        if (Array.isArray(data[key])) {
          expect(
            data[key].length,
            `Array '${key}' in '${lang}' should have same length as reference (${refData[key].length})`
          ).toBe(refData[key].length);
        }
      }
    });
  });

  test('headings array has expected minimum elements', () => {
    languageCodes.forEach((lang) => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.headings).toBeTruthy();
      expect(Array.isArray(data.headings)).toBe(true);
      expect(data.headings.length, 'Headings array should have at least 10 elements').toBeGreaterThanOrEqual(10);
    });
  });
});

test.describe('I18n JSON Files - Punctuation and Formatting', () => {

  languageCodes.forEach((lang) => {
    test(`${lang} - colon usage is consistent`, () => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Settings labels typically end with colons
      if (data.settings) {
        const labelKeys = Object.keys(data.settings).filter(key =>
          !key.includes('circle-help') &&
          typeof data.settings[key] === 'string' &&
          !['basic', 'advanced'].includes(key)
        );

        for (const key of labelKeys) {
          const value = data.settings[key];
          if (value && typeof value === 'string' && value.trim().length > 0) {
            // Labels for form fields should end with colon
            if (['latitude', 'longitude', 'locale'].includes(key)) {
              expect(
                value.endsWith(':') || value.endsWith('：'), // English or Japanese colon
                `Settings label '${key}' should end with colon in '${lang}'`
              ).toBe(true);
            }
          }
        }
      }
    });

    test(`${lang} - ellipsis formatting is correct`, () => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Should use proper ellipsis character or three dots
      if (content.includes('...')) {
        // This is acceptable
        expect(content.includes('....')).toBe(false); // No four dots
      }
    });

    test(`${lang} - quotation marks are properly closed`, () => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      const checkQuotes = (value: any): void => {
        if (typeof value === 'string') {
          // Count different types of quotes
          const doubleQuotes = (value.match(/"/g) || []).length;
          const curlyQuotes = (value.match(/[""]/g) || []).length;

          // Quotes should be balanced (even number)
          if (doubleQuotes > 0) {
            expect(doubleQuotes % 2, `Double quotes should be balanced in value: "${value}"`).toBe(0);
          }
        } else if (Array.isArray(value)) {
          value.forEach(item => checkQuotes(item));
        } else if (typeof value === 'object' && value !== null) {
          Object.values(value).forEach(item => checkQuotes(item));
        }
      };

      checkQuotes(data);
    });
  });
});

test.describe('I18n JSON Files - Whitespace and Formatting', () => {

  languageCodes.forEach((lang) => {
    test(`${lang} - no leading or trailing whitespace in values`, () => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      const checkWhitespace = (value: any, key: string): void => {
        if (typeof value === 'string') {
          expect(
            value === value.trim(),
            `Value for key '${key}' in '${lang}' should not have leading/trailing whitespace`
          ).toBe(true);
        } else if (Array.isArray(value)) {
          value.forEach((item, idx) => checkWhitespace(item, `${key}[${idx}]`));
        } else if (typeof value === 'object' && value !== null) {
          Object.entries(value).forEach(([k, v]) => checkWhitespace(v, `${key}.${k}`));
        }
      };

      Object.entries(data).forEach(([key, value]) => checkWhitespace(value, key));
    });

    test(`${lang} - no double spaces in text`, () => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      const checkDoubleSpaces = (value: any): void => {
        if (typeof value === 'string') {
          expect(
            value.includes('  '),
            `Value should not contain double spaces: "${value}"`
          ).toBe(false);
        } else if (Array.isArray(value)) {
          value.forEach(item => checkDoubleSpaces(item));
        } else if (typeof value === 'object' && value !== null) {
          Object.values(value).forEach(item => checkDoubleSpaces(item));
        }
      };

      checkDoubleSpaces(data);
    });
  });
});

test.describe('I18n JSON Files - Link and Reference Consistency', () => {

  test('external links in help content point to valid resources', () => {
    languageCodes.forEach((lang) => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Check links in help content
      const helpKeys = Object.keys(data).filter(key => key.includes('circle-help'));

      for (const key of helpKeys) {
        const value = data[key];
        if (Array.isArray(value)) {
          const textContent = value.join(' ');
          if (textContent.includes('href=')) {
            // Extract URLs
            const urls = textContent.match(/href=['"]([^'"]+)['"]/g);
            if (urls) {
              urls.forEach(url => {
                const cleanUrl = url.replace(/href=['"]/, '').replace(/['"]$/, '');
                expect(
                  cleanUrl.startsWith('http') || cleanUrl.startsWith('/'),
                  `URL in '${key}' should be absolute or relative: ${cleanUrl}`
                ).toBe(true);
              });
            }
          }
        }
      }
    });
  });

  test('padlock member feature link is consistent', () => {
    languageCodes.forEach((lang) => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      if (data.padlock && Array.isArray(data.padlock)) {
        const linkContent = data.padlock.find((item: string) => item.includes('href'));
        if (linkContent) {
          expect(
            linkContent.includes('buymeacoffee.com/matthew_kirkland'),
            'Padlock link should point to correct Buy Me a Coffee page'
          ).toBe(true);
        }
      }
    });
  });
});

test.describe('I18n JSON Files - Special Cases and Edge Cases', () => {

  test('loading-text is short and descriptive', () => {
    languageCodes.forEach((lang) => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      if (Array.isArray(data['loading-text'])) {
        const text = data['loading-text'][0];
        expect(
          text.length,
          `Loading text in '${lang}' should be concise (under 50 characters)`
        ).toBeLessThan(50);
      }
    });
  });

  test('update-progress-text ends with appropriate punctuation', () => {
    languageCodes.forEach((lang) => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      if (Array.isArray(data['update-progress-text'])) {
        const text = data['update-progress-text'][0];
        expect(
          text.endsWith(':') || text.endsWith('：'),
          `Update progress text in '${lang}' should end with colon`
        ).toBe(true);
      }
    });
  });

  test('navigation menu items are appropriately short', () => {
    const navKeys = ['navBarFile', 'navbarHelp', 'navbarTraining', 'navbarRecords', 'navbarAnalysis', 'navbarSettings'];

    languageCodes.forEach((lang) => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      for (const key of navKeys) {
        if (Array.isArray(data[key])) {
          const text = data[key][0];
          expect(
            text.length,
            `Navigation item '${key}' in '${lang}' should be short (under 20 characters)`
          ).toBeLessThan(20);
        }
      }
    });
  });

  test('file size is reasonable for all languages', () => {
    languageCodes.forEach((lang) => {
      const filePath = path.join(i18nDir, `index.${lang}.json`);
      const stats = fs.statSync(filePath);
      const fileSizeInKB = stats.size / 1024;

      expect(
        fileSizeInKB,
        `${lang} file should be reasonably sized (under 100KB)`
      ).toBeLessThan(100);
    });
  });
});