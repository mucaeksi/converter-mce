import { imageHeader, outputSize, type Options } from '../shared/conversion';

self.onmessage = async (event: MessageEvent<{ bytes: ArrayBuffer; options: Options }>) => {
  let bitmap: ImageBitmap | undefined;
  try {
    const bytes = new Uint8Array(event.data.bytes);
    const header = imageHeader(bytes);
    bitmap = await createImageBitmap(new Blob([event.data.bytes], { type: header.mime }), { imageOrientation: 'from-image' });
    const size = outputSize(bitmap.width, bitmap.height, event.data.options.width);
    const canvas = new OffscreenCanvas(size.width, size.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Tarayıcınız görüntü işlemeyi desteklemiyor.');
    if (event.data.options.format === 'jpeg') { context.fillStyle = '#ffffff'; context.fillRect(0, 0, size.width, size.height); }
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const blob = await canvas.convertToBlob({ type: `image/${event.data.options.format}`, quality: event.data.options.quality / 100 });
    if (blob.type !== `image/${event.data.options.format}`) throw new Error('Bu çıktı biçimi tarayıcınızda desteklenmiyor.');
    self.postMessage({ blob, ...size });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Görüntü açılamadı.' });
  } finally { bitmap?.close(); }
};
