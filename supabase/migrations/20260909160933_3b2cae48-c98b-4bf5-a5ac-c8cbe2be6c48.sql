DROP VIEW IF EXISTS public.seller_order_lines;

CREATE OR REPLACE FUNCTION public.seller_order_lines(_store_id uuid, _seller_id uuid)
RETURNS TABLE (
  order_item_id uuid,
  order_id uuid,
  store_id uuid,
  product_id uuid,
  seller_id uuid,
  title text,
  variant_title text,
  quantity integer,
  line_total numeric,
  created_at timestamptz,
  order_number text,
  status order_status,
  placed_at timestamptz,
  order_currency text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT oi.id, oi.order_id, oi.store_id, oi.product_id, p.seller_id,
         oi.title, oi.variant_title, oi.quantity, oi.line_total, oi.created_at,
         o.order_number, o.status, o.placed_at, o.currency
  FROM public.order_items oi
  JOIN public.products p ON p.id = oi.product_id
  JOIN public.orders o ON o.id = oi.order_id
  WHERE oi.store_id = _store_id
    AND p.seller_id = _seller_id
    AND p.seller_id = app_private.approved_seller_id(p.store_id, auth.uid())
  ORDER BY oi.created_at DESC
  LIMIT 2000;
$$;

REVOKE ALL ON FUNCTION public.seller_order_lines(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seller_order_lines(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seller_order_lines(uuid, uuid) TO service_role;