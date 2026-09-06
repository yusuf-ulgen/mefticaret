-- 1) carts: customers must not be able to write pricing totals
DROP POLICY IF EXISTS carts_owner_all ON public.carts;
DROP POLICY IF EXISTS carts_owner_read ON public.carts;
CREATE POLICY carts_owner_read ON public.carts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS carts_owner_insert ON public.carts;
CREATE POLICY carts_owner_insert ON public.carts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 2) customers: block self-service tampering with financial/internal fields
CREATE OR REPLACE FUNCTION public.customers_guard_sensitive_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role / server jobs (no JWT) and store staff are allowed to change anything.
  IF auth.uid() IS NULL OR app_private.can_manage_store(OLD.store_id, auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.total_spent IS DISTINCT FROM OLD.total_spent
     OR NEW.orders_count IS DISTINCT FROM OLD.orders_count
     OR NEW.tags IS DISTINCT FROM OLD.tags
     OR NEW.notes IS DISTINCT FROM OLD.notes
     OR NEW.store_id IS DISTINCT FROM OLD.store_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Bu alanlar yalnızca mağaza ekibi tarafından güncellenebilir.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customers_guard_sensitive_self_update ON public.customers;
CREATE TRIGGER customers_guard_sensitive_self_update
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.customers_guard_sensitive_self_update();

-- 3) return_requests: customers can only cancel their own pending request
CREATE OR REPLACE FUNCTION public.return_requests_guard_customer_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR app_private.can_manage_store(OLD.store_id, auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Customers may only keep the request as-is or cancel it.
  IF NEW.status NOT IN ('requested', 'cancelled') THEN
    RAISE EXCEPTION 'İade talebinin durumu yalnızca mağaza ekibi tarafından değiştirilebilir.';
  END IF;

  IF NEW.refund_amount IS DISTINCT FROM OLD.refund_amount
     OR NEW.staff_note IS DISTINCT FROM OLD.staff_note
     OR NEW.restock IS DISTINCT FROM OLD.restock
     OR NEW.resolved_at IS DISTINCT FROM OLD.resolved_at
     OR NEW.order_id IS DISTINCT FROM OLD.order_id
     OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.store_id IS DISTINCT FROM OLD.store_id
     OR NEW.return_number IS DISTINCT FROM OLD.return_number THEN
    RAISE EXCEPTION 'İade tutarı ve işlem alanları yalnızca mağaza ekibi tarafından güncellenebilir.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS return_requests_guard_customer_update ON public.return_requests;
CREATE TRIGGER return_requests_guard_customer_update
  BEFORE UPDATE ON public.return_requests
  FOR EACH ROW EXECUTE FUNCTION public.return_requests_guard_customer_update();