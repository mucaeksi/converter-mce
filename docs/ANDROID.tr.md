# Android geliştirme sürümü

Native Kotlin/Compose, Android 9 / API 28+. İnternet izni ve sunucu yüklemesi yok.
Görüntü sekmesi PNG/JPEG/WebP/BMP → JPEG/PNG/WebP dönüşümü yapar. Görsel→PDF
sekmesi Android'in yerleşik PdfDocument API'siyle cihazda PDF oluşturur.

PDF akışı: sistem dosya seçiciden 1–8 görsel seç → sıralama/kaldırma → genişlik
ayarı → oluştur → sistem CreateDocument ekranından kaydet. Her kaynak ayrı
A4 sayfaya oranı korunarak yerleşir; yön otomatik seçilir, kenar boşluğu 24 pt,
saydamlık arka planı beyazdır. Kaynak dosyalar değiştirilmez. Mevcut PDF'lerden
sayfa çıkarma/birleştirme bu native aracın kapsamı değildir.

- Dosya başına 10 MB/8 MP, toplam kaynak 20 MB.
- İşlenen bitmap'ler toplam 16 MP, PDF çıktısı en fazla 30 MB.
- Varsayılan 2048 px genişlik bellek kullanımını azaltır; küçültme görüntü
  ayrıntısını azaltabilir. Orijinal için alanı boş bırakın, en fazla ayar 4096 px.
- EXIF yönü ortak decoder tarafından uygulanır. Animasyonlu WebP/APNG reddedilir.
- İşler IO/Default coroutine'lerinde çalışır; sayfalar ve yazma adımları arasında
  iptal kontrolü yapılır. İşlem sırasında araç sekmeleri ve ayarlar kilitlenir.
- PDF kapanışı ve bitmap kaynakları try/finally ile temizlenir. Başarısız veya
  iptal edilmiş dönüşüm indirilebilir sonuç olarak gösterilmez.

```sh
python3 scripts/setup-android.py
npm run android:debug
node scripts/android-gradle.mjs assembleDebugAndroidTest lintDebug
```

Güncel debug APK:
`apps/android/app/build/outputs/apk/debug/app-debug.apk`.
Cihaz test APK'sı:
`apps/android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk`.
Build çıktıları Git'e eklenmez. Debug imzası Play Store release imzası değildir.

9 yerel test geçti: 6 gerçek Bitmap testi ve 3 PDF yerleşim/limit/erken iptal testi.
Android native PDF API'leri Robolectric'te uygulanmadığı için gerçek PDF üretme,
PdfRenderer ile yeniden açma, renk/sıra/saydamlık ve sayfalar arası iptal kontrolleri
ayrı 3 cihaz testindedir. Test APK'sı derlendi; bu ortamda bağlı cihaz/emülatör
olmadığından çalıştırılmadı. Native PDF'in gerçek cihazda çalıştığı iddia edilmez.

Bir test cihazı/emülatörü bağlandığında:

```sh
node scripts/android-gradle.mjs connectedDebugAndroidTest
```

Fiziksel cihaz dosya sağlayıcıları, süreç ölümü/rotasyon, düşük bellek, release
imzası, reklam izinleri ve Play internal test ayrıca doğrulanmalıdır. Reklam,
üretim AdMob kimlikleri ve Play Store yayını henüz etkin değildir.
