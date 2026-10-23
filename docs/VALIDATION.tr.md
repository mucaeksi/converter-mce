# İlk sürüm doğrulaması

Bu rapor mevcut geliştirme makinesini kapsar. Canlı Cloudflare hesabı veya Play
Store onayı için kanıt değildir.

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
| Android Robolectric native graphics testleri | 3 geçti, 0 başarısız, 0 atlanan |
| Android lint | Geçti |
| Wrangler deploy dry-run | Geçti; Worker/varlıklar ve Container imajı paketlendi |
| Skill dosyaları | 19 kaynak/lisans dosyasının SHA-256 eşleşmesi korundu |

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
limitli Docker sürecinde çalıştırır. Canlı Cloudflare Container başlangıcı ayrıca
doğrulanmalıdır; normal production kodu Container binding'ini kullanır.

Canlı dağıtım önkoşulları kontrolü beklenen biçimde engel bildirdi:
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` ve gerçek D1 `database_id`
eksik. Kaynak oluşturma/deploy komutları henüz çalıştırılmadı. Access kimlik
kurulumu, fiziksel Android cihazı/emülatörü, canlı reklam, release imzalama ve
Play Store yayını denenmedi. Video/ses/PDF/Office motorları henüz uygulama kapsamı değildir.
