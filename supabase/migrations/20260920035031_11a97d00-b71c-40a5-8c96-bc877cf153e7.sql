-- 1) translation_usage: mağaza üyeleri kullanım kaydı yazabilsin
GRANT INSERT, UPDATE ON public.translation_usage TO authenticated;

DROP POLICY IF EXISTS "translation_usage member write" ON public.translation_usage;
CREATE POLICY "translation_usage member write" ON public.translation_usage
  FOR INSERT TO authenticated
  WITH CHECK (app_private.is_store_member(store_id, auth.uid()));

DROP POLICY IF EXISTS "translation_usage member update" ON public.translation_usage;
CREATE POLICY "translation_usage member update" ON public.translation_usage
  FOR UPDATE TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()))
  WITH CHECK (app_private.is_store_member(store_id, auth.uid()));

-- 2) email_campaigns: anon sıralama için created_at okuma izni
GRANT SELECT (created_at) ON public.email_campaigns TO anon;