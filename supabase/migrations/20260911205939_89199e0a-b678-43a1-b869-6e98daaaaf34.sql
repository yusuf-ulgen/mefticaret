CREATE OR REPLACE FUNCTION app_private.marketplace_sellers_guard_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
BEGIN
  -- Mağaza yöneticileri ve servis rolü tüm alanları değiştirebilir.
  IF auth.uid() IS NULL OR app_private.can_manage_store(NEW.store_id, auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id = auth.uid() THEN
    -- Satıcı yalnızca kendi profil alanlarını değiştirebilir.
    NEW.store_id := OLD.store_id;
    NEW.user_id := OLD.user_id;
    NEW.status := OLD.status;
    NEW.commission_rate := OLD.commission_rate;
    NEW.iban := OLD.iban;
    NEW.tax_id := OLD.tax_id;
    NEW.legal_name := OLD.legal_name;
    NEW.rejection_reason := OLD.rejection_reason;
    NEW.approved_at := OLD.approved_at;
    NEW.suspended_at := OLD.suspended_at;
    NEW.created_at := OLD.created_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketplace_sellers_guard_self_update ON public.marketplace_sellers;
CREATE TRIGGER marketplace_sellers_guard_self_update
BEFORE UPDATE ON public.marketplace_sellers
FOR EACH ROW EXECUTE FUNCTION app_private.marketplace_sellers_guard_self_update();