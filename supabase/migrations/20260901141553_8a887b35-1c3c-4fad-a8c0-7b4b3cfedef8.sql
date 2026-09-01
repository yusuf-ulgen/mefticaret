REVOKE ALL ON FUNCTION public.touch_customer_activity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_customer_activity() TO service_role;