import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

for (const extension of ['wav', 'mp3']) {
  test(`${extension} audio trims, resamples and changes actual signal level without uploads`, async ({ page }) => {
    const uploads: string[] = []; page.on('request', r => { if (r.method() === 'POST') uploads.push(r.url()); });
    await page.goto('/'); await page.getByRole('button', { name: 'Ses', exact: true }).click();
    await page.getByLabel('Ses dosyası seç').setInputFiles(`tests/fixtures/tone.${extension}`);
    await page.getByLabel('Başlangıç (saniye)', { exact: true }).fill('0.25');
    await page.getByLabel('Bitiş (saniye, isteğe bağlı)').fill('1.25');
    await page.getByLabel('Örnekleme hızı').selectOption('48000');
    await page.getByLabel('Ses seviyesi:').evaluate(element => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, '50');
      element.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.getByRole('button', { name: 'Dönüştür', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Yeni dosyan hazır.' })).toBeVisible();
    const wait = page.waitForEvent('download'); await page.getByRole('link', { name: 'Dosyayı indir' }).click();
    const bytes = await readFile((await (await wait).path())!);
    expect(bytes.toString('ascii', 0, 4)).toBe('RIFF'); expect(bytes.toString('ascii', 8, 12)).toBe('WAVE');
    expect(bytes.readUInt32LE(24)).toBe(48000); expect(bytes.readUInt16LE(22)).toBe(2); expect(bytes.readUInt16LE(34)).toBe(16);
    expect(bytes.readUInt32LE(40)).toBe(48_000 * 2 * 2);
    let peak = 0, crossings = 0;
    for (let frame = 1; frame < 48000; frame++) {
      const sample = bytes.readInt16LE(44 + frame * 4) / 32768; peak = Math.max(peak, Math.abs(sample));
      if (sample > 0 && bytes.readInt16LE(44 + (frame - 1) * 4) <= 0) crossings++;
    }
    expect(peak).toBeGreaterThan(0.05); expect(peak).toBeLessThan(0.07); expect(crossings).toBeGreaterThan(435); expect(crossings).toBeLessThan(445);
    expect(uploads).toHaveLength(0);
  });
}

test('video resize and trim produce decodable WebM frames and non-silent audio', async ({ page }) => {
  const uploads: string[] = []; page.on('request', r => { if (r.method() === 'POST') uploads.push(r.url()); });
  await page.goto('/'); await page.getByRole('button', { name: 'Video', exact: true }).click();
  await page.getByLabel('Video dosyası seç').setInputFiles('tests/fixtures/green.webm');
  await page.getByLabel('Başlangıç (saniye)', { exact: true }).fill('0.25');
  await page.getByLabel('Bitiş (saniye, isteğe bağlı)').fill('1.25');
  await page.getByLabel('Video en fazla genişlik').fill('64');
  await page.getByRole('button', { name: 'Dönüştür', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Yeni dosyan hazır.' })).toBeVisible({ timeout: 25_000 });
  const waiting = page.waitForEvent('download'); await page.getByRole('link', { name: 'Dosyayı indir' }).click();
  const bytes = await readFile((await (await waiting).path())!);
  expect([...bytes.subarray(0, 4)]).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
  const decoded = await page.getByLabel('Dönüştürülmüş video').evaluate(async (element, bytes) => {
    const video = element as HTMLVideoElement;
    if (video.readyState < 2) await new Promise<void>((resolve, reject) => { video.onloadeddata = () => resolve(); video.onerror = () => reject(new Error('decode failed')); });
    video.currentTime = 0.4; await new Promise<void>(resolve => video.onseeked = () => resolve());
    const c = document.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight; const x = c.getContext('2d')!; x.drawImage(video, 0, 0);
    const context = new AudioContext();
    try {
      const buffer = await context.decodeAudioData(new Uint8Array(bytes).buffer);
      let peak = 0; for (const value of buffer.getChannelData(0)) peak = Math.max(peak, Math.abs(value));
      return { width: video.videoWidth, height: video.videoHeight, duration: video.duration, pixel: [...x.getImageData(10, 10, 1, 1).data], peak };
    } finally { await context.close(); }
  }, [...bytes]);
  expect(decoded.width).toBe(64); expect(decoded.height).toBe(32);
  expect(decoded.duration).toBeGreaterThan(0.8); expect(decoded.duration).toBeLessThan(1.5);
  expect(decoded.pixel[1]).toBeGreaterThan(140); expect(decoded.pixel[0]).toBeLessThan(50); expect(decoded.peak).toBeGreaterThan(0.05);
  expect(uploads).toHaveLength(0);
});

test('MP3 output is compressed, stereo and decodes to the trimmed audible signal', async ({ page }) => {
  const posts: string[] = []; page.on('request', r => { if (r.method() === 'POST') posts.push(r.url()); });
  await page.goto('/'); await page.getByRole('button', { name: 'Ses', exact: true }).click();
  await page.getByLabel('Ses dosyası seç').setInputFiles('tests/fixtures/tone.wav');
  await page.getByLabel('Ses çıktı biçimi').selectOption('mp3'); await page.getByLabel('Başlangıç (saniye)', { exact: true }).fill('0.25'); await page.getByLabel('Bitiş (saniye, isteğe bağlı)').fill('1.25');
  await page.getByRole('button', { name: 'Dönüştür', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Yeni dosyan hazır.' })).toBeVisible();
  const waiting = page.waitForEvent('download'); await page.getByRole('link', { name: 'Dosyayı indir' }).click(); const file = await waiting;
  const bytes = await readFile((await file.path())!); expect(file.suggestedFilename()).toBe('converter-mce.mp3');
  expect(bytes[0]).toBe(255); expect(bytes[1] & 224).toBe(224); expect(bytes.length).toBeGreaterThan(18_000); expect(bytes.length).toBeLessThan(40_000);
  const decoded = await page.evaluate(async data => {
    const ctx = new AudioContext({ sampleRate: 44100 });
    try {
      const buffer = await ctx.decodeAudioData(new Uint8Array(data).buffer); const samples = buffer.getChannelData(0); let peak = 0, crossings = 0;
      for (let i = 1; i < samples.length; i++) { peak = Math.max(peak, Math.abs(samples[i])); if (samples[i] > 0.002 && samples[i - 1] <= 0.002) crossings++; }
      return { duration: buffer.duration, channels: buffer.numberOfChannels, peak, crossings };
    } finally { await ctx.close(); }
  }, [...bytes]);
  expect(decoded.channels).toBe(2); expect(decoded.duration).toBeGreaterThan(1); expect(decoded.duration).toBeLessThan(1.12);
  expect(decoded.peak).toBeGreaterThan(0.1); expect(decoded.crossings).toBeGreaterThan(435); expect(decoded.crossings).toBeLessThan(445); expect(posts).toHaveLength(0);
});

test('media rejects invalid ranges and cancellation leaves no downloadable output', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Ses', exact: true }).click();
  await page.getByLabel('Ses dosyası seç').setInputFiles('tests/fixtures/tone.wav');
  await page.getByLabel('Başlangıç (saniye)', { exact: true }).fill('20');
  await page.getByRole('button', { name: 'Dönüştür', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('aralık');
  await page.getByRole('button', { name: 'Video', exact: true }).click();
  await page.getByLabel('Video dosyası seç').setInputFiles('tests/fixtures/green.webm');
  await page.getByRole('button', { name: 'Dönüştür', exact: true }).click();
  await page.getByRole('button', { name: 'İşlemi durdur' }).click();
  await expect(page.getByRole('status')).toContainText('durduruldu'); await expect(page.getByRole('link', { name: 'Dosyayı indir' })).toHaveCount(0);
});
