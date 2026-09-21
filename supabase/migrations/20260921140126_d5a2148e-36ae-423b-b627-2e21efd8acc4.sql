DO $$
DECLARE
  t text;
  cols text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','product_variants'] LOOP
    REVOKE SELECT ON TABLE public.products FROM anon;
  END LOOP;
END $$;

REVOKE SELECT ON TABLE public.products FROM anon;
REVOKE SELECT ON TABLE public.product_variants FROM anon;

DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg(format('%I', column_name), ', ' ORDER BY ordinal_position)
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'products' AND column_name <> 'cost_price';
  EXECUTE format('GRANT SELECT (%s) ON public.products TO anon', cols);

  SELECT string_agg(format('%I', column_name), ', ' ORDER BY ordinal_position)
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'product_variants' AND column_name <> 'cost_price';
  EXECUTE format('GRANT SELECT (%s) ON public.product_variants TO anon', cols);
END $$;
