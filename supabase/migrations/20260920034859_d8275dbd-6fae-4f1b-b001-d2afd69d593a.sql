-- 1) Anonim vitrin yazmaları kaldırıldı (sunucu tarafı hız sınırlı akış kullanılır)
DROP POLICY IF EXISTS "campaign_storefront_events_public_insert" ON public.campaign_storefront_events;
REVOKE INSERT ON public.campaign_storefront_events FROM anon;
REVOKE INSERT ON public.campaign_storefront_events FROM authenticated;
GRANT ALL ON public.campaign_storefront_events TO service_role;

DROP POLICY IF EXISTS "email_subscribers_public_insert" ON public.email_subscribers;
REVOKE INSERT ON public.email_subscribers FROM anon;
GRANT ALL ON public.email_subscribers TO service_role;

-- 2) Rıza kayıtları: yalnızca mağaza sahibi veya platform yöneticisi
DROP POLICY IF EXISTS "consent_records_admin_read" ON public.consent_records;
CREATE POLICY "consent_records_owner_read"
ON public.consent_records
FOR SELECT
TO authenticated
USING (
  store_id IS NOT NULL
  AND (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = consent_records.store_id AND s.owner_id = auth.uid())
    OR app_private.has_store_role(consent_records.store_id, auth.uid(), ARRAY['owner']::public.store_role[])
    OR app_private.has_role(auth.uid(), 'platform_admin'::public.app_role)
  )
);

-- 3) Gelen e-fatura kutusu: istemci rolünden tamamen kaldırıldı
REVOKE ALL ON public.einvoice_inbox FROM authenticated;
REVOKE ALL ON public.einvoice_inbox FROM anon;
GRANT ALL ON public.einvoice_inbox TO service_role;