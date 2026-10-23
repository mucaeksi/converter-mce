# Cihazda dönüşüm performansı

23 Ekim 2026 güncellemesi. Workers Free planı korunur; dosyalar sunucuya yüklenmez.

| Ölçüm | Önce | Sonra | Fark |
|---|---:|---:|---:|
| İlk ana JavaScript dosyası | 267.858 bayt | 240.101 bayt | %10,4 daha küçük |
| Panel açılışı + 1.000 satır CSV→JSON için istenen JS | 1.236.753 bayt | 288.912 bayt | %76,6 daha küçük |
| Aynı dosyaların gzip tahmini | 354.472 bayt | 95.441 bayt | %73,1 daha küçük |
| Excel dışındaki tablo modülü | 967.240 bayt | 37.247 bayt | %96,1 daha küçük |

Bu rakamlar birim test varsayımı değil, Chromium'un gerçekten istediği JS
yanıtlarının gövde boyutudur. Gzip aynı zlib ayarıyla yerelde hesaplanır; sunucunun
Brotli/gzip ağ aktarımı veya CPU hızlanma yüzdesi değildir. Yeni lisans bağlantısı
gibi sonraki küçük UI değişiklikleri ana dosyaya birkaç bayt ekleyebilir.

Ölçüm aynı makinede, temiz tarayıcı bağlamında, aynı iki sütunlu 1.000 satır veriyle
yapıldı. Tek soğuk çalıştırmada tıklamadan sonuca süre 275→169 ms oldu; bu tek
örnekten cihazlar arası genel hızlanma veya p95 iddiası çıkarılmaz. Doğrulanabilir
kazanım yüklenmesi gerekmeyen kodun ve yinelenen işlemlerin kaldırılmasıdır.

```sh
# Önce üretim web paketini derleyin ve yerel ücretsiz yapılandırmayı başlatın.
npm run build
npx wrangler dev --config wrangler.web.jsonc --ip 127.0.0.1 --port 8790
# Başka bir terminalde:
node scripts/measure-browser.mjs /tmp/converter-performance.json
```

- PDF ve medya panelleri ihtiyaç olduğunda yüklenir.
- ExcelJS yalnızca XLSX okuma/yazmada yüklenir. CSV/JSON/JSONL/HTML/Markdown bu
  motoru istemez; tarayıcı testi bunu gerçek istek listesiyle kontrol eder.
- Belge paneli açıkken aynı Web Worker tekrar kullanılır. Tek bir Excel çalışma
  kitabı SHA-256 içerik özetiyle önbelleğe alınır; dosya adı/boyutu kimlik olarak
  kullanılmaz. Aynı adlı farklı dosyaların sonuçları karışmaz.
- Panelden çıkınca, iptalde veya zaman aşımında worker kapanır ve dosya önbelleği
  serbest bırakılır. Başarısız işten sonra yeni dosyayla devam edilebilir.
- Ses kanal tamponları worker'a kopyalanmak yerine devredilir. Görüntü dosyası
  worker içinde okunur; ana iş parçacığında ek dönüştürme tamponu oluşturulmaz.
- JPEG/PNG/WebP dışındaki yeni görüntü işlemleri de 10 MB/8 MP, çıktılar 24 MB
  sınırını korur. ICO en fazla 256×256; görselden PDF toplam 16 MP sınırındadır.

MP3 kodlayıcısı yalnızca MP3 çıktısı istendiğinde yüklenir. LGPL kaynak arşivi,
build dosyaları ve lisansları `/vendor/` altında yayınlanır; bunlar uygulama
açılışında indirilmez. Kaynak commit'i ve SHA-256, `public/vendor/lamejs-source.json`
dosyasında kayıtlıdır. LAME kaynağı değiştirilmedi; uygulama kaynağı ve yeniden
derleme adımları bu depoda açıktır.
