CREATE TABLE public.platform_post_redirects (
  old_slug text PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES public.platform_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_post_redirects ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.platform_post_redirects TO anon,authenticated;
GRANT ALL ON public.platform_post_redirects TO service_role;
CREATE POLICY post_redirect_public ON public.platform_post_redirects FOR SELECT TO anon,authenticated USING(EXISTS(SELECT 1 FROM public.platform_posts p WHERE p.id=post_id AND p.is_published));
CREATE OR REPLACE FUNCTION public.preserve_platform_post_slug() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF OLD.slug IS DISTINCT FROM NEW.slug THEN
    INSERT INTO public.platform_post_redirects(old_slug,post_id) VALUES(OLD.slug,NEW.id)
    ON CONFLICT(old_slug) DO UPDATE SET post_id=EXCLUDED.post_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER platform_post_slug_history AFTER UPDATE OF slug ON public.platform_posts FOR EACH ROW EXECUTE FUNCTION public.preserve_platform_post_slug();
