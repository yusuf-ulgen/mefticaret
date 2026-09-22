DROP POLICY IF EXISTS "app_permissions_read" ON public.app_permissions;
CREATE POLICY "app_permissions_read" ON public.app_permissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.apps a WHERE a.id = app_permissions.app_id AND a.is_active)
    OR app_private.has_role(auth.uid(), 'platform_admin'::app_role)
  );