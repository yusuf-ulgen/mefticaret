ALTER TABLE public.xml_feeds
  ADD COLUMN IF NOT EXISTS mapping_groups jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS field_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS max_errors_before_pause integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS error_notification_email text,
  ADD COLUMN IF NOT EXISTS paused_reason text;

ALTER TABLE public.xml_import_logs
  ADD COLUMN IF NOT EXISTS control_state text NOT NULL DEFAULT 'running',
  ADD COLUMN IF NOT EXISTS resume_cursor integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rate_per_min numeric;

CREATE TABLE public.xml_mapping_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  provider_type text NOT NULL DEFAULT 'generic_xml',
  field_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  field_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  mapping_groups jsonb NOT NULL DEFAULT '[]'::jsonb,
  usage_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  is_public boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xml_mapping_templates TO authenticated;
GRANT ALL ON public.xml_mapping_templates TO service_role;
ALTER TABLE public.xml_mapping_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public templates readable" ON public.xml_mapping_templates FOR SELECT TO authenticated
  USING (is_public = true OR (store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid())));
CREATE POLICY "Store manages own templates" ON public.xml_mapping_templates FOR ALL TO authenticated
  USING (store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (store_id IS NOT NULL AND is_public = false AND app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER xml_mapping_templates_updated BEFORE UPDATE ON public.xml_mapping_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.xml_run_failed_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.xml_import_logs(id) ON DELETE CASCADE,
  feed_id uuid NOT NULL REFERENCES public.xml_feeds(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  sku text,
  error_type text NOT NULL DEFAULT 'other',
  message text,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX xml_run_failed_items_feed_idx ON public.xml_run_failed_items(feed_id, status, created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.xml_run_failed_items TO authenticated;
GRANT ALL ON public.xml_run_failed_items TO service_role;
ALTER TABLE public.xml_run_failed_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store reads failed items" ON public.xml_run_failed_items FOR SELECT TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "Store updates failed items" ON public.xml_run_failed_items FOR UPDATE TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "Store deletes failed items" ON public.xml_run_failed_items FOR DELETE TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER xml_run_failed_items_updated BEFORE UPDATE ON public.xml_run_failed_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.xml_mapping_templates (store_id, name, description, provider_type, field_mapping, is_public) VALUES
(NULL, 'Giyim Tedarikçisi (TR Standart)', 'Trendyol uyumlu giyim alanları', 'generic_xml',
 '{"title":"UrunAdi","sku":"StokKodu","barcode":"Barkod","price":"Fiyat","compare_at_price":"PiyasaFiyati","stock":"Stok","brand":"Marka","category":"Kategori","description":"Aciklama","image_1":"Resim1","image_2":"Resim2","image_3":"Resim3","option1":"Beden","option2":"Renk"}', true),
(NULL, 'WooCommerce XML Export', 'WooCommerce ürün dışa aktarımı', 'woocommerce',
 '{"title":"name","sku":"sku","price":"regular_price","compare_at_price":"sale_price","stock":"stock_quantity","description":"description","category":"categories","image_1":"images","weight":"weight"}', true),
(NULL, 'Hepsiburada Tedarikçi Feed', 'Zorunlu alanlar dahil', 'hepsiburada',
 '{"title":"UrunAdi","sku":"SaticiStokKodu","barcode":"Barkod","price":"Fiyat","stock":"Stok","brand":"Marka","category":"KategoriAdi","description":"UrunAciklamasi","image_1":"Gorsel1","image_2":"Gorsel2","image_3":"Gorsel3","image_4":"Gorsel4","image_5":"Gorsel5","weight":"Desi"}', true);