import { describe, expect, it } from 'vitest';
import { imageOutputName, validateImageSelection, MAX_BATCH_INPUT_BYTES } from '../src/image-tasks';
import { MAX_INPUT_BYTES } from '../shared/conversion';

describe('image batch boundaries', () => {
  it('rejects empty, excessive, oversized and aggregate input before processing', () => {
    expect(() => validateImageSelection([])).toThrow(/1–20/);
    expect(() => validateImageSelection(Array(21).fill({ size: 1 }))).toThrow(/1–20/);
    expect(() => validateImageSelection([{ size: 0 }])).toThrow(/10 MB/);
    expect(() => validateImageSelection([{ size: MAX_INPUT_BYTES + 1 }])).toThrow(/10 MB/);
    expect(() => validateImageSelection(Array(4).fill({ size: MAX_INPUT_BYTES }))).toThrow(/30 MB/);
    expect(() => validateImageSelection(Array(3).fill({ size: MAX_BATCH_INPUT_BYTES / 3 }))).not.toThrow();
    expect(() => validateImageSelection(Array(20).fill({ size: 1 }))).not.toThrow();
  });
  it('produces unique flat archive names for collisions and strips unsafe paths and controls', () => {
    expect(imageOutputName('../../same.png', 'jpeg', 0)).toBe('01-same.jpg');
    expect(imageOutputName('C:\\photos\\same.webp', 'jpeg', 1)).toBe('02-same.jpg');
    expect(imageOutputName('\u202eevil\u0000?.png', 'png', 2)).toBe('03--evil--.png');
    expect(imageOutputName('..', 'ico', 3)).toBe('04-image.ico');
    expect(imageOutputName('CON.jpg', 'webp')).toBe('image-CON.webp');
    const long = imageOutputName('ş'.repeat(200) + '.gif', 'bmp', 19);
    expect(long).toBe('20-' + 'ş'.repeat(80) + '.bmp');
    expect(imageOutputName('Çağrı.png', 'png', 0)).toBe('01-Çağrı.png');
  });
});
