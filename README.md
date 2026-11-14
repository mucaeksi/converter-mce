# YouTube Yöneticisi

Kanaldaki videoların başlık, açıklama, etiket ve oynatma listelerini düzenli
tutmak için araçlar. Değişiklikler önce plan dosyası olarak yazılır, önizlenir,
onaydan sonra YouTube Data API v3 ile uygulanır. Her işlemin önce/sonra kaydı
`data/islemler/` altında tutulur, yani geri alınabilir.

## Bir kerelik kurulum

1. **Repoyu gizli yapın:** Settings → General → Danger Zone → Change visibility →
   Private. Kanal verisi (gizli videolar dahil) repoya yazıldığı için iş akışı
   herkese açık repoda çalışmaz.
2. **Google Cloud projesi:** [console.cloud.google.com](https://console.cloud.google.com/)
   → yeni proje → *APIs & Services → Library* → **YouTube Data API v3** ve
   **YouTube Analytics API** → Enable.
3. **OAuth izin ekranı:** *Google Auth Platform → Branding/Audience*: tip
   **External**, kendi Gmail adresinizi test kullanıcısı olarak ekleyin, sonra
   **Publish app** ile "In production" yapın (test modunda izin 7 günde biter).
   Doğrulanmamış uygulama uyarısını kendi hesabınız için "Devam" diyerek geçebilirsiniz.
4. **OAuth istemcisi:** *Clients → Create client → Desktop app* → JSON'u indirin.
5. **İzin verin (kendi bilgisayarınızda):**

   ```bash
   python3 scripts/yetkilendir.py ~/Downloads/client_secret_XXXX.json
   ```

   Tarayıcıda kanalın bağlı olduğu Google hesabını seçin. Kanal bir marka
   hesabıysa kanalın kendisini seçin.
6. **GitHub Secrets:** Settings → Secrets and variables → Actions → *New
   repository secret*: `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`.
   Bu değerleri sohbete ya da repoya yapıştırmayın.

## Kullanım

GitHub → Actions → **YouTube** → *Run workflow*:

| İşlem | Ne yapar | Kanalı değiştirir mi |
| --- | --- | --- |
| `yedek` | Kanal, video ve listeleri `data/kanal.json` ve `data/yedekler/` altına yazar | Hayır |
| `onizle` | Plan dosyasının yapacağı değişiklikleri ve kota maliyetini listeler | Hayır |
| `uygula` | Önce yedek alır, sonra planı uygular ve `data/islemler/` kaydı yazar | **Evet** |

Plan biçimi ve içerik kuralları: `.claude/skills/youtube-duzen/SKILL.md`.
Plan doğrulama (API'ye bağlanmadan):

```bash
python3 scripts/yt.py dogrula planlar/01-ornek.json
```

## Sınırlar

- Günlük ücretsiz kota 10.000 birim; video ya da liste güncellemesi 50 birim.
  Günde yaklaşık 170 yazma işlemi yapılır, büyük kanallar günlere bölünür.
- Uç ekranlar ve kartlar API ile değiştirilemez. Bölümler açıklamadaki zaman
  damgalarıyla oluşturulur.
- Araç video silmez, gizlilik ayarını değiştirmez, listelerden video çıkarmaz.

Önceki "Converter MCE" kodu bu reponun git geçmişinde durur.
