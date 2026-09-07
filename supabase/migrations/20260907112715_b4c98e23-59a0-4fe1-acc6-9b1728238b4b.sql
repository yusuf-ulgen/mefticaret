REVOKE ALL ON FUNCTION public.bootstrap_store_pricing() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_store_pricing() TO service_role;