ALTER TABLE public.store_global_settings
  ADD COLUMN IF NOT EXISTS price_rounding_rule text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS settlement_currencies text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.store_global_settings
  DROP CONSTRAINT IF EXISTS store_global_settings_rounding_check;
ALTER TABLE public.store_global_settings
  ADD CONSTRAINT store_global_settings_rounding_check
  CHECK (price_rounding_rule IN ('none','end_99','end_90','nearest_integer','nearest_5'));

CREATE TABLE IF NOT EXISTS public.product_country_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'all' CHECK (mode IN ('all','allow','block')),
  country_codes text[] NOT NULL DEFAULT '{}',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_country_rules TO authenticated;
GRANT SELECT ON public.product_country_rules TO anon;
GRANT ALL ON public.product_country_rules TO service_role;
ALTER TABLE public.product_country_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_country_rules_manage" ON public.product_country_rules FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "product_country_rules_select" ON public.product_country_rules FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "product_country_rules_public_read" ON public.product_country_rules FOR SELECT TO anon
  USING (app_private.is_store_published(store_id));
CREATE TRIGGER product_country_rules_tenant_guard BEFORE INSERT OR UPDATE ON public.product_country_rules
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs('product_id', 'products');
CREATE TRIGGER product_country_rules_updated BEFORE UPDATE ON public.product_country_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.variant_customs_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  hs_code text,
  origin_country text,
  weight_grams integer,
  description_en text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (variant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.variant_customs_profiles TO authenticated;
GRANT ALL ON public.variant_customs_profiles TO service_role;
ALTER TABLE public.variant_customs_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "variant_customs_profiles_manage" ON public.variant_customs_profiles FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "variant_customs_profiles_select" ON public.variant_customs_profiles FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE TRIGGER variant_customs_profiles_tenant_guard BEFORE INSERT OR UPDATE ON public.variant_customs_profiles
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs('variant_id', 'product_variants');
CREATE TRIGGER variant_customs_profiles_updated BEFORE UPDATE ON public.variant_customs_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.fulfillment_warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  provider text NOT NULL DEFAULT 'own' CHECK (provider IN ('own','amazon_fba','shipbob','third_party')),
  country_code text NOT NULL DEFAULT 'TR',
  city text,
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  credentials_ready boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fulfillment_warehouses TO authenticated;
GRANT ALL ON public.fulfillment_warehouses TO service_role;
ALTER TABLE public.fulfillment_warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fulfillment_warehouses_manage" ON public.fulfillment_warehouses FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "fulfillment_warehouses_select" ON public.fulfillment_warehouses FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE TRIGGER fulfillment_warehouses_updated BEFORE UPDATE ON public.fulfillment_warehouses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.warehouse_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.fulfillment_warehouses(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  available integer NOT NULL DEFAULT 0 CHECK (available >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (warehouse_id, variant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouse_inventory TO authenticated;
GRANT ALL ON public.warehouse_inventory TO service_role;
ALTER TABLE public.warehouse_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "warehouse_inventory_manage" ON public.warehouse_inventory FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "warehouse_inventory_select" ON public.warehouse_inventory FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE TRIGGER warehouse_inventory_tenant_guard BEFORE INSERT OR UPDATE ON public.warehouse_inventory
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs('warehouse_id', 'fulfillment_warehouses', 'variant_id', 'product_variants');
CREATE TRIGGER warehouse_inventory_updated BEFORE UPDATE ON public.warehouse_inventory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();