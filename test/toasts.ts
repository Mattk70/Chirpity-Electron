import { Page } from 'playwright';

/**
 * Records the text of every toast the instant it is added to the DOM, so tests
 * don't depend on selectors, animation state or the 5s autohide window.
 * Must run after the UI has loaded (the fixture does this).
 */
export async function installToastRecorder(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    if (w.__toastObserver) return;
    w.__toasts = [] as string[];

    const record = (el: Element) => {
      const bodies = el.matches('.toast-body')
        ? [el]
        : Array.from(el.querySelectorAll('.toast-body'));
      for (const b of bodies) {
        const text = (b.textContent || '').trim();
        w.__toasts.push(text);
        console.log('[toast]', text);
      }
    };

    // generateToast() builds the wrapper (header + body) and THEN appends it,
    // so the added node is the wrapper and the body is found inside it.
    w.__toastObserver = new MutationObserver((muts) =>
      muts.forEach((m) => m.addedNodes.forEach((n) => n instanceof Element && record(n)))
    );
    w.__toastObserver.observe(document.documentElement, { childList: true, subtree: true });
  });
}

/** Number of toasts seen so far. Take this before the action that triggers the toast. */
export const toastMark = (page: Page) =>
  page.evaluate(() => ((window as any).__toasts as string[] | undefined)?.length ?? 0);

/** Wait for a toast whose body matches `pattern`, ignoring toasts before `since`. */
export async function waitForToast(
  page: Page,
  pattern: RegExp,
  since = 0,
  timeout = 90_000
) {
  try {
    await page.waitForFunction(
      ({ source, flags, since }) => {
        const re = new RegExp(source, flags);
        const toasts = ((window as any).__toasts as string[] | undefined) ?? [];
        return toasts.slice(since).some((t) => re.test(t));
      },
      { source: pattern.source, flags: pattern.flags, since },
      { timeout, polling: 100 }
    );
  } catch (e) {
    const seen = await page
      .evaluate((since) => ((window as any).__toasts as string[] | undefined)?.slice(since) ?? [], since)
      .catch(() => ['<page closed>']);
    throw new Error(`No toast matching ${pattern} within ${timeout}ms. Toasts seen: ${JSON.stringify(seen)}`);
  }
}