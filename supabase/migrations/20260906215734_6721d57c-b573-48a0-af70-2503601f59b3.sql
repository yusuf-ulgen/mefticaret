-- ENUM types
DO $$ BEGIN CREATE TYPE public.price_source AS ENUM ('base','auto','manual','price_list','campaign','rule'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.markup_type AS ENUM ('none','fixed','percent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.rounding_mode AS ENUM ('none','nearest_0_01','nearest_0_05','nearest_0_10','nearest_1','nearest_5','nearest_10','psych_99','psych_90','psych_95'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.rate_update_frequency AS ENUM ('manual','hourly','six_hourly','daily'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) PLATFORM: currencies
CREATE TABLE IF NOT EXISTS public.platform_currencies (
  code text PRIMARY KEY,
  name text NOT NULL,
  symbol text NOT NULL,
  decimals smallint NOT NULL DEFAULT 2,
  symbol_position text NOT NULL DEFAULT 'before',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_currencies TO anon, authenticated;
GRANT ALL ON public.platform_currencies TO service_role;
ALTER TABLE public.platform_currencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_currencies readable" ON public.platform_currencies FOR SELECT USING (true);
CREATE POLICY "platform_currencies admin write" ON public.platform_currencies FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(),'platform_admin'::public.app_role)) WITH CHECK (app_private.has_role(auth.uid(),'platform_admin'::public.app_role));
CREATE TRIGGER trg_platform_currencies_updated BEFORE UPDATE ON public.platform_currencies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.platform_currencies (code, name, symbol, decimals, symbol_position) VALUES
  ('TRY','Türk Lirası','₺',2,'after'),
  ('EUR','Euro','€',2,'before'),
  ('USD','ABD Doları','$',2,'before'),
  ('GBP','İngiliz Sterlini','£',2,'before'),
  ('SAR','Suudi Riyali','﷼',2,'after'),
  ('AED','BAE Dirhemi','د.إ',2,'after'),
  ('CHF','İsviçre Frangı','CHF',2,'before'),
  ('CAD','Kanada Doları','C$',2,'before'),
  ('AUD','Avustralya Doları','A$',2,'before'),
  ('JPY','Japon Yeni','¥',0,'before')
ON CONFLICT (code) DO NOTHING;

-- 2) PLATFORM: exchange rate providers
CREATE TABLE IF NOT EXISTS public.exchange_rate_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  adapter text NOT NULL,
  base_url text,
  requires_key boolean NOT NULL DEFAULT false,
  secret_name text,
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  last_status text,
  last_error text,
  last_success_at timestamptz,
  failure_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.exchange_rate_providers TO authenticated;
GRANT ALL ON public.exchange_rate_providers TO service_role;
ALTER TABLE public.exchange_rate_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "providers read auth" ON public.exchange_rate_providers FOR SELECT TO authenticated USING (true);
CREATE POLICY "providers admin write" ON public.exchange_rate_providers FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(),'platform_admin'::public.app_role)) WITH CHECK (app_private.has_role(auth.uid(),'platform_admin'::public.app_role));
CREATE TRIGGER trg_rate_providers_updated BEFORE UPDATE ON public.exchange_rate_providers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.exchange_rate_providers (code, name, adapter, base_url, requires_key, priority) VALUES
  ('frankfurter','Frankfurter (ECB)','frankfurter','https://api.frankfurter.app',false,10),
  ('erapi','Open Exchange Rate API','erapi','https://open.er-api.com/v6',false,20)
ON CONFLICT (code) DO NOTHING;

-- 3) STORE pricing settings
CREATE TABLE IF NOT EXISTS public.store_pricing_settings (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  base_currency text NOT NULL DEFAULT 'TRY',
  update_frequency public.rate_update_frequency NOT NULL DEFAULT 'daily',
  default_markup_type public.markup_type NOT NULL DEFAULT 'none',
  default_markup_value numeric(12,4) NOT NULL DEFAULT 0,
  default_rounding public.rounding_mode NOT NULL DEFAULT 'nearest_0_01',
  min_margin_percent numeric(6,2),
  max_change_percent numeric(6,2) NOT NULL DEFAULT 10,
  require_approval boolean NOT NULL DEFAULT false,
  stale_after_hours integer NOT NULL DEFAULT 48,
  geolocation_enabled boolean NOT NULL DEFAULT false,
  provider_code text,
  last_rate_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_pricing_settings TO authenticated;
GRANT ALL ON public.store_pricing_settings TO service_role;
ALTER TABLE public.store_pricing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing settings manage" ON public.store_pricing_settings FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER trg_store_pricing_settings_updated BEFORE UPDATE ON public.store_pricing_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) STORE currencies
CREATE TABLE IF NOT EXISTS public.store_currencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  currency text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_base boolean NOT NULL DEFAULT false,
  markup_type public.markup_type NOT NULL DEFAULT 'none',
  markup_value numeric(12,4) NOT NULL DEFAULT 0,
  rounding public.rounding_mode NOT NULL DEFAULT 'nearest_0_01',
  manual_rate numeric(18,6),
  use_manual_rate boolean NOT NULL DEFAULT false,
  symbol_position text NOT NULL DEFAULT 'before',
  decimal_separator text NOT NULL DEFAULT ',',
  thousands_separator text NOT NULL DEFAULT '.',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, currency)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_currencies TO authenticated;
GRANT ALL ON public.store_currencies TO service_role;
ALTER TABLE public.store_currencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store currencies manage" ON public.store_currencies FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER trg_store_currencies_updated BEFORE UPDATE ON public.store_currencies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) Exchange rate history
CREATE TABLE IF NOT EXISTS public.exchange_rate_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  base_currency text NOT NULL,
  quote_currency text NOT NULL,
  old_rate numeric(18,6),
  new_rate numeric(18,6) NOT NULL,
  source text NOT NULL DEFAULT 'auto',
  provider_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rate_history_store ON public.exchange_rate_history (store_id, base_currency, quote_currency, created_at DESC);
GRANT SELECT ON public.exchange_rate_history TO authenticated;
GRANT ALL ON public.exchange_rate_history TO service_role;
ALTER TABLE public.exchange_rate_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rate history read" ON public.exchange_rate_history FOR SELECT TO authenticated
  USING (store_id IS NULL OR app_private.can_manage_store(store_id, auth.uid()));

-- 6) Price lists
CREATE TABLE IF NOT EXISTS public.price_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  currency text NOT NULL,
  kind text NOT NULL DEFAULT 'retail',
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_lists TO authenticated;
GRANT ALL ON public.price_lists TO service_role;
ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price lists manage" ON public.price_lists FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER trg_price_lists_updated BEFORE UPDATE ON public.price_lists FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7) Markets
CREATE TABLE IF NOT EXISTS public.markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  country_code text NOT NULL,
  currency text NOT NULL,
  locale text,
  domain text,
  url_prefix text,
  tax_included boolean NOT NULL DEFAULT true,
  tax_class_id uuid REFERENCES public.tax_classes(id) ON DELETE SET NULL,
  price_list_id uuid REFERENCES public.price_lists(id) ON DELETE SET NULL,
  markup_type public.markup_type NOT NULL DEFAULT 'none',
  markup_value numeric(12,4) NOT NULL DEFAULT 0,
  rounding public.rounding_mode NOT NULL DEFAULT 'nearest_0_01',
  payment_method_ids uuid[] NOT NULL DEFAULT '{}',
  shipping_zone_ids uuid[] NOT NULL DEFAULT '{}',
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.markets TO authenticated;
GRANT ALL ON public.markets TO service_role;
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "markets manage" ON public.markets FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER trg_markets_updated BEFORE UPDATE ON public.markets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.market_countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  market_id uuid NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (market_id, country_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_countries TO authenticated;
GRANT ALL ON public.market_countries TO service_role;
ALTER TABLE public.market_countries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "market countries manage" ON public.market_countries FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

-- 8) Price list items
CREATE TABLE IF NOT EXISTS public.price_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  price_list_id uuid NOT NULL REFERENCES public.price_lists(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE,
  country_code text,
  currency text NOT NULL,
  price numeric(14,2) NOT NULL,
  compare_at_price numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_price_list_item ON public.price_list_items (price_list_id, product_id, COALESCE(variant_id,'00000000-0000-0000-0000-000000000000'::uuid), COALESCE(country_code,''));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_list_items TO authenticated;
GRANT ALL ON public.price_list_items TO service_role;
ALTER TABLE public.price_list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price list items manage" ON public.price_list_items FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER trg_price_list_items_updated BEFORE UPDATE ON public.price_list_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 9) Product / variant market prices
CREATE TABLE IF NOT EXISTS public.product_market_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  market_id uuid NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE,
  currency text NOT NULL,
  price numeric(14,2),
  compare_at_price numeric(14,2),
  source public.price_source NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_market_price ON public.product_market_prices (market_id, product_id, COALESCE(variant_id,'00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS idx_pmp_store_product ON public.product_market_prices (store_id, product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_market_prices TO authenticated;
GRANT ALL ON public.product_market_prices TO service_role;
ALTER TABLE public.product_market_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product market prices manage" ON public.product_market_prices FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER trg_pmp_updated BEFORE UPDATE ON public.product_market_prices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 10) Pricing rules
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_rules TO authenticated;
GRANT ALL ON public.pricing_rules TO service_role;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing rules manage" ON public.pricing_rules FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER trg_pricing_rules_updated BEFORE UPDATE ON public.pricing_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 11) Pricing campaigns
CREATE TABLE IF NOT EXISTS public.pricing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  currency text NOT NULL,
  rate numeric(18,6),
  markup_type public.markup_type NOT NULL DEFAULT 'none',
  markup_value numeric(12,4) NOT NULL DEFAULT 0,
  rounding public.rounding_mode NOT NULL DEFAULT 'none',
  market_id uuid REFERENCES public.markets(id) ON DELETE CASCADE,
  price_list_id uuid REFERENCES public.price_lists(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_campaigns TO authenticated;
GRANT ALL ON public.pricing_campaigns TO service_role;
ALTER TABLE public.pricing_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing campaigns manage" ON public.pricing_campaigns FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER trg_pricing_campaigns_updated BEFORE UPDATE ON public.pricing_campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.pricing_campaigns_validate() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.ends_at <= NEW.starts_at THEN RAISE EXCEPTION 'Kampanya bitiş tarihi başlangıçtan sonra olmalı'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_pricing_campaigns_validate BEFORE INSERT OR UPDATE ON public.pricing_campaigns FOR EACH ROW EXECUTE FUNCTION public.pricing_campaigns_validate();

-- 12) Price snapshots
CREATE TABLE IF NOT EXISTS public.price_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  market_id uuid REFERENCES public.markets(id) ON DELETE SET NULL,
  cart_token text,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  currency text NOT NULL,
  exchange_rate numeric(18,6),
  rate_source text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_price_snapshots_lookup ON public.price_snapshots (store_id, cart_token, created_at DESC);
GRANT SELECT ON public.price_snapshots TO authenticated;
GRANT ALL ON public.price_snapshots TO service_role;
ALTER TABLE public.price_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price snapshots read" ON public.price_snapshots FOR SELECT TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()));

-- 13) Pricing audit logs
CREATE TABLE IF NOT EXISTS public.pricing_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  market_id uuid REFERENCES public.markets(id) ON DELETE SET NULL,
  currency text,
  old_price numeric(14,2),
  new_price numeric(14,2),
  reason text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pricing_audit_store ON public.pricing_audit_logs (store_id, created_at DESC);
GRANT SELECT ON public.pricing_audit_logs TO authenticated;
GRANT ALL ON public.pricing_audit_logs TO service_role;
ALTER TABLE public.pricing_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing audit read" ON public.pricing_audit_logs FOR SELECT TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()));

-- 14) Orders: market / currency snapshot columns (mevcut alanlar korunur)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS market_id uuid REFERENCES public.markets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS display_currency text,
  ADD COLUMN IF NOT EXISTS exchange_rate numeric(18,6),
  ADD COLUMN IF NOT EXISTS rate_source text,
  ADD COLUMN IF NOT EXISTS pricing_snapshot jsonb;