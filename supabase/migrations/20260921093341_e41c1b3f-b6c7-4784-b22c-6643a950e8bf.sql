ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS stores_is_test_idx ON public.stores (is_test) WHERE is_test;

CREATE TABLE IF NOT EXISTS public.load_test_config (
  id integer PRIMARY KEY DEFAULT 1,
  enabled boolean NOT NULL DEFAULT false,
  paused boolean NOT NULL DEFAULT false,
  cycle_minutes integer NOT NULL DEFAULT 180,
  stores_target integer NOT NULL DEFAULT 1000,
  products_target integer NOT NULL DEFAULT 50000,
  vusers_target integer NOT NULL DEFAULT 500,
  orders_target integer NOT NULL DEFAULT 10000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT load_test_config_singleton CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS public.load_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_no integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'running',
  phase text NOT NULL DEFAULT 'purge',
  scale jsonb NOT NULL DEFAULT '{}'::jsonb,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  findings_count integer NOT NULL DEFAULT 0,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  phase_started_at timestamptz NOT NULL DEFAULT now(),
  next_cycle_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS load_test_runs_started_idx ON public.load_test_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS load_test_runs_active_idx ON public.load_test_runs (status) WHERE status = 'running';

CREATE TABLE IF NOT EXISTS public.load_test_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.load_test_runs(id) ON DELETE CASCADE,
  phase text NOT NULL,
  level text NOT NULL DEFAULT 'INFO',
  message text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS load_test_events_run_idx ON public.load_test_events (run_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.load_test_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.load_test_runs(id) ON DELETE CASCADE,
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'WARNING',
  detail text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS load_test_findings_run_idx ON public.load_test_findings (run_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.load_test_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.load_test_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.load_test_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.load_test_findings TO authenticated;
GRANT ALL ON public.load_test_config TO service_role;
GRANT ALL ON public.load_test_runs TO service_role;
GRANT ALL ON public.load_test_events TO service_role;
GRANT ALL ON public.load_test_findings TO service_role;

ALTER TABLE public.load_test_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.load_test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.load_test_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.load_test_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "load_test_config_admin" ON public.load_test_config FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "load_test_runs_admin" ON public.load_test_runs FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "load_test_events_admin" ON public.load_test_events FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "load_test_findings_admin" ON public.load_test_findings FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'));

CREATE TRIGGER load_test_config_touch BEFORE UPDATE ON public.load_test_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER load_test_runs_touch BEFORE UPDATE ON public.load_test_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.load_test_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.purge_load_test_data(_drop_stores boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  targets text[][] := ARRAY[
    ['order_items','store_id'], ['order_addresses','store_id'], ['order_events','store_id'],
    ['order_status_history','store_id'], ['order_notes','store_id'], ['order_delegations','store_id'],
    ['order_addon_selections','store_id'], ['payment_transactions','store_id'], ['payments','store_id'],
    ['refunds','store_id'], ['return_items','store_id'], ['return_requests','store_id'],
    ['commissions','store_id'], ['ledger_entries','store_id'], ['invoice_payments','store_id'],
    ['invoices','store_id'], ['global_shipments','store_id'], ['dropship_orders','store_id'],
    ['loyalty_transactions','store_id'], ['loyalty_accounts','store_id'], ['analytics_events','store_id'],
    ['cart_items','store_id'], ['carts','store_id'], ['abandoned_carts','store_id'],
    ['orders','store_id'], ['inventory_movements','store_id'], ['inventory_levels','store_id'],
    ['product_variant_options','store_id'], ['product_option_values','store_id'], ['product_options','store_id'],
    ['product_images','store_id'], ['product_collections','store_id'], ['product_reviews','store_id'],
    ['product_questions','store_id'], ['channel_listings','store_id'], ['supplier_products','store_id'],
    ['product_variants','store_id'], ['products','store_id'], ['customer_addresses','store_id'],
    ['customers','store_id'], ['notifications','store_id'], ['job_queue','store_id'],
    ['ledger_accounts','store_id'], ['audit_logs','store_id'], ['security_events','store_id']
  ];
  i integer;
  tbl text;
  col text;
  deleted bigint;
  total bigint := 0;
  per jsonb := '{}'::jsonb;
  dropped integer := 0;
BEGIN
  FOR i IN 1 .. array_length(targets, 1) LOOP
    tbl := targets[i][1];
    col := targets[i][2];
    IF to_regclass('public.' || tbl) IS NULL THEN CONTINUE; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = col
    ) THEN CONTINUE; END IF;
    BEGIN
      EXECUTE format(
        'DELETE FROM public.%I WHERE %I IN (SELECT id FROM public.stores WHERE is_test)', tbl, col
      );
      GET DIAGNOSTICS deleted = ROW_COUNT;
      IF deleted > 0 THEN
        total := total + deleted;
        per := per || jsonb_build_object(tbl, deleted);
      END IF;
    EXCEPTION WHEN others THEN
      per := per || jsonb_build_object(tbl, 'error: ' || SQLERRM);
    END;
  END LOOP;

  IF _drop_stores THEN
    BEGIN
      DELETE FROM public.stores WHERE is_test;
      GET DIAGNOSTICS dropped = ROW_COUNT;
    EXCEPTION WHEN others THEN
      dropped := -1;
    END;
  END IF;

  RETURN jsonb_build_object('deleted_total', total, 'per_table', per, 'stores_dropped', dropped);
END;
$$;

REVOKE ALL ON FUNCTION public.purge_load_test_data(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_load_test_data(boolean) TO service_role;