-- 1) connectors: entegrasyon tanımlarını yalnızca mağaza yöneticileri / platform admini görsün
DROP POLICY IF EXISTS "Authenticated can read connectors" ON public.connectors;
CREATE POLICY "Store managers can read connectors"
ON public.connectors
FOR SELECT
TO authenticated
USING (
  app_private.has_role(auth.uid(), 'platform_admin'::app_role)
  OR (
    is_active
    AND (
      EXISTS (SELECT 1 FROM public.stores s WHERE s.owner_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.store_users su
        WHERE su.user_id = auth.uid() AND su.role IN ('owner', 'admin')
      )
    )
  )
);

-- 2) site_sections: admin kontrolü merkezi app_private.has_role() ile standartlaştırıldı
DROP POLICY IF EXISTS site_sections_admin_read ON public.site_sections;
DROP POLICY IF EXISTS site_sections_admin_write ON public.site_sections;

CREATE POLICY site_sections_admin_read
ON public.site_sections
FOR SELECT
TO authenticated
USING (app_private.has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY site_sections_admin_write
ON public.site_sections
FOR ALL
TO authenticated
USING (app_private.has_role(auth.uid(), 'platform_admin'::app_role))
WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'::app_role));