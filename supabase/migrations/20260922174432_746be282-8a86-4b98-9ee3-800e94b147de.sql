CREATE TABLE IF NOT EXISTS public.platform_currency_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  rate numeric(12,4) NOT NULL,
  source text NOT NULL DEFAULT 'tcmb',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_currency_rates TO anon;
GRANT SELECT ON public.platform_currency_rates TO authenticated;
GRANT ALL ON public.platform_currency_rates TO service_role;

ALTER TABLE public.platform_currency_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_currency_rates_read" ON public.platform_currency_rates;
CREATE POLICY "platform_currency_rates_read"
ON public.platform_currency_rates
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "platform_currency_rates_admin" ON public.platform_currency_rates;
CREATE POLICY "platform_currency_rates_admin"
ON public.platform_currency_rates
FOR ALL
TO authenticated
USING (app_private.has_role(auth.uid(), 'platform_admin'::app_role))
WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'::app_role));

DROP TRIGGER IF EXISTS set_platform_currency_rates_updated_at ON public.platform_currency_rates;
CREATE TRIGGER set_platform_currency_rates_updated_at
BEFORE UPDATE ON public.platform_currency_rates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.platform_currency_rates (code, rate)
VALUES ('USD', 50.2500), ('EUR', 49.8000), ('GBP', 44.5000)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.xml_feeds
ADD COLUMN IF NOT EXISTS currency_config jsonb NOT NULL DEFAULT '{
  "source_currency": "TRY",
  "target_currency": "TRY",
  "auto_convert": false,
  "exchange_rate_type": "auto",
  "manual_rate": 1.0,
  "profit_margin_percent": 0.0
}'::jsonb;