import type { LocalRequest } from './local-tools';

self.onmessage = async ({ data }: MessageEvent<LocalRequest>) => {
  try {
    if (data.kind === 'pdf') {
      const { convertPdf } = await import('./documents');
      self.postMessage(await convertPdf(data.files, data.operation, data.selection, data.rotation));
    } else if (data.kind === 'sheets') {
      const { inspectSheets } = await import('./tables');
      self.postMessage({ sheets: await inspectSheets(data.file) });
    } else if (data.kind === 'audio') {
      const { encodeWav } = await import('./audio');
      self.postMessage(encodeWav(data.channels, data.rate, data.gain));
    } else {
      const { convertTable } = await import('./tables');
      self.postMessage(await convertTable(data.file, data.format, data.sheet, data.delimiter));
    }
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Dosya işlenemedi.' });
  }
};
