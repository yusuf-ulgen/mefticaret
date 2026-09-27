CREATE OR REPLACE FUNCTION app_private.guard_store_owner_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $$
DECLARE
  _free boolean;
BEGIN
  IF auth.uid() IS NULL
     OR app_private.has_role(auth.uid(), 'platform_admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF OLD.owner_id = auth.uid() THEN
    NEW.owner_id := OLD.owner_id;
    NEW.is_demo := OLD.is_demo;
    NEW.store_kind := OLD.store_kind;
    -- Owners may only move to a free plan (or none); paid plans are applied server-side after payment.
    IF NEW.plan_id IS DISTINCT FROM OLD.plan_id AND NEW.plan_id IS NOT NULL THEN
      SELECT coalesce(price_monthly,0) <= 0 AND coalesce(price_yearly,0) <= 0
        INTO _free FROM public.plans WHERE id = NEW.plan_id;
      IF NOT coalesce(_free, false) THEN
        NEW.plan_id := OLD.plan_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  NEW.owner_id := OLD.owner_id;
  NEW.plan_id := OLD.plan_id;
  NEW.is_demo := OLD.is_demo;
  NEW.store_kind := OLD.store_kind;
  RETURN NEW;
END;
$$;