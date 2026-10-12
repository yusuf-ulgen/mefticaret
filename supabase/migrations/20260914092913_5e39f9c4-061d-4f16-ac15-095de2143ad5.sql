GRANT USAGE ON SCHEMA app_private TO anon;
GRANT EXECUTE ON FUNCTION app_private.is_store_published(uuid) TO anon;

DROP POLICY IF EXISTS "Herkese acik ayarlar okunur" ON public.platform_settings;

CREATE POLICY "Herkese acik ayarlar okunur"
ON public.platform_settings FOR SELECT TO anon
USING (is_public = true);

CREATE POLICY "Platform yoneticileri tum ayarlari okur"
ON public.platform_settings FOR SELECT TO authenticated
USING (is_public = true OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));