DROP POLICY IF EXISTS "us_sales_tax_rates_read" ON public.us_sales_tax_rates;
CREATE POLICY "us_sales_tax_rates_read" ON public.us_sales_tax_rates FOR SELECT TO authenticated
USING (
  app_private.has_role(auth.uid(), 'platform_admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.stores s WHERE s.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.store_users su WHERE su.user_id = auth.uid())
);
DROP POLICY IF EXISTS "eu_vat_rates_read" ON public.eu_vat_rates;
CREATE POLICY "eu_vat_rates_read" ON public.eu_vat_rates FOR SELECT TO authenticated
USING (
  app_private.has_role(auth.uid(), 'platform_admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.stores s WHERE s.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.store_users su WHERE su.user_id = auth.uid())
);