-- 1) Tema kataloğu (platform yönetimi)
CREATE TABLE IF NOT EXISTS public.themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  version text NOT NULL DEFAULT '1.0.0',
  author text NOT NULL DEFAULT 'Mefticaret',
  preview_image text,
  description text NOT NULL DEFAULT '',
  tagline text NOT NULL DEFAULT '',
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  template_code text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  price_note text NOT NULL DEFAULT '',
  is_featured boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.themes TO anon;
GRANT SELECT ON public.themes TO authenticated;
GRANT ALL ON public.themes TO service_role;

ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "themes_public_read_active" ON public.themes
  FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "themes_platform_admin_all" ON public.themes
  FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'));

CREATE TRIGGER set_themes_updated_at BEFORE UPDATE ON public.themes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Mağazaya kurulu temalar
CREATE TABLE IF NOT EXISTS public.store_installed_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  theme_id uuid NOT NULL REFERENCES public.themes(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT false,
  installed_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  installed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, theme_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS store_installed_themes_one_active_idx
  ON public.store_installed_themes (store_id) WHERE is_active;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_installed_themes TO authenticated;
GRANT ALL ON public.store_installed_themes TO service_role;

ALTER TABLE public.store_installed_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store_installed_themes_manage" ON public.store_installed_themes
  FOR ALL TO authenticated
  USING (
    app_private.can_manage_store(store_id, auth.uid())
    OR app_private.has_role(auth.uid(), 'platform_admin')
  )
  WITH CHECK (
    app_private.can_manage_store(store_id, auth.uid())
    OR app_private.has_role(auth.uid(), 'platform_admin')
  );

CREATE TRIGGER set_store_installed_themes_updated_at BEFORE UPDATE ON public.store_installed_themes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Ücretli tema lisans satın alımları
CREATE TABLE IF NOT EXISTS public.store_theme_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  theme_id uuid NOT NULL REFERENCES public.themes(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  transaction_id uuid,
  paid_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS store_theme_purchases_store_idx
  ON public.store_theme_purchases (store_id, theme_id, status);

GRANT SELECT ON public.store_theme_purchases TO authenticated;
GRANT ALL ON public.store_theme_purchases TO service_role;

ALTER TABLE public.store_theme_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store_theme_purchases_read" ON public.store_theme_purchases
  FOR SELECT TO authenticated
  USING (
    app_private.can_manage_store(store_id, auth.uid())
    OR app_private.has_role(auth.uid(), 'platform_admin')
  );

CREATE TRIGGER set_store_theme_purchases_updated_at BEFORE UPDATE ON public.store_theme_purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Katalog: mevcut tema şablonları
INSERT INTO public.themes (slug, name, template_code, version, author, tagline, description, price, price_note, is_featured, sort_order)
VALUES
  ('mef-ultra', 'Mef-Ultra', 'mef-ultra', '1.0.0', 'Mefticaret', 'Mefticaret mağazalarına özel', 'Mefticaret mağazaları için hazırlanmış varsayılan tema.', 0, 'Ücretsiz · Mefticaret mağazalarına özel', true, 1),
  ('horizon-minimal', 'Horizon', 'horizon-minimal', '1.0.0', 'Mefticaret', 'Minimal ve hızlı', 'Sade, hızlı yüklenen minimal mağaza teması.', 0, 'Ücretsiz · sınırsız mağaza', true, 2),
  ('be-yours', 'Be Yours', 'be-yours', '1.0.0', 'Mefticaret', 'Minimal editorial', 'Beyaz zeminli, ortalanmış tipografili minimal mağaza teması.', 0, 'Ücretsiz', false, 3),
  ('atelier-mode', 'Atelier Mode', 'atelier-mode', '1.0.0', 'Mefticaret', 'Moda ve butik', 'Moda ve butik mağazalar için görsel ağırlıklı tema.', 0, 'Ücretsiz', false, 4),
  ('empire-digital', 'Empire', 'empire-digital', '1.0.0', 'Mefticaret', 'Dijital ürün ve abonelik', 'Dijital ürün satışı için dönüşüm odaklı tema.', 1990, 'Tek seferlik lisans · ömür boyu güncelleme', true, 5),
  ('wokiee-mega', 'Wokiee', 'wokiee-mega', '1.0.0', 'Mefticaret', 'Çok kategorili mega mağaza', 'Geniş kataloglu mağazalar için mega menülü tema.', 2490, 'Tek seferlik lisans · ömür boyu güncelleme', true, 6)
ON CONFLICT (slug) DO NOTHING;