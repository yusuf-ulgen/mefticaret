ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'payment';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'payment_failed';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'customer';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'subscription';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'app_update';

CREATE TABLE IF NOT EXISTS public.notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  kind public.notification_kind NOT NULL,
  in_app boolean NOT NULL DEFAULT true,
  email boolean NOT NULL DEFAULT false,
  push boolean NOT NULL DEFAULT false,
  sms boolean NOT NULL DEFAULT false,
  whatsapp boolean NOT NULL DEFAULT false,
  email_to text,
  sms_to text,
  whatsapp_to text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, kind)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_settings TO authenticated;
GRANT ALL ON public.notification_settings TO service_role;

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_settings_read" ON public.notification_settings;
CREATE POLICY "notification_settings_read" ON public.notification_settings
  FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));

DROP POLICY IF EXISTS "notification_settings_insert" ON public.notification_settings;
CREATE POLICY "notification_settings_insert" ON public.notification_settings
  FOR INSERT TO authenticated
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

DROP POLICY IF EXISTS "notification_settings_update" ON public.notification_settings;
CREATE POLICY "notification_settings_update" ON public.notification_settings
  FOR UPDATE TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

DROP POLICY IF EXISTS "notification_settings_delete" ON public.notification_settings;
CREATE POLICY "notification_settings_delete" ON public.notification_settings
  FOR DELETE TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()));

DROP TRIGGER IF EXISTS set_notification_settings_updated_at ON public.notification_settings;
CREATE TRIGGER set_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS notification_settings_store_idx ON public.notification_settings (store_id);
CREATE INDEX IF NOT EXISTS notifications_store_created_idx ON public.notifications (store_id, created_at DESC);

-- Merkezi bildirim yayınlayıcı: panel kaydı + açık kanallara kuyruk
CREATE OR REPLACE FUNCTION public.emit_notification(
  _store_id uuid,
  _kind public.notification_kind,
  _title text,
  _message text DEFAULT NULL,
  _entity text DEFAULT NULL,
  _entity_id text DEFAULT NULL,
  _meta jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _settings public.notification_settings;
  _notification_id uuid;
BEGIN
  SELECT * INTO _settings
  FROM public.notification_settings
  WHERE store_id = _store_id AND kind = _kind;

  IF _settings.id IS NULL OR _settings.in_app THEN
    INSERT INTO public.notifications (store_id, kind, title, message, entity, entity_id, meta)
    VALUES (_store_id, _kind, _title, _message, _entity, _entity_id, COALESCE(_meta, '{}'::jsonb))
    RETURNING id INTO _notification_id;
  END IF;

  IF _settings.id IS NULL THEN
    RETURN _notification_id;
  END IF;

  IF _settings.email AND COALESCE(_settings.email_to, '') <> '' THEN
    INSERT INTO public.message_deliveries (store_id, channel, recipient, subject, body, status, error)
    VALUES (_store_id, 'email', _settings.email_to, _title, COALESCE(_message, _title), 'queued',
            'Kanal sağlayıcısı bağlanana kadar kuyrukta bekliyor');
  END IF;

  IF _settings.sms AND COALESCE(_settings.sms_to, '') <> '' THEN
    INSERT INTO public.message_deliveries (store_id, channel, recipient, subject, body, status, error)
    VALUES (_store_id, 'sms', _settings.sms_to, _title, COALESCE(_message, _title), 'queued',
            'Kanal sağlayıcısı bağlanana kadar kuyrukta bekliyor');
  END IF;

  IF _settings.whatsapp AND COALESCE(_settings.whatsapp_to, '') <> '' THEN
    INSERT INTO public.message_deliveries (store_id, channel, recipient, subject, body, status, error)
    VALUES (_store_id, 'whatsapp', _settings.whatsapp_to, _title, COALESCE(_message, _title), 'queued',
            'Kanal sağlayıcısı bağlanana kadar kuyrukta bekliyor');
  END IF;

  IF _settings.push THEN
    INSERT INTO public.message_deliveries (store_id, channel, recipient, subject, body, status, error)
    VALUES (_store_id, 'push', 'store:' || _store_id::text, _title, COALESCE(_message, _title), 'queued',
            'Push sağlayıcısı bağlanana kadar kuyrukta bekliyor');
  END IF;

  RETURN _notification_id;
END;
$$;

REVOKE ALL ON FUNCTION public.emit_notification(uuid, public.notification_kind, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.emit_notification(uuid, public.notification_kind, text, text, text, text, jsonb) TO service_role;

-- Mevcut bildirim trigger'ları merkezi yayınlayıcıya taşınıyor
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.emit_notification(
    NEW.store_id, 'order', 'Yeni sipariş: ' || NEW.order_number,
    COALESCE(NEW.customer_name, 'Misafir') || ' — ' || NEW.grand_total || ' ' || NEW.currency,
    'order', NEW.id::text, jsonb_build_object('total', NEW.grand_total));
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_low_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.stock <= NEW.low_stock_threshold AND (OLD.stock IS NULL OR OLD.stock > OLD.low_stock_threshold) THEN
    PERFORM public.emit_notification(
      NEW.store_id, 'inventory', 'Kritik stok: ' || NEW.title,
      'Kalan stok: ' || NEW.stock, 'variant', NEW.id::text,
      jsonb_build_object('stock', NEW.stock, 'threshold', NEW.low_stock_threshold));
  END IF;
  RETURN NEW;
END; $$;

-- Ödeme ve başarısız ödeme bildirimleri
CREATE OR REPLACE FUNCTION public.notify_order_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    IF NEW.payment_status = 'paid' THEN
      PERFORM public.emit_notification(
        NEW.store_id, 'payment', 'Ödeme alındı: ' || NEW.order_number,
        NEW.grand_total || ' ' || NEW.currency, 'order', NEW.id::text,
        jsonb_build_object('total', NEW.grand_total, 'payment_status', NEW.payment_status));
    ELSIF NEW.payment_status = 'failed' THEN
      PERFORM public.emit_notification(
        NEW.store_id, 'payment_failed', 'Ödeme başarısız: ' || NEW.order_number,
        COALESCE(NEW.customer_name, 'Misafir') || ' — ' || NEW.grand_total || ' ' || NEW.currency,
        'order', NEW.id::text, jsonb_build_object('total', NEW.grand_total));
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS notify_order_payment_trg ON public.orders;
CREATE TRIGGER notify_order_payment_trg
  AFTER UPDATE OF payment_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_order_payment();

-- Yeni müşteri bildirimi
CREATE OR REPLACE FUNCTION public.notify_new_customer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.emit_notification(
    NEW.store_id, 'customer', 'Yeni müşteri: ' || COALESCE(NEW.full_name, NEW.email, 'İsimsiz'),
    COALESCE(NEW.email, NEW.phone), 'customer', NEW.id::text, '{}'::jsonb);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS notify_new_customer_trg ON public.customers;
CREATE TRIGGER notify_new_customer_trg
  AFTER INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_customer();

-- Abonelik bildirimi
CREATE OR REPLACE FUNCTION public.notify_subscription_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _title text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _title := 'Abonelik başlatıldı';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    _title := 'Abonelik durumu: ' || NEW.status::text;
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.emit_notification(
    NEW.store_id, 'subscription', _title, 'Durum: ' || NEW.status::text,
    'subscription', NEW.id::text, jsonb_build_object('status', NEW.status));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS notify_subscription_change_trg ON public.subscriptions;
CREATE TRIGGER notify_subscription_change_trg
  AFTER INSERT OR UPDATE OF status ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.notify_subscription_change();