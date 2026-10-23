import React, { useEffect, useRef, useState } from 'react';
import { createLocalRunner, type LocalResult } from './local-tools';
import { imageAccept } from '../shared/device-image';

export function DocumentTools({ kind }: { kind: 'pdf' | 'table' }) {
  const [files, setFiles] = useState<File[]>([]);
  const [operation, setOperation] = useState('merge');
  const [selection, setSelection] = useState('');
  const [rotation, setRotation] = useState('0');
  const [format, setFormat] = useState('xlsx');
  const [delimiter, setDelimiter] = useState(',');
  const [sheets, setSheets] = useState<string[]>([]);
  const [sheet, setSheet] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Dosyanızı seçin. Tüm işlemler cihazınızda yapılır.');
  const [error, setError] = useState('');
  const [result, setResult] = useState<LocalResult | null>(null);
  const [url, setUrl] = useState('');
  const abort = useRef<AbortController | null>(null);
  const [runner] = useState(createLocalRunner);
  useEffect(() => () => { abort.current?.abort(); runner.dispose(); }, [runner]);
  useEffect(() => {
    if (!result) { setUrl(''); return; }
    const next = URL.createObjectURL(result.blob); setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [result]);
  function invalidate() { setResult(null); setError(''); }
  async function choose(selected: File[]) {
    invalidate(); setFiles([]); setSheets([]); setSheet('');
    if (!selected.length) return;
    if (kind === 'pdf' && (selected.length > 8 || selected.some(f => (operation !== 'images' && !f.name.toLowerCase().endsWith('.pdf')) || f.size > 10 * 1024 * 1024) || selected.reduce((n, f) => n + f.size, 0) > 20 * 1024 * 1024)) { setError('En fazla 8 dosya; dosya başına 10 MB, toplam 20 MB seçin.'); return; }
    if (kind === 'table' && (selected.length !== 1 || selected[0].size > 5 * 1024 * 1024 || !/\.(xlsx|csv|tsv|json|jsonl|ndjson)$/i.test(selected[0].name))) { setError('En fazla 5 MB bir XLSX, CSV, TSV, JSON, JSONL veya NDJSON seçin.'); return; }
    setFiles(selected); setStatus('Dosya hazır. Seçenekleri ayarlayın.');
    if (kind === 'table' && /\.xlsx$/i.test(selected[0].name)) {
      const controller = new AbortController(); abort.current = controller; setBusy(true); setStatus('Excel sayfaları cihazınızda inceleniyor…');
      try {
        const value = await runner.run<{ sheets: string[] }>({ kind: 'sheets', file: selected[0] }, controller.signal);
        setSheets(value.sheets); setSheet(value.sheets[0] ?? ''); setStatus('Çalışma sayfasını ve çıktı biçimini seçin.');
      } catch (e) { setError((e as Error).message); setFiles([]); }
      finally { setBusy(false); abort.current = null; }
    }
  }
  async function convert() {
    if (!files.length || busy) return;
    invalidate(); setBusy(true); setStatus('Cihazınızda işleniyor…');
    const controller = new AbortController(); abort.current = controller;
    try {
      const request = kind === 'pdf'
        ? { kind: 'pdf' as const, files, operation, selection, rotation: Number(rotation) }
        : { kind: 'table' as const, file: files[0], format, sheet, delimiter };
      setResult(await runner.run<LocalResult>(request, controller.signal));
      setStatus('İşlem tamamlandı. Dosyalarınız sunucuya gönderilmedi.');
    } catch (e) {
      if ((e as Error).name === 'AbortError') setStatus('İşlem durduruldu.');
      else setError((e as Error).message);
    } finally { setBusy(false); abort.current = null; }
  }
  function move(index: number, change: number) {
    const next = [...files]; [next[index], next[index + change]] = [next[index + change], next[index]];
    setFiles(next); invalidate();
  }
  return <>
    <div className="workspace-grid">
      <section className="file-panel" aria-labelledby="document-file-title">
        <div className="panel-heading"><h2 id="document-file-title"><span className="step">01</span> Dosyanı ekle</h2></div>
        <label className="field-label" htmlFor="document-input">{kind === 'pdf' ? operation === 'images' ? 'PDF için görseller seç' : 'PDF dosyaları seç' : 'Tablo dosyası seç'}</label>
        <input className="document-input" id="document-input" type="file" accept={kind === 'pdf' ? operation === 'images' ? imageAccept : '.pdf,application/pdf' : '.csv,.tsv,.json,.jsonl,.ndjson,.xlsx'} multiple={kind === 'pdf' && ['merge', 'images'].includes(operation)} disabled={busy} onChange={e => void choose(Array.from(e.target.files ?? []))} />
        <p className="field-hint">{kind === 'pdf' ? 'En fazla 8 dosya · Dosya başına 10 MB · Toplam 20 MB · Çıktı en fazla 200 sayfa' : 'En fazla 5 MB · 100 sütun · 10.000 veri satırı · Başlıklar dahil 50.000 hücre'}</p>
        <ol className="file-list">{files.map((file, index) => <li key={`${index}-${file.name}`}><span>{file.name}<small>{(file.size / 1024).toFixed(1)} KB</small></span>{kind === 'pdf' && <div><button className="button-icon" disabled={busy || index === 0} aria-label={`${file.name} yukarı taşı`} onClick={() => move(index, -1)}>↑</button><button className="button-icon" disabled={busy || index === files.length - 1} aria-label={`${file.name} aşağı taşı`} onClick={() => move(index, 1)}>↓</button></div>}</li>)}</ol>
        <div className="privacy-strip"><span>◇</span><p>Dosyalar bu cihazda işlenir. Buluta yükleme ve günlük dönüşüm kotası yoktur.</p></div>
      </section>
      <section className="settings-panel" aria-labelledby="document-settings-title">
        <div className="panel-heading"><h2 id="document-settings-title"><span className="step">02</span> İşlemini ayarla</h2></div>
        <fieldset disabled={busy}>
          <legend className="sr-only">Belge dönüştürme seçenekleri</legend>
          {kind === 'pdf' ? <>
            <label className="field-label" htmlFor="pdf-operation">PDF işlemi</label>
            <select id="pdf-operation" value={operation} onChange={e => { const next = e.target.value; if (next === 'images' || operation === 'images') setFiles([]); setOperation(next); invalidate(); }}><option value="merge">PDF birleştir</option><option value="extract">Sayfa çıkar ve sırala</option><option value="rotate">Sayfaları döndür</option><option value="images">Görsellerden PDF oluştur</option></select>
            {operation === 'images' && <p className="field-hint">Her görsel ayrı bir A4 sayfasına oranı korunarak yerleşir. Toplam en fazla 16 megapiksel; animasyon desteklenmez.</p>}
            {!['merge', 'images'].includes(operation) && <><label className="field-label spaced-label" htmlFor="pdf-pages">Sayfa seçimi</label><input className="text-input" id="pdf-pages" value={selection} placeholder="1,3-5 · boş bırakırsanız tümü" onChange={e => { setSelection(e.target.value); invalidate(); }} /><p className="field-hint">Tek PDF seçin. Sayfalar yazdığınız sırayla yeni PDF'e kopyalanır.</p></>}
            <label className="field-label spaced-label" htmlFor="pdf-rotation">Saat yönünde döndür</label><select id="pdf-rotation" value={rotation} onChange={e => { setRotation(e.target.value); invalidate(); }}>{[0, 90, 180, 270].map(v => <option value={v} key={v}>{v}°</option>)}</select>
            <p className="field-hint">Şifreli PDF'ler, etkileşimli formlar ve imza alanları desteklenmez. Yeni PDF, kaynak belgenin dijital imzasını veya belge düzeyindeki özelliklerini korumaz. Orijinal dosyanız değiştirilmez.</p>
          </> : <>
            <label className="field-label" htmlFor="table-format">Tablo çıktı biçimi</label><select id="table-format" value={format} onChange={e => { setFormat(e.target.value); invalidate(); }}>{['xlsx', 'csv', 'tsv', 'json', 'jsonl', 'ndjson', 'html', 'md'].map(v => <option value={v} key={v}>{v === 'md' ? 'Markdown (.md)' : v.toUpperCase()}</option>)}</select>
            {!!sheets.length && <><label className="field-label spaced-label" htmlFor="table-sheet">Excel çalışma sayfası</label><select id="table-sheet" value={sheet} onChange={e => { setSheet(e.target.value); invalidate(); }}>{sheets.map(v => <option key={v}>{v}</option>)}</select></>}
            <label className="field-label spaced-label" htmlFor="table-delimiter">CSV ayırıcı</label><select id="table-delimiter" value={delimiter} onChange={e => { setDelimiter(e.target.value); invalidate(); }}><option value=",">Virgül (,)</option><option value=";">Noktalı virgül (;)</option><option value={'\t'}>Sekme</option><option value="|">Dikey çizgi (|)</option></select>
            <p className="field-hint">İlk satır benzersiz sütun başlıklarıdır. CSV/TSV değerleri metin olarak okunur. JSON, düz nesnelerden oluşan bir dizi; JSONL/NDJSON her satırda bir nesne olmalıdır. HTML ve Markdown yalnızca çıktı olarak desteklenir. Yalnızca seçilen Excel sayfasının hücre değerleri aktarılır; stil, grafik ve bağlantılar korunmaz. Formüllü hücreler reddedilir. Tarihler ISO metnine çevrilir. CSV/TSV çıktısında formül gibi başlayan metinlere güvenlik için tek tırnak eklenir.</p>
          </>}
        </fieldset>
        <button className="button-primary" disabled={busy || !files.length} onClick={() => void convert()}>{busy ? 'İşleniyor…' : 'Dönüştür'}<span aria-hidden="true">→</span></button>
        {busy && <button className="text-button" onClick={() => abort.current?.abort()}>İşlemi durdur</button>}
      </section>
    </div>
    <section className="result-panel" aria-labelledby="document-result-title"><div><span className="eyebrow">SONUÇ</span><h2 id="document-result-title">{result ? 'Yeni dosyan hazır.' : 'Yeni belgen burada.'}</h2><p role="status" aria-live="polite">{status}</p>{error && <p role="alert" className="error">{error}</p>}{result && <p className="result-meta">{result.detail} · {(result.blob.size / 1024).toFixed(1)} KB</p>}</div>{result && url && <a className="button-primary" href={url} download={result.name}>Dosyayı indir <span>↓</span></a>}</section>
  </>;
}
