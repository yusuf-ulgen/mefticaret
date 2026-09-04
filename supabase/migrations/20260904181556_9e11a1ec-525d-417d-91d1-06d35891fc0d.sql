CREATE INDEX IF NOT EXISTS product_images_product_idx ON public.product_images (product_id, position);
CREATE INDEX IF NOT EXISTS order_items_store_created_idx ON public.order_items (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_store_status_idx ON public.orders (store_id, status, placed_at DESC);
CREATE INDEX IF NOT EXISTS orders_store_payment_idx ON public.orders (store_id, payment_status, placed_at DESC);
CREATE INDEX IF NOT EXISTS product_variants_store_stock_idx ON public.product_variants (store_id, stock);
CREATE INDEX IF NOT EXISTS store_domains_hostname_idx ON public.store_domains (lower(hostname));
CREATE INDEX IF NOT EXISTS cache_entries_expires_idx ON public.cache_entries (expires_at);