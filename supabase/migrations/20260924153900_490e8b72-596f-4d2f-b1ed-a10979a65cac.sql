DO $$
DECLARE src text;
BEGIN
  SELECT pg_get_functiondef('public.create_order_refund(uuid,jsonb,numeric,text,text,text,text)'::regprocedure) INTO src;
  src := replace(src, 'p_idempotency_key text
)', 'p_idempotency_key text, p_actor uuid
)');
  src := replace(src, 'p_idempotency_key text)', 'p_idempotency_key text, p_actor uuid)');
  src := replace(src, 'auth.uid()', 'p_actor');
  EXECUTE src;
  SELECT pg_get_functiondef('public.cancel_order_refund(uuid)'::regprocedure) INTO src;
  src := replace(src, 'cancel_order_refund(p_refund_id uuid)', 'cancel_order_refund(p_refund_id uuid, p_actor uuid)');
  src := replace(src, 'auth.uid()', 'p_actor');
  EXECUTE src;
END $$;
DROP FUNCTION public.create_order_refund(uuid, jsonb, numeric, text, text, text, text);
DROP FUNCTION public.cancel_order_refund(uuid);
REVOKE ALL ON FUNCTION public.create_order_refund(uuid, jsonb, numeric, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_refund(uuid, jsonb, numeric, text, text, text, text, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.cancel_order_refund(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order_refund(uuid, uuid) TO service_role;