-- 1) XML Entegratör v2: iki yönlü (import/export) besleme alanları
ALTER TABLE public.supplier_feeds
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'import',
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'generic',
  ADD COLUMN IF NOT EXISTS transform_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS output_filename text,
  ADD COLUMN IF NOT EXISTS output_target text NOT NULL DEFAULT 'url',
  ADD COLUMN IF NOT EXISTS cron_expression text,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Istanbul',
  ADD COLUMN IF NOT EXISTS max_runtime_seconds integer NOT NULL DEFAULT 600,
  ADD COLUMN IF NOT EXISTS total_runs integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS export_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex');

DO $$ BEGIN
  ALTER TABLE public.supplier_feeds
    ADD CONSTRAINT supplier_feeds_direction_check CHECK (direction IN ('import','export'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.supplier_feeds
    ADD CONSTRAINT supplier_feeds_output_target_check CHECK (output_target IN ('url','storage','webhook'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.supplier_feeds ALTER COLUMN source_url DROP NOT NULL;

CREATE INDEX IF NOT EXISTS supplier_feeds_direction_idx ON public.supplier_feeds (store_id, direction);

-- 2) Çalıştırma kayıtlarına yön ve çıktı bilgileri
ALTER TABLE public.supplier_feed_runs
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'import',
  ADD COLUMN IF NOT EXISTS output_url text,
  ADD COLUMN IF NOT EXISTS file_size_bytes integer,
  ADD COLUMN IF NOT EXISTS duration_seconds numeric,
  ADD COLUMN IF NOT EXISTS warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS errors jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS supplier_feed_runs_store_started_idx
  ON public.supplier_feed_runs (store_id, started_at DESC);

-- 3) Kategori eşleme tablosu
CREATE TABLE IF NOT EXISTS public.xml_category_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  feed_id uuid NOT NULL REFERENCES public.supplier_feeds(id) ON DELETE CASCADE,
  source_category text NOT NULL,
  target_category_id text,
  target_category_name text,
  platform text NOT NULL DEFAULT 'generic',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (feed_id, source_category)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.xml_category_mappings TO authenticated;
GRANT ALL ON public.xml_category_mappings TO service_role;

ALTER TABLE public.xml_category_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS xml_category_mappings_read ON public.xml_category_mappings;
CREATE POLICY xml_category_mappings_read ON public.xml_category_mappings
  FOR SELECT TO authenticated
  USING (app_private.is_store_member(auth.uid(), store_id));

DROP POLICY IF EXISTS xml_category_mappings_manage ON public.xml_category_mappings;
CREATE POLICY xml_category_mappings_manage ON public.xml_category_mappings
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(auth.uid(), store_id))
  WITH CHECK (app_private.can_manage_store(auth.uid(), store_id));

DROP TRIGGER IF EXISTS xml_category_mappings_updated_at ON public.xml_category_mappings;
CREATE TRIGGER xml_category_mappings_updated_at
  BEFORE UPDATE ON public.xml_category_mappings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Güvenlik: uygulama izin kataloğu artık herkese açık okunmuyor
DROP POLICY IF EXISTS app_permissions_read ON public.app_permissions;
CREATE POLICY app_permissions_read ON public.app_permissions
  FOR SELECT TO authenticated
  USING (true);
REVOKE SELECT ON public.app_permissions FROM anon;