ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS bank_account_name text,
  ADD COLUMN IF NOT EXISTS commission_rate numeric(5,3) NOT NULL DEFAULT 0.50;

CREATE TABLE public.supplier_commission_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  gross_amount numeric(14,2) NOT NULL DEFAULT 0,
  commission_rate numeric(5,3) NOT NULL DEFAULT 0.50,
  commission_amount numeric(14,2) NOT NULL DEFAULT 0,
  net_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','payable','paid','cancelled')),
  payout_request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_item_id, supplier_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_commission_entries TO authenticated;
GRANT ALL ON public.supplier_commission_entries TO service_role;
ALTER TABLE public.supplier_commission_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY supplier_commission_member_read ON public.supplier_commission_entries
  FOR SELECT TO authenticated
  USING (
    app_private.is_store_member(store_id, auth.uid())
    OR app_private.has_role(auth.uid(), 'platform_admin')
    OR EXISTS (
      SELECT 1 FROM public.suppliers s
      WHERE s.id = supplier_id AND s.portal_user_id = auth.uid() AND s.portal_enabled
    )
  );

CREATE POLICY supplier_commission_manage ON public.supplier_commission_entries
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE INDEX supplier_commission_supplier_idx ON public.supplier_commission_entries (supplier_id, status);
CREATE INDEX supplier_commission_store_idx ON public.supplier_commission_entries (store_id, created_at DESC);

CREATE TRIGGER supplier_commission_set_updated_at
  BEFORE UPDATE ON public.supplier_commission_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.supplier_payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  iban text NOT NULL,
  account_name text,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','paid','rejected')),
  note text,
  admin_note text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_payout_requests TO authenticated;
GRANT ALL ON public.supplier_payout_requests TO service_role;
ALTER TABLE public.supplier_payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY supplier_payout_read ON public.supplier_payout_requests
  FOR SELECT TO authenticated
  USING (
    app_private.is_store_member(store_id, auth.uid())
    OR app_private.has_role(auth.uid(), 'platform_admin')
    OR EXISTS (
      SELECT 1 FROM public.suppliers s
      WHERE s.id = supplier_id AND s.portal_user_id = auth.uid() AND s.portal_enabled
    )
  );

CREATE POLICY supplier_payout_supplier_insert ON public.supplier_payout_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.suppliers s
      WHERE s.id = supplier_id AND s.store_id = store_id AND s.portal_user_id = auth.uid() AND s.portal_enabled
    )
    OR app_private.can_manage_store(store_id, auth.uid())
    OR app_private.has_role(auth.uid(), 'platform_admin')
  );

CREATE POLICY supplier_payout_manage ON public.supplier_payout_requests
  FOR UPDATE TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY supplier_payout_delete ON public.supplier_payout_requests
  FOR DELETE TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE INDEX supplier_payout_supplier_idx ON public.supplier_payout_requests (supplier_id, created_at DESC);

CREATE TRIGGER supplier_payout_set_updated_at
  BEFORE UPDATE ON public.supplier_payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.supplier_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'file' CHECK (source IN ('file','url')),
  file_name text,
  source_url text,
  format text NOT NULL DEFAULT 'csv' CHECK (format IN ('csv','xml','xlsx','json')),
  row_count integer NOT NULL DEFAULT 0,
  valid_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  created_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  field_map jsonb NOT NULL DEFAULT '{}',
  errors jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','failed','partial')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_import_jobs TO authenticated;
GRANT ALL ON public.supplier_import_jobs TO service_role;
ALTER TABLE public.supplier_import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY supplier_import_read ON public.supplier_import_jobs
  FOR SELECT TO authenticated
  USING (
    app_private.is_store_member(store_id, auth.uid())
    OR app_private.has_role(auth.uid(), 'platform_admin')
    OR EXISTS (
      SELECT 1 FROM public.suppliers s
      WHERE s.id = supplier_id AND s.portal_user_id = auth.uid() AND s.portal_enabled
    )
  );

CREATE POLICY supplier_import_manage ON public.supplier_import_jobs
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE INDEX supplier_import_supplier_idx ON public.supplier_import_jobs (supplier_id, created_at DESC);

CREATE TRIGGER supplier_import_set_updated_at
  BEFORE UPDATE ON public.supplier_import_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION app_private.split_order_to_suppliers(_order_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store uuid;
  v_currency text;
  v_count integer := 0;
  r record;
BEGIN
  SELECT store_id, currency INTO v_store, v_currency FROM public.orders WHERE id = _order_id;
  IF v_store IS NULL THEN RETURN 0; END IF;

  FOR r IN
    SELECT DISTINCT sp.supplier_id
    FROM public.order_items oi
    JOIN public.supplier_products sp
      ON (sp.variant_id = oi.variant_id OR (oi.variant_id IS NULL AND sp.product_id = oi.product_id))
    WHERE oi.order_id = _order_id AND sp.supplier_id IS NOT NULL
  LOOP
    INSERT INTO public.dropship_orders (store_id, supplier_id, order_id, status, payload)
    SELECT v_store, r.supplier_id, _order_id, 'pending', '{}'::jsonb
    WHERE NOT EXISTS (
      SELECT 1 FROM public.dropship_orders d
      WHERE d.order_id = _order_id AND d.supplier_id = r.supplier_id
    );
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO public.supplier_commission_entries (
    store_id, supplier_id, order_id, order_item_id, quantity,
    gross_amount, commission_rate, commission_amount, net_amount, currency
  )
  SELECT DISTINCT ON (oi.id, sp.supplier_id)
    v_store,
    sp.supplier_id,
    _order_id,
    oi.id,
    oi.quantity,
    COALESCE(oi.line_total, 0),
    COALESCE(s.commission_rate, 0.50),
    round(COALESCE(oi.line_total, 0) * COALESCE(s.commission_rate, 0.50) / 100, 2),
    COALESCE(oi.line_total, 0) - round(COALESCE(oi.line_total, 0) * COALESCE(s.commission_rate, 0.50) / 100, 2),
    COALESCE(v_currency, 'TRY')
  FROM public.order_items oi
  JOIN public.supplier_products sp
    ON (sp.variant_id = oi.variant_id OR (oi.variant_id IS NULL AND sp.product_id = oi.product_id))
  JOIN public.suppliers s ON s.id = sp.supplier_id
  WHERE oi.order_id = _order_id AND sp.supplier_id IS NOT NULL
  ON CONFLICT (order_item_id, supplier_id) DO NOTHING;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.orders_split_to_suppliers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status = 'paid' AND (TG_OP = 'INSERT' OR COALESCE(OLD.payment_status, '') <> 'paid') THEN
    PERFORM app_private.split_order_to_suppliers(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_split_to_suppliers
  AFTER INSERT OR UPDATE OF payment_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION app_private.orders_split_to_suppliers();