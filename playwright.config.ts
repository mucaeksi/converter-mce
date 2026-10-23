import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', workers: 1, timeout: 180_000,
  use: { baseURL: 'http://127.0.0.1:8787', launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] } },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:8787/api/health', reuseExistingServer: !process.env.CI, timeout: 180_000 },
});
