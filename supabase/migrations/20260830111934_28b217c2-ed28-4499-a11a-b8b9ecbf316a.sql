GRANT INSERT, UPDATE, DELETE ON public.plans TO authenticated;

DROP POLICY IF EXISTS "stores_update_managers" ON public.stores;
CREATE POLICY "stores_update_managers" ON public.stores FOR UPDATE TO authenticated
USING (app_private.can_manage_store(id, auth.uid()) OR app_private.has_role(auth.uid(),'platform_admin'))
WITH CHECK (app_private.can_manage_store(id, auth.uid()) OR app_private.has_role(auth.uid(),'platform_admin'));

DROP POLICY IF EXISTS "plans_admin_read_all" ON public.plans;
CREATE POLICY "plans_admin_read_all" ON public.plans FOR SELECT TO authenticated
USING (is_active OR app_private.has_role(auth.uid(),'platform_admin'));