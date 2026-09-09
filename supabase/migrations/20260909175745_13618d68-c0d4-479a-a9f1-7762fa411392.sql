ALTER TABLE public.platform_posts
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS canonical_url text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';

UPDATE public.platform_posts SET status = CASE WHEN is_published THEN 'published' ELSE 'draft' END;

CREATE OR REPLACE FUNCTION public.platform_posts_sync_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'published', 'archived') THEN
    RAISE EXCEPTION 'Geçersiz durum: %', NEW.status;
  END IF;
  NEW.is_published := (NEW.status = 'published');
  IF NEW.is_published AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;
  IF NOT NEW.is_published THEN
    NEW.published_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS platform_posts_sync_status ON public.platform_posts;
CREATE TRIGGER platform_posts_sync_status
BEFORE INSERT OR UPDATE ON public.platform_posts
FOR EACH ROW EXECUTE FUNCTION public.platform_posts_sync_status();