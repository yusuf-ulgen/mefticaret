DROP POLICY IF EXISTS "Sellers see orders containing own products" ON public.orders;

CREATE OR REPLACE VIEW public.seller_order_lines AS
SELECT
  oi.id AS order_item_id,
  oi.order_id,
  oi.store_id,
  oi.product_id,
  p.seller_id,
  oi.title,
  oi.variant_title,
  oi.quantity,
  oi.line_total,
  oi.created_at,
  o.order_number,
  o.status,
  o.placed_at,
  o.currency AS order_currency
FROM public.order_items oi
JOIN public.products p ON p.id = oi.product_id
JOIN public.orders o ON o.id = oi.order_id
WHERE p.seller_id IS NOT NULL
  AND p.seller_id = app_private.approved_seller_id(p.store_id, auth.uid());

ALTER VIEW public.seller_order_lines OWNER TO postgres;

GRANT SELECT ON public.seller_order_lines TO authenticated;
GRANT ALL ON public.seller_order_lines TO service_role;