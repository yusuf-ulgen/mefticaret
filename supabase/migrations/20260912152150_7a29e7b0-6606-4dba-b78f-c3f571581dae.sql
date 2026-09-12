DO $$
DECLARE t text; c text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','product_variants'] LOOP
    NULL;
  END LOOP;
END $$;