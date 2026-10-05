import { test as base, expect } from '@playwright/test';
import { _electron as electron, ElectronApplication, Page } from 'playwright';
import {
  findLatestBuild,
  parseElectronApp,
  ipcMainInvokeHandler,
  stubMultipleDialogs,
} from 'electron-playwright-helpers';
import { installToastRecorder } from './toasts';
import fs from 'fs';
import os from 'os';
import path from 'path';

const appInfo = parseElectronApp(findLatestBuild('./dist'));

type Fixtures = {
  electronApp: ElectronApplication;
  page: Page;
};

/** (Re)point the native open/save dialogs. Call again in a test to override the file. */
export async function stubDialogs(app: ElectronApplication, openFile: string) {
  await stubMultipleDialogs(app, [
    { method: 'showOpenDialog', value: { filePaths: [openFile], canceled: false } },
    { method: 'showSaveDialog', value: { filePath: '/path/to/file', canceled: false } },
  ]);
}

export const test = base.extend<Fixtures>({
  // One app per test, each with its own empty profile (config, archive DBs, models).
  electronApp: async ({}, use) => {
    const userDataDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'chirpity-e2e-'))
    );
    const app = await electron.launch({
      args: [appInfo.main, `--user-data-dir=${userDataDir}`],
      executablePath: appInfo.executable,
      env: { ...process.env, CI: 'e2e', TEST_ENV: 'true' } as Record<string, string>,
      timeout: 90_000,
    });

    // Guard: if the app ignores the switch we're back to a shared profile.
    const actual = await app.evaluate(({ app }) => app.getPath('userData'));
    expect(actual, 'app must use the isolated userData dir').toBe(userDataDir);

    try {
      await use(app);
    } finally {
      await app.close().catch(() => {});
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  },

  // The visible UI window, fully loaded (loading screen gone).
  page: async ({ electronApp }, use) => {
    const exampleFile = await ipcMainInvokeHandler(electronApp, 'getAudio');
    await stubDialogs(electronApp, exampleFile);

    // The first window is the hidden worker; we want index.html.
    const isUi = (w: Page) => w.url().endsWith('index.html');
    await expect
      .poll(() => electronApp.windows().some(isUi), { timeout: 90_000 })
      .toBe(true);
    const page = electronApp.windows().find(isUi)!;

    page.on('pageerror', (e) => console.error(e));
    page.on('console', (m) => console.log(m.text()));

    await page.waitForLoadState('load');
    // This is what the old beforeAll did NOT wait for.
    await page.locator('#loading-screen').waitFor({ state: 'hidden', timeout: 90_000 });

    await installToastRecorder(page);

    await use(page);
  },
});

export { expect };