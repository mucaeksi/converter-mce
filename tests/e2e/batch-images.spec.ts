import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';

async function largeImage(page: Page) {
  const data = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 4000; canvas.height = 2000;
    const context = canvas.getContext('2d')!; context.fillStyle = '#2266cc'; context.fillRect(0, 0, 4000, 2000);
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), 'image/png'));
    return [...new Uint8Array(await blob.arrayBuffer())];
  });
  return { name: 'large.png', mimeType: 'image/png', buffer: Buffer.from(data) };
}

test('batch ZIP preserves real resized pixels, unique names and mobile layout without uploads', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const uploads: string[] = []; let workers = 0;
  page.on('request', request => { if (request.method() === 'POST') uploads.push(request.url()); });
  page.on('worker', () => workers++);
  await page.goto('/');
  await page.getByLabel('Görüntü dosyası seç').setInputFiles([
    { name: 'same.bmp', mimeType: 'image/bmp', buffer: await readFile('tests/fixtures/blue.bmp') },
    { name: 'same.png', mimeType: 'image/png', buffer: await readFile('tests/fixtures/transparent.png') },
    { name: 'same.gif', mimeType: 'image/gif', buffer: await readFile('tests/fixtures/blue.gif') },
  ]);
  await expect(page.getByLabel('Seçilen görüntüler').getByRole('listitem')).toHaveCount(3);
  await page.getByRole('button', { name: 'PNG', exact: true }).click();
  await page.getByLabel('En fazla genişlik').fill('40');
  await page.getByRole('button', { name: 'Dönüştür', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Yeni dosyan hazır.' })).toBeVisible();
  const waiting = page.waitForEvent('download'); await page.getByRole('link', { name: 'ZIP dosyasını indir' }).click();
  const download = await waiting; expect(download.suggestedFilename()).toBe('converter-images.zip');
  const zipBytes = await readFile((await download.path())!);
  // The archive uses stored entries, avoiding recompression of encoded images.
  expect(zipBytes.readUInt16LE(8)).toBe(0);
  const entries = unzipSync(zipBytes);
  expect(Object.keys(entries)).toEqual(['01-same.png', '02-same.png', '03-same.png']);
  const images = await page.evaluate(async buffers => Promise.all(buffers.map(async bytes => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d')!; context.drawImage(bitmap, 0, 0);
    const result = { width: bitmap.width, height: bitmap.height, rgba: [...context.getImageData(1, 1, 1, 1).data] };
    bitmap.close(); return result;
  })), Object.values(entries).map(bytes => [...bytes]));
  expect(images.map(image => [image.width, image.height])).toEqual([[40, 20], [40, 20], [40, 20]]);
  expect(images[0].rgba[2]).toBeGreaterThan(170); expect(images[1].rgba[3]).toBe(0); expect(images[2].rgba[2]).toBeGreaterThan(170);
  expect(workers).toBe(1); expect(uploads).toHaveLength(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel('2. görüntüyü kaldır', { exact: true }).click();
  await expect(page.getByRole('link', { name: 'ZIP dosyasını indir' })).toHaveCount(0);
  await expect(page.getByLabel('Seçilen görüntüler').getByRole('listitem')).toHaveCount(2);
  await page.getByLabel('2. görüntüyü kaldır', { exact: true }).click();
  await page.getByRole('button', { name: 'Dönüştür', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Dosyayı indir' })).toHaveAttribute('download', 'same.png');
});

test('invalid or excessive batch selection clears stale results and never offers a partial archive', async ({ page }) => {
  await page.goto('/');
  const png = { name: 'valid.png', mimeType: 'image/png', buffer: await readFile('tests/fixtures/transparent.png') };
  await page.getByLabel('Görüntü dosyası seç').setInputFiles([png, png]);
  await page.getByRole('button', { name: 'Dönüştür', exact: true }).click();
  await expect(page.getByRole('link', { name: 'ZIP dosyasını indir' })).toBeVisible();
  await page.getByLabel('Görüntü dosyası seç').setInputFiles([png, { name: 'animated.gif', mimeType: 'image/gif', buffer: await readFile('tests/fixtures/animated.gif') }]);
  await expect(page.getByRole('alert')).toContainText('Animasyonlu');
  await expect(page.getByRole('button', { name: 'Dönüştür', exact: true })).toBeDisabled();
  await page.getByLabel('Görüntü dosyası seç').setInputFiles([png, { ...png, name: 'broken.png', buffer: png.buffer.subarray(0, 40) }]);
  await page.getByRole('button', { name: 'Dönüştür', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('broken.png');
  await expect(page.getByRole('link', { name: 'ZIP dosyasını indir' })).toHaveCount(0);
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'ZIP dosyasını indir' })).toHaveCount(0);
  await page.getByLabel('Görüntü dosyası seç').setInputFiles(Array(21).fill(png));
  await expect(page.getByRole('alert')).toContainText('1–20');
  await expect(page.getByRole('button', { name: 'Dönüştür', exact: true })).toBeDisabled();
});

test('cancellation closes the real worker and allows a clean subsequent conversion', async ({ page }) => {
  await page.goto('/'); const png = await largeImage(page);
  await page.getByLabel('Görüntü dosyası seç').setInputFiles(Array(20).fill(png));
  await page.getByRole('button', { name: 'BMP', exact: true }).click();
  const starting = page.waitForEvent('worker'); await page.getByRole('button', { name: 'Dönüştür', exact: true }).click();
  const worker = await starting; const closing = worker.waitForEvent('close');
  await expect(page.getByRole('progressbar', { name: 'Toplu dönüşüm ilerlemesi' })).toHaveAttribute('max', '20');
  await page.getByRole('button', { name: 'Beklemeyi durdur' }).click(); await closing;
  await expect(page.getByRole('status')).toContainText('İşlem durduruldu');
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'ZIP dosyasını indir' })).toHaveCount(0);
  await page.getByLabel('Görüntü dosyası seç').setInputFiles('tests/fixtures/transparent.png');
  await page.getByRole('button', { name: 'PNG', exact: true }).click();
  await page.getByRole('button', { name: 'Dönüştür', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Dosyayı indir' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('aggregate ZIP output limit rejects real large BMP output and allows a smaller retry', async ({ page }) => {
  await page.goto('/'); const png = await largeImage(page);
  await page.getByLabel('Görüntü dosyası seç').setInputFiles([png, png, png]);
  await page.getByRole('button', { name: 'BMP', exact: true }).click();
  await page.getByRole('button', { name: 'Dönüştür', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('ZIP çıktısı 50 MB');
  await expect(page.getByRole('status')).toContainText('İşlem tamamlanamadı');
  await expect(page.getByRole('link', { name: 'ZIP dosyasını indir' })).toHaveCount(0);
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await page.getByLabel('En fazla genişlik').fill('40');
  await page.getByRole('button', { name: 'Dönüştür', exact: true }).click();
  await expect(page.getByRole('link', { name: 'ZIP dosyasını indir' })).toBeVisible();
});
