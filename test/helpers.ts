import { Page } from 'playwright';
import { expect } from '@playwright/test';
import { click } from './click';
import { toastMark, waitForToast } from './toasts';

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

async function openSettings(page: Page, headingID: string, settingID: string) {
  await click(page, '#navbarSettings');
  await expect(page.locator('#settingsAccordion')).toBeVisible();
  // The heading TOGGLES the section, so only click if it isn't already open.
  if (!(await page.locator(settingID).isVisible())) {
    await click(page, headingID);
  }
  await expect(page.locator(settingID)).toBeVisible();
}

async function closeSettings(page: Page) {
  await click(page, '#close-settings');
  await expect(page.locator('#settingsAccordion')).toBeHidden();
}

async function changeSettings(
  page: Page,
  type: 'select' | 'switch' | 'input',
  headingID: string,
  settingID: string,
  value: any
) {
  const el = page.locator(settingID);
  await openSettings(page, headingID, settingID);


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
  // for BirdNET's 34%
  await changeSettings(page, 'input', '#detections-heading', '#confidence', '30');
  await changeSettings(page, 'select', '#detections-heading', '#model-to-use', model);

  // Only toasts raised after this point count (matters if a test analyses twice).
  const mark = await toastMark(page);

  await click(page, '#navbarAnalysis');
  await click(page, '#analyse');
  await waitForToast(page, /analysis complete/i, mark);

  await expect(page.locator('#resultTableContainer')).toBeVisible();
  await expect(page.locator('#result1')).toBeVisible();
}

export { changeSettings, openExampleFile, runExampleAnalysis, importModel };