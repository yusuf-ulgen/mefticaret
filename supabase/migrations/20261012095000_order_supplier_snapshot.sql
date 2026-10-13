CREATE TABLE public.order_item_suppliers (
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(order_item_id,supplier_id)
);
ALTER TABLE public.order_item_suppliers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_item_suppliers FROM anon,authenticated;
GRANT ALL ON public.order_item_suppliers TO service_role;
CREATE INDEX order_item_supplier_order ON public.order_item_suppliers(order_id);

CREATE OR REPLACE FUNCTION public.snapshot_order_item_supplier() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.order_item_suppliers(order_item_id,supplier_id,order_id,store_id,source)
  SELECT NEW.id,supplier_id,NEW.order_id,NEW.store_id,'order_snapshot' FROM (
    SELECT l.supplier_id FROM public.store_supplier_imports l WHERE l.store_id=NEW.store_id AND l.product_id=NEW.product_id
    UNION SELECT sp.supplier_id FROM public.supplier_products sp WHERE
      (NEW.variant_id IS NOT NULL AND sp.variant_id=NEW.variant_id) OR
      (NEW.variant_id IS NULL AND NEW.product_id IS NOT NULL AND sp.product_id=NEW.product_id)
  ) suppliers ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER order_item_supplier_snapshot AFTER INSERT ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.snapshot_order_item_supplier();

CREATE OR REPLACE FUNCTION public.snapshot_commission_supplier() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.order_item_suppliers(order_item_id,supplier_id,order_id,store_id,source)
  SELECT i.id,NEW.supplier_id,i.order_id,i.store_id,'commission_snapshot' FROM public.order_items i WHERE i.id=NEW.order_item_id AND i.order_id=NEW.order_id ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER commission_supplier_snapshot AFTER INSERT ON public.supplier_commission_entries FOR EACH ROW EXECUTE FUNCTION public.snapshot_commission_supplier();
-- Geriye dönük kesin komisyon bağlantıları önceliklidir. Kaybolmuş ilişkiler uydurulmaz.
INSERT INTO public.order_item_suppliers(order_item_id,supplier_id,order_id,store_id,source)
SELECT i.id,c.supplier_id,i.order_id,i.store_id,'commission_history' FROM public.order_items i JOIN public.supplier_commission_entries c ON c.order_item_id=i.id AND c.order_id=i.order_id ON CONFLICT DO NOTHING;
INSERT INTO public.order_item_suppliers(order_item_id,supplier_id,order_id,store_id,source)
SELECT i.id,l.supplier_id,i.order_id,i.store_id,'import_history' FROM public.order_items i JOIN public.store_supplier_imports l ON l.product_id=i.product_id AND l.store_id=i.store_id WHERE NOT EXISTS(SELECT 1 FROM public.order_item_suppliers x WHERE x.order_item_id=i.id) ON CONFLICT DO NOTHING;
INSERT INTO public.order_item_suppliers(order_item_id,supplier_id,order_id,store_id,source)
SELECT i.id,sp.supplier_id,i.order_id,i.store_id,'catalog_history' FROM public.order_items i JOIN public.supplier_products sp ON
  (i.variant_id IS NOT NULL AND sp.variant_id=i.variant_id) OR (i.variant_id IS NULL AND sp.product_id=i.product_id)
WHERE NOT EXISTS(SELECT 1 FROM public.order_item_suppliers x WHERE x.order_item_id=i.id) ON CONFLICT DO NOTHING;
