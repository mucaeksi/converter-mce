import { describe, expect, it } from 'vitest';
import { imageHeader, outputSize, parseOptions } from '../shared/conversion';

describe('image contract', () => {
  it('preserves aspect ratio without upscaling', () => {
    expect(outputSize(800, 400, 400)).toEqual({ width: 400, height: 200 });
    expect(outputSize(800, 400, 1200)).toEqual({ width: 800, height: 400 });
    expect(outputSize(800, 1, 1)).toEqual({ width: 1, height: 1 });
  });
  it('rejects malformed options instead of silently coercing them', () => {
    for (const options of ['format=pdf', 'quality=96', 'quality=', 'width=0', 'width=4097', 'width=NaN']) {
      expect(() => parseOptions(new URLSearchParams(options))).toThrow();
    }
    expect(parseOptions(new URLSearchParams('format=webp&quality=80&width=400'))).toEqual({ format: 'webp', quality: 80, width: 400 });
  });
  it('rejects unknown files, truncated JPEG and PNG pixel bombs', () => {
    expect(() => imageHeader(new Uint8Array([255, 216, 255, 192, 0, 99]))).toThrow();
    expect(() => imageHeader(new TextEncoder().encode('<script>alert(1)</script>'))).toThrow();
    const bytes = new Uint8Array(33);
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
    const view = new DataView(bytes.buffer); view.setUint32(16, 50_000); view.setUint32(20, 50_000);
    expect(() => imageHeader(bytes)).toThrow(/8 megapiksel/);
  });
});
