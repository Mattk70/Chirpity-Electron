import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  fullyParallel: true,
  // Each test launches Electron (+ ONNX models). A hosted macOS runner is small,
  // so don't oversubscribe it.
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 1 : 0,
  // App launch (up to ~30s cold) now counts toward the test, so be generous.
  timeout: 180_000,
  expect: { timeout: 15_000 },
  // Your run stopped after 2 failures and skipped 4 tests; 0 = run everything.
  maxFailures: 0,
  use: { trace: 'retain-on-failure' },
});
