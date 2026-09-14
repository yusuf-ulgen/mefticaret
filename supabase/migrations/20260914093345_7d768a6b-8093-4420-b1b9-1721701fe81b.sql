CREATE OR REPLACE FUNCTION app_private.is_store_active(_store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_private AS $$
  SELECT EXISTS (SELECT 1 FROM public.stores s WHERE s.id = _store_id AND s.status = 'active')
$$;
REVOKE ALL ON FUNCTION app_private.is_store_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.is_store_active(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "store_locales public read" ON public.store_locales;
CREATE POLICY "store_locales public read"
ON public.store_locales FOR SELECT TO anon, authenticated
USING (is_active AND app_private.is_store_active(store_id));

DROP POLICY IF EXISTS "Visitors read published themes" ON public.store_themes;
CREATE POLICY "Visitors read published themes"
ON public.store_themes FOR SELECT TO anon
USING (is_published AND app_private.is_store_active(store_id));

DROP POLICY IF EXISTS "Signed-in visitors read published themes" ON public.store_themes;
CREATE POLICY "Signed-in visitors read published themes"
ON public.store_themes FOR SELECT TO authenticated
USING (is_published AND app_private.is_store_active(store_id));

DROP POLICY IF EXISTS "translation_settings public read" ON public.translation_settings;
CREATE POLICY "translation_settings public read"
ON public.translation_settings FOR SELECT TO anon, authenticated
USING (enabled AND app_private.is_store_active(store_id));