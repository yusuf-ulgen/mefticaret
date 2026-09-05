-- Facebook Marketplace (Item API) entegrasyonu

CREATE TABLE public.fb_marketplace_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  page_id text NOT NULL,
  page_name text,
  partner_id text,
  catalog_id text,
  status public.channel_status NOT NULL DEFAULT 'connected',
  auto_sync boolean NOT NULL DEFAULT true,
  sync_interval_minutes integer NOT NULL DEFAULT 60,
  default_condition text NOT NULL DEFAULT 'new',
  default_category text,
  offer_shipping boolean NOT NULL DEFAULT true,
  offer_local_pickup boolean NOT NULL DEFAULT false,
  currency text NOT NULL DEFAULT 'TRY',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fb_marketplace_accounts TO authenticated;
GRANT ALL ON public.fb_marketplace_accounts TO service_role;
ALTER TABLE public.fb_marketplace_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fb_accounts_select" ON public.fb_marketplace_accounts
  FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "fb_accounts_insert" ON public.fb_marketplace_accounts
  FOR INSERT TO authenticated WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "fb_accounts_update" ON public.fb_marketplace_accounts
  FOR UPDATE TO authenticated USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "fb_accounts_delete" ON public.fb_marketplace_accounts
  FOR DELETE TO authenticated USING (app_private.can_manage_store(store_id, auth.uid()));

CREATE TRIGGER fb_marketplace_accounts_updated_at
  BEFORE UPDATE ON public.fb_marketplace_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sunucu-only kimlik bilgileri (politika yok = fail closed)
CREATE TABLE public.fb_marketplace_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.fb_marketplace_accounts(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  token_type text NOT NULL DEFAULT 'page',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id)
);

GRANT ALL ON public.fb_marketplace_credentials TO service_role;
ALTER TABLE public.fb_marketplace_credentials ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER fb_marketplace_credentials_updated_at
  BEFORE UPDATE ON public.fb_marketplace_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.fb_marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.fb_marketplace_accounts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE,
  retailer_id text NOT NULL,
  fb_item_id text,
  status public.listing_status NOT NULL DEFAULT 'draft',
  payload_hash text,
  price numeric(12,2),
  quantity integer NOT NULL DEFAULT 0,
  last_synced_at timestamptz,
  last_error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, retailer_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fb_marketplace_listings TO authenticated;
GRANT ALL ON public.fb_marketplace_listings TO service_role;
ALTER TABLE public.fb_marketplace_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fb_listings_select" ON public.fb_marketplace_listings
  FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "fb_listings_write" ON public.fb_marketplace_listings
  FOR ALL TO authenticated USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE INDEX fb_listings_store_status_idx ON public.fb_marketplace_listings (store_id, status);
CREATE INDEX fb_listings_product_idx ON public.fb_marketplace_listings (product_id);

CREATE TRIGGER fb_marketplace_listings_updated_at
  BEFORE UPDATE ON public.fb_marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.fb_marketplace_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.fb_marketplace_accounts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running',
  trigger_source text NOT NULL DEFAULT 'manual',
  total_items integer NOT NULL DEFAULT 0,
  created_items integer NOT NULL DEFAULT 0,
  updated_items integer NOT NULL DEFAULT 0,
  deleted_items integer NOT NULL DEFAULT 0,
  failed_items integer NOT NULL DEFAULT 0,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.fb_marketplace_sync_runs TO authenticated;
GRANT ALL ON public.fb_marketplace_sync_runs TO service_role;
ALTER TABLE public.fb_marketplace_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fb_sync_runs_select" ON public.fb_marketplace_sync_runs
  FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));

CREATE INDEX fb_sync_runs_store_idx ON public.fb_marketplace_sync_runs (store_id, started_at DESC);

CREATE TRIGGER fb_marketplace_sync_runs_updated_at
  BEFORE UPDATE ON public.fb_marketplace_sync_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Uygulama mağazası kaydı
INSERT INTO public.apps (code, name, description, tagline, category, developer, version, pricing_model, price, currency, is_active, is_featured, logo_emoji, sort_order, permissions)
VALUES (
  'facebook-marketplace',
  'Facebook Marketplace',
  'Ürünlerini Facebook Marketplace Item API ile otomatik yayınla; fiyat ve stok değişikliklerini tek tıkla eşitle.',
  'Marketplace ilan eşitlemesi',
  'marketplace',
  'Mefticaret',
  '1.0.0',
  'monthly',
  299,
  'TRY',
  true,
  true,
  '🛍️',
  20,
  ARRAY['products:read','inventory:read','orders:read','store:read']
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = true;