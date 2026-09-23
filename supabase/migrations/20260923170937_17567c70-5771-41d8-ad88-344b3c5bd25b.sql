CREATE OR REPLACE FUNCTION public.purge_store_completely(_store_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id) THEN
    RAISE EXCEPTION 'Mağaza bulunamadı';
  END IF;
  -- Finans defteri korumasını bu mağaza için kaldır (silme onaylı süper admin işlemi)
  UPDATE public.stores SET is_test = true WHERE id = _store_id;
  DELETE FROM public.ledger_entries WHERE store_id = _store_id;
  DELETE FROM public.stock_transfers WHERE store_id = _store_id;
  DELETE FROM public.kolay_packaging_orders WHERE store_id = _store_id;
  DELETE FROM public.support_tickets WHERE store_id = _store_id;
  DELETE FROM public.qnbpay_transactions WHERE store_id = _store_id;
  DELETE FROM public.home_maker_profiles WHERE store_id = _store_id;
  DELETE FROM public.stores WHERE id = _store_id;
END; $$;
REVOKE ALL ON FUNCTION public.purge_store_completely(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_store_completely(uuid) TO service_role;