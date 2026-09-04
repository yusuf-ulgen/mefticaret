DROP POLICY IF EXISTS "consent_records_public_insert" ON public.consent_records;
DROP POLICY IF EXISTS "dsr_public_insert" ON public.data_subject_requests;

REVOKE INSERT ON public.consent_records FROM anon, authenticated;
REVOKE INSERT ON public.data_subject_requests FROM anon, authenticated;
GRANT ALL ON public.consent_records TO service_role;
GRANT ALL ON public.data_subject_requests TO service_role;

DROP POLICY IF EXISTS "Store members insert omni conversations" ON public.omni_conversations;
CREATE POLICY "Store managers insert omni conversations"
ON public.omni_conversations FOR INSERT TO authenticated
WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

DROP POLICY IF EXISTS "Store members insert omni messages" ON public.omni_messages;
CREATE POLICY "Store managers insert omni messages"
ON public.omni_messages FOR INSERT TO authenticated
WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));