# Converter MCE — ücretsiz, reklam destekli web ve Android ürün planı

Durum: Planlama taslağı. Kullanıcı tercihleri: başlangıçtan itibaren herkese açık hizmet; web paneli ve Play Store'da Android uygulaması; tamamen ücretsiz kullanım ve az sayıda reklam; GitHub yalnızca kaynak deposu, tüm sunucu altyapısı Cloudflare. Önceki abonelik/ücretli kredi ve bağımsız sunucu önerileri kaldırıldı. İlk görüntü dönüştürme uygulaması geliştirildi; canlı Cloudflare/Play Store yayını yapılmadı.

## 1. Ürün hedefi ve doğruluk sözleşmesi

Fotoğraf, video, ses, PDF, Office ve yapılandırılmış veri dosyaları için web paneli ve Android uygulaması: seç/yükle, incele, dönüştür, düzenle, önizle ve kaydet/indir. Toplu işlem ve tekrar kullanılabilir işlem reçeteleri ortak işlem sözleşmesini kullanır. Android'de desteklenen işlemler cihazda, kalanlar kullanıcıya belirtilerek sunucuda çalışır.

Her dosya türü her başka türe anlam korunarak çevrilemez. Panel desteklediği dönüşüm yönlerini ve kayıpları açıkça gösterir. Hedef, desteklenen işlemlerde ölçülebilir doğruluk ve öngörülebilir davranıştır; evrensel kusursuzluk iddiası değildir.

- Kayıpsız yeniden paketleme, kayıplı kodlama, içerik çıkarma, OCR ve üretken AI işlemleri farklı işlem sınıflarıdır.
- MP4→MP3 ses çıkarır; videodaki görüntüyü korumaz. Video→GIF sesi ve kimi zaman renk/kare bilgisini kaybeder.
- JPEG→PNG mevcut JPEG kaybını geri getirmez. PNG→JPEG saydamlık için arka plan rengi gerektirir.
- PDF→Excel yalnızca çıkarılabilen tabloları aktarır; orijinal çalışma kitabını veya formülleri geri getirmez.
- CSV birden fazla sayfa, stil ve formül davranışını koruyamaz. XLSX→CSV için sayfa ve formül/değer seçimi gerekir.
- PDF→DOCX mizanpajı ve yazı tiplerini birebir korumayabilir. Tarama önce OCR gerektirir.
- Müzik dosya biçimi dönüştürme ile caz→rock gibi müzik tarzı değiştirme farklı yeteneklerdir. Tarz değiştirme isteğe bağlı üretken AI modülüdür.
- Raster→SVG vektörleştirme yaklaşık sonuç verir. SVG→raster bir çizimin piksele işlenmesidir.
- İmzalı PDF'nin değiştirilmesi imza doğrulamasını bozabilir; kullanıcıya işlemden önce gösterilir.
- DRM kaldırma, şifre kırma ve makro çalıştırma sunulmaz. Kullanıcının bildiği dosya parolası kalıcı kaydedilmeden kullanılabilir.

## 2. Kapsam ve sürümler

| Alan | İlk genel beta | Sonraki genişleme | Temel sınır |
|---|---|---|---|
| Fotoğraf | JPEG, PNG, WebP, TIFF; yeniden boyutlandırma, kırpma, döndürme, sıkıştırma, filigran, EXIF yönetimi | AVIF, HEIC, RAW, SVG, animasyon, renk profilleri | Codec, lisans, bit derinliği ve renk profili desteği doğrulanır |
| Video | Yaygın MP4/MOV/MKV/WebM girişleri; doğrulanmış MP4/WebM çıktıları; kesme, ölçekleme, ses çıkarma, poster | Birleştirme, altyazı, gelişmiş filtreler, GPU, zaman çizelgesi | Kapsayıcı ve codec ayrı denetlenir; uzantı destek kanıtı değildir |
| Ses | MP3, WAV, FLAC, AAC/M4A, OGG; dönüştürme, kesme, ses seviyesi ve örnekleme ayarı | Gürültü azaltma, transkripsiyon, kanal ayırma, mastering | Format, codec, kanal ve bit derinliği kombinasyonları sınırlıdır |
| PDF | Birleştirme, bölme, sıralama, döndürme, görüntü↔PDF, metin çıkarma; desteklenen ofis dosyalarından PDF | Türkçe/İngilizce OCR, tablo çıkarma, form doldurma, gerçek redaksiyon | Sıkıştırma her dosyayı küçültmez; OCR ve düzen korunumu garanti edilmez |
| Office | DOCX/XLSX/PPTX→PDF; temel XLSX↔CSV/TSV; sayfa ve veri seçimi | ODT/ODS/ODP, eski DOC/XLS/PPT, tam belge editörü | Fontlar, gelişmiş formüller, dış bağlantılar ve grafikler farklı işlenebilir |
| Veri | CSV↔TSV↔JSON↔XLSX; açık şema, kodlama ve ayırıcı seçimi | JSONL, Parquet, XML; büyük dosya akışları | İç içe JSON düzleştirmesi ve tür çıkarımı kullanıcıya gösterilir |
| E-kitap/arşiv | İlk beta dışında | EPUB/Markdown/HTML, güvenli ZIP/7z işlemleri | Her format çifti desteklenmez; arşiv açma ayrı güvenlik sınırıdır |
| AI işlemleri | İlk beta dışında | Ses→metin, OCR iyileştirme, çeviri, arka plan silme, upscale, müzik tarzı | Açık izin, maliyet tahmini, model lisansı ve sağlayıcı koşulları gerekir |
| CAD/3D/GIS | İlk beta dışında | Talep ve test dosyalarıyla ayrı motor aileleri | Özel formatlar, ticari SDK'lar ve uzman doğrulaması gerekebilir |

Tablo hedef kapsamıdır; henüz çalıştığı doğrulanmış format listesi değildir. Ürün yalnızca gerçek işçi imajı üzerinde test edilmiş yönleri yayınlar. Bir kütüphanenin format desteklemesi otomatik ürün desteği sayılmaz.

## 3. Panel ve kullanıcı akışları

1. Ana sayfa: format ve işlem araması; örnekler; ücretsiz kullanım ve reklam açıklaması; destek sınırları. Türkçe ve İngilizce arayüz.
2. Çalışma alanı: sürükle-bırak, çoklu dosya, büyük dosyada devam edebilir yükleme; gerçek dosya türü ve boyut analizi.
3. İşlem seçimi: yalnızca uyumlu hedefler, hazır kalite profilleri ve gelişmiş ayarlar. Dosyaya göre beklenen kayıp, cihazda/sunucuda çalışma, kota ve varsa isteğe bağlı reklam ödülü gösterimi.
4. Önizleme: görüntü önce/sonra; video/ses kısa örnek; PDF sayfaları; Excel tablo örneği ve sayfa seçimi. Önizleme de limitli bir iş olarak yürütülür.
5. İş listesi: sırada, çalışıyor, doğrulanıyor, başarılı, başarısız, iptal ve zaman aşımı durumları. Dosya bazında sonuç, tanımlı hata ve tekrar deneme.
6. Çıktı: ayrı dosyalar veya kontrollü ZIP, boyut karşılaştırması, kalite/değişiklik raporu, süreli indirme, şimdi sil seçeneği.
7. Hesap: işler, kayıtlı reçeteler, ücretsiz kullanım/kota ve güvenlik ayarları. Android'de yerel işlemler hesap gerektirmez; sunucu işleri doğrulanmış hesapla açılır. Satın alma, abonelik veya fatura ekranı yoktur.
8. Yönetim: kuyruk sağlığı, başarısızlıklar, maliyet, kota/istismar ve destek işlemleri. Müşteri içeriğini görme ayrı yetki ve denetim kaydı ister.

İlk sürümde dosya seçme, ayar ve önizleme tek çalışma alanında bulunur. Tam Photoshop/Premiere/Excel eşdeğeri editör ayrı ürün büyüklüğündedir; temel düzenlemeler tamamlandıktan sonra talebe göre genişletilir. Web klavye/ekran okuyucu desteği ve Android TalkBack/mobil uyum kabul kriteridir.

## 4. Seçilen Cloudflare yapısı

Son kullanıcı kararı bu bölümdeki teknoloji seçimini belirler: GitHub yalnızca kod deposudur; tüm sunucu bileşenleri Cloudflare üzerinde çalışır. Ayrıntı ve mevcut sınırlamalar [Cloudflare kararlarında](CLOUDFLARE.tr.md), çalıştırma adımları [README](../README.md) içindedir.

- Web: React + TypeScript + Vite; Workers Static Assets. İlk araçlar SEO/SSR gerektirmediğinden Next.js yerine statik panel seçildi.
- Android: Kotlin + Jetpack Compose, cihaz içi dönüşüm ve ortak API sözleşmesi.
- API: TypeScript Cloudflare Worker; FastAPI sunucusu yok.
- Veritabanı: Cloudflare D1; PostgreSQL hizmeti yok.
- Kuyruk: Cloudflare Queues; Redis/Celery hizmeti yok.
- Dosyalar: özel Cloudflare R2; süreli erişim, sahiplik kontrolü ve silme.
- Motor: Cloudflare Containers + Durable Objects; normal Workers CPU/bellek sınırlarının dışında ağır işlem.
- Kimlik: ilk kontrollü bulut beta'sında Cloudflare Access JWT doğrulaması; genel SaaS/Android oturumu canlı hesapta ayrıca doğrulanır.
- İş kurtarma/temizlik: D1 outbox/lease + Cron Triggers.
- İzleme: Cloudflare Workers/Containers Logs; müşteri dosyaları ve parolalar loglanmaz.
- Build/yayın: GitHub kaynaklı Cloudflare Workers Builds; GitHub Actions üzerinde çalışma yok.
- Android release build ve R2 artefakt hattı sonraki Cloudflare build işi olacak. Şu an APK bu geliştirme ortamında derlenir.
- Reklam: Android için resmi Google Mobile Ads entegrasyonu ve web reklam ağı daha sonraki aşamada, izin akışı ve test kimlikleriyle eklenecek.

İlk geliştirme sürümü: PNG/JPEG girişleri, webde JPEG/PNG/WebP çıktısı, Android'de JPEG; kalite ve genişlik ayarı. Limit 10 MB / 8 megapiksel. Video/PDF/Office ve reklamlar halen yol haritasındadır. Native Wrangler Container emülasyonu bu makinenin kernel eksiğiyle engellidir; yerel doğrulama aynı imajı ağ kapalı Docker sürecinde çalıştırır. Üretimde yalnızca Cloudflare Container binding'i kullanılır.

## 5. Dönüştürme motorları ve kaynakları

| Aile | Aday araçlar | Kullanım |
|---|---|---|
| Video/ses | [FFmpeg / ffprobe](https://github.com/FFmpeg/FFmpeg) | Codec ve kapsayıcı analizi, kodlama, kesme, filtreler |
| Görüntü | [libvips](https://github.com/libvips/libvips), [Pillow](https://github.com/python-pillow/Pillow), gerektiğinde [ImageMagick](https://github.com/ImageMagick/ImageMagick) | Ana yol libvips; ihtiyaç bazlı diğer motorlar |
| PDF yapısı | [qpdf](https://github.com/qpdf/qpdf), pypdf/pikepdf | Birleştirme, bölme, yeniden düzenleme ve yapısal kontrol |
| PDF görüntü/metin | Poppler ve pdfplumber | Önizleme, sayfa işleme, metin/tablo çıkarma |
| Ofis dönüşümü | [LibreOffice](https://github.com/LibreOffice/core) headless | İzole kullanıcı profiliyle belge→PDF ve desteklenen Office dönüşümleri |
| OCR | [Tesseract](https://github.com/tesseract-ocr/tesseract), [OCRmyPDF](https://github.com/ocrmypdf/OCRmyPDF) | Türkçe/İngilizce tarama metni ve aranabilir PDF |
| Excel/veri | [openpyxl](https://openpyxl.readthedocs.io/), pandas; büyük veride gerekirse DuckDB/Arrow | Excel yapısı ve tablo/veri dönüşümü |
| Metin/e-kitap | [Pandoc](https://github.com/jgm/pandoc) | Desteklenen yönlerde Markdown, HTML, DOCX, EPUB |

Motorlar kullanıcıdan serbest komut satırı almaz. Ayarlar tipli şemadan geçer, komutlar argüman dizileriyle oluşturulur. Yetenek kaydı her dönüşüm yönü için giriş/çıkış, motor sürümü, limitler, kayıp sınıfı, seçenekler ve doğrulama yöntemini saklar.

FFmpeg lisansı derleme bayrakları ve bağlı codec'lerle değişebilir. Diğer motorların, fontların ve varsa ticari SDK'ların lisans ve dağıtım koşulları seçilen imaj için kaydedilir. Araçlar ayrı süreçte çalıştırıldığında lisans yükümlülükleri kendiliğinden ortadan kalkmaz. Kurulum yalnızca imzalı paketlerden veya doğrulanmış artefaktlardan yapılır.

## 6. İş yürütme ve güvenilirlik

Akış: yükleme oturumu → tamamlanma/boyut doğrulama → karantina ve dosya türü analizi → uyumluluk/ayar kontrolü → kota rezervasyonu → kuyruğa alma → yalıtılmış işleme → çıktı doğrulama → yayınlama → kullanım kesinleştirme → süre sonunda temizleme.

- İş durumları: created, uploading, inspecting, queued, running, validating, succeeded, failed, canceled, expired.
- Durum geçişleri veritabanında koşullu güncellenir. İşçi kiralaması ve heartbeat, çöken işlerin tespitini sağlar.
- D1 işlemiyle iş ve gönderim kaydı oluşturulur; outbox görevi kuyruğa aktarır. Kuyruk teslimi tam bir kez varsayılmaz.
- Her işe idempotency anahtarı, sınırlı yeniden deneme ve deneme kimliği verilir. Geçici çıktılar denemeye özeldir; başarılı sonucun üzerine başarısız deneme yazamaz.
- Sunucu kullanım kotası önce atomik rezerve edilir, başarı/başarısızlık politikasına göre kesinleştirilir veya serbest bırakılır. Tekrar teslim aynı kotayı ikinci kez tüketmez. Satın alınan kredi veya ödeme yoktur.
- İptal tüm alt süreçleri durdurur, geçici dosyaları temizler ve doğru kota hareketini oluşturur. İlerleme oranı bilinmiyorsa sahte yüzde yerine aşama gösterilir.
- Toplu işlerde her dosya alt iştir. Bir dosyanın hatası başarılı dosyaları geçersiz kılmaz.
- Çıktı yalnızca süreç çıkış koduyla başarılı sayılmaz: dosya açılabilirliği, tür, boyut, beklenen sayfa/süre/kanal ve işlem semantiği kontrol edilir.
- Çok adımlı reçeteler yönlü döngüsüz işlem grafiğiyle tanımlanır. İlk beta tek adım ve sınırlı hazır zincirlerle başlar; görsel akış editörü sonra gelir.

## 7. Veri modeli ve API sınırları

Temel tablolar: users/identities, workspaces/memberships, files, upload_sessions, jobs/job_attempts, artifacts, recipes, usage_reservations/usage_ledger, rewarded_ad_grants, verified_ad_events, outbox, audit_events. Yerel Android işlerinin dosyaları ve geçmişi cihazda tutulur; sunucuya varsayılan olarak yüklenmez.

Her dosya, iş ve sonuç bir sahip/çalışma alanına bağlıdır. Yetkilendirme yalnızca tahmin edilmesi zor kimliğe dayanmaz; tüm okuma, yazma ve indirme yollarında sahiplik kontrol edilir. D1 sorgularının her biri sahiplik koşulunu içerir; erişim yalnızca Worker üzerinden sağlanır.

Önerilen API: GET /capabilities; POST /uploads; POST /uploads/{id}/complete; POST /jobs; GET /jobs/{id}; POST /jobs/{id}/cancel; GET /jobs/{id}/events; POST /artifacts/{id}/download; DELETE /files/{id}. Kullanıcı API anahtarları ve imzalı giden webhook'lar sonraki aşamada aynı iş katmanını kullanır.

## 8. Herkese açık SaaS güvenliği ve gizlilik

- Sunucu işlemlerinde başlangıçta e-posta doğrulanmış hesap gerekir. Android yerel işlemleri misafir olarak çalışır. Anonim bulut dönüşümü daha sonra, ayrı düşük kota ve istismar modeliyle açılabilir.
- Dosya uzantısına güvenilmez; imza/MIME ve ayrıştırıcı doğrulanır. Zararlı yazılım taraması yalıtımın yerine geçmez.
- Dönüştürücüler için root olmayan, yetkileri kaldırılmış, salt okunur kök dosya sistemi; CPU/RAM/disk/PID/zaman sınırları ve kapalı ağ. Kullanıcı dosyası başına temiz çalışma alanı.
- Worker imajını konteynerleştirmek tek başına güçlü çok kiracılı izolasyon sayılmaz. İnternete açılmadan önce hedef altyapıda gVisor, microVM veya uygun eşdeğer sınır seçilip test edilir. Docker socket'i ya da ayrıcalıklı host erişimi işçilere verilmez.
- Görselde piksel, PDF'de sayfa, videoda süre/çözünürlük, arşivde açılmış toplam boyut ve dosya sayısı limitleri vardır. Sıkıştırma bombaları ve bozuk girdiler kontrollü hata üretir.
- Office makroları ve dış bağlantı yenileme kapalıdır. HTML/SVG aktif içerik olarak ele alınır. Önizlemeler uygulama kimlik bilgileri taşımayan ayrı kaynaktan sunulur.
- CSV/Excel formül enjeksiyonu ile kullanıcının bilinçli formül koruma isteği ayrı seçeneklerdir; dışa aktarmada güvenli değer modu varsayılandır.
- URL'den içe aktarma ilk betada kapalı. Açılırsa DNS yeniden bağlama, özel IP, metadata endpoint'i ve yönlendirmeleri kapsayan SSRF savunması gerekir.
- Depolama özeldir; TLS, at-rest şifreleme, kısa ömürlü indirme, denetim kaydı ve gizli bilgi yönetimi kullanılır.
- Varsayılan öneri: geçici girdiler/çıktılar en geç 24 saatte silinir; kullanıcı daha erken silebilir. Kalıcı kütüphane ayrı tercih ve kotadır. Kesin saklama politikası ürün kararıdır.
- Silme; orijinal, önizleme, ara çıktı, nesne sürümleri, başarısız yükleme parçaları ve yedeklerin süre politikasını kapsar. Güvenlik logları içerik barındırmaz; ayrı süreye sahiptir.
- Kullanıcı dosyaları model eğitimi için kullanılmaz. Harici AI'ye aktarım sadece açık seçenek, sağlayıcı açıklaması ve saklama koşullarıyla açılır.
- Yönetici MFA, en az yetki ve içerik erişim denetimi; KVKK/GDPR için silme, dışa aktarma, bölge ve alt işleyen kayıtları. Uygulanacak hukuki metinler şirket ve hedef pazara göre hazırlanır.

## 9. Ücretsiz kullanım, reklam ve kapasite

Tüm kullanıcı özellikleri ücretsizdir. Abonelik, ücretli kredi, kart girişi veya uygulama içi satın alma planlanmaz. Sunucu işleri için adil günlük kota, dosya boyutu/süresi ve eşzamanlılık limitleri bulunur; bunlar ödeme duvarı değildir. Yerel işlemler de cihaz kapasitesine uygun teknik limitlerle çalışır.

1 fotoğraf ile 4K video aynı maliyette değildir. İç kullanım ölçüleri CPU/GPU saniyesi, sayfa, piksel, süre, geçici depolama ve çıkış trafiğidir. Kayıpsız remux ve tam yeniden kodlama farklı maliyetlidir. Android cihaz içi işlemler ve ileride uygun küçük web işlemlerinin tarayıcıda yürütülmesi sunucu maliyetini azaltır.

İç iş maliyeti = işlem süresi × kaynak birim fiyatı + depolama GB-saat + çıkış GB × birim fiyat + varsa AI çağrısı. Kullanıcıdan ücret alınmaz; bu ölçüm hizmetin bütçesini yönetmek içindir. Başarısız işlerde kullanılan kota serbest bırakılır; tamamlanmış reklam ödülü hatalı işlem nedeniyle tekrar izletilmez.

Reklam önerisi: ana ekran/iş listesinde içerikten ayrılmış az sayıda banner veya native reklam; isteğe bağlı ödüllü reklamla ek günlük bulut kotası. Her tuşta veya her dönüşümde geçiş reklamı, sahte indirme düğmesi, sonuca erişimi engelleme ve işlem sırasında tam ekran kesinti yoktur. Ödüllü reklam temel ücretsiz işlemler için zorunlu değildir. Reklam envanteri/izin/ağ yoksa temel kullanım devam eder; yalnızca ek reklam ödülü sunulamayabilir.

Ek sunucu kotası yalnızca reklam ağının imzalı ve tekrar işlemeye dayanıklı sunucu doğrulamasıyla verilir. İstemcideki "reklam izlendi" bildirimi yeterli değildir. Event tekrarları, kota grant'leri, süre sonu ve hesap başına üst sınır denetlenir. Sağlayıcı reklam doğrulamasını desteklemiyorsa sunucu ödülü o entegrasyonda açılmaz.

Reklam geliri = gösterim / 1000 × gerçekleşen eCPM. Başa baş hesabı; fill rate, ülke, reklam türü, ödül başına kaynak maliyeti, depolama ve operasyon dahil gerçek ölçümlerle yapılır. Küçük reklamlarla sınırsız pahalı dönüşümün finanse edileceği varsayılmaz. Gerekirse sıra, kota ve pahalı format kapsamı ayarlanır; ücretli modele otomatik geçilmez.

İlk benchmark ortamı için öneri: GPU olmadan toplam 4–8 vCPU ve 8–16 GB RAM; küçük hizmetler ve medya işçisi gerektiğinde ayrı makineler. Bu kapasite vaadi değildir. Büyük video, OCR ve Office eşzamanlılığı ölçülerek ayarlanır. RAM ve CPU'yu aşan varsayılan worker sayısı kullanılmaz.

Trafik ve dosya örnekleri bilinmediğinden aylık bütçe veya kullanıcı kapasitesi doğrulanmış gibi verilmez. Yayın öncesi küçük/orta/büyük örneklerde p50/p95 süre, RAM tepesi, başarı ve birim maliyet raporu hazırlanır. Bütçe eşiği, kuyruk üst sınırı ve kullanıcı başına günlük kaynak sınırı bulunur. Kullanıcıya ücretsiz hizmetin işletmeci için sunucu, depolama, mağaza hesabı ve operasyon maliyetleri olabilir. Barındırma/reklam sağlayıcısı seçilmedi; ücretli kaynak açılmadı.

## 10. Skill ve geliştirme altyapısı

Şu anda projeye kaynak anlık görüntüsü olarak eklendi:

- Graphify: kod, modül ve belge ilişkilerini haritalama. Resmi kaynak Graphify-Labs/graphify; Python paketi graphifyy (iki y). Codex SKILL.md ve sekiz referans belgesi dahil. CLI bağımlılıkları henüz kurulmadı; grafik üretilmedi.
- Ponytail: ponytail, ponytail-review, ponytail-audit, ponytail-debt, ponytail-gain ve ponytail-help. MIT lisansı korunarak altı skill kopyalandı. Global eklenti veya yaşam döngüsü hook'u kurulmadı.
- Kaynak commit'leri, dosya yolları ve SHA-256 değerleri: [skills-manifest.json](skills-manifest.json). Lisanslar: ../third_party/licenses/.

Bu araçlar geliştirme yardımcılarıdır; dosya dönüşüm motorları veya otomatik doğruluk garantisi değildir. Bu oturumda çalıştırılmadılar ve performans iddiaları bağımsız olarak doğrulanmadı. Skill dosyalarının eklenmesi mevcut sohbetin onları dinamik olarak etkinleştirdiği anlamına gelmez.

Anthropic'in incelenen resmi PDF skill lisansı kopyalama ve türev üretmeyi kısıtlıyor; bu materyal depoya alınmadı. Belge skill ailesi README'de source-available olarak tanımlanıyor. Her adayın kendi lisansı değerlendirilir; genel depo lisansı tüm alt dizinlere uygulanmış varsayılmaz.

İnternetteki tüm converter skill'leri için eksiksiz bir katalog iddiası yoktur. Proje için formatlara odaklı özgün skill'ler uygulama aşamasında yazılabilir: conversion-routing, media-processing, document-processing, spreadsheet-integrity, worker-isolation ve conversion-validation. Bunlar üçüncü taraf özel lisanslı metinlerden türetilmez; gerçek motor ve test sözleşmelerimizi belgeler.

Graphify kurulumu uygulama aşamasında izole ve sabit sürümlü yapılır; önce yerel kod analizi kullanılır. Müşteri dosyaları, sırlar ve depolama dizinleri kapsam dışında tutulur. Harici model/cloud analizi ayrıca seçilmedikçe açılmaz. Skill'ler sürüm sabitleme, lisans, referans ve komut incelemesinden sonra güncellenir.

## 11. Hedef depo düzeni

```text
.agents/skills/       # Projeye özel geliştirme yönergeleri
src/                  # React web paneli
apps/android/         # Kotlin/Compose uygulaması ve cihaz içi işlemler
worker/               # Cloudflare API, kuyruk ve cron
engine/               # Cloudflare Container görüntü motoru
shared/               # API ve dönüşüm sözleşmesi
migrations/           # D1 şeması
tests/fixtures/       # Lisansı uygun örnek dosyalar ve beklenen sonuçlar
docs/                 # Plan, kararlar, format matrisi, operasyon rehberi
third_party/licenses/ # Kopyalanan materyallerin lisansları
```

Bu ağaç ilk uygulamanın dizinlerini ve gelecekteki test/operasyon düzenini gösterir; mevcut dosyalar için README kullanılır. Her bulut görevi zaten yalıtılmıştır; mevcut /workspace/converter-mce checkout'u kullanılır. Kullanıcı açıkça istemedikçe Git worktree oluşturulmaz.

## 12. Uygulama sırası ve çıkış kriterleri

| Aşama | Teslimat | Tamamlanma kanıtı |
|---|---|---|
| 0 — Plan ve kaynaklar | Bu plan, kaynak/lisans kayıtları, skill anlık görüntüleri | Kaynak dosyaları ile hash eşleşmesi; ürün sınırları yazılı |
| 1 — Çalışan temel | Web, Android iskeleti, API, DB, kuyruk, depolama, giriş ve migration | Android'de PNG→JPEG yerel dönüşüm/kaydetme; webde doğrulanmış bulut dönüşümü/indirme; başka kullanıcı erişemez |
| 2 — İlk ürün kapsamı | Görüntü, medya, PDF ve temel Office/veri işlemleri; Android yerel/bulut yönlendirme | Her ilan edilen yön ve ayar için örnek; işçi imajı veya gerçek Android cihaz üzerinde semantik doğrulama |
| 3 — Hizmet ve reklam kontrolü | Ücretsiz kota, reklam izinleri/ödülleri, silme, operasyon ekranı, güvenli işçi sınırı | Test reklamları; yinelenen reklam event'inde çift ödül yok; kota yarışı, worker çökmesi, yetkisiz erişim ve TTL silme testleri geçer |
| 4 — Kapalı beta | Web ve Play internal/closed test; gerçek dosyalar ve reklam/maliyet ölçümü | Doğrulanmış destek matrisi, Android cihaz matrisi, benchmark raporu ve düzeltilmiş beta bulguları |
| 5 — Genel yayın | Web yayını ve Play Store başvurusu; destek, gizlilik, alarm ve geri dönüş | İmzalı AAB; gerekli mağaza beyanları; yedekten geri yükleme; yükseltme/rollback ve istismar sınırları denenmiş; mağaza onayı ayrıca doğrulanır |
| 6 — Genişleme | OCR, gelişmiş editörler, API, ekipler, özel formatlar, AI | Modül başına ayrı kalite/maliyet eşiği ve talep kanıtı |

SaaS yetkilendirme ve veri sahipliği 1. aşamada başlar; 3. aşamaya ertelenmez. Genel erişim, ilgili güvenlik, reklam izni ve kota kontrolleri tamamlanmadan açılmaz. Süre tahmini, 1. aşama ve motor benchmark'ı sonrasında kapsam ve ekip kapasitesine göre yapılır.

## 13. Test ve kalite planı

- Destek matrisi her yön için küçük, büyük, bozuk, yanlış uzantılı ve özel karakterli ad örneklerini kapsar. Türkçe karakterler ve farklı belge fontları test edilir.
- Görüntü: boyut, yön, saydamlık, renk profili; kayıpsız çıktıda piksel beklentisi, kayıplı çıktıda tanımlı kalite toleransı.
- Video/ses: ffprobe ile codec, süre, kanal ve çözünürlük; gerçek decode; kesim ve senkronizasyon. Codec kopyasıyla kesmenin keyframe sınırı açıkça test edilir.
- PDF: açılabilirlik, sayfa sırası/sayısı, beklenen metin ve render karşılaştırması. Kayıplı sıkıştırma içerik kaybını raporlar.
- Excel/veri: satır/sütun ve veri türleri, boş değerler, sayfalar, tarih/büyük sayı hassasiyeti, formüller ve yeniden hesaplama. openpyxl tek başına formül hesaplama motoru sayılmaz.
- OCR: Türkçe ve İngilizce etiketli örneklerde karakter/kelime hata ölçümü; okuma sırası ve tablo ayrımı ayrı değerlendirilir.
- SaaS: iki kullanıcı arasında tüm dosya/iş/indirme yollarında erişim reddi, limit yarışları, reklam ödül imzası/event tekrarları, iş tekrar teslimi, iptal, disk dolması, zaman aşımı ve worker restart.
- Android: düşük RAM, depolama dolması, izin reddi, URI erişim süresinin dolması, arka plana geçiş, process death, ağ kesilmesi ve devam edebilir bulut yüklemesi. Reklam yokluğu/izin reddi temel yerel işlemi bozmamalıdır.
- Dosya ömrü: geçici dosya ve nesne sürümleri dahil silme; bağlantı süresi sonu ve silme sonrası erişim reddi.
- CI: uygun birim/entegrasyon testleri, kritik uçtan uca akış, build/typecheck, imaj ve bağımlılık taraması, SBOM. Sadece port açılması veya sıfır test başarılı kurulum sayılmaz.

## 14. Sağlayıcı seçiminden önce açık kalacak kararlar

Şu an planlamayı engellemez: yayıncı/reklam hesabı ülkesi, veri bölgesi, aylık işletme bütçesi, beklenen trafik, azami dosya boyutları, kesin saklama süresi, minimum Android sürümü, hedef kitle/yaş grupları ve ücretsiz günlük kota. Kullanıcı sunucu sağlayıcısını Cloudflare olarak belirledi. Canlı hesap erişimi sağlanmadan kaynak veya reklam hesabı açılmaz. Yayın aşamasında Play Console ve reklam ağı hesapları ile alan adı kullanıcıya ait olmalıdır; sırlar sohbetten istenmez.

Varsayılan çalışma kararı: Android'de yerel işlem önceliği ve misafir kullanım; bulutta hesapla çalışan, CPU tabanlı geçici dosya işleri; az reklam ve ücretsiz günlük kota; GPU/harici AI kapsamı maliyet ölçümünden sonra. En yaygın format yönleri test edilerek kapsam genişletilir.

## 15. Bu oturumdaki kanıt ve sınırlamalar

- İlk planlama incelemesinde GitHub deposu boştu: HEAD commit'i ve main dalı yoktu; yerel checkout mevcut ve başlangıçta kullanıcı dosyası bulunmuyordu.
- Kullanıcının verdiği iki upstream depo HTTPS Git erişimiyle indirildi; README, paket bilgileri ve lisanslar incelendi.
- İlk araştırmada FFmpeg, libvips, LibreOffice, qpdf, Pandoc, OCRmyPDF kaynakları ve Pillow/openpyxl metadata'sı okundu. İlk uygulama Pillow kullanır; diğer motorlar halen kurulmadı veya uygulamada test edilmedi.
- Resmi AndroidX Media3 README/Transformer kaynağı ve Google reklam örnekleri incelendi. Eski google-mobile-android-examples deposu kendisini legacy olarak işaretliyor ve GMA Next-Gen örneklerine yönlendiriyor. Güncel entegrasyon başlangıç noktası https://github.com/googleads/gma-next-gen-sdk-android-examples ; SDK sürümü uygulama sırasında resmi belgelerle sabitlenir.
- GitHub HTML araması HTTP 429, GitHub API araması proxy 403 verdi. Bilinen resmi URL'ler ve izinli paket kayıtlarıyla araştırma sürdürüldü; ağ kısıtı aşılmadı veya genişletilmedi.
- Kopyalanan skill dosyalarının kaynakla byte/hash eşleşmesi doğrulanır. Bu, skill davranışının çalıştırıldığı anlamına gelmez.
- Bu bölüm ilk planlama oturumunun araştırma kaydıdır. Güncel çalışan kapsam ve canlıya geçiş engelleri README ve CLOUDFLARE.tr.md içindedir. İlk görüntü uygulaması ve Android debug build geliştirildi; üretim dağıtımı henüz yapılmadı. Ortam kurulum/başlatma yönergeleri doğrulama sonrasında yapılandırma taslağına kaydedilir.

## 16. Bir sonraki somut teslimat

İlk uygulama işi: web/API servislerini başlatan tekrarlanabilir geliştirme altyapısı ve Android uygulama iskeleti. Aynı PNG→JPEG örneği Android'de çevrimdışı seç/dönüştür/kaydet, webde ise kullanıcı sahipliği, yükleme, kuyruk, izole işleme, doğrulama, indirme ve silme adımlarıyla tamamlanır. İki akış kanıtlandıktan sonra medya, PDF ve tablo işlemleri eklenir; reklam entegrasyonu önce test kimlikleriyle gelir.

## 17. Android uygulaması ve Play Store teslimatı

Native Kotlin/Compose uygulaması ortak API ve işlem şemalarını kullanır; web panelinin WebView içine alınması önerilmez. Uygulama için ayrı arayüz, cihaz yetenek denetimi ve yaşam döngüsü yönetimi bulunur.

| İşlem | Android'de ilk tercih | Sunucu yolu |
|---|---|---|
| Yaygın fotoğraf biçimleri, boyut/kırpma/döndürme | Platform decode/encode ile cihazda; kalite/metadata sınırları gösterilir | Cihazın desteklemediği format veya büyük işlem |
| Video/ses kesme, ölçekleme, uyumlu çıktı | AndroidX Media3 Transformer ve cihaz codec'leri; runtime capability kontrolü | Desteklenmeyen codec veya belirgin cihaz kaynak sınırı |
| PDF görüntüleme, basit üretim | Platform PDF görüntüleme/üretim API'leri | Birleştirme/OCR/ileri düzenleme için uygun motor; platform görüntüleyici editör varsayılmaz |
| Office, karmaşık Excel/veri, OCR | Yerel kapsam sonraki modüllerde ölçülür | İlk sürümde doğrulanmış bulut işçileri |

- Dosya seçme: Photo Picker veya Storage Access Framework; çıktı için MediaStore/CreateDocument ve paylaşım intent'leri. Gereksiz geniş dosya erişim izni istenmez.
- Uzun işler için güncel Android background/foreground service sınırlarına uygun çalışma; görünür ilerleme, iptal ve geçici dosya temizliği. WorkManager her medya işinin sınırsız çalışacağı varsayımıyla kullanılmaz.
- Yerel dosyalar açık tercih olmadan buluta yollanmaz. Cihaz işlemi başarısızsa bulut fallback'i boyut, veri aktarımı ve bağlantı gereksinimi gösterilerek seçilir.
- Arka planda kalma, ısınma, pil, depolama ve codec çeşitliliği cihaz matrisiyle test edilir. Format desteği Android sürümü ve donanıma göre farklı olabilir.
- Reklam SDK'sı dosya içeriğine veya dönüşüm parametrelerine erişmez. Reklam kimliği ve SDK telemetrisi yine veri işleme sayılır; gizlilik politikasında ve mağaza beyanlarında gerçek davranış açıklanır.
- Gereken bölgelerde izin akışı reklam talebinden önce uygulanır; izin tercihleri değiştirilebilir. Kişiselleştirme izni ile dosyayı sunucuya gönderme izni ayrı tutulur. Hedef çocuk kitle varsa ilgili mağaza/reklam kuralları yayın öncesi ayrıca karşılanır.
- Geliştirme ve CI yalnızca test reklam kimlikleri kullanır; canlı reklam tıklaması veya sahte gösterim üretilmez.
- Yayın: benzersiz applicationId, kullanıcıya ait imzalama düzeni/Play App Signing, imzalı AAB, mağaza metinleri ve ekran görüntüleri, içerik derecelendirmesi, reklam beyanı, Data Safety, gizlilik politikası ve hesap varsa hesap/veri silme yolu.
- Hedef API, test aşamaları ve yeni geliştirici hesabı gereklilikleri yayın tarihinde Play Console üzerinden doğrulanır; sürüm/sayılar sabit güncel gerçek gibi yazılmaz. Önce internal test, ardından hesap için gereken closed test ve kontrollü üretim dağıtımı.
- Kullanıcıya ücretsiz dağıtımın yayıncı tarafındaki hesap/operasyon maliyetlerini kaldırdığı varsayılmaz. Mağaza ve reklam hesabı açma, üretim kimlikleri ekleme ve yayınlama ayrı gerçek adımlardır; bu plan bunları yapılmış saymaz.
