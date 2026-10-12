-- 1) products: anon may only read storefront-safe columns (no cost_price, tax_rate, internal ids)
REVOKE SELECT ON public.products FROM anon;
GRANT SELECT (
  id, store_id, title, slug, description, status, vendor, product_type, tags,
  base_price, compare_at_price, currency, track_inventory, seo, created_at, updated_at,
  sku, barcode, seller_name, video_url, weight_grams, length_cm, width_cm, height_cm,
  variant_options, brand_id, category_id
) ON public.products TO anon;

-- 2) product_variants: anon may only read storefront-safe columns (no cost_price)
REVOKE SELECT ON public.product_variants FROM anon;
GRANT SELECT (
  id, product_id, store_id, title, sku, barcode, options, price, compare_at_price,
  stock, weight_grams, position, low_stock_threshold, image_id, created_at, updated_at
) ON public.product_variants TO anon;

-- 3) translation_entries: public read only for published stores
DROP POLICY IF EXISTS "translation_entries public read" ON public.translation_entries;
CREATE POLICY "translation_entries public read"
ON public.translation_entries
FOR SELECT
TO anon, authenticated
USING (status <> 'missing'::translation_status AND app_private.is_store_published(store_id));