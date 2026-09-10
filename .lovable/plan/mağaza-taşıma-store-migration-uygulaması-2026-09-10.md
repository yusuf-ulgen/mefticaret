# Mağaza Taşıma (Store Migration) Uygulaması

Başka bir e-ticaret altyapısındaki mağazanın tüm verisini Mefticaret'e aktaran kapsamlı bir taşıma modülü.

## Kullanıcı akışı

1. **Kaynak seç** — ikas, Shopify, Wix, WordPress/WooCommerce, Ticimax, Shopier, IdeaSoft, T-Soft, PrestaShop, OpenCart, Magento + "Genel CSV/XML".
2. **Bağlan** — her kaynak için gerekli alanlar (mağaza adresi, API anahtarı/token). Anahtarlar veritabanına yazılmaz; sunucu tarafı sır olarak saklanır, veritabanında yalnızca referans tutulur.
3. **Kapsam seç** — Kategoriler, Ürünler (varyant, stok, görsel, SEO), Müşteriler ve hesap adresleri, Siparişler (kalemler, ödeme/kargo durumu), Blog yazıları, İçerik sayfaları, Kuponlar, Yorumlar, URL yönlendirmeleri.
4. **Ön izleme (kuru çalışma)** — gerçek veriyi çeker, kaç kayıt geleceğini ve örnek satırları gösterir; hiçbir şey yazılmaz.
5. **Taşımayı başlat** — parça parça (batch) çalışır, canlı ilerleme çubuğu, kayıt sayaçları, hatalı kayıt listesi.
6. **Rapor** — varlık başına eklendi/güncellendi/atlandı/hata; tekrar denenebilir, kaldığı yerden devam eder.

## Veri bütünlüğü kuralları

- Her kayıt kaynak kimliğiyle (`external_id`) eşlenir → tekrar çalıştırmak kopya oluşturmaz, günceller (upsert).
- Sıralama zorunlu: kategoriler → ürünler/varyantlar → müşteriler/adresler → siparişler (ürün ve müşteri eşleşmesiyle) → blog/sayfalar → kuponlar/yorumlar/yönlendirmeler.
- Siparişler geçmiş veri olarak aktarılır: tutarlar ve para birimi kaynaktaki haliyle sabit yazılır, stok düşmez, e-posta/bildirim tetiklenmez.
- Müşteri şifreleri taşınamaz (hiçbir altyapı vermez) — hesaplar e-posta ile oluşturulur, müşteri ilk girişte şifre sıfırlar. Bu ekranda açıkça yazılır.
- Görseller kaynak URL'sinden mağaza medya deposuna indirilir; indirilemeyen görsel kaydı düşürmez, hata listesine yazılır.
- Eski URL'ler için 301 yönlendirme kayıtları üretilir, böylece SEO değeri korunur.

## Teknik tasarım

**Veritabanı** (tenant-scoped RLS + GRANT, mevcut `is_store_member` / `can_manage_store` desenine göre):
- `migration_sources` — store_id, provider, shop_domain, config_ref (sır referansı), scope (jsonb), status, last_error.
- `migration_jobs` — source_id, store_id, scope, mode (`preview` | `run`), status, cursor (jsonb, devam ettirme için), totals (jsonb), started_at/finished_at.
- `migration_records` — job_id, entity, external_id, local_id, action (`created`/`updated`/`skipped`/`failed`), message. Eşleme ve tekrar çalıştırma bunun üzerinden.

**Sağlayıcı adaptörleri** — `src/lib/migration/providers/<code>.ts`, mevcut pazaryeri connector deseniyle aynı: saf modüller, HTTP çağrısı yapmaz; sayfalama isteği üretir ve gelen ham kaydı ortak modele (`MigrationProduct`, `MigrationCustomer`, `MigrationOrder`, `MigrationPost`, `MigrationPage`) normalize eder. Kayıt defteri `src/lib/migration/index.ts`.
- Shopify: Admin REST/GraphQL, `X-Shopify-Access-Token`.
- ikas: OAuth token + GraphQL Admin API.
- WordPress/WooCommerce: WP REST `wp/v2` (blog, sayfa) + `wc/v3` (ürün, müşteri, sipariş).
- Wix: Stores/Blog/Members REST API.
- Ticimax, Shopier, IdeaSoft, T-Soft: sağlayıcı web servis/API alanları; API'si sınırlı olanlarda XML/CSV dışa aktarım dosyası yükleme yolu.
- Genel CSV/XML: alan eşleme ekranıyla (mevcut XML entegratör mantığını yeniden kullanır).

**Sunucu katmanı**
- `src/lib/migration.server.ts` — taşıyıcı: sayfalama, hız sınırı/yeniden deneme (429/5xx için geri çekilme), batch yazma, cursor kaydetme, süre aşımında kaldığı yerden devam.
- `src/lib/migration.functions.ts` — `createServerFn` + `requireSupabaseAuth`: kaynak CRUD, bağlantı testi, ön izleme, taşıma adımını çalıştır, durum/rapor. Kimlik bilgileri yalnızca sunucuda okunur.
- Uzun taşımalar için mevcut kuyruk/cron altyapısına bağlı bir işleyici; UI ilerlemeyi izler.

**Arayüz**
- Satıcı: `/store/$storeId/migration` — sağlayıcı seçimi, bağlantı formu, kapsam seçimi, ön izleme, ilerleme, hata tablosu, rapor.
- Süper yönetici: `/admin/migration` — tüm mağazaların taşıma işlerini görme ve yeniden çalıştırma.
- Uygulama mağazasına "Mağaza Taşıma" kaydı ve mağaza menüsüne bağlantı.

## Sınırlar (açıkça belirtilecek)

- Gerçek veri çekmek için ilgili altyapının API anahtarı/token'ı gerekir; girilmeden bağlantı testi ve taşıma çalışmaz.
- Şifreler, ödeme yöntemleri (kart/token) ve altyapıya özel tema kodu taşınamaz.
