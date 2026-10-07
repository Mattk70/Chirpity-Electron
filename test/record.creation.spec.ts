import { test, expect } from './fixtures';
import { runExampleAnalysis } from './helpers';
import { click } from './click';

test('Can create/edit/save a manual record', async ({ page }) => {
  test.slow();
  console.log('Create/edit/save manual record test');
  await runExampleAnalysis(page, 'chirpity');

  // One right-click, then wait for the menu item. A second right-click would land
  // on the context menu itself (it opens under the pointer) and be "intercepted".
  await click(page, '#result1', { button: 'right' });
  await expect(page.locator('#create-manual-record')).toBeVisible();
  await click(page, '#create-manual-record');

  const selectedBird = page.locator('div#selected-bird');
  await expect(selectedBird).toHaveText(/^Redwing \(call\)/);

  await page.locator('#bird-autocomplete').fill('ring o');
  await click(page, page.locator('#bird-suggestions li.list-group-item').first());
  await expect(selectedBird).toHaveText(/^Ring Ouzel/);

  await page.locator('#call-count').fill('3');
  await page.locator('#record-comment').fill('a test comment');
  await click(page, '#record-add');

  await expect(page.locator('#result1 td.cname')).toHaveText(/person_add/);
  await expect(page.locator('#result1 td.comment span')).toHaveAttribute('title', 'a test comment');
  await expect(page.locator('#call-count')).toHaveValue('3');

  // Don't send the shortcut while the add-record dialog is still closing.
  await expect(page.locator('.modal.show')).toHaveCount(0);
  await click(page, '#navbarRecords');
  await click(page, '#save2db');
    // File name turns blue once saved
  await expect(page.locator('#filename span.filename')).toHaveClass(/text-info/, {
    timeout: 10_000,
  });
});