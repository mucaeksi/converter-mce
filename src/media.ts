import { runLocal, type LocalResult } from './local-tools';
import fixWebmDuration from 'fix-webm-duration';

function waitFor(element: HTMLMediaElement, event: string, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const done = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error('Medya açılamadı. Bu dosyanın codec’i tarayıcınızda desteklenmeyebilir.')); };
    const cancel = () => { cleanup(); reject(new DOMException('İşlem durduruldu.', 'AbortError')); };
    const cleanup = () => { clearTimeout(timer); element.removeEventListener(event, done); element.removeEventListener('error', fail); signal.removeEventListener('abort', cancel); };
    const timer = setTimeout(fail, 15_000);
    element.addEventListener(event, done, { once: true }); element.addEventListener('error', fail, { once: true }); signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
  });
}
function interval(start: number, end: number | undefined, duration: number, maximum: number) {
  const until = end ?? duration;
  if (!Number.isFinite(duration) || duration <= 0 || duration > maximum) throw new Error(`Kaynak en fazla ${maximum} saniye olabilir.`);
  if (!Number.isFinite(start) || !Number.isFinite(until) || start < 0 || until > duration + 0.001 || until <= start || until - start < 0.1) throw new Error('En az 0,1 saniyelik, kaynak süresi içinde bir aralık seçin.');
  return until;
}

export async function convertAudio(file: File, start: number, end: number | undefined, rate: number, gain: number, signal: AbortSignal): Promise<LocalResult> {
  if (!file.size || file.size > 10 * 1024 * 1024 || !/\.(mp3|wav|m4a|aac|ogg|oga|flac|webm)$/i.test(file.name)) throw new Error('En fazla 10 MB desteklenen ses dosyası seçin.');
  const context = new AudioContext({ sampleRate: rate });
  const element = document.createElement('audio'), url = URL.createObjectURL(file);
  try {
    const metadata = waitFor(element, 'loadedmetadata', signal); element.src = url; element.preload = 'metadata'; await metadata;
    const until = interval(start, end, element.duration, 120);
    const audio = await context.decodeAudioData(await file.arrayBuffer());
    if (signal.aborted) throw new DOMException('İşlem durduruldu.', 'AbortError');
    if (audio.numberOfChannels > 2 || audio.duration > 120.1) throw new Error('En fazla iki kanal ve 120 saniye ses desteklenir.');
    const first = Math.round(start * audio.sampleRate), last = Math.min(audio.length, Math.round(until * audio.sampleRate));
    const channels = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i).slice(first, last));
    return await runLocal<LocalResult>({ kind: 'audio', channels, rate: audio.sampleRate, gain }, signal);
  } finally { element.removeAttribute('src'); element.load(); URL.revokeObjectURL(url); await context.close(); }
}

export function videoMime() {
  if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) return undefined;
  return ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus'].find(type => MediaRecorder.isTypeSupported(type));
}

export async function convertVideo(file: File, start: number, end: number | undefined, width: number, signal: AbortSignal, progress: (value: string) => void): Promise<LocalResult> {
  const mimeType = videoMime();
  if (!mimeType) throw new Error('Bu tarayıcı WebM video oluşturmayı desteklemiyor. Güncel Chrome veya Edge deneyin.');
  if (!file.size || file.size > 25 * 1024 * 1024 || !/\.(mp4|mov|webm|mkv)$/i.test(file.name)) throw new Error('En fazla 25 MB MP4, MOV, WebM veya MKV seçin; codec desteği tarayıcıya bağlıdır.');
  if (!Number.isInteger(width) || width < 64 || width > 1280) throw new Error('Video genişliği 64–1280 arasında olmalı.');
  const video = document.createElement('video'), source = URL.createObjectURL(file), audio = new AudioContext();
  let stream: MediaStream | undefined, recorder: MediaRecorder | undefined, animation = 0;
  const resume = audio.resume();
  // Audio is routed only to the recording destination, never to the speakers.
  video.playsInline = true; video.preload = 'auto';
  try {
    const metadata = waitFor(video, 'loadedmetadata', signal); video.src = source; await metadata; await resume;
    const until = interval(start, end, video.duration, 60);
    if (!video.videoWidth || video.videoWidth * video.videoHeight > 1920 * 1080) throw new Error('Kaynak video en fazla 1920×1080 piksel olabilir.');
    if (start > 0) { const seek = waitFor(video, 'seeked', signal); video.currentTime = start; await seek; }
    const scale = Math.min(1, width / video.videoWidth), canvas = document.createElement('canvas');
    canvas.width = Math.max(2, Math.round(video.videoWidth * scale / 2) * 2); canvas.height = Math.max(2, Math.round(video.videoHeight * scale / 2) * 2);
    const graphics = canvas.getContext('2d'); if (!graphics) throw new Error('Video çizimi desteklenmiyor.');
    const output = audio.createMediaStreamDestination(); audio.createMediaElementSource(video).connect(output);
    stream = canvas.captureStream(24); output.stream.getAudioTracks().forEach(track => stream!.addTrack(track));
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1_500_000, audioBitsPerSecond: 128_000 });
    const chunks: Blob[] = []; let size = 0, elapsed = 0, recordingStarted = 0;
    const result = new Promise<Blob>((resolve, reject) => {
      let failure: Error | undefined;
      const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', cancel); document.removeEventListener('visibilitychange', hidden); video.removeEventListener('error', mediaError); };
      const stop = (error?: Error) => { failure = error; video.pause(); elapsed = performance.now() - recordingStarted; if (recorder!.state !== 'inactive') recorder!.stop(); else { cleanup(); reject(error ?? new Error('Video kaydı durdu.')); } };
      const cancel = () => stop(new DOMException('İşlem durduruldu.', 'AbortError'));
      const hidden = () => { if (document.hidden) stop(new Error('Video işlemi için sekmeyi açık tutun. Yeniden deneyebilirsiniz.')); };
      const mediaError = () => stop(new Error('Video oynatılırken açılamayan bir bölüm bulundu.'));
      const timer = setTimeout(() => stop(new Error('Video 90 saniyede tamamlanamadı. Daha kısa bir klip deneyin.')), 90_000);
      recorder!.ondataavailable = event => { size += event.data.size; if (size > 20 * 1024 * 1024) stop(new Error('Video çıktısı 20 MB sınırını aşıyor.')); else if (event.data.size) chunks.push(event.data); };
      recorder!.onerror = () => stop(new Error('Tarayıcı videoyu kodlayamadı.'));
      recorder!.onstop = () => { cleanup(); if (failure) reject(failure); else if (!size) reject(new Error('Video çıktısı boş.')); else resolve(new Blob(chunks, { type: 'video/webm' })); };
      signal.addEventListener('abort', cancel, { once: true }); document.addEventListener('visibilitychange', hidden); video.addEventListener('error', mediaError);
      const draw = () => {
        if (recorder!.state !== 'recording') return;
        graphics.drawImage(video, 0, 0, canvas.width, canvas.height);
        progress(`Cihazda video işleniyor · ${Math.min(100, Math.round((video.currentTime - start) / (until - start) * 100))}%`);
        if (video.ended || video.currentTime >= until) stop(); else animation = requestAnimationFrame(draw);
      };
      recordingStarted = performance.now(); recorder!.start(250);
      if (signal.aborted) cancel();
      else video.play().then(draw, () => stop(new Error('Tarayıcı video işlemini başlatamadı.')));
    });
    const blob = await fixWebmDuration(await result, elapsed, { logger: false });
    if (signal.aborted) throw new DOMException('İşlem durduruldu.', 'AbortError');
    return { blob, name: 'converter-mce.webm', detail: `${canvas.width} × ${canvas.height} px · yaklaşık ${(until - start).toFixed(2)} saniye · WebM / 24 fps` };
  } finally {
    cancelAnimationFrame(animation); video.pause(); if (recorder && recorder.state !== 'inactive') recorder.stop();
    stream?.getTracks().forEach(track => track.stop()); video.removeAttribute('src'); video.load(); URL.revokeObjectURL(source); await audio.close();
  }
}
