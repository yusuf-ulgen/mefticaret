CREATE OR REPLACE FUNCTION public.enqueue_job(_kind job_kind, _payload jsonb DEFAULT '{}'::jsonb, _store_id uuid DEFAULT NULL::uuid, _priority integer DEFAULT 5, _run_at timestamp with time zone DEFAULT now(), _max_attempts integer DEFAULT 5, _dedupe_key text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _id uuid; _uid uuid;
BEGIN
  _uid := auth.uid();

  IF _uid IS NOT NULL THEN
    IF _store_id IS NULL THEN
      IF NOT app_private.has_role(_uid, 'platform_admin'::public.app_role) THEN
        RAISE EXCEPTION 'not_authorized';
      END IF;
    ELSIF NOT (
      app_private.can_manage_store(_store_id, _uid)
      OR app_private.has_role(_uid, 'platform_admin'::public.app_role)
    ) THEN
      RAISE EXCEPTION 'not_authorized';
    END IF;
  END IF;

  INSERT INTO public.job_queue (store_id, kind, payload, priority, run_at, max_attempts, dedupe_key, created_by)
  VALUES (_store_id, _kind, COALESCE(_payload, '{}'::jsonb), COALESCE(_priority,5), COALESCE(_run_at, now()),
          COALESCE(_max_attempts,5), _dedupe_key, _uid)
  ON CONFLICT DO NOTHING
  RETURNING id INTO _id;
  RETURN _id;
END; $function$;

REVOKE ALL ON FUNCTION public.enqueue_job(job_kind, jsonb, uuid, integer, timestamptz, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_job(job_kind, jsonb, uuid, integer, timestamptz, integer, text) TO authenticated, service_role;