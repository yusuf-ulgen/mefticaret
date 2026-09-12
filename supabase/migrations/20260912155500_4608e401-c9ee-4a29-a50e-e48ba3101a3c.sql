DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname, tablename FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('roles','permissions','role_permissions')
       AND cmd IN ('SELECT','ALL')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

CREATE POLICY "roles_platform_admin_read" ON public.roles
  FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "permissions_platform_admin_read" ON public.permissions
  FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "role_permissions_platform_admin_read" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'::app_role));

REVOKE SELECT ON public.roles, public.permissions, public.role_permissions FROM anon;
GRANT SELECT ON public.roles, public.permissions, public.role_permissions TO authenticated;
GRANT ALL ON public.roles, public.permissions, public.role_permissions TO service_role;