UPDATE public.supplier_products sp
SET supplier_id = f.supplier_id
FROM public.supplier_feeds f
WHERE sp.feed_id = f.id AND sp.supplier_id IS NULL AND f.supplier_id IS NOT NULL;

CREATE OR REPLACE FUNCTION app_private.supplier_products_fill_supplier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.supplier_id IS NULL AND NEW.feed_id IS NOT NULL THEN
    SELECT f.supplier_id INTO NEW.supplier_id FROM public.supplier_feeds f WHERE f.id = NEW.feed_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS supplier_products_fill_supplier ON public.supplier_products;
CREATE TRIGGER supplier_products_fill_supplier
  BEFORE INSERT OR UPDATE ON public.supplier_products
  FOR EACH ROW EXECUTE FUNCTION app_private.supplier_products_fill_supplier();