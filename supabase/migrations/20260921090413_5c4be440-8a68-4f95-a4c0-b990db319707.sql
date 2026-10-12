CREATE OR REPLACE FUNCTION public.release_variant_stock(_variant_id uuid, _qty integer)
RETURNS TABLE(stock_before integer, stock_after integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_stock integer;
BEGIN
  IF _qty IS NULL OR _qty <= 0 THEN
    RAISE EXCEPTION 'Geçersiz adet';
  END IF;

  SELECT stock INTO current_stock FROM public.product_variants WHERE id = _variant_id FOR UPDATE;
  IF current_stock IS NULL THEN
    RAISE EXCEPTION 'Varyant bulunamadı';
  END IF;

  UPDATE public.product_variants SET stock = current_stock + _qty WHERE id = _variant_id;

  stock_before := current_stock;
  stock_after := current_stock + _qty;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.release_variant_stock(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_variant_stock(uuid, integer) TO service_role;