ALTER TABLE public.v2_themes
  ADD COLUMN IF NOT EXISTS template_id uuid,
  ADD COLUMN IF NOT EXISTS version text NOT NULL DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS installed_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS customizations jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE public.v2_theme_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,80}$'),
  description text NOT NULL DEFAULT '',
  preview_image_url text,
  preview_url text,
  author text NOT NULL DEFAULT 'Mefticaret',
  version text NOT NULL DEFAULT '1.0.0',
  price numeric(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  currency text NOT NULL DEFAULT 'TRY',
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('fashion','electronics','food','general')),
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_official boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT true,
  downloads_count integer NOT NULL DEFAULT 0,
  rating_avg numeric(3,2) NOT NULL DEFAULT 0,
  rating_count integer NOT NULL DEFAULT 0,
  structure_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  assets_zip_url text,
  license_theme_id uuid REFERENCES public.themes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.v2_theme_templates TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.v2_theme_templates TO authenticated;
GRANT ALL ON public.v2_theme_templates TO service_role;
ALTER TABLE public.v2_theme_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads published templates" ON public.v2_theme_templates FOR SELECT TO anon, authenticated USING (is_published OR app_private.has_role(auth.uid(),'platform_admin'));
CREATE POLICY "Admins manage templates" ON public.v2_theme_templates FOR ALL TO authenticated USING (app_private.has_role(auth.uid(),'platform_admin')) WITH CHECK (app_private.has_role(auth.uid(),'platform_admin'));
CREATE TRIGGER v2_theme_templates_updated BEFORE UPDATE ON public.v2_theme_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.v2_themes ADD CONSTRAINT v2_themes_template_fk FOREIGN KEY (template_id) REFERENCES public.v2_theme_templates(id) ON DELETE SET NULL;

CREATE TABLE public.v2_theme_template_screenshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.v2_theme_templates(id) ON DELETE CASCADE,
  url text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  device_type text NOT NULL DEFAULT 'desktop' CHECK (device_type IN ('desktop','mobile','tablet')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.v2_theme_template_screenshots TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.v2_theme_template_screenshots TO authenticated;
GRANT ALL ON public.v2_theme_template_screenshots TO service_role;
ALTER TABLE public.v2_theme_template_screenshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads screenshots" ON public.v2_theme_template_screenshots FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage screenshots" ON public.v2_theme_template_screenshots FOR ALL TO authenticated USING (app_private.has_role(auth.uid(),'platform_admin')) WITH CHECK (app_private.has_role(auth.uid(),'platform_admin'));

CREATE TABLE public.v2_theme_template_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.v2_theme_templates(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  author_name text NOT NULL DEFAULT '',
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL DEFAULT '' CHECK (char_length(comment) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, store_id)
);
GRANT SELECT ON public.v2_theme_template_reviews TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.v2_theme_template_reviews TO authenticated;
GRANT ALL ON public.v2_theme_template_reviews TO service_role;
ALTER TABLE public.v2_theme_template_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads reviews" ON public.v2_theme_template_reviews FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Managers write own store review" ON public.v2_theme_template_reviews FOR ALL TO authenticated
  USING (user_id = auth.uid() AND app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() AND app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER v2_theme_template_reviews_updated BEFORE UPDATE ON public.v2_theme_template_reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.v2_theme_template_rating_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tid uuid := COALESCE(NEW.template_id, OLD.template_id);
BEGIN
  UPDATE public.v2_theme_templates t SET
    rating_avg = COALESCE((SELECT round(avg(rating)::numeric, 2) FROM public.v2_theme_template_reviews WHERE template_id = tid), 0),
    rating_count = (SELECT count(*) FROM public.v2_theme_template_reviews WHERE template_id = tid)
  WHERE t.id = tid;
  RETURN NULL;
END $$;
CREATE TRIGGER v2_theme_template_rating AFTER INSERT OR UPDATE OR DELETE ON public.v2_theme_template_reviews FOR EACH ROW EXECUTE FUNCTION public.v2_theme_template_rating_sync();

CREATE OR REPLACE FUNCTION public.v2_theme_template_count_install()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.template_id IS NOT NULL THEN
    UPDATE public.v2_theme_templates SET downloads_count = downloads_count + 1 WHERE id = NEW.template_id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER v2_themes_count_install AFTER INSERT ON public.v2_themes FOR EACH ROW EXECUTE FUNCTION public.v2_theme_template_count_install();
REVOKE EXECUTE ON FUNCTION public.v2_theme_template_rating_sync() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.v2_theme_template_count_install() FROM PUBLIC, anon, authenticated;

CREATE TABLE public.v2_theme_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  tenant_theme_id uuid NOT NULL REFERENCES public.v2_themes(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  label text NOT NULL DEFAULT '' CHECK (char_length(label) <= 120),
  summary text NOT NULL DEFAULT '' CHECK (char_length(summary) <= 300),
  created_by_user_id uuid,
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX v2_theme_versions_theme_idx ON public.v2_theme_versions(tenant_theme_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.v2_theme_versions TO authenticated;
GRANT ALL ON public.v2_theme_versions TO service_role;
ALTER TABLE public.v2_theme_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read theme versions" ON public.v2_theme_versions FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "Managers insert theme versions" ON public.v2_theme_versions FOR INSERT TO authenticated WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "Managers delete theme versions" ON public.v2_theme_versions FOR DELETE TO authenticated USING (app_private.can_manage_store(store_id, auth.uid()));

CREATE TABLE public.v2_theme_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  tenant_theme_id uuid NOT NULL REFERENCES public.v2_themes(id) ON DELETE CASCADE,
  asset_type text NOT NULL CHECK (asset_type IN ('css','js','image','font')),
  key text NOT NULL CHECK (key ~ '^[A-Za-z0-9._/-]{1,120}$'),
  value text CHECK (value IS NULL OR char_length(value) <= 200000),
  url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_theme_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.v2_theme_assets TO authenticated;
GRANT ALL ON public.v2_theme_assets TO service_role;
ALTER TABLE public.v2_theme_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read theme assets" ON public.v2_theme_assets FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "Managers write theme assets" ON public.v2_theme_assets FOR ALL TO authenticated USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER v2_theme_assets_updated BEFORE UPDATE ON public.v2_theme_assets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.v2_theme_preview_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  tenant_theme_id uuid NOT NULL REFERENCES public.v2_themes(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.v2_theme_preview_tokens TO authenticated;
GRANT ALL ON public.v2_theme_preview_tokens TO service_role;
ALTER TABLE public.v2_theme_preview_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage preview tokens" ON public.v2_theme_preview_tokens FOR ALL TO authenticated USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

INSERT INTO public.v2_theme_templates (name, slug, description, category, is_official, is_featured, structure_json, tags, features)
SELECT p.name, lower(p.name), p.name || ' — Mefticaret resmi ücretsiz tema.',
  CASE lower(p.name) WHEN 'boutique' THEN 'fashion' WHEN 'tech' THEN 'electronics' WHEN 'nature' THEN 'food' ELSE 'general' END,
  true, lower(p.name) IN ('minimal','boutique'), p.structure, '["resmi","ücretsiz"]'::jsonb,
  '["Bölüm/blok editörü","Mobil uyumlu","Koyu mod","SEO uyumlu"]'::jsonb
FROM public.v2_theme_presets p WHERE p.is_official
ON CONFLICT (slug) DO NOTHING;