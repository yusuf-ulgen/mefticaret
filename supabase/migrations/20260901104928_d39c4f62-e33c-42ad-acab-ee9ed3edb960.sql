ALTER TABLE public.store_themes
  ADD COLUMN IF NOT EXISTS custom_css text,
  ADD COLUMN IF NOT EXISTS custom_js text;

CREATE TABLE IF NOT EXISTS public.store_theme_sections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'header','footer','hero','banner','announcement_bar','product_grid','product_slider',
    'category_grid','image_text','testimonials','faq','blog','newsletter','custom_html'
  )),
  position integer NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT true,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS store_theme_sections_store_pos_idx
  ON public.store_theme_sections (store_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_theme_sections TO authenticated;
GRANT SELECT ON public.store_theme_sections TO anon;
GRANT ALL ON public.store_theme_sections TO service_role;

ALTER TABLE public.store_theme_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "theme_sections_read_members" ON public.store_theme_sections
  FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));

CREATE POLICY "theme_sections_write_managers" ON public.store_theme_sections
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "theme_sections_read_public" ON public.store_theme_sections
  FOR SELECT TO anon
  USING (is_enabled AND app_private.is_store_published(store_id));

CREATE TRIGGER store_theme_sections_updated_at
  BEFORE UPDATE ON public.store_theme_sections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();