DROP POLICY IF EXISTS ai_providers_read ON public.ai_providers;
DROP POLICY IF EXISTS ai_providers_read_enabled ON public.ai_providers;

REVOKE SELECT ON public.ai_providers FROM authenticated;
REVOKE SELECT ON public.ai_providers FROM anon;
REVOKE ALL ON public.ai_providers FROM PUBLIC;

GRANT SELECT (id, code, name, description, models, default_model, requires_api_key, is_enabled, sort_order, created_at, updated_at)
  ON public.ai_providers TO authenticated;
GRANT ALL ON public.ai_providers TO service_role;

CREATE POLICY ai_providers_read_enabled ON public.ai_providers
  FOR SELECT TO authenticated
  USING (is_enabled OR app_private.has_role(auth.uid(), 'platform_admin'::public.app_role));