CREATE OR REPLACE FUNCTION app_private.is_store_member(_store_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT _user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = _store_id AND s.owner_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.store_users su WHERE su.store_id = _store_id AND su.user_id = _user_id)
    OR app_private.has_role(_user_id, 'platform_admin'::public.app_role)
  );
$fn$;

CREATE OR REPLACE FUNCTION app_private.can_manage_store(_store_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT _user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = _store_id AND s.owner_id = _user_id)
    OR app_private.has_store_role(_store_id, _user_id, ARRAY['owner','admin']::public.store_role[])
    OR app_private.has_role(_user_id, 'platform_admin'::public.app_role)
  );
$fn$;