CREATE OR REPLACE FUNCTION app_private.supplier_products_fill_supplier()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RETURN NEW;
END;
$$;