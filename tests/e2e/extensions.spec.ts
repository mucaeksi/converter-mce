import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream } from 'pdf-lib';
import ExcelJS from 'exceljs';

async function result(page: Page) {
  await expect(page.getByRole('heading', { name: 'Yeni dosyan hazır.' })).toBeVisible();
  const waiting = page.waitForEvent('download'); await page.getByRole('link', { name: 'Dosyayı indir' }).click();
  const file = await waiting;
  return { bytes: await readFile((await file.path())!), name: file.suggestedFilename() };
}
async function pixel(page: Page, x = 1, y = 1) {
  return page.getByAltText('Dönüştürülmüş görüntünün önizlemesi').evaluate(async (element, point) => {
    const image = element as HTMLImageElement; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
    return { width: image.naturalWidth, height: image.naturalHeight, rgba: [...ctx.getImageData(point.x, point.y, 1, 1).data] };
  }, { x, y });
}
for (const extension of ['webp', 'bmp', 'gif']) {
  test(`${extension} input decodes into a real resized PNG without upload`, async ({ page }) => {
    const posts: string[] = []; page.on('request', r => { if (r.method() === 'POST') posts.push(r.url()); });
    await page.goto('/'); await page.getByLabel('Görüntü dosyası seç').setInputFiles(`tests/fixtures/blue.${extension}`);
    await page.getByRole('button', { name: 'PNG', exact: true }).click(); await page.getByLabel('En fazla genişlik').fill('40');
    await page.getByRole('button', { name: 'Dönüştür', exact: true }).click();
    const output = await result(page); expect(output.name).toBe('blue.png'); expect([...output.bytes.subarray(0, 4)]).toEqual([137, 80, 78, 71]);
    const decoded = await pixel(page); expect([decoded.width, decoded.height]).toEqual([40, 20]);
    expect(decoded.rgba[0]).toBeLessThan(70); expect(decoded.rgba[2]).toBeGreaterThan(170); expect(posts).toHaveLength(0);
  });
}
test('BMP padding and ICO dimensions/transparency survive a real browser decode', async ({ page }) => {
  await page.goto('/'); await page.getByLabel('Görüntü dosyası seç').setInputFiles('tests/fixtures/transparent.png');
  await page.getByRole('button', { name: 'BMP', exact: true }).click(); await page.getByLabel('En fazla genişlik').fill('7');
  await page.getByRole('button', { name: 'Dönüştür', exact: true }).click();
  const bmp = await result(page); expect(bmp.name).toBe('transparent.bmp'); expect(bmp.bytes.toString('ascii', 0, 2)).toBe('BM');
  expect(bmp.bytes.length).toBe(54 + 24 * 4); const white = await pixel(page); expect(white.rgba).toEqual([255, 255, 255, 255]);
  const png = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 1024; const x = c.getContext('2d')!;
    x.fillStyle = '#2266cc'; x.fillRect(128, 256, 256, 512);
    const blob = await new Promise<Blob>(resolve => c.toBlob(b => resolve(b!), 'image/png')); return [...new Uint8Array(await blob.arrayBuffer())];
  });
  await page.getByLabel('Görüntü dosyası seç').setInputFiles({ name: 'portrait.png', mimeType: 'image/png', buffer: Buffer.from(png) });
  await page.getByLabel('En fazla genişlik').fill(''); await page.getByRole('button', { name: 'ICO', exact: true }).click();
  await page.getByRole('button', { name: 'Dönüştür', exact: true }).click(); const ico = await result(page);
  expect(ico.name).toBe('portrait.ico'); expect(ico.bytes.readUInt16LE(2)).toBe(1); expect(ico.bytes.readUInt16LE(4)).toBe(1);
  expect(ico.bytes[6]).toBe(128); expect(ico.bytes[7]).toBe(0); expect(ico.bytes.readUInt32LE(18)).toBe(22);
  expect(ico.bytes.readUInt32LE(14)).toBe(ico.bytes.length - 22);
  const transparent = await pixel(page); expect([transparent.width, transparent.height]).toEqual([128, 256]); expect(transparent.rgba[3]).toBe(0);
  expect((await pixel(page, 64, 128)).rgba[2]).toBeGreaterThan(170);
});
test('animated GIF and WebP are rejected before conversion', async ({ page }) => {
  await page.goto('/');
  for (const extension of ['gif', 'webp']) {
    await page.getByLabel('Görüntü dosyası seç').setInputFiles(`tests/fixtures/animated.${extension}`);
    await expect(page.getByRole('alert')).toContainText('Animasyonlu'); await expect(page.getByRole('button', { name: 'Dönüştür', exact: true })).toBeDisabled();
  }
});
test('images become ordered A4 PDF pages with actual embedded RGB pixels', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'PDF', exact: true }).click();
  await page.getByLabel('PDF işlemi').selectOption('images');
  await page.getByLabel('PDF için görseller seç').setInputFiles(['tests/fixtures/blue.webp', 'tests/fixtures/blue.bmp', 'tests/fixtures/blue.gif']);
  const expectedPixels = await page.getByLabel('PDF için görseller seç').evaluate(async input => Promise.all([...((input as HTMLInputElement).files ?? [])].map(async file => {
    const image = await createImageBitmap(file), canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0); const pixel = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3); image.close(); return pixel;
  })));
  await page.getByRole('button', { name: 'Dönüştür', exact: true }).click(); const doc = await PDFDocument.load((await result(page)).bytes);
  expect(doc.getPageCount()).toBe(3);
  for (const [index, p] of doc.getPages().entries()) {
    expect(p.getWidth()).toBeCloseTo(841.89); expect(p.getHeight()).toBeCloseTo(595.28);
    const images = p.node.Resources()!.lookup(PDFName.of('XObject'), PDFDict).values().map(ref => doc.context.lookup(ref) as PDFRawStream);
    expect(images).toHaveLength(1); expect(images[0].dict.lookup(PDFName.of('Width'), PDFNumber).asNumber()).toBe(80);
    const pixels = inflateSync(images[0].getContents()); expect(pixels.length).toBe(80 * 40 * 3); expect([...pixels.subarray(0, 3)]).toEqual(expectedPixels[index]);
  }
});
test('JSONL/NDJSON values roundtrip; HTML and Markdown escape active content', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Excel / Veri', exact: true }).click();
  const records = [{ Ad: 'Çağrı', Sayı: 42, Aktif: true }, { Ad: 'Öykü', Sayı: null, Aktif: false }];
  for (const extension of ['jsonl', 'ndjson']) {
    await page.getByLabel('Tablo dosyası seç').setInputFiles({ name: `rows.${extension}`, mimeType: 'application/x-ndjson', buffer: Buffer.from(records.map(r => JSON.stringify(r)).join('\n')) });
    await page.getByLabel('Tablo çıktı biçimi').selectOption(extension); await page.getByRole('button', { name: 'Dönüştür', exact: true }).click();
    const output = await result(page); expect(output.name).toBe(`rows.${extension}`); expect(output.bytes.toString('utf8').trim().split('\n').map(line => JSON.parse(line))).toEqual(records);
  }
  const rows = [{ Ad: '<script>alert(1)</script>', Not: '[x](javascript:alert(1)) | bir\niki' }];
  await page.getByLabel('Tablo dosyası seç').setInputFiles({ name: 'unsafe.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(rows)) });
  await page.getByLabel('Tablo çıktı biçimi').selectOption('html'); await page.getByRole('button', { name: 'Dönüştür', exact: true }).click(); const html = (await result(page)).bytes.toString('utf8');
  const parsed = await page.evaluate(text => { const d = new DOMParser().parseFromString(text, 'text/html'); return { scripts: d.scripts.length, cells: [...d.querySelectorAll('td')].map(c => c.textContent) }; }, html);
  expect(parsed.scripts).toBe(0); expect(parsed.cells).toEqual([rows[0].Ad, rows[0].Not]);
  await page.getByLabel('Tablo çıktı biçimi').selectOption('md'); await page.getByRole('button', { name: 'Dönüştür', exact: true }).click(); const md = (await result(page)).bytes.toString('utf8');
  expect(md).toContain('&lt;script'); expect(md).toContain('\\|'); expect(md).toContain('\\[x\\]'); expect(md).not.toContain('<script>');
  await page.getByLabel('Tablo dosyası seç').setInputFiles({ name: 'bad.jsonl', mimeType: 'text/plain', buffer: Buffer.from('{"a":1}\ninvalid') });
  await page.getByRole('button', { name: 'Dönüştür', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('2');
});
test('CSV skips the Excel engine; cached workbooks never confuse files with the same name', async ({ page }) => {
  const scripts: string[] = []; let workers = 0;
  page.context().on('response', r => { if (r.url().endsWith('.js')) scripts.push(r.url()); }); page.on('worker', () => workers++);
  await page.goto('/'); await page.getByRole('button', { name: 'Excel / Veri', exact: true }).click();
  await page.getByLabel('Tablo dosyası seç').setInputFiles({ name: 'simple.csv', mimeType: 'text/csv', buffer: Buffer.from('Ad,Kod\nAda,00123') });
  await page.getByLabel('Tablo çıktı biçimi').selectOption('json'); await page.getByRole('button', { name: 'Dönüştür', exact: true }).click();
  expect(JSON.parse((await result(page)).bytes.toString('utf8'))).toEqual([{ Ad: 'Ada', Kod: '00123' }]);
  expect(scripts.some(url => /exceljs/i.test(url))).toBe(false);
  for (const name of ['İlk', 'Yeni']) {
    const book = new ExcelJS.Workbook(); book.addWorksheet('Veri').addRows([['Ad'], [name]]);
    await page.getByLabel('Tablo dosyası seç').setInputFiles({ name: 'same.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from(await book.xlsx.writeBuffer()) });
    await expect(page.getByLabel('Excel çalışma sayfası')).toBeVisible(); await page.getByRole('button', { name: 'Dönüştür', exact: true }).click();
    expect(JSON.parse((await result(page)).bytes.toString('utf8'))).toEqual([{ Ad: name }]);
    await page.getByLabel('Tablo çıktı biçimi').selectOption('jsonl'); await page.getByRole('button', { name: 'Dönüştür', exact: true }).click();
    expect(JSON.parse((await result(page)).bytes.toString('utf8'))).toEqual({ Ad: name }); await page.getByLabel('Tablo çıktı biçimi').selectOption('json');
  }
  expect(workers).toBe(1); expect(scripts.filter(url => /exceljs/i.test(url))).toHaveLength(1);
});
