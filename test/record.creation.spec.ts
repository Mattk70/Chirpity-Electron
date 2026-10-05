import { test, expect } from './fixtures';
import { runExampleAnalysis } from './helpers';

test('Can create/edit a manual record', async ({ page }) => {
  test.slow();
  await runExampleAnalysis(page, 'chirpity');

  // (original right-clicked twice; kept in case the first click only selects the row)
  await page.locator('#result1').click({ button: 'right' });
  await page.locator('#result1').click({ button: 'right' });
  await page.locator('#create-manual-record').click();

  const selectedBird = page.locator('div#selected-bird');
  await expect(selectedBird).toHaveText(/^Redwing \(call\)/);

  await page.locator('#bird-autocomplete').fill('ring o');
  await page.locator('#bird-suggestions li.list-group-item').first().click();
  await expect(selectedBird).toHaveText(/^Ring Ouzel/);

  await page.locator('#call-count').fill('3');
  await page.locator('#record-comment').fill('a test comment');
  await page.locator('#record-add').click();

  // All of these were un-awaited / non-asserting before.
  await expect(page.locator('#result1 td.cname')).toHaveText(/person_add/);
  await expect(page.locator('#result1 td.comment span')).toHaveAttribute('title', 'a test comment');
  await expect(page.locator('#call-count')).toHaveValue('3');

  await page.keyboard.press('ControlOrMeta+s');
  // File name turns blue once saved
  await expect(page.locator('#filename span.filename')).toHaveClass(/text-info/, {
    timeout: 10_000,
  });
});
