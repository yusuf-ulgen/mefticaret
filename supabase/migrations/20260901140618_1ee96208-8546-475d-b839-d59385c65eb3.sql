-- Blog categories
CREATE TABLE public.blog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_categories TO authenticated;
GRANT SELECT ON public.blog_categories TO anon;
GRANT ALL ON public.blog_categories TO service_role;
ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blog_categories_public_read" ON public.blog_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "blog_categories_manage" ON public.blog_categories FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER blog_categories_set_updated_at BEFORE UPDATE ON public.blog_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Blog authors
CREATE TABLE public.blog_authors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  title text,
  bio text,
  avatar_url text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_authors TO authenticated;
GRANT SELECT ON public.blog_authors TO anon;
GRANT ALL ON public.blog_authors TO service_role;
ALTER TABLE public.blog_authors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blog_authors_public_read" ON public.blog_authors FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "blog_authors_manage" ON public.blog_authors FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER blog_authors_set_updated_at BEFORE UPDATE ON public.blog_authors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Blog tags
CREATE TABLE public.blog_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_tags TO authenticated;
GRANT SELECT ON public.blog_tags TO anon;
GRANT ALL ON public.blog_tags TO service_role;
ALTER TABLE public.blog_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blog_tags_public_read" ON public.blog_tags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "blog_tags_manage" ON public.blog_tags FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER blog_tags_set_updated_at BEFORE UPDATE ON public.blog_tags FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Page <-> tag join
CREATE TABLE public.store_page_tags (
  page_id uuid NOT NULL REFERENCES public.store_pages(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.blog_tags(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (page_id, tag_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_page_tags TO authenticated;
GRANT SELECT ON public.store_page_tags TO anon;
GRANT ALL ON public.store_page_tags TO service_role;
ALTER TABLE public.store_page_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store_page_tags_public_read" ON public.store_page_tags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "store_page_tags_manage" ON public.store_page_tags FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

-- store_pages CMS fields
ALTER TABLE public.store_pages
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.blog_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES public.blog_authors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cover_url text;

UPDATE public.store_pages SET status = CASE WHEN is_published THEN 'published' ELSE 'draft' END;

CREATE OR REPLACE FUNCTION public.validate_page_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('draft','published','scheduled') THEN
    RAISE EXCEPTION 'Geçersiz yayın durumu: %', NEW.status;
  END IF;

  IF NEW.status = 'scheduled' THEN
    IF NEW.scheduled_at IS NULL THEN
      RAISE EXCEPTION 'Zamanlanmış içerik için yayın tarihi gerekli';
    END IF;
    NEW.is_published := NEW.scheduled_at <= now();
    IF NEW.is_published AND NEW.published_at IS NULL THEN
      NEW.published_at := NEW.scheduled_at;
    END IF;
  ELSIF NEW.status = 'published' THEN
    NEW.is_published := true;
    IF NEW.published_at IS NULL THEN NEW.published_at := now(); END IF;
  ELSE
    NEW.is_published := false;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER store_pages_validate_status
BEFORE INSERT OR UPDATE ON public.store_pages
FOR EACH ROW EXECUTE FUNCTION public.validate_page_status();

CREATE OR REPLACE FUNCTION public.publish_due_blog_posts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer := 0;
BEGIN
  UPDATE public.store_pages
     SET status = 'published',
         is_published = true,
         published_at = COALESCE(published_at, scheduled_at)
   WHERE status = 'scheduled'
     AND scheduled_at IS NOT NULL
     AND scheduled_at <= now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

CREATE INDEX IF NOT EXISTS store_pages_blog_idx ON public.store_pages (store_id, page_kind, status, published_at DESC);