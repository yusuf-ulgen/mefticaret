ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'picked_up';
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'out_for_delivery';
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'failed';

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS carrier_key text CHECK (carrier_key IN ('yurtici','aras','mng','ptt','surat','dhl','ups','fedex','other')),
  ADD COLUMN IF NOT EXISTS estimated_delivery_date date,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sync_error text;
CREATE INDEX IF NOT EXISTS shipments_tracking_number_idx ON public.shipments (tracking_number);

CREATE TABLE public.shipment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  status text NOT NULL,
  description text,
  location text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','carrier','system')),
  event_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shipment_id, status, event_at)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipment_events TO authenticated;
GRANT ALL ON public.shipment_events TO service_role;
ALTER TABLE public.shipment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY shipment_events_manage ON public.shipment_events FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE INDEX shipment_events_shipment_idx ON public.shipment_events (shipment_id, event_at DESC);

CREATE TABLE public.carrier_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  carrier_key text NOT NULL CHECK (carrier_key IN ('yurtici','aras','mng','ptt','surat','dhl','ups','fedex')),
  customer_number text,
  credentials_encrypted text,
  credential_hint jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  is_test_mode boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, carrier_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.carrier_settings TO authenticated;
GRANT ALL ON public.carrier_settings TO service_role;
ALTER TABLE public.carrier_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY carrier_settings_manage ON public.carrier_settings FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER carrier_settings_updated BEFORE UPDATE ON public.carrier_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.customer_notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  event_key text NOT NULL CHECK (event_key IN ('ORDER_CREATED','ORDER_CONFIRMED','ORDER_SHIPPED','SHIPMENT_OUT_FOR_DELIVERY','ORDER_DELIVERED','REFUND_PROCESSED')),
  channel text NOT NULL CHECK (channel IN ('email','sms','whatsapp')),
  language text NOT NULL DEFAULT 'tr' CHECK (language IN ('tr','en')),
  subject text CHECK (subject IS NULL OR length(subject) <= 200),
  body text NOT NULL CHECK (length(body) <= 5000),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, event_key, channel, language)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_notification_templates TO authenticated;
GRANT ALL ON public.customer_notification_templates TO service_role;
ALTER TABLE public.customer_notification_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY cnt_manage ON public.customer_notification_templates FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER cnt_updated BEFORE UPDATE ON public.customer_notification_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.customer_notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('email','sms','whatsapp')),
  event_key text NOT NULL,
  recipient text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','delivered','failed','bounced','skipped')),
  error text,
  idempotency_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.customer_notification_logs TO authenticated;
GRANT ALL ON public.customer_notification_logs TO service_role;
ALTER TABLE public.customer_notification_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY cnl_read ON public.customer_notification_logs FOR SELECT TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()));
CREATE INDEX cnl_store_idx ON public.customer_notification_logs (store_id, created_at DESC);

CREATE TABLE public.customer_notification_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  marketing_email boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id)
);
GRANT SELECT, INSERT, UPDATE ON public.customer_notification_prefs TO authenticated;
GRANT ALL ON public.customer_notification_prefs TO service_role;
ALTER TABLE public.customer_notification_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY cnp_own ON public.customer_notification_prefs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.user_id = auth.uid() AND c.store_id = customer_notification_prefs.store_id));
CREATE POLICY cnp_store_read ON public.customer_notification_prefs FOR SELECT TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER cnp_updated BEFORE UPDATE ON public.customer_notification_prefs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.customer_unsubscribes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email','sms','whatsapp','marketing')),
  recipient text NOT NULL,
  source text NOT NULL DEFAULT 'link' CHECK (source IN ('link','stop','account','admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, channel, recipient)
);
GRANT SELECT ON public.customer_unsubscribes TO authenticated;
GRANT ALL ON public.customer_unsubscribes TO service_role;
ALTER TABLE public.customer_unsubscribes ENABLE ROW LEVEL SECURITY;
CREATE POLICY cu_read ON public.customer_unsubscribes FOR SELECT TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()));

-- Herkese açık takip: yalnız güvenli alanlar
CREATE OR REPLACE FUNCTION public.public_track_shipment(p_tracking text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'tracking_number', s.tracking_number,
    'carrier', s.carrier, 'carrier_key', s.carrier_key,
    'tracking_url', s.tracking_url,
    'status', s.status, 'shipped_at', s.shipped_at, 'delivered_at', s.delivered_at,
    'estimated_delivery_date', s.estimated_delivery_date,
    'store', jsonb_build_object('name', st.name, 'slug', st.slug, 'logo_url', st.logo_url),
    'events', COALESCE((SELECT jsonb_agg(jsonb_build_object('status', e.status, 'description', e.description, 'location', e.location, 'event_at', e.event_at) ORDER BY e.event_at DESC)
                        FROM public.shipment_events e WHERE e.shipment_id = s.id), '[]'::jsonb))
  FROM public.shipments s JOIN public.stores st ON st.id = s.store_id
  WHERE length(p_tracking) BETWEEN 6 AND 120 AND s.tracking_number = p_tracking AND st.status <> 'suspended'
  ORDER BY s.created_at DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.public_track_shipment(text) FROM public;
GRANT EXECUTE ON FUNCTION public.public_track_shipment(text) TO anon, authenticated, service_role;