import { Page } from 'playwright';
import { expect } from '@playwright/test';
import { click } from './click';

/** Open a Bootstrap dropdown and wait until it is actually open. */
async function openDropdown(page: Page, toggleSelector: string) {
  const toggle = page.locator(toggleSelector);
  await click(page, toggle);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

async function openExampleFile(page: Page) {
  await openDropdown(page, '#navBarFile');
  await click(page, '#open-file');
  await page.locator('#spectrogramWrapper').waitFor({ state: 'visible' });
}

async function openSettings(page: Page) {
  await click(page, '#navbarSettings');
  await expect(page.locator('#settingsAccordion')).toBeVisible();
  // The heading TOGGLES the section, so only click if it isn't already open.
  if (!(await page.locator('#confidence').isVisible())) {
    await click(page, '#detections-heading');
  }
  await expect(page.locator('#confidence')).toBeVisible();
}

async function closeSettings(page: Page) {
  await click(page, '#close-settings');
  await expect(page.locator('#settingsAccordion')).toBeHidden();
}

async function changeSettings(
  page: Page,
  type: 'select' | 'switch' | 'input',
  elementID: string,
  value: any
) {
  const el = page.locator('#' + elementID);
  await openSettings(page);
  // for BirdNET's 34%
  await page.locator('#confidence').fill('30');

  if (type === 'select') await el.selectOption(value); // auto-waits for the option to exist
  else if (type === 'switch') await el.setChecked(value);
  else await el.fill(value);

  await closeSettings(page);
}

/** Import a model through the Training menu and wait until it is really usable. */
async function importModel(page: Page, modelPath: string, name: string) {
  await click(page, '#navbarTraining');
  await click(page, '#import-model');
  await expect(page.locator('#import-modal')).toBeVisible();
  await page.locator('#import-location').fill(modelPath, { force: true });
  await page.locator('#model-name').fill(name, { force: true });
  await click(page, '#import');

  // Replaces waitForTimeout(3000): the modal must close AND the option must appear.
  await expect(page.locator('#import-modal')).toBeHidden({ timeout: 60_000 });
  await expect(
    page.locator('#model-to-use option', { hasText: new RegExp(name, 'i') })
  ).toBeAttached({ timeout: 60_000 });
}

async function runExampleAnalysis(page: Page, model: string) {
  await openExampleFile(page);
  await changeSettings(page, 'select', 'model-to-use', model);
 
  // Only the completion toast counts, not "file loaded" / "model loaded" etc.
  const analysisComplete = page.locator('div.show > div.toast-body', {
    hasText: /analysis complete/i,
  });
 
  await click(page, '#navbarAnalysis');
  // Start waiting in the same breath as the click so a fast toast can't be missed.
  await Promise.all([
    analysisComplete.first().waitFor({ state: 'visible', timeout: 90_000 }),
    click(page, '#analyse'),
  ]);
 
  await expect(page.locator('#resultTableContainer')).toBeVisible();
  await expect(page.locator('#result1')).toBeVisible();
}

export { changeSettings, openExampleFile, runExampleAnalysis, importModel };
