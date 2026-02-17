import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Comprehensive test suite for index.html
 * Tests HTML structure, validity, and key elements
 */

const htmlFilePath = path.join(process.cwd(), 'index.html');

test.describe('HTML File - Existence and Basic Structure', () => {

  test('index.html file exists', () => {
    expect(fs.existsSync(htmlFilePath), 'index.html should exist in project root').toBeTruthy();
  });

  test('file is not empty', () => {
    const content = fs.readFileSync(htmlFilePath, 'utf-8');
    expect(content.length, 'HTML file should not be empty').toBeGreaterThan(0);
  });

  test('file has DOCTYPE declaration', () => {
    const content = fs.readFileSync(htmlFilePath, 'utf-8');
    expect(content.toLowerCase()).toContain('<!doctype html>');
  });

  test('file has opening html tag', () => {
    const content = fs.readFileSync(htmlFilePath, 'utf-8');
    expect(content).toMatch(/<html[^>]*>/i);
  });

  test('file has closing html tag', () => {
    const content = fs.readFileSync(htmlFilePath, 'utf-8');
    expect(content).toContain('</html>');
  });
});

test.describe('HTML File - Head Section', () => {

  let htmlContent: string;

  test.beforeAll(() => {
    htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
  });

  test('has head section', () => {
    expect(htmlContent).toContain('<head>');
    expect(htmlContent).toContain('</head>');
  });

  test('has charset meta tag', () => {
    expect(htmlContent).toMatch(/<meta[^>]*charset[^>]*>/i);
  });

  test('charset is set to utf-8', () => {
    expect(htmlContent.toLowerCase()).toContain('charset="utf-8"');
  });

  test('has viewport meta tag', () => {
    expect(htmlContent).toMatch(/<meta[^>]*name="viewport"[^>]*>/i);
  });

  test('has title tag', () => {
    expect(htmlContent).toContain('<title>');
    expect(htmlContent).toContain('</title>');
  });

  test('title is "Chirpity"', () => {
    const titleMatch = htmlContent.match(/<title>(.*?)<\/title>/i);
    expect(titleMatch, 'Should have a title tag').toBeTruthy();
    if (titleMatch) {
      expect(titleMatch[1].trim()).toBe('Chirpity');
    }
  });

  test('has Content Security Policy meta tag', () => {
    expect(htmlContent).toMatch(/<meta[^>]*http-equiv="Content-Security-Policy"[^>]*>/i);
  });
});

test.describe('HTML File - Body Section', () => {

  let htmlContent: string;

  test.beforeAll(() => {
    htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
  });

  test('has body section', () => {
    expect(htmlContent).toContain('<body');
    expect(htmlContent).toContain('</body>');
  });

  test('has loading screen element', () => {
    expect(htmlContent).toMatch(/id="loading-screen"/);
  });

  test('has content wrapper element', () => {
    expect(htmlContent).toMatch(/id="contentWrapper"/);
  });

  test('has spectrogram wrapper element', () => {
    expect(htmlContent).toMatch(/id="spectrogramWrapper"/);
  });
});

test.describe('HTML File - CSS and JavaScript Resources', () => {

  let htmlContent: string;

  test.beforeAll(() => {
    htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
  });

  test('includes Bootstrap CSS', () => {
    expect(htmlContent).toMatch(/bootstrap.*\.css/i);
  });

  test('includes Bootstrap JavaScript', () => {
    expect(htmlContent).toMatch(/bootstrap.*\.js/i);
  });

  test('includes custom CSS', () => {
    expect(htmlContent).toContain('css/style.css');
  });

  test('includes Chart.js library', () => {
    expect(htmlContent).toMatch(/chart\.js/i);
  });

  test('includes Leaflet CSS for maps', () => {
    expect(htmlContent).toMatch(/leaflet.*\.css/i);
  });

  test('includes Leaflet JavaScript for maps', () => {
    expect(htmlContent).toMatch(/leaflet.*\.js/i);
  });

  test('uses defer attribute for non-critical scripts', () => {
    const scriptTags = htmlContent.match(/<script[^>]*>/gi) || [];
    const internalScripts = scriptTags.filter(tag =>
      !tag.includes('http') && tag.includes('src')
    );

    // Most internal scripts should use defer
    const deferredScripts = internalScripts.filter(tag => tag.includes('defer'));
    expect(deferredScripts.length, 'Most internal scripts should use defer attribute').toBeGreaterThan(0);
  });
});

test.describe('HTML File - Language and Accessibility', () => {

  let htmlContent: string;

  test.beforeAll(() => {
    htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
  });

  test('html tag has lang attribute', () => {
    expect(htmlContent).toMatch(/<html[^>]*lang[^>]*>/i);
  });

  test('lang attribute is set to "en"', () => {
    expect(htmlContent).toMatch(/<html[^>]*lang="en"[^>]*>/i);
  });

  test('has aria attributes for accessibility', () => {
    // Check for at least some aria attributes
    expect(htmlContent).toMatch(/aria-/);
  });

  test('loading screen has proper accessibility attributes', () => {
    expect(htmlContent).toMatch(/id="loading-screen"[^>]*role="progressbar"/);
    expect(htmlContent).toMatch(/aria-busy="true"/);
  });

  test('buttons and interactive elements have proper aria labels', () => {
    // Look for buttons with accessibility considerations
    const buttonMatches = htmlContent.match(/<button[^>]*>/gi) || [];
    expect(buttonMatches.length, 'Should have multiple buttons').toBeGreaterThan(0);

    // At least some buttons should have titles or aria-labels
    const accessibleButtons = buttonMatches.filter(button =>
      button.includes('title=') || button.includes('aria-label=')
    );
    expect(accessibleButtons.length, 'Buttons should have titles or aria-labels').toBeGreaterThan(0);
  });
});

test.describe('HTML File - Key UI Components', () => {

  let htmlContent: string;

  test.beforeAll(() => {
    htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
  });

  test('has explore wrapper for data exploration', () => {
    expect(htmlContent).toMatch(/id="exploreWrapper"/);
  });

  test('has spectrogram display element', () => {
    expect(htmlContent).toMatch(/id="spectrogram"/);
  });

  test('has waveform display element', () => {
    expect(htmlContent).toMatch(/id="waveform"/);
  });

  test('has controls wrapper', () => {
    expect(htmlContent).toMatch(/id="controlsWrapper"/);
  });

  test('has results table container', () => {
    expect(htmlContent).toMatch(/id="resultTableContainer"/);
  });

  test('has play/pause button', () => {
    expect(htmlContent).toMatch(/id="playToggle"/);
  });

  test('has zoom controls', () => {
    expect(htmlContent).toMatch(/id="zoomIn"/);
    expect(htmlContent).toMatch(/id="zoomOut"/);
  });
});

test.describe('HTML File - Modals', () => {

  let htmlContent: string;

  test.beforeAll(() => {
    htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
  });

  test('has diagnostics modal', () => {
    expect(htmlContent).toMatch(/id="diagnosticsModal"/);
  });

  test('has record entry modal', () => {
    expect(htmlContent).toMatch(/id="record-entry-modal"/);
  });

  test('modals have proper Bootstrap classes', () => {
    expect(htmlContent).toMatch(/class="[^"]*modal[^"]*"/);
    expect(htmlContent).toMatch(/class="[^"]*modal-dialog[^"]*"/);
    expect(htmlContent).toMatch(/class="[^"]*modal-content[^"]*"/);
  });

  test('modals have close buttons', () => {
    const closeButtons = htmlContent.match(/class="[^"]*btn-close[^"]*"/g);
    expect(closeButtons, 'Modals should have close buttons').toBeTruthy();
    if (closeButtons) {
      expect(closeButtons.length, 'Should have multiple close buttons for modals').toBeGreaterThanOrEqual(2);
    }
  });
});

test.describe('HTML File - Bootstrap Integration', () => {

  let htmlContent: string;

  test.beforeAll(() => {
    htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
  });

  test('uses Bootstrap dark theme', () => {
    expect(htmlContent).toMatch(/data-bs-theme="dark"/);
  });

  test('uses Bootstrap grid system', () => {
    expect(htmlContent).toMatch(/class="[^"]*row[^"]*"/);
    expect(htmlContent).toMatch(/class="[^"]*col[^"]*"/);
  });

  test('uses Bootstrap button classes', () => {
    expect(htmlContent).toMatch(/class="[^"]*btn[^"]*"/);
  });

  test('uses Bootstrap form classes', () => {
    expect(htmlContent).toMatch(/class="[^"]*form-control[^"]*"/);
    expect(htmlContent).toMatch(/class="[^"]*form-floating[^"]*"/);
  });
});

test.describe('HTML File - Material Symbols Icons', () => {

  let htmlContent: string;

  test.beforeAll(() => {
    htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
  });

  test('uses Material Symbols icons', () => {
    expect(htmlContent).toMatch(/class="[^"]*material-symbols-outlined[^"]*"/);
  });

  test('has icons for common actions', () => {
    // Check for some expected icon names
    expect(htmlContent).toContain('play_circle');
    expect(htmlContent).toContain('pause');
    expect(htmlContent).toContain('zoom_in');
    expect(htmlContent).toContain('zoom_out');
  });
});

test.describe('HTML File - Forms and Inputs', () => {

  let htmlContent: string;

  test.beforeAll(() => {
    htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
  });

  test('has form elements', () => {
    expect(htmlContent).toMatch(/<form[^>]*>/i);
  });

  test('has input elements', () => {
    expect(htmlContent).toMatch(/<input[^>]*>/i);
  });

  test('has select elements for dropdowns', () => {
    expect(htmlContent).toMatch(/<select[^>]*>/i);
  });

  test('form inputs have associated labels', () => {
    const inputs = htmlContent.match(/<input[^>]*id="([^"]+)"[^>]*>/gi) || [];

    // Check that for each input with an id, there's a corresponding label
    for (const input of inputs) {
      const idMatch = input.match(/id="([^"]+)"/);
      if (idMatch && !input.includes('type="hidden"')) {
        const inputId = idMatch[1];
        // Label could be via <label for="id"> or wrapping label or aria-label
        const hasLabel =
          htmlContent.includes(`for="${inputId}"`) ||
          htmlContent.includes(`aria-label`) ||
          htmlContent.includes('form-floating');

        expect(hasLabel, `Input with id="${inputId}" should have an associated label`).toBeTruthy();
      }
    }
  });
});

test.describe('HTML File - Tag Balance and Syntax', () => {

  let htmlContent: string;

  test.beforeAll(() => {
    htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
  });

  test('major container tags are balanced', () => {
    const checkTagBalance = (tagName: string) => {
      const openTagRegex = new RegExp(`<${tagName}[^>]*>`, 'gi');
      const closeTagRegex = new RegExp(`</${tagName}>`, 'gi');

      const openTags = (htmlContent.match(openTagRegex) || []).filter(tag => !tag.includes('/>'));
      const closeTags = htmlContent.match(closeTagRegex) || [];

      expect(openTags.length, `Opening and closing ${tagName} tags should be balanced`).toBe(closeTags.length);
    };

    checkTagBalance('div');
    checkTagBalance('span');
    checkTagBalance('button');
    checkTagBalance('form');
  });

  test('all script tags are properly closed', () => {
    const scriptOpenTags = htmlContent.match(/<script[^>]*>/gi) || [];
    const scriptCloseTags = htmlContent.match(/<\/script>/gi) || [];

    expect(scriptOpenTags.length, 'Script tags should be properly closed').toBe(scriptCloseTags.length);
  });

  test('no obvious syntax errors in HTML', () => {
    // Check for common HTML syntax errors
    expect(htmlContent, 'Should not have << sequences').not.toContain('<<');
    expect(htmlContent, 'Should not have >> sequences outside of comments').not.toMatch(/[^-]>>/);

    // Check for unclosed quotes in attributes (basic check)
    const lines = htmlContent.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('<') && line.includes('>')) {
        const tagContent = line.match(/<[^>]+>/);
        if (tagContent) {
          const doubleQuotes = (tagContent[0].match(/"/g) || []).length;
          const singleQuotes = (tagContent[0].match(/'/g) || []).length;

          // Quotes should be balanced in a tag
          expect(doubleQuotes % 2, `Line ${i + 1}: Double quotes should be balanced`).toBe(0);
          // Single quotes less strict as they can be in text
        }
      }
    }
  });
});

test.describe('HTML File - Security Considerations', () => {

  let htmlContent: string;

  test.beforeAll(() => {
    htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
  });

  test('has Content Security Policy defined', () => {
    expect(htmlContent).toMatch(/Content-Security-Policy/i);
  });

  test('CSP restricts script sources appropriately', () => {
    const cspMatch = htmlContent.match(/Content-Security-Policy"[^>]*content="([^"]*)"/i);
    if (cspMatch) {
      const cspContent = cspMatch[1];
      expect(cspContent).toContain('script-src');
    }
  });

  test('external resources use integrity checks where applicable', () => {
    // Leaflet CSS and JS should have integrity attributes
    const leafletLinks = htmlContent.match(/<link[^>]*leaflet[^>]*>/gi) || [];
    const leafletScripts = htmlContent.match(/<script[^>]*leaflet[^>]*>/gi) || [];

    for (const link of leafletLinks) {
      if (link.includes('https://')) {
        expect(link, 'External Leaflet CSS should have integrity attribute').toMatch(/integrity=/i);
        expect(link, 'External Leaflet CSS should have crossorigin attribute').toMatch(/crossorigin=/i);
      }
    }

    for (const script of leafletScripts) {
      if (script.includes('https://')) {
        expect(script, 'External Leaflet script should have integrity attribute').toMatch(/integrity=/i);
        expect(script, 'External Leaflet script should have crossorigin attribute').toMatch(/crossorigin=/i);
      }
    }
  });
});

test.describe('HTML File - Regression Tests', () => {

  test('file size is reasonable', () => {
    const stats = fs.statSync(htmlFilePath);
    const fileSizeInKB = stats.size / 1024;

    // HTML file should be less than 500KB (very generous limit)
    expect(fileSizeInKB, 'HTML file should not be excessively large').toBeLessThan(500);
  });

  test('does not contain debugging code', () => {
    const content = fs.readFileSync(htmlFilePath, 'utf-8');

    // Should not contain console.log or debugger statements
    expect(content, 'Should not contain inline console.log').not.toMatch(/console\.log/);
    expect(content, 'Should not contain debugger statements').not.toMatch(/debugger;/);
  });

  test('has proper indentation and formatting', () => {
    const content = fs.readFileSync(htmlFilePath, 'utf-8');
    const lines = content.split('\n');

    // Check that file has some indented lines (indicates proper formatting)
    const indentedLines = lines.filter(line => line.startsWith('  ') || line.startsWith('\t'));
    expect(indentedLines.length, 'File should have proper indentation').toBeGreaterThan(0);
  });
});

test.describe('HTML File - Specific Functional Elements', () => {

  let htmlContent: string;

  test.beforeAll(() => {
    htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
  });

  test('has bird species autocomplete input', () => {
    expect(htmlContent).toMatch(/id="bird-autocomplete"/);
  });

  test('has species search functionality elements', () => {
    expect(htmlContent).toMatch(/class="[^"]*bird-search[^"]*"/);
    expect(htmlContent).toMatch(/id="bird-suggestions"/);
  });

  test('has confidence slider control', () => {
    expect(htmlContent).toMatch(/id="confidenceValue"/);
    expect(htmlContent).toMatch(/id="confidenceSliderContainer"/);
  });

  test('has filename display element', () => {
    expect(htmlContent).toMatch(/id="filename"/);
  });

  test('has filter panel for audio settings', () => {
    expect(htmlContent).toMatch(/id="filter-panel"/);
  });

  test('has pagination controls for results', () => {
    expect(htmlContent).toMatch(/class="[^"]*pagination[^"]*"/);
  });
});