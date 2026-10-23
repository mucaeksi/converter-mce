import { PDFDocument, degrees } from 'pdf-lib';
import { deviceImageHeader } from '../shared/device-image';

export function pageSelection(value: string, count: number): number[] {
  if (!value.trim()) return Array.from({ length: count }, (_, i) => i);
  const pages: number[] = [];
  for (const part of value.split(',')) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error('Sayfaları 1,3-5 şeklinde yazın.');
    const first = Number(match[1]), last = Number(match[2] ?? match[1]);
    if (first < 1 || last > count || last < first) throw new Error(`Sayfa aralığı 1–${count} içinde olmalı.`);
    for (let page = first; page <= last; page++) {
      if (pages.includes(page - 1)) throw new Error('Aynı sayfayı birden fazla seçmeyin.');
      pages.push(page - 1);
    }
  }
  return pages;
}

export async function convertPdf(files: File[], operation: string, selection: string, rotation: number) {
  if (!['merge', 'extract', 'rotate', 'images'].includes(operation) || ![0, 90, 180, 270].includes(rotation)) throw new Error('Geçersiz PDF işlemi.');
  if (!files.length || files.length > 8 || files.some(f => f.size > 10 * 1024 * 1024) || files.reduce((n, f) => n + f.size, 0) > 20 * 1024 * 1024) throw new Error('En fazla 8 PDF; dosya başına 10 MB, toplam 20 MB seçin.');
  if (!['merge', 'images'].includes(operation) && files.length !== 1) throw new Error('Sayfa işlemleri için tek PDF seçin.');
  const output = await PDFDocument.create();
  let imagePixels = 0;
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (operation === 'images') {
      const header = deviceImageHeader(bytes);
      imagePixels += header.width * header.height;
      if (imagePixels > 16_000_000) throw new Error('Görsellerin toplamı en fazla 16 megapiksel olabilir.');
      const bitmap = await createImageBitmap(new Blob([bytes], { type: header.mime }), { imageOrientation: 'from-image' });
      try {
        if (bitmap.width * bitmap.height > 8_000_000) throw new Error('Görüntü en fazla 8 megapiksel olabilir.');
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), context = canvas.getContext('2d');
        if (!context) throw new Error('Tarayıcınız görselden PDF oluşturmayı desteklemiyor.');
        context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0);
        const image = await output.embedPng(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
        const page = output.addPage(bitmap.width > bitmap.height ? [841.89, 595.28] : [595.28, 841.89]);
        const scale = Math.min((page.getWidth() - 48) / image.width, (page.getHeight() - 48) / image.height);
        const width = image.width * scale, height = image.height * scale;
        page.drawImage(image, { x: (page.getWidth() - width) / 2, y: (page.getHeight() - height) / 2, width, height });
        if (rotation) page.setRotation(degrees(rotation));
      } finally { bitmap.close(); }
      continue;
    }
    if (!new TextDecoder('ascii').decode(bytes.subarray(0, 1024)).includes('%PDF-')) throw new Error('Geçerli bir PDF seçin.');
    let source: PDFDocument;
    try { source = await PDFDocument.load(bytes); }
    catch { throw new Error('PDF açılamadı. Şifreli veya bozuk PDF bu sürümde desteklenmiyor.'); }
    if (source.getPageCount() > 200) throw new Error('PDF en fazla 200 sayfa olabilir.');
    if (source.getForm().getFields().length) throw new Error('Etkileşimli form veya imza alanı içeren PDF desteklenmiyor. Önce düzleştirilmiş bir kopya kullanın.');
    const indices = operation === 'merge' ? source.getPageIndices() : pageSelection(selection, source.getPageCount());
    if (output.getPageCount() + indices.length > 200) throw new Error('Çıktı en fazla 200 sayfa olabilir.');
    const copied = await output.copyPages(source, indices);
    for (const page of copied) {
      if (rotation) page.setRotation(degrees((page.getRotation().angle + rotation) % 360));
      output.addPage(page);
    }
  }
  if (!output.getPageCount()) throw new Error('PDF içinde işlenecek sayfa yok.');
  const bytes = await output.save();
  if (bytes.length > 30 * 1024 * 1024) throw new Error('Çıktı 30 MB sınırını aşıyor.');
  return { blob: new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }), name: 'converter-mce.pdf', detail: `${output.getPageCount()} sayfa` };
}
