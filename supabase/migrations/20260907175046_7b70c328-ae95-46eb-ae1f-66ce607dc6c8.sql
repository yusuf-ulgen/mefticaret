-- 1) customers: narrow staff/support broad PII read to store managers only
DROP POLICY IF EXISTS "customers_read" ON public.customers;
CREATE POLICY "customers_read" ON public.customers
  FOR SELECT TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()));

-- 2) marketplace_sellers: never expose iban/tax_id to client roles (column-level privileges)
REVOKE SELECT ON public.marketplace_sellers FROM authenticated;
REVOKE SELECT ON public.marketplace_sellers FROM anon;
GRANT SELECT (
  id, store_id, user_id, display_name, legal_name, email, phone, about,
  commission_rate, status, rejection_reason, approved_at, suspended_at,
  created_at, updated_at
) ON public.marketplace_sellers TO authenticated;
GRANT ALL ON public.marketplace_sellers TO service_role;

-- prevent duplicate seller applications per store/user
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_sellers_store_user_key
  ON public.marketplace_sellers (store_id, user_id);

COMMENT ON COLUMN public.marketplace_sellers.iban IS
  'Finansal veri: istemci rollerine SELECT verilmez, yalnızca service_role okur.';
COMMENT ON COLUMN public.marketplace_sellers.tax_id IS
  'Finansal veri: istemci rollerine SELECT verilmez, yalnızca service_role okur.';

-- 3) consent_records: document intentional fail-closed write path
COMMENT ON TABLE public.consent_records IS
  'KVKK/GDPR onay kayitlari. Istemci yazmalari bilincli olarak RESTRICTIVE politika ile kapatildi; kayitlar yalnizca sunucu (service_role) uzerinden olusturulur.';