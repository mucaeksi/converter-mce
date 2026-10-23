import { imageHeader, MAX_INPUT_BYTES, MAX_PIXELS, parseOptions, type Options } from './conversion';

export const deviceFormats = ['jpeg', 'png', 'webp', 'bmp', 'ico'] as const;
export type DeviceFormat = (typeof deviceFormats)[number];
export type DeviceOptions = Omit<Options, 'format'> & { format: DeviceFormat };
export const imageAccept = '.png,.jpg,.jpeg,.jfif,.webp,.bmp,.gif';
type Header = { mime: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/bmp' | 'image/gif'; width: number; height: number };
const ascii = (bytes: Uint8Array, offset: number, length: number) => String.fromCharCode(...bytes.subarray(offset, offset + length));

export function deviceOptions(params: URLSearchParams): DeviceOptions {
  const format = params.get('format') ?? 'jpeg';
  if (!deviceFormats.includes(format as DeviceFormat)) throw new Error('Desteklenmeyen çıktı biçimi.');
  const base = new URLSearchParams(params); base.set('format', 'png');
  return { ...parseOptions(base), format: format as DeviceFormat };
}

export function deviceImageHeader(bytes: Uint8Array): Header {
  if (!bytes.length || bytes.length > MAX_INPUT_BYTES) throw new Error('Dosya boş veya 10 MB sınırını aşıyor.');
  if (bytes[0] === 137 || (bytes[0] === 255 && bytes[1] === 216)) return imageHeader(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let result: Header;
  if (bytes.length >= 20 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    const end = view.getUint32(4, true) + 8;
    if (end !== bytes.length) throw new Error('WebP dosya uzunluğu geçersiz.');
    let canvas: { width: number; height: number } | undefined, image: typeof canvas;
    let offset = 12;
    while (offset + 8 <= end) {
      const kind = ascii(bytes, offset, 4), length = view.getUint32(offset + 4, true), start = offset + 8;
      if (start + length > end) throw new Error('WebP parçası eksik.');
      if (kind === 'ANIM' || kind === 'ANMF' || (kind === 'VP8X' && length >= 10 && (bytes[start] & 2))) throw new Error('Animasyonlu WebP desteklenmiyor.');
      let dimensions: typeof canvas;
      if (kind === 'VP8X' && length >= 10) {
        if (canvas) throw new Error('WebP tuval başlığı yineleniyor.');
        const u24 = (at: number) => bytes[at] | bytes[at + 1] << 8 | bytes[at + 2] << 16;
        canvas = { width: u24(start + 4) + 1, height: u24(start + 7) + 1 };
        if (canvas.width * canvas.height > MAX_PIXELS) throw new Error('Görüntü 8 megapiksel sınırını aşıyor.');
      } else if (kind === 'VP8 ' && length >= 10 && bytes[start + 3] === 157 && bytes[start + 4] === 1 && bytes[start + 5] === 42) {
        dimensions = { width: view.getUint16(start + 6, true) & 16383, height: view.getUint16(start + 8, true) & 16383 };
      } else if (kind === 'VP8L' && length >= 5 && bytes[start] === 47) {
        const bits = view.getUint32(start + 1, true);
        dimensions = { width: (bits & 16383) + 1, height: ((bits >>> 14) & 16383) + 1 };
      }
      if (dimensions) { if (image) throw new Error('Tek görüntülü WebP seçin.'); image = dimensions; }
      offset = start + length + (length % 2);
    }
    if (offset !== end || !image || (canvas && (canvas.width !== image.width || canvas.height !== image.height))) throw new Error('WebP görüntü başlığı geçersiz.');
    result = { mime: 'image/webp', ...(canvas ?? image) };
  } else if (bytes.length >= 54 && ascii(bytes, 0, 2) === 'BM') {
    const dib = view.getUint32(14, true), offset = view.getUint32(10, true), width = view.getInt32(18, true), height = Math.abs(view.getInt32(22, true)), depth = view.getUint16(28, true);
    if (dib < 40 || offset < 14 + dib || view.getUint16(26, true) !== 1 || ![24, 32].includes(depth) || view.getUint32(30, true) !== 0) throw new Error('Sıkıştırmasız 24 veya 32 bit BMP seçin.');
    if (offset + Math.ceil(width * depth / 32) * 4 * height > bytes.length) throw new Error('BMP piksel verisi eksik.');
    result = { mime: 'image/bmp', width, height };
  } else if (bytes.length >= 14 && ['GIF87a', 'GIF89a'].includes(ascii(bytes, 0, 6))) {
    const width = view.getUint16(6, true), height = view.getUint16(8, true);
    let offset = 13 + ((bytes[10] & 128) ? 3 * (1 << ((bytes[10] & 7) + 1)) : 0), frames = 0, ended = false;
    const blocks = () => {
      while (offset < bytes.length) { const size = bytes[offset++]; if (!size) return; offset += size; }
      throw new Error('GIF veri bloğu eksik.');
    };
    while (offset < bytes.length) {
      const tag = bytes[offset++];
      if (tag === 59) { ended = true; break; }
      if (tag === 33) { offset++; blocks(); }
      else if (tag === 44 && offset + 9 <= bytes.length) {
        if (++frames > 1) throw new Error('Animasyonlu GIF desteklenmiyor. Tek kareli GIF seçin.');
        const frameWidth = view.getUint16(offset + 4, true), frameHeight = view.getUint16(offset + 6, true);
        if (!frameWidth || !frameHeight || view.getUint16(offset, true) + frameWidth > width || view.getUint16(offset + 2, true) + frameHeight > height) throw new Error('GIF kare boyutları geçersiz.');
        const packed = bytes[offset + 8]; offset += 9 + ((packed & 128) ? 3 * (1 << ((packed & 7) + 1)) : 0);
        if (offset >= bytes.length || bytes[offset] < 2 || bytes[offset] > 8) throw new Error('GIF kodlaması geçersiz.');
        offset++; blocks();
      } else throw new Error('GIF yapısı geçersiz.');
    }
    if (!ended || frames !== 1) throw new Error('GIF görüntüsü eksik.');
    result = { mime: 'image/gif', width, height };
  } else throw new Error('PNG, JPEG, WebP, sıkıştırmasız BMP veya tek kareli GIF seçin.');
  if (result.width < 1 || result.height < 1 || result.width * result.height > MAX_PIXELS) throw new Error('Görüntü 8 megapiksel sınırını aşıyor veya boyutları geçersiz.');
  return result;
}
