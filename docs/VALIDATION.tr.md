# İlk sürüm doğrulaması

Bu rapor geliştirme makinesini ve 23 Ekim 2026 tarihli canlı cihazda dönüşüm
yayınını kapsar. Sunucu motorunun Cloudflare'da çalıştığı veya Play Store onayı
için kanıt değildir.

| Kontrol | Sonuç |
|---|---|
| Temiz `npm ci` | Geçti; lockfile ile tekrar kurulum |
| Wheel hazırlama | Geçti; resmi dosya ve sabit SHA-256 |
| D1 migration tekrar uygulama | Geçti; ikinci çalıştırmada uygulanacak migration yok |
| TypeScript + web production build | Geçti |
| Worker/sözleşme testleri | 9 geçti, 0 başarısız, 0 atlanan |
| Gerçek tarayıcı testleri | 3 geçti; cihaz dönüşümü, sunucu akışı, mobil/cihaz gizliliği |
| İmajın gerçek HTTP sunucusu | 3 fonksiyonel kontrol geçti: JPEG decode/piksel/boyut; bozuk giriş; desteklenmeyen biçim |
| Android debug build | Geçti; APK üretildi |
| Android Robolectric native graphics testleri | 4 geçti, 0 başarısız, 0 atlanan |
| Android lint | Geçti |
| Wrangler deploy dry-run | Geçti; Worker/varlıklar ve Container imajı paketlendi |
| Skill dosyaları | 19 kaynak/lisans dosyasının SHA-256 eşleşmesi korundu |
| Cloudflare hesap/token | Aktif hesap token'ı doğrulandı; D1/R2/Queue oluşturuldu |
| Uzak D1 migration | `0001_jobs.sql` başarıyla uygulandı |
| Özel R2 | Public erişim kapalı; `jobs/` lifecycle bir gün |
| Cihaz sürümü deploy | Başarılı; sürüm `d6d82e09-3e34-4d38-a99e-c517eadd8831` |
| Canlı mobil Chromium | Gerçek 40×20 JPEG; beyaz piksel, indirme ve sıfır POST yüklemesi |
| Ücretsiz web araçları, yerel Chromium | 9 geçti: PDF içerik/sıra/döndürme; form reddi; Excel/veri; ZIP sınırı; mobil; WAV/MP3 sinyal; WebM görüntü/ses; iptal |
| Ücretsiz web araçları, canlı Chromium | Aynı 9 test gerçek Cloudflare adresinde geçti |
| Üretim bağımlılıkları audit | 0 bilinen bulgu; fflate 0.8.3 ve uuid 11.1.1 düzeltmeleri sabitlendi |
| Canlı HTTP | Health 200; capabilities 200 / serverAuth=unconfigured; sunucu işi 503 |

Tarayıcı sunucu testi yalnızca PID/port kontrolü değildir: gerçek PNG yükler,
D1/R2/Queues akışını ve aynı üretim imajında çalışan dönüştürücüyü kullanır;
JPEG'i açar, 40×20 boyutu/beyaz saydamlık arka planını denetler, indirir ve sunucu
kopyalarını siler. Worker birim/entegrasyon testleri motor sınırında mock kullanır;
gerçek motor doğrulaması ayrı HTTP ve tarayıcı testleriyle yapılır.

İlk başarısız denemeler teşhis edildi ve düzeltildi: Android ortamındaki JDK
eksikliği, non-root imajda kaynak dosyasının okuma izni ve arayüz testindeki
erişilebilir düğme adı. Nihai sonuçlar yukarıdaki tablodadır.

Wrangler native Containers proxy'si bu makinede kernel/iptables PREROUTING
desteği yokluğundan başlatılamadı. Bu altyapı sınırlaması çözülmüş gibi
gösterilmez. Varsayılan yerel relay aynı imajı ağ kapalı, root olmayan ve kaynak
limitli Docker sürecinde çalıştırır. Bu motor yalnızca referans sunucu taslağıdır. Güncel ücretsiz üretim cihazda
çalışır ve Container binding'i kullanmaz.

Canlı adres: https://converter-mce.sosyalstudio-06a486e459d2.workers.dev

İlk varlık yükleme denemesi Cloudflare 10013 hatası verdi; ikinci aynı dağıtım
başarılı oldu. Python varsayılan istemcisi canlı host'tan 1010 aldı; gerçek
Chromium aynı oturum proxy'si üzerinden 200 aldı ve yukarıdaki kontrolleri geçti.
Proxy veya TLS kontrolleri devre dışı bırakılmadı.

Cloudflare Containers sorgusu Workers Paid planı gerektiğini bildirdi; ücretli
plan etkinleştirilmedi ve canlı sunucu dönüşümü denenmedi. Kuyruğa henüz tüketici
bağlanmadı. Access kimlik kurulumu, fiziksel Android cihazı/emülatörü, canlı reklam, release imzalama ve
Play Store yayını denenmedi. PDF, tablo, ses ve kısa video cihazda çalışır; tam Office→PDF/OCR ve Android belge/medya araçları henüz kapsam dışıdır.


23 Ekim 2026 ücretsiz sürüm güncellemesinde video çıktısının sesinin sessiz
kaldığı gerçek decode testiyle bulundu; kaynak sesin kayıt hedefine yönlendirilmesi
düzeltildi. Nihai WebM testinde 64×32 gerçek yeşil kare, sonlu yaklaşık bir saniye
süre ve sıfır olmayan ses sinyali doğrulandı. WAV/MP3 testleri bir saniyelik
48 kHz stereo PCM16 çıktısının örnek sayısı, 440 Hz sinyali ve %50 seviyesini
kontrol eder. PDF testleri yalnızca dosya başlığına bakmaz; kopyalanan sayfa
boyutu, sırası ve gerçek içerik stream'lerini doğrular. Excel çıktısı yeniden
açılır; Türkçe, çok satırlı hücre ve baştaki sıfırlar korunur.

Workers Free varsayılan yayın hedefidir; statik istekler Worker çağrısı olmadan
sunulur. Yeni ücretli plan açılmadı. Tarayıcılar arası codec matrisi, fiziksel
Android cihazları, Play release imzası, mağaza yayını ve gerçek reklamlar için
bu testlerden onay çıkarılmaz.

Son yayında yalnızca üçüncü taraf lisans bildirimleri eklendi; test edilen uygulama JS/CSS varlıkları aynı kaldı. Yeni lockfile ile temiz npm ci ve build tekrar geçti.
