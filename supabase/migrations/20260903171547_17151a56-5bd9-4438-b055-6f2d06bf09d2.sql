ALTER POLICY "Store members read gift cards" ON public.gift_cards
  USING (app_private.is_store_member(store_id, auth.uid()));
ALTER POLICY "Store managers insert gift cards" ON public.gift_cards
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
ALTER POLICY "Store managers update gift cards" ON public.gift_cards
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

ALTER POLICY "Store members read gift card transactions" ON public.gift_card_transactions
  USING (app_private.is_store_member(store_id, auth.uid()));
ALTER POLICY "Store managers insert gift card transactions" ON public.gift_card_transactions
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

ALTER POLICY "Store members read stock alerts" ON public.stock_alerts
  USING (app_private.is_store_member(store_id, auth.uid()));
ALTER POLICY "Store managers update stock alerts" ON public.stock_alerts
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
ALTER POLICY "Store managers delete stock alerts" ON public.stock_alerts
  USING (app_private.can_manage_store(store_id, auth.uid()));

DROP FUNCTION IF EXISTS public.site_kit_public_config(text);

REVOKE ALL ON public.store_site_kit FROM anon;
GRANT SELECT (id, store_id, provider, public_config, is_enabled) ON public.store_site_kit TO anon;

DROP POLICY IF EXISTS "site_kit_public_read" ON public.store_site_kit;
CREATE POLICY "site_kit_public_read" ON public.store_site_kit
  FOR SELECT TO anon
  USING (is_enabled AND app_private.is_store_published(store_id));

DROP POLICY IF EXISTS "store_media_read" ON storage.objects;
CREATE POLICY "store_media_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'store-media'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    AND (
      app_private.is_store_published(((storage.foldername(name))[1])::uuid)
      OR (
        auth.uid() IS NOT NULL
        AND app_private.can_manage_store(((storage.foldername(name))[1])::uuid, auth.uid())
      )
    )
  );