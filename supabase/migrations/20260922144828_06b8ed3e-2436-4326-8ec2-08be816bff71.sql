-- ============================================================
-- XmlIntegrator: enum tipleri
-- ============================================================
CREATE TYPE public.xml_direction AS ENUM ('import', 'export');

CREATE TYPE public.xml_platform AS ENUM (
  'generic', 'trendyol', 'hepsiburada', 'n11', 'amazon', 'ciceksepeti', 'pttavm', 'google_shopping'
);

CREATE TYPE public.xml_source_format AS ENUM ('xml', 'csv', 'xlsx', 'json');

CREATE TYPE public.xml_auth_type AS ENUM ('none', 'basic', 'bearer', 'header', 'query');

CREATE TYPE public.xml_schedule AS ENUM ('manual', 'hourly', 'three_hourly', 'six_hourly', 'twelve_hourly', 'daily');

CREATE TYPE public.xml_run_status AS ENUM ('queued', 'running', 'success', 'partial', 'failed');

CREATE TYPE public.xml_run_trigger AS ENUM ('manual', 'scheduled', 'api');

-- ============================================================
-- xml_feeds: hem içe hem dışa aktarım beslemeleri
-- ============================================================
CREATE TABLE public.xml_feeds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  direction public.xml_direction NOT NULL DEFAULT 'import',
  platform public.xml_platform NOT NULL DEFAULT 'generic',
  source_format public.xml_source_format NOT NULL DEFAULT 'xml',
  source_url TEXT,
  item_path TEXT,
  auth_type public.xml_auth_type NOT NULL DEFAULT 'none',
  auth_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_filename TEXT,
  export_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  schedule public.xml_schedule NOT NULL DEFAULT 'manual',
  field_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  filter_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  transform_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  category_map JSONB NOT NULL DEFAULT '{}'::jsonb,
  price_markup NUMERIC(10,2),
  currency TEXT NOT NULL DEFAULT 'TRY',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_status public.xml_run_status,
  last_error TEXT,
  total_runs INTEGER NOT NULL DEFAULT 0,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT xml_feeds_name_per_store UNIQUE (store_id, name)
);

CREATE INDEX xml_feeds_store_direction_idx ON public.xml_feeds (store_id, direction);
CREATE INDEX xml_feeds_due_idx ON public.xml_feeds (next_run_at) WHERE is_active AND schedule <> 'manual';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.xml_feeds TO authenticated;
GRANT ALL ON public.xml_feeds TO service_role;
ALTER TABLE public.xml_feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "xml_feeds_manage" ON public.xml_feeds
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));

-- ============================================================
-- xml_field_schemas: kaynaktan okunan sütun/etiket envanteri
-- ============================================================
CREATE TABLE public.xml_field_schemas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  feed_id UUID NOT NULL REFERENCES public.xml_feeds(id) ON DELETE CASCADE,
  field_path TEXT NOT NULL,
  label TEXT,
  sample_values JSONB NOT NULL DEFAULT '[]'::jsonb,
  occurrence INTEGER NOT NULL DEFAULT 0,
  detected_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT xml_field_schemas_unique UNIQUE (feed_id, field_path)
);

CREATE INDEX xml_field_schemas_store_idx ON public.xml_field_schemas (store_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.xml_field_schemas TO authenticated;
GRANT ALL ON public.xml_field_schemas TO service_role;
ALTER TABLE public.xml_field_schemas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "xml_field_schemas_manage" ON public.xml_field_schemas
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));

-- ============================================================
-- xml_category_mappings: tedarikçi/pazaryeri kategori eşleşmeleri
-- ============================================================
CREATE TABLE public.xml_category_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  feed_id UUID NOT NULL REFERENCES public.xml_feeds(id) ON DELETE CASCADE,
  source_category TEXT NOT NULL,
  target_category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  target_category_code TEXT,
  target_category_name TEXT,
  product_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT xml_category_mappings_unique UNIQUE (feed_id, source_category)
);

CREATE INDEX xml_category_mappings_store_idx ON public.xml_category_mappings (store_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.xml_category_mappings TO authenticated;
GRANT ALL ON public.xml_category_mappings TO service_role;
ALTER TABLE public.xml_category_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "xml_category_mappings_manage" ON public.xml_category_mappings
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));

-- ============================================================
-- xml_import_logs: içe aktarım çalıştırma kayıtları
-- ============================================================
CREATE TABLE public.xml_import_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  feed_id UUID NOT NULL REFERENCES public.xml_feeds(id) ON DELETE CASCADE,
  status public.xml_run_status NOT NULL DEFAULT 'queued',
  trigger public.xml_run_trigger NOT NULL DEFAULT 'manual',
  total_rows INTEGER NOT NULL DEFAULT 0,
  created_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message TEXT,
  duration_seconds NUMERIC(10,2),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX xml_import_logs_feed_idx ON public.xml_import_logs (feed_id, created_at DESC);
CREATE INDEX xml_import_logs_store_idx ON public.xml_import_logs (store_id, created_at DESC);

GRANT SELECT ON public.xml_import_logs TO authenticated;
GRANT ALL ON public.xml_import_logs TO service_role;
ALTER TABLE public.xml_import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "xml_import_logs_read" ON public.xml_import_logs
  FOR SELECT TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));

-- ============================================================
-- xml_export_logs: dışa aktarım çalıştırma kayıtları
-- ============================================================
CREATE TABLE public.xml_export_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  feed_id UUID NOT NULL REFERENCES public.xml_feeds(id) ON DELETE CASCADE,
  status public.xml_run_status NOT NULL DEFAULT 'queued',
  trigger public.xml_run_trigger NOT NULL DEFAULT 'manual',
  exported_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  file_size_bytes INTEGER,
  output_url TEXT,
  issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message TEXT,
  duration_seconds NUMERIC(10,2),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX xml_export_logs_feed_idx ON public.xml_export_logs (feed_id, created_at DESC);
CREATE INDEX xml_export_logs_store_idx ON public.xml_export_logs (store_id, created_at DESC);

GRANT SELECT ON public.xml_export_logs TO authenticated;
GRANT ALL ON public.xml_export_logs TO service_role;
ALTER TABLE public.xml_export_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "xml_export_logs_read" ON public.xml_export_logs
  FOR SELECT TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));

-- ============================================================
-- updated_at tetikleyicileri
-- ============================================================
CREATE TRIGGER xml_feeds_touch BEFORE UPDATE ON public.xml_feeds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER xml_field_schemas_touch BEFORE UPDATE ON public.xml_field_schemas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER xml_category_mappings_touch BEFORE UPDATE ON public.xml_category_mappings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER xml_import_logs_touch BEFORE UPDATE ON public.xml_import_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER xml_export_logs_touch BEFORE UPDATE ON public.xml_export_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();