import { test, expect, stubDialogs } from './fixtures';
import { changeSettings, importModel, runExampleAnalysis, openExampleFile } from './helpers';
import { click } from './click';

// No describe.configure({mode:'parallel'}) needed: every test has its own app + profile,
// so tests are independent and safe to run in parallel (or not).

const secondResult = (page: import('playwright').Page) =>
  page.locator('#result2 span.confidence-row > span').first();

test('Page title is correct', async ({ page }) => {
  console.log('Page title test');
  await expect(page).toHaveTitle('Chirpity');
});

test('BirdNET analyse works and second result is 34%', async ({ page }) => {
  console.log('BirdNET analyse test');
  await runExampleAnalysis(page, 'birdnet');
  await expect(page.locator('#speciesFilter').getByText('Redwing').first()).toBeVisible();
  await expect(secondResult(page)).toHaveText('34%');
});

test('BirdNET finds a Chaffinch @ 78% | 76%', async ({ page, electronApp }) => {
  console.log('BirdNET Chaffinch test');
  const chaffinch = process.env.CHAFFINCH_MP3_PATH;
  test.skip(!chaffinch, 'CHAFFINCH_MP3_PATH not set');

  // Scoped to this test's own app, so it can't leak into other tests.
  await stubDialogs(electronApp, chaffinch!);
  await runExampleAnalysis(page, 'birdnet');

  await expect(page.locator('#speciesFilter').getByText('Common chaffinch').first()).toBeVisible();
  await expect(page.locator('#result1 span.confidence-row > span').first()).toHaveText(/^(78|76)%$/);
});

test('Nocmig analyse works and second result is 61%', async ({ page }) => {
  console.log('Nocmig analyse test');
  await runExampleAnalysis(page, 'chirpity');
  await expect(page.locator('#speciesFilter').getByText('Redwing (call)').first()).toBeVisible();
  await expect(secondResult(page)).toHaveText('61%');
});

test('BirdNET+ analyse works and second result is 92%', async ({ page }) => {
  console.log('BirdNET+ analyse test');
  await runExampleAnalysis(page, 'birdnet3');
  await expect(page.locator('#speciesFilter').getByText('Redwing').first()).toBeVisible();
  await expect(secondResult(page)).toHaveText('92%');
});

test('Perch works and second result is 35%', async ({ page }) => {
  console.log('Perch analyse test');
  const modelPath = process.env.PERCH_MODEL_PATH;
  test.skip(!modelPath, 'PERCH_MODEL_PATH not set');

  await importModel(page, modelPath!, 'Perch v2');
  await runExampleAnalysis(page, 'perch v2');

  await expect(page.locator('#speciesFilter').getByText('Redwing').first()).toBeVisible();
  await expect(secondResult(page)).toHaveText('35%');
});

test('Amend file start dialog contains date', async ({ page }) => {
  console.log('Amend file start test');
  await runExampleAnalysis(page, 'chirpity');
  await click(page, '#dropdownMenuButton', { button: 'right' });
  await click(page, '#setFileStart');
  await expect(page.locator('#fileStart')).toHaveValue(
    new RegExp(`${new Date().getFullYear()}|2024`)
  );
});

test('Select inverted greyscale colourmap', async ({ page }) => {
  console.log('Select inverted greyscale colourmap test');
  await openExampleFile(page);
  await changeSettings(page, 'select', '#spectrogram-heading', '#colourmap', 'gray');
  await expect(page.locator('#colourmap')).toHaveValue('gray');
});

test('Export wav stereo audio with high pass filter', async ({ page, electronApp }) => {
  console.log('Export wav audio with high pass filter test');
  await stubDialogs(electronApp, './test/example.wav');
  await runExampleAnalysis(page, 'chirpity');
  await changeSettings(page, 'input', '#audio-heading', '#highPassFrequency', '325');
  await changeSettings(page, 'select', '#audio-heading', '#format', 'wav');
  await expect(page.locator('#highPassFrequency')).toHaveValue('325');
  await click(page, '#result1');
  await click(page, '#navBarFile');
const exportComplete = page.evaluate(() => {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            window.removeEventListener('audio-file-to-save', onComplete);
            reject(new Error('Audio export timed out'));
        }, 15000);

        function onComplete(event: any) {
            clearTimeout(timeout);
            resolve(event.detail);
        }

        window.addEventListener('audio-file-to-save', onComplete);
    });
});

  await expect(page.locator('#export-audio')).toBeEnabled();
  await click(page, '#export-audio');
  await exportComplete; //Give chance for an ffmpeg error

});

// The `test.describe.fixme('click fest…')` block from the original can be pasted back
// here unchanged; it only needs `{ page }` in the test signature.
