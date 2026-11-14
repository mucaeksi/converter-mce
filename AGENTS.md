# YouTube Yöneticisi — ajan talimatları

Bu repo tek bir YouTube kanalının meta verisini (başlık, açıklama, etiket,
oynatma listeleri) yönetir. Kanal düzenlemesi istendiğinde önce
`.claude/skills/youtube-duzen/SKILL.md` dosyasını oku ve oradaki akışı izle.

## Kesin kurallar

- Kanalda değişiklik yapan her işlem (`islem=uygula`) kullanıcının o plan için
  verdiği açık onayla çalışır. Bir onay sonraki planları kapsamaz.
- Uygulamadan önce yedek alınır (iş akışı bunu otomatik yapar) ve her işlem
  `data/islemler/` altına önce/sonra değerleriyle kaydedilir.
- Video silme, gizlilik değiştirme ve yorum silme bu aracın kapsamında değil;
  istenirse ayrıca konuşulur.
- `YT_*` kimlik bilgileri yalnızca GitHub Secrets'ta durur. Değerleri isteme,
  yazdırma, dosyaya ya da commit'e koyma.
- Repo gizli değilse kanal verisi commit edilmez.
- Günlük API kotası 10.000 birim; bir yazma işlemi 50 birim. Büyük işleri
  günlere bölünmüş planlara ayır.

## Komutlar

| Ne | Komut |
| --- | --- |
| Planı çevrimdışı doğrula | `python3 scripts/yt.py dogrula planlar/X.json` |
| Yedek / önizleme / uygulama | GitHub Actions → `YouTube` iş akışı (`yedek`, `onizle`, `uygula`) |
| Kodu derleme kontrolü | `python3 -m py_compile scripts/*.py` |
