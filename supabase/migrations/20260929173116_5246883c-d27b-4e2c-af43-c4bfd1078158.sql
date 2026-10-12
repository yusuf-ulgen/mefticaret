DROP POLICY IF EXISTS "blog_related public read" ON public.blog_related_posts;
CREATE POLICY "blog_related public read" ON public.blog_related_posts FOR SELECT TO anon, authenticated
USING (store_id IS NULL OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = blog_related_posts.store_id AND s.status = 'active'));

DROP POLICY IF EXISTS "blog_settings public read" ON public.blog_settings;
CREATE POLICY "blog_settings public read" ON public.blog_settings FOR SELECT TO anon, authenticated
USING (store_id IS NULL OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = blog_settings.store_id AND s.status = 'active'));

DROP POLICY IF EXISTS "Cookie banner settings public" ON public.cookie_banner_settings;
CREATE POLICY "Cookie banner settings public" ON public.cookie_banner_settings FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = cookie_banner_settings.store_id AND s.status = 'active'));

DROP POLICY IF EXISTS "Placeholders readable" ON public.policy_placeholders;
CREATE POLICY "Placeholders readable" ON public.policy_placeholders FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Templates readable" ON public.policy_templates;
CREATE POLICY "Templates readable" ON public.policy_templates FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);