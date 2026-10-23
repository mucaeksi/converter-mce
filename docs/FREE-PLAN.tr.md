# Ücretsiz Cloudflare planı

Kullanıcı kararı: Cloudflare Workers Free planında kalınacak. Ücretli plana geçiş
veya ücretli dönüşüm motoru etkinleştirilmez. Varsayılan `npm run deploy` komutu
`wrangler.web.jsonc` ile ücretsiz cihazda dönüşüm sürümünü yayınlar.

23 Ekim 2026 tarihinde resmi belgelerden kontrol edilen sınırlar:

| Bileşen | Ücretsiz kullanım | Bu projedeki karar |
|---|---|---|
| Workers Static Assets | Statik dosya istekleri ücretsiz ve sınırsız | Panel, JS/CSS ve cihazda çalışan codec dosyaları burada sunulur |
| Workers Free | Hesap genelinde günlük 100.000 dinamik istek; çağrı başına 10 ms CPU, 128 MB bellek | Yalnızca küçük API/capabilities yanıtları; ağır dönüşüm burada yapılmaz |
| Cloudflare Containers | Workers Free kapsamında değil | Üretimde kullanılmaz |
| R2 Standard ücretsiz kotası | Aylık 10 GB-ay, 1 milyon A ve 10 milyon B sınıfı işlem | Kota aşımı ücretlenebilir; mevcut web sürümü R2'ye dosya yazmaz |

Statik istekler önce asset hizmetine gider. Yalnızca `/api/*` ve `/.well-known/*`
Worker'a yönlendirilir; statik dosyalara güvenlik başlıklarını `public/_headers`
ekler. Böylece panel dosyaları gereksiz yere Worker istek kotasını tüketmez.
Günlük Worker kotası hesapta diğer projelerle paylaşılır; 100.000 kullanıcı veya
100.000 dönüşüm anlamına gelmez. Kota dolduğunda dinamik istekler hata verebilir;
otomatik ücretli plana geçiş yapılmaz.

Webde dönüşüm Web Worker, tarayıcı codec'leri ve gerektiğinde ölçülmüş WASM
modülleriyle cihazda; Android'de platform codec'leri ve yerel kütüphanelerle
çalışır. Mevcut web kapsamı PNG/JPEG → JPEG/PNG/WebP, Android kapsamı
PNG/JPEG → JPEG/PNG/WebP; dosya başına 10 MB ve 8 MP sınırıdır. Cihaz dönüşümlerinde
günlük sunucu işi kotası uygulanmaz; cihaz kaynak sınırları geçerlidir.

Web araçları: PDF birleştirme, sayfa çıkarma/sıralama/döndürme;
CSV/TSV/JSON/XLSX değer dönüşümü ve Excel sayfa seçimi; tarayıcının çözebildiği
sesten WAV üretme/kesme/seviye ayarı; desteklenen kısa videodan WebM üretme,
kesme ve boyutlandırma. Ses kaynak sınırı 10 MB/120 saniye/2 kanal; video
25 MB/60 saniye/1920×1080 pikseldir. Video kayıplı ve gerçek zamanlıdır; ağır
cihaz yükünde kare kaybı olabilir. PDF ve tablo sınırları arayüzde gösterilir.
Android şu aşamada yalnızca görüntü araçlarını içerir. Codec, lisans, bellek ve mobil performans testleri
geçmeden format ilan edilmez. Büyük video, tam Office→PDF, ağır OCR ve üretken
AI işlemleri bu ücretsiz kapsam için garanti edilmez; desteklenmeyen işlem açıkça
gösterilir. Tarayıcıda çalışmayan iş gizlice sunucuya gönderilmez.

D1, özel R2 ve Queue daha önce oluşturuldu; mevcut yayına bağlı değiller.
`wrangler.jsonc`, sunucu kodu ve yerel sunucu testleri gelecekteki bir karar için
referans olarak tutulur; ücretsiz üretim mimarisinin etkin bileşenleri değildir.
Başka projelerin kaynakları veya hesapta önceden var olan R2 aboneliği değiştirilmez.
Reklam entegrasyonu ve Play Store yayını henüz yapılmadı; mağaza yayıncı hesabının
koşulları Cloudflare ücretsiz planından ayrıdır.

Kaynaklar:

- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/r2/pricing/
