ALTER POLICY "consent_records_public_insert" ON public.consent_records
  WITH CHECK (store_id IS NOT NULL AND app_private.is_store_published(store_id));

ALTER POLICY "dsr_public_insert" ON public.data_subject_requests
  WITH CHECK (store_id IS NOT NULL AND app_private.is_store_published(store_id));