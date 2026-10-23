import { describe, expect, it } from 'vitest';
import { deviceImageHeader, deviceOptions } from '../shared/device-image';
import { imageHeader } from '../shared/conversion';
import { encodeBmp } from '../src/image-encode';

describe('device-only image formats', () => {
  it('validates BMP row padding and size without extending the cloud contract', async () => {
    const blob = encodeBmp(new Uint8ClampedArray(7 * 4 * 4).fill(255), 7, 4);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes.length).toBe(54 + 24 * 4);
    expect(deviceImageHeader(bytes)).toEqual({ mime: 'image/bmp', width: 7, height: 4 });
    expect(() => imageHeader(bytes)).toThrow();
    expect(() => deviceImageHeader(bytes.subarray(0, bytes.length - 1))).toThrow(/eksik/);
  });
  it('rejects contradictory WebP dimensions, animation and oversized canvases', () => {
    const data = new Uint8Array(44), v = new DataView(data.buffer), text = new TextEncoder();
    data.set(text.encode('RIFF')); v.setUint32(4, 36, true); data.set(text.encode('WEBPVP8X'), 8); v.setUint32(16, 10, true);
    data.set(text.encode('VP8L'), 30); v.setUint32(34, 5, true); data[38] = 47;
    expect(deviceImageHeader(data)).toEqual({ mime: 'image/webp', width: 1, height: 1 });
    data[20] = 2; expect(() => deviceImageHeader(data)).toThrow(/Animasyonlu/); data[20] = 0;
    data[24] = 9; expect(() => deviceImageHeader(data)).toThrow(/başlığı/);
    data[24] = 0; v.setUint32(39, (16383 << 14) | 16383, true); data[24] = 255; data[25] = 63; data[27] = 255; data[28] = 63;
    expect(() => deviceImageHeader(data)).toThrow(/8 megapiksel/);
  });
  it('accepts local ICO options and rejects invalid widths and unknown types', () => {
    expect(deviceOptions(new URLSearchParams('format=ico&width=256&quality=85'))).toEqual({ format: 'ico', width: 256, quality: 85 });
    expect(() => deviceOptions(new URLSearchParams('format=svg'))).toThrow();
    expect(() => deviceOptions(new URLSearchParams('format=bmp&width=0'))).toThrow();
    expect(() => deviceImageHeader(new TextEncoder().encode('<svg onload="alert(1)"/>'))).toThrow();
  });
});
