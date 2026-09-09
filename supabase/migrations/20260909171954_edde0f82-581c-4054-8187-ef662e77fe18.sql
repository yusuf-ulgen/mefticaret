CREATE TABLE public.platform_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  body TEXT NOT NULL DEFAULT '',
  cover_url TEXT,
  seo_description TEXT,
  author_name TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_published BOOLEAN NOT NULL DEFAULT false,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_posts TO authenticated;
GRANT ALL ON public.platform_posts TO service_role;

ALTER TABLE public.platform_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published platform posts are public"
ON public.platform_posts FOR SELECT
USING (is_published = true);

CREATE POLICY "Platform admins read all posts"
ON public.platform_posts FOR SELECT TO authenticated
USING (app_private.has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Platform admins manage posts"
ON public.platform_posts FOR ALL TO authenticated
USING (app_private.has_role(auth.uid(), 'platform_admin'::app_role))
WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'::app_role));

CREATE TRIGGER platform_posts_set_updated_at
BEFORE UPDATE ON public.platform_posts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX platform_posts_published_idx ON public.platform_posts (is_published, published_at DESC);

INSERT INTO public.platform_posts (title, slug, excerpt, body, author_name, tags, is_published, is_featured, published_at, sort_order)
VALUES
  ('E-ticarete başlarken bilmeniz gereken 7 adım', 'e-ticarete-baslarken-7-adim', 'Mağaza kurulumundan ilk siparişe kadar pratik bir yol haritası.', 'E-ticarette başarı, doğru altyapı ve net bir plan ile başlar. Bu yazıda mağaza kurulumundan ödeme ve kargo entegrasyonlarına kadar 7 temel adımı özetliyoruz.', 'Mefticaret Ekibi', ARRAY['e-ticaret','rehber'], true, true, now(), 0),
  ('Pazaryeri entegrasyonu ile satışları büyütmek', 'pazaryeri-entegrasyonu-ile-buyume', 'Tek panelden çoklu pazaryeri yönetiminin avantajları.', 'Ürünlerinizi tek panelden birden fazla pazaryerinde yönetmek, stok hatalarını azaltır ve satış hacmini artırır. Mefticaret entegrasyonları ile fiyat, stok ve sipariş akışını otomatikleştirin.', 'Mefticaret Ekibi', ARRAY['pazaryeri','büyüme'], true, false, now(), 1);