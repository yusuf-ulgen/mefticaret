-- Maliyet fiyatı (alış fiyatı) halka açık vitrin okumalarından gizlenir.
-- PostgREST sütun düzeyi GRANT'lere uyar; anon rolü cost_price'ı artık okuyamaz.
REVOKE SELECT (cost_price) ON public.products FROM anon;
REVOKE SELECT (cost_price) ON public.product_variants FROM anon;