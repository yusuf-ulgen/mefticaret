CREATE TABLE IF NOT EXISTS public.xml_analytics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id uuid NOT NULL REFERENCES public.xml_feeds(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  total_products_count integer NOT NULL DEFAULT 0,
  out_of_stock_count integer NOT NULL DEFAULT 0,
  price_changed_count integer NOT NULL DEFAULT 0,
  stock_changed_count integer NOT NULL DEFAULT 0,
  sync_duration_avg_seconds numeric(8,2) NOT NULL DEFAULT 0,
  success_rate_percent numeric(5,2) NOT NULL DEFAULT 100.0,
  quarantined_items_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (feed_id, date)
);

CREATE INDEX IF NOT EXISTS xml_analytics_daily_store_date_idx
  ON public.xml_analytics_daily (store_id, date DESC);

GRANT SELECT ON public.xml_analytics_daily TO authenticated;
GRANT ALL ON public.xml_analytics_daily TO service_role;

ALTER TABLE public.xml_analytics_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "xml_analytics_daily_select_store_managers"
  ON public.xml_analytics_daily FOR SELECT TO authenticated
  USING (
    app_private.can_manage_store(store_id, auth.uid())
    OR app_private.has_role(auth.uid(), 'platform_admin')
  );

CREATE POLICY "xml_analytics_daily_service_all"
  ON public.xml_analytics_daily FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER set_xml_analytics_daily_updated_at
  BEFORE UPDATE ON public.xml_analytics_daily
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();