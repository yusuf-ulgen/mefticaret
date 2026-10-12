ALTER TABLE public.store_supplier_imports ADD COLUMN IF NOT EXISTS sync_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.supplier_products ADD COLUMN IF NOT EXISTS catalog_visible boolean NOT NULL DEFAULT true;
ALTER TABLE public.supplier_products ADD COLUMN IF NOT EXISTS suggested_price numeric;

CREATE TABLE public.store_supplier_category_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  source_category text NOT NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  markup_percent numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, supplier_id, source_category)
);
GRANT SELECT ON public.store_supplier_category_maps TO authenticated;
GRANT ALL ON public.store_supplier_category_maps TO service_role;
ALTER TABLE public.store_supplier_category_maps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store members read category maps" ON public.store_supplier_category_maps
  FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE TRIGGER store_supplier_category_maps_updated BEFORE UPDATE ON public.store_supplier_category_maps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.store_supplier_auto_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  markup_percent numeric NOT NULL DEFAULT 0,
  last_run_at timestamptz,
  last_result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, supplier_id)
);
GRANT SELECT ON public.store_supplier_auto_imports TO authenticated;
GRANT ALL ON public.store_supplier_auto_imports TO service_role;
ALTER TABLE public.store_supplier_auto_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store members read auto imports" ON public.store_supplier_auto_imports
  FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE TRIGGER store_supplier_auto_imports_updated BEFORE UPDATE ON public.store_supplier_auto_imports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();