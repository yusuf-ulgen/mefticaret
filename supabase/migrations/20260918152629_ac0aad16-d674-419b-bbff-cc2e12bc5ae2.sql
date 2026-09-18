DROP POLICY IF EXISTS audit_select ON public.audit_logs;
CREATE POLICY audit_select ON public.audit_logs FOR SELECT TO authenticated
USING (
  (store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid()))
  OR actor_id = auth.uid()
  OR app_private.has_role(auth.uid(), 'platform_admin'::app_role)
);

DROP POLICY IF EXISTS order_notes_member_read ON public.order_notes;
CREATE POLICY order_notes_member_read ON public.order_notes FOR SELECT TO authenticated
USING (
  app_private.can_manage_store(store_id, auth.uid())
  OR app_private.has_role(auth.uid(), 'platform_admin'::app_role)
  OR (is_internal = false AND app_private.is_store_member(store_id, auth.uid()))
);