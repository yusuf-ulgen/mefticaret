CREATE TABLE public.platform_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  excerpt text,
  body text NOT NULL DEFAULT '',
  seo_description text,
  is_published boolean NOT NULL DEFAULT true,
  show_in_footer boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_pages TO authenticated;
GRANT ALL ON public.platform_pages TO service_role;

ALTER TABLE public.platform_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published platform pages"
ON public.platform_pages FOR SELECT
TO anon, authenticated
USING (is_published = true OR app_private.has_role(auth.uid(), 'platform_admin'::public.app_role));

CREATE POLICY "Platform admins manage platform pages"
ON public.platform_pages FOR ALL
TO authenticated
USING (app_private.has_role(auth.uid(), 'platform_admin'::public.app_role))
WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'::public.app_role));

CREATE TRIGGER platform_pages_set_updated_at
BEFORE UPDATE ON public.platform_pages
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX platform_pages_published_idx ON public.platform_pages (is_published, sort_order);

INSERT INTO public.platform_pages (title, slug, excerpt, body, seo_description, sort_order) VALUES
('Hakkımızda', 'hakkimizda', 'Mefticaret platformu hakkında.', 'Mefticaret, satıcıların kendi çevrim içi mağazasını kurup yönetmesini sağlayan Türkiye merkezli bir e-ticaret altyapısıdır.', 'Mefticaret e-ticaret altyapısı hakkında bilgi.', 1),
('Gizlilik Politikası', 'gizlilik-politikasi', 'Kişisel verilerin işlenmesi.', 'Kişisel verileriniz yalnızca hizmetin sunulması amacıyla, KVKK kapsamında işlenir.', 'Mefticaret gizlilik politikası ve KVKK bilgilendirmesi.', 2),
('Hizmet Şartları', 'hizmet-sartlari', 'Üyelik ve kullanım koşulları.', 'Mefticaret hizmetlerini kullanan tüm satıcılar bu şartları kabul etmiş sayılır.', 'Mefticaret hizmet kullanım şartları.', 3);