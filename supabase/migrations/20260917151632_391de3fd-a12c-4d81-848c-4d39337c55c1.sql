REVOKE EXECUTE ON FUNCTION public.store_public_profile(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_public_profile(text) TO service_role;