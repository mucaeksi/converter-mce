---
name: youtube-duzen
description: YouTube kanalındaki videoların başlık, açıklama, etiket ve oynatma listelerini düzenleme planı hazırlarken kullan. Kanal yedeğini okuma, plan JSON'u yazma, önizleme ve onaylı uygulama adımlarını kapsar.
---

# YouTube kanal düzeni

## Akış (sırayı bozma)

1. **Güncel veri:** `data/kanal.json` yoksa ya da eskiyse kullanıcıdan izin alıp
   `YouTube` iş akışını `islem=yedek` ile çalıştır, sonra dalı çek.
2. **Analiz:** Videoları konu/seri bazında grupla; eksik açıklama, tutarsız başlık,
   etiketsiz video, listesiz video ve yinelenen liste sayılarını çıkar.
3. **Plan:** `planlar/NN-konu.json` yaz. Bir planda tek bir tür iş olsun
   (ör. yalnızca başlıklar ya da yalnızca listeler); günlük kotaya sığsın
   (~170 yazma işlemi). `python3 scripts/yt.py dogrula planlar/NN-konu.json`
   ile doğrula.
4. **Onay:** Kullanıcıya önce/sonra tablosunu göster. Açık onay olmadan
   `islem=uygula` çalıştırma. Önizleme (`islem=onizle`) her zaman serbest.
5. **Uygula ve raporla:** `data/islemler/` kaydını oku, sonuçları ve hataları
   olduğu gibi bildir.

## Plan biçimi

```json
{
  "aciklama": "Seri başlıklarını tek kalıba getir",
  "videolar": {
    "VIDEO_KIMLIGI": {
      "title": "...",
      "description": "...",
      "tags": ["...", "..."]
    }
  },
  "oynatma_listeleri": [
    {"title": "...", "description": "...", "privacyStatus": "public", "videolar": ["VIDEO_KIMLIGI"]}
  ]
}
```

Yalnızca değişecek alanları yaz; diğerleri korunur. `categoryId`,
`defaultLanguage`, `defaultAudioLanguage` da desteklenir. Listeler kimlikle (`id`)
ya da tam başlıkla eşleşir, yoksa oluşturulur. Listeden video çıkarılmaz.

## İçerik kuralları

- **Başlık:** En fazla 100 karakter; önemli kelime ilk 60 karakterde. Videoda
  olmayan bir şeyi vaat etme. Seri videolarında tutarlı kalıp kullan
  (ör. `Konu | Seri Adı #3`). `<` `>` yasak.
- **Açıklama:** İlk 1–2 cümle aramada görünür; videonun ne verdiğini doğal dille
  anlat. Sonra ayrıntı, varsa bölümler, bağlantılar, en sonda 3–5 hashtag.
  Bölümler: ilk satır `00:00`, en az 3 bölüm, her biri en az 10 saniye. Zaman
  damgası uydurma: süreler yalnızca kullanıcıdan ya da mevcut açıklamadan gelir.
- **Hashtag:** İlk üçü başlığın üstünde görünür; 60'tan fazlası tümünü geçersiz
  kılar ve aşırı kullanım spam sayılabilir. 3–5 tane, konuyla ilgili tut.
- **Etiket:** Sıralamaya etkisi küçük; yazım varyantları ve kanal/seri adı için
  kullan. Toplam 500 karakter. İlgisiz popüler kelime ekleme (YouTube spam
  politikası yanıltıcı meta veriyi yasaklar).
- **Oynatma listeleri:** Konuya ya da seriye göre grupla; her videonun en az bir
  listede olması hedef. Liste açıklaması da aranabilir, 1–2 cümle yaz.
- Kanalın dilini ve üslubunu koru; mevcut açıklamalardaki bağlantı, sponsor ve
  yasal notları silme.

## Güvenlik

- Kimlik bilgileri yalnızca GitHub Secrets'ta. Değer isteme, yazdırma, commit etme.
- Repo herkese açıksa kanal verisi yazılmaz; iş akışı bunu durdurur.
- Geri alma: `data/islemler/*.json` içindeki `once` değerlerinden yeni plan yaz.
