# Satıcı paneli: Tedarikçi Kataloğu ve "Mağazaya Aktar"

## Ne göreceksiniz
- Satıcı panelinde yeni **Tedarikçi Kataloğu** sayfası (menüde "Tedarikçi Ürünleri").
- Üstte tedarikçi seçici: platformdaki **tüm aktif tedarikçiler** listelenir; seçilen tedarikçinin ürünleri gelir. Arama + sayfalama.
- Ürün kartları gönderdiğiniz görseldeki gibi: solda görsel ve üstünde yuvarlak seçim kutusu, sağda ad (2 satır), fiyat, yeşil stok, sağ altta durum rozeti ("Aktarılabilir" / "Mağazada"), ok ile detay.
- Her kartta **Mağazaya aktar**; alttaki sabit çubukta **Seçilenleri aktar (N)** ve **Tümünü seç**.
- Detay sayfasında tüm görseller, açıklama, varyantlar, KDV, kategori önizlemesi.

## Aktarılan bilgiler
Ad, açıklama (uzun), tüm görseller, varyantlar (beden/renk, SKU, barkod, stok), alış fiyatı, satış fiyatı, KDV oranı, marka, kategori (yoksa mağazada aynı adla oluşturulur), ağırlık/desi ve diğer özellikler.
- Ürün **hemen yayında** açılır.
- Satış fiyatı = tedarikçi satış fiyatı; mağaza isterse kendi **kâr oranını** (%) katalog üstünden belirler.
- Aynı ürün ikinci kez aktarılmaz; "Mağazada" görünür.

## Otomatik eşitleme
Tedarikçi stok veya fiyatı değiştirdiğinde (XML eşitleme ya da elle), o ürünü aktarmış tüm mağazalarda stok ve fiyat (mağazanın kâr oranıyla) güncellenir. Siparişler mevcut tedarikçi sipariş akışına bağlanır.

## Güvenlik
- Satıcılar tedarikçi ürünlerini yalnız sunucu üzerinden, salt okunur ve sadece yayınlanabilir alanlarla görür; tedarikçinin ödeme anahtarı, iletişim/iç notları paylaşılmaz.
- Aktarma yalnız kendi mağazasına yapılabilir; mağaza yetkisi sunucuda kontrol edilir.

## Teknik detay
- Migration: `store_supplier_imports` (store_id, supplier_product_id, product_id, markup_percent, last_synced_at, unique(store_id, supplier_product_id)) + GRANT/RLS (mağaza üyeleri okur; yazma yalnız sunucu). `suppliers` için `is_public_catalog` bayrağı (varsayılan aktif tedarikçiler true).
- `src/lib/supplier-catalog.server.ts` + `supplier-catalog.functions.ts`: `listCatalogSuppliers`, `listCatalogProducts`, `getCatalogProduct`, `importCatalogProducts({storeId, ids[], markup})`; raw XML alanlarından varyant/KDV/kategori çıkarımı, kategori bul-ya-oluştur, products + product_variants + media yazımı (toplu, 50'şer).
- Eşitleme: supplier-workflow sync ve tedarikçi fiyat/stok düzenlemesi sonrası `propagateToImporters(supplierProductIds)`.
- Rota: `src/routes/_authenticated/store.$storeId.supplier-catalog.tsx` (+ detay), store nav'a link.
- Kural AGENTS.md'ye eklenir.
