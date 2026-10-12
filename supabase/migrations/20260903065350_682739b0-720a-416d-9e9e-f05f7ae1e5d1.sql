GRANT SELECT ON public.shipping_zones TO anon;
GRANT SELECT ON public.shipping_rates TO anon;
GRANT SELECT ON public.store_payment_methods TO anon;

CREATE POLICY "shipping_zones_public_read" ON public.shipping_zones
  FOR SELECT TO anon, authenticated
  USING (is_active AND app_private.is_store_published(store_id));

CREATE POLICY "shipping_rates_public_read" ON public.shipping_rates
  FOR SELECT TO anon, authenticated
  USING (
    is_active
    AND EXISTS (
      SELECT 1 FROM public.shipping_zones z
      WHERE z.id = shipping_rates.zone_id
        AND z.is_active
        AND app_private.is_store_published(z.store_id)
    )
  );

CREATE POLICY "store_payment_methods_public_read" ON public.store_payment_methods
  FOR SELECT TO anon, authenticated
  USING (is_active AND app_private.is_store_published(store_id));