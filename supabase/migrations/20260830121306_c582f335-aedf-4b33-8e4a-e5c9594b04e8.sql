CREATE TYPE public.shipment_status AS ENUM ('pending','in_transit','delivered','returned','cancelled');

CREATE TABLE public.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  carrier text NOT NULL,
  tracking_number text,
  tracking_url text,
  status public.shipment_status NOT NULL DEFAULT 'pending',
  note text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shipments_order_idx ON public.shipments(order_id);
CREATE INDEX shipments_store_idx ON public.shipments(store_id, created_at DESC);

CREATE TABLE public.shipment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shipment_items_shipment_idx ON public.shipment_items(shipment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipments TO authenticated;
GRANT SELECT ON public.shipments TO anon;
GRANT ALL ON public.shipments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipment_items TO authenticated;
GRANT SELECT ON public.shipment_items TO anon;
GRANT ALL ON public.shipment_items TO service_role;

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store managers manage shipments"
ON public.shipments FOR ALL TO authenticated
USING (app_private.can_manage_store(store_id, auth.uid()))
WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "Storefront can read shipments"
ON public.shipments FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Store managers manage shipment items"
ON public.shipment_items FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.shipments s WHERE s.id = shipment_id AND app_private.can_manage_store(s.store_id, auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.shipments s WHERE s.id = shipment_id AND app_private.can_manage_store(s.store_id, auth.uid())));

CREATE POLICY "Storefront can read shipment items"
ON public.shipment_items FOR SELECT TO anon, authenticated
USING (true);

CREATE TRIGGER shipments_set_updated_at BEFORE UPDATE ON public.shipments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.sync_order_fulfillment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target uuid := COALESCE(NEW.order_id, OLD.order_id);
  total integer;
  delivered integer;
  transit integer;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'delivered'),
         COUNT(*) FILTER (WHERE status IN ('in_transit','delivered'))
    INTO total, delivered, transit
  FROM public.shipments WHERE order_id = target;

  UPDATE public.orders o SET
    fulfillment_status = CASE
      WHEN total = 0 THEN 'unfulfilled'::public.fulfillment_status
      WHEN delivered = total THEN 'fulfilled'::public.fulfillment_status
      WHEN transit > 0 THEN 'partial'::public.fulfillment_status
      ELSE o.fulfillment_status
    END,
    shipping_carrier = COALESCE((SELECT s.carrier FROM public.shipments s WHERE s.order_id = target ORDER BY s.created_at DESC LIMIT 1), o.shipping_carrier),
    tracking_number = COALESCE((SELECT s.tracking_number FROM public.shipments s WHERE s.order_id = target ORDER BY s.created_at DESC LIMIT 1), o.tracking_number)
  WHERE o.id = target;

  RETURN NULL;
END; $$;

CREATE TRIGGER shipments_sync_order AFTER INSERT OR UPDATE OR DELETE ON public.shipments
FOR EACH ROW EXECUTE FUNCTION public.sync_order_fulfillment();