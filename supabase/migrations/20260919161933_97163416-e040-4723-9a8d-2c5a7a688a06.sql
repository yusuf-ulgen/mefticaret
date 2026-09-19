CREATE TABLE IF NOT EXISTS public.live_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  provider text NOT NULL DEFAULT 'youtube' CHECK (provider IN ('youtube','vimeo','mux','custom')),
  stream_url text,
  chat_enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','ended','cancelled')),
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  peak_viewers integer NOT NULL DEFAULT 0,
  total_views integer NOT NULL DEFAULT 0,
  product_clicks integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_streams TO authenticated;
GRANT SELECT ON public.live_streams TO anon;
GRANT ALL ON public.live_streams TO service_role;
ALTER TABLE public.live_streams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live_streams_manage" ON public.live_streams FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "live_streams_select_member" ON public.live_streams FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "live_streams_select_public" ON public.live_streams FOR SELECT TO anon
  USING (status IN ('scheduled','live') AND app_private.is_store_published(store_id));
CREATE TRIGGER live_streams_updated BEFORE UPDATE ON public.live_streams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.live_stream_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  stream_id uuid NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  highlight_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stream_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_stream_products TO authenticated;
GRANT SELECT ON public.live_stream_products TO anon;
GRANT ALL ON public.live_stream_products TO service_role;
ALTER TABLE public.live_stream_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live_stream_products_manage" ON public.live_stream_products FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "live_stream_products_select_member" ON public.live_stream_products FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "live_stream_products_select_public" ON public.live_stream_products FOR SELECT TO anon
  USING (app_private.is_store_published(store_id));
CREATE TRIGGER live_stream_products_tenant_guard BEFORE INSERT OR UPDATE ON public.live_stream_products
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs('stream_id', 'live_streams', 'product_id', 'products');
CREATE TRIGGER live_stream_products_updated BEFORE UPDATE ON public.live_stream_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.shoppable_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  title text NOT NULL,
  video_url text NOT NULL,
  thumbnail_url text,
  source text NOT NULL DEFAULT 'upload' CHECK (source IN ('upload','tiktok','instagram','youtube')),
  placement text NOT NULL DEFAULT 'home' CHECK (placement IN ('home','pdp','both')),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  views integer NOT NULL DEFAULT 0,
  product_clicks integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shoppable_videos TO authenticated;
GRANT SELECT ON public.shoppable_videos TO anon;
GRANT ALL ON public.shoppable_videos TO service_role;
ALTER TABLE public.shoppable_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shoppable_videos_manage" ON public.shoppable_videos FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "shoppable_videos_select_member" ON public.shoppable_videos FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "shoppable_videos_select_public" ON public.shoppable_videos FOR SELECT TO anon
  USING (is_active AND app_private.is_store_published(store_id));
CREATE TRIGGER shoppable_videos_tenant_guard BEFORE INSERT OR UPDATE ON public.shoppable_videos
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs('product_id', 'products');
CREATE TRIGGER shoppable_videos_updated BEFORE UPDATE ON public.shoppable_videos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.ugc_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'instagram' CHECK (source IN ('instagram','tiktok','manual')),
  author_handle text,
  media_url text NOT NULL,
  permalink text,
  caption text,
  likes integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ugc_posts TO authenticated;
GRANT SELECT ON public.ugc_posts TO anon;
GRANT ALL ON public.ugc_posts TO service_role;
ALTER TABLE public.ugc_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ugc_posts_manage" ON public.ugc_posts FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "ugc_posts_select_member" ON public.ugc_posts FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "ugc_posts_select_public" ON public.ugc_posts FOR SELECT TO anon
  USING (status = 'approved' AND app_private.is_store_published(store_id));
CREATE TRIGGER ugc_posts_tenant_guard BEFORE INSERT OR UPDATE ON public.ugc_posts
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs('product_id', 'products');
CREATE TRIGGER ugc_posts_updated BEFORE UPDATE ON public.ugc_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.payment_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  provider text NOT NULL,
  label text NOT NULL,
  bin_prefixes text[] NOT NULL DEFAULT '{}',
  card_networks text[] NOT NULL DEFAULT '{}',
  fee_percent numeric(5,3) NOT NULL DEFAULT 0 CHECK (fee_percent >= 0 AND fee_percent <= 20),
  fee_fixed numeric(10,2) NOT NULL DEFAULT 0,
  approval_rate numeric(5,2) NOT NULL DEFAULT 95 CHECK (approval_rate >= 0 AND approval_rate <= 100),
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_routes TO authenticated;
GRANT ALL ON public.payment_routes TO service_role;
ALTER TABLE public.payment_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_routes_manage" ON public.payment_routes FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "payment_routes_select" ON public.payment_routes FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE TRIGGER payment_routes_updated BEFORE UPDATE ON public.payment_routes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.payment_route_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  route_id uuid REFERENCES public.payment_routes(id) ON DELETE SET NULL,
  bin_prefix text,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  chosen_fee numeric(14,2) NOT NULL DEFAULT 0,
  baseline_fee numeric(14,2) NOT NULL DEFAULT 0,
  saved_amount numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_route_decisions TO authenticated;
GRANT ALL ON public.payment_route_decisions TO service_role;
ALTER TABLE public.payment_route_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_route_decisions_manage" ON public.payment_route_decisions FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "payment_route_decisions_select" ON public.payment_route_decisions FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE TRIGGER payment_route_decisions_tenant_guard BEFORE INSERT OR UPDATE ON public.payment_route_decisions
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs('order_id', 'orders', 'route_id', 'payment_routes');

CREATE TABLE IF NOT EXISTS public.checkout_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('warranty','insurance','carbon')),
  name text NOT NULL,
  description text,
  months integer,
  price_type text NOT NULL DEFAULT 'percent' CHECK (price_type IN ('percent','fixed')),
  price_value numeric(10,2) NOT NULL DEFAULT 0,
  min_order_total numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkout_addons TO authenticated;
GRANT SELECT ON public.checkout_addons TO anon;
GRANT ALL ON public.checkout_addons TO service_role;
ALTER TABLE public.checkout_addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checkout_addons_manage" ON public.checkout_addons FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "checkout_addons_select_member" ON public.checkout_addons FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "checkout_addons_select_public" ON public.checkout_addons FOR SELECT TO anon
  USING (is_active AND app_private.is_store_published(store_id));
CREATE TRIGGER checkout_addons_updated BEFORE UPDATE ON public.checkout_addons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.order_addon_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  addon_id uuid REFERENCES public.checkout_addons(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('warranty','insurance','carbon')),
  label text NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_addon_selections TO authenticated;
GRANT ALL ON public.order_addon_selections TO service_role;
ALTER TABLE public.order_addon_selections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_addon_selections_manage" ON public.order_addon_selections FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "order_addon_selections_select" ON public.order_addon_selections FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE TRIGGER order_addon_selections_tenant_guard BEFORE INSERT OR UPDATE ON public.order_addon_selections
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs('order_id', 'orders', 'addon_id', 'checkout_addons');

CREATE TABLE IF NOT EXISTS public.product_ar_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  model_url text,
  usdz_url text,
  poster_url text,
  scale_hint text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_ar_assets TO authenticated;
GRANT SELECT ON public.product_ar_assets TO anon;
GRANT ALL ON public.product_ar_assets TO service_role;
ALTER TABLE public.product_ar_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_ar_assets_manage" ON public.product_ar_assets FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "product_ar_assets_select_member" ON public.product_ar_assets FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "product_ar_assets_select_public" ON public.product_ar_assets FOR SELECT TO anon
  USING (is_active AND app_private.is_store_published(store_id));
CREATE TRIGGER product_ar_assets_tenant_guard BEFORE INSERT OR UPDATE ON public.product_ar_assets
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs('product_id', 'products');
CREATE TRIGGER product_ar_assets_updated BEFORE UPDATE ON public.product_ar_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.fraud_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  level text NOT NULL DEFAULT 'low' CHECK (level IN ('low','medium','high')),
  signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','cleared','blocked')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fraud_assessments TO authenticated;
GRANT ALL ON public.fraud_assessments TO service_role;
ALTER TABLE public.fraud_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fraud_assessments_manage" ON public.fraud_assessments FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "fraud_assessments_select" ON public.fraud_assessments FOR SELECT TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE TRIGGER fraud_assessments_tenant_guard BEFORE INSERT OR UPDATE ON public.fraud_assessments
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs('order_id', 'orders');
CREATE TRIGGER fraud_assessments_updated BEFORE UPDATE ON public.fraud_assessments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.store_global_settings
  ADD COLUMN IF NOT EXISTS carbon_offset_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS carbon_offset_amount numeric(10,2) NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS fraud_block_threshold integer NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS live_commerce_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voice_search_enabled boolean NOT NULL DEFAULT true;