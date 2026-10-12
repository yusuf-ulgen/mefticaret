DROP POLICY IF EXISTS "Anyone can read published platform pages" ON public.platform_pages;

CREATE POLICY "Anyone can read published platform pages"
ON public.platform_pages FOR SELECT
TO anon, authenticated
USING (is_published = true);

CREATE POLICY "Platform admins read all platform pages"
ON public.platform_pages FOR SELECT
TO authenticated
USING (app_private.has_role(auth.uid(), 'platform_admin'::public.app_role));