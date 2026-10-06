import { test, expect, stubDialogs } from './fixtures';
import { changeSettings, importModel, runExampleAnalysis } from './helpers';
import { click } from './click';

// No describe.configure({mode:'parallel'}) needed: every test has its own app + profile,
// so tests are independent and safe to run in parallel (or not).

const secondResult = (page: import('playwright').Page) =>
  page.locator('#result2 span.confidence-row > span').first();

test('Page title is correct', async ({ page }) => {
  await expect(page).toHaveTitle('Chirpity');
});

test('BirdNET analyse works and second result is 34%', async ({ page }) => {
  await runExampleAnalysis(page, 'birdnet');
  await expect(page.locator('#speciesFilter').getByText('Redwing').first()).toBeVisible();
  await expect(secondResult(page)).toHaveText('34%');
});

test('BirdNET finds a Chaffinch @ 78% | 76%', async ({ page, electronApp }) => {
  const chaffinch = process.env.CHAFFINCH_MP3_PATH;
  test.skip(!chaffinch, 'CHAFFINCH_MP3_PATH not set');

  // Scoped to this test's own app, so it can't leak into other tests.
  await stubDialogs(electronApp, chaffinch!);
  await runExampleAnalysis(page, 'birdnet');

  await expect(page.locator('#speciesFilter').getByText('Common chaffinch').first()).toBeVisible();
  await expect(page.locator('#result1 span.confidence-row > span').first()).toHaveText(/^(78|76)%$/);
});

test('Nocmig analyse works and second result is 61%', async ({ page }) => {
  await runExampleAnalysis(page, 'chirpity');
  await expect(page.locator('#speciesFilter').getByText('Redwing (call)').first()).toBeVisible();
  await expect(secondResult(page)).toHaveText('61%');
});

test('BirdNET+ analyse works and second result is 92%', async ({ page }) => {
  await runExampleAnalysis(page, 'birdnet3');
  await expect(page.locator('#speciesFilter').getByText('Redwing').first()).toBeVisible();
  await expect(secondResult(page)).toHaveText('92%');
});

test('Perch works and second result is 35%', async ({ page }) => {
  const modelPath = process.env.PERCH_MODEL_PATH;
  test.skip(!modelPath, 'PERCH_MODEL_PATH not set');

  await importModel(page, modelPath!, 'Perch v2');
  await runExampleAnalysis(page, 'perch v2');

  await expect(page.locator('#speciesFilter').getByText('Redwing').first()).toBeVisible();
  await expect(secondResult(page)).toHaveText('35%');
});

test('Amend file start dialog contains date', async ({ page }) => {
  await runExampleAnalysis(page, 'chirpity');
  await click(page, '#dropdownMenuButton', { button: 'right' });
  await click(page, '#setFileStart');
  await expect(page.locator('#fileStart')).toHaveValue(
    new RegExp(String(new Date().getFullYear()))
  );
});

test('Select inverted greyscale colourmap', async ({ page }) => {
  await runExampleAnalysis(page, 'chirpity');
  await changeSettings(page, 'select', '#spectrogram-heading', '#colourmap', 'gray');
  await expect(page.locator('#colourmap')).toHaveValue('gray');
});

// The `test.describe.fixme('click fest…')` block from the original can be pasted back
// here unchanged; it only needs `{ page }` in the test signature.
