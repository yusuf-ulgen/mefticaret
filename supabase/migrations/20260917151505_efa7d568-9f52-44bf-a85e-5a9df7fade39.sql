CREATE OR REPLACE FUNCTION public.store_public_profile(_slug text)
RETURNS TABLE (
  bio text,
  contact_email text,
  contact_phone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, app_private
AS $$
  SELECT ss.bio, ss.contact_email, ss.contact_phone
  FROM public.stores s
  JOIN public.store_settings ss ON ss.store_id = s.id
  WHERE s.slug = _slug
    AND app_private.is_store_published(s.id)
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.store_public_profile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.store_public_profile(text) TO anon, authenticated, service_role;