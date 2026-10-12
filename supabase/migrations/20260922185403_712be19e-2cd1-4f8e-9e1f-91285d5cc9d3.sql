ALTER TABLE public.xml_feeds
  ADD COLUMN IF NOT EXISTS guardrail_config jsonb NOT NULL DEFAULT jsonb_build_object(
    'enabled', true,
    'max_price_drop_percent', 50,
    'max_price_increase_percent', 200,
    'zero_price_action', 'quarantine',
    'zero_stock_action', 'update',
    'auto_quarantine', true,
    'notification_email', ''
  );

CREATE TABLE IF NOT EXISTS public.xml_quarantine_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id uuid NOT NULL REFERENCES public.xml_feeds(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  sku text NOT NULL,
  product_title text,
  old_price numeric(12,2),
  new_price numeric(12,2),
  old_stock integer,
  new_stock integer,
  issue_type text NOT NULL CHECK (issue_type IN ('ZERO_PRICE','PRICE_DROP_LIMIT','PRICE_INCREASE_LIMIT','INVALID_BARCODE')),
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','approved','rejected')),
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS xml_quarantine_items_feed_status_idx
  ON public.xml_quarantine_items (feed_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS xml_quarantine_items_store_idx
  ON public.xml_quarantine_items (store_id, status);

GRANT SELECT, UPDATE ON public.xml_quarantine_items TO authenticated;
GRANT ALL ON public.xml_quarantine_items TO service_role;

ALTER TABLE public.xml_quarantine_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quarantine_select_store_managers"
  ON public.xml_quarantine_items FOR SELECT TO authenticated
  USING (
    app_private.can_manage_store(store_id, auth.uid())
    OR app_private.has_role(auth.uid(), 'platform_admin')
  );

CREATE POLICY "quarantine_update_store_managers"
  ON public.xml_quarantine_items FOR UPDATE TO authenticated
  USING (
    app_private.can_manage_store(store_id, auth.uid())
    OR app_private.has_role(auth.uid(), 'platform_admin')
  )
  WITH CHECK (
    app_private.can_manage_store(store_id, auth.uid())
    OR app_private.has_role(auth.uid(), 'platform_admin')
  );

CREATE POLICY "quarantine_service_all"
  ON public.xml_quarantine_items FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER set_xml_quarantine_items_updated_at
  BEFORE UPDATE ON public.xml_quarantine_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();