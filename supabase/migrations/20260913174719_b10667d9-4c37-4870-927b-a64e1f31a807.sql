-- Ensure internal-only columns are never readable by anonymous storefront visitors
REVOKE SELECT (cost_price) ON public.products FROM anon;
REVOKE SELECT (cost_price) ON public.product_variants FROM anon;
REVOKE SELECT (low_stock_threshold) ON public.product_variants FROM anon;