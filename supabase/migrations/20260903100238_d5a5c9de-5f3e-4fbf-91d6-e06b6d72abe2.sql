-- 1) Tedarikçi portal erişimi
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS portal_user_id uuid,
  ADD COLUMN IF NOT EXISTS portal_enabled boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS suppliers_portal_user_idx ON public.suppliers (portal_user_id) WHERE portal_user_id IS NOT NULL;

-- Tedarikçi kendi kaydını okuyabilsin
DROP POLICY IF EXISTS "Supplier portal reads own record" ON public.suppliers;
CREATE POLICY "Supplier portal reads own record" ON public.suppliers
  FOR SELECT TO authenticated
  USING (portal_enabled AND portal_user_id = auth.uid());

-- 2) Tedarikçinin göreceği sipariş satırları (SECURITY DEFINER, kendi kimliğiyle sınırlı)
CREATE OR REPLACE FUNCTION public.supplier_portal_orders(_limit integer DEFAULT 200)
RETURNS TABLE (
  dropship_order_id uuid,
  supplier_id uuid,
  supplier_name text,
  order_id uuid,
  order_number text,
  order_created_at timestamptz,
  dropship_status public.dropship_order_status,
  order_status public.order_status,
  carrier text,
  tracking_number text,
  shipping_carrier text,
  item_id uuid,
  product_title text,
  variant_title text,
  product_description text,
  product_code text,
  stock_code text,
  quantity integer,
  unit_price numeric,
  currency text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, s.id, s.name, o.id, o.order_number, o.created_at,
         d.status, o.status, d.carrier, d.tracking_number, o.shipping_carrier,
         oi.id, oi.title, oi.variant_title, p.description,
         COALESCE(oi.sku, v.sku, p.sku), COALESCE(v.barcode, p.barcode),
         oi.quantity, oi.unit_price, o.currency
  FROM public.suppliers s
  JOIN public.dropship_orders d ON d.supplier_id = s.id
  JOIN public.orders o ON o.id = d.order_id
  JOIN public.order_items oi ON oi.order_id = o.id
  LEFT JOIN public.products p ON p.id = oi.product_id
  LEFT JOIN public.product_variants v ON v.id = oi.variant_id
  WHERE s.portal_enabled AND s.portal_user_id = auth.uid()
  ORDER BY o.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 200), 1000));
$$;

REVOKE ALL ON FUNCTION public.supplier_portal_orders(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.supplier_portal_orders(integer) TO authenticated;

-- 3) Tedarikçi kendi siparişinin kargo/durum bilgisini güncelleyebilsin
CREATE OR REPLACE FUNCTION public.supplier_portal_update_order(
  _dropship_order_id uuid,
  _status public.dropship_order_status DEFAULT NULL,
  _carrier text DEFAULT NULL,
  _tracking_number text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _ok boolean;
BEGIN
  SELECT true INTO _ok
  FROM public.dropship_orders d
  JOIN public.suppliers s ON s.id = d.supplier_id
  WHERE d.id = _dropship_order_id AND s.portal_enabled AND s.portal_user_id = auth.uid();

  IF NOT COALESCE(_ok, false) THEN
    RAISE EXCEPTION 'Yetkisiz işlem';
  END IF;

  IF _status IS NOT NULL AND _status NOT IN ('accepted', 'shipped', 'cancelled') THEN
    RAISE EXCEPTION 'Geçersiz durum';
  END IF;

  UPDATE public.dropship_orders
     SET status = COALESCE(_status, status),
         carrier = COALESCE(NULLIF(_carrier, ''), carrier),
         tracking_number = COALESCE(NULLIF(_tracking_number, ''), tracking_number)
   WHERE id = _dropship_order_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.supplier_portal_update_order(uuid, public.dropship_order_status, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.supplier_portal_update_order(uuid, public.dropship_order_status, text, text) TO authenticated;