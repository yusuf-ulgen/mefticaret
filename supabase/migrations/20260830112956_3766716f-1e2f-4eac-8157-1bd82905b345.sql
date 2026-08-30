-- FAZ 24 düzeltme: yetki fonksiyonu parametre sırası (_store_id, _user_id)
DROP POLICY "Store members read channels" ON public.marketplace_channels;
DROP POLICY "Store managers write channels" ON public.marketplace_channels;
DROP POLICY "Store members read listings" ON public.channel_listings;
DROP POLICY "Store managers write listings" ON public.channel_listings;

CREATE POLICY "Store members read channels" ON public.marketplace_channels
  FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "Store managers write channels" ON public.marketplace_channels
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "Store members read listings" ON public.channel_listings
  FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "Store managers write listings" ON public.channel_listings
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));