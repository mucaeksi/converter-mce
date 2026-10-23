# Converter MCE

Ücretsiz web ve Android dönüştürme uygulamasının ilk çalışan geliştirme sürümü.
GitHub yalnızca kaynak deposudur. Web/API Cloudflare üzerinde, dönüşümler tarayıcıda ve Android cihazında çalışır.
Etkin olmayan sunucu işleme taslağı ayrıca depoda korunur.

## Şu anda çalışan kapsam

- Web: PNG/JPEG girişinden JPEG, PNG veya WebP; kalite ve en fazla genişlik seçimi.
- Webde cihaz içi dönüşüm: arka plan işçisinde çalışır, dosya yüklemez.
- Web PDF: birleştirme, sayfa çıkarma/sıralama ve döndürme; en fazla 200 çıktı sayfası.
- Web veri: CSV/TSV/JSON/XLSX değer dönüşümleri ve Excel çalışma sayfası seçimi.
- Web ses: tarayıcının çözebildiği dosyadan WAV; kesme, örnekleme ve ses seviyesi.
- Web video: desteklenen codec’lerde kısa video → WebM; kesme ve boyutlandırma.
- Sunucu taslağı (yerel testlerde çalışır, üretimde kapalı): Worker → özel R2 → Queues → Container → doğrulanmış çıktı → indirme.
- Sunucu taslağında D1 üzerinde sahiplik, idempotency, atomik günlük kota, iş durumları ve yeniden deneme.
- Görüntüler 10 MB/8 MP; etkin olmayan sunucu taslağında günlük 5 ayrılmış iş;
  başarısızlıklar kotayı serbest bırakır, toplam deneme sayısı günlük 20 ile sınırlıdır.
- Sunucu taslağında dosyalar 24 saat sonunda erişime kapanır; beş dakikalık bakım görevi
  fiziksel temizliği yapar. Kullanıcı daha önce silebilir. Silinen işler kotayı sıfırlamaz.
- Android: native Kotlin/Compose, çevrimdışı PNG/JPEG → JPEG/PNG/WebP, kalite/boyut ayarı,
  JPEG için beyaz, PNG/WebP için saydamlık koruyan arka plan ve sistem dosya seçiciyle kaydetme. Android 9 / API 28+.

Tam Office→PDF, OCR, uzun/büyük medya, toplu işler, reklam SDK'sı ve Android'in
belge/medya araçları sonraki aşamalardır. Tüm format çiftlerinin desteklendiği
iddia edilmez. Veri dönüşümü biçimlendirmeyi korumaz ve formüllü Excel'i reddeder.
PDF formları/imza alanları reddedilir. Codec ve kalite sınırlamaları arayüzde yazılıdır.

**Canlı web:** https://converter-mce.sosyalstudio-06a486e459d2.workers.dev

**Kalıcı bütçe kararı: Workers Free.** Yeni ücretli plan etkinleştirilmez.
Üretim `wrangler.web.jsonc` kullanır; dönüşümler cihazda yapılır, dosya yüklenmez.
Workers Free günlük 100.000 dinamik istek ve çağrı başına 10 ms CPU sağlar.
Statik dosyalar ücretsiz/sınırsız asset yolundan sunulur; yalnızca küçük API'ler
Worker'a gider. D1/R2/Queue yayına bağlı değildir. Containers ücretsiz kapsamda
olmadığından kullanılmaz. [Ücretsiz plan ve limitler](docs/FREE-PLAN.tr.md).
Reklam ve Play Store yayını henüz etkin değildir.

## Geliştirme ortamı

Ücretsiz web geliştirmesi için Node 24.19+ yeterlidir. `npm run build` ardından
`npx wrangler dev --config wrangler.web.jsonc --ip 127.0.0.1 --port 8790` kullanılabilir.
Referans sunucu taslağını da çalıştıran aşağıdaki akış için Python 3.12+ ve
çalışan yerel Docker gerekir. Mevcut checkout'u
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
makinede doğrulanamadı. Etkin olmayan sunucu yapılandırması Cloudflare Containers binding'i kullanır;
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
npm run test:free
npm run test:engine
npm run android:debug
node scripts/android-gradle.mjs lintDebug
npx wrangler deploy --config wrangler.web.jsonc --dry-run --outdir dist-worker/free
```

Worker testleri gerçek yerel D1/R2 üzerinde çalışır; motor sınırını mock'lar.
Playwright testleri ise aynı motor imajını kullanarak gerçek JPEG'i decode eder,
boyut/piksel kontrolü ve indirme/silme yapar. Android testleri Robolectric native
graphics ile gerçek Bitmap decode/encode işlemini çalıştırır; fiziksel cihaz testi değildir.

Playwright varsayılan olarak `/usr/bin/chromium` kullanır; farklı bir kurulumda
`CHROMIUM_PATH` verin. Test çalıştırıcısı servisleri gerekirse kendi başlatıp kapatır.

## Cloudflare'a dağıtım

`CLOUDFLARE_API_TOKEN` ve `CLOUDFLARE_ACCOUNT_ID` güvenli Codex ayarlarında hazır.
Hesap token'ı aktif; sırlar kaynak kodda veya komut argümanlarında saklanmaz.

```sh
npm run deploy
```

Varsayılan komut `deploy:web` çalıştırır: build ve `wrangler.web.jsonc` dağıtımı.
Statik güvenlik başlıkları `public/_headers` içindedir. `/api/*` ve `/.well-known/*`
Worker'a gider; bulut işi API'si 503 döndürür. Ücretli sunucu planı açılmaz.

Daha önce D1 `converter-mce`, özel R2 `converter-mce-files` ve Queue
`converter-mce-jobs` oluşturuldu. Migration ve R2 `jobs/` bir günlük lifecycle
kuralı uygulandı. Kaynaklar mevcut üretime bağlı değildir; tekrar oluşturmayın.
Hesaptaki başka projeler ve önceden var olan abonelikler değiştirilmedi.
`wrangler.jsonc`, Access/sunucu kodu ve Docker akışı yalnızca yerel doğrulama ve
referans olarak korunur; güncel ücretsiz üretime dağıtılmaz.

GitHub kaynaklı Cloudflare Workers Builds bağlantısı henüz kurulmadı. Kurulunca
ücretsiz web build komutu `npm ci && npm run build`, deploy komutu
`npx wrangler deploy --config wrangler.web.jsonc` olmalıdır. Container wheel'i,
Docker ve GitHub Actions çalışma zamanı bu ücretsiz yayın için gerekmez.
Mevcut yayın Codex'ten Wrangler ile doğrudan Cloudflare'a yapılır.

Canlı web araçlarının gerçek Chromium kontrolü:

```sh
CONVERTER_TEST_URL=https://converter-mce.sosyalstudio-06a486e459d2.workers.dev npx playwright test --config playwright.free.config.ts
```

## Kaynaklar

- [Ürün planı](docs/PLAN.tr.md)
- [Cloudflare kararları](docs/CLOUDFLARE.tr.md)
- [Skill kaynakları ve hash kayıtları](docs/skills-manifest.json)
- [Resmi Workers sınırları](https://developers.cloudflare.com/workers/platform/limits/)
- [Resmi Containers başlangıcı](https://developers.cloudflare.com/containers/get-started/)

Graphify ve altı Ponytail skill'i `.agents/skills` altında lisansları korunarak
bulunur. Graphify CLI, global hook'lar veya harici model analizi etkinleştirilmedi.

Üçüncü taraf bağımlılık bildirimleri: [THIRD-PARTY-NOTICES.txt](public/THIRD-PARTY-NOTICES.txt).
Bu dosya sabit lockfile sürümlerinin dağıtılan lisans metinlerini içerir.
