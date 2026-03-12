const { defineConfig, devices } = require('@playwright/test');

const port = process.env.PW_WEB_PORT || '4100';
const baseURL = process.env.PW_BASE_URL || `http://127.0.0.1:${port}`;
const skipWebServer = process.env.PW_SKIP_WEBSERVER === '1';
const browserChannel = process.env.PW_BROWSER_CHANNEL || undefined;
const forceReuseServer = process.env.PW_FORCE_REUSE_SERVER === '1';

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL,
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: skipWebServer
    ? undefined
    : {
        command: `CI=1 npm run dev:web -- --port ${port}`,
        url: baseURL,
        cwd: __dirname,
        timeout: 180_000,
        reuseExistingServer: forceReuseServer || !process.env.CI,
      },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(browserChannel ? { channel: browserChannel } : {}),
      },
    },
  ],
});
