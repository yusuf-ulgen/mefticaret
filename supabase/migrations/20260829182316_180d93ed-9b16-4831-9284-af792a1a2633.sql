CREATE TYPE public.connector_kind AS ENUM ('payment','shipping');

CREATE TABLE public.connectors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  kind public.connector_kind NOT NULL,
  description text,
  logo_url text,
  config_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  supports_installments boolean NOT NULL DEFAULT false,
  supports_test_mode boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.connectors TO authenticated;
GRANT ALL ON public.connectors TO service_role;
ALTER TABLE public.connectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read connectors"
ON public.connectors FOR SELECT TO authenticated USING (is_active OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE TRIGGER connectors_set_updated_at BEFORE UPDATE ON public.connectors
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.store_payment_methods (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  connector_id uuid NOT NULL REFERENCES public.connectors(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  instructions text,
  is_active boolean NOT NULL DEFAULT true,
  test_mode boolean NOT NULL DEFAULT true,
  installments_enabled boolean NOT NULL DEFAULT false,
  extra_fee_rate numeric NOT NULL DEFAULT 0,
  config_ref text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (store_id, connector_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_payment_methods TO authenticated;
GRANT ALL ON public.store_payment_methods TO service_role;
ALTER TABLE public.store_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store members read payment methods"
ON public.store_payment_methods FOR SELECT TO authenticated
USING (app_private.is_store_member(store_id, auth.uid()));

CREATE POLICY "Store managers write payment methods"
ON public.store_payment_methods FOR ALL TO authenticated
USING (app_private.can_manage_store(store_id, auth.uid()))
WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE TRIGGER store_payment_methods_set_updated_at BEFORE UPDATE ON public.store_payment_methods
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.shipping_zones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  countries text[] NOT NULL DEFAULT ARRAY[]::text[],
  cities text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_zones TO authenticated;
GRANT ALL ON public.shipping_zones TO service_role;
ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store members read shipping zones"
ON public.shipping_zones FOR SELECT TO authenticated
USING (app_private.is_store_member(store_id, auth.uid()));

CREATE POLICY "Store managers write shipping zones"
ON public.shipping_zones FOR ALL TO authenticated
USING (app_private.can_manage_store(store_id, auth.uid()))
WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE TRIGGER shipping_zones_set_updated_at BEFORE UPDATE ON public.shipping_zones
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.shipping_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  zone_id uuid NOT NULL REFERENCES public.shipping_zones(id) ON DELETE CASCADE,
  connector_id uuid REFERENCES public.connectors(id) ON DELETE SET NULL,
  title text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  free_over numeric,
  min_weight_grams integer NOT NULL DEFAULT 0,
  max_weight_grams integer,
  eta_days integer,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_rates TO authenticated;
GRANT ALL ON public.shipping_rates TO service_role;
ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store members read shipping rates"
ON public.shipping_rates FOR SELECT TO authenticated
USING (app_private.is_store_member(store_id, auth.uid()));

CREATE POLICY "Store managers write shipping rates"
ON public.shipping_rates FOR ALL TO authenticated
USING (app_private.can_manage_store(store_id, auth.uid()))
WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE TRIGGER shipping_rates_set_updated_at BEFORE UPDATE ON public.shipping_rates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.connectors (code, name, kind, description, config_fields, supports_installments, sort_order) VALUES
('bank_transfer','Havale / EFT','payment','Banka hesabına havale ile ödeme; manuel onay.','[{"key":"iban","label":"IBAN","type":"text","required":true},{"key":"account_name","label":"Hesap adı","type":"text","required":true}]'::jsonb,false,1),
('cash_on_delivery','Kapıda Ödeme','payment','Teslimatta nakit veya kart ile ödeme.','[{"key":"fee","label":"Hizmet bedeli","type":"number","required":false}]'::jsonb,false,2),
('iyzico','iyzico','payment','Kredi kartı, taksit ve 3D Secure.','[{"key":"api_key","label":"API Key","type":"secret","required":true},{"key":"secret_key","label":"Secret Key","type":"secret","required":true}]'::jsonb,true,3),
('paytr','PayTR','payment','Sanal POS ve taksitli ödeme.','[{"key":"merchant_id","label":"Merchant ID","type":"text","required":true},{"key":"merchant_key","label":"Merchant Key","type":"secret","required":true}]'::jsonb,true,4),
('stripe','Stripe','payment','Global kart ödemeleri.','[{"key":"publishable_key","label":"Publishable Key","type":"text","required":true},{"key":"secret_key","label":"Secret Key","type":"secret","required":true}]'::jsonb,true,5),
('manual_shipping','Kendi Kargom','shipping','Manuel kargo takibi.','[]'::jsonb,false,10),
('yurtici','Yurtiçi Kargo','shipping','Yurtiçi Kargo entegrasyonu.','[{"key":"customer_code","label":"Müşteri kodu","type":"text","required":true},{"key":"password","label":"Şifre","type":"secret","required":true}]'::jsonb,false,11),
('aras','Aras Kargo','shipping','Aras Kargo entegrasyonu.','[{"key":"username","label":"Kullanıcı adı","type":"text","required":true},{"key":"password","label":"Şifre","type":"secret","required":true}]'::jsonb,false,12),
('mng','MNG Kargo','shipping','MNG Kargo entegrasyonu.','[{"key":"api_key","label":"API Key","type":"secret","required":true}]'::jsonb,false,13),
('dhl','DHL Express','shipping','Yurt dışı gönderiler.','[{"key":"account_number","label":"Hesap numarası","type":"text","required":true},{"key":"api_key","label":"API Key","type":"secret","required":true}]'::jsonb,false,14);

INSERT INTO public.store_payment_methods (store_id, connector_id, display_name, instructions, is_active, test_mode, installments_enabled, extra_fee_rate, sort_order)
SELECT s.id, c.id, c.name,
  CASE WHEN c.code = 'bank_transfer' THEN 'Sipariş numaranızı açıklamaya yazınız.' ELSE NULL END,
  CASE WHEN c.code = 'stripe' THEN false ELSE true END,
  CASE WHEN c.code = 'iyzico' THEN true ELSE false END,
  c.supports_installments,
  CASE WHEN c.code = 'cash_on_delivery' THEN 0.02 ELSE 0 END,
  c.sort_order
FROM public.stores s
JOIN public.connectors c ON c.kind = 'payment' AND c.code IN ('bank_transfer','cash_on_delivery','iyzico','stripe')
WHERE s.is_demo = true;

WITH z AS (
  INSERT INTO public.shipping_zones (store_id, name, countries, cities, sort_order)
  SELECT s.id, 'Türkiye', ARRAY['TR'], ARRAY[]::text[], 1 FROM public.stores s WHERE s.is_demo = true
  RETURNING id, store_id
)
INSERT INTO public.shipping_rates (store_id, zone_id, connector_id, title, price, free_over, eta_days, sort_order)
SELECT z.store_id, z.id, c.id, 'Standart Kargo', 49.90, 750, 3, 1
FROM z LEFT JOIN public.connectors c ON c.code = 'yurtici'
UNION ALL
SELECT z.store_id, z.id, c.id, 'Hızlı Kargo', 89.90, NULL, 1, 2
FROM z LEFT JOIN public.connectors c ON c.code = 'aras';

WITH z2 AS (
  INSERT INTO public.shipping_zones (store_id, name, countries, cities, sort_order)
  SELECT s.id, 'Yurt Dışı', ARRAY['DE','NL','FR','GB'], ARRAY[]::text[], 2 FROM public.stores s WHERE s.is_demo = true
  RETURNING id, store_id
)
INSERT INTO public.shipping_rates (store_id, zone_id, connector_id, title, price, free_over, eta_days, sort_order)
SELECT z2.store_id, z2.id, c.id, 'DHL Express', 599.00, NULL, 5, 1
FROM z2 LEFT JOIN public.connectors c ON c.code = 'dhl';