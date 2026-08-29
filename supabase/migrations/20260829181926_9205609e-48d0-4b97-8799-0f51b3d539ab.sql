CREATE TYPE public.inventory_movement_kind AS ENUM ('count','restock','manual_out','sale','return','damage');

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 5;

CREATE TABLE public.inventory_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  kind public.inventory_movement_kind NOT NULL DEFAULT 'count',
  quantity integer NOT NULL,
  stock_before integer NOT NULL DEFAULT 0,
  stock_after integer NOT NULL DEFAULT 0,
  reason text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX inventory_movements_store_created_idx ON public.inventory_movements (store_id, created_at DESC);
CREATE INDEX inventory_movements_variant_idx ON public.inventory_movements (variant_id);

GRANT SELECT, INSERT ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_movements TO service_role;

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store members can read inventory movements"
ON public.inventory_movements FOR SELECT TO authenticated
USING (app_private.is_store_member(store_id, auth.uid()));

CREATE POLICY "Store managers can insert inventory movements"
ON public.inventory_movements FOR INSERT TO authenticated
WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

INSERT INTO public.inventory_movements (store_id, product_id, variant_id, kind, quantity, stock_before, stock_after, reason, created_at)
SELECT v.store_id, v.product_id, v.id, 'count', v.stock, 0, v.stock, 'Açılış stok sayımı', now() - interval '10 days'
FROM public.product_variants v
JOIN public.stores s ON s.id = v.store_id
WHERE s.is_demo = true;