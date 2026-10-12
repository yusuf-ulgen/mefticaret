-- 1) return_requests: rely on explicit trigger guard instead of self-referential subqueries
DROP POLICY IF EXISTS "returns_update_own_customer" ON public.return_requests;

CREATE POLICY "returns_update_own_customer"
ON public.return_requests
FOR UPDATE
TO authenticated
USING (
  status = 'requested'::return_status
  AND customer_id IN (SELECT c.id FROM public.customers c WHERE c.user_id = auth.uid())
)
WITH CHECK (
  status IN ('requested'::return_status, 'cancelled'::return_status)
  AND customer_id IN (SELECT c.id FROM public.customers c WHERE c.user_id = auth.uid())
);

-- 2) support attachments: validate folder path against real store/ticket rows
CREATE OR REPLACE FUNCTION app_private.support_attachment_path_allowed(_name text, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage, app_private
AS $$
DECLARE
  _parts text[] := storage.foldername(_name);
  _store_id uuid;
  _ticket_id uuid;
BEGIN
  IF _user_id IS NULL OR _parts IS NULL OR array_length(_parts, 1) IS NULL THEN
    RETURN false;
  END IF;

  BEGIN
    _store_id := NULLIF(_parts[1], '')::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  IF _store_id IS NULL THEN
    RETURN false;
  END IF;

  -- store must exist and the user must belong to it
  IF NOT EXISTS (SELECT 1 FROM public.stores s WHERE s.id = _store_id) THEN
    RETURN false;
  END IF;

  IF NOT app_private.is_store_member(_store_id, _user_id) THEN
    RETURN false;
  END IF;

  -- when a ticket folder is present it must be a real ticket of that store
  IF array_length(_parts, 1) >= 2 AND COALESCE(_parts[2], '') <> '' THEN
    BEGIN
      _ticket_id := _parts[2]::uuid;
    EXCEPTION WHEN others THEN
      RETURN true; -- non-uuid second segment is a plain filename folder, store scope already checked
    END;

    IF NOT EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = _ticket_id AND t.store_id = _store_id
    ) THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION app_private.support_attachment_path_allowed(text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION app_private.support_attachment_path_allowed(text, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Support attachments uploadable by members" ON storage.objects;
CREATE POLICY "Support attachments uploadable by members"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'support-attachments'
  AND (
    app_private.has_role(auth.uid(), 'platform_admin'::app_role)
    OR app_private.support_attachment_path_allowed(name, auth.uid())
  )
);

DROP POLICY IF EXISTS "Support attachments readable by owners" ON storage.objects;
CREATE POLICY "Support attachments readable by owners"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'support-attachments'
  AND (
    app_private.has_role(auth.uid(), 'platform_admin'::app_role)
    OR owner = auth.uid()
    OR app_private.support_attachment_path_allowed(name, auth.uid())
  )
);