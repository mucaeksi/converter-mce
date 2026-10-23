export type LocalResult = { blob: Blob; name: string; detail: string };
export type LocalRequest =
  | { kind: 'audio'; channels: Float32Array[]; rate: number; gain: number; format: 'wav' | 'mp3' }
  | { kind: 'pdf'; files: File[]; operation: string; selection: string; rotation: number }
  | { kind: 'sheets'; file: File }
  | { kind: 'table'; file: File; format: string; sheet: string; delimiter: string };

export function runLocal<T>(request: LocalRequest, signal: AbortSignal): Promise<T> {
  const runner = createLocalRunner();
  return runner.run<T>(request, signal).finally(runner.dispose);
}

export function createLocalRunner() {
  let instance: Worker | undefined, pending = false, cancelCurrent: (() => void) | undefined;
  return {
    run<T>(request: LocalRequest, signal: AbortSignal): Promise<T> {
      if (pending) return Promise.reject(new Error('Önce mevcut işlemi tamamlayın.'));
      if (signal.aborted) return Promise.reject(new DOMException('İşlem iptal edildi.', 'AbortError'));
      return new Promise((resolve, reject) => {
        const worker = instance ??= new Worker(new URL('./document.worker.ts', import.meta.url), { type: 'module' });
        pending = true;
        const finish = (terminate = false) => {
          clearTimeout(timer); signal.removeEventListener('abort', cancel); worker.onmessage = null; worker.onerror = null;
          pending = false; cancelCurrent = undefined;
          if (terminate) { worker.terminate(); instance = undefined; }
        };
        const cancel = () => { finish(true); reject(new DOMException('İşlem iptal edildi.', 'AbortError')); };
        cancelCurrent = cancel;
        const timer = setTimeout(() => { finish(true); reject(new Error('İşlem 30 saniye sınırını aştı. Daha küçük bir dosya deneyin.')); }, 30_000);
        signal.addEventListener('abort', cancel, { once: true });
        worker.onmessage = ({ data }) => { finish(); data.error ? reject(new Error(data.error)) : resolve(data); };
        worker.onerror = () => { finish(true); reject(new Error('Dosya işlenemedi. Geçerli ve daha küçük bir dosya deneyin.')); };
        const transfers = request.kind === 'audio' ? [...new Set(request.channels.map(channel => channel.buffer as ArrayBuffer))] : [];
        try { worker.postMessage(request, transfers); } catch (error) { finish(true); reject(error); }
      });
    },
    dispose() { cancelCurrent?.(); instance?.terminate(); instance = undefined; },
  };
}
