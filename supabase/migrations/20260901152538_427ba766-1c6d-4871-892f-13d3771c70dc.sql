CREATE TABLE public.tax_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_classes TO authenticated;
GRANT SELECT ON public.tax_classes TO anon;
GRANT ALL ON public.tax_classes TO service_role;
ALTER TABLE public.tax_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tax_classes_member_read" ON public.tax_classes FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "tax_classes_public_read" ON public.tax_classes FOR SELECT TO anon
  USING (app_private.is_store_published(store_id));
CREATE POLICY "tax_classes_manage" ON public.tax_classes FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER tax_classes_set_updated_at BEFORE UPDATE ON public.tax_classes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.tax_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  tax_class_id uuid REFERENCES public.tax_classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  country_code text,
  region text,
  rate numeric(6,3) NOT NULL DEFAULT 0,
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tax_rules_store_idx ON public.tax_rules (store_id, is_active, priority DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_rules TO authenticated;
GRANT SELECT ON public.tax_rules TO anon;
GRANT ALL ON public.tax_rules TO service_role;
ALTER TABLE public.tax_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tax_rules_member_read" ON public.tax_rules FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "tax_rules_public_read" ON public.tax_rules FOR SELECT TO anon
  USING (app_private.is_store_published(store_id));
CREATE POLICY "tax_rules_manage" ON public.tax_rules FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER tax_rules_set_updated_at BEFORE UPDATE ON public.tax_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.currency_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  base_currency text NOT NULL,
  quote_currency text NOT NULL,
  rate numeric(18,8) NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'manual',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, base_currency, quote_currency)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.currency_rates TO authenticated;
GRANT SELECT ON public.currency_rates TO anon;
GRANT ALL ON public.currency_rates TO service_role;
ALTER TABLE public.currency_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "currency_rates_member_read" ON public.currency_rates FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "currency_rates_public_read" ON public.currency_rates FOR SELECT TO anon
  USING (app_private.is_store_published(store_id));
CREATE POLICY "currency_rates_manage" ON public.currency_rates FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER currency_rates_set_updated_at BEFORE UPDATE ON public.currency_rates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS base_currency text NOT NULL DEFAULT 'TRY',
  ADD COLUMN IF NOT EXISTS display_currencies text[] NOT NULL DEFAULT ARRAY['TRY']::text[],
  ADD COLUMN IF NOT EXISTS auto_currency_rates boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_locale text NOT NULL DEFAULT 'tr',
  ADD COLUMN IF NOT EXISTS supported_locales text[] NOT NULL DEFAULT ARRAY['tr','en']::text[];

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS tax_class_id uuid REFERENCES public.tax_classes(id) ON DELETE SET NULL;