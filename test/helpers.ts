import { Page } from 'playwright';
import { expect } from '@playwright/test';

/** Open a Bootstrap dropdown and wait until it is actually open. */
async function openDropdown(page: Page, toggleSelector: string) {
  const toggle = page.locator(toggleSelector);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

async function openExampleFile(page: Page) {
  await openDropdown(page, '#navBarFile');
  await page.locator('#open-file').click();
  await page.locator('#spectrogramWrapper').waitFor({ state: 'visible' });
}

async function openSettings(page: Page) {
  await page.locator('#navbarSettings').click();
  await expect(page.locator('#settingsAccordion')).toBeVisible();
  // The heading TOGGLES the section, so only click if it isn't already open.
  if (!(await page.locator('#confidence').isVisible())) {
    await page.locator('#detections-heading').click();
  }
  await expect(page.locator('#confidence')).toBeVisible();
}

async function closeSettings(page: Page) {
  await page.locator('#close-settings').click();
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
  await page.locator('#navbarTraining').click();
  await page.locator('#import-model').click();
  await expect(page.locator('#import-modal')).toBeVisible();
  await page.locator('#import-location').fill(modelPath, { force: true });
  await page.locator('#model-name').fill(name, { force: true });
  await page.locator('#import').click();

  // Replaces waitForTimeout(3000): the modal must close AND the option must appear.
  await expect(page.locator('#import-modal')).toBeHidden({ timeout: 60_000 });
  await expect(
    page.locator('#model-to-use option', { hasText: new RegExp(name, 'i') })
  ).toBeAttached({ timeout: 60_000 });
}

async function runExampleAnalysis(page: Page, model: string) {
  await openExampleFile(page);
  await changeSettings(page, 'select', 'model-to-use', model);

  await page.locator('#navbarAnalysis').click();
  await page.locator('#analyse').click();

  // TODO: tighten this to the specific "analysis complete" toast (or a progress
  // bar going hidden). `div.show > div.toast-header` matches ANY toast, so it can
  // fire before results have settled.
  await page
    .locator('div.show > div.toast-header')
    .first()
    .waitFor({ state: 'visible', timeout: 90_000 });
  await expect(page.locator('#resultTableContainer')).toBeVisible();
  await expect(page.locator('#result1')).toBeVisible();
}

export { changeSettings, openExampleFile, runExampleAnalysis, importModel };
