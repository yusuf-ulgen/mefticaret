-- 1) Billing tables: managers read-only, writes only via service role / platform admin
DROP POLICY IF EXISTS subscriptions_manage ON public.subscriptions;
DROP POLICY IF EXISTS invoices_manage ON public.invoices;
DROP POLICY IF EXISTS billing_cycles_manage ON public.billing_cycles;
DROP POLICY IF EXISTS usage_records_manage ON public.usage_records;

CREATE POLICY subscriptions_read ON public.subscriptions FOR SELECT TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY subscriptions_admin_write ON public.subscriptions FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY invoices_read ON public.invoices FOR SELECT TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY invoices_admin_write ON public.invoices FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY billing_cycles_read ON public.billing_cycles FOR SELECT TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY billing_cycles_admin_write ON public.billing_cycles FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY usage_records_read ON public.usage_records FOR SELECT TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY usage_records_admin_write ON public.usage_records FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'::app_role));

-- 2) Block store ownership takeover by non-owner managers
CREATE OR REPLACE FUNCTION app_private.guard_store_owner_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    IF auth.uid() IS NULL THEN
      RETURN NEW; -- service role / trusted server-side path
    END IF;
    IF auth.uid() = OLD.owner_id OR app_private.has_role(auth.uid(), 'platform_admin'::app_role) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Mağaza sahipliği yalnızca mevcut sahip veya platform yöneticisi tarafından değiştirilebilir';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_store_owner_change ON public.stores;
CREATE TRIGGER guard_store_owner_change
BEFORE UPDATE ON public.stores
FOR EACH ROW EXECUTE FUNCTION app_private.guard_store_owner_change();

-- 3) Block sellers from approving themselves / editing commercial fields
CREATE OR REPLACE FUNCTION app_private.guard_seller_privileged_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
BEGIN
  IF auth.uid() IS NULL OR app_private.has_role(auth.uid(), 'platform_admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Satıcı onay durumu ve komisyon oranı yalnızca platform yöneticisi tarafından değiştirilebilir';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_seller_privileged_fields ON public.marketplace_sellers;
CREATE TRIGGER guard_seller_privileged_fields
BEFORE UPDATE ON public.marketplace_sellers
FOR EACH ROW EXECUTE FUNCTION app_private.guard_seller_privileged_fields();