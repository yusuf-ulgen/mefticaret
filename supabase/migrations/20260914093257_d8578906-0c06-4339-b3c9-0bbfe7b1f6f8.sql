DROP POLICY IF EXISTS "store_locales public read" ON public.store_locales;
CREATE POLICY "store_locales public read"
ON public.store_locales FOR SELECT TO anon, authenticated
USING (is_active AND app_private.is_store_published(store_id));

DROP POLICY IF EXISTS "Visitors read published themes" ON public.store_themes;
CREATE POLICY "Visitors read published themes"
ON public.store_themes FOR SELECT TO anon
USING (is_published AND app_private.is_store_published(store_id));

DROP POLICY IF EXISTS "Signed-in visitors read published themes" ON public.store_themes;
CREATE POLICY "Signed-in visitors read published themes"
ON public.store_themes FOR SELECT TO authenticated
USING (is_published AND app_private.is_store_published(store_id));

DROP POLICY IF EXISTS "translation_settings public read" ON public.translation_settings;
CREATE POLICY "translation_settings public read"
ON public.translation_settings FOR SELECT TO anon, authenticated
USING (enabled AND app_private.is_store_published(store_id));