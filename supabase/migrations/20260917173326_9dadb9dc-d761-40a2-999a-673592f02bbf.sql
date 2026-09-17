REVOKE SELECT ON public.products FROM anon;
GRANT SELECT (
  id, store_id, title, slug, description, status, vendor, product_type, tags,
  base_price, compare_at_price, currency, track_inventory, seo, created_at, updated_at,
  sku, barcode, seller_name, video_url, tax_rate, weight_grams, length_cm, width_cm,
  height_cm, variant_options, tax_class_id, brand_id, vendor_id, category_id,
  made_to_order, prep_days, custom_note_enabled, custom_note_label
) ON public.products TO anon;

REVOKE SELECT ON public.product_variants FROM anon;
GRANT SELECT (
  id, product_id, store_id, title, sku, barcode, options, price, compare_at_price,
  stock, weight_grams, position, image_id, created_at, updated_at
) ON public.product_variants TO anon;