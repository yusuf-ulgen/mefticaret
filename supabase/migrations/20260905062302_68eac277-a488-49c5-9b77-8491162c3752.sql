DROP POLICY IF EXISTS customers_read ON public.customers;
CREATE POLICY customers_read ON public.customers
FOR SELECT TO authenticated
USING (
  app_private.can_manage_store(store_id, auth.uid())
  OR app_private.has_store_role(store_id, auth.uid(), ARRAY['staff','support']::public.store_role[])
);