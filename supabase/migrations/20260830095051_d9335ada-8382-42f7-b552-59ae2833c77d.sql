CREATE TABLE public.store_pages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  excerpt text,
  body text NOT NULL DEFAULT '',
  seo_description text,
  is_published boolean NOT NULL DEFAULT false,
  show_in_footer boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX store_pages_store_slug_key ON public.store_pages(store_id, slug);
CREATE INDEX store_pages_store_idx ON public.store_pages(store_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_pages TO authenticated;
GRANT SELECT ON public.store_pages TO anon;
GRANT ALL ON public.store_pages TO service_role;

ALTER TABLE public.store_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY store_pages_read ON public.store_pages FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));

CREATE POLICY store_pages_write ON public.store_pages FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY store_pages_select_public ON public.store_pages FOR SELECT TO anon
  USING (is_published AND app_private.is_store_published(store_id));

CREATE TRIGGER store_pages_set_updated_at BEFORE UPDATE ON public.store_pages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();