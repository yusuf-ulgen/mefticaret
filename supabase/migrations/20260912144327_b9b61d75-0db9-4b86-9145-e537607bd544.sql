REVOKE EXECUTE ON FUNCTION public.guard_store_users_role_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_store_users_role_change() TO service_role;