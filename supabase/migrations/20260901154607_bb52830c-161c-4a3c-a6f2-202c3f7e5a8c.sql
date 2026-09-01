CREATE TYPE public.supplier_feed_kind AS ENUM ('xml','csv','api');
CREATE TYPE public.supplier_feed_schedule AS ENUM ('manual','hourly','six_hourly','daily');
CREATE TYPE public.supplier_feed_run_status AS ENUM ('running','success','failed');
CREATE TYPE public.supplier_match_key AS ENUM ('sku','barcode','external_id');
CREATE TYPE public.dropship_order_status AS ENUM ('pending','sent','accepted','shipped','cancelled','failed');

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS is_dropship boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lead_time_days integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'TRY',
  ADD COLUMN IF NOT EXISTS auto_send_orders boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS order_endpoint text;

CREATE TABLE public.supplier_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  name text NOT NULL,
  kind public.supplier_feed_kind NOT NULL DEFAULT 'xml',
  source_url text NOT NULL,
  auth_header text,
  schedule public.supplier_feed_schedule NOT NULL DEFAULT 'manual',
  is_active boolean NOT NULL DEFAULT true,
  match_key public.supplier_match_key NOT NULL DEFAULT 'sku',
  item_path text,
  field_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  category_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  brand_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  price_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  stock_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  import_images boolean NOT NULL DEFAULT true,
  create_missing boolean NOT NULL DEFAULT false,
  last_run_at timestamptz,
  next_run_at timestamptz,
  last_status public.supplier_feed_run_status,
  last_error text,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_feeds TO authenticated;
GRANT ALL ON public.supplier_feeds TO service_role;
ALTER TABLE public.supplier_feeds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplier_feeds_read" ON public.supplier_feeds FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "supplier_feeds_write" ON public.supplier_feeds FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE INDEX supplier_feeds_store_idx ON public.supplier_feeds (store_id, created_at DESC);
CREATE INDEX supplier_feeds_due_idx ON public.supplier_feeds (next_run_at) WHERE is_active;
CREATE TRIGGER supplier_feeds_set_updated_at BEFORE UPDATE ON public.supplier_feeds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.supplier_feed_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  feed_id uuid NOT NULL REFERENCES public.supplier_feeds(id) ON DELETE CASCADE,
  status public.supplier_feed_run_status NOT NULL DEFAULT 'running',
  trigger text NOT NULL DEFAULT 'manual',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_feed_runs TO authenticated;
GRANT ALL ON public.supplier_feed_runs TO service_role;
ALTER TABLE public.supplier_feed_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplier_feed_runs_read" ON public.supplier_feed_runs FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "supplier_feed_runs_write" ON public.supplier_feed_runs FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE INDEX supplier_feed_runs_feed_idx ON public.supplier_feed_runs (feed_id, started_at DESC);
CREATE TRIGGER supplier_feed_runs_set_updated_at BEFORE UPDATE ON public.supplier_feed_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.supplier_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  feed_id uuid NOT NULL REFERENCES public.supplier_feeds(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  external_id text,
  sku text,
  barcode text,
  title text NOT NULL,
  brand text,
  category text,
  supplier_price numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  computed_price numeric(12,2),
  stock integer NOT NULL DEFAULT 0,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  matched_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_products TO authenticated;
GRANT ALL ON public.supplier_products TO service_role;
ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplier_products_read" ON public.supplier_products FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "supplier_products_write" ON public.supplier_products FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE UNIQUE INDEX supplier_products_feed_key_idx
  ON public.supplier_products (feed_id, COALESCE(external_id, sku, barcode, title));
CREATE INDEX supplier_products_store_idx ON public.supplier_products (store_id, updated_at DESC);
CREATE TRIGGER supplier_products_set_updated_at BEFORE UPDATE ON public.supplier_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.dropship_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status public.dropship_order_status NOT NULL DEFAULT 'pending',
  external_ref text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response jsonb,
  carrier text,
  tracking_number text,
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dropship_orders TO authenticated;
GRANT ALL ON public.dropship_orders TO service_role;
ALTER TABLE public.dropship_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dropship_orders_read" ON public.dropship_orders FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "dropship_orders_write" ON public.dropship_orders FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE INDEX dropship_orders_store_idx ON public.dropship_orders (store_id, created_at DESC);
CREATE INDEX dropship_orders_order_idx ON public.dropship_orders (order_id);
CREATE TRIGGER dropship_orders_set_updated_at BEFORE UPDATE ON public.dropship_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();