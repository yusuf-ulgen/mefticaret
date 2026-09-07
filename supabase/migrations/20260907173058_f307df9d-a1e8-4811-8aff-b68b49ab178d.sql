-- Site Kit: gizli entegrasyon anahtarlarını API'den tamamen kaldır.

-- 1) Vitrin için yalnızca herkese açık kolonları içeren görünüm
DROP VIEW IF EXISTS public.store_site_kit_public;
CREATE VIEW public.store_site_kit_public
WITH (security_invoker = off) AS
  SELECT s.id, s.store_id, s.provider, s.is_enabled, s.public_config
  FROM public.store_site_kit s
  WHERE s.is_enabled AND app_private.is_store_published(s.store_id);

GRANT SELECT ON public.store_site_kit_public TO anon, authenticated;

-- 2) Temel tabloda anonim erişim ve secret_config kolon yetkilerini kaldır
DROP POLICY IF EXISTS "site_kit_public_read" ON public.store_site_kit;
REVOKE ALL ON public.store_site_kit FROM anon;
REVOKE SELECT (secret_config), INSERT (secret_config), UPDATE (secret_config)
  ON public.store_site_kit FROM anon, authenticated;
GRANT ALL ON public.store_site_kit TO service_role;

-- 3) Yöneticiler için gizli alanları güvenli şekilde yazan/özetleyen fonksiyonlar
CREATE OR REPLACE FUNCTION public.site_kit_list(p_store_id uuid)
RETURNS TABLE (
  provider text,
  is_enabled boolean,
  status text,
  public_config jsonb,
  secret_keys text[],
  last_tested_at timestamptz,
  last_test_result text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT app_private.can_manage_store(p_store_id, auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT s.provider,
         s.is_enabled,
         s.status,
         COALESCE(s.public_config, '{}'::jsonb),
         COALESCE(
           ARRAY(
             SELECT e.key
             FROM jsonb_each_text(COALESCE(s.secret_config, '{}'::jsonb)) AS e
             WHERE COALESCE(e.value, '') <> ''
           ),
           '{}'::text[]
         ),
         s.last_tested_at,
         s.last_test_result
  FROM public.store_site_kit s
  WHERE s.store_id = p_store_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.site_kit_upsert(
  p_store_id uuid,
  p_provider text,
  p_is_enabled boolean,
  p_status text,
  p_public jsonb,
  p_secrets jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT app_private.can_manage_store(p_store_id, auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO public.store_site_kit AS t (store_id, provider, is_enabled, status, public_config, secret_config)
  VALUES (p_store_id, p_provider, p_is_enabled, p_status,
          COALESCE(p_public, '{}'::jsonb), COALESCE(p_secrets, '{}'::jsonb))
  ON CONFLICT (store_id, provider) DO UPDATE
    SET is_enabled = EXCLUDED.is_enabled,
        status = EXCLUDED.status,
        public_config = EXCLUDED.public_config,
        secret_config = COALESCE(t.secret_config, '{}'::jsonb) || COALESCE(p_secrets, '{}'::jsonb),
        updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.site_kit_list(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.site_kit_upsert(uuid, text, boolean, text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.site_kit_list(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.site_kit_upsert(uuid, text, boolean, text, jsonb, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';