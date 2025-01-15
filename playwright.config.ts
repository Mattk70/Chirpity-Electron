import { defineConfig } from '@playwright/test'


export default defineConfig({
  testDir: './test',
  maxFailures: 2,
  timeout: 80 * 1000,
  workers: 2,
  use: {
    // Maximum time each action such as `click()` can take. Defaults to 0 (no limit).
    actionTimeout: 0,

    // Name of the browser that runs tests. For example `chromium`, `firefox`, `webkit`.
    //browserName: 'chromium',

    // Toggles bypassing Content-Security-Policy.
    bypassCSP: true,

    // Channel to use, for example "chrome", "chrome-beta", "msedge", "msedge-beta".
    //channel: 'chrome',

    // Run browser in headless mode.
    headless: true,

    // Change the default data-testid attribute.
    //testIdAttribute: 'pw-test-id',
  },
  
});

