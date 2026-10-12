INSERT INTO public.store_themes (
  store_id,
  preset,
  primary_color,
  accent_color,
  background_color,
  font_pair,
  radius,
  layout,
  hero_title,
  hero_subtitle,
  hero_cta_label,
  announcement,
  show_announcement,
  is_published,
  published_at
)
SELECT
  s.id,
  'home-maker-shop',
  '#11162f',
  '#6d28d9',
  '#ffffff',
  'sora-manrope',
  0.75,
  'card-grid',
  s.name,
  COALESCE(NULLIF(h.category, ''), 'El emeği') || ' ürünleri',
  'Ürünleri incele',
  NULL,
  false,
  true,
  now()
FROM public.home_maker_profiles h
JOIN public.stores s ON s.id = h.store_id
WHERE h.panel_mode = 'micro'
ON CONFLICT (store_id) DO UPDATE SET
  preset = EXCLUDED.preset,
  is_published = true,
  published_at = COALESCE(public.store_themes.published_at, now()),
  updated_at = now();

UPDATE public.stores s
SET status = 'active',
    published_at = COALESCE(s.published_at, now()),
    onboarding_completed = true,
    updated_at = now()
FROM public.home_maker_profiles h
WHERE h.store_id = s.id
  AND h.panel_mode = 'micro';