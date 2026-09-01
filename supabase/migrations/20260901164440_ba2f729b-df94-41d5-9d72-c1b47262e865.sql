-- Medya klasörleri
CREATE TABLE public.media_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.media_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  path TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX media_folders_unique_name
  ON public.media_folders (store_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(name)));
CREATE INDEX media_folders_store_idx ON public.media_folders (store_id, parent_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_folders TO authenticated;
GRANT ALL ON public.media_folders TO service_role;
ALTER TABLE public.media_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "media_folders_read" ON public.media_folders FOR SELECT TO authenticated
USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(),'platform_admin'));

CREATE POLICY "media_folders_write" ON public.media_folders FOR ALL TO authenticated
USING (app_private.can_manage_store(store_id, auth.uid()))
WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE TRIGGER media_folders_set_updated_at BEFORE UPDATE ON public.media_folders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Medya dosyaları
CREATE TABLE public.media_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.media_folders(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL CHECK (length(btrim(file_name)) BETWEEN 1 AND 200),
  title TEXT,
  alt TEXT,
  caption TEXT,
  kind TEXT NOT NULL DEFAULT 'image' CHECK (kind IN ('image','video','document')),
  mime_type TEXT NOT NULL,
  extension TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  original_size_bytes BIGINT,
  width INTEGER,
  height INTEGER,
  duration_seconds NUMERIC(10,2),
  storage_provider TEXT NOT NULL DEFAULT 'supabase' CHECK (storage_provider IN ('supabase','s3','r2','gcs')),
  bucket TEXT NOT NULL DEFAULT 'store-media',
  storage_path TEXT NOT NULL,
  public_url TEXT,
  checksum TEXT,
  optimized BOOLEAN NOT NULL DEFAULT false,
  converted_to_webp BOOLEAN NOT NULL DEFAULT false,
  variants JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags TEXT[] NOT NULL DEFAULT '{}',
  usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX media_assets_unique_path ON public.media_assets (bucket, storage_path);
CREATE UNIQUE INDEX media_assets_unique_name
  ON public.media_assets (store_id, COALESCE(folder_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(file_name)));
CREATE INDEX media_assets_store_created_idx ON public.media_assets (store_id, created_at DESC);
CREATE INDEX media_assets_store_kind_idx ON public.media_assets (store_id, kind);
CREATE INDEX media_assets_folder_idx ON public.media_assets (folder_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_assets TO authenticated;
GRANT ALL ON public.media_assets TO service_role;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "media_assets_read" ON public.media_assets FOR SELECT TO authenticated
USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(),'platform_admin'));

CREATE POLICY "media_assets_write" ON public.media_assets FOR ALL TO authenticated
USING (app_private.can_manage_store(store_id, auth.uid()))
WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE TRIGGER media_assets_set_updated_at BEFORE UPDATE ON public.media_assets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Klasör yolunu (breadcrumb) otomatik hesapla
CREATE OR REPLACE FUNCTION public.media_folder_compute_path()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_path TEXT := '';
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT f.path INTO parent_path FROM public.media_folders f WHERE f.id = NEW.parent_id;
    IF parent_path IS NULL THEN parent_path := ''; END IF;
  END IF;
  NEW.name := btrim(NEW.name);
  NEW.path := CASE WHEN parent_path = '' THEN NEW.name ELSE parent_path || ' / ' || NEW.name END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER media_folders_compute_path BEFORE INSERT OR UPDATE OF name, parent_id
ON public.media_folders FOR EACH ROW EXECUTE FUNCTION public.media_folder_compute_path();