-- 1) Mevcut mağazalar için fiyatlandırma ayarları
INSERT INTO public.store_pricing_settings (store_id, base_currency)
SELECT s.id, upper(s.currency)
FROM public.stores s
ON CONFLICT (store_id) DO NOTHING;

-- 2) Ana para birimleri
INSERT INTO public.store_currencies (store_id, currency, is_active, is_base)
SELECT s.id, upper(s.currency), true, true
FROM public.stores s
ON CONFLICT (store_id, currency) DO UPDATE SET is_base = true, is_active = true;

-- 3) store_settings.display_currencies içindeki ek para birimleri
INSERT INTO public.store_currencies (store_id, currency, is_active, is_base)
SELECT ss.store_id, upper(c), true, false
FROM public.store_settings ss
CROSS JOIN LATERAL unnest(ss.display_currencies) AS c
WHERE upper(c) <> upper(ss.base_currency)
  AND EXISTS (SELECT 1 FROM public.platform_currencies pc WHERE pc.code = upper(c))
ON CONFLICT (store_id, currency) DO NOTHING;

-- 4) Varsayılan market
INSERT INTO public.markets (store_id, name, code, country_code, currency, locale, tax_included, is_default, is_active)
SELECT s.id,
       'Varsayılan Market',
       'default',
       CASE WHEN upper(s.currency) = 'TRY' THEN 'TR' ELSE NULL END,
       upper(s.currency),
       s.locale,
       true,
       true,
       true
FROM public.stores s
WHERE NOT EXISTS (SELECT 1 FROM public.markets m WHERE m.store_id = s.id)
ON CONFLICT DO NOTHING;

-- 5) Yeni mağazalarda otomatik kurulum
CREATE OR REPLACE FUNCTION public.bootstrap_store_pricing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.store_pricing_settings (store_id, base_currency)
  VALUES (NEW.id, upper(NEW.currency))
  ON CONFLICT (store_id) DO NOTHING;

  INSERT INTO public.store_currencies (store_id, currency, is_active, is_base)
  VALUES (NEW.id, upper(NEW.currency), true, true)
  ON CONFLICT (store_id, currency) DO NOTHING;

  INSERT INTO public.markets (store_id, name, code, country_code, currency, locale, tax_included, is_default, is_active)
  VALUES (
    NEW.id,
    'Varsayılan Market',
    'default',
    CASE WHEN upper(NEW.currency) = 'TRY' THEN 'TR' ELSE NULL END,
    upper(NEW.currency),
    NEW.locale,
    true,
    true,
    true
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bootstrap_store_pricing ON public.stores;
CREATE TRIGGER trg_bootstrap_store_pricing
AFTER INSERT ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.bootstrap_store_pricing();