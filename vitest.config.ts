import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';

export default defineConfig({
  plugins: [cloudflareTest({
    main: './worker/index.ts',
    miniflare: {
      compatibilityDate: '2026-10-23', compatibilityFlags: ['nodejs_compat'],
      d1Databases: ['DB'], r2Buckets: ['FILES'],
      bindings: { APP_ENV: 'development', TEST_MIGRATIONS: await readD1Migrations('./migrations') },
    },
  })],
  test: { include: ['tests/**/*.test.ts'], fileParallelism: false },
});
