import React, { useEffect, useRef, useState } from 'react';
import { convertAudio, convertVideo, videoMime } from './media';
import type { LocalResult } from './local-tools';

export function MediaTools({ kind }: { kind: 'audio' | 'video' }) {
  const [file, setFile] = useState<File | null>(null), [start, setStart] = useState('0'), [end, setEnd] = useState('');
  const [rate, setRate] = useState('44100'), [gain, setGain] = useState(100), [width, setWidth] = useState('640');
  const [audioFormat, setAudioFormat] = useState<'wav' | 'mp3'>('wav');
  const [busy, setBusy] = useState(false), [status, setStatus] = useState('Dosyanızı seçin. İşlem cihazınızda yapılır.'), [error, setError] = useState('');
  const [result, setResult] = useState<LocalResult | null>(null), [url, setUrl] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!result) { setUrl(''); return; }
    const next = URL.createObjectURL(result.blob); setUrl(next); return () => URL.revokeObjectURL(next);
  }, [result]);
  const supported = kind === 'audio' ? typeof AudioContext !== 'undefined' : typeof AudioContext !== 'undefined' && !!videoMime();
  function invalidate() { setResult(null); setError(''); }
  async function convert() {
    if (!file || busy) return;
    invalidate(); setBusy(true); setStatus('Medya cihazınızda açılıyor…');
    const abort = new AbortController(); controller.current = abort;
    try {
      const last = end.trim() ? Number(end) : undefined;
      const value = kind === 'audio'
        ? await convertAudio(file, Number(start), last, Number(rate), gain / 100, abort.signal, audioFormat)
        : await convertVideo(file, Number(start), last, Number(width), abort.signal, setStatus);
      setResult(value); setStatus('İşlem tamamlandı. Dosyanız sunucuya gönderilmedi.');
    } catch (e) {
      if ((e as Error).name === 'AbortError') setStatus('İşlem durduruldu.');
      else setError((e as Error).message);
    } finally { controller.current = null; setBusy(false); }
  }
  return <>
    <div className="workspace-grid">
      <section className="file-panel" aria-labelledby="media-file-title"><div className="panel-heading"><h2 id="media-file-title"><span className="step">01</span> Dosyanı ekle</h2></div>
        <label className="field-label" htmlFor="media-input">{kind === 'audio' ? 'Ses dosyası seç' : 'Video dosyası seç'}</label>
        <input className="document-input" id="media-input" disabled={busy} type="file" accept={kind === 'audio' ? '.mp3,.wav,.m4a,.aac,.ogg,.oga,.flac,.webm' : '.mp4,.mov,.webm,.mkv'} onChange={e => { setFile(e.target.files?.[0] ?? null); invalidate(); }} />
        {file && <p className="media-filename">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p>}
        <p className="field-hint">{kind === 'audio' ? 'Kaynak en fazla 10 MB · 120 saniye · 2 kanal. Giriş biçiminin tarayıcınızda çözülebilmesi gerekir.' : 'Kaynak en fazla 25 MB · 60 saniye · 1920×1080 piksel. Codec desteği tarayıcıya bağlıdır.'}</p>
        <div className="privacy-strip"><span>◇</span><p>Yükleme yapılmaz. Dönüşüm cihazınızın işlemci ve belleğini kullanır.</p></div>
      </section>
      <section className="settings-panel" aria-labelledby="media-settings-title"><div className="panel-heading"><h2 id="media-settings-title"><span className="step">02</span> Çıktını ayarla</h2></div>
        <fieldset disabled={busy}><legend className="sr-only">Medya seçenekleri</legend>
          {kind === 'audio' ? <><label className="field-label" htmlFor="audio-format">Ses çıktı biçimi</label><select id="audio-format" value={audioFormat} onChange={e => { setAudioFormat(e.target.value as 'wav' | 'mp3'); invalidate(); }}><option value="wav">WAV · PCM 16 bit</option><option value="mp3">MP3 · 192 kbps</option></select></> : <p className="field-label">Çıktı: WebM / en fazla 24 fps</p>}
          <label className="field-label spaced-label" htmlFor="media-start">Başlangıç (saniye)</label><input className="text-input" id="media-start" type="number" min="0" step="0.1" value={start} onChange={e => { setStart(e.target.value); invalidate(); }} />
          <label className="field-label spaced-label" htmlFor="media-end">Bitiş (saniye, isteğe bağlı)</label><input className="text-input" id="media-end" type="number" min="0" step="0.1" value={end} placeholder="Dosyanın sonuna kadar" onChange={e => { setEnd(e.target.value); invalidate(); }} />
          {kind === 'audio' ? <>
            <label className="field-label spaced-label" htmlFor="audio-rate">Örnekleme hızı</label><select id="audio-rate" value={rate} onChange={e => { setRate(e.target.value); invalidate(); }}><option value="44100">44.100 Hz</option><option value="48000">48.000 Hz</option></select>
            <label className="field-label spaced-label" htmlFor="audio-gain">Ses seviyesi: {gain}%</label><input id="audio-gain" type="range" min="0" max="200" value={gain} onChange={e => { setGain(Number(e.target.value)); invalidate(); }} />
            <p className="field-hint">{audioFormat === 'wav' ? 'WAV sıkıştırmasızdır; çıktı büyüyebilir.' : 'MP3 kayıplı sıkıştırır; kodlayıcı gecikmesi süreye küçük bir fark ekleyebilir.'} Sıkıştırılmış kaynakta kaybolan kalite geri gelmez. %100 üzeri seviyeler kırpılma ve bozulma oluşturabilir. Kaynak metadata aktarılmaz.</p>
          </> : <>
            <label className="field-label spaced-label" htmlFor="video-width">Video en fazla genişlik</label><input className="text-input" id="video-width" type="number" min="64" max="1280" value={width} onChange={e => { setWidth(e.target.value); invalidate(); }} />
            <p className="field-hint">Görüntü yeniden kodlanır; ses Opus olarak aktarılır. HDR, altyazılar, ek ses kanalları ve metadata korunmaz. İşlem yaklaşık klip süresi kadar sürer. Sekmeyi açık tutun; ağır cihaz yükünde kare kaybı olabilir. Kayıpsız veya kare hassasiyetli kesim değildir.</p>
          </>}
        </fieldset>
        {!supported && <p className="error" role="alert">Bu tarayıcı bu medya çıktısını desteklemiyor. Güncel Chrome veya Edge deneyin.</p>}
        <button className="button-primary" disabled={!supported || !file || busy} onClick={() => void convert()}>{busy ? 'İşleniyor…' : 'Dönüştür'}<span aria-hidden="true">→</span></button>
        {busy && <button className="text-button" onClick={() => controller.current?.abort()}>İşlemi durdur</button>}
      </section>
    </div>
    <section className="result-panel" aria-labelledby="media-result-title"><div><span className="eyebrow">SONUÇ</span><h2 id="media-result-title">{result ? 'Yeni dosyan hazır.' : 'Yeni medyan burada.'}</h2><p role="status" aria-live="polite">{status}</p>{error && <p role="alert" className="error">{error}</p>}{result && <p className="result-meta">{result.detail} · {(result.blob.size / 1024).toFixed(1)} KB</p>}</div>{result && url && <div className="media-result">{kind === 'audio' ? <audio controls src={url} aria-label="Dönüştürülmüş ses" /> : <video controls playsInline src={url} aria-label="Dönüştürülmüş video" />}<a className="button-primary" href={url} download={result.name}>Dosyayı indir <span>↓</span></a></div>}</section>
  </>;
}
