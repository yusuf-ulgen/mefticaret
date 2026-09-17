CREATE POLICY "admin_panel_auth_service_only" ON public.admin_panel_auth
FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "fb_marketplace_credentials_service_only" ON public.fb_marketplace_credentials
FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "instagram_credentials_service_only" ON public.instagram_credentials
FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "migration_credentials_service_only" ON public.migration_credentials
FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "oauth_authorization_codes_service_only" ON public.oauth_authorization_codes
FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "store_site_kit_secrets_service_only" ON public.store_site_kit_secrets
FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "tiktok_credentials_service_only" ON public.tiktok_credentials
FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON FUNCTION public.store_public_campaign(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_public_campaign(text) TO service_role;
REVOKE ALL ON FUNCTION public.kolay_nearby_stores(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kolay_nearby_stores(uuid) TO service_role;