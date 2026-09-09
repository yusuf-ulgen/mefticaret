-- Mağaza sahipliği/plan/demo alanlarını yalnızca sahibi veya platform yöneticisi değiştirebilir.
CREATE OR REPLACE FUNCTION app_private.guard_store_owner_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
BEGIN
  IF app_private.has_role(auth.uid(), 'platform_admin'::app_role)
     OR OLD.owner_id = auth.uid() THEN
    RETURN NEW;
  END IF;
  NEW.owner_id := OLD.owner_id;
  NEW.plan_id := OLD.plan_id;
  NEW.is_demo := OLD.is_demo;
  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION app_private.guard_store_owner_fields() FROM anon, authenticated, public;

DROP TRIGGER IF EXISTS stores_guard_owner_fields ON public.stores;
CREATE TRIGGER stores_guard_owner_fields
BEFORE UPDATE ON public.stores
FOR EACH ROW EXECUTE FUNCTION app_private.guard_store_owner_fields();

-- Satıcı self-approval koruması: tetikleyici yeniden onaylanır (idempotent).
DROP TRIGGER IF EXISTS guard_marketplace_seller_update ON public.marketplace_sellers;
CREATE TRIGGER guard_marketplace_seller_update
BEFORE UPDATE ON public.marketplace_sellers
FOR EACH ROW EXECUTE FUNCTION app_private.guard_marketplace_seller_update();