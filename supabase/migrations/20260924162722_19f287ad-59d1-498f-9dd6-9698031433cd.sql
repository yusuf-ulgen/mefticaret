ALTER TABLE public.analytics_events
  ADD COLUMN IF NOT EXISTS page_title text,
  ADD COLUMN IF NOT EXISTS time_on_page_ms integer;
CREATE INDEX IF NOT EXISTS analytics_events_store_session_created_idx ON public.analytics_events (store_id, created_at DESC, session_id);

CREATE OR REPLACE VIEW public.analytics_sessions_v
WITH (security_invoker = true) AS
SELECT
  e.store_id,
  e.session_id,
  min(e.visitor_id) AS visitor_id,
  (array_agg(e.source ORDER BY e.created_at))[1] AS source,
  (array_agg(e.medium ORDER BY e.created_at))[1] AS medium,
  (array_agg(e.campaign ORDER BY e.created_at))[1] AS campaign,
  (array_agg(e.referrer ORDER BY e.created_at))[1] AS referrer,
  (array_agg(e.path ORDER BY e.created_at))[1] AS landing_page,
  (array_agg(e.device ORDER BY e.created_at))[1] AS device_type,
  (array_agg(e.country ORDER BY e.created_at))[1] AS country,
  (array_agg(e.city ORDER BY e.created_at))[1] AS city,
  min(e.created_at) AS started_at,
  max(e.created_at) AS ended_at,
  count(*) FILTER (WHERE e.kind = 'page_view')::int AS page_views
FROM public.analytics_events e
GROUP BY e.store_id, e.session_id;
GRANT SELECT ON public.analytics_sessions_v TO authenticated;
GRANT SELECT ON public.analytics_sessions_v TO service_role;

CREATE TABLE public.analytics_daily_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  date date NOT NULL,
  sessions integer NOT NULL DEFAULT 0,
  visitors integer NOT NULL DEFAULT 0,
  page_views integer NOT NULL DEFAULT 0,
  orders integer NOT NULL DEFAULT 0,
  revenue numeric(14,2) NOT NULL DEFAULT 0,
  avg_order_value numeric(14,2) NOT NULL DEFAULT 0,
  conversion_rate numeric(8,4) NOT NULL DEFAULT 0,
  returning_customers integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, date)
);
GRANT SELECT ON public.analytics_daily_summary TO authenticated;
GRANT ALL ON public.analytics_daily_summary TO service_role;
ALTER TABLE public.analytics_daily_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store members read daily summary" ON public.analytics_daily_summary
  FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE TABLE public.analytics_report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  report_key text NOT NULL CHECK (report_key IN ('daily_sales','weekly_performance','monthly_growth','product_performance','customer_segments')),
  frequency text NOT NULL CHECK (frequency IN ('daily','weekly','monthly')),
  recipients text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  last_sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, report_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_report_schedules TO authenticated;
GRANT ALL ON public.analytics_report_schedules TO service_role;
ALTER TABLE public.analytics_report_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store members manage report schedules" ON public.analytics_report_schedules
  FOR ALL TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE OR REPLACE FUNCTION public.refresh_analytics_daily(_store_id uuid, _date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _from timestamptz := (_date::timestamp AT TIME ZONE 'Europe/Istanbul');
  _to timestamptz := ((_date + 1)::timestamp AT TIME ZONE 'Europe/Istanbul');
  v_sessions int; v_visitors int; v_pv int;
  v_orders int; v_revenue numeric; v_returning int;
BEGIN
  SELECT count(DISTINCT session_id), count(DISTINCT visitor_id), count(*) FILTER (WHERE kind = 'page_view')
    INTO v_sessions, v_visitors, v_pv
  FROM analytics_events WHERE store_id = _store_id AND created_at >= _from AND created_at < _to;

  SELECT count(*), coalesce(sum(grand_total), 0) INTO v_orders, v_revenue
  FROM orders WHERE store_id = _store_id AND placed_at >= _from AND placed_at < _to
    AND payment_status IN ('paid','partially_refunded') AND status <> 'cancelled';

  SELECT count(DISTINCT o.customer_id) INTO v_returning
  FROM orders o
  WHERE o.store_id = _store_id AND o.placed_at >= _from AND o.placed_at < _to AND o.customer_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM orders p WHERE p.store_id = _store_id AND p.customer_id = o.customer_id AND p.placed_at < _from);

  INSERT INTO analytics_daily_summary AS s (store_id, date, sessions, visitors, page_views, orders, revenue, avg_order_value, conversion_rate, returning_customers, updated_at)
  VALUES (_store_id, _date, v_sessions, v_visitors, v_pv, v_orders, v_revenue,
    CASE WHEN v_orders > 0 THEN round(v_revenue / v_orders, 2) ELSE 0 END,
    CASE WHEN v_sessions > 0 THEN round(v_orders::numeric / v_sessions, 4) ELSE 0 END,
    v_returning, now())
  ON CONFLICT (store_id, date) DO UPDATE SET
    sessions = EXCLUDED.sessions, visitors = EXCLUDED.visitors, page_views = EXCLUDED.page_views,
    orders = EXCLUDED.orders, revenue = EXCLUDED.revenue, avg_order_value = EXCLUDED.avg_order_value,
    conversion_rate = EXCLUDED.conversion_rate, returning_customers = EXCLUDED.returning_customers, updated_at = now();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.refresh_analytics_daily(uuid, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.refresh_analytics_daily_all(_date date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT store_id FROM analytics_events
      WHERE created_at >= (_date::timestamp AT TIME ZONE 'Europe/Istanbul') AND created_at < ((_date + 1)::timestamp AT TIME ZONE 'Europe/Istanbul')
    UNION
    SELECT DISTINCT store_id FROM orders
      WHERE placed_at >= (_date::timestamp AT TIME ZONE 'Europe/Istanbul') AND placed_at < ((_date + 1)::timestamp AT TIME ZONE 'Europe/Istanbul')
  LOOP
    PERFORM refresh_analytics_daily(r.store_id, _date);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.refresh_analytics_daily_all(date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app_private.trg_orders_analytics_daily()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_analytics_daily(NEW.store_id, (NEW.placed_at AT TIME ZONE 'Europe/Istanbul')::date);
  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_analytics_daily ON public.orders;
CREATE TRIGGER orders_analytics_daily
AFTER INSERT OR UPDATE OF status, payment_status, grand_total ON public.orders
FOR EACH ROW EXECUTE FUNCTION app_private.trg_orders_analytics_daily();

DO $$
DECLARE d date;
BEGIN
  FOR d IN SELECT generate_series((now() AT TIME ZONE 'Europe/Istanbul')::date - 90, (now() AT TIME ZONE 'Europe/Istanbul')::date, interval '1 day')::date LOOP
    PERFORM public.refresh_analytics_daily_all(d);
  END LOOP;
END $$;

-- lovable-cron-fallback-reviewed: 1 run/day; önceki günün özetini kesinleştirir (sipariş tetikleyicisi anlık güncelliyor).
SELECT cron.unschedule('mefticaret-analytics-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mefticaret-analytics-daily');
SELECT cron.schedule('mefticaret-analytics-daily', '5 21 * * *',
  $$ SELECT public.refresh_analytics_daily_all(((now() AT TIME ZONE 'Europe/Istanbul')::date - 1)); $$);

-- lovable-cron-fallback-reviewed: 1 run/day; zamanlanmış analitik rapor e-postaları sabah 08:00 İstanbul.
SELECT cron.unschedule('mefticaret-analytics-reports') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mefticaret-analytics-reports');
SELECT cron.schedule('mefticaret-analytics-reports', '0 5 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--85215043-2289-408a-9b73-0246dd450abe.lovable.app/api/public/cron/analytics-reports',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.settings.cron_secret', true)),
    body := '{}'::jsonb);
  $$);

insert into public.plan_features (plan_id, metric_key, label, unit, limit_value, is_enabled, sort_order)
select p.id, 'module_analytics_v2', 'Analitik Paneli v2', 'modül', null, true, 131
from public.plans p
on conflict (plan_id, metric_key) do nothing;