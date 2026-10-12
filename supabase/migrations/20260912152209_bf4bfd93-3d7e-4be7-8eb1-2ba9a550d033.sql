-- Anonim (vitrin) rolünden tablo geneli SELECT kaldırılır ve cost_price hariç
-- tüm kolonlar için kolon bazlı SELECT verilir.
DO $$
DECLARE
  tbl text;
  cols text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['products', 'product_variants']) LOOP
    EXECUTE format('REVOKE SELECT ON public.%I FROM anon', tbl);

    SELECT string_agg(quote_ident(column_name), ', ')
      INTO cols
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = tbl
       AND column_name <> 'cost_price';

    IF cols IS NOT NULL THEN
      EXECUTE format('GRANT SELECT (%s) ON public.%I TO anon', cols, tbl);
    END IF;
  END LOOP;
END $$;