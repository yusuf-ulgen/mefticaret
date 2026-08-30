-- FAZ 24: Pazaryeri kanalları
CREATE TYPE public.channel_status AS ENUM ('disconnected', 'connected', 'error', 'paused');
CREATE TYPE public.listing_status AS ENUM ('draft', 'queued', 'listed', 'error', 'removed');

CREATE TABLE public.marketplace_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  provider text NOT NULL,
  name text NOT NULL,
  status public.channel_status NOT NULL DEFAULT 'disconnected',
  is_active boolean NOT NULL DEFAULT false,
  config_ref text,
  seller_id text,
  price_markup_rate numeric(6,4) NOT NULL DEFAULT 0,
  auto_sync boolean NOT NULL DEFAULT false,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, provider)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_channels TO authenticated;
GRANT ALL ON public.marketplace_channels TO service_role;
ALTER TABLE public.marketplace_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store members read channels" ON public.marketplace_channels
  FOR SELECT TO authenticated USING (app_private.is_store_member(auth.uid(), store_id));
CREATE POLICY "Store managers write channels" ON public.marketplace_channels
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(auth.uid(), store_id))
  WITH CHECK (app_private.can_manage_store(auth.uid(), store_id));

CREATE TABLE public.channel_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.marketplace_channels(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  status public.listing_status NOT NULL DEFAULT 'draft',
  external_id text,
  external_url text,
  price_override numeric(12,2),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel_id, product_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_listings TO authenticated;
GRANT ALL ON public.channel_listings TO service_role;
ALTER TABLE public.channel_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store members read listings" ON public.channel_listings
  FOR SELECT TO authenticated USING (app_private.is_store_member(auth.uid(), store_id));
CREATE POLICY "Store managers write listings" ON public.channel_listings
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(auth.uid(), store_id))
  WITH CHECK (app_private.can_manage_store(auth.uid(), store_id));

CREATE INDEX idx_channel_listings_channel ON public.channel_listings(channel_id);
CREATE INDEX idx_channel_listings_product ON public.channel_listings(product_id);
CREATE INDEX idx_marketplace_channels_store ON public.marketplace_channels(store_id);

CREATE TRIGGER marketplace_channels_set_updated_at BEFORE UPDATE ON public.marketplace_channels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER channel_listings_set_updated_at BEFORE UPDATE ON public.channel_listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();