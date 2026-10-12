CREATE OR REPLACE FUNCTION public.rollup_store_daily_stats(target_day date DEFAULT CURRENT_DATE)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer := 0;
BEGIN
  INSERT INTO public.store_daily_stats AS s
    (store_id, stat_date, revenue, orders_count, new_customers, abandoned_carts)
  SELECT
    st.id,
    target_day,
    COALESCE(o.revenue, 0),
    COALESCE(o.cnt, 0),
    COALESCE(c.cnt, 0),
    COALESCE(a.cnt, 0)
  FROM public.stores st
  LEFT JOIN (
    SELECT store_id, SUM(grand_total) AS revenue, COUNT(*) AS cnt
    FROM public.orders
    WHERE placed_at::date = target_day
    GROUP BY store_id
  ) o ON o.store_id = st.id
  LEFT JOIN (
    SELECT store_id, COUNT(*) AS cnt
    FROM public.customers
    WHERE created_at::date = target_day
    GROUP BY store_id
  ) c ON c.store_id = st.id
  LEFT JOIN (
    SELECT store_id, COUNT(*) AS cnt
    FROM public.abandoned_carts
    WHERE last_seen_at::date = target_day AND recovered_order_id IS NULL
    GROUP BY store_id
  ) a ON a.store_id = st.id
  WHERE st.status IN ('active','draft')
  ON CONFLICT (store_id, stat_date) DO UPDATE
    SET revenue = EXCLUDED.revenue,
        orders_count = EXCLUDED.orders_count,
        new_customers = EXCLUDED.new_customers,
        abandoned_carts = EXCLUDED.abandoned_carts;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.rollup_store_daily_stats(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rollup_store_daily_stats(date) TO service_role;

SELECT cron.unschedule('mefticaret-daily-rollup')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mefticaret-daily-rollup');

SELECT cron.schedule(
  'mefticaret-daily-rollup',
  '17 * * * *',
  $$SELECT public.rollup_store_daily_stats(CURRENT_DATE);$$
);