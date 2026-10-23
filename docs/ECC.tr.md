# Converter MCE için seçilen ECC yönergeleri

[ECC](https://github.com/affaan-m/ECC) içinden mevcut React/TypeScript web ve
Kotlin/Compose Android uygulamasına uygun altı skill ve üç agent rolü alındı. Kaynak sürümü
[`90606c8315ee09cafc303515c5f33024db6b9882`](https://github.com/affaan-m/ECC/tree/90606c8315ee09cafc303515c5f33024db6b9882),
inceleme tarihi 23 Ekim 2026. Skill ve agent kaynak dosyaları byte düzeyinde aynıdır;
MIT lisansı [third_party/licenses/ecc/LICENSE](../third_party/licenses/ecc/LICENSE)
altında korunur. Dosya bazında kaynak yolları ve SHA-256 değerleri
[skills-manifest.json](skills-manifest.json) içindedir.

| Skill | Bu projedeki kullanım |
| --- | --- |
| [verification-loop](../.agents/skills/verification-loop/SKILL.md) | Değişen kapsamı derleme/tür/test/güvenlik/diff açısından kontrol etme, çalıştırılmayan kontrolleri açıkça belirtme |
| [security-review](../.agents/skills/security-review/SKILL.md) | Dosya sınırları ve içerik doğrulama, güvenli çıktı, sırlar, API ve bağımlılık incelemesi |
| [e2e-testing](../.agents/skills/e2e-testing/SKILL.md) | Playwright ile gerçek dönüşüm, indirme ve iptal akışlarını doğrulama |
| [frontend-patterns](../.agents/skills/frontend-patterns/SKILL.md) | React durum yönetimi, bileşenler, lazy loading ve ölçüme dayalı performans çalışmaları |
| [frontend-a11y](../.agents/skills/frontend-a11y/SKILL.md) | Etiketler, klavye erişimi, odak ve hata/ilerleme bildirimleri |
| [kotlin-coroutines-flows](../.agents/skills/kotlin-coroutines-flows/SKILL.md) | Android arka plan işleri, yaşam döngüsü, iptal ve kaynak temizliği |

## Geliştirmede kullanımı

Kök [AGENTS.md](../AGENTS.md), işe uygun skill dosyalarının okunmasını ve
değişiklik sonunda `verification-loop` uygulanmasını ister. Önceki Ponytail
yönergeleri de kullanılır. Böylece seçim yalnızca arşivlenmez; sonraki depo
oturumlarının çalışma talimatlarının parçası olur. İstemcinin skill keşfi ayrı
bir özelliktir; bu işlem global ECC eklentisi veya hook kurulumu değildir.

Skill örnekleri genel amaçlıdır. Projedeki komutlar ve mimari geçerlidir:
Cloudflare Workers Free, cihazda dönüşüm, mevcut bağımlılıklar ve mevcut test
altyapısı. Next.js/Supabase/Express, blockchain, GitHub Actions örnekleri veya
örnek kapsam yüzdesi yeni gereksinimler oluşturmaz. İlişkili skill önerileri
isteğe bağlıdır; bu altı skill'in çalışması için diğer ECC skill'leri gerekmez.
MIME/uzantı kontrolüne ek olarak gerçek dosya içeriği ve açılmış veri sınırları
doğrulanır. Örnek güvenlik aramaları sır değerlerini çıktıya yazacak şekilde
kopyalanmaz. Playwright örnekleri mevcut sürümün API'sine ve olayı tetiklemeden
önce bekleyici kaydetme gereğine göre değerlendirilir.

ECC'nin installer'ı, hook'ları, MCP ayarları, hosted servisi ve
otomatik öğrenme/global bellek sistemi alınmadı. Mevcut üründe kullanılmayan
backend, veritabanı, LLM ve diğer platform skill'leri eklenmedi. Uygulama çalışma
zamanına bağımlılık veya yeni servis maliyeti eklenmez.

## Seçilen agent rolleri

| Codex rolü | ECC kaynak tanımı | Amaç |
| --- | --- | --- |
| `ecc_reviewer` | [code-reviewer](../.agents/roles/ecc/code-reviewer.md) | Somut hata, davranış değişikliği ve eksik test incelemesi |
| `ecc_security` | [security-reviewer](../.agents/roles/ecc/security-reviewer.md) | Güvenilmeyen dosyalar, sınırlar, ZIP adları, API ve sır güvenliği |
| `ecc_kotlin` | [kotlin-reviewer](../.agents/roles/ecc/kotlin-reviewer.md) | Android yaşam döngüsü, Compose, iptal ve kaynak temizliği |

[.codex/config.toml](../.codex/config.toml) bu rolleri, projeye özel
[TOML adaptörlerine](../.codex/agents/reviewer.toml) bağlar. Adaptörler salt okunur
inceleme ister; model/sağlayıcı seçimini oturumdan devralır. Kaynaklardaki
Claude `model`/`tools` alanları Codex'e kopyalanmaz. Framework örnekleri, genel
önem seviyeleri ve mimari öneriler mevcut ürüne göre değerlendirilir.

Config ve üç adaptör, OpenAI'ın
[güncel config şeması](https://developers.openai.com/codex/config-schema.json)
ile doğrulandı. Rol yükleme, istemci sürümüne ve proje güven ayarlarına bağlıdır;
mevcut oturumda yeni rollerin otomatik yüklendiği veya ayrı bir agent başlatıldığı
iddia edilmez. Ayrı agent çalıştırılmadığında ilgili kontrol listeleri mevcut
agent tarafından uygulanır. Bu turda toplu görüntü dönüşümü kod/güvenlik kontrol
listeleriyle incelendi; Kotlin uygulaması değişmedi.

## Kaynak doğrulaması ve güncelleme

Depo kökünden aşağıdaki kontrol, ECC dahil manifestteki tüm anlık görüntüleri
doğrular. Bu kontrol uygulamanın işlevsel testlerinin yerine geçmez.

```sh
python3 - <<'PY'
import hashlib
import json
from pathlib import Path

manifest = json.loads(Path('docs/skills-manifest.json').read_text())
for item in manifest['files']:
    actual = hashlib.sha256(Path(item['path']).read_bytes()).hexdigest()
    assert actual == item['sha256'], item['path']
print(f"{len(manifest['files'])} kaynak dosyasının SHA-256 değeri doğrulandı.")
PY
git diff --check
```

Güncellemede resmi kaynağın belirli commit'i incelenir; yalnızca kullanılan
dosyalar ve gerekli yerel referansları alınır. Lisans tekrar kontrol edilir;
manifestte commit, kaynak yolu ve hash birlikte güncellenir. Kaynak kopyaları
üzerinde projeye özel değişiklik yapılmaz; uyarlamalar `AGENTS.md` içinde tutulur.
