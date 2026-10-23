import { defineConfig } from '@playwright/test';

const external = process.env.CONVERTER_TEST_URL;
export default defineConfig({
  testDir: './tests/e2e', testMatch: ['documents.spec.ts', 'media.spec.ts', 'extensions.spec.ts'], workers: 1, timeout: 90_000,
  use: {
    baseURL: external || 'http://127.0.0.1:8790',
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'],
      ...(external && process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {}),
    },
  },
  webServer: external ? undefined : { command: 'npx --no-install wrangler dev --config wrangler.web.jsonc --ip 127.0.0.1 --port 8790', url: 'http://127.0.0.1:8790/api/health', reuseExistingServer: !process.env.CI, timeout: 60_000 },
});
