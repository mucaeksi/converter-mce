export type LocalResult = { blob: Blob; name: string; detail: string };
export type LocalRequest =
  | { kind: 'audio'; channels: Float32Array[]; rate: number; gain: number }
  | { kind: 'pdf'; files: File[]; operation: string; selection: string; rotation: number }
  | { kind: 'sheets'; file: File }
  | { kind: 'table'; file: File; format: string; sheet: string; delimiter: string };

export function runLocal<T>(request: LocalRequest, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./document.worker.ts', import.meta.url), { type: 'module' });
    const finish = () => { clearTimeout(timer); worker.terminate(); signal.removeEventListener('abort', cancel); };
    const cancel = () => { finish(); reject(new DOMException('İşlem iptal edildi.', 'AbortError')); };
    const timer = setTimeout(() => { finish(); reject(new Error('İşlem 30 saniye sınırını aştı. Daha küçük bir dosya deneyin.')); }, 30_000);
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) { cancel(); return; }
    worker.onmessage = ({ data }) => { finish(); data.error ? reject(new Error(data.error)) : resolve(data); };
    worker.onerror = () => { finish(); reject(new Error('Dosya işlenemedi. Geçerli ve daha küçük bir dosya deneyin.')); };
    worker.postMessage(request);
  });
}
