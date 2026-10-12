-- Teslimat türü sipariş anında saklanır; ürün değişse/silinse de korunur.
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS is_digital boolean NOT NULL DEFAULT false;
UPDATE public.order_items i SET is_digital = p.is_digital FROM public.products p WHERE p.id = i.product_id;
UPDATE public.order_items i SET is_digital = true FROM public.orders o WHERE o.id = i.order_id AND o.is_digital;

CREATE OR REPLACE FUNCTION public.snapshot_order_item_delivery() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    SELECT COALESCE(p.is_digital, false) INTO NEW.is_digital FROM public.products p WHERE p.id = NEW.product_id AND p.store_id = NEW.store_id;
    NEW.is_digital := COALESCE(NEW.is_digital, false);
  ELSE
    SELECT COALESCE(o.is_digital, false) INTO NEW.is_digital FROM public.orders o WHERE o.id = NEW.order_id AND o.store_id = NEW.store_id;
    NEW.is_digital := COALESCE(NEW.is_digital, false);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER order_item_delivery_snapshot BEFORE INSERT ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.snapshot_order_item_delivery();

CREATE OR REPLACE FUNCTION public.guard_physical_shipment_item() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.order_items i JOIN public.shipments s ON s.id = NEW.shipment_id
    WHERE i.id = NEW.order_item_id AND i.order_id = s.order_id AND i.store_id = s.store_id AND NOT i.is_digital
    AND NEW.quantity > 0 AND NEW.quantity <= i.quantity) THEN
    RAISE EXCEPTION 'Sevkiyat yalnız aynı siparişin fiziksel kalemlerini içerebilir';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER shipment_item_physical_guard BEFORE INSERT OR UPDATE ON public.shipment_items FOR EACH ROW EXECUTE FUNCTION public.guard_physical_shipment_item();

-- One delivered parcel must not complete unshipped physical lines or a digital line.
CREATE OR REPLACE FUNCTION public.sync_order_fulfillment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target uuid := COALESCE(NEW.order_id, OLD.order_id); required_qty bigint; sent_qty bigint; digital_count bigint;
BEGIN
  SELECT COALESCE(sum(quantity) FILTER(WHERE NOT is_digital),0), count(*) FILTER(WHERE is_digital)
    INTO required_qty,digital_count FROM public.order_items WHERE order_id=target;
  SELECT COALESCE(sum(least(i.quantity, COALESCE(sent.qty,0))),0) INTO sent_qty
  FROM public.order_items i LEFT JOIN (
    SELECT si.order_item_id,sum(si.quantity) qty FROM public.shipment_items si
    JOIN public.shipments s ON s.id=si.shipment_id
    WHERE s.order_id=target AND s.status IN ('picked_up','in_transit','out_for_delivery','delivered')
    GROUP BY si.order_item_id
  ) sent ON sent.order_item_id=i.id WHERE i.order_id=target AND NOT i.is_digital;
  UPDATE public.orders o SET fulfillment_status=CASE
    WHEN sent_qty=0 THEN o.fulfillment_status
    WHEN sent_qty>=required_qty AND digital_count=0 THEN 'fulfilled'::public.fulfillment_status
    ELSE 'partially_fulfilled'::public.fulfillment_status END,
    shipping_carrier=COALESCE((SELECT carrier FROM public.shipments WHERE order_id=target ORDER BY created_at DESC LIMIT 1),o.shipping_carrier),
    tracking_number=COALESCE((SELECT tracking_number FROM public.shipments WHERE order_id=target ORDER BY created_at DESC LIMIT 1),o.tracking_number)
  WHERE o.id=target AND o.status NOT IN ('cancelled','returned','refunded');
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.sync_order_fulfillment() FROM PUBLIC,anon,authenticated;
