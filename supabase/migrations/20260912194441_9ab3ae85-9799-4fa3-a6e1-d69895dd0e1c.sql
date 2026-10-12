DROP POLICY IF EXISTS billing_cycles_select ON public.billing_cycles;
DROP POLICY IF EXISTS invoices_select ON public.invoices;
DROP POLICY IF EXISTS subscriptions_select ON public.subscriptions;
DROP POLICY IF EXISTS usage_records_select ON public.usage_records;
DROP POLICY IF EXISTS subscription_items_select ON public.subscription_items;

CREATE POLICY subscription_items_read ON public.subscription_items
  FOR SELECT TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));