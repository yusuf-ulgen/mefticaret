-- SECURITY INVOKER: tüm toplamlar çağıranın orders RLS kapsamına tabidir.
CREATE OR REPLACE FUNCTION public.store_order_summary(_store_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH scoped AS (SELECT * FROM public.orders WHERE store_id = _store_id),
  statuses AS (SELECT status::text key, count(*) value FROM scoped GROUP BY status),
  revenues AS (SELECT currency, sum(grand_total) total FROM scoped WHERE payment_status = 'paid' AND status <> 'cancelled' GROUP BY currency)
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM scoped),
    'counts', COALESCE((SELECT jsonb_object_agg(key, value) FROM statuses), '{}'::jsonb),
    'awaitingPayment', (SELECT count(*) FROM scoped WHERE payment_status = 'pending' AND status NOT IN ('cancelled', 'returned', 'refunded')),
    'paidRevenue', COALESCE((SELECT jsonb_object_agg(currency, total) FROM revenues), '{}'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.store_order_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.store_order_summary(uuid) TO authenticated;
