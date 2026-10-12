-- Katalog çekirdeği: koleksiyonlar, ürünler, varyantlar, görseller
CREATE TYPE public.product_status AS ENUM ('draft','active','archived');

CREATE TABLE public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, slug)
);

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  status public.product_status NOT NULL DEFAULT 'draft',
  vendor TEXT,
  product_type TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  base_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  compare_at_price NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'TRY',
  track_inventory BOOLEAN NOT NULL DEFAULT true,
  seo JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, slug)
);
CREATE INDEX products_store_status_idx ON public.products (store_id, status, created_at DESC);

CREATE TABLE public.product_collections (
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, collection_id)
);

CREATE TABLE public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Standart',
  sku TEXT,
  barcode TEXT,
  options JSONB NOT NULL DEFAULT '{}'::jsonb,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost_price NUMERIC(12,2),
  stock INT NOT NULL DEFAULT 0,
  weight_grams INT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, sku)
);
CREATE INDEX product_variants_product_idx ON public.product_variants (product_id, position);

CREATE TABLE public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt TEXT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_collections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT ALL ON public.collections, public.products, public.product_collections, public.product_variants, public.product_images TO service_role;

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "collections_read" ON public.collections FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "collections_write" ON public.collections FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "products_read" ON public.products FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "products_write" ON public.products FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "product_variants_read" ON public.product_variants FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "product_variants_write" ON public.product_variants FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "product_images_read" ON public.product_images FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "product_images_write" ON public.product_images FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "product_collections_read" ON public.product_collections FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND app_private.is_store_member(p.store_id, auth.uid())));
CREATE POLICY "product_collections_write" ON public.product_collections FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND app_private.can_manage_store(p.store_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND app_private.can_manage_store(p.store_id, auth.uid())));

CREATE TRIGGER collections_updated_at BEFORE UPDATE ON public.collections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER product_variants_updated_at BEFORE UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Demo katalog (Atlas Moda)
INSERT INTO public.collections (id, store_id, title, slug, description, sort_order) VALUES
 ('22222222-0000-4000-8000-000000000001','11111111-1111-1111-1111-111111111111','Yeni Sezon','yeni-sezon','Sonbahar/Kış kapsül koleksiyonu',1),
 ('22222222-0000-4000-8000-000000000002','11111111-1111-1111-1111-111111111111','Temel Parçalar','temel-parcalar','Her gardıropta olması gereken ürünler',2);

INSERT INTO public.products (id, store_id, title, slug, description, status, vendor, product_type, tags, base_price, compare_at_price, currency) VALUES
 ('33333333-0000-4000-8000-000000000001','11111111-1111-1111-1111-111111111111','Atlas Oversize Trençkot','atlas-oversize-trenckot','Su itici kumaş, çift sıra düğme.','active','Atlas Moda','Dış giyim','{"trençkot","yeni sezon"}',3490.00,3990.00,'TRY'),
 ('33333333-0000-4000-8000-000000000002','11111111-1111-1111-1111-111111111111','Merino Yün Triko','merino-yun-triko','%100 merino yün, bisiklet yaka.','active','Atlas Moda','Triko','{"triko","temel"}',1290.00,NULL,'TRY'),
 ('33333333-0000-4000-8000-000000000003','11111111-1111-1111-1111-111111111111','Yüksek Bel Straight Jean','yuksek-bel-straight-jean','Rijit denim, ayak bileği boy.','active','Atlas Moda','Denim','{"jean","temel"}',1590.00,1890.00,'TRY'),
 ('33333333-0000-4000-8000-000000000004','11111111-1111-1111-1111-111111111111','Saten Midi Elbise','saten-midi-elbise','Askılı, biyeli saten elbise.','draft','Atlas Moda','Elbise','{"elbise"}',2190.00,NULL,'TRY');

INSERT INTO public.product_collections (product_id, collection_id) VALUES
 ('33333333-0000-4000-8000-000000000001','22222222-0000-4000-8000-000000000001'),
 ('33333333-0000-4000-8000-000000000004','22222222-0000-4000-8000-000000000001'),
 ('33333333-0000-4000-8000-000000000002','22222222-0000-4000-8000-000000000002'),
 ('33333333-0000-4000-8000-000000000003','22222222-0000-4000-8000-000000000002');

INSERT INTO public.product_variants (product_id, store_id, title, sku, options, price, cost_price, stock, position) VALUES
 ('33333333-0000-4000-8000-000000000001','11111111-1111-1111-1111-111111111111','Bej / S','ATL-TRN-BEJ-S','{"Renk":"Bej","Beden":"S"}',3490.00,1450.00,12,1),
 ('33333333-0000-4000-8000-000000000001','11111111-1111-1111-1111-111111111111','Bej / M','ATL-TRN-BEJ-M','{"Renk":"Bej","Beden":"M"}',3490.00,1450.00,8,2),
 ('33333333-0000-4000-8000-000000000001','11111111-1111-1111-1111-111111111111','Siyah / M','ATL-TRN-SYH-M','{"Renk":"Siyah","Beden":"M"}',3490.00,1450.00,4,3),
 ('33333333-0000-4000-8000-000000000002','11111111-1111-1111-1111-111111111111','Krem / M','ATL-TRK-KRM-M','{"Renk":"Krem","Beden":"M"}',1290.00,520.00,26,1),
 ('33333333-0000-4000-8000-000000000002','11111111-1111-1111-1111-111111111111','Antrasit / L','ATL-TRK-ANT-L','{"Renk":"Antrasit","Beden":"L"}',1290.00,520.00,18,2),
 ('33333333-0000-4000-8000-000000000003','11111111-1111-1111-1111-111111111111','Mavi / 27','ATL-JN-MAV-27','{"Renk":"Mavi","Beden":"27"}',1590.00,610.00,9,1),
 ('33333333-0000-4000-8000-000000000003','11111111-1111-1111-1111-111111111111','Mavi / 29','ATL-JN-MAV-29','{"Renk":"Mavi","Beden":"29"}',1590.00,610.00,2,2),
 ('33333333-0000-4000-8000-000000000004','11111111-1111-1111-1111-111111111111','Zümrüt / S','ATL-ELB-ZMR-S','{"Renk":"Zümrüt","Beden":"S"}',2190.00,780.00,0,1);
