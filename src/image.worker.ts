import { MAX_OUTPUT_BYTES, MAX_PIXELS, outputSize } from '../shared/conversion';
import { deviceImageHeader, type DeviceOptions } from '../shared/device-image';
import { encodeBmp, encodeIco } from './image-encode';

self.onmessage = async (event: MessageEvent<{ file: File; options: DeviceOptions }>) => {
  let bitmap: ImageBitmap | undefined;
  try {
    const buffer = await event.data.file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const header = deviceImageHeader(bytes);
    bitmap = await createImageBitmap(new Blob([buffer], { type: header.mime }), { imageOrientation: 'from-image' });
    if (bitmap.width * bitmap.height > MAX_PIXELS) throw new Error('Görüntü 8 megapiksel sınırını aşıyor.');
    const format = event.data.options.format;
    const limit = format === 'ico' ? Math.min(256, event.data.options.width ?? 256, 256 * bitmap.width / bitmap.height) : event.data.options.width;
    const size = outputSize(bitmap.width, bitmap.height, limit);
    const canvas = new OffscreenCanvas(size.width, size.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Tarayıcınız görüntü işlemeyi desteklemiyor.');
    if (format === 'jpeg' || format === 'bmp') { context.fillStyle = '#ffffff'; context.fillRect(0, 0, size.width, size.height); }
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const encodedType = format === 'ico' ? 'image/png' : `image/${format}`;
    let blob = format === 'bmp' ? encodeBmp(context.getImageData(0, 0, size.width, size.height).data, size.width, size.height) : await canvas.convertToBlob({ type: encodedType, quality: event.data.options.quality / 100 });
    if (blob.type !== encodedType) throw new Error('Bu çıktı biçimi tarayıcınızda desteklenmiyor.');
    if (format === 'ico') blob = await encodeIco(blob, size.width, size.height);
    if (blob.size > MAX_OUTPUT_BYTES) throw new Error('Çıktı 24 MB sınırını aşıyor.');
    self.postMessage({ blob, ...size });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Görüntü açılamadı.' });
  } finally { bitmap?.close(); }
};
