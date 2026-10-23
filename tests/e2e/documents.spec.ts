import { test, expect } from '@playwright/test';
import { PDFDocument, PDFArray, PDFRawStream } from 'pdf-lib';
import ExcelJS from 'exceljs';
import { zipSync, strToU8 } from 'fflate';
import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';

async function pdf(widths: number[]) {
  const doc = await PDFDocument.create();
  widths.forEach((width, i) => doc.addPage([width, 400]).drawText(`Page ${width}-${i}`, { size: 10, x: 10, y: 20 }));
  return Buffer.from(await doc.save());
}
function contents(doc: PDFDocument, index: number) {
  const raw = doc.getPage(index).node.Contents();
  const streams = raw instanceof PDFArray ? raw.asArray().map(ref => doc.context.lookup(ref)) : [raw];
  return streams.map(stream => Buffer.from((stream as PDFRawStream).getContents()).toString('base64'));
}
async function download(page: Page) {
  await expect(page.getByRole('heading', { name: 'Yeni dosyan hazır.' })).toBeVisible();
  const wait = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Dosyayı indir' }).click();
  const file = await wait;
  return { bytes: await readFile((await file.path())!), name: file.suggestedFilename() };
}
test('PDF merges content in chosen order, extracts and rotates pages without uploads', async ({ page }) => {
  const uploads: string[] = []; page.on('request', r => { if (r.method() === 'POST') uploads.push(r.url()); });
  const first = await pdf([200, 250]), second = await pdf([300]);
  await page.goto('/'); await page.getByRole('button', { name: 'PDF', exact: true }).click();
  await page.getByLabel('PDF dosyaları seç').setInputFiles([{ name: 'first.pdf', mimeType: 'application/pdf', buffer: first }, { name: 'second.pdf', mimeType: 'application/pdf', buffer: second }]);
  await page.getByRole('button', { name: 'second.pdf yukarı taşı' }).click();
  await page.getByRole('button', { name: 'Dönüştür', exact: true }).click();
  const merged = await download(page); const doc = await PDFDocument.load(merged.bytes);
  expect(doc.getPages().map(p => p.getWidth())).toEqual([300, 200, 250]);
  expect(contents(doc, 0)).toEqual(contents(await PDFDocument.load(second), 0));
  expect(contents(doc, 2)).toEqual(contents(await PDFDocument.load(first), 1));
  await page.getByLabel('PDF işlemi').selectOption('extract');
  await page.getByLabel('PDF dosyaları seç').setInputFiles({ name: 'merged.pdf', mimeType: 'application/pdf', buffer: merged.bytes });
  await page.getByLabel('Sayfa seçimi').fill('3,1'); await page.getByLabel('Saat yönünde döndür').selectOption('90');
  await page.getByRole('button', { name: 'Dönüştür', exact: true }).click();
  const extracted = await PDFDocument.load((await download(page)).bytes);
  expect(extracted.getPages().map(p => [p.getWidth(), p.getRotation().angle])).toEqual([[250, 90], [300, 90]]);
  expect(contents(extracted, 0)).toEqual(contents(doc, 2));
  await page.getByLabel('Sayfa seçimi').fill('1-999'); await page.getByRole('button', { name: 'Dönüştür', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('1–3'); expect(uploads).toHaveLength(0);
});

test('PDF forms are rejected rather than losing field values', async ({ page }) => {
  const doc = await PDFDocument.create(); const p = doc.addPage();
  const field = doc.getForm().createTextField('name'); field.setText('Ada'); field.addToPage(p);
  await page.goto('/'); await page.getByRole('button', { name: 'PDF', exact: true }).click();
  await page.getByLabel('PDF dosyaları seç').setInputFiles({ name: 'form.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await doc.save()) });
  await page.getByRole('button', { name: 'Dönüştür', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Etkileşimli form');
  await expect(page.getByRole('link', { name: 'Dosyayı indir' })).toHaveCount(0);
});

test('CSV to XLSX preserves Turkish, quoted newlines and leading zeros; XLSX sheet to JSON preserves values', async ({ page }) => {
  const uploads: string[] = []; page.on('request', r => { if (r.method() === 'POST') uploads.push(r.url()); });
  await page.goto('/'); await page.getByRole('button', { name: 'Excel / Veri', exact: true }).click();
  await page.getByLabel('Tablo dosyası seç').setInputFiles({ name: 'veri.csv', mimeType: 'text/csv', buffer: Buffer.from('Ad,Kod,Not\r\nÇağrı,00123,"iki\nsatır"\r\nAda,00456,"=SUM(1,2)"') });
  await page.getByRole('button', { name: 'Dönüştür', exact: true }).click();
  const result = await download(page); expect(result.name).toBe('veri.xlsx');
  const book = new ExcelJS.Workbook(); await book.xlsx.load(result.bytes as unknown as ExcelJS.Buffer);
  expect(book.worksheets[0].getCell('A2').value).toBe('Çağrı');
  expect(book.worksheets[0].getCell('B2').value).toBe('00123');
  expect(book.worksheets[0].getCell('C2').value).toBe('iki\nsatır');
  expect(book.worksheets[0].getCell('C3').value).toBe('=SUM(1,2)');
  book.addWorksheet('İkinci').addRows([['Ad', 'Sayı', 'Aktif'], ['Öykü', 42, true]]);
  await page.getByLabel('Tablo dosyası seç').setInputFiles({ name: 'sayfalar.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(await book.xlsx.writeBuffer()) });
  await expect(page.getByLabel('Excel çalışma sayfası')).toBeVisible();
  await page.getByLabel('Excel çalışma sayfası').selectOption('İkinci');
  await page.getByLabel('Tablo çıktı biçimi').selectOption('json');
  await page.getByRole('button', { name: 'Dönüştür', exact: true }).click();
  expect(JSON.parse((await download(page)).bytes.toString('utf8'))).toEqual([{ Ad: 'Öykü', Sayı: 42, Aktif: true }]);
  expect(uploads).toHaveLength(0);
});

test('table rejects duplicate headers, nested JSON, formulas and oversized decompression; CSV output escapes formulas', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Excel / Veri', exact: true }).click();
  const choose = async (name: string, buffer: Buffer) => page.getByLabel('Tablo dosyası seç').setInputFiles({ name, mimeType: 'application/octet-stream', buffer });
  await choose('duplicate.csv', Buffer.from('Ad,Ad\na,b')); await page.getByRole('button', { name: 'Dönüştür', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('birbirinden farklı');
  await choose('nested.json', Buffer.from('[{"a":{"b":1}}]')); await page.getByRole('button', { name: 'Dönüştür', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('iç içe');
  const book = new ExcelJS.Workbook(); book.addWorksheet('Veri').addRows([['Ad'], [{ formula: '1+1', result: 2 }]]);
  await choose('formula.xlsx', Buffer.from(await book.xlsx.writeBuffer())); await expect(page.getByLabel('Excel çalışma sayfası')).toBeVisible();
  await page.getByRole('button', { name: 'Dönüştür', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('Formüllü');
  await choose('bomb.xlsx', Buffer.from(zipSync({ 'xl/workbook.xml': strToU8('<x/>'), 'large.xml': new Uint8Array(33 * 1024 * 1024) })));
  await expect(page.getByRole('alert')).toContainText('32 MB');
  await choose('safe.json', Buffer.from('[{"Ad":"=1+1","Kod":"00123"}]')); await page.getByLabel('Tablo çıktı biçimi').selectOption('csv');
  await page.getByRole('button', { name: 'Dönüştür', exact: true }).click();
  const text = (await download(page)).bytes.toString('utf8'); expect(text).toContain("'=1+1"); expect(text).toContain('00123');
});

test('free image and document tabs work on mobile and keep static security headers', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto('/'); expect(response?.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  await page.getByLabel('Görüntü dosyası seç').setInputFiles('tests/fixtures/transparent.png');
  await page.getByRole('button', { name: 'Dönüştür', exact: true }).click();
  expect((await download(page)).bytes.subarray(0, 2)).toEqual(Buffer.from([255, 216]));
  await page.getByRole('button', { name: 'PDF', exact: true }).click(); await expect(page.getByLabel('PDF dosyaları seç')).toBeVisible();
  await page.getByRole('button', { name: 'Excel / Veri', exact: true }).click(); await expect(page.getByLabel('Tablo dosyası seç')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
