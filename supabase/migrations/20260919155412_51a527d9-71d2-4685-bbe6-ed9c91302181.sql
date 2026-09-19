ALTER TABLE public.store_global_settings
  ADD COLUMN IF NOT EXISTS b2b_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS b2b_default_moq integer NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.affiliate_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  country_code text NOT NULL DEFAULT 'TR',
  code text NOT NULL,
  commission_percent numeric(5,2) NOT NULL DEFAULT 10 CHECK (commission_percent >= 0 AND commission_percent <= 90),
  payout_currency text NOT NULL DEFAULT 'USD',
  promo_code text,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_partners TO authenticated;
GRANT ALL ON public.affiliate_partners TO service_role;
ALTER TABLE public.affiliate_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "affiliate_partners_manage" ON public.affiliate_partners FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "affiliate_partners_select" ON public.affiliate_partners FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE TRIGGER affiliate_partners_updated BEFORE UPDATE ON public.affiliate_partners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.affiliate_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  order_total numeric(14,2) NOT NULL DEFAULT 0,
  order_currency text NOT NULL DEFAULT 'TRY',
  commission_amount numeric(14,2) NOT NULL DEFAULT 0,
  commission_currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','rejected')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_conversions TO authenticated;
GRANT ALL ON public.affiliate_conversions TO service_role;
ALTER TABLE public.affiliate_conversions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "affiliate_conversions_manage" ON public.affiliate_conversions FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "affiliate_conversions_select" ON public.affiliate_conversions FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE TRIGGER affiliate_conversions_tenant_guard BEFORE INSERT OR UPDATE ON public.affiliate_conversions
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs('partner_id', 'affiliate_partners', 'order_id', 'orders');
CREATE TRIGGER affiliate_conversions_updated BEFORE UPDATE ON public.affiliate_conversions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.holiday_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  holiday_key text NOT NULL,
  name text NOT NULL,
  countries text[] NOT NULL DEFAULT '{}',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  discount_percent numeric(5,2) NOT NULL DEFAULT 10 CHECK (discount_percent >= 0 AND discount_percent <= 90),
  banner_text text,
  banner_locale text NOT NULL DEFAULT 'en',
  is_auto boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holiday_campaigns TO authenticated;
GRANT ALL ON public.holiday_campaigns TO service_role;
ALTER TABLE public.holiday_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "holiday_campaigns_manage" ON public.holiday_campaigns FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "holiday_campaigns_select" ON public.holiday_campaigns FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE TRIGGER holiday_campaigns_updated BEFORE UPDATE ON public.holiday_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.global_dispatch_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email','whatsapp')),
  local_send_hour integer NOT NULL DEFAULT 10 CHECK (local_send_hour >= 0 AND local_send_hour <= 23),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, country_code, channel)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.global_dispatch_windows TO authenticated;
GRANT ALL ON public.global_dispatch_windows TO service_role;
ALTER TABLE public.global_dispatch_windows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "global_dispatch_windows_manage" ON public.global_dispatch_windows FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "global_dispatch_windows_select" ON public.global_dispatch_windows FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE TRIGGER global_dispatch_windows_updated BEFORE UPDATE ON public.global_dispatch_windows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.return_hubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  hub_name text NOT NULL,
  address text,
  city text,
  postal_code text,
  carrier_code text,
  instructions text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, country_code, hub_name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.return_hubs TO authenticated;
GRANT ALL ON public.return_hubs TO service_role;
ALTER TABLE public.return_hubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "return_hubs_manage" ON public.return_hubs FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "return_hubs_select" ON public.return_hubs FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE TRIGGER return_hubs_updated BEFORE UPDATE ON public.return_hubs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.international_return_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  hub_id uuid REFERENCES public.return_hubs(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  reference text NOT NULL,
  destination_country text NOT NULL DEFAULT 'TR',
  origin_country text NOT NULL DEFAULT 'TR',
  carrier_code text,
  tracking_number text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','in_transit','received','cancelled')),
  label_payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, reference)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.international_return_labels TO authenticated;
GRANT ALL ON public.international_return_labels TO service_role;
ALTER TABLE public.international_return_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "international_return_labels_manage" ON public.international_return_labels FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "international_return_labels_select" ON public.international_return_labels FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE TRIGGER international_return_labels_tenant_guard BEFORE INSERT OR UPDATE ON public.international_return_labels
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs('hub_id', 'return_hubs', 'order_id', 'orders');
CREATE TRIGGER international_return_labels_updated BEFORE UPDATE ON public.international_return_labels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.carrier_rate_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  destination_country text NOT NULL,
  weight_grams integer NOT NULL DEFAULT 1000 CHECK (weight_grams > 0),
  carrier_code text NOT NULL,
  service text,
  cost numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  transit_days integer,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','api')),
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.carrier_rate_quotes TO authenticated;
GRANT ALL ON public.carrier_rate_quotes TO service_role;
ALTER TABLE public.carrier_rate_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "carrier_rate_quotes_manage" ON public.carrier_rate_quotes FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "carrier_rate_quotes_select" ON public.carrier_rate_quotes FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE TRIGGER carrier_rate_quotes_updated BEFORE UPDATE ON public.carrier_rate_quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.wholesale_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  min_quantity integer NOT NULL DEFAULT 10 CHECK (min_quantity > 0),
  discount_percent numeric(5,2) NOT NULL DEFAULT 5 CHECK (discount_percent >= 0 AND discount_percent <= 90),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wholesale_tiers TO authenticated;
GRANT ALL ON public.wholesale_tiers TO service_role;
ALTER TABLE public.wholesale_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wholesale_tiers_manage" ON public.wholesale_tiers FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "wholesale_tiers_select" ON public.wholesale_tiers FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE TRIGGER wholesale_tiers_tenant_guard BEFORE INSERT OR UPDATE ON public.wholesale_tiers
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs('product_id', 'products');
CREATE TRIGGER wholesale_tiers_updated BEFORE UPDATE ON public.wholesale_tiers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.rfq_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  reference text NOT NULL,
  company_name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  country_code text NOT NULL DEFAULT 'TR',
  currency text NOT NULL DEFAULT 'USD',
  items jsonb NOT NULL DEFAULT '[]',
  requested_total numeric(14,2) NOT NULL DEFAULT 0,
  quoted_total numeric(14,2),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','quoted','won','lost')),
  valid_until date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, reference)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rfq_requests TO authenticated;
GRANT ALL ON public.rfq_requests TO service_role;
ALTER TABLE public.rfq_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rfq_requests_manage" ON public.rfq_requests FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "rfq_requests_select" ON public.rfq_requests FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE TRIGGER rfq_requests_updated BEFORE UPDATE ON public.rfq_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.global_marketplace_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('amazon_us','amazon_eu','etsy','ebay','walmart','allegro','noon')),
  is_active boolean NOT NULL DEFAULT false,
  credentials_ready boolean NOT NULL DEFAULT false,
  target_currency text NOT NULL DEFAULT 'USD',
  last_sync_at timestamptz,
  last_status text,
  synced_products integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, channel)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.global_marketplace_channels TO authenticated;
GRANT ALL ON public.global_marketplace_channels TO service_role;
ALTER TABLE public.global_marketplace_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "global_marketplace_channels_manage" ON public.global_marketplace_channels FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "global_marketplace_channels_select" ON public.global_marketplace_channels FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE TRIGGER global_marketplace_channels_updated BEFORE UPDATE ON public.global_marketplace_channels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();