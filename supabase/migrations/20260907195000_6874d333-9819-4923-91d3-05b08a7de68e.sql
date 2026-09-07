-- exchange_rate_providers: no public read, platform admins only, secret_name never exposed
REVOKE SELECT ON public.exchange_rate_providers FROM anon;
REVOKE SELECT ON public.exchange_rate_providers FROM authenticated;

DROP POLICY IF EXISTS "providers read auth" ON public.exchange_rate_providers;
CREATE POLICY "providers read platform admin"
  ON public.exchange_rate_providers
  FOR SELECT
  TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'::app_role));

GRANT SELECT (
  id, code, name, adapter, base_url, requires_key, priority, is_active,
  last_status, last_error, last_success_at, failure_count, created_at, updated_at
) ON public.exchange_rate_providers TO authenticated;

GRANT ALL ON public.exchange_rate_providers TO service_role;

-- ai_providers: keep secret reference name out of client-readable columns
REVOKE SELECT ON public.ai_providers FROM anon;
GRANT SELECT (
  id, code, name, description, models, default_model, requires_api_key,
  is_enabled, sort_order, created_at, updated_at
) ON public.ai_providers TO authenticated;
GRANT ALL ON public.ai_providers TO service_role;

-- products / product_variants: re-assert that cost data stays out of public reads
REVOKE SELECT ON public.products FROM anon;
REVOKE SELECT ON public.product_variants FROM anon;

GRANT SELECT (
  id, store_id, title, slug, description, status, product_type, sku, barcode,
  base_price, compare_at_price, currency, brand_id, category_id, tags, vendor,
  seller_name, seo, track_inventory, variant_options, video_url,
  weight_grams, width_cm, height_cm, length_cm, created_at, updated_at
) ON public.products TO anon;

GRANT SELECT (
  id, store_id, product_id, title, sku, barcode, price, compare_at_price,
  stock, low_stock_threshold, options, position, image_id, weight_grams,
  created_at, updated_at
) ON public.product_variants TO anon;