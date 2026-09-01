CREATE OR REPLACE FUNCTION app_private.order_has_seller_product(_order_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1
      FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
     WHERE oi.order_id = _order_id
       AND p.seller_id IS NOT NULL
       AND p.seller_id = app_private.approved_seller_id(p.store_id, _user_id)
  );
$fn$;

REVOKE ALL ON FUNCTION app_private.order_has_seller_product(uuid, uuid) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Sellers see orders containing own products" ON public.orders;
CREATE POLICY "Sellers see orders containing own products" ON public.orders
  FOR SELECT TO authenticated
  USING (app_private.order_has_seller_product(id, auth.uid()));