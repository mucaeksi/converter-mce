import { chromium, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const external = process.env.CONVERTER_TEST_URL;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'],
  ...(external && process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {}),
});
try {
  const context = await browser.newContext(), files = [], pending = [];
  context.on('response', response => {
    if (new URL(response.url()).pathname.endsWith('.js')) pending.push(response.body().then(bytes => files.push({ name: new URL(response.url()).pathname, bytes: bytes.length, gzip: gzipSync(bytes).length })));
  });
  const page = await context.newPage();
  await page.goto(external || 'http://127.0.0.1:8790');
  await page.getByRole('button', { name: 'Excel / Veri', exact: true }).click();
  await page.getByLabel('Tablo dosyası seç').setInputFiles({ name: 'sample.csv', mimeType: 'text/csv', buffer: Buffer.from('Ad,Kod\n' + Array.from({ length: 1000 }, (_, i) => `Çağrı${i},00${i}`).join('\n')) });
  await page.getByLabel('Tablo çıktı biçimi').selectOption('json');
  const started = performance.now();
  await page.getByRole('button', { name: 'Dönüştür', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Yeni dosyan hazır.' })).toBeVisible();
  await expect(page.getByText(/1000 veri satırı/)).toBeVisible();
  const csvMilliseconds = Math.round(performance.now() - started);
  await Promise.all(pending);
  const result = { files, totalBytes: files.reduce((sum, file) => sum + file.bytes, 0), gzip: files.reduce((sum, file) => sum + file.gzip, 0), csvMilliseconds };
  if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
