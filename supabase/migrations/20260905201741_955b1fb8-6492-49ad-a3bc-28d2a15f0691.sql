-- === Dil ve Çeviri Merkezi ===

DO $$ BEGIN
  CREATE TYPE public.translation_status AS ENUM ('missing','machine','needs_review','translated','approved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.translation_url_strategy AS ENUM ('subdirectory','subdomain','domain');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.translation_job_status AS ENUM ('queued','running','completed','failed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) Mağaza dilleri
CREATE TABLE IF NOT EXISTS public.store_locales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  code text NOT NULL,
  locale text NOT NULL,
  label text NOT NULL,
  native_label text,
  currency text,
  dir text NOT NULL DEFAULT 'ltr',
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  fallback_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, locale)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_locales TO authenticated;
GRANT SELECT ON public.store_locales TO anon;
GRANT ALL ON public.store_locales TO service_role;
ALTER TABLE public.store_locales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store_locales public read" ON public.store_locales FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY "store_locales member read" ON public.store_locales FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "store_locales manage" ON public.store_locales FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

-- 2) Çeviri kayıtları
CREATE TABLE IF NOT EXISTS public.translation_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  locale text NOT NULL,
  namespace text NOT NULL DEFAULT 'system',
  content_type text NOT NULL DEFAULT 'system',
  entity_id uuid,
  field text,
  translation_key text NOT NULL,
  source_value text,
  translated_value text,
  status public.translation_status NOT NULL DEFAULT 'missing',
  provider text,
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, locale, translation_key)
);
CREATE INDEX IF NOT EXISTS translation_entries_store_locale_idx ON public.translation_entries (store_id, locale, content_type);
CREATE INDEX IF NOT EXISTS translation_entries_entity_idx ON public.translation_entries (store_id, content_type, entity_id);
CREATE INDEX IF NOT EXISTS translation_entries_status_idx ON public.translation_entries (store_id, locale, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.translation_entries TO authenticated;
GRANT SELECT ON public.translation_entries TO anon;
GRANT ALL ON public.translation_entries TO service_role;
ALTER TABLE public.translation_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "translation_entries public read" ON public.translation_entries FOR SELECT TO anon, authenticated
  USING (status <> 'missing');
CREATE POLICY "translation_entries member read" ON public.translation_entries FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "translation_entries manage" ON public.translation_entries FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

-- 3) Sürüm geçmişi
CREATE TABLE IF NOT EXISTS public.translation_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  entry_id uuid REFERENCES public.translation_entries(id) ON DELETE CASCADE,
  locale text NOT NULL,
  translation_key text NOT NULL,
  old_value text,
  new_value text,
  version integer NOT NULL DEFAULT 1,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS translation_versions_entry_idx ON public.translation_versions (entry_id, created_at DESC);
GRANT SELECT ON public.translation_versions TO authenticated;
GRANT ALL ON public.translation_versions TO service_role;
ALTER TABLE public.translation_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "translation_versions member read" ON public.translation_versions FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));

-- 4) Çeviri hafızası
CREATE TABLE IF NOT EXISTS public.translation_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  source_locale text NOT NULL,
  target_locale text NOT NULL,
  source_hash text NOT NULL,
  source_text text NOT NULL,
  target_text text NOT NULL,
  approved boolean NOT NULL DEFAULT true,
  hits integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, source_locale, target_locale, source_hash)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.translation_memory TO authenticated;
GRANT ALL ON public.translation_memory TO service_role;
ALTER TABLE public.translation_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "translation_memory member read" ON public.translation_memory FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "translation_memory manage" ON public.translation_memory FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

-- 5) Sözlük
CREATE TABLE IF NOT EXISTS public.translation_glossary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  term text NOT NULL,
  locale text,
  translation text,
  do_not_translate boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS translation_glossary_store_idx ON public.translation_glossary (store_id, term);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.translation_glossary TO authenticated;
GRANT ALL ON public.translation_glossary TO service_role;
ALTER TABLE public.translation_glossary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "translation_glossary member read" ON public.translation_glossary FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "translation_glossary manage" ON public.translation_glossary FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

-- 6) Toplu çeviri işleri
CREATE TABLE IF NOT EXISTS public.translation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  source_locale text NOT NULL,
  target_locales text[] NOT NULL DEFAULT '{}',
  content_types text[] NOT NULL DEFAULT '{}',
  status public.translation_job_status NOT NULL DEFAULT 'queued',
  total_items integer NOT NULL DEFAULT 0,
  done_items integer NOT NULL DEFAULT 0,
  failed_items integer NOT NULL DEFAULT 0,
  error text,
  created_by uuid,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS translation_jobs_store_idx ON public.translation_jobs (store_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.translation_jobs TO authenticated;
GRANT ALL ON public.translation_jobs TO service_role;
ALTER TABLE public.translation_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "translation_jobs member read" ON public.translation_jobs FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "translation_jobs manage" ON public.translation_jobs FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.translation_job_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.translation_jobs(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  locale text NOT NULL,
  translation_key text NOT NULL,
  content_type text NOT NULL DEFAULT 'system',
  entity_id uuid,
  field text,
  source_value text,
  translated_value text,
  status public.translation_job_status NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS translation_job_items_job_idx ON public.translation_job_items (job_id, status);
CREATE INDEX IF NOT EXISTS translation_job_items_pending_idx ON public.translation_job_items (store_id, status);
GRANT SELECT ON public.translation_job_items TO authenticated;
GRANT ALL ON public.translation_job_items TO service_role;
ALTER TABLE public.translation_job_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "translation_job_items member read" ON public.translation_job_items FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));

-- 7) Kullanım takibi
CREATE TABLE IF NOT EXISTS public.translation_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT CURRENT_DATE,
  locale text NOT NULL,
  provider text NOT NULL DEFAULT 'lovable-ai',
  characters bigint NOT NULL DEFAULT 0,
  words bigint NOT NULL DEFAULT 0,
  requests integer NOT NULL DEFAULT 0,
  cost numeric(12,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, day, locale, provider)
);
GRANT SELECT ON public.translation_usage TO authenticated;
GRANT ALL ON public.translation_usage TO service_role;
ALTER TABLE public.translation_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "translation_usage member read" ON public.translation_usage FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));

-- 8) Çeviri ayarları
CREATE TABLE IF NOT EXISTS public.translation_settings (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  provider text NOT NULL DEFAULT 'lovable-ai',
  model text NOT NULL DEFAULT 'google/gemini-2.5-flash',
  brand_voice text NOT NULL DEFAULT 'professional',
  detect_browser_language boolean NOT NULL DEFAULT true,
  url_strategy public.translation_url_strategy NOT NULL DEFAULT 'subdirectory',
  show_missing boolean NOT NULL DEFAULT false,
  translate_slugs boolean NOT NULL DEFAULT true,
  switcher_style text NOT NULL DEFAULT 'flags_text',
  switcher_enabled boolean NOT NULL DEFAULT true,
  do_not_translate text[] NOT NULL DEFAULT '{}',
  fallback_chain text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.translation_settings TO authenticated;
GRANT SELECT ON public.translation_settings TO anon;
GRANT ALL ON public.translation_settings TO service_role;
ALTER TABLE public.translation_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "translation_settings public read" ON public.translation_settings FOR SELECT TO anon, authenticated USING (enabled);
CREATE POLICY "translation_settings member read" ON public.translation_settings FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "translation_settings manage" ON public.translation_settings FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

-- updated_at trigger'ları
CREATE TRIGGER store_locales_touch BEFORE UPDATE ON public.store_locales
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER translation_entries_touch BEFORE UPDATE ON public.translation_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER translation_memory_touch BEFORE UPDATE ON public.translation_memory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER translation_glossary_touch BEFORE UPDATE ON public.translation_glossary
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER translation_jobs_touch BEFORE UPDATE ON public.translation_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER translation_job_items_touch BEFORE UPDATE ON public.translation_job_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER translation_usage_touch BEFORE UPDATE ON public.translation_usage
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER translation_settings_touch BEFORE UPDATE ON public.translation_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Çeviri değişikliklerinde sürüm kaydı
CREATE OR REPLACE FUNCTION public.record_translation_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.translated_value,'') = COALESCE(NEW.translated_value,'') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.version := COALESCE(OLD.version, 1) + 1;
  END IF;
  INSERT INTO public.translation_versions (store_id, entry_id, locale, translation_key, old_value, new_value, version, changed_by)
  VALUES (NEW.store_id, NEW.id, NEW.locale, NEW.translation_key,
          CASE WHEN TG_OP = 'UPDATE' THEN OLD.translated_value ELSE NULL END,
          NEW.translated_value, NEW.version, COALESCE(NEW.updated_by, auth.uid()));
  RETURN NEW;
END;
$$;

CREATE TRIGGER translation_entries_version
  BEFORE INSERT OR UPDATE ON public.translation_entries
  FOR EACH ROW EXECUTE FUNCTION public.record_translation_version();

-- Uygulama mağazası kaydı
INSERT INTO public.apps (code, name, tagline, description, category, developer, logo_emoji, pricing_model, price, currency, permissions, is_active, is_featured, sort_order, version)
VALUES (
  'language-center',
  'Dil ve Çeviri Merkezi',
  'Mağazanı çok dilli hale getir',
  'Ürün, kategori, koleksiyon, sayfa, blog, menü, tema, sistem metinleri ve SEO alanlarını sınırsız dile çevir. AI destekli toplu çeviri, çeviri hafızası, sözlük, hreflang ve çok dilli sitemap desteği.',
  'ai',
  'Mefticaret',
  '🌍',
  'monthly',
  299,
  'TRY',
  ARRAY['products.read','products.write','content.read','content.write','seo.write','store.read'],
  true,
  true,
  6,
  '1.0.0'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  description = EXCLUDED.description,
  logo_emoji = EXCLUDED.logo_emoji,
  is_active = true;