CREATE TABLE public.site_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text NOT NULL UNIQUE,
  kind text NOT NULL,
  eyebrow text,
  title text,
  subtitle text,
  primary_label text,
  primary_href text,
  secondary_label text,
  secondary_href text,
  badge text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX site_sections_order_idx ON public.site_sections (sort_order, section_key);

GRANT SELECT ON public.site_sections TO anon;
GRANT SELECT ON public.site_sections TO authenticated;
GRANT ALL ON public.site_sections TO service_role;

ALTER TABLE public.site_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_sections_public_read" ON public.site_sections
  FOR SELECT TO anon, authenticated USING (is_enabled = true);

CREATE POLICY "site_sections_admin_read" ON public.site_sections
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'platform_admin')
  );

CREATE POLICY "site_sections_admin_write" ON public.site_sections
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'platform_admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'platform_admin')
  );

CREATE OR REPLACE FUNCTION public.site_sections_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER site_sections_updated_at BEFORE UPDATE ON public.site_sections
  FOR EACH ROW EXECUTE FUNCTION public.site_sections_touch_updated_at();

INSERT INTO public.site_sections (section_key, kind, eyebrow, title, subtitle, primary_label, primary_href, secondary_label, secondary_href, badge, items, sort_order)
VALUES
('header', 'nav', NULL, 'mefticaret', NULL, 'Kayıt Ol', '/auth', 'Giriş Yap', '/auth', NULL,
 '[{"label":"E-Ticaret","href":"#moduller"},{"label":"Entegrasyonlar","href":"#entegrasyonlar"},{"label":"Fiyatlandırma","href":"#paketler"},{"label":"Blog","href":"#blog"},{"label":"SSS","href":"#sss"}]'::jsonb, 10),
('hero', 'hero', 'E-Ticaret Altyapınız Hazır', 'Mağazanızı Kurun, Hemen Satışa Başlayın.',
 'Ürünlerinizi listeleyin, siparişlerinizi yönetin, müşterilerinize kesintisiz alışveriş sunun. Stoktan kargoya, ödemeden pazaryerine kadar dijital ticaretinizi büyütecek her şey tek çatı altında.',
 'Ücretsiz Başlayın', '/auth', 'Bizi Arayın', '#referanslar', NULL,
 '[{"label":"Hızlı Kurulum","icon":"Zap"},{"label":"7/24 Destek","icon":"Headphones"},{"label":"Güvenli Altyapı","icon":"ShieldCheck"}]'::jsonb, 20),
('showcase', 'showcase', NULL, 'Vitrin kartları', NULL, NULL, NULL, NULL, NULL, NULL,
 '[{"title":"Profesyonel Aynasız Kamera","price":"64.999 TL"},{"title":"Minimal Takı Seti","price":"6.799 TL"},{"title":"Espresso Kahve Makinesi","price":"24.999 TL"},{"title":"Modern Masa Lambası","price":"3.499 TL"},{"title":"Deri Cüzdan","price":"2.999 TL"},{"title":"Lilyum Buketi","price":"1.899 TL"}]'::jsonb, 30),
('references', 'references', 'Referanslar', 'Sıradaki başarı hikayesi sizinki olabilir', NULL, 'Referansları gör', '/auth', NULL, NULL, NULL,
 '[{"brand":"Enfez Yöresel","quote":"Daha önce farklı altyapılar kullandık ancak Mefticaret''e geçtikten sonra hem site hızı hem de yönetim paneli bizi ciddi anlamda rahatlattı.","person":"Mahmut Taşkın","role":"Kurucu","stat1":"+148%","stat1Label":"Yıllık ciro","stat2":"596","stat2Label":"Sipariş sayısı","stat3":"+140%","stat3Label":"Organik trafik"},{"brand":"Kartvizit Marketim","quote":"SEO tarafındaki teknik altyapı beklentimizin çok üzerinde çıktı. Organik görünürlüğümüzde kısa sürede gözle görülür artış elde ettik.","person":"Bahadır Dermanlı","role":"Kurucu","stat1":"+96%","stat1Label":"Yıllık ciro","stat2":"8.750","stat2Label":"Sipariş sayısı","stat3":"+210%","stat3Label":"Organik trafik"},{"brand":"Teknik Depo","quote":"Mevcut sistemimizden geçiş süreci düşündüğümüzden çok daha kolay ilerledi. Ürünler, kategoriler ve müşteri verileri eksiksiz taşındı.","person":"Ümit Özalp","role":"Kurucu","stat1":"+79%","stat1Label":"Yıllık ciro","stat2":"980","stat2Label":"Sipariş sayısı","stat3":"+168%","stat3Label":"Organik trafik"}]'::jsonb, 40),
('modules', 'cards', 'Güçlü Araçlar, Kolay Yönetim', 'İşinizi Büyütecek Her Şey Tek Platformda',
 'Tasarımdan analitiğe, yapay zekadan SEO''ya. E-ticaret operasyonunuzun her adımını kolaylaştıran araçlar sizin için hazır.', NULL, NULL, NULL, NULL, NULL,
 '[{"title":"Çoklu mağaza","text":"Tek hesap, sınırsız mağaza. Saniyeler içinde geçiş yap.","icon":"Store"},{"title":"Tenant izolasyonu","text":"Veri erişimi veritabanı seviyesinde politika ile ayrılır.","icon":"ShieldCheck"},{"title":"Rol bazlı ekip","text":"Sahip, yönetici, personel, pazarlama, destek rolleri.","icon":"Users"},{"title":"Domain yönetimi","text":"Alt alan adı + özel domain, DNS doğrulama ve SSL durumu.","icon":"Globe"},{"title":"Tema blok yönetimi","text":"Sürükle-bırak bölümler, canlı önizleme, sürüm geçmişi.","icon":"LayoutDashboard"},{"title":"Modüler mimari","text":"Ürün, sipariş, ödeme, pazaryeri bağımsız modüller.","icon":"Boxes"},{"title":"Connector sistemi","text":"Ödeme, kargo, ERP ve pazaryeri bağlantıları eklenebilir.","icon":"Truck"},{"title":"Yapay zeka hazır","text":"Ürün metni, SEO ve içerik üretimi mağaza bazlı takip ile.","icon":"Sparkles"}]'::jsonb, 50),
('integrations', 'integrations', 'Entegrasyonlar', 'Tüm Entegrasyonlar, Tek Merkez',
 'Pazaryerlerinden kargoya, e-faturadan reklam platformlarına kadar tüm araçlarınız tek panelde buluşsun. Sekmeler arasında kaybolmadan işinizi yönetin.', NULL, NULL, NULL, NULL, '50+',
 '[{"label":"PAZARYERLERİ","count":"12+","icon":"ShoppingBag"},{"label":"KARGO","count":"9+","icon":"Truck"},{"label":"ÖDEMELER","count":"8+","icon":"CreditCard"},{"label":"DİJİTAL DÜNYA","count":"10+","icon":"BarChart3"},{"label":"SMS PAZARLAMA","count":"6+","icon":"MessageSquare"},{"label":"MUHASEBE","count":"5+","icon":"Calculator"}]'::jsonb, 60),
('demos', 'demos', 'Panelde Neler Var?', 'Deneyin: Panel Böyle Çalışıyor',
 'Tema bloklarını sıralayın, pazarlama araçlarını tek tıkla bağlayın, yapay zeka ile içerik üretin ve SEO skorunuzu izleyin.', NULL, NULL, NULL, NULL, NULL, '[]'::jsonb, 70),
('pricing', 'pricing', 'Fiyatlandırma', 'Büyüdükçe ölçeklenen paketler',
 'Limitler kodda sabit değil; yönetici panelinden anlık güncellenir.', 'Başla', '/auth', NULL, NULL, NULL, '[]'::jsonb, 80),
('blog', 'blog', 'Blog', 'E-Ticaret Dünyasından İlham Alın',
 'E-ticaret rehberleri, sektör trendleri ve uzman ipuçlarıyla her zaman bir adım önde olun.', NULL, NULL, NULL, NULL, NULL,
 '[{"tag":"Rehber","title":"Sıfırdan e-ticaret mağazası açma rehberi","text":"Domain, tema, ürün girişi, ödeme ve kargo kurulumunu adım adım tamamlayın.","read":"8 dk okuma"},{"tag":"Pazaryeri","title":"Pazaryeri entegrasyonlarında stok senkronizasyonu","text":"Tek stoktan çok kanala satış yaparken aşırı satışı nasıl engellersiniz?","read":"6 dk okuma"},{"tag":"SEO","title":"Ürün sayfası SEO''su için 10 teknik kontrol","text":"Yapılandırılmış veri, hız, meta düzeni ve iç link stratejisi.","read":"7 dk okuma"}]'::jsonb, 90),
('faq', 'faq', 'Sorular & Cevaplar', 'Sıkça Sorulan Sorular',
 'Mefticaret ile mağaza kurmak ve büyütmek hakkında merak ettiğiniz her şey burada.', 'Ücretsiz Başlayın', '/auth', NULL, NULL, NULL,
 '[{"q":"Mağazamı kurmak ne kadar sürer?","a":"Kayıt olduktan sonra mağazanız otomatik alt alan adıyla anında oluşur. Tema seçimi, ürün girişi ve ödeme kurulumu ile aynı gün satışa başlayabilirsiniz."},{"q":"Kendi domainimi bağlayabilir miyim?","a":"Evet. magazam.com veya www.magazam.com gibi özel domainlerinizi bağlayabilir, DNS doğrulamasını panelden takip edebilir ve SSL sertifikanızın otomatik kurulmasını bekleyebilirsiniz."},{"q":"Tek hesapla birden fazla mağaza yönetebilir miyim?","a":"Evet. Mefticaret çok kiracılı bir altyapıdır; tek hesapla birden fazla mağaza açabilir, her mağaza için ayrı ekip, tema ve ayar yönetebilirsiniz."},{"q":"Mevcut mağazamdaki verileri taşıyabilir miyim?","a":"Ürün, varyant, kategori ve müşteri verilerinizi CSV içe aktarma ile taşıyabilirsiniz. Toplu fiyat, stok, kategori ve etiket düzenleme araçları da hazır."},{"q":"Paket limitleri nasıl belirleniyor?","a":"Ürün, sipariş, personel, depolama, domain, API ve AI kullanım limitleri veritabanında tutulur ve yönetici panelinden güncellenir."},{"q":"Ödeme ve kargo entegrasyonları var mı?","a":"Ödeme, kargo, pazaryeri, muhasebe ve pazarlama araçları için connector altyapısı hazırdır; bağlantılarınızı panelden yönetirsiniz."}]'::jsonb, 100),
('cta', 'cta', NULL, 'Bugün kurun, bugün satmaya başlayın.', 'Kredi kartı gerekmez. Mağazanızı dakikalar içinde yayına alın.',
 'Ücretsiz Başlayın', '/auth', 'Paketleri gör', '#paketler', NULL, '[]'::jsonb, 110),
('footer', 'footer', NULL, 'mefticaret', 'Türkiye''nin çok kiracılı e-ticaret işletim sistemi. Mağaza kurun, yönetin, büyütün.',
 'Ücretsiz Başlayın', '/auth', 'Giriş Yap', '/auth', 'KVKK & GDPR uyumlu mimari',
 '[{"group":"Platform","label":"E-Ticaret","href":"#moduller"},{"group":"Platform","label":"Özellikler","href":"#ozellikler"},{"group":"Platform","label":"Entegrasyonlar","href":"#entegrasyonlar"},{"group":"Platform","label":"Fiyatlandırma","href":"#paketler"},{"group":"Kaynaklar","label":"Blog","href":"#blog"},{"group":"Kaynaklar","label":"Referanslar","href":"#referanslar"},{"group":"Kaynaklar","label":"Sıkça Sorulan Sorular","href":"#sss"}]'::jsonb, 120)
ON CONFLICT (section_key) DO NOTHING;