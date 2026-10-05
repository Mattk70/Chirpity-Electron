import { Locator, Page } from 'playwright';

// The app ignores a click that arrives within 250ms of the previous one.
// Keep a margin over that.
const DEBOUNCE_MS = 300;
const lastClickAt = new WeakMap<Page, number>();

/**
 * Debounce-aware click. Waits for the target to be visible, then waits out
 * whatever remains of the debounce window since this page's last click.
 * Use this instead of locator.click() anywhere two clicks can follow each other.
 */
export async function click(
  page: Page,
  target: string | Locator,
  options?: Parameters<Locator['click']>[0]
) {
  const locator = typeof target === 'string' ? page.locator(target) : target;
  await locator.waitFor({ state: 'visible' });

  const remaining = DEBOUNCE_MS - (Date.now() - (lastClickAt.get(page) ?? 0));
  if (remaining > 0) await page.waitForTimeout(remaining);

  await locator.click(options);
  lastClickAt.set(page, Date.now());
}
