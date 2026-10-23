# Converter MCE

Ücretsiz web ve Android dönüştürme uygulamasının ilk çalışan geliştirme sürümü.
GitHub yalnızca kaynak deposudur. Üretim web/API, dosyalar, işler, veritabanı ve
dönüştürme süreçleri Cloudflare üzerinde çalışacak şekilde hazırlanmıştır.

## Şu anda çalışan kapsam

- Web: PNG/JPEG girişinden JPEG, PNG veya WebP; kalite ve en fazla genişlik seçimi.
- Webde cihaz içi dönüşüm: arka plan işçisinde çalışır, dosya yüklemez.
- Sunucu akışı: Worker → özel R2 → Queues → Container → doğrulanmış çıktı → indirme.
- D1 üzerinde sahiplik, idempotency, atomik günlük kota, iş durumları ve yeniden deneme.
- İlk limitler: 10 MB, 8 megapiksel, günlük 5 başarılı/ayrılmış sunucu işi;
  başarısızlıklar kotayı serbest bırakır, toplam deneme sayısı günlük 20 ile sınırlıdır.
- Sunucu dosyaları 24 saat sonunda erişime kapanır; beş dakikalık bakım görevi
  fiziksel temizliği yapar. Kullanıcı daha önce silebilir. Silinen işler kotayı sıfırlamaz.
- Android: native Kotlin/Compose, çevrimdışı PNG/JPEG → JPEG, kalite/boyut ayarı,
  beyaz saydamlık arka planı ve sistem dosya seçiciyle kaydetme. Android 9 / API 28+.

Video, ses, PDF/Office, toplu işleme, reklam SDK'sı ve Android bulut girişi sonraki
aşamalardır. Arayüzde henüz çalışmayan kategoriler “Yakında” olarak gösterilir.
Hiçbir reklam/analitik SDK'sı veya ücretli plan etkin değildir. Canlı Cloudflare
dağıtımı ve Play Store yayını yapılmış değildir.

## Geliştirme ortamı

Node 24.19+, Python 3.12+ ve çalışan yerel Docker gerekir. Mevcut checkout'u
kullanın; bulut görevleri zaten yalıtılmıştır, ayrıca Git worktree oluşturmayın.

```sh
cd /workspace/converter-mce
npm ci
npm run prepare:engine
npm run dev
```

`dev` web paketini derler, yerel D1 migration'larını uygular, imajı oluşturur ve
yerel servisleri başlatır. Geliştirme adresi yalnızca makine içi doğrulama içindir;
bu onboarding ortamında kullanıcıya web önizleme bağlantısı sunulmaz.

Varsayılan yerel motor, üretim imajını her iş için root olmayan, salt okunur,
ağ erişimi kapalı, CPU/RAM/PID limitli Docker sürecinde çalıştırır. Loopback relay
yalnızca geliştirmede kullanılır; Cloudflare'a dağıtılmaz. Bu makinede Wrangler'ın
native container proxy'si gerekli kernel/iptables desteği olmadığından başlayamıyor.
Normal Docker süreçleri ve gerçek görüntü dönüşümü çalışıyor.

Destekleyen başka bir makinede native Cloudflare Containers emülasyonu için
`CONVERTER_NATIVE_CONTAINERS=1 npm run dev` kullanılabilir. Bu native mod mevcut
makinede doğrulanamadı. Üretimde her zaman Cloudflare Containers binding'i kullanılır;
yerel motor adresi yalnızca `APP_ENV=development` durumunda ve sabit loopback URL'de kabul edilir.

Python wheel'i resmi PyPI dosyasından indirilir ve sabit SHA-256 ile doğrulanır.
Docker kurulumu ağ kullanmadan `pip --require-hashes --no-index` ile yapılır;
Python taban imajı digest ile sabitlenmiştir. TLS/sağlama toplamı kontrolü kapatılmaz.

## Android

Linux x86_64 için tekrar kullanılabilir SDK/JDK kurulumu:

```sh
python scripts/setup-android.py
npm run android:debug
node scripts/android-gradle.mjs lintDebug
```

SDK ve JDK checkout'un dışında `../.tools` altında tutulur. Gradle wrapper ve
dağıtımının sağlama toplamları doğrulanır. Gradle çalıştırıcısı session proxy'sini ve
sistem Java CA deposunu kullanır; kimlik bilgileri dosyalara yazılmaz.

Debug APK: `apps/android/app/build/outputs/apk/debug/app-debug.apk`.
Bu mağazaya yüklenebilir imzalı release değildir. Gerçek cihaz/emülatör ve
Play internal test doğrulaması ayrıca gerekir. APK ve build çıktıları Git'e eklenmez.

## Kontroller

```sh
npm run build
npm test
npm run test:e2e
npm run test:engine
npm run android:debug
node scripts/android-gradle.mjs lintDebug
npx wrangler deploy --dry-run --outdir dist-worker
```

Worker testleri gerçek yerel D1/R2 üzerinde çalışır; motor sınırını mock'lar.
Playwright testleri ise aynı motor imajını kullanarak gerçek JPEG'i decode eder,
boyut/piksel kontrolü ve indirme/silme yapar. Android testleri Robolectric native
graphics ile gerçek Bitmap decode/encode işlemini çalıştırır; fiziksel cihaz testi değildir.

Playwright varsayılan olarak `/usr/bin/chromium` kullanır; farklı bir kurulumda
`CHROMIUM_PATH` verin. Test çalıştırıcısı servisleri gerekirse kendi başlatıp kapatır.

## Cloudflare'a dağıtım

Canlı hesap erişimi henüz sağlanmadı. `CLOUDFLARE_API_TOKEN` güvenli ortam
ayarından, `CLOUDFLARE_ACCOUNT_ID` değişken olarak sağlanmalıdır. Token'ı Git'e,
chat'e, `.dev.vars` içine veya komut argümanlarına kopyalamayın.

Hesapta gerekli hizmetler: Workers/Containers/Durable Objects, D1, R2 ve Queues.
Kullanıcı ücretsizliği Cloudflare faturası olmadığı anlamına gelmez; hesap planı,
Containers kullanılabilirliği ve bütçe sınırları canlı kaynaklar açılmadan kontrol edilir.

Hesap erişimi geldikten sonra:

```sh
npx wrangler whoami
npx wrangler d1 create converter-mce
npx wrangler r2 bucket create converter-mce-files
npx wrangler queues create converter-mce-jobs
```

Dönen gerçek D1 kimliğini `wrangler.jsonc` içindeki `d1_databases[0].database_id`
alanına yazın. R2 bucket'ı özel tutun; public erişim açmayın. İş dosyalarına ikinci
bir temizlik güvencesi olarak R2 lifecycle politikası ekleyin. Henüz bu hesap
komutları çalıştırılmış veya başarıyla doğrulanmış değildir.

İlk kontrollü bulut beta'sında kimlik Cloudflare Access ile doğrulanır. Uygulama
host'unun `/api/*` yolları için Access uygulaması ve email OTP erişim politikası
oluşturun. `ACCESS_TEAM_DOMAIN` (yalnızca `ekip.cloudflareaccess.com`) ve
`ACCESS_AUD` değerlerini Worker `vars` alanına ekleyin. JWT imzası, issuer, audience
ve süre kontrol edilir; istemciden gelen bir kimlik başlığı tek başına kabul edilmez.
Web arayüzü kimlik gerektirmeyen `/.well-known/converter-capabilities` bilgisini okuyabilir. Sunucu oturumu bağlantısı `/api/login` üzerinden Access girişine gider ve giriş sonrası panele döner. Access yapılandırması eksikse bulut API'si kapalı kalır; cihaz içi araç çalışabilir.
Herkese açık SaaS'a açılmadan Access kullanıcı/plan sınırları ve Android oturum
akışı gerçek hesapta değerlendirilmelidir.

```sh
npx wrangler d1 migrations apply DB --remote
npm run deploy
```

`deploy` kimlik/D1 önkoşullarını kontrol eder; imajı hazırlar ve build'i çalıştırır.
Eksik erişimle kaynak oluşturduğunu veya deploy yaptığını iddia etmez. Dağıtımdan
sonra gerçek Access girişi, bir dönüşüm, hesaplar arası erişim reddi, silme ve cron
temizliği tekrar doğrulanmalıdır. `--dry-run` bu canlı kontrollerin yerine geçmez.

Otomatik dağıtım için GitHub deposu Cloudflare Workers Builds'e bağlanır;
Node sürümü 24.19.0, build komutu `npm ci && npm run prepare:engine && npm run build`,
deploy komutu `npx wrangler deploy` olur. Container build desteği ve Docker bu
hesabın build ortamında doğrulanmalıdır. GitHub Actions veya GitHub üzerinde
çalışan uygulama servisi yoktur. Android release build/AAB ve R2 artefakt hattı
ayrı bir Cloudflare build işi olarak sonraki aşamada kurulacaktır.

## Kaynaklar

- [Ürün planı](docs/PLAN.tr.md)
- [Cloudflare kararları](docs/CLOUDFLARE.tr.md)
- [Skill kaynakları ve hash kayıtları](docs/skills-manifest.json)
- [Resmi Workers sınırları](https://developers.cloudflare.com/workers/platform/limits/)
- [Resmi Containers başlangıcı](https://developers.cloudflare.com/containers/get-started/)

Graphify ve altı Ponytail skill'i `.agents/skills` altında lisansları korunarak
bulunur. Graphify CLI, global hook'lar veya harici model analizi etkinleştirilmedi.
