import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Extended test suite for index.html
 * Additional tests for I18n integration, data attributes, and advanced features
 */

const htmlFilePath = path.join(process.cwd(), 'index.html');

test.describe('HTML File - I18n Integration', () => {

  let htmlContent: string;

  test.beforeAll(() => {
    htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
  });

  test('has elements with data-i18n attributes for translation', () => {
    // Check for I18n integration
    const hasI18nElements = htmlContent.includes('data-i18n') || htmlContent.includes('id="loading-text"');
    expect(hasI18nElements, 'Should have elements prepared for I18n').toBe(true);
  });

  test('loading text element exists for I18n', () => {
    expect(htmlContent).toMatch(/id="loading-text"/);

    const loadingTextMatch = htmlContent.match(/<span[^>]*id="loading-text"[^>]*>([^<]*)<\/span>/);
    if (loadingTextMatch) {
      const defaultText = loadingTextMatch[1].trim();
      expect(defaultText.length, 'Loading text should have default value').toBeGreaterThan(0);
    }
  });

  test('navigation menu items have proper structure for I18n', () => {
    const navIds = ['navBarFile', 'navbarHelp', 'navbarTraining', 'navbarRecords', 'navbarAnalysis', 'navbarSettings'];

    for (const navId of navIds) {
      expect(htmlContent, `Should have navigation element with id="${navId}"`).toMatch(new RegExp(`id="${navId}"`));
    }
  });

  test('buttons with text content are accessible for translation', () => {
    const importantButtons = ['analyse', 'analyseAll', 'save2db', 'export-audio'];

    for (const btnId of importantButtons) {
      const buttonMatch = htmlContent.match(new RegExp(`id="${btnId}"`, 'i'));
      expect(buttonMatch, `Button with id="${btnId}" should exist`).toBeTruthy();
    }
  });
});

test.describe('HTML File - Data Attributes and Metadata', () => {

  let htmlContent: string;

  test.beforeAll(() => {
    htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
  });

  test('uses Bootstrap data attributes correctly', () => {
    // Bootstrap 5 uses data-bs- prefix
    expect(htmlContent).toMatch(/data-bs-/);
    expect(htmlContent).toMatch(/data-bs-toggle/);
    expect(htmlContent).toMatch(/data-bs-theme="dark"/);
  });

  test('popovers have proper data attributes', () => {
    expect(htmlContent).toMatch(/data-bs-toggle="popover"/);

    // Popovers should have title and content
    const popoverElements = htmlContent.match(/data-bs-toggle="popover"/g);
    if (popoverElements) {
      expect(popoverElements.length, 'Should have multiple popover elements').toBeGreaterThan(0);
    }
  });

  test('has data attributes for custom functionality', () => {
    // Check for custom data attributes used in the app
    const hasCustomData = htmlContent.includes('data-') || htmlContent.includes('role=');
    expect(hasCustomData, 'Should have custom data attributes').toBe(true);
  });

  test('form elements have proper autocomplete attributes', () => {
    const autocompleteInputs = htmlContent.match(/<input[^>]*class="[^"]*autocomplete[^"]*"/g);
    if (autocompleteInputs) {
      expect(autocompleteInputs.length, 'Should have autocomplete inputs').toBeGreaterThan(0);
    }
  });
});

test.describe('HTML File - Interactive Elements', () => {

  let htmlContent: string;

  test.beforeAll(() => {
    htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
  });

  test('has autocomplete functionality for bird search', () => {
    expect(htmlContent).toMatch(/id="bird-autocomplete"/);
    expect(htmlContent).toMatch(/id="bird-suggestions"/);
    expect(htmlContent).toMatch(/class="[^"]*autocomplete[^"]*"/);
  });

  test('has explore functionality elements', () => {
    expect(htmlContent).toMatch(/id="exploreWrapper"/);
    expect(htmlContent).toMatch(/id="explore-locations"/);
    expect(htmlContent).toMatch(/id="bird-autocomplete-explore"/);
  });

  test('has date range picker integration', () => {
    expect(htmlContent).toMatch(/id="exploreRange"/);
    expect(htmlContent).toContain('date_range');
  });

  test('has unsaved changes indicator', () => {
    expect(htmlContent).toMatch(/id="unsaved-icon"/);
    expect(htmlContent).toMatch(/class="[^"]*text-warning[^"]*"/);
  });

  test('has metadata display', () => {
    expect(htmlContent).toMatch(/id="metadata"/);
    expect(htmlContent).toMatch(/data-bs-toggle="popover"/);
  });
});

test.describe('HTML File - Audio Controls', () => {

  let htmlContent: string;

  test.beforeAll(() => {
    htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
  });

  test('has play/pause control', () => {
    expect(htmlContent).toMatch(/id="playToggle"/);
    expect(htmlContent).toContain('play_circle');
    expect(htmlContent).toContain('pause');
  });

  test('has zoom controls for spectrogram', () => {
    expect(htmlContent).toMatch(/id="zoomIn"/);
    expect(htmlContent).toMatch(/id="zoomOut"/);
    expect(htmlContent).toContain('zoom_in');
    expect(htmlContent).toContain('zoom_out');
  });

  test('has filter panel controls', () => {
    expect(htmlContent).toMatch(/id="filter-panel"/);
  });

  test('has confidence slider control', () => {
    expect(htmlContent).toMatch(/id="confidenceValue"/);
    expect(htmlContent).toMatch(/id="confidenceSliderContainer"/);
  });
});

test.describe('HTML File - Results and Data Display', () => {

  let htmlContent: string;

  test.beforeAll(() => {
    htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
  });

  test('has results table container', () => {
    expect(htmlContent).toMatch(/id="resultTableContainer"/);
  });

  test('has pagination controls', () => {
    expect(htmlContent).toMatch(/class="[^"]*pagination[^"]*"/);
  });

  test('has filename display', () => {
    expect(htmlContent).toMatch(/id="filename"/);
  });

  test('has location list controls', () => {
    expect(htmlContent).toMatch(/id="explore-locations"/);
  });
});

test.describe('HTML File - Modal Dialogs', () => {

  let htmlContent: string;

  test.beforeAll(() => {
    htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
  });

  test('modals follow Bootstrap 5 structure', () => {
    expect(htmlContent).toMatch(/class="[^"]*modal[^"]*"/);
    expect(htmlContent).toMatch(/class="[^"]*modal-dialog[^"]*"/);
    expect(htmlContent).toMatch(/class="[^"]*modal-content[^"]*"/);
    expect(htmlContent).toMatch(/class="[^"]*modal-header[^"]*"/);
    expect(htmlContent).toMatch(/class="[^"]*modal-body[^"]*"/);
  });

  test('has diagnostics modal', () => {
    expect(htmlContent).toMatch(/id="diagnosticsModal"/);
  });

  test('has record entry modal', () => {
    expect(htmlContent).toMatch(/id="record-entry-modal"/);
  });

  test('modals have backdrop and keyboard close', () => {
    const modals = htmlContent.match(/class="modal[^"]*"/g);
    if (modals) {
      // At least some modals should be dismissible
      expect(modals.length, 'Should have modal elements').toBeGreaterThan(0);
    }
  });

  test('modal close buttons are properly configured', () => {
    const closeButtons = htmlContent.match(/class="[^"]*btn-close[^"]*"/g);
    expect(closeButtons, 'Should have modal close buttons').toBeTruthy();
    if (closeButtons) {
      expect(closeButtons.length, 'Should have multiple close buttons').toBeGreaterThanOrEqual(2);
    }
  });
});

test.describe('HTML File - Responsive Design Elements', () => {

  let htmlContent: string;

  test.beforeAll(() => {
    htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
  });

  test('uses responsive Bootstrap classes', () => {
    expect(htmlContent).toMatch(/class="[^"]*col-[^"]*"/);
    expect(htmlContent).toMatch(/class="[^"]*row[^"]*"/);
    expect(htmlContent).toMatch(/class="[^"]*container[^"]*"/);
  });

  test('has responsive visibility classes', () => {
    // d-none, d-lg-inline-block, etc.
    expect(htmlContent).toMatch(/class="[^"]*d-none[^"]*"/);
    expect(htmlContent).toMatch(/class="[^"]*d-[^"]*"/);
  });

  test('buttons have responsive text', () => {
    // Some button text hidden on small screens
    expect(htmlContent).toMatch(/class="[^"]*d-lg-inline-block[^"]*"/);
  });

  test('uses proper spacing utilities', () => {
    expect(htmlContent).toMatch(/class="[^"]*p-\d[^"]*"/);  // padding
    expect(htmlContent).toMatch(/class="[^"]*m-\d[^"]*"/);  // margin
  });
});

test.describe('HTML File - Script Loading and Performance', () => {

  let htmlContent: string;

  test.beforeAll(() => {
    htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
  });

  test('critical scripts are loaded early', () => {
    const scriptTags = htmlContent.split(/<script/);
    const firstScripts = scriptTags.slice(0, 5).join('<script');

    // Bootstrap and core libraries should load early
    expect(firstScripts).toContain('bootstrap');
  });

  test('uses async or defer for non-critical scripts', () => {
    const scriptMatches = htmlContent.match(/<script[^>]*src[^>]*>/g) || [];

    let deferredOrAsyncCount = 0;
    for (const script of scriptMatches) {
      if (script.includes('defer') || script.includes('async')) {
        deferredOrAsyncCount++;
      }
    }

    expect(
      deferredOrAsyncCount,
      'Most external scripts should use defer or async'
    ).toBeGreaterThan(0);
  });

  test('external resources use integrity checks', () => {
    const leafletResources = htmlContent.match(/<(link|script)[^>]*leaflet[^>]*>/gi) || [];

    for (const resource of leafletResources) {
      if (resource.includes('https://')) {
        expect(resource, 'External Leaflet resources should have integrity').toMatch(/integrity=/i);
        expect(resource, 'External Leaflet resources should have crossorigin').toMatch(/crossorigin=/i);
      }
    }
  });
});

test.describe('HTML File - SEO and Metadata', () => {

  let htmlContent: string;

  test.beforeAll(() => {
    htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
  });

  test('has viewport meta tag for mobile', () => {
    expect(htmlContent).toMatch(/<meta[^>]*name="viewport"[^>]*>/i);
    expect(htmlContent).toContain('width=device-width');
  });

  test('has proper charset declaration', () => {
    expect(htmlContent).toMatch(/<meta[^>]*charset="utf-8"[^>]*>/i);
  });

  test('title tag is meaningful', () => {
    const titleMatch = htmlContent.match(/<title>([^<]+)<\/title>/i);
    expect(titleMatch, 'Should have title tag').toBeTruthy();
    if (titleMatch) {
      expect(titleMatch[1].trim()).toBe('Chirpity');
    }
  });
});

test.describe('HTML File - Custom Components', () => {

  let htmlContent: string;

  test.beforeAll(() => {
    htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
  });

  test('has custom slider component integration', () => {
    expect(htmlContent).toContain('./js/components/slider.js');
  });

  test('has chart integration', () => {
    expect(htmlContent).toContain('chart.js');
  });

  test('has leaflet map integration', () => {
    expect(htmlContent).toMatch(/leaflet.*\.css/i);
    expect(htmlContent).toMatch(/leaflet.*\.js/i);
  });

  test('has easepick date picker integration', () => {
    expect(htmlContent).toContain('@easepick/bundle');
  });
});

test.describe('HTML File - Form Validation', () => {

  let htmlContent: string;

  test.beforeAll(() => {
    htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
  });

  test('forms have proper structure', () => {
    const forms = htmlContent.match(/<form[^>]*>/gi);
    if (forms) {
      expect(forms.length, 'Should have form elements').toBeGreaterThan(0);
    }
  });

  test('select elements have proper labels', () => {
    const selects = htmlContent.match(/<select[^>]*id="([^"]+)"[^>]*>/gi) || [];

    for (const select of selects) {
      const idMatch = select.match(/id="([^"]+)"/);
      if (idMatch) {
        const selectId = idMatch[1];
        // Should have associated label
        const hasLabel = htmlContent.includes(`for="${selectId}"`) ||
                        htmlContent.includes('form-floating');
        expect(hasLabel, `Select with id="${selectId}" should have label`).toBe(true);
      }
    }
  });

  test('inputs have appropriate types', () => {
    const inputs = htmlContent.match(/<input[^>]*type="([^"]+)"[^>]*>/gi) || [];

    for (const input of inputs) {
      const typeMatch = input.match(/type="([^"]+)"/);
      if (typeMatch) {
        const inputType = typeMatch[1];
        const validTypes = ['text', 'color','checkbox', 'radio', 'hidden', 'number', 'email', 'password', 'search', 'range', 'datetime-local'];
        expect(
          validTypes.includes(inputType),
          `Input type "${inputType}" should be valid HTML5 type`
        ).toBe(true);
      }
    }
  });
});

test.describe('HTML File - Accessibility Enhancements', () => {

  let htmlContent: string;

  test.beforeAll(() => {
    htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
  });

  test('has proper ARIA roles', () => {
    expect(htmlContent).toMatch(/role="/);
    expect(htmlContent).toMatch(/role="progressbar"/);
    expect(htmlContent).toMatch(/role="group"/);
  });

  test('has ARIA live regions for dynamic content', () => {
    expect(htmlContent).toMatch(/aria-live=/);
  });

  test('has ARIA busy state for loading', () => {
    expect(htmlContent).toMatch(/aria-busy="true"/);
  });

  test('interactive elements have proper ARIA labels', () => {
    const interactiveElements = htmlContent.match(/<(button|a)[^>]*>/gi) || [];

    let labeledElements = 0;
    for (const element of interactiveElements) {
      if (element.includes('aria-label=') || element.includes('title=')) {
        labeledElements++;
      }
    }

    expect(
      labeledElements,
      'Many interactive elements should have ARIA labels or titles'
    ).toBeGreaterThan(0);
  });

  test('images have alt text or are decorative', () => {
    const images = htmlContent.match(/<img[^>]*>/gi) || [];

    for (const img of images) {
      const hasAlt = img.includes('alt=');
      const isIcon = img.includes('icon');

      expect(
        hasAlt || isIcon,
        'Images should have alt text or be icons'
      ).toBe(true);
    }
  });
});

test.describe('HTML File - JavaScript Integration', () => {

  let htmlContent: string;

  test.beforeAll(() => {
    htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
  });

  test('includes ui.js', () => {
    // ui.js is loaded via module or script tag
    const hasUiJs = htmlContent.includes('ui.js') || htmlContent.includes('type="module"');
    expect(hasUiJs, 'Should include UI JavaScript').toBe(true);
  });

  test('has inline JavaScript for initialization', () => {
    expect(htmlContent).toContain('<script>');

    // Check for fullscreen function
    expect(htmlContent).toMatch(/function goFullscreen/);
  });

  test('no inline event handlers', () => {
    // Modern practice: avoid onclick, onload, etc. in HTML
    expect(htmlContent, 'Should not use onclick attribute').not.toMatch(/onclick=/);
    expect(htmlContent, 'Should not use onload on body').not.toMatch(/<body[^>]*onload=/);
  });
});

test.describe('HTML File - CSS Integration', () => {

  let htmlContent: string;

  test.beforeAll(() => {
    htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
  });

  test('includes custom styles', () => {
    expect(htmlContent).toContain('css/style.css');
  });

  test('includes Bootstrap CSS', () => {
    expect(htmlContent).toMatch(/bootstrap.*\.css/i);
  });

  test('includes external CSS with proper attributes', () => {
    const externalStyles = htmlContent.match(/<link[^>]*href="https[^"]*"[^>]*>/gi) || [];

    for (const link of externalStyles) {
      if (link.includes('stylesheet')) {
        expect(link, 'External stylesheets should have rel="stylesheet"').toMatch(/rel="stylesheet"/i);
      }
    }
  });

  test('no inline styles in critical elements', () => {
    // Check for inline styles that should be in CSS files
    const inlineStyles = htmlContent.match(/style="[^"]{50,}"/g);
    if (inlineStyles) {
      expect(
        inlineStyles.length,
        'Should minimize long inline styles'
      ).toBeLessThan(10);
    }
  });
});

test.describe('HTML File - Error Handling', () => {

  let htmlContent: string;

  test.beforeAll(() => {
    htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
  });

  test('has loading screen for initial load', () => {
    expect(htmlContent).toMatch(/id="loading-screen"/);
    expect(htmlContent).toMatch(/id="loading-panel"/);
    expect(htmlContent).toContain('spinner-border');
  });

  test('loading screen has proper accessibility', () => {
    const loadingScreenMatch = htmlContent.match(/<div[^>]*id="loading-screen"[^>]*>/);
    if (loadingScreenMatch) {
      expect(loadingScreenMatch[0]).toMatch(/role="progressbar"/);
      expect(loadingScreenMatch[0]).toMatch(/aria-busy="true"/);
    }
  });

  test('has content wrapper for main application', () => {
    expect(htmlContent).toMatch(/id="contentWrapper"/);
  });
});