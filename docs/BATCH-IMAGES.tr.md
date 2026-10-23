# Cihazda toplu görüntü dönüşümü

Web görüntü panelinde birden fazla dosya seçilebilir veya sürüklenebilir.
Listeden dosya kaldırılabilir. Tek hedef biçim/kalite/genişlik tüm dosyalara
uygulanır; sonuçlar tek `converter-images.zip` içinde indirilir. Tek dosya
seçildiğinde önceki görüntü önizlemesi ve doğrudan indirme akışı kullanılır.
Android uygulamasının kapsamı bu değişiklikte genişletilmedi.

| Sınır | Değer |
| --- | --- |
| Seçim | 1–20 görüntü; toplam en fazla 30 MB |
| Her görüntü | En fazla 10 MB / 8 megapiksel; çıktı en fazla 24 MB |
| ZIP | Başlık ve dizin kayıtları dahil en fazla 50 MB |
| İşleme | Bir worker içinde sırayla; her görüntü/ilerleme aralığı için 30 saniye zaman aşımı |
| Biçimler | PNG/JPEG/WebP/sıkıştırmasız BMP/tek kareli GIF → JPEG/PNG/WebP/BMP/ICO |

Önce seçim sayısı ve byte sınırları, ardından dosyaların gerçek başlıkları
kontrol edilir. Worker dosyayı tekrar doğrular ve tarayıcı codec'i ile açar;
gerçek decoded boyut sınırı da uygulanır. Bir görüntü işlenemediğinde veya
ZIP sınırı aşıldığında kısmi arşiv indirmeye sunulmaz. İptal işçiyi sonlandırır;
çıktı/ilerleme temizlenir ve yeniden başlanabilir.

## Kaynak ve performans kararları

- Mevcut `fflate@0.8.3` bağımlılığının `Zip`/`ZipPassThrough` akışı kullanılır.
  ZIP kodu yalnızca toplu işlem başlayınca yüklenir. Yeni bağımlılık eklenmedi.
- ZIP girdileri `store` yöntemiyle yazılır; önceden kodlanmış görüntüler tekrar
  deflate edilmez. BMP için bu tercih daha büyük ZIP üretebilir; genişlik ve
  50 MB sınırı kullanıcıya gösterilir. Bu seçim genel bir hız yüzdesi iddiası değildir.
- Tüm görüntüler aynı anda decode edilmez. Her görüntünün bitmap'i kapatılır,
  canvas yüzeyi bırakılır; sonra sıradaki görüntüye geçilir. ZIP parçaları
  tarayıcı belleğinde tutulur; bu işlem diske sınırsız streaming değildir.
- Dosya yolları/kontrol karakterleri temizlenir, ad uzunluğu sınırlandırılır ve
  her ZIP girdisine sıra numarası eklenir. Aynı isimli dosyalar birbirini ezmez.
  Kaynak EXIF ve kaynak dosya tarihleri arşive taşınmaz.
- Dosyalar, görüntüler ve ZIP cihazda kalır; Cloudflare'da ağır işlem, yükleme
  veya yeni servis kullanılmaz. Küçük cihazlarda bellek kapasitesi ayrıca sınır olabilir.

Playwright testleri ZIP'i açar, girdileri gerçek tarayıcı codec'iyle decode
eder, piksel/boyut/saydamlık kontrolü yapar; aynı adları, mobil yerleşimi,
yükleme yapılmamasını, bozuk dosyayı, gerçek worker iptalini ve gerçek büyük
BMP çıktısında ZIP sınırını doğrular. Kontroller Chromium'dadır; Firefox/Safari
ve fiziksel mobil cihazlarda bu özellik henüz doğrulanmadı.

## İncelenen kaynaklar

- [fflate 0.8.3 ZIP stream API](https://github.com/101arrowz/fflate/tree/v0.8.3#usage)
- [MDN structured clone: Blob/File desteği](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm)
- [Codex config şeması](https://developers.openai.com/codex/config-schema.json)
- [ECC kaynak sürümü ve rol eşlemesi](ECC.tr.md)
