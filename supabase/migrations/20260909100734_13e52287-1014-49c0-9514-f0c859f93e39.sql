CREATE TABLE public.mobile_app_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE UNIQUE,
  draft_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_config JSONB,
  version INTEGER NOT NULL DEFAULT 1,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobile_app_configs TO authenticated;
GRANT ALL ON public.mobile_app_configs TO service_role;
ALTER TABLE public.mobile_app_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage mobile app config" ON public.mobile_app_configs
FOR ALL TO authenticated
USING (app_private.can_manage_store(store_id, auth.uid()))
WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE TABLE public.mobile_push_automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  trigger TEXT NOT NULL CHECK (trigger IN ('abandoned_cart_1h','abandoned_cart_24h','order_shipped','order_delivered','price_drop','back_in_stock','welcome')),
  delay_minutes INTEGER NOT NULL DEFAULT 0 CHECK (delay_minutes >= 0 AND delay_minutes <= 20160),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  deep_link TEXT,
  discount_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, trigger)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobile_push_automations TO authenticated;
GRANT ALL ON public.mobile_push_automations TO service_role;
ALTER TABLE public.mobile_push_automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage mobile push automations" ON public.mobile_push_automations
FOR ALL TO authenticated
USING (app_private.can_manage_store(store_id, auth.uid()))
WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE TABLE public.mobile_push_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  deep_link TEXT,
  audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all','ios','android','customers','abandoned_cart')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sent','failed')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  recipients_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobile_push_campaigns TO authenticated;
GRANT ALL ON public.mobile_push_campaigns TO service_role;
ALTER TABLE public.mobile_push_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage mobile push campaigns" ON public.mobile_push_campaigns
FOR ALL TO authenticated
USING (app_private.can_manage_store(store_id, auth.uid()))
WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE TABLE public.mobile_app_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id UUID,
  platform TEXT NOT NULL CHECK (platform IN ('ios','android')),
  push_token TEXT NOT NULL,
  app_version TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, push_token)
);
GRANT SELECT ON public.mobile_app_devices TO authenticated;
GRANT ALL ON public.mobile_app_devices TO service_role;
ALTER TABLE public.mobile_app_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read mobile app devices" ON public.mobile_app_devices
FOR SELECT TO authenticated
USING (app_private.can_manage_store(store_id, auth.uid()));

CREATE INDEX idx_mobile_app_devices_store ON public.mobile_app_devices(store_id);
CREATE INDEX idx_mobile_push_campaigns_store ON public.mobile_push_campaigns(store_id, created_at DESC);

CREATE TRIGGER update_mobile_app_configs_updated_at BEFORE UPDATE ON public.mobile_app_configs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_mobile_push_automations_updated_at BEFORE UPDATE ON public.mobile_push_automations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_mobile_push_campaigns_updated_at BEFORE UPDATE ON public.mobile_push_campaigns
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();