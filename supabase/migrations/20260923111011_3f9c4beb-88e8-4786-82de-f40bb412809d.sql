-- Tighten permissive read rules on shared reference tables: signed-in users only, active rows only.

DROP POLICY IF EXISTS "eu_vat_rates_read" ON public.eu_vat_rates;
CREATE POLICY "eu_vat_rates_read" ON public.eu_vat_rates
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.eu_vat_rates FROM anon;

DROP POLICY IF EXISTS "us_sales_tax_rates_read" ON public.us_sales_tax_rates;
CREATE POLICY "us_sales_tax_rates_read" ON public.us_sales_tax_rates
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.us_sales_tax_rates FROM anon;

DROP POLICY IF EXISTS "platform_currencies readable" ON public.platform_currencies;
CREATE POLICY "platform_currencies_read" ON public.platform_currencies
  FOR SELECT TO authenticated
  USING (is_active = true OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
REVOKE SELECT ON public.platform_currencies FROM anon;

DROP POLICY IF EXISTS "platform_currency_rates_read" ON public.platform_currency_rates;
CREATE POLICY "platform_currency_rates_read" ON public.platform_currency_rates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_currencies c
      WHERE c.code = platform_currency_rates.code AND c.is_active = true
    )
    OR app_private.has_role(auth.uid(), 'platform_admin'::app_role)
  );
REVOKE SELECT ON public.platform_currency_rates FROM anon;

DROP POLICY IF EXISTS "plan_features_public_read" ON public.plan_features;
CREATE POLICY "plan_features_read" ON public.plan_features
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.plans p
      WHERE p.id = plan_features.plan_id AND p.is_active = true
    )
    OR app_private.has_role(auth.uid(), 'platform_admin'::app_role)
  );
REVOKE SELECT ON public.plan_features FROM anon;