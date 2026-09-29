ALTER TABLE public.media_assets DROP CONSTRAINT IF EXISTS media_assets_kind_check;
ALTER TABLE public.media_assets ADD CONSTRAINT media_assets_kind_check CHECK (kind = ANY (ARRAY['image','video','document','audio','model','other']));
ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS original_filename text,
  ADD COLUMN IF NOT EXISTS original_format text,
  ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS processing_error text,
  ADD COLUMN IF NOT EXISTS thumbnail_sm_path text,
  ADD COLUMN IF NOT EXISTS thumbnail_md_path text,
  ADD COLUMN IF NOT EXISTS thumbnail_lg_path text,
  ADD COLUMN IF NOT EXISTS poster_path text,
  ADD COLUMN IF NOT EXISTS blurhash text,
  ADD COLUMN IF NOT EXISTS dominant_color text,
  ADD COLUMN IF NOT EXISTS color_palette jsonb,
  ADD COLUMN IF NOT EXISTS has_transparency boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_animated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata_stripped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS watermark_applied boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_asset_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL;
ALTER TABLE public.media_assets DROP CONSTRAINT IF EXISTS media_assets_processing_status_check;
ALTER TABLE public.media_assets ADD CONSTRAINT media_assets_processing_status_check CHECK (processing_status IN ('pending','processing','ready','failed'));

CREATE TABLE IF NOT EXISTS public.media_watermark_settings (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT false,
  watermark_type text NOT NULL DEFAULT 'text' CHECK (watermark_type IN ('text','image')),
  text_content text CHECK (char_length(text_content) <= 80),
  image_path text,
  color text NOT NULL DEFAULT '#FFFFFF' CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  opacity numeric(3,2) NOT NULL DEFAULT 0.50 CHECK (opacity BETWEEN 0.05 AND 1),
  size_percent integer NOT NULL DEFAULT 20 CHECK (size_percent BETWEEN 5 AND 60),
  position text NOT NULL DEFAULT 'bottom_right' CHECK (position IN ('top_left','top_center','top_right','center_left','center','center_right','bottom_left','bottom_center','bottom_right','tile')),
  margin_x integer NOT NULL DEFAULT 20 CHECK (margin_x BETWEEN 0 AND 500),
  margin_y integer NOT NULL DEFAULT 20 CHECK (margin_y BETWEEN 0 AND 500),
  apply_scope text NOT NULL DEFAULT 'products' CHECK (apply_scope IN ('all','products')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_watermark_settings TO authenticated;
GRANT ALL ON public.media_watermark_settings TO service_role;
ALTER TABLE public.media_watermark_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store managers manage watermark" ON public.media_watermark_settings FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER media_watermark_settings_updated_at BEFORE UPDATE ON public.media_watermark_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.media_upload_usage (
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Istanbul')::date,
  bytes_uploaded bigint NOT NULL DEFAULT 0 CHECK (bytes_uploaded >= 0),
  files_uploaded integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, usage_date)
);
GRANT SELECT ON public.media_upload_usage TO authenticated;
GRANT ALL ON public.media_upload_usage TO service_role;
ALTER TABLE public.media_upload_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store managers read upload usage" ON public.media_upload_usage FOR SELECT TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()));

INSERT INTO public.plan_features (plan_id, metric_key, label, is_enabled, limit_value)
SELECT p.id, 'v2_media_system', 'Medya Sistemi v2', false, NULL FROM public.plans p
WHERE NOT EXISTS (SELECT 1 FROM public.plan_features f WHERE f.plan_id = p.id AND f.metric_key = 'v2_media_system');
INSERT INTO public.plan_features (plan_id, metric_key, label, is_enabled, limit_value)
SELECT p.id, 'media_daily_upload_mb', 'Günlük medya yükleme (MB)', true,
  CASE p.code WHEN 'free' THEN 1024 WHEN 'starter' THEN 5120 WHEN 'professional' THEN 20480 WHEN 'business' THEN 102400 ELSE NULL END
FROM public.plans p
WHERE NOT EXISTS (SELECT 1 FROM public.plan_features f WHERE f.plan_id = p.id AND f.metric_key = 'media_daily_upload_mb');