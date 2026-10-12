REVOKE ALL ON public.consent_records FROM anon;
REVOKE ALL ON public.consent_records FROM PUBLIC;
GRANT SELECT ON public.consent_records TO authenticated;
GRANT ALL ON public.consent_records TO service_role;

ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consent_records_admin_read ON public.consent_records;
CREATE POLICY consent_records_admin_read ON public.consent_records
FOR SELECT TO authenticated
USING (store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid()));

DROP POLICY IF EXISTS consent_records_no_client_write ON public.consent_records;
CREATE POLICY consent_records_no_client_write ON public.consent_records
AS RESTRICTIVE FOR ALL TO authenticated, anon
USING (true) WITH CHECK (false);