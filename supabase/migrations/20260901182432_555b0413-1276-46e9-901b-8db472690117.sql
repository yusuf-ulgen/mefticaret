REVOKE ALL ON FUNCTION public.record_order_status_history() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_order_status_history() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_order_status_history() TO service_role;