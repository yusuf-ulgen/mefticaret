REVOKE EXECUTE ON FUNCTION public.reserve_variant_stock(uuid, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_app_error(text, text, text, text, text, text, uuid, uuid, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cache_track(integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_monitoring_alert(text, text, text, text, integer) FROM anon, authenticated;