# Ürün ve Müşteri Yönetimi v2 (Shopify benzeri)

## Mevcut durum
Ürün, varyant, seçenek, görsel, koleksiyon, müşteri, adres ve segment tabloları ile ilgili panel sayfaları zaten var ve çalışıyor. Bu yüzden istenen tablolar sıfırdan oluşturulmayacak (çakışma ve veri ikiliği olur). Mevcut tablolara yalnız eksik sütunlar eklenecek; hiçbir tablo/sütun silinmez veya yeniden adlandırılmaz. `/api/v1` dokunulmaz.

## Veritabanı (yalnız ekleme)
- products: `published_at`, `seo_title`, `seo_description` (mevcut `seo` JSON korunur, okuma geri uyumlu). `vendor`, `product_type`, `tags`, `slug`(handle) zaten var.
- product_variants: `inventory_policy` (deny/continue, varsayılan deny), `weight_unit`, `is_default`, `option1..3` (mevcut `options` JSON'dan türetilir, yazımda ikisi senkron).
- product_images: `variant_id`, `media_type` (image/video), `width`, `height`, `size_bytes`, `cdn_url`. (product_media yerine mevcut tablo genişletilir.)
- collections: `collection_type` (manual/smart), `rules` JSON, `image_url`, `published_at`. product_collections'a `position`.
- customers: `gender`, `verified_email`, `tax_exempt`. (email tekilliği mevcut veride çakışma yoksa mağaza bazlı kısmi unique index; varsa yalnız uyarı.)
- customer_addresses: `company`, `province`, first/last ad (mevcut `recipient` korunur).
- customer_segments: `query` JSON kuralları + `customer_count` önbellek; eski eşik alanları çalışmaya devam eder.
- Yeni: `customer_notes` (müşteri, yazan yönetici, not, tarih) — mağaza bazlı RLS, yalnız mağaza ekibi.
- Özellik anahtarları: projede `tenant_features` yok; mevcut `plan_features` düzeniyle `module_v2_products`, `module_v2_customers`, `module_v2_collections` — varsayılan kapalı. Kapalıyken mevcut sayfalar aynen çalışır; açıkken v2 ekranlar/uçlar devreye girer.

## API v2 (API anahtarı + kapsam: read/write_products, read/write_customers)
Ürünler, varyantlar, koleksiyonlar (+ürün ekle/sırala), müşteriler, adresler, müşteri siparişleri, notlar, segmentler ve segment üyeleri — istenen tüm uçlar, mevcut `/api/v2` yönlendiricisine eklenir. Liste yanıtlarında sayfalama; kısa süreli önbellek (liste 2 dk, detay 5 dk), yazımda temizlenir.

## Panel ekranları (mobil öncelikli, tema renkleri)
1. Ürün listesi: durum/tür/marka/etiket filtreleri, anlık arama, sıralama, toplu yayınla/arşivle/sil/koleksiyona ekle.
2. Ürün formu: zengin metin editörü (TipTap), sürükle-bırak medya sıralama, fiyat/karşılaştırma/maliyet (kâr marjı), seçenek → otomatik varyant tablosu (toplu fiyat/stok düzenleme), SEO + Google önizleme, koleksiyon seçici, etiketler, durum, önizle.
3. Koleksiyonlar: manuel (ürün ara + sürükle sırala) ve akıllı kural oluşturucu (etiket/fiyat/stok/tür/marka, tümü/herhangi biri).
4. Müşteri listesi: isim/e-posta/telefon arama, şehir/etiket/pazarlama filtreleri, toplu etiket ekle, e-posta gönder (yalnız pazarlama onaylı olanlara, mevcut e-posta sistemiyle), CSV dışa aktar.
5. Müşteri detay: istatistik, son siparişler, adres ekle/düzenle/varsayılan, etiketler, yönetici notları zaman çizelgesi.
6. Segment oluşturucu: harcama, sipariş sayısı, şehir, etiket, son sipariş günü, pazarlama onayı kuralları; canlı üye sayısı önizlemesi.

## Bilinçli farklılıklar
- Laravel, Scout/Meilisearch, Redis, Horizon, PHPUnit ve `artisan migrate --pretend` bu projenin altyapısında yok. Karşılıkları: veritabanı tam metin araması, mevcut süreç içi önbellek, mevcut zamanlanmış görevler, migration öncesi şema/çakışma kontrol sorgusu ve uç başına otomatik testler (vitest).
- Görseller mevcut depolama/medya kütüphanesiyle yüklenir.
- Arayüz Türkçe; metinler İngilizceye hazır tek bir sözlükte toplanır.

## Uygulama sırası
1. Şema kontrolü + ekleme migration'ı + özellik anahtarları.
2. Sunucu fonksiyonları ve v2 API uçları + testler.
3. Ürün listesi/formu, koleksiyonlar.
4. Müşteri listesi/detayı, notlar, segment oluşturucu.
5. Kurumsal mağaza hesabıyla tarayıcıda uçtan uca kontrol.
