import { MAX_OUTPUT_BYTES, MAX_PIXELS, outputSize } from '../shared/conversion';
import { deviceImageHeader, type DeviceOptions } from '../shared/device-image';
import { encodeBmp, encodeIco } from './image-encode';
import { imageOutputName, MAX_ARCHIVE_BYTES, validateImageSelection, type ConvertedImage, type ImageResult } from './image-tasks';

async function convertImage(file: File, options: DeviceOptions): Promise<ConvertedImage> {
  let bitmap: ImageBitmap | undefined;
  let canvas: OffscreenCanvas | undefined;
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const header = deviceImageHeader(bytes);
    bitmap = await createImageBitmap(new Blob([buffer], { type: header.mime }), { imageOrientation: 'from-image' });
    if (bitmap.width * bitmap.height > MAX_PIXELS) throw new Error('Görüntü 8 megapiksel sınırını aşıyor.');
    const format = options.format;
    const limit = format === 'ico' ? Math.min(256, options.width ?? 256, 256 * bitmap.width / bitmap.height) : options.width;
    const size = outputSize(bitmap.width, bitmap.height, limit);
    canvas = new OffscreenCanvas(size.width, size.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Tarayıcınız görüntü işlemeyi desteklemiyor.');
    if (format === 'jpeg' || format === 'bmp') { context.fillStyle = '#ffffff'; context.fillRect(0, 0, size.width, size.height); }
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const encodedType = format === 'ico' ? 'image/png' : `image/${format}`;
    let blob = format === 'bmp' ? encodeBmp(context.getImageData(0, 0, size.width, size.height).data, size.width, size.height) : await canvas.convertToBlob({ type: encodedType, quality: options.quality / 100 });
    if (blob.type !== encodedType) throw new Error('Bu çıktı biçimi tarayıcınızda desteklenmiyor.');
    if (format === 'ico') blob = await encodeIco(blob, size.width, size.height);
    if (blob.size > MAX_OUTPUT_BYTES) throw new Error('Çıktı 24 MB sınırını aşıyor.');
    return { blob, ...size };
  } finally {
    bitmap?.close();
    if (canvas) { canvas.width = 1; canvas.height = 1; }
  }
}

self.onmessage = async ({ data }: MessageEvent<{ files: File[]; options: DeviceOptions }>) => {
  let currentFile = '';
  try {
    const { files, options } = data;
    validateImageSelection(files);
    let result: ImageResult;
    if (files.length === 1) {
      result = { ...await convertImage(files[0], options), kind: 'image', name: imageOutputName(files[0].name, options.format) };
    } else {
      const { Zip, ZipPassThrough } = await import('fflate');
      const chunks: BlobPart[] = [];
      let bytes = 0, failure: Error | undefined, finished = false;
      const zip = new Zip((error, chunk, final) => {
        if (error) failure = error;
        if (failure) return;
        bytes += chunk.length;
        if (bytes > MAX_ARCHIVE_BYTES) { failure = new Error('ZIP çıktısı 50 MB sınırını aşıyor. Daha az dosya veya daha küçük genişlik seçin.'); return; }
        chunks.push(chunk as Uint8Array<ArrayBuffer>);
        finished = final;
      });
      try {
        self.postMessage({ progress: { completed: 0, total: files.length } });
        for (const [index, file] of files.entries()) {
          currentFile = file.name;
          const converted = await convertImage(file, options);
          if (bytes + converted.blob.size > MAX_ARCHIVE_BYTES) throw new Error('ZIP çıktısı 50 MB sınırını aşıyor. Daha az dosya veya daha küçük genişlik seçin.');
          const entry = new ZipPassThrough(imageOutputName(file.name, options.format, index));
          entry.mtime = new Date(1980, 0, 1);
          zip.add(entry);
          entry.push(new Uint8Array(await converted.blob.arrayBuffer()), true);
          if (failure) throw failure;
          self.postMessage({ progress: { completed: index + 1, total: files.length } });
        }
        zip.end();
        if (failure) throw failure;
        if (!finished) throw new Error('ZIP arşivi tamamlanamadı.');
        result = { kind: 'archive', blob: new Blob(chunks, { type: 'application/zip' }), name: 'converter-images.zip', count: files.length };
      } finally { zip.terminate(); }
    }
    self.postMessage(result);
  } catch (error) {
    self.postMessage({ error: `${currentFile ? `${currentFile}: ` : ''}${error instanceof Error ? error.message : 'Görüntü açılamadı.'}` });
  }
};
