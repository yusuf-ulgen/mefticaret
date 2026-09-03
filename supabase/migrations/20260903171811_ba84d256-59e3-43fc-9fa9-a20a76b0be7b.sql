ALTER POLICY "consent_records_public_insert" ON public.consent_records
  WITH CHECK (
    store_id IS NOT NULL
    AND (app_private.is_store_published(store_id) OR app_private.is_store_member(store_id, auth.uid()))
  );

ALTER POLICY "dsr_public_insert" ON public.data_subject_requests
  WITH CHECK (
    store_id IS NOT NULL
    AND (app_private.is_store_published(store_id) OR app_private.is_store_member(store_id, auth.uid()))
  );

ALTER POLICY "Public reads active popups" ON public.store_popups
  USING (is_active = true AND app_private.is_store_published(store_id));