ALTER TABLE public.kolay_packaging_items ADD COLUMN IF NOT EXISTS in_stock boolean NOT NULL DEFAULT true;

CREATE TABLE public.kolay_category_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  main_name text NOT NULL CHECK (char_length(main_name) BETWEEN 2 AND 38),
  sub_name text NOT NULL CHECK (char_length(sub_name) BETWEEN 2 AND 38),
  keywords text[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (main_name, sub_name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kolay_category_rules TO authenticated;
GRANT ALL ON public.kolay_category_rules TO service_role;
ALTER TABLE public.kolay_category_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY category_rules_read ON public.kolay_category_rules FOR SELECT TO authenticated USING (is_active OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY category_rules_admin ON public.kolay_category_rules FOR ALL TO authenticated USING (app_private.has_role(auth.uid(), 'platform_admin')) WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER kolay_category_rules_updated BEFORE UPDATE ON public.kolay_category_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.kolay_system_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('whatsapp','thank_you')),
  label text NOT NULL CHECK (char_length(label) BETWEEN 2 AND 60),
  body text NOT NULL CHECK (char_length(body) BETWEEN 2 AND 600),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kolay_system_templates TO authenticated;
GRANT ALL ON public.kolay_system_templates TO service_role;
ALTER TABLE public.kolay_system_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY system_templates_read ON public.kolay_system_templates FOR SELECT TO authenticated USING (is_active OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY system_templates_admin ON public.kolay_system_templates FOR ALL TO authenticated USING (app_private.has_role(auth.uid(), 'platform_admin')) WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER kolay_system_templates_updated BEFORE UPDATE ON public.kolay_system_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.kolay_category_rules (main_name, sub_name, keywords, sort_order) VALUES
('El Emeği Örgü & Tekstil','Bebek Patiği','{patik,bebek patiği,bebek çorabı,örgü}',10),
('El Emeği Örgü & Tekstil','Amigurumi','{amigurumi,oyuncak,ayıcık,tavşan,örgü}',11),
('El Emeği Örgü & Tekstil','Dantel','{dantel,tığ,sehpa örtüsü,örtü,örgü}',12),
('El Emeği Örgü & Tekstil','Nakış','{nakış,işleme,kanaviçe,etamin}',13),
('El Emeği Örgü & Tekstil','Kazak & Hırka','{kazak,hırka,yelek,atkı,bere,şal,örgü}',14),
('Ev Yapımı Gıda','Mantı, Erişte & Tarhana','{mantı,erişte,tarhana,kuskus,makarna}',20),
('Ev Yapımı Gıda','Reçel & Salça','{reçel,salça,marmelat,pekmez,bal}',21),
('Ev Yapımı Gıda','Baklava & Börek','{baklava,börek,yufka,gözleme,poğaça,kurabiye,kek,pasta}',22),
('Ev Yapımı Gıda','Turşu','{turşu,konserve,kış hazırlığı}',23),
('Takı & Aksesuar','İğne Oyası','{oya,iğne oyası,yazma,tülbent}',30),
('Takı & Aksesuar','Doğal Taş','{doğal taş,kolye,bileklik,küpe}',31),
('Takı & Aksesuar','Örgü Çanta','{çanta,örgü çanta,cüzdan}',32),
('Takı & Aksesuar','Toka','{toka,saç bandı,taç}',33),
('Ev Dekorasyon','Kokulu Taş','{kokulu taş,oda kokusu}',40),
('Ev Dekorasyon','Mum','{mum,soya mum}',41),
('Ev Dekorasyon','Makrome','{makrome,duvar süsü,saksı askısı}',42),
('Ev Dekorasyon','Epoksi','{epoksi,reçine,tepsi,bardak altlığı}',43),
('Özel Gün & Çeyiz','Nikah Şekeri','{nikah şekeri,nikah,nişan şekeri}',50),
('Özel Gün & Çeyiz','Bebek Mevlüdü','{mevlüt,mevlit,diş buğdayı,bebek şekeri}',51),
('Özel Gün & Çeyiz','Kına Çeyizi','{kına,çeyiz,bohça,havlu}',52);

INSERT INTO public.kolay_system_templates (kind, label, body, sort_order) VALUES
('whatsapp','Hoş Geldin Mesajı','{selam} 🌸 {magaza}''a hoş geldiniz! Tüm ürünlerimi buradan görebilirsiniz: {link} Sorunuz olursa yazmanız yeterli.',1),
('whatsapp','Kargo Kodu Gönderimi','{selam} 📦 Siparişiniz yola çıktı! Kargo takip kodunuz: {kargo}. Güzel günlerde kullanın 💛 — {magaza}',2),
('whatsapp','Özel Sipariş Detayı','{selam} 👩‍🍳 Özel siparişinizin detayları: {detay}. Onaylarsanız hemen hazırlamaya başlıyorum. — {magaza}',3),
('thank_you','Samimi Teşekkür','Beni tercih ettiğiniz için çok teşekkür ederim! Afiyet olsun 💛',1),
('thank_you','El Emeği','Bu ürün evimde, sevgiyle ve el emeğiyle hazırlandı. Güzel günlerde kullanın 🌸',2);