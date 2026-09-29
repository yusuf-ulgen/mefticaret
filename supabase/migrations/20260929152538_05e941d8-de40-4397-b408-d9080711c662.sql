ALTER TABLE public.store_pages
  ADD COLUMN IF NOT EXISTS featured_dummy_marker boolean;
ALTER TABLE public.store_pages DROP COLUMN IF EXISTS featured_dummy_marker;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_private
AS $$ SELECT _user_id = auth.uid() AND app_private.has_role(_user_id, _role) $$;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_manage_store(_store_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_private
AS $$ SELECT _user_id = auth.uid() AND app_private.can_manage_store(_store_id, _user_id) $$;
REVOKE ALL ON FUNCTION public.can_manage_store(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_manage_store(uuid, uuid) TO authenticated;

ALTER TABLE public.store_pages
  ADD COLUMN IF NOT EXISTS cover_alt text,
  ADD COLUMN IF NOT EXISTS reading_time_minutes int,
  ADD COLUMN IF NOT EXISTS word_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS post_type text NOT NULL DEFAULT 'article',
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_comments boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS seo_keywords text,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS og_title text,
  ADD COLUMN IF NOT EXISTS og_description text,
  ADD COLUMN IF NOT EXISTS og_image_url text,
  ADD COLUMN IF NOT EXISTS schema_type text NOT NULL DEFAULT 'BlogPosting',
  ADD COLUMN IF NOT EXISTS canonical_url text,
  ADD COLUMN IF NOT EXISTS noindex boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS view_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS like_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comment_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revision_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_edited_by uuid,
  ADD COLUMN IF NOT EXISTS last_edited_at timestamptz;

ALTER TABLE public.platform_posts
  ADD COLUMN IF NOT EXISTS cover_alt text,
  ADD COLUMN IF NOT EXISTS reading_time_minutes int,
  ADD COLUMN IF NOT EXISTS word_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS post_type text NOT NULL DEFAULT 'article',
  ADD COLUMN IF NOT EXISTS allow_comments boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS seo_keywords text,
  ADD COLUMN IF NOT EXISTS og_title text,
  ADD COLUMN IF NOT EXISTS og_description text,
  ADD COLUMN IF NOT EXISTS og_image_url text,
  ADD COLUMN IF NOT EXISTS schema_type text NOT NULL DEFAULT 'BlogPosting',
  ADD COLUMN IF NOT EXISTS view_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS like_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comment_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revision_count int NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.validate_page_status()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status NOT IN ('draft','review','published','scheduled','archived') THEN
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
$function$;

-- Blog ayarları (store_id null = platform)
CREATE TABLE public.blog_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  layout text NOT NULL DEFAULT 'list' CHECK (layout IN ('list','grid','magazine')),
  posts_per_page int NOT NULL DEFAULT 12 CHECK (posts_per_page BETWEEN 3 AND 48),
  show_author boolean NOT NULL DEFAULT true,
  show_date boolean NOT NULL DEFAULT true,
  show_tags boolean NOT NULL DEFAULT true,
  show_comments boolean NOT NULL DEFAULT true,
  allow_comments text NOT NULL DEFAULT 'all' CHECK (allow_comments IN ('all','registered','none')),
  moderation_required boolean NOT NULL DEFAULT true,
  banned_words text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_settings TO authenticated;
GRANT SELECT ON public.blog_settings TO anon;
GRANT ALL ON public.blog_settings TO service_role;
ALTER TABLE public.blog_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blog_settings public read" ON public.blog_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "blog_settings manage" ON public.blog_settings FOR ALL TO authenticated
  USING (CASE WHEN store_id IS NULL THEN public.has_role(auth.uid(),'platform_admin') ELSE public.can_manage_store(store_id, auth.uid()) END)
  WITH CHECK (CASE WHEN store_id IS NULL THEN public.has_role(auth.uid(),'platform_admin') ELSE public.can_manage_store(store_id, auth.uid()) END);
CREATE TRIGGER blog_settings_updated BEFORE UPDATE ON public.blog_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Yorumlar
CREATE TABLE public.blog_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  post_id uuid NOT NULL,
  post_source text NOT NULL DEFAULT 'store' CHECK (post_source IN ('store','platform')),
  parent_id uuid REFERENCES public.blog_comments(id) ON DELETE CASCADE,
  author_name text NOT NULL CHECK (char_length(author_name) BETWEEN 2 AND 80),
  author_email text,
  user_id uuid,
  content text NOT NULL CHECK (char_length(content) BETWEEN 2 AND 2000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','spam','deleted')),
  like_count int NOT NULL DEFAULT 0,
  ip_hash text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX blog_comments_post_idx ON public.blog_comments(post_id, status, created_at);
CREATE INDEX blog_comments_store_idx ON public.blog_comments(store_id, status);
GRANT SELECT, UPDATE, DELETE ON public.blog_comments TO authenticated;
GRANT ALL ON public.blog_comments TO service_role;
ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blog_comments manage" ON public.blog_comments FOR ALL TO authenticated
  USING (CASE WHEN store_id IS NULL THEN public.has_role(auth.uid(),'platform_admin') ELSE public.can_manage_store(store_id, auth.uid()) END)
  WITH CHECK (CASE WHEN store_id IS NULL THEN public.has_role(auth.uid(),'platform_admin') ELSE public.can_manage_store(store_id, auth.uid()) END);
CREATE TRIGGER blog_comments_updated BEFORE UPDATE ON public.blog_comments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Revizyonlar
CREATE TABLE public.blog_post_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  post_id uuid NOT NULL,
  post_source text NOT NULL DEFAULT 'store' CHECK (post_source IN ('store','platform')),
  revision_number int NOT NULL,
  title text NOT NULL,
  body text,
  excerpt text,
  change_summary text,
  revised_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, revision_number)
);
GRANT SELECT, INSERT, DELETE ON public.blog_post_revisions TO authenticated;
GRANT ALL ON public.blog_post_revisions TO service_role;
ALTER TABLE public.blog_post_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blog_revisions manage" ON public.blog_post_revisions FOR ALL TO authenticated
  USING (CASE WHEN store_id IS NULL THEN public.has_role(auth.uid(),'platform_admin') ELSE public.can_manage_store(store_id, auth.uid()) END)
  WITH CHECK (CASE WHEN store_id IS NULL THEN public.has_role(auth.uid(),'platform_admin') ELSE public.can_manage_store(store_id, auth.uid()) END);

-- Beğeniler (oturum başına tek)
CREATE TABLE public.blog_post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  session_id text NOT NULL,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, session_id)
);
GRANT ALL ON public.blog_post_likes TO service_role;
ALTER TABLE public.blog_post_likes ENABLE ROW LEVEL SECURITY;

-- Görüntülenmeler (gün başına oturum tekil)
CREATE TABLE public.blog_post_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  post_id uuid NOT NULL,
  session_id text NOT NULL,
  referrer_url text,
  viewed_on date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, session_id, viewed_on)
);
GRANT SELECT ON public.blog_post_views TO authenticated;
GRANT ALL ON public.blog_post_views TO service_role;
ALTER TABLE public.blog_post_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blog_views read" ON public.blog_post_views FOR SELECT TO authenticated
  USING (CASE WHEN store_id IS NULL THEN public.has_role(auth.uid(),'platform_admin') ELSE public.can_manage_store(store_id, auth.uid()) END);

-- İlgili yazılar (elle)
CREATE TABLE public.blog_related_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  post_id uuid NOT NULL,
  related_post_id uuid NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, related_post_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_related_posts TO authenticated;
GRANT SELECT ON public.blog_related_posts TO anon;
GRANT ALL ON public.blog_related_posts TO service_role;
ALTER TABLE public.blog_related_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blog_related public read" ON public.blog_related_posts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "blog_related manage" ON public.blog_related_posts FOR ALL TO authenticated
  USING (CASE WHEN store_id IS NULL THEN public.has_role(auth.uid(),'platform_admin') ELSE public.can_manage_store(store_id, auth.uid()) END)
  WITH CHECK (CASE WHEN store_id IS NULL THEN public.has_role(auth.uid(),'platform_admin') ELSE public.can_manage_store(store_id, auth.uid()) END);

SELECT 1;