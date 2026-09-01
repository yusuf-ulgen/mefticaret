-- Ürün listeleme + sayfalama (storefront ve panel)
CREATE INDEX IF NOT EXISTS products_store_created_idx
  ON public.products (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS products_store_status_created_idx
  ON public.products (store_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS products_store_price_idx
  ON public.products (store_id, base_price);
CREATE INDEX IF NOT EXISTS products_store_title_idx
  ON public.products (store_id, title);

-- Koleksiyon ve kategori sayfaları
CREATE INDEX IF NOT EXISTS product_collections_collection_idx
  ON public.product_collections (collection_id);
CREATE INDEX IF NOT EXISTS product_collections_product_idx
  ON public.product_collections (product_id);

-- Sipariş kalemi bazlı raporlar
CREATE INDEX IF NOT EXISTS order_items_variant_idx
  ON public.order_items (variant_id);
CREATE INDEX IF NOT EXISTS order_items_product_idx
  ON public.order_items (product_id);

-- Sepet kalemleri
CREATE INDEX IF NOT EXISTS cart_items_variant_idx
  ON public.cart_items (variant_id);

-- Okunmamış bildirim sayacı
CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON public.notifications (store_id, created_at DESC)
  WHERE is_read = false;

-- Kuyruk kayıtlarının mağaza bazlı listelenmesi
CREATE INDEX IF NOT EXISTS job_queue_store_created_idx
  ON public.job_queue (store_id, created_at DESC);

-- Blog / sayfa listeleri
CREATE INDEX IF NOT EXISTS store_pages_published_idx
  ON public.store_pages (store_id, page_kind, published_at DESC)
  WHERE is_published = true;

-- Stok seviyeleri ve sevkiyatlar
CREATE INDEX IF NOT EXISTS inventory_levels_warehouse_idx
  ON public.inventory_levels (warehouse_id);
CREATE INDEX IF NOT EXISTS shipments_store_created_idx
  ON public.shipments (store_id, created_at DESC);

-- Günlük istatistik sorguları
CREATE INDEX IF NOT EXISTS store_daily_stats_date_idx
  ON public.store_daily_stats (store_id, stat_date DESC);
