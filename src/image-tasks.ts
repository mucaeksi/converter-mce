import { MAX_INPUT_BYTES } from '../shared/conversion';
import type { DeviceFormat } from '../shared/device-image';

export const MAX_BATCH_FILES = 20;
export const MAX_BATCH_INPUT_BYTES = 30 * 1024 * 1024;
export const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;
export type ConvertedImage = { blob: Blob; width: number; height: number };
export type ImageResult =
  | (ConvertedImage & { kind: 'image'; name: string })
  | { kind: 'archive'; blob: Blob; name: string; count: number };
export type ImageProgress = { completed: number; total: number };

export function validateImageSelection(files: readonly Pick<File, 'size'>[]) {
  if (!files.length || files.length > MAX_BATCH_FILES) throw new Error('1–20 görüntü seçin.');
  if (files.some(file => !file.size || file.size > MAX_INPUT_BYTES)) throw new Error('Her dosya dolu ve en fazla 10 MB olmalı.');
  if (files.reduce((size, file) => size + file.size, 0) > MAX_BATCH_INPUT_BYTES) throw new Error('Seçilen dosyalar toplamda en fazla 30 MB olabilir.');
}

export function imageOutputName(filename: string, format: DeviceFormat, index?: number) {
  let base = (filename.split(/[\\/]/).pop() ?? '').replace(/\.[^.]*$/, '')
    .replace(/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069<>:"|?*]/g, '-').replace(/^[.\s]+|[.\s]+$/g, '');
  base = [...base].slice(0, 80).join('') || 'image';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(base)) base = `image-${base}`;
  return `${index === undefined ? '' : `${String(index + 1).padStart(2, '0')}-`}${base}.${format === 'jpeg' ? 'jpg' : format}`;
}
