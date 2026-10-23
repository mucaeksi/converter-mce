import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

for (const mode of ['device', 'cloud'] as const) {
  test(`${mode}: produces a real resized JPEG with white transparency`, async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Görüntü dosyası seç').setInputFiles('tests/fixtures/transparent.png');
    await page.getByLabel('En fazla genişlik').fill('40');
    await page.getByLabel('İşleme yöntemi').selectOption(mode);
    await page.getByRole('button', { name: 'Dönüştür', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Yeni dosyan hazır.' })).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText(/40 × 20 px/)).toBeVisible();
    const pixel = await page.getByAltText('Dönüştürülmüş görüntünün önizlemesi').evaluate(async (image) => {
      const element = image as HTMLImageElement; await element.decode();
      const canvas = document.createElement('canvas'); canvas.width = element.naturalWidth; canvas.height = element.naturalHeight;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(element, 0, 0);
      return [...ctx.getImageData(1, 1, 1, 1).data];
    });
    expect(pixel.slice(0, 3).every((channel) => channel >= 250)).toBe(true);
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Dosyayı indir' }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe('transparent.jpg');
    const bytes = await readFile((await download.path())!);
    expect([...bytes.subarray(0, 2)]).toEqual([255, 216]);
    if (mode === 'cloud') {
      await page.getByRole('button', { name: 'Sunucu kopyalarını şimdi sil' }).click();
      await expect(page.getByRole('status')).toContainText('Sunucu kopyaları silindi');
    }
  });
}

test('device mode never uploads image bytes and works on mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const uploads: string[] = [];
  page.on('request', (request) => { if (request.method() === 'POST') uploads.push(request.url()); });
  await page.goto('/');
  await page.getByLabel('Görüntü dosyası seç').setInputFiles(path.resolve('tests/fixtures/transparent.png'));
  await page.getByRole('button', { name: 'Dönüştür', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Yeni dosyan hazır.' })).toBeVisible();
  expect(uploads).toHaveLength(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
