CREATE TABLE public.store_global_settings (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  geo_detect_enabled boolean NOT NULL DEFAULT true,
  fx_buffer_percent numeric(6,3) NOT NULL DEFAULT 0 CHECK (fx_buffer_percent >= 0 AND fx_buffer_percent <= 25),
  default_incoterm text NOT NULL DEFAULT 'DDU' CHECK (default_incoterm IN ('DDP','DDU')),
  ioss_enabled boolean NOT NULL DEFAULT false,
  ioss_number text,
  oss_enabled boolean NOT NULL DEFAULT false,
  us_nexus_states text[] NOT NULL DEFAULT '{}',
  rtl_auto boolean NOT NULL DEFAULT true,
  exporter_name text,
  exporter_tax_id text,
  exporter_address text,
  exporter_city text,
  exporter_country text DEFAULT 'TR',
  exporter_phone text,
  exporter_email text,
  default_hs_code text,
  auto_translate_locales text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.country_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  currency text NOT NULL,
  price numeric(14,2) NOT NULL CHECK (price >= 0),
  compare_at_price numeric(14,2),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, product_id, country_code)
);
CREATE INDEX country_prices_store_country_idx ON public.country_prices(store_id, country_code);

CREATE TABLE public.global_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('stripe','paypal','klarna','sepa','sofort')),
  label text NOT NULL,
  countries text[] NOT NULL DEFAULT '{}',
  currencies text[] NOT NULL DEFAULT '{}',
  mode text NOT NULL DEFAULT 'test' CHECK (mode IN ('test','live')),
  is_active boolean NOT NULL DEFAULT false,
  credentials_ready boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_status text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, provider)
);

CREATE TABLE public.global_carriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  carrier_code text NOT NULL CHECK (carrier_code IN ('dhl','fedex','ups','ptt','navlungo','shipentegra','aramex')),
  label text NOT NULL,
  account_number text,
  mode text NOT NULL DEFAULT 'test' CHECK (mode IN ('test','live')),
  is_active boolean NOT NULL DEFAULT false,
  credentials_ready boolean NOT NULL DEFAULT false,
  supports_micro_export boolean NOT NULL DEFAULT true,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_status text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, carrier_code)
);

CREATE TABLE public.customs_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  hs_code text,
  origin_country text NOT NULL DEFAULT 'TR',
  weight_grams integer CHECK (weight_grams IS NULL OR weight_grams >= 0),
  description_en text,
  material text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, product_id)
);

CREATE TABLE public.export_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('commercial_invoice','packing_list','etgb')),
  document_number text NOT NULL,
  incoterm text NOT NULL DEFAULT 'DDU' CHECK (incoterm IN ('DDP','DDU')),
  currency text NOT NULL DEFAULT 'USD',
  total_value numeric(14,2) NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, kind, document_number)
);
CREATE INDEX export_documents_order_idx ON public.export_documents(store_id, order_id);

CREATE TABLE public.global_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  carrier_code text NOT NULL,
  service text,
  tracking_number text,
  label_url text,
  incoterm text NOT NULL DEFAULT 'DDU' CHECK (incoterm IN ('DDP','DDU')),
  destination_country text,
  weight_grams integer,
  cost numeric(14,2),
  currency text,
  status text NOT NULL DEFAULT 'created',
  last_event text,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX global_shipments_order_idx ON public.global_shipments(store_id, order_id);

CREATE TABLE public.eu_vat_rates (
  country_code text PRIMARY KEY,
  name text NOT NULL,
  standard_rate numeric(5,2) NOT NULL
);

CREATE TABLE public.us_sales_tax_rates (
  state_code text PRIMARY KEY,
  name text NOT NULL,
  rate numeric(5,2) NOT NULL
);

INSERT INTO public.eu_vat_rates (country_code, name, standard_rate) VALUES
 ('AT','Austria',20),('BE','Belgium',21),('BG','Bulgaria',20),('HR','Croatia',25),
 ('CY','Cyprus',19),('CZ','Czechia',21),('DK','Denmark',25),('EE','Estonia',22),
 ('FI','Finland',25.5),('FR','France',20),('DE','Germany',19),('GR','Greece',24),
 ('HU','Hungary',27),('IE','Ireland',23),('IT','Italy',22),('LV','Latvia',21),
 ('LT','Lithuania',21),('LU','Luxembourg',17),('MT','Malta',18),('NL','Netherlands',21),
 ('PL','Poland',23),('PT','Portugal',23),('RO','Romania',21),('SK','Slovakia',23),
 ('SI','Slovenia',22),('ES','Spain',21),('SE','Sweden',25);

INSERT INTO public.us_sales_tax_rates (state_code, name, rate) VALUES
 ('AL','Alabama',4),('AK','Alaska',0),('AZ','Arizona',5.6),('AR','Arkansas',6.5),
 ('CA','California',7.25),('CO','Colorado',2.9),('CT','Connecticut',6.35),('DE','Delaware',0),
 ('FL','Florida',6),('GA','Georgia',4),('HI','Hawaii',4),('ID','Idaho',6),
 ('IL','Illinois',6.25),('IN','Indiana',7),('IA','Iowa',6),('KS','Kansas',6.5),
 ('KY','Kentucky',6),('LA','Louisiana',4.45),('ME','Maine',5.5),('MD','Maryland',6),
 ('MA','Massachusetts',6.25),('MI','Michigan',6),('MN','Minnesota',6.875),('MS','Mississippi',7),
 ('MO','Missouri',4.225),('MT','Montana',0),('NE','Nebraska',5.5),('NV','Nevada',6.85),
 ('NH','New Hampshire',0),('NJ','New Jersey',6.625),('NM','New Mexico',4.875),('NY','New York',4),
 ('NC','North Carolina',4.75),('ND','North Dakota',5),('OH','Ohio',5.75),('OK','Oklahoma',4.5),
 ('OR','Oregon',0),('PA','Pennsylvania',6),('RI','Rhode Island',7),('SC','South Carolina',6),
 ('SD','South Dakota',4.2),('TN','Tennessee',7),('TX','Texas',6.25),('UT','Utah',6.1),
 ('VT','Vermont',6),('VA','Virginia',5.3),('WA','Washington',6.5),('WV','West Virginia',6),
 ('WI','Wisconsin',5),('WY','Wyoming',4),('DC','District of Columbia',6);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_global_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.country_prices TO authenticated;
GRANT SELECT ON public.country_prices TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.global_payment_methods TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.global_carriers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customs_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.export_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.global_shipments TO authenticated;
GRANT SELECT ON public.eu_vat_rates TO authenticated, anon;
GRANT SELECT ON public.us_sales_tax_rates TO authenticated, anon;
GRANT ALL ON public.store_global_settings TO service_role;
GRANT ALL ON public.country_prices TO service_role;
GRANT ALL ON public.global_payment_methods TO service_role;
GRANT ALL ON public.global_carriers TO service_role;
GRANT ALL ON public.customs_profiles TO service_role;
GRANT ALL ON public.export_documents TO service_role;
GRANT ALL ON public.global_shipments TO service_role;
GRANT ALL ON public.eu_vat_rates TO service_role;
GRANT ALL ON public.us_sales_tax_rates TO service_role;

ALTER TABLE public.store_global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customs_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eu_vat_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.us_sales_tax_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eu_vat_rates_read" ON public.eu_vat_rates FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "us_sales_tax_rates_read" ON public.us_sales_tax_rates FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "country_prices_public_read" ON public.country_prices FOR SELECT TO anon
  USING (is_active AND app_private.is_store_published(store_id));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'store_global_settings','country_prices','global_payment_methods','global_carriers',
    'customs_profiles','export_documents','global_shipments'
  ]
  LOOP
    EXECUTE format($f$
      CREATE POLICY %1$I ON public.%2$I FOR SELECT TO authenticated
        USING (app_private.is_store_member(store_id, auth.uid())
               OR app_private.has_role(auth.uid(), 'platform_admin'));
    $f$, t || '_select', t);
    EXECUTE format($f$
      CREATE POLICY %1$I ON public.%2$I FOR ALL TO authenticated
        USING (app_private.can_manage_store(store_id, auth.uid())
               OR app_private.has_role(auth.uid(), 'platform_admin'))
        WITH CHECK (app_private.can_manage_store(store_id, auth.uid())
               OR app_private.has_role(auth.uid(), 'platform_admin'));
    $f$, t || '_manage', t);
  END LOOP;
END $$;

CREATE TRIGGER store_global_settings_updated BEFORE UPDATE ON public.store_global_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER country_prices_updated BEFORE UPDATE ON public.country_prices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER global_payment_methods_updated BEFORE UPDATE ON public.global_payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER global_carriers_updated BEFORE UPDATE ON public.global_carriers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER customs_profiles_updated BEFORE UPDATE ON public.customs_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER global_shipments_updated BEFORE UPDATE ON public.global_shipments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();