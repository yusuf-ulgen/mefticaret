CREATE TABLE public.v2_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('active','draft','archived')),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
CREATE UNIQUE INDEX v2_themes_one_active ON public.v2_themes(store_id) WHERE status = 'active';
CREATE INDEX v2_themes_store ON public.v2_themes(store_id);

CREATE TABLE public.v2_theme_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id uuid NOT NULL REFERENCES public.v2_themes(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  page_type text NOT NULL CHECK (page_type IN ('home','product','collection','cart','checkout','blog','article','custom')),
  custom_handle text CHECK (custom_handle IS NULL OR custom_handle ~ '^[a-z0-9-]{1,80}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX v2_theme_pages_unique ON public.v2_theme_pages(theme_id, page_type, coalesce(custom_handle, ''));

CREATE TABLE public.v2_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_page_id uuid NOT NULL REFERENCES public.v2_theme_pages(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  section_type text NOT NULL CHECK (section_type IN ('hero','featured_products','banner','announcement','testimonials','blog_posts','image_with_text','video','custom_html','newsletter','collection_list','rich_text')),
  position integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX v2_sections_page ON public.v2_sections(theme_page_id, position);

CREATE TABLE public.v2_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.v2_sections(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  block_type text NOT NULL CHECK (block_type IN ('heading','paragraph','button','image','video','product_card','collection_card','icon','divider','spacer','custom_html','countdown','badge','review_stars')),
  position integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX v2_blocks_section ON public.v2_blocks(section_id, position);

CREATE TABLE public.v2_theme_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  preview_image_url text,
  structure jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_official boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.v2_themes, public.v2_theme_pages, public.v2_sections, public.v2_blocks TO authenticated;
GRANT SELECT ON public.v2_themes TO anon;
GRANT SELECT ON public.v2_theme_presets TO anon, authenticated;
GRANT ALL ON public.v2_themes, public.v2_theme_pages, public.v2_sections, public.v2_blocks, public.v2_theme_presets TO service_role;

ALTER TABLE public.v2_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_theme_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_theme_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read v2 themes" ON public.v2_themes FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "Visitors read active v2 theme" ON public.v2_themes FOR SELECT TO anon, authenticated USING (status = 'active' AND published_snapshot IS NOT NULL);
CREATE POLICY "Managers write v2 themes" ON public.v2_themes FOR ALL TO authenticated USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "Members read v2 pages" ON public.v2_theme_pages FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "Managers write v2 pages" ON public.v2_theme_pages FOR ALL TO authenticated USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) AND EXISTS (SELECT 1 FROM public.v2_themes t WHERE t.id = theme_id AND t.store_id = v2_theme_pages.store_id));

CREATE POLICY "Members read v2 sections" ON public.v2_sections FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "Managers write v2 sections" ON public.v2_sections FOR ALL TO authenticated USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) AND EXISTS (SELECT 1 FROM public.v2_theme_pages p WHERE p.id = theme_page_id AND p.store_id = v2_sections.store_id));

CREATE POLICY "Members read v2 blocks" ON public.v2_blocks FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "Managers write v2 blocks" ON public.v2_blocks FOR ALL TO authenticated USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) AND EXISTS (SELECT 1 FROM public.v2_sections s WHERE s.id = section_id AND s.store_id = v2_blocks.store_id));

CREATE POLICY "Anyone reads presets" ON public.v2_theme_presets FOR SELECT TO anon, authenticated USING (true);

CREATE TRIGGER v2_themes_updated BEFORE UPDATE ON public.v2_themes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER v2_pages_updated BEFORE UPDATE ON public.v2_theme_pages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER v2_sections_updated BEFORE UPDATE ON public.v2_sections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER v2_blocks_updated BEFORE UPDATE ON public.v2_blocks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.v2_theme_presets (name, structure) VALUES
('Minimal', '{"settings":{"color_primary":"#111111","color_secondary":"#6b7280","color_background":"#ffffff","color_text":"#111111","color_error":"#dc2626","color_success":"#16a34a","font_heading":"Inter","font_body":"Inter","button_radius":999,"section_padding":64},"pages":{"home":[{"type":"hero","settings":{"height":"medium","background_type":"color","content_position":"center"},"blocks":[{"type":"heading","settings":{"text":"Sade ve zamansız","tag":"h1"}},{"type":"paragraph","settings":{"text":"Yeni sezon koleksiyonu"}},{"type":"button","settings":{"text":"Alışverişe başla","link_url":"/collections"}}]},{"type":"featured_products","settings":{"title":"Öne çıkanlar","products_count":4,"columns":4},"blocks":[]},{"type":"newsletter","settings":{"title":"Bültene katıl"},"blocks":[]}]}}'),
('Bold', '{"settings":{"color_primary":"#facc15","color_secondary":"#f97316","color_background":"#0a0a0a","color_text":"#fafafa","color_error":"#ef4444","color_success":"#22c55e","font_heading":"Archivo Black","font_body":"Inter","button_radius":4,"h1_size":64,"section_padding":80},"pages":{"home":[{"type":"announcement","settings":{"text":"Tüm siparişlerde ücretsiz kargo"},"blocks":[]},{"type":"hero","settings":{"height":"large","background_type":"color","content_position":"left"},"blocks":[{"type":"heading","settings":{"text":"CESUR. GÜÇLÜ. SENİN.","tag":"h1"}},{"type":"button","settings":{"text":"Keşfet","link_url":"/collections"}}]},{"type":"featured_products","settings":{"title":"En çok satanlar","products_count":8,"columns":4},"blocks":[]}]}}'),
('Boutique', '{"settings":{"color_primary":"#b76e79","color_secondary":"#e8d5c4","color_background":"#fdf8f4","color_text":"#3d2c2e","color_error":"#b91c1c","color_success":"#15803d","font_heading":"Playfair Display","font_body":"Lora","button_radius":2,"section_padding":72},"pages":{"home":[{"type":"hero","settings":{"height":"large","background_type":"color","content_position":"center"},"blocks":[{"type":"heading","settings":{"text":"El yapımı zarafet","tag":"h1"}},{"type":"paragraph","settings":{"text":"Özenle seçilmiş parçalar"}},{"type":"button","settings":{"text":"Koleksiyonu gör","style":"outline"}}]},{"type":"image_with_text","settings":{"image_position":"left"},"blocks":[{"type":"heading","settings":{"text":"Hikâyemiz","tag":"h2"}},{"type":"paragraph","settings":{"text":"Her ürün sevgiyle hazırlanır."}}]},{"type":"testimonials","settings":{"title":"Müşterilerimiz"},"blocks":[]}]}}'),
('Tech', '{"settings":{"color_primary":"#3b82f6","color_secondary":"#22d3ee","color_background":"#0b1220","color_text":"#e2e8f0","color_error":"#f87171","color_success":"#34d399","font_heading":"Space Grotesk","font_body":"Inter","button_radius":10,"section_padding":64},"pages":{"home":[{"type":"hero","settings":{"height":"medium","background_type":"color","content_position":"left"},"blocks":[{"type":"badge","settings":{"text":"YENİ"}},{"type":"heading","settings":{"text":"Geleceğin teknolojisi","tag":"h1"}},{"type":"button","settings":{"text":"Ürünleri incele"}}]},{"type":"featured_products","settings":{"title":"Yeni gelenler","products_count":6,"columns":3},"blocks":[]},{"type":"collection_list","settings":{"title":"Kategoriler","columns":4},"blocks":[]}]}}'),
('Nature', '{"settings":{"color_primary":"#3f6212","color_secondary":"#a3b18a","color_background":"#f6f5ee","color_text":"#283618","color_error":"#b91c1c","color_success":"#4d7c0f","font_heading":"Fraunces","font_body":"Nunito","button_radius":16,"section_padding":64},"pages":{"home":[{"type":"hero","settings":{"height":"large","background_type":"color","content_position":"center"},"blocks":[{"type":"heading","settings":{"text":"Doğadan sofranıza","tag":"h1"}},{"type":"paragraph","settings":{"text":"Organik ve yerel ürünler"}},{"type":"button","settings":{"text":"Alışverişe başla"}}]},{"type":"featured_products","settings":{"title":"Mevsimin ürünleri","products_count":4,"columns":4},"blocks":[]},{"type":"rich_text","settings":{},"blocks":[{"type":"heading","settings":{"text":"Sürdürülebilir üretim","tag":"h2"}},{"type":"paragraph","settings":{"text":"Toprağa saygılı, katkısız."}}]}]}}');

INSERT INTO public.plan_features (plan_id, metric_key, label, unit, limit_value, is_enabled, sort_order)
SELECT p.id, f.key, f.label, NULL, NULL, false, f.sort
FROM public.plans p
CROSS JOIN (VALUES ('v2_theme_editor','Tema editörü v2',320),('v2_theme_presets','Tema presetleri',321),('v2_custom_html','Özel HTML bloğu',322)) AS f(key,label,sort)
WHERE NOT EXISTS (SELECT 1 FROM public.plan_features pf WHERE pf.plan_id = p.id AND pf.metric_key = f.key);