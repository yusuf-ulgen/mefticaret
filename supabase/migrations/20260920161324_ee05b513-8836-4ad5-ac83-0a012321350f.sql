CREATE TABLE public.marketing_spend (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  spend_date date NOT NULL DEFAULT current_date,
  channel text NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_spend TO authenticated;
GRANT ALL ON public.marketing_spend TO service_role;
ALTER TABLE public.marketing_spend ENABLE ROW LEVEL SECURITY;

CREATE POLICY marketing_spend_member_read ON public.marketing_spend
  FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY marketing_spend_manage ON public.marketing_spend
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE INDEX marketing_spend_store_date_idx ON public.marketing_spend (store_id, spend_date DESC);

CREATE TRIGGER marketing_spend_tenant_guard
  BEFORE INSERT OR UPDATE ON public.marketing_spend
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs();

CREATE TRIGGER marketing_spend_set_updated_at
  BEFORE UPDATE ON public.marketing_spend
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.finance_cost_settings (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  payment_commission_rate numeric(6,3) NOT NULL DEFAULT 0,
  shipping_cost_per_order numeric(14,2) NOT NULL DEFAULT 0,
  packaging_cost_per_order numeric(14,2) NOT NULL DEFAULT 0,
  overhead_rate numeric(6,3) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_cost_settings TO authenticated;
GRANT ALL ON public.finance_cost_settings TO service_role;
ALTER TABLE public.finance_cost_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY finance_cost_settings_member_read ON public.finance_cost_settings
  FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY finance_cost_settings_manage ON public.finance_cost_settings
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE TRIGGER finance_cost_settings_tenant_guard
  BEFORE INSERT OR UPDATE ON public.finance_cost_settings
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs();

CREATE TRIGGER finance_cost_settings_set_updated_at
  BEFORE UPDATE ON public.finance_cost_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();