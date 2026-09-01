-- 1. Enums
CREATE TYPE public.warehouse_kind AS ENUM ('warehouse', 'branch', 'supplier', 'dropship', 'virtual');
CREATE TYPE public.stock_transfer_status AS ENUM ('draft', 'in_transit', 'received', 'cancelled');

ALTER TYPE public.inventory_movement_kind ADD VALUE IF NOT EXISTS 'transfer_out';
ALTER TYPE public.inventory_movement_kind ADD VALUE IF NOT EXISTS 'transfer_in';
ALTER TYPE public.inventory_movement_kind ADD VALUE IF NOT EXISTS 'reserve';
ALTER TYPE public.inventory_movement_kind ADD VALUE IF NOT EXISTS 'release';

-- 2. Warehouses / branches
CREATE TABLE public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  kind public.warehouse_kind NOT NULL DEFAULT 'warehouse',
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  country text NOT NULL DEFAULT 'TR',
  city text,
  district text,
  address text,
  contact_name text,
  phone text,
  priority integer NOT NULL DEFAULT 100,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  allows_fulfillment boolean NOT NULL DEFAULT true,
  external_source text,
  external_ref text,
  sync_url text,
  last_synced_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouses TO authenticated;
GRANT ALL ON public.warehouses TO service_role;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "warehouses_select_members" ON public.warehouses
  FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "warehouses_insert_managers" ON public.warehouses
  FOR INSERT TO authenticated
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "warehouses_update_managers" ON public.warehouses
  FOR UPDATE TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "warehouses_delete_managers" ON public.warehouses
  FOR DELETE TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()));

CREATE TRIGGER warehouses_set_updated_at BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX warehouses_one_default_per_store
  ON public.warehouses (store_id) WHERE is_default;

-- 3. Per-warehouse inventory levels
CREATE TABLE public.inventory_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  on_hand integer NOT NULL DEFAULT 0,
  reserved integer NOT NULL DEFAULT 0,
  incoming integer NOT NULL DEFAULT 0,
  min_stock integer NOT NULL DEFAULT 0,
  bin_location text,
  external_source text,
  external_ref text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  available integer GENERATED ALWAYS AS (GREATEST(on_hand - reserved, 0)) STORED,
  UNIQUE (warehouse_id, variant_id)
);

CREATE INDEX inventory_levels_store_variant_idx ON public.inventory_levels (store_id, variant_id);
CREATE INDEX inventory_levels_warehouse_idx ON public.inventory_levels (warehouse_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_levels TO authenticated;
GRANT ALL ON public.inventory_levels TO service_role;
ALTER TABLE public.inventory_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_levels_select_members" ON public.inventory_levels
  FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "inventory_levels_insert_managers" ON public.inventory_levels
  FOR INSERT TO authenticated
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "inventory_levels_update_managers" ON public.inventory_levels
  FOR UPDATE TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "inventory_levels_delete_managers" ON public.inventory_levels
  FOR DELETE TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()));

CREATE TRIGGER inventory_levels_set_updated_at BEFORE UPDATE ON public.inventory_levels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Movements gain warehouse + transfer context
ALTER TABLE public.inventory_movements
  ADD COLUMN warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  ADD COLUMN target_warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  ADD COLUMN transfer_id uuid;

-- 5. Transfers between warehouses / branches
CREATE TABLE public.stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  code text NOT NULL,
  from_warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  to_warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  status public.stock_transfer_status NOT NULL DEFAULT 'draft',
  note text,
  shipped_at timestamptz,
  received_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, code)
);

CREATE TABLE public.stock_transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  transfer_id uuid NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  title text NOT NULL,
  sku text,
  quantity integer NOT NULL DEFAULT 1,
  received_quantity integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_movements
  ADD CONSTRAINT inventory_movements_transfer_fk
  FOREIGN KEY (transfer_id) REFERENCES public.stock_transfers(id) ON DELETE SET NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_transfers TO authenticated;
GRANT ALL ON public.stock_transfers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_transfer_items TO authenticated;
GRANT ALL ON public.stock_transfer_items TO service_role;

ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_transfers_select_members" ON public.stock_transfers
  FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "stock_transfers_insert_managers" ON public.stock_transfers
  FOR INSERT TO authenticated
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "stock_transfers_update_managers" ON public.stock_transfers
  FOR UPDATE TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "stock_transfers_delete_managers" ON public.stock_transfers
  FOR DELETE TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "stock_transfer_items_select_members" ON public.stock_transfer_items
  FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "stock_transfer_items_insert_managers" ON public.stock_transfer_items
  FOR INSERT TO authenticated
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "stock_transfer_items_update_managers" ON public.stock_transfer_items
  FOR UPDATE TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "stock_transfer_items_delete_managers" ON public.stock_transfer_items
  FOR DELETE TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()));

CREATE TRIGGER stock_transfers_set_updated_at BEFORE UPDATE ON public.stock_transfers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER stock_transfer_items_set_updated_at BEFORE UPDATE ON public.stock_transfer_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Keep variant total stock in sync with warehouse levels
CREATE OR REPLACE FUNCTION public.sync_variant_stock_from_levels()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target uuid := COALESCE(NEW.variant_id, OLD.variant_id);
  total integer;
BEGIN
  SELECT COALESCE(SUM(on_hand), 0) INTO total
  FROM public.inventory_levels WHERE variant_id = target;

  UPDATE public.product_variants SET stock = total WHERE id = target AND stock <> total;
  RETURN NULL;
END; $$;

CREATE TRIGGER inventory_levels_sync_variant
AFTER INSERT OR UPDATE OR DELETE ON public.inventory_levels
FOR EACH ROW EXECUTE FUNCTION public.sync_variant_stock_from_levels();

-- 7. Backfill: default warehouse per store + current variant stock as its level
INSERT INTO public.warehouses (store_id, code, name, kind, is_default, priority)
SELECT s.id, 'MERKEZ', 'Merkez Depo', 'warehouse', true, 10
FROM public.stores s
ON CONFLICT (store_id, code) DO NOTHING;

INSERT INTO public.inventory_levels (store_id, warehouse_id, variant_id, product_id, on_hand, min_stock)
SELECT v.store_id, w.id, v.id, v.product_id, COALESCE(v.stock, 0), COALESCE(v.low_stock_threshold, 0)
FROM public.product_variants v
JOIN public.warehouses w ON w.store_id = v.store_id AND w.is_default
ON CONFLICT (warehouse_id, variant_id) DO NOTHING;