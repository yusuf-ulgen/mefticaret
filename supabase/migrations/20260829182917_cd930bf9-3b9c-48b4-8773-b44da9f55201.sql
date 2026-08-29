CREATE TABLE public.store_themes (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  preset text NOT NULL DEFAULT 'ink-saffron',
  primary_color text NOT NULL DEFAULT '#1f2933',
  accent_color text NOT NULL DEFAULT '#e0a136',
  background_color text NOT NULL DEFAULT '#fbf9f5',
  font_pair text NOT NULL DEFAULT 'sora-manrope',
  radius numeric NOT NULL DEFAULT 0.75,
  layout text NOT NULL DEFAULT 'hero-grid',
  hero_title text NOT NULL DEFAULT 'Yeni sezon burada',
  hero_subtitle text NOT NULL DEFAULT 'Seçkin parçalar, hızlı teslimat, güvenli ödeme.',
  hero_cta_label text NOT NULL DEFAULT 'Koleksiyonu keşfet',
  announcement text,
  show_announcement boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_themes TO authenticated;
GRANT SELECT ON public.store_themes TO anon;
GRANT ALL ON public.store_themes TO service_role;

ALTER TABLE public.store_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store members read theme" ON public.store_themes
  FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));

CREATE POLICY "Visitors read published themes" ON public.store_themes
  FOR SELECT TO anon
  USING (is_published);

CREATE POLICY "Store managers write theme" ON public.store_themes
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE TRIGGER store_themes_set_updated_at
  BEFORE UPDATE ON public.store_themes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.store_themes (store_id, is_published, published_at, announcement, show_announcement)
SELECT id, true, now(), '500 TL üzeri kargo bedava', true FROM public.stores WHERE is_demo
ON CONFLICT (store_id) DO NOTHING;