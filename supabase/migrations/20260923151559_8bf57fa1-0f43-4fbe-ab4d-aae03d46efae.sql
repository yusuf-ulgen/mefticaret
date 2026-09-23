CREATE TABLE public.kolay_phone_otps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX kolay_phone_otps_phone_idx ON public.kolay_phone_otps (phone, created_at DESC);
GRANT ALL ON public.kolay_phone_otps TO service_role;
ALTER TABLE public.kolay_phone_otps ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.kolay_cross_sell_partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  partner_store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  partner_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  headline TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, partner_store_id, partner_product_id)
);
CREATE INDEX kolay_cross_sell_store_idx ON public.kolay_cross_sell_partners (store_id, is_active);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kolay_cross_sell_partners TO authenticated;
GRANT SELECT ON public.kolay_cross_sell_partners TO anon;
GRANT ALL ON public.kolay_cross_sell_partners TO service_role;
ALTER TABLE public.kolay_cross_sell_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cross_sell_public_read" ON public.kolay_cross_sell_partners
  FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY "cross_sell_manage" ON public.kolay_cross_sell_partners
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE TABLE public.kolay_promo_settings (
  store_id UUID NOT NULL PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  bundle_enabled BOOLEAN NOT NULL DEFAULT false,
  bundle_min_quantity INTEGER NOT NULL DEFAULT 2,
  bundle_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 10,
  free_shipping_enabled BOOLEAN NOT NULL DEFAULT false,
  free_shipping_threshold NUMERIC(12,2) NOT NULL DEFAULT 250,
  cross_sell_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kolay_promo_settings TO authenticated;
GRANT SELECT ON public.kolay_promo_settings TO anon;
GRANT ALL ON public.kolay_promo_settings TO service_role;
ALTER TABLE public.kolay_promo_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promo_public_read" ON public.kolay_promo_settings
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "promo_manage" ON public.kolay_promo_settings
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE TABLE public.kolay_annual_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  occasion TEXT NOT NULL,
  remind_on DATE NOT NULL,
  message TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX kolay_reminders_store_idx ON public.kolay_annual_reminders (store_id, remind_on);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kolay_annual_reminders TO authenticated;
GRANT ALL ON public.kolay_annual_reminders TO service_role;
ALTER TABLE public.kolay_annual_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reminders_manage" ON public.kolay_annual_reminders
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE TABLE public.kolay_packaging_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'kutu',
  unit TEXT NOT NULL DEFAULT 'adet',
  pack_size INTEGER NOT NULL DEFAULT 1,
  list_price NUMERIC(12,2) NOT NULL,
  sale_price NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TRY',
  image_url TEXT,
  supplier_name TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kolay_packaging_items TO authenticated;
GRANT ALL ON public.kolay_packaging_items TO service_role;
ALTER TABLE public.kolay_packaging_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "packaging_items_read" ON public.kolay_packaging_items
  FOR SELECT TO authenticated USING (is_active);
CREATE POLICY "packaging_items_admin" ON public.kolay_packaging_items
  FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'::public.app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'::public.app_role));

CREATE TABLE public.kolay_packaging_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.kolay_packaging_items(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TRY',
  status TEXT NOT NULL DEFAULT 'pending',
  delivery_note TEXT,
  requested_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX kolay_packaging_orders_store_idx ON public.kolay_packaging_orders (store_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kolay_packaging_orders TO authenticated;
GRANT ALL ON public.kolay_packaging_orders TO service_role;
ALTER TABLE public.kolay_packaging_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "packaging_orders_manage" ON public.kolay_packaging_orders
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "packaging_orders_admin" ON public.kolay_packaging_orders
  FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'::public.app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'::public.app_role));

CREATE TABLE public.kolay_academy_lessons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'genel',
  duration_seconds INTEGER NOT NULL DEFAULT 60,
  video_url TEXT,
  thumbnail_url TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kolay_academy_lessons TO authenticated;
GRANT ALL ON public.kolay_academy_lessons TO service_role;
ALTER TABLE public.kolay_academy_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "academy_read" ON public.kolay_academy_lessons
  FOR SELECT TO authenticated USING (is_active);
CREATE POLICY "academy_admin" ON public.kolay_academy_lessons
  FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'::public.app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'::public.app_role));

CREATE TABLE public.kolay_receipt_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  detected_amount NUMERIC(12,2),
  detected_at TEXT,
  detected_sender TEXT,
  expected_amount NUMERIC(12,2),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX kolay_receipt_checks_store_idx ON public.kolay_receipt_checks (store_id, created_at DESC);
GRANT SELECT ON public.kolay_receipt_checks TO authenticated;
GRANT ALL ON public.kolay_receipt_checks TO service_role;
ALTER TABLE public.kolay_receipt_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "receipt_checks_read" ON public.kolay_receipt_checks
  FOR SELECT TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()));

INSERT INTO public.kolay_packaging_items (title, description, category, unit, pack_size, list_price, sale_price, supplier_name, sort_order) VALUES
('Kraft kutu 15x15 cm (50 adet)', 'Kurabiye ve tatlı için nefes alan kraft kutu.', 'kutu', 'paket', 50, 380, 289, 'Meft Ambalaj', 1),
('Vidalı cam kavanoz 250 ml (24 adet)', 'Reçel, turşu ve sos için sızdırmaz kapaklı kavanoz.', 'kavanoz', 'paket', 24, 520, 415, 'Meft Ambalaj', 2),
('Kargo poşeti 25x35 cm (100 adet)', 'Yapışkan bantlı, dayanıklı kargo poşeti.', 'kargo', 'paket', 100, 240, 179, 'Meft Ambalaj', 3),
('Balonlu naylon rulo 50 cm x 10 m', 'Kırılacak ürünler için koruma rulosu.', 'kargo', 'rulo', 1, 150, 119, 'Meft Ambalaj', 4),
('Kişiye özel etiket (500 adet)', 'Mağaza adınızla basılmış yuvarlak etiket.', 'etiket', 'paket', 500, 300, 235, 'Meft Baskı', 5),
('Kurdele ve ip seti', 'Doğal jüt ip ve saten kurdele karışık paket.', 'susleme', 'set', 1, 120, 89, 'Meft Baskı', 6);

INSERT INTO public.kolay_academy_lessons (title, description, category, duration_seconds, steps, sort_order) VALUES
('Telefonla ürün fotoğrafı', 'Pencere ışığı ve beyaz zeminle profesyonel görünen kare çekin.', 'fotograf', 60,
 '["Ürünü pencerenin yanına koy","Arkaya beyaz bir kağıt ya da havlu ger","Telefonu ürün hizasında tut, yakınlaştırma yapma","Tek kare çek, panelde arka planı temizlet"]'::jsonb, 1),
('Instagram hikâyesiyle satış', 'Tek hikâyede ürünü tanıtıp sipariş bağlantısı paylaşın.', 'instagram', 55,
 '["Hazırlık anından 5 saniyelik video çek","Fiyatı ve teslim gününü yaz","Mağaza bağlantını çıkartma olarak ekle","Hikâyeyi öne çıkanlara sabitle"]'::jsonb, 2),
('Ürün açıklaması yazma', 'Müşterinin sorduğu 3 soruyu baştan yanıtlayın.', 'satis', 50,
 '["İçindekileri yaz","Kaç kişilik veya kaç gram olduğunu belirt","Saklama koşulunu ekle","Teslim süresini net yaz"]'::jsonb, 3),
('Fiyatı doğru belirleme', 'Malzeme, emek, ambalaj ve kargo hesabı.', 'finans', 60,
 '["Malzeme tutarını yaz","Çalıştığın saati ücretlendir","Ambalaj ve kargoyu ekle","Üzerine en az yüzde 25 kâr koy"]'::jsonb, 4),
('Paketleme ve kargo', 'Ürün yolda bozulmasın.', 'kargo', 45,
 '["Kavanozu balonlu naylona sar","Kutuda boşluk bırakma","Kırılacak etiketi yapıştır","Kargoyu sabah teslim et"]'::jsonb, 5),
('Müşteriyi geri getirme', 'Tek seferlik alıcıyı düzenli müşteriye çevirin.', 'satis', 50,
 '["Teslimden 3 gün sonra mesaj at","Küçük bir indirim kodu ver","Özel günleri panelde hatırlatmaya ekle","Yorum isteyip paylaş"]'::jsonb, 6);