ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS is_public_catalog boolean NOT NULL DEFAULT true;

CREATE TABLE public.store_supplier_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  supplier_product_id uuid NOT NULL REFERENCES public.supplier_products(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  markup_percent numeric NOT NULL DEFAULT 0,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, supplier_product_id)
);
CREATE INDEX store_supplier_imports_sp_idx ON public.store_supplier_imports(supplier_product_id);
GRANT SELECT ON public.store_supplier_imports TO authenticated;
GRANT ALL ON public.store_supplier_imports TO service_role;
ALTER TABLE public.store_supplier_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store members read imports" ON public.store_supplier_imports
  FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE TRIGGER store_supplier_imports_updated BEFORE UPDATE ON public.store_supplier_imports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();