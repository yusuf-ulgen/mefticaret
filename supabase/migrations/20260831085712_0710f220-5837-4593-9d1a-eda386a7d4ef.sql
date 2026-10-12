CREATE TABLE public.suppliers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  contact_name text,
  email text,
  phone text,
  tax_number text,
  address text,
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX suppliers_store_idx ON public.suppliers(store_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store members read suppliers" ON public.suppliers
  FOR SELECT TO authenticated
  USING (app_private.is_store_member(auth.uid(), store_id));

CREATE POLICY "Store managers insert suppliers" ON public.suppliers
  FOR INSERT TO authenticated
  WITH CHECK (app_private.can_manage_store(auth.uid(), store_id));

CREATE POLICY "Store managers update suppliers" ON public.suppliers
  FOR UPDATE TO authenticated
  USING (app_private.can_manage_store(auth.uid(), store_id))
  WITH CHECK (app_private.can_manage_store(auth.uid(), store_id));

CREATE POLICY "Store managers delete suppliers" ON public.suppliers
  FOR DELETE TO authenticated
  USING (app_private.can_manage_store(auth.uid(), store_id));

CREATE TRIGGER suppliers_set_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  code text not null,
  status text not null default 'draft' check (status in ('draft','ordered','received','cancelled')),
  currency text not null default 'TRY',
  expected_at date,
  received_at timestamptz,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE UNIQUE INDEX purchase_orders_store_code_idx ON public.purchase_orders(store_id, upper(code));
CREATE INDEX purchase_orders_store_created_idx ON public.purchase_orders(store_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store members read purchase orders" ON public.purchase_orders
  FOR SELECT TO authenticated
  USING (app_private.is_store_member(auth.uid(), store_id));

CREATE POLICY "Store managers insert purchase orders" ON public.purchase_orders
  FOR INSERT TO authenticated
  WITH CHECK (app_private.can_manage_store(auth.uid(), store_id));

CREATE POLICY "Store managers update purchase orders" ON public.purchase_orders
  FOR UPDATE TO authenticated
  USING (app_private.can_manage_store(auth.uid(), store_id))
  WITH CHECK (app_private.can_manage_store(auth.uid(), store_id));

CREATE POLICY "Store managers delete draft purchase orders" ON public.purchase_orders
  FOR DELETE TO authenticated
  USING (app_private.can_manage_store(auth.uid(), store_id) AND status = 'draft');

CREATE TRIGGER purchase_orders_set_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  title text not null,
  sku text,
  quantity integer not null check (quantity > 0),
  received_quantity integer not null default 0 check (received_quantity >= 0),
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX purchase_order_items_order_idx ON public.purchase_order_items(purchase_order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;
GRANT ALL ON public.purchase_order_items TO service_role;

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store members read purchase order items" ON public.purchase_order_items
  FOR SELECT TO authenticated
  USING (app_private.is_store_member(auth.uid(), store_id));

CREATE POLICY "Store managers insert purchase order items" ON public.purchase_order_items
  FOR INSERT TO authenticated
  WITH CHECK (app_private.can_manage_store(auth.uid(), store_id));

CREATE POLICY "Store managers update purchase order items" ON public.purchase_order_items
  FOR UPDATE TO authenticated
  USING (app_private.can_manage_store(auth.uid(), store_id))
  WITH CHECK (app_private.can_manage_store(auth.uid(), store_id));

CREATE POLICY "Store managers delete purchase order items" ON public.purchase_order_items
  FOR DELETE TO authenticated
  USING (app_private.can_manage_store(auth.uid(), store_id));

CREATE TRIGGER purchase_order_items_set_updated_at
  BEFORE UPDATE ON public.purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();