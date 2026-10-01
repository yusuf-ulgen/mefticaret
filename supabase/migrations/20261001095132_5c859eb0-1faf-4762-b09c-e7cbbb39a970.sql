-- Satın alma siparişlerinde tedarikçi tarafı takip + ödeme alanları
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS supplier_status text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS carrier text,
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS paid_amount numeric,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS payment_reference text;
ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_supplier_status_chk CHECK (supplier_status IN ('new','accepted','preparing','shipped','rejected')),
  ADD CONSTRAINT purchase_orders_payment_status_chk CHECK (payment_status IN ('unpaid','pending','paid'));

-- Tedarikçi ↔ mağaza mesajları
CREATE TABLE public.supplier_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('store','supplier','admin')),
  sender_user_id uuid,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX supplier_messages_thread_idx ON public.supplier_messages (supplier_id, created_at DESC);
GRANT SELECT ON public.supplier_messages TO authenticated;
GRANT ALL ON public.supplier_messages TO service_role;
ALTER TABLE public.supplier_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store members and portal supplier read messages" ON public.supplier_messages
  FOR SELECT TO authenticated USING (
    app_private.is_store_member(store_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND s.portal_user_id = auth.uid() AND s.portal_enabled)
  );

-- Tedarikçinin kendi XML ürün beslemeleri
CREATE TABLE public.supplier_xml_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  source_url text NOT NULL,
  field_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_status text,
  last_error text,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX supplier_xml_feeds_supplier_idx ON public.supplier_xml_feeds (supplier_id);
GRANT SELECT ON public.supplier_xml_feeds TO authenticated;
GRANT ALL ON public.supplier_xml_feeds TO service_role;
ALTER TABLE public.supplier_xml_feeds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store members and portal supplier read feeds" ON public.supplier_xml_feeds
  FOR SELECT TO authenticated USING (
    app_private.is_store_member(store_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND s.portal_user_id = auth.uid() AND s.portal_enabled)
  );
CREATE TRIGGER supplier_xml_feeds_updated BEFORE UPDATE ON public.supplier_xml_feeds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Tedarikçinin ödeme sağlayıcısı (iyzico / PayTR) anahtarları: yalnız sunucu erişir
CREATE TABLE public.supplier_payment_settings (
  supplier_id uuid PRIMARY KEY REFERENCES public.suppliers(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('iyzico','paytr')),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.supplier_payment_settings TO service_role;
ALTER TABLE public.supplier_payment_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct client access to supplier payment keys" ON public.supplier_payment_settings
  FOR SELECT TO authenticated USING (false);