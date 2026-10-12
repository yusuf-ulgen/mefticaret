CREATE TYPE public.webhook_delivery_status AS ENUM ('pending','success','failed');
CREATE TYPE public.notification_kind AS ENUM ('order','inventory','payout','system','abandoned_cart');

CREATE TABLE public.store_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_url text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  secret text NOT NULL DEFAULT encode(gen_random_bytes(24),'hex'),
  is_active boolean NOT NULL DEFAULT true,
  last_triggered_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX store_webhooks_store_idx ON public.store_webhooks(store_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_webhooks TO authenticated;
GRANT ALL ON public.store_webhooks TO service_role;
ALTER TABLE public.store_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store_webhooks_read" ON public.store_webhooks FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "store_webhooks_write" ON public.store_webhooks FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER store_webhooks_set_updated_at BEFORE UPDATE ON public.store_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES public.store_webhooks(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.webhook_delivery_status NOT NULL DEFAULT 'pending',
  response_status integer,
  response_body text,
  attempt integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX webhook_deliveries_store_idx ON public.webhook_deliveries(store_id, created_at DESC);
GRANT SELECT ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.webhook_deliveries TO service_role;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhook_deliveries_read" ON public.webhook_deliveries FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  kind public.notification_kind NOT NULL DEFAULT 'system',
  title text NOT NULL,
  message text,
  entity text,
  entity_id text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_store_idx ON public.notifications(store_id, created_at DESC);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_read" ON public.notifications FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid())) WITH CHECK (app_private.is_store_member(store_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (store_id, kind, title, message, entity, entity_id, meta)
  VALUES (NEW.store_id, 'order', 'Yeni sipariş: ' || NEW.order_number,
          COALESCE(NEW.customer_name,'Misafir') || ' — ' || NEW.grand_total || ' ' || NEW.currency,
          'order', NEW.id::text, jsonb_build_object('total', NEW.grand_total));
  RETURN NEW;
END; $$;
CREATE TRIGGER orders_notify_new AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_order();

CREATE OR REPLACE FUNCTION public.notify_low_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.stock <= NEW.low_stock_threshold AND (OLD.stock IS NULL OR OLD.stock > OLD.low_stock_threshold) THEN
    INSERT INTO public.notifications (store_id, kind, title, message, entity, entity_id, meta)
    VALUES (NEW.store_id, 'inventory', 'Kritik stok: ' || NEW.title,
            'Kalan stok: ' || NEW.stock, 'variant', NEW.id::text,
            jsonb_build_object('stock', NEW.stock, 'threshold', NEW.low_stock_threshold));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER product_variants_notify_low_stock AFTER UPDATE OF stock ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.notify_low_stock();