import { PDFDocument, degrees } from 'pdf-lib';

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
  if (!['merge', 'extract', 'rotate'].includes(operation) || ![0, 90, 180, 270].includes(rotation)) throw new Error('Geçersiz PDF işlemi.');
  if (!files.length || files.length > 8 || files.some(f => f.size > 10 * 1024 * 1024) || files.reduce((n, f) => n + f.size, 0) > 20 * 1024 * 1024) throw new Error('En fazla 8 PDF; dosya başına 10 MB, toplam 20 MB seçin.');
  if (operation !== 'merge' && files.length !== 1) throw new Error('Sayfa işlemleri için tek PDF seçin.');
  const output = await PDFDocument.create();
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
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
