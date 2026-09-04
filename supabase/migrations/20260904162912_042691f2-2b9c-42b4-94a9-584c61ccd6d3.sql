-- 1) marketplace_sellers: hide IBAN / tax_id from client roles via column-level grants
REVOKE SELECT ON public.marketplace_sellers FROM anon, authenticated;
GRANT SELECT (
  id, store_id, user_id, display_name, legal_name, email, phone, about,
  commission_rate, status, rejection_reason, approved_at, suspended_at,
  created_at, updated_at
) ON public.marketplace_sellers TO authenticated;
REVOKE UPDATE ON public.marketplace_sellers FROM anon;
GRANT ALL ON public.marketplace_sellers TO service_role;

-- Masked payout details: seller sees own full IBAN, store managers only last 4 digits
CREATE OR REPLACE FUNCTION public.marketplace_seller_payout_details(_seller_id uuid)
RETURNS TABLE (seller_id uuid, iban_masked text, iban_full text, tax_id_masked text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    s.id,
    CASE WHEN s.iban IS NULL OR length(s.iban) < 4 THEN NULL
         ELSE '**** **** ' || right(s.iban, 4) END,
    CASE WHEN s.user_id = auth.uid() THEN s.iban ELSE NULL END,
    CASE WHEN s.tax_id IS NULL OR length(s.tax_id) < 3 THEN NULL
         ELSE repeat('*', greatest(length(s.tax_id) - 3, 0)) || right(s.tax_id, 3) END
  FROM public.marketplace_sellers s
  WHERE s.id = _seller_id
    AND auth.uid() IS NOT NULL
    AND (s.user_id = auth.uid() OR app_private.can_manage_store(s.store_id, auth.uid()));
$$;

REVOKE ALL ON FUNCTION public.marketplace_seller_payout_details(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_seller_payout_details(uuid) TO authenticated, service_role;

-- 2) abandoned_carts: writes are service-role only, make that explicit
REVOKE INSERT, UPDATE ON public.abandoned_carts FROM anon, authenticated;
REVOKE ALL ON public.abandoned_carts FROM anon;
GRANT ALL ON public.abandoned_carts TO service_role;

-- 3) roles / permissions / role_permissions: no anonymous reads
DROP POLICY IF EXISTS "roles_read" ON public.roles;
DROP POLICY IF EXISTS "permissions_read" ON public.permissions;
DROP POLICY IF EXISTS "role_permissions_read" ON public.role_permissions;

CREATE POLICY "roles_read" ON public.roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "permissions_read" ON public.permissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_permissions_read" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

REVOKE ALL ON public.roles FROM anon;
REVOKE ALL ON public.permissions FROM anon;
REVOKE ALL ON public.role_permissions FROM anon;
GRANT SELECT ON public.roles TO authenticated;
GRANT SELECT ON public.permissions TO authenticated;
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.roles TO service_role;
GRANT ALL ON public.permissions TO service_role;
GRANT ALL ON public.role_permissions TO service_role;