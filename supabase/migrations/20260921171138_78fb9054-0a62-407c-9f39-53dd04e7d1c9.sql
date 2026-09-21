REVOKE ALL ON FUNCTION public.consume_ai_credits(UUID, INTEGER, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_ai_credits(UUID, INTEGER, TEXT, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_credits(UUID, INTEGER, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_ai_credits(UUID, INTEGER, TEXT, UUID, JSONB) TO service_role;