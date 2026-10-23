import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { imageHeader, type Job } from '../shared/conversion';
import { deviceImageHeader, deviceOptions, deviceFormats, imageAccept, type DeviceFormat } from '../shared/device-image';
import { imageOutputName, validateImageSelection, type ImageResult, type ImageProgress } from './image-tasks';
import './style.css';
const DocumentTools = lazy(() => import('./DocumentTools').then(module => ({ default: module.DocumentTools })));
const MediaTools = lazy(() => import('./MediaTools').then(module => ({ default: module.MediaTools })));

const sizes = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const stateNames: Record<string, string> = { uploading: 'Yükleniyor', queued: 'Sırada', processing: 'Dönüştürülüyor', succeeded: 'Hazır', failed: 'Başarısız' };

async function responseJson<T>(response: Response): Promise<T> {
  if (!response.headers.get('Content-Type')?.includes('application/json')) throw new Error('Sunucu oturumu gerekli. Oturum açma bağlantısını kullanın.');
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? 'İstek tamamlanamadı.');
  return body;
}

function App() {
  const [tool, setTool] = useState<'image' | 'pdf' | 'table' | 'audio' | 'video'>('image');
  const [files, setFiles] = useState<File[]>([]);
  const file = files[0] ?? null;
  const [preview, setPreview] = useState('');
  const [result, setResult] = useState<ImageResult | null>(null);
  const [progress, setProgress] = useState<ImageProgress | null>(null);
  const [resultUrl, setResultUrl] = useState('');
  const [format, setFormat] = useState<DeviceFormat>('jpeg');
  const [quality, setQuality] = useState(85);
  const [width, setWidth] = useState('');
  const [mode, setMode] = useState<'device' | 'cloud'>('device');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Bir dosya seçerek başlayın.');
  const [error, setError] = useState('');
  const [job, setJob] = useState<Job | null>(null);
  const [dragging, setDragging] = useState(false);
  const [serverAuth, setServerAuth] = useState('unconfigured');
  const input = useRef<HTMLInputElement>(null);
  const selectionVersion = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const worker = useRef<Worker | null>(null);

  useEffect(() => {
    fetch('/.well-known/converter-capabilities').then(responseJson<{ serverAuth: string }>).then((v) => setServerAuth(v.serverAuth)).catch(() => {});
    return () => { controller.current?.abort(); worker.current?.terminate(); };
  }, []);
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (!result) { setResultUrl(''); return; }
    const url = URL.createObjectURL(result.blob); setResultUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result]);

  async function selectFiles(selected: FileList | null) {
    if (!selected?.length || busy) return;
    const version = ++selectionVersion.current;
    setError(''); setResult(null); setJob(null); setFiles([]); setProgress(null);
    try {
      const next = [...selected];
      validateImageSelection(next);
      if (mode === 'cloud' && next.length > 1) throw new Error('Toplu dönüşüm için cihazda işleme yöntemini seçin.');
      for (const item of next) {
        const buffer = await item.arrayBuffer();
        if (version !== selectionVersion.current) return;
        try { deviceImageHeader(new Uint8Array(buffer)); }
        catch (error) { throw new Error(`${item.name}: ${(error as Error).message}`); }
      }
      if (version !== selectionVersion.current) return;
      setFiles(next); setStatus(`${next.length > 1 ? `${next.length} dosyanız` : 'Dosyanız'} hazır. Çıktı ayarlarını seçin.`);
    } catch (e) { if (version === selectionVersion.current) { setStatus('Dosya seçimini kontrol edin.'); setError((e as Error).message); } }
  }
  function invalidate() { setResult(null); setError(''); setProgress(null); }
  function removeFile(index: number) {
    if (busy) return;
    selectionVersion.current++;
    const next = files.filter((_, i) => i !== index);
    setFiles(next); invalidate(); setJob(null);
    setStatus(next.length ? 'Dosya listesi güncellendi. Dönüşümü başlatabilirsiniz.' : 'Bir dosya seçerek başlayın.');
    if (input.current) input.current.value = '';
  }

  async function convert() {
    if (!file || busy) return;
    setError(''); setResult(null); setJob(null); setProgress(null); setBusy(true);
    const abort = new AbortController(); controller.current = abort;
    try {
      const params = new URLSearchParams({ format, quality: String(quality), width });
      const options = deviceOptions(params);
      if (mode === 'device') {
        setStatus('Cihazınızda dönüştürülüyor…');
        const instance = new Worker(new URL('./image.worker.ts', import.meta.url), { type: 'module' });
        worker.current = instance;
        const converted = await new Promise<ImageResult>((resolve, reject) => {
          let timer: ReturnType<typeof setTimeout>;
          const cleanup = () => { clearTimeout(timer); abort.signal.removeEventListener('abort', cancel); instance.onmessage = null; instance.onerror = null; };
          const fail = (error: Error) => { cleanup(); reject(error); };
          const cancel = () => fail(new DOMException('İptal edildi', 'AbortError'));
          const resetTimer = () => {
            clearTimeout(timer);
            timer = setTimeout(() => fail(new Error('Bir görüntünün işlenmesi 30 saniye sınırını aştı. Daha küçük bir dosya deneyin.')), 30_000);
          };
          instance.onmessage = ({ data }) => {
            if (data.progress) {
              setProgress(data.progress); setStatus(`${data.progress.completed}/${data.progress.total} görüntü hazır. ZIP arşivi oluşturuluyor…`); resetTimer();
            } else { cleanup(); data.error ? reject(new Error(data.error)) : resolve(data); }
          };
          instance.onerror = () => fail(new Error('Görüntü işçisi başlatılamadı.'));
          abort.signal.addEventListener('abort', cancel, { once: true });
          resetTimer();
          try { instance.postMessage({ files, options }); } catch (error) { fail(error as Error); }
        });
        setResult(converted); setStatus('Dönüşüm tamamlandı. Dosyanız cihazınızda kaldı.');
      } else {
        const source = new Uint8Array(await file.arrayBuffer());
        if (format === 'bmp' || format === 'ico' || !['image/png', 'image/jpeg'].includes(deviceImageHeader(source).mime)) throw new Error('Bu biçim yalnızca cihazda dönüşümde desteklenir.');
        imageHeader(source);
        setStatus('Sunucuya yükleniyor…');
        await responseJson(await fetch('/api/session', { method: 'POST', signal: abort.signal }));
        let current = await responseJson<Job>(await fetch(`/api/jobs?${params}`, {
          method: 'POST', body: file, signal: abort.signal,
          headers: { 'Content-Type': 'application/octet-stream', 'Idempotency-Key': crypto.randomUUID() },
        }));
        setJob(current);
        const deadline = Date.now() + 180_000;
        while (!['succeeded', 'failed', 'deleted', 'expired'].includes(current.state)) {
          if (Date.now() > deadline) throw new Error('İşlem beklenenden uzun sürdü. Dosyanızı sunucudan silebilirsiniz.');
          setStatus(stateNames[current.state] ?? current.state);
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(done, 800);
            function done() { abort.signal.removeEventListener('abort', canceled); resolve(); }
            function canceled() { clearTimeout(timer); reject(new DOMException('İptal edildi', 'AbortError')); }
            abort.signal.addEventListener('abort', canceled, { once: true });
          });
          current = await responseJson<Job>(await fetch(`/api/jobs/${current.id}`, { signal: abort.signal }));
          setJob(current);
        }
        if (current.state !== 'succeeded') throw new Error('Görüntü işlenemedi. Geçerli, animasyonsuz bir PNG veya JPEG deneyin.');
        const download = await fetch(`/api/jobs/${current.id}/download`, { signal: abort.signal });
        if (!download.ok) await responseJson(download);
        setResult({ kind: 'image', name: imageOutputName(file.name, format), blob: await download.blob(), width: current.output_width!, height: current.output_height! });
        setStatus('Dönüşüm tamamlandı. Sunucu kopyaları 24 saat sonra erişime kapanır ve otomatik temizlenir.');
      }
    } catch (e) {
      setProgress(null);
      if ((e as Error).name === 'AbortError') setStatus(mode === 'device' ? 'İşlem durduruldu. Kısmi çıktı oluşturulmadı; yeniden başlatabilirsiniz.' : 'İşlem durduruldu. Varsa sunucu dosyasını aşağıdan silebilirsiniz.');
      else {
        setStatus('İşlem tamamlanamadı. Ayarları kontrol edip yeniden deneyin.');
        setError(e instanceof TypeError ? 'Bağlantı kurulamadı. Sunucu oturumunuzu ve internet bağlantınızı kontrol edin.' : (e as Error).message);
      }
    } finally {
      worker.current?.terminate(); worker.current = null; controller.current = null; setBusy(false);
    }
  }
  async function removeServerCopy() {
    if (!job) return;
    try {
      const response = await fetch(`/api/jobs/${job.id}`, { method: 'DELETE' });
      if (!response.ok && response.status !== 410) await responseJson(response);
      setJob(null); setStatus('Sunucu kopyaları silindi. İndirdiğiniz dosya cihazınızda kalır.');
    } catch (e) { setError((e as Error).message); }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="Converter MCE ana sayfa"><span className="brand-mark">↔</span><span>converter<span className="brand-suffix">mce</span></span></a>
      <p className="nav-caption">ÇALIŞMA ALANI</p>
      <nav aria-label="Araç kategorileri">{([['image', '▧', 'Görüntü araçları'], ['pdf', '▤', 'PDF ve belgeler'], ['table', '▦', 'Excel ve veri'], ['audio', '♫', 'Ses araçları'], ['video', '▷', 'Video araçları']] as const).map(([id, icon, name]) => <a key={id} href="#workspace" className={tool === id ? 'nav-active' : ''} aria-current={tool === id ? 'page' : undefined} onClick={e => { if (busy) e.preventDefault(); else setTool(id); }}><span>{icon}</span>{name}{tool === id && <span className="nav-dot" />}</a>)}
      </nav>
      <div className="sidebar-note"><span>◇</span><strong>Dosyalarınız size ait.</strong><p>Cihazda işleme modunda dosyanız sunucuya gönderilmez.</p></div>
      <div className="sidebar-bottom"><span className="avatar">M</span><div>Herkes için ücretsiz<small>İlk geliştirme sürümü</small></div></div>
    </aside>
    <main id="workspace">
      <header><span>Araçlar <span className="breadcrumb">/</span> {{ image: 'Görüntü dönüştürücü', pdf: 'PDF araçları', table: 'Excel ve veri', audio: 'Ses araçları', video: 'Video araçları' }[tool]}</span><span className="free-badge">● Ücretsiz</span></header>
      <div className="workspace-content">
        <div className="intro"><span className="eyebrow">DAHA AZ UĞRAŞ, DAHA FAZLA İMKÂN</span><h1>Dosyalarına yeni<br />bir biçim ver<span>.</span></h1><p>Dosyanı seç, dönüştür ve indir.<br />Ücretsiz araçlar doğrudan cihazında çalışır.</p></div>
        <div className="tool-tabs" role="group" aria-label="Dönüştürme aracı">{([['image', 'Görüntü'], ['pdf', 'PDF'], ['table', 'Excel / Veri'], ['audio', 'Ses'], ['video', 'Video']] as const).map(([id, label]) => <button key={id} disabled={busy} aria-pressed={tool === id} onClick={() => setTool(id)}>{label}</button>)}</div>
        <Suspense fallback={<p role="status" className="field-hint">Araç hazırlanıyor…</p>}>
        {tool === 'audio' || tool === 'video' ? <MediaTools kind={tool} key={tool} /> : tool !== 'image' ? <DocumentTools kind={tool} key={tool} /> : <>
        <div className="workspace-grid">
          <section className="file-panel" aria-labelledby="file-title">
            <div className="panel-heading"><h2 id="file-title"><span className="step">01</span> Dosyanı ekle</h2><span className="muted">PNG · JPG · WebP · BMP · GIF</span></div>
            <input ref={input} id="file-input" aria-label="Görüntü dosyası seç" aria-describedby="image-input-hint" type="file" accept={imageAccept} multiple={mode === 'device'} disabled={busy} onChange={(e) => void selectFiles(e.target.files)} />
            <div className={`dropzone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); void selectFiles(e.dataTransfer.files); }}>
              {preview ? <img className="source-preview" src={preview} alt="Seçilen görüntünün önizlemesi" /> : <div className="upload-symbol">↑</div>}
              <strong>{files.length > 1 ? `${files.length} görüntü seçildi` : file ? file.name : 'Dosyalarını buraya bırak'}</strong><p>{file ? sizes(files.reduce((size, item) => size + item.size, 0)) : 'veya cihazından fotoğraflar seç'}</p>
              <button className="button-secondary" disabled={busy} onClick={() => input.current?.click()}>{file ? 'Dosyaları değiştir' : 'Dosya seç'} <span aria-hidden="true">→</span></button>
              <small id="image-input-hint">Dosya başına 10 MB · 8 megapiksel<br />En fazla 20 dosya · Toplam 30 MB</small>
            </div>
            {files.length > 1 && <ul className="file-list image-file-list" aria-label="Seçilen görüntüler">{files.map((item, index) => <li key={index}><span>{item.name}<small>{sizes(item.size)}</small></span><button className="button-icon" aria-label={`${index + 1}. görüntüyü kaldır`} disabled={busy} onClick={() => removeFile(index)}>Kaldır</button></li>)}</ul>}
            <div className="privacy-strip"><span>◇</span><p>{mode === 'device' ? 'Bu dosya cihazında işlenecek. Yükleme yapılmaz.' : 'Sunucu kopyaları 24 saat saklanır ve otomatik temizlenir.'}</p></div>
          </section>
          <section className="settings-panel" aria-labelledby="settings-title">
            <div className="panel-heading"><h2 id="settings-title"><span className="step">02</span> Çıktını ayarla</h2></div>
            <fieldset disabled={busy}><legend className="sr-only">Dönüştürme seçenekleri</legend>
              <label className="field-label" htmlFor="format">Hedef biçim</label>
              <div className="format-options" id="format">{deviceFormats.map((item) => <button key={item} type="button" aria-pressed={format === item} className={format === item ? 'selected' : ''} onClick={() => { setFormat(item); invalidate(); }}>{item === 'jpeg' ? 'JPG' : item.toUpperCase()}</button>)}</div>
              <div className="quality-heading"><label className="field-label" htmlFor="quality">Görüntü kalitesi</label><span>{['png', 'bmp', 'ico'].includes(format) ? 'Kayıpsız kodlama' : `${quality}%`}</span></div>
              <input id="quality" type="range" min="10" max="95" value={quality} disabled={['png', 'bmp', 'ico'].includes(format)} onChange={(e) => { setQuality(Number(e.target.value)); invalidate(); }} />
              <div className="range-labels"><span>Daha küçük dosya</span><span>Daha yüksek kalite</span></div>
              <label className="field-label" htmlFor="width">En fazla genişlik <span className="optional">isteğe bağlı</span></label><div className="width-field"><input id="width" type="number" min="1" max="4096" placeholder="Orijinal boyut" value={width} onChange={(e) => { setWidth(e.target.value); invalidate(); }} /><span>px</span></div>
              <p className="field-hint">En-boy oranı korunur. Küçük görseller büyütülmez.</p>
              {serverAuth !== 'unconfigured' ? <><label className="field-label" htmlFor="mode">İşleme yöntemi</label><select id="mode" value={mode} onChange={(e) => { setMode(e.target.value as 'device' | 'cloud'); invalidate(); }}><option value="device">Cihazımda · özel ve hızlı</option><option value="cloud" disabled={files.length > 1}>Sunucuda · 5 ücretsiz iş / gün</option></select></> : <p className="field-hint">Ücretsiz sürümde dosyalarınız cihazınızda dönüştürülür.</p>}
              <p className="field-hint">Birden fazla görüntü aynı ayarlarla sırayla işlenir ve tek ZIP olarak indirilir. ZIP sınırı 50 MB; gerekirse genişliği azaltın.</p>
              {mode === 'cloud' && serverAuth === 'access' && <a className="text-button" href="/api/login">Sunucu için güvenli oturum aç →</a>}
              <p className="field-hint">{format === 'jpeg' || format === 'bmp' ? 'JPG ve BMP saydamlığı desteklemez; arka plan beyaz olur.' : format === 'ico' ? 'ICO tek görüntü içerir; en fazla 256×256 piksel. Saydamlık korunur.' : 'Dönüşümde EXIF ve diğer kaynak metadata kaldırılır.'} Animasyonlu GIF/WebP desteklenmez.</p>
            </fieldset>
            <button className="button-primary" aria-label={busy ? 'İşleniyor' : 'Dönüştür'} onClick={() => void convert()} disabled={!file || busy}>{busy ? 'İşleniyor…' : 'Dönüştür'}<span aria-hidden="true">→</span></button>
            {busy && <button className="text-button" onClick={() => controller.current?.abort()}>Beklemeyi durdur</button>}
          </section>
        </div>
        <section className="result-panel" aria-labelledby="result-title"><div><span className="eyebrow">SONUÇ</span><h2 id="result-title">{result ? 'Yeni dosyan hazır.' : 'Bir sonraki biçimi burada.'}</h2><p role="status" aria-live="polite">{status}</p>{error && <p role="alert" className="error">{error}</p>}
          {progress && busy && <progress aria-label="Toplu dönüşüm ilerlemesi" max={progress.total} value={progress.completed}>{progress.completed}/{progress.total}</progress>}
          {result && <p className="result-meta">{sizes(result.blob.size)} · {result.kind === 'archive' ? `${result.count} dosya · ZIP` : `${result.width} × ${result.height} px · ${format.toUpperCase()}`}</p>}
          {job && !busy && <button className="text-button" onClick={() => void removeServerCopy()}>Sunucu kopyalarını şimdi sil</button>}</div>
          {resultUrl && result ? <div className="result-actions">{result.kind === 'image' && <img src={resultUrl} alt="Dönüştürülmüş görüntünün önizlemesi" />}<a className="button-primary" href={resultUrl} download={result.name}>{result.kind === 'archive' ? 'ZIP dosyasını indir' : 'Dosyayı indir'} <span aria-hidden="true">↓</span></a></div> : <div className="result-placeholder" aria-hidden="true">→</div>}
        </section>
        </>}
        </Suspense>
        <footer><span>Converter MCE <span className="footer-dot">·</span> Dosyalarınla özgürce çalış.</span><a href="/THIRD-PARTY-NOTICES.txt" target="_blank" rel="noopener noreferrer">Açık kaynak lisansları</a><span>Cihazda ücretsiz dönüşüm</span></footer>
      </div>
    </main>
  </div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
