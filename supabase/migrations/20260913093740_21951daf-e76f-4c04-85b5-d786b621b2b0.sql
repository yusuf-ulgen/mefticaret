-- 1) customers: müşteri self-update koruması (yeniden, sertleştirilmiş)
CREATE OR REPLACE FUNCTION public.customers_guard_sensitive_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Servis rolü / server job'lar (JWT yok) ve mağaza ekibi her alanı değiştirebilir.
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

-- 2) marketplace_sellers: satıcı self-update koruması (yönetim alanları kilitli)
CREATE OR REPLACE FUNCTION public.guard_marketplace_seller_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR app_private.can_manage_store(NEW.store_id, auth.uid())
     OR app_private.has_role(auth.uid(), 'platform_admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
     OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
     OR NEW.store_id IS DISTINCT FROM OLD.store_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Satıcı bu alanları kendisi değiştiremez';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_marketplace_seller_update ON public.marketplace_sellers;
CREATE TRIGGER guard_marketplace_seller_update
  BEFORE UPDATE ON public.marketplace_sellers
  FOR EACH ROW EXECUTE FUNCTION public.guard_marketplace_seller_update();

-- Sessizce alan geri alan eski koruma yerine reddeden koruma yeterli; sessiz revert trigger'ını kaldır.
DROP TRIGGER IF EXISTS marketplace_sellers_guard_admin_fields ON public.marketplace_sellers;

-- 3) return_requests: müşteri iade talebi koruması (tutar/işlem alanları kilitli)
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

  -- Müşteri talebi olduğu gibi bırakabilir veya iptal edebilir.
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