export const MAX_INPUT_BYTES = 10 * 1024 * 1024;
export const MAX_PIXELS = 8_000_000;
export const MAX_OUTPUT_BYTES = 24 * 1024 * 1024;
export const formats = ['jpeg', 'png', 'webp'] as const;
export type OutputFormat = (typeof formats)[number];
export type Options = { format: OutputFormat; quality: number; width: number | null };
export type Job = {
  id: string;
  state: 'uploading' | 'queued' | 'processing' | 'succeeded' | 'failed' | 'deleted' | 'expired';
  format: OutputFormat;
  input_bytes: number;
  output_bytes: number | null;
  output_width: number | null;
  output_height: number | null;
  error: string | null;
  expires_at: number;
};

export function parseOptions(params: URLSearchParams): Options {
  const format = params.get('format') ?? 'jpeg';
  const quality = Number(params.get('quality') ?? '85');
  const rawWidth = params.get('width');
  const width = rawWidth === null || rawWidth === '' ? null : Number(rawWidth);
  if (!formats.includes(format as OutputFormat)) throw new Error('Desteklenmeyen çıktı biçimi.');
  if (!Number.isInteger(quality) || quality < 10 || quality > 95) throw new Error('Kalite 10–95 arasında olmalı.');
  if (width !== null && (!Number.isInteger(width) || width < 1 || width > 4096)) {
    throw new Error('Genişlik 1–4096 piksel arasında olmalı.');
  }
  return { format: format as OutputFormat, quality, width };
}

export function outputSize(width: number, height: number, maxWidth: number | null) {
  const scale = maxWidth === null ? 1 : Math.min(1, maxWidth / width);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function imageHeader(bytes: Uint8Array): { mime: 'image/png' | 'image/jpeg'; width: number; height: number } {
  if (!bytes.length || bytes.length > MAX_INPUT_BYTES) throw new Error('Dosya boş veya 10 MB sınırını aşıyor.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let result: { mime: 'image/png' | 'image/jpeg'; width: number; height: number } | undefined;
  const png = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length >= 33 && png.every((value, i) => bytes[i] === value)) {
    if (view.getUint32(8) !== 13 || String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR') {
      throw new Error('PNG başlığı geçersiz.');
    }
    result = { mime: 'image/png', width: view.getUint32(16), height: view.getUint32(20) };
    let offset = 8;
    while (offset + 12 <= bytes.length) {
      const length = view.getUint32(offset);
      const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
      if (type === 'acTL') throw new Error('Animasyonlu PNG bu sürümde desteklenmiyor.');
      if (type === 'IDAT') break;
      offset += length + 12;
    }
  } else if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216) {
    const sof = new Set([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207]);
    let i = 2;
    while (i + 3 < bytes.length) {
      if (bytes[i++] !== 255) break;
      while (bytes[i] === 255) i++;
      const marker = bytes[i++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (i + 2 > bytes.length) break;
      const length = view.getUint16(i);
      if (length < 2 || i + length > bytes.length) break;
      if (sof.has(marker) && length >= 8) {
        result = { mime: 'image/jpeg', width: view.getUint16(i + 5), height: view.getUint16(i + 3) };
        break;
      }
      i += length;
    }
  }
  if (!result) throw new Error('İlk sürüm PNG ve JPEG girişlerini destekliyor.');
  if (result.width < 1 || result.height < 1 || result.width * result.height > MAX_PIXELS) {
    throw new Error('Görüntü 8 megapiksel sınırını aşıyor veya boyutları geçersiz.');
  }
  return result;
}
