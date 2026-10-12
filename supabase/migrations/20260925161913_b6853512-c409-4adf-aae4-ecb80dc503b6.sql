DROP POLICY IF EXISTS "Anyone reads reviews" ON public.v2_theme_template_reviews;
CREATE POLICY "Signed-in users read reviews of published templates" ON public.v2_theme_template_reviews
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.v2_theme_templates tt WHERE tt.id = template_id AND (tt.is_published OR app_private.has_role(auth.uid(), 'platform_admin'::app_role))));
REVOKE SELECT ON public.v2_theme_template_reviews FROM anon;

DROP POLICY IF EXISTS "Anyone reads screenshots" ON public.v2_theme_template_screenshots;
CREATE POLICY "Anyone reads screenshots of published templates" ON public.v2_theme_template_screenshots
FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.v2_theme_templates tt WHERE tt.id = template_id AND tt.is_published));

DROP POLICY IF EXISTS "Anyone reads presets" ON public.v2_theme_presets;
CREATE POLICY "Anyone reads official presets" ON public.v2_theme_presets
FOR SELECT TO anon, authenticated
USING (is_official = true OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));