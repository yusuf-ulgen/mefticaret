ALTER TYPE public.store_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.store_role ADD VALUE IF NOT EXISTS 'seo_manager';
ALTER TYPE public.store_role ADD VALUE IF NOT EXISTS 'pricing_manager';
ALTER TYPE public.store_role ADD VALUE IF NOT EXISTS 'translator';

CREATE OR REPLACE FUNCTION public.guard_store_users_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid := auth.uid();
  _is_owner boolean;
  _is_platform_admin boolean;
BEGIN
  IF _actor IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = COALESCE(NEW.store_id, OLD.store_id) AND s.owner_id = _actor
  ) INTO _is_owner;

  SELECT app_private.has_role(_actor, 'platform_admin'::public.app_role) INTO _is_platform_admin;

  IF _is_owner OR _is_platform_admin THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role::text = 'owner' THEN
      RAISE EXCEPTION 'Yalnizca magaza sahibi veya platform yoneticisi sahip yetkisi verebilir';
    END IF;
    IF NEW.user_id = _actor THEN
      RAISE EXCEPTION 'Kullanici kendisine magaza yetkisi veremez';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.role::text = 'owner' OR OLD.role::text = 'owner' THEN
      RAISE EXCEPTION 'Sahip yetkisi yalnizca magaza sahibi veya platform yoneticisi tarafindan degistirilebilir';
    END IF;
    IF NEW.user_id = _actor AND NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Kullanici kendi rolunu degistiremez';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.role::text = 'owner' THEN
      RAISE EXCEPTION 'Sahip kaydi yalnizca magaza sahibi veya platform yoneticisi tarafindan silinebilir';
    END IF;
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS guard_store_users_role_change ON public.store_users;
CREATE TRIGGER guard_store_users_role_change
BEFORE INSERT OR UPDATE OR DELETE ON public.store_users
FOR EACH ROW EXECUTE FUNCTION public.guard_store_users_role_change();

REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated, anon;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;