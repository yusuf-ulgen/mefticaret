DROP FUNCTION public.kolay_order_packaging(UUID, UUID, INT, TEXT, BOOLEAN);
CREATE OR REPLACE FUNCTION app_private.kolay_order_packaging(_user_id UUID, _store_id UUID, _item_id UUID, _quantity INT, _note TEXT, _use_points BOOLEAN)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it RECORD; bal INT; total NUMERIC; used INT := 0;
BEGIN
  IF NOT app_private.can_manage_store(_store_id, _user_id) THEN RAISE EXCEPTION 'Yetkiniz yok'; END IF;
  IF _quantity < 1 OR _quantity > 50 THEN RAISE EXCEPTION 'Adet 1-50 arası olmalı'; END IF;
  SELECT id, sale_price, currency, is_active INTO it FROM public.kolay_packaging_items WHERE id = _item_id;
  IF NOT FOUND OR NOT it.is_active THEN RAISE EXCEPTION 'Bu ambalaj ürünü şu anda satışta değil'; END IF;
  total := round(it.sale_price * _quantity, 2);
  IF _use_points THEN
    PERFORM pg_advisory_xact_lock(hashtext('mentor_points:' || _store_id::text));
    SELECT COALESCE(sum(delta),0) INTO bal FROM public.kolay_mentor_points WHERE store_id = _store_id;
    used := GREATEST(0, LEAST(bal, floor(total / 2)::INT));
    IF used > 0 THEN
      INSERT INTO public.kolay_mentor_points (store_id, delta, reason) VALUES (_store_id, -used, 'packaging_discount');
    END IF;
  END IF;
  INSERT INTO public.kolay_packaging_orders (store_id, item_id, quantity, unit_price, total, currency, delivery_note, requested_by, points_used)
  VALUES (_store_id, it.id, _quantity, it.sale_price, total - used, it.currency, _note, _user_id, used);
  RETURN json_build_object('ok', true, 'pointsUsed', used, 'total', total - used);
END $$;
REVOKE ALL ON FUNCTION app_private.kolay_order_packaging(UUID, UUID, UUID, INT, TEXT, BOOLEAN) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.kolay_order_packaging(UUID, UUID, UUID, INT, TEXT, BOOLEAN) TO service_role;
CREATE OR REPLACE FUNCTION public.kolay_order_packaging_srv(_user_id UUID, _store_id UUID, _item_id UUID, _quantity INT, _note TEXT, _use_points BOOLEAN)
RETURNS JSON LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  SELECT app_private.kolay_order_packaging(_user_id, _store_id, _item_id, _quantity, _note, _use_points);
$$;
REVOKE ALL ON FUNCTION public.kolay_order_packaging_srv(UUID, UUID, UUID, INT, TEXT, BOOLEAN) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kolay_order_packaging_srv(UUID, UUID, UUID, INT, TEXT, BOOLEAN) TO service_role;