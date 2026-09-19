DO $$
DECLARE
  t text;
  cols text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','product_variants'] LOOP
    SELECT string_agg(format('%I', column_name), ', ')
      INTO cols
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = t
       AND column_name <> 'cost_price';

    EXECUTE format('REVOKE SELECT ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT (%s) ON public.%I TO anon', cols, t);
  END LOOP;
END $$;