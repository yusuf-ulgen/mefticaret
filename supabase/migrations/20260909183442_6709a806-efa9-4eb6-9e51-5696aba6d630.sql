-- Satıcı sipariş kalemleri işlevi artık yalnızca sunucu tarafından çağrılabilir
REVOKE ALL ON FUNCTION public.seller_order_lines(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.seller_order_lines(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.seller_order_lines(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.seller_order_lines(uuid, uuid) TO service_role;