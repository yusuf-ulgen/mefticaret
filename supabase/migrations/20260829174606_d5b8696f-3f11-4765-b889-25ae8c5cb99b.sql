CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION app_private.is_store_member(_store_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.stores s WHERE s.id = _store_id AND s.owner_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.store_users su WHERE su.store_id = _store_id AND su.user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION app_private.has_store_role(_store_id UUID, _user_id UUID, _roles public.store_role[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.stores s WHERE s.id = _store_id AND s.owner_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.store_users su WHERE su.store_id = _store_id AND su.user_id = _user_id AND su.role = ANY(_roles));
$$;

CREATE OR REPLACE FUNCTION app_private.can_manage_store(_store_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app_private.has_store_role(_store_id, _user_id, ARRAY['owner','admin']::public.store_role[])
      OR app_private.has_role(_user_id, 'platform_admin');
$$;

REVOKE ALL ON FUNCTION app_private.has_role(UUID, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.is_store_member(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.has_store_role(UUID, UUID, public.store_role[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.can_manage_store(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.has_role(UUID, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.is_store_member(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.has_store_role(UUID, UUID, public.store_role[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.can_manage_store(UUID, UUID) TO authenticated, service_role;

-- rebuild policies on the private helpers
DROP POLICY "user_roles_select_own" ON public.user_roles;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR app_private.has_role(auth.uid(),'platform_admin'));

DROP POLICY "plans_admin_write" ON public.plans;
CREATE POLICY "plans_admin_write" ON public.plans FOR ALL TO authenticated
USING (app_private.has_role(auth.uid(),'platform_admin')) WITH CHECK (app_private.has_role(auth.uid(),'platform_admin'));

DROP POLICY "stores_select_members" ON public.stores;
CREATE POLICY "stores_select_demo_anon" ON public.stores FOR SELECT TO anon USING (is_demo);
CREATE POLICY "stores_select_members" ON public.stores FOR SELECT TO authenticated
USING (is_demo OR app_private.is_store_member(id, auth.uid()) OR app_private.has_role(auth.uid(),'platform_admin'));
DROP POLICY "stores_update_managers" ON public.stores;
CREATE POLICY "stores_update_managers" ON public.stores FOR UPDATE TO authenticated
USING (app_private.can_manage_store(id, auth.uid())) WITH CHECK (app_private.can_manage_store(id, auth.uid()));
DROP POLICY "stores_delete_owner" ON public.stores;
CREATE POLICY "stores_delete_owner" ON public.stores FOR DELETE TO authenticated
USING (owner_id = auth.uid() OR app_private.has_role(auth.uid(),'platform_admin'));

DROP POLICY "store_users_select_members" ON public.store_users;
CREATE POLICY "store_users_select_members" ON public.store_users FOR SELECT TO authenticated
USING (user_id = auth.uid() OR app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(),'platform_admin'));
DROP POLICY "store_users_manage" ON public.store_users;
CREATE POLICY "store_users_manage" ON public.store_users FOR ALL TO authenticated
USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

DROP POLICY "store_domains_select" ON public.store_domains;
CREATE POLICY "store_domains_select" ON public.store_domains FOR SELECT TO authenticated
USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(),'platform_admin'));
DROP POLICY "store_domains_manage" ON public.store_domains;
CREATE POLICY "store_domains_manage" ON public.store_domains FOR ALL TO authenticated
USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

DROP POLICY "store_settings_select" ON public.store_settings;
CREATE POLICY "store_settings_select" ON public.store_settings FOR SELECT TO authenticated
USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(),'platform_admin'));
DROP POLICY "store_settings_manage" ON public.store_settings;
CREATE POLICY "store_settings_manage" ON public.store_settings FOR ALL TO authenticated
USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

DROP POLICY "stats_select" ON public.store_daily_stats;
CREATE POLICY "stats_select_demo_anon" ON public.store_daily_stats FOR SELECT TO anon
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.is_demo));
CREATE POLICY "stats_select_members" ON public.store_daily_stats FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.is_demo)
   OR app_private.is_store_member(store_id, auth.uid())
   OR app_private.has_role(auth.uid(),'platform_admin'));
DROP POLICY "stats_manage" ON public.store_daily_stats;
CREATE POLICY "stats_manage" ON public.store_daily_stats FOR ALL TO authenticated
USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

DROP POLICY "audit_select" ON public.audit_logs;
CREATE POLICY "audit_select" ON public.audit_logs FOR SELECT TO authenticated
USING ((store_id IS NOT NULL AND app_private.is_store_member(store_id, auth.uid())) OR actor_id = auth.uid() OR app_private.has_role(auth.uid(),'platform_admin'));
DROP POLICY "audit_insert_self" ON public.audit_logs;
CREATE POLICY "audit_insert_self" ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid() AND (store_id IS NULL OR app_private.is_store_member(store_id, auth.uid())));

DROP FUNCTION IF EXISTS public.can_manage_store(UUID, UUID);
DROP FUNCTION IF EXISTS public.has_store_role(UUID, UUID, public.store_role[]);
DROP FUNCTION IF EXISTS public.is_store_member(UUID, UUID);
DROP FUNCTION IF EXISTS public.has_role(UUID, public.app_role);