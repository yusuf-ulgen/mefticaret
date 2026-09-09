-- Sepet erişimini yalnızca mağaza yöneticilerine daralt
DROP POLICY IF EXISTS carts_store_read ON public.carts;
CREATE POLICY carts_store_read ON public.carts
  FOR SELECT TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));

DROP POLICY IF EXISTS cart_items_store_read ON public.cart_items;
CREATE POLICY cart_items_store_read ON public.cart_items
  FOR SELECT TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));

-- Müşteri adres/telefon bilgilerini yalnızca yöneticilere daralt
DROP POLICY IF EXISTS customer_addresses_read ON public.customer_addresses;
CREATE POLICY customer_addresses_read ON public.customer_addresses
  FOR SELECT TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));

-- OAuth yetkilendirme kodları yalnızca sunucu tarafında (service_role) işlenir
DROP POLICY IF EXISTS oauth_codes_admin_read ON public.oauth_authorization_codes;
REVOKE ALL ON public.oauth_authorization_codes FROM anon;
REVOKE ALL ON public.oauth_authorization_codes FROM authenticated;
GRANT ALL ON public.oauth_authorization_codes TO service_role;