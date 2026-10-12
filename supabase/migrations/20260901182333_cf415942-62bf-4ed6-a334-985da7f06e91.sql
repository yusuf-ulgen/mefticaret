REVOKE ALL ON FUNCTION app_private.is_store_published(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.approved_seller_id(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.is_store_published(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.approved_seller_id(uuid, uuid) TO authenticated, service_role;

-- OAuth yetkilendirme kodları yalnızca sunucu tarafından üretilir/kullanılır.
CREATE POLICY "oauth_codes_admin_read" ON public.oauth_authorization_codes FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'));