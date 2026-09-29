
CREATE TABLE public.policy_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key text NOT NULL,
  policy_type text NOT NULL DEFAULT 'store' CHECK (policy_type IN ('platform','store')),
  template_name text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  applicable_country char(2) NOT NULL DEFAULT 'TR',
  law_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  version text NOT NULL DEFAULT '1.0',
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (policy_type, policy_key, applicable_country)
);
GRANT SELECT ON public.policy_templates TO anon, authenticated;
GRANT ALL ON public.policy_templates TO service_role;
ALTER TABLE public.policy_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Templates readable" ON public.policy_templates FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Platform admins manage templates" ON public.policy_templates FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin')) WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'));

CREATE TABLE public.policy_placeholders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key text NOT NULL,
  placeholder_key text NOT NULL,
  label text NOT NULL,
  default_value text,
  input_type text NOT NULL DEFAULT 'text' CHECK (input_type IN ('text','number','date','select','textarea','email')),
  options jsonb,
  min_value integer,
  is_required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE (policy_key, placeholder_key)
);
GRANT SELECT ON public.policy_placeholders TO anon, authenticated;
GRANT ALL ON public.policy_placeholders TO service_role;
ALTER TABLE public.policy_placeholders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Placeholders readable" ON public.policy_placeholders FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Platform admins manage placeholders" ON public.policy_placeholders FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin')) WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'));

CREATE TABLE public.policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  policy_type text NOT NULL DEFAULT 'store' CHECK (policy_type IN ('platform','store')),
  policy_key text NOT NULL,
  title text NOT NULL,
  draft_content text NOT NULL DEFAULT '',
  placeholder_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  template_id uuid REFERENCES public.policy_templates(id) ON DELETE SET NULL,
  version text NOT NULL DEFAULT '1.0',
  current_version_id uuid,
  effective_date date,
  requires_acceptance boolean NOT NULL DEFAULT false,
  acceptance_count integer NOT NULL DEFAULT 0,
  seo_title text,
  seo_description text,
  is_visible boolean NOT NULL DEFAULT true,
  is_mandatory boolean NOT NULL DEFAULT false,
  last_reviewed_at timestamptz,
  last_reviewed_by uuid,
  next_review_date date,
  change_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((policy_type = 'platform' AND store_id IS NULL) OR (policy_type = 'store' AND store_id IS NOT NULL))
);
CREATE UNIQUE INDEX policies_store_key_uq ON public.policies (store_id, policy_key) WHERE store_id IS NOT NULL;
CREATE UNIQUE INDEX policies_platform_key_uq ON public.policies (policy_key) WHERE store_id IS NULL;
GRANT SELECT ON public.policies TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.policies TO authenticated;
GRANT ALL ON public.policies TO service_role;
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published visible policies are public" ON public.policies FOR SELECT TO anon, authenticated
  USING (current_version_id IS NOT NULL AND is_visible);
CREATE POLICY "Store managers manage store policies" ON public.policies FOR ALL TO authenticated
  USING (store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (store_id IS NOT NULL AND policy_type = 'store' AND app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "Platform admins manage platform policies" ON public.policies FOR ALL TO authenticated
  USING (store_id IS NULL AND app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (store_id IS NULL AND policy_type = 'platform' AND app_private.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER policies_updated_at BEFORE UPDATE ON public.policies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  version text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  effective_date date,
  change_summary text,
  requires_acceptance boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  is_active boolean NOT NULL DEFAULT false,
  UNIQUE (policy_id, version)
);
CREATE INDEX policy_versions_policy_idx ON public.policy_versions (policy_id, created_at DESC);
ALTER TABLE public.policies ADD CONSTRAINT policies_current_version_fk FOREIGN KEY (current_version_id) REFERENCES public.policy_versions(id) ON DELETE SET NULL;
GRANT SELECT ON public.policy_versions TO anon;
GRANT SELECT, INSERT, UPDATE ON public.policy_versions TO authenticated;
GRANT ALL ON public.policy_versions TO service_role;
ALTER TABLE public.policy_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active versions are public" ON public.policy_versions FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY "Store managers read store versions" ON public.policy_versions FOR SELECT TO authenticated
  USING (store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "Store managers write store versions" ON public.policy_versions FOR INSERT TO authenticated
  WITH CHECK (store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "Store managers toggle store versions" ON public.policy_versions FOR UPDATE TO authenticated
  USING (store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "Platform admins manage platform versions" ON public.policy_versions FOR ALL TO authenticated
  USING (store_id IS NULL AND app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (store_id IS NULL AND app_private.has_role(auth.uid(), 'platform_admin'));

-- Yayınlanan sürümün içeriği değiştirilemez (yalnız aktiflik bayrağı değişebilir).
CREATE OR REPLACE FUNCTION public.policy_versions_guard_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.version IS DISTINCT FROM OLD.version OR NEW.policy_id IS DISTINCT FROM OLD.policy_id THEN
    RAISE EXCEPTION 'Yayınlanmış politika sürümü değiştirilemez';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER policy_versions_immutable BEFORE UPDATE ON public.policy_versions FOR EACH ROW EXECUTE FUNCTION public.policy_versions_guard_immutable();

CREATE TABLE public.policy_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,
  policy_version_id uuid REFERENCES public.policy_versions(id) ON DELETE SET NULL,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  version_label text,
  user_type text NOT NULL DEFAULT 'customer' CHECK (user_type IN ('customer','seller','visitor')),
  user_id uuid,
  subject_email text,
  order_number text,
  session_id text,
  ip_address text,
  user_agent text,
  acceptance_method text NOT NULL DEFAULT 'checkbox' CHECK (acceptance_method IN ('checkbox','scroll','click','api','checkout')),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz
);
CREATE INDEX policy_acceptances_policy_idx ON public.policy_acceptances (policy_id, accepted_at DESC);
CREATE INDEX policy_acceptances_email_idx ON public.policy_acceptances (store_id, subject_email);
GRANT SELECT, UPDATE ON public.policy_acceptances TO authenticated;
GRANT ALL ON public.policy_acceptances TO service_role;
ALTER TABLE public.policy_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store managers read acceptances" ON public.policy_acceptances FOR SELECT TO authenticated
  USING (store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "Store managers withdraw acceptances" ON public.policy_acceptances FOR UPDATE TO authenticated
  USING (store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "Platform admins read all acceptances" ON public.policy_acceptances FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'));

CREATE TABLE public.cookie_banner_settings (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  position text NOT NULL DEFAULT 'bottom' CHECK (position IN ('bottom','bottom-left','bottom-right')),
  color_scheme text NOT NULL DEFAULT 'auto' CHECK (color_scheme IN ('auto','dark','light')),
  uses_analytics boolean NOT NULL DEFAULT true,
  uses_marketing boolean NOT NULL DEFAULT false,
  banner_text text,
  consent_version text NOT NULL DEFAULT '1.0',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cookie_banner_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cookie_banner_settings TO authenticated;
GRANT ALL ON public.cookie_banner_settings TO service_role;
ALTER TABLE public.cookie_banner_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cookie banner settings public" ON public.cookie_banner_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Store managers manage cookie banner" ON public.cookie_banner_settings FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER cookie_banner_settings_updated_at BEFORE UPDATE ON public.cookie_banner_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Yer tutucular
INSERT INTO public.policy_placeholders (policy_key, placeholder_key, label, default_value, input_type, min_value, is_required, sort_order) VALUES
('refund','CAYMA_SURESI','Cayma süresi (gün, en az 14)','14','number',14,true,1),
('refund','PARA_IADESI_SURESI','Para iadesi süresi (gün, en az 14)','14','number',14,true,2),
('refund','EK_KOSULLAR','Ek iade koşulları','- Ürün etiketleri yerinde olmalıdır','textarea',NULL,false,3),
('refund','IADE_HARICLERI','İade kapsamında olmayan ek ürünler','','textarea',NULL,false,4),
('refund','DESTEK_EMAIL','Destek e-postası','','email',NULL,true,5),
('privacy','SATICI_UNVAN','Satıcı unvanı (şirket / şahıs adı)','','text',NULL,true,1),
('privacy','SATICI_ADRES','Satıcı adresi','','textarea',NULL,true,2),
('privacy','DESTEK_EMAIL','KVKK başvuru e-postası','','email',NULL,true,3),
('shipping','KARGO_SURESI','Kargoya teslim süresi (iş günü)','2','number',1,true,1),
('shipping','KARGO_FIRMALARI','Çalışılan kargo firmaları','Aras Kargo, Yurtiçi Kargo','text',NULL,false,2),
('shipping','UCRETSIZ_KARGO_LIMITI','Ücretsiz kargo alt limiti (₺, boşsa yok)','','number',0,false,3),
('shipping','DESTEK_EMAIL','Destek e-postası','','email',NULL,true,4),
('cookie','DESTEK_EMAIL','İletişim e-postası','','email',NULL,false,1),
('distance_selling','SATICI_UNVAN','Satıcı unvanı','','text',NULL,true,1),
('distance_selling','SATICI_ADRES','Satıcı adresi','','textarea',NULL,true,2),
('distance_selling','DESTEK_EMAIL','Satıcı e-postası','','email',NULL,true,3),
('distance_selling','CAYMA_SURESI','Cayma süresi (gün, en az 14)','14','number',14,true,4);

-- Mağaza şablonları
INSERT INTO public.policy_templates (policy_key, policy_type, template_name, title, content, law_references) VALUES
('refund','store','Türk Hukuku — İade & Değişim Politikası','İade & Değişim Politikası',
$t$<p><strong>{{MAGAZA_ADI}}</strong> olarak müşteri memnuniyetini ön planda tutuyoruz.</p>
<h2>Cayma Hakkı</h2><p>Ürünü teslim aldıktan sonra <strong>{{CAYMA_SURESI}} gün</strong> içinde, herhangi bir gerekçe göstermeksizin ve cezai şart ödemeksizin sözleşmeden cayma hakkınız bulunmaktadır.</p>
<h2>İade Koşulları</h2><ul><li><p>Ürün kullanılmamış olmalıdır.</p></li><li><p>Orijinal ambalajında olmalıdır.</p></li><li><p>Fatura ile birlikte gönderilmelidir.</p></li></ul><p>{{EK_KOSULLAR}}</p>
<h2>Para İadesi</h2><p>İade edilen ürün tarafımıza ulaşıp onaylandıktan sonra en geç <strong>{{PARA_IADESI_SURESI}} gün</strong> içinde ödeme yönteminize iade edilir.</p>
<h2>İade Kapsamında Olmayan Ürünler</h2><ul><li><p>Kişiye özel üretilen ürünler</p></li><li><p>Ambalajı açılmış hijyen ürünleri</p></li><li><p>Anında ifa edilen dijital ürünler</p></li></ul><p>{{IADE_HARICLERI}}</p>
<h2>İletişim</h2><p>İade talepleriniz için: {{DESTEK_EMAIL}}</p>$t$,
'["6502 Sayılı Tüketicinin Korunması Hakkında Kanun","Mesafeli Sözleşmeler Yönetmeliği"]'),
('privacy','store','KVKK — Mağaza Gizlilik Politikası','Gizlilik Politikası',
$t$<p><strong>{{MAGAZA_ADI}}</strong> üzerinden alışveriş yapmanız halinde kişisel verileriniz 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında aşağıda açıklandığı şekilde işlenir.</p>
<h2>Veri Sorumlusu</h2><p>{{SATICI_UNVAN}}<br>{{SATICI_ADRES}}</p>
<h2>Toplanan Veriler</h2><p>Ad, soyad, e-posta, telefon, teslimat ve fatura adresi, sipariş bilgileri, site kullanım kayıtları ve çerez verileri.</p>
<h2>İşleme Amaçları</h2><ul><li><p>Siparişin alınması, hazırlanması ve teslimi</p></li><li><p>Ödeme işlemlerinin güvenli şekilde gerçekleştirilmesi</p></li><li><p>Müşteri hizmetleri ve iade süreçleri</p></li><li><p>Yasal yükümlülüklerin yerine getirilmesi</p></li><li><p>Açık rızanız varsa kampanya ve pazarlama iletişimi</p></li></ul>
<h2>Aktarım</h2><p>Verileriniz yalnızca hizmetin gerektirdiği ölçüde kargo şirketleri, ödeme kuruluşları, altyapı sağlayıcımız Mefticaret ve yetkili kamu kurumlarıyla paylaşılır.</p>
<h2>Saklama Süresi</h2><p>Sipariş ve fatura kayıtları ilgili mevzuat gereği 10 yıl saklanır; pazarlama izinleri geri alındığında ilgili veriler bu amaçla işlenmez.</p>
<h2>Haklarınız</h2><p>KVKK madde 11 kapsamında verilerinize erişme, düzeltme, silme, işlemenin kısıtlanması, itiraz ve veri taşınabilirliği haklarına sahipsiniz. Başvurularınızı {{DESTEK_EMAIL}} adresine iletebilirsiniz; en geç 30 gün içinde yanıtlanır.</p>$t$,
'["6698 Sayılı Kişisel Verilerin Korunması Kanunu"]'),
('shipping','store','Kargo & Teslimat Politikası','Kargo & Teslimat Politikası',
$t$<h2>Kargoya Teslim</h2><p>{{MAGAZA_ADI}} siparişleri ödeme onayından sonra en geç <strong>{{KARGO_SURESI}} iş günü</strong> içinde kargoya teslim edilir.</p>
<h2>Kargo Firmaları</h2><p>{{KARGO_FIRMALARI}}</p>
<h2>Kargo Ücreti</h2><p>Kargo ücreti ödeme adımında gösterilir. {{UCRETSIZ_KARGO_LIMITI}} ₺ ve üzeri siparişlerde kargo ücretsizdir (limit tanımlıysa).</p>
<h2>Teslimat</h2><p>Teslimat sırasında paketi kontrol etmenizi, hasarlı paketler için kargo görevlisine tutanak tutturmanızı öneririz. Yasal teslim süresi en fazla 30 gündür.</p>
<h2>İletişim</h2><p>{{DESTEK_EMAIL}}</p>$t$,
'["Mesafeli Sözleşmeler Yönetmeliği"]'),
('cookie','store','Çerez Politikası (Mağaza)','Çerez Politikası',
$t$<h2>Çerez Nedir?</h2><p>Çerezler, {{MAGAZA_ADI}} sitesini ziyaret ettiğinizde tarayıcınıza kaydedilen küçük metin dosyalarıdır.</p>
<h2>Kullandığımız Çerezler</h2><h3>Zorunlu Çerezler</h3><p>Oturum, sepet, güvenlik ve dil tercihi için gereklidir; kapatılamaz.</p><h3>Analitik Çerezler</h3><p>Sitenin nasıl kullanıldığını anlamamıza yardımcı olur; yalnızca onayınızla kullanılır.</p><h3>Pazarlama Çerezleri</h3><p>Size uygun reklamlar göstermek için kullanılır; yalnızca onayınızla kullanılır.</p>
<h2>Tercihlerinizi Nasıl Yönetirsiniz?</h2><p>Sayfanın altındaki çerez bandından veya tarayıcı ayarlarınızdan tercihlerinizi dilediğiniz zaman değiştirebilirsiniz.</p>
<h2>İletişim</h2><p>{{DESTEK_EMAIL}}</p>$t$,
'["6698 Sayılı KVKK","Elektronik Haberleşme Kanunu"]'),
('distance_selling','store','Mesafeli Satış Sözleşmesi','Mesafeli Satış Sözleşmesi',
$t$<h2>1. Taraflar</h2><p><strong>Satıcı:</strong> {{SATICI_UNVAN}}, {{SATICI_ADRES}}, {{DESTEK_EMAIL}}</p><p><strong>Alıcı:</strong> {{ALICI_ADI}}, {{TESLIMAT_ADRESI}}</p>
<h2>2. Konu</h2><p>İşbu sözleşme, alıcının {{MAGAZA_ADI}} üzerinden elektronik ortamda siparişini verdiği aşağıdaki ürünlerin satışı ve teslimine ilişkin hak ve yükümlülükleri düzenler.</p>
<h2>3. Ürünler</h2><p>{{URUN_LISTESI}}</p><p><strong>Toplam tutar (vergiler dahil):</strong> {{TOPLAM_TUTAR}}</p>
<h2>4. Teslimat</h2><p>Ürünler alıcının belirttiği adrese yasal 30 günlük süre içinde teslim edilir.</p>
<h2>5. Cayma Hakkı</h2><p>Alıcı, teslimattan itibaren {{CAYMA_SURESI}} gün içinde gerekçe göstermeksizin cayma hakkını kullanabilir. Cayma bildiriminden sonra 14 gün içinde bedel iade edilir.</p>
<h2>6. Uyuşmazlık</h2><p>Uyuşmazlıklarda Ticaret Bakanlığınca belirlenen parasal sınırlar dahilinde Tüketici Hakem Heyetleri ve Tüketici Mahkemeleri yetkilidir.</p>$t$,
'["6502 Sayılı TKHK","Mesafeli Sözleşmeler Yönetmeliği"]');

-- Platform şablonları
INSERT INTO public.policy_templates (policy_key, policy_type, template_name, title, content, law_references) VALUES
('privacy','platform','Mefticaret Gizlilik Politikası','Gizlilik Politikası',
$t$<h2>1. Veri Sorumlusu</h2><p>Mefticaret (bundan sonra "Mefticaret") — İletişim: kvkk@mefticaret.com</p>
<h2>2. Toplanan Kişisel Veriler</h2><ul><li><p><strong>Kimlik:</strong> Ad, soyad</p></li><li><p><strong>İletişim:</strong> E-posta, telefon, adres</p></li><li><p><strong>Finansal:</strong> Ödeme bilgileri (ödeme kuruluşlarında şifreli olarak işlenir)</p></li><li><p><strong>Teknik:</strong> IP adresi, çerez verileri</p></li><li><p><strong>İşlem:</strong> Sipariş ve alışveriş geçmişi</p></li></ul>
<h2>3. İşleme Amaçları</h2><ul><li><p>Sözleşmenin kurulması ve ifası</p></li><li><p>Sipariş işleme ve teslimat</p></li><li><p>Müşteri hizmetleri</p></li><li><p>Yasal yükümlülükler</p></li><li><p>Pazarlama (yalnızca açık rıza ile)</p></li></ul>
<h2>4. Verilerin Aktarıldığı Taraflar</h2><ul><li><p>Kargo şirketleri (teslimat için)</p></li><li><p>Ödeme kuruluşları (iyzico, PayTR, QNBpay)</p></li><li><p>Bulut altyapı sağlayıcıları</p></li><li><p>Yetkili kamu kurumları (yasal zorunluluk halinde)</p></li></ul>
<h2>5. Saklama Süreleri</h2><ul><li><p>Müşteri hesabı: aktif olduğu sürece + 10 yıl</p></li><li><p>Sipariş kayıtları: 10 yıl (Vergi Usul Kanunu)</p></li><li><p>Pazarlama izni: geri alınana kadar</p></li></ul>
<h2>6. KVKK Kapsamındaki Haklarınız</h2><p>Bilgi talep etme, düzeltme, silme/yok etme, işlemenin kısıtlanması, veri taşınabilirliği ve itiraz haklarına sahipsiniz.</p>
<h2>7. Başvuru Yöntemi</h2><p>E-posta: kvkk@mefticaret.com — Başvurular en geç 30 gün içinde yanıtlanır.</p>$t$,
'["6698 Sayılı KVKK"]'),
('terms','platform','Mefticaret Kullanım Koşulları','Kullanım Koşulları',
$t$<h2>1. Taraflar ve Kapsam</h2><p>Bu koşullar Mefticaret platformunu kullanan tüm kullanıcılar için geçerlidir.</p>
<h2>2. Hizmet Tanımı</h2><p>Mefticaret; mağaza açma, ürün satışı, ödeme ve kargo entegrasyonları sunan bir e-ticaret altyapısıdır.</p>
<h2>3. Hesap Oluşturma</h2><p>Kullanıcı doğru ve güncel bilgi vermekle, hesap güvenliğini korumakla yükümlüdür.</p>
<h2>4. Kullanıcı Yükümlülükleri</h2><p>Kullanıcı yürürlükteki mevzuata, bu koşullara ve üçüncü kişilerin haklarına uygun davranır.</p>
<h2>5. Yasaklanan Kullanımlar</h2><p>Yasa dışı ürün satışı, dolandırıcılık, zararlı yazılım yayma, spam ve sistem güvenliğini tehdit eden eylemler yasaktır.</p>
<h2>6. Fikri Mülkiyet</h2><p>Platformun yazılımı, tasarımı ve markası Mefticaret'e aittir.</p>
<h2>7. Sorumluluk Sınırlaması</h2><p>Mefticaret, satıcıların ürün ve hizmetlerinden doğrudan sorumlu değildir; mevzuatın izin verdiği ölçüde sorumluluğu sınırlıdır.</p>
<h2>8. Hizmet Değişiklikleri</h2><p>Mefticaret hizmetlerde değişiklik yapma hakkını saklı tutar; önemli değişiklikler önceden duyurulur.</p>
<h2>9. Fesih</h2><p>Koşullara aykırılık halinde hesap askıya alınabilir veya kapatılabilir.</p>
<h2>10. Uygulanacak Hukuk</h2><p>Bu koşullar Türk hukukuna tabidir.</p>
<h2>11. Uyuşmazlık Çözümü</h2><p>Uyuşmazlıklarda İstanbul Mahkemeleri ve İcra Daireleri yetkilidir; tüketici işlemlerinde tüketici hakem heyetleri ve mahkemelerinin yetkisi saklıdır.</p>$t$,
'["6098 Sayılı Türk Borçlar Kanunu","6563 Sayılı Elektronik Ticaret Kanunu"]'),
('cookie','platform','Mefticaret Çerez Politikası','Çerez Politikası',
$t$<h2>1. Çerez Nedir?</h2><p>Çerezler, siteyi ziyaret ettiğinizde tarayıcınıza kaydedilen küçük metin dosyalarıdır.</p>
<h2>2. Kullandığımız Çerezler</h2><h3>Zorunlu Çerezler (kapatılamaz)</h3><ul><li><p>Oturum çerezi</p></li><li><p>Güvenlik (CSRF) çerezi</p></li><li><p>Dil tercihi</p></li></ul><h3>Analitik Çerezler (onay gerekir)</h3><ul><li><p>Google Analytics (_ga, _gid)</p></li><li><p>Mefticaret iç analitik</p></li></ul><h3>Pazarlama Çerezleri (onay gerekir)</h3><ul><li><p>Facebook Pixel</p></li><li><p>Google Ads</p></li><li><p>TikTok Pixel</p></li></ul>
<h2>3. Çerezleri Nasıl Kontrol Edersiniz?</h2><p>Çerez bandından veya tarayıcı ayarlarınızdan tercihlerinizi değiştirebilirsiniz.</p>
<h2>4. Üçüncü Taraf Çerezler</h2><p>Analitik ve reklam hizmet sağlayıcıları kendi çerezlerini yalnızca onayınızla yerleştirir.</p>$t$,
'["6698 Sayılı KVKK"]'),
('refund','platform','Mefticaret Platform İade Politikası','İade Politikası',
$t$<h2>1. Cayma Hakkı</h2><p>Tüketici, ürünü teslim aldığı tarihten itibaren 14 gün içinde gerekçe göstermeksizin iade hakkına sahiptir.</p>
<h2>2. İade Süreci</h2><p>İade talebi sipariş sayfasından veya satıcı ile iletişime geçilerek oluşturulur; ürün faturası ile birlikte gönderilir.</p>
<h2>3. İade Kabul Edilmeyecek Durumlar</h2><p>Kişiye özel ürünler, ambalajı açılmış hijyen ürünleri, çabuk bozulan ürünler ve anında ifa edilen dijital içerikler (Mesafeli Sözleşmeler Yönetmeliği md. 15).</p>
<h2>4. Para İadesi Süresi</h2><p>Satıcı, cayma bildiriminin ulaşmasından itibaren 14 gün içinde bedeli iade etmekle yükümlüdür.</p>
<h2>5. Kargo Sorumluluğu</h2><p>Cayma hakkı kapsamında satıcının belirttiği kargo ile yapılan iadelerde kargo ücreti satıcıya aittir.</p>$t$,
'["6502 Sayılı TKHK","Mesafeli Sözleşmeler Yönetmeliği"]'),
('seller_agreement','platform','Mefticaret Satıcı Sözleşmesi','Satıcı Sözleşmesi',
$t$<h2>1. Satıcı Olmak</h2><p>Satıcı, Mefticaret üzerinde mağaza açarak ürün satan gerçek veya tüzel kişidir.</p>
<h2>2. Komisyon Oranları</h2><p>Geçerli komisyon ve paket ücretleri panelde ilan edilen tarifelere göre uygulanır.</p>
<h2>3. Ödeme Koşulları</h2><p>Satış bedelleri, iade ve kesintiler düşüldükten sonra ilan edilen ödeme takvimine göre aktarılır.</p>
<h2>4. Yasaklı Ürünler</h2><p>Mevzuata aykırı, sahte, lisanssız veya tehlikeli ürünlerin satışı yasaktır.</p>
<h2>5. Satıcı Yükümlülükleri</h2><p>Satıcı; ürün bilgisinin doğruluğundan, faturalandırmadan, teslimattan ve tüketici mevzuatına uyumdan sorumludur.</p>
<h2>6. Hesap Askıya Alma</h2><p>Sözleşmeye aykırılık, şikayet veya dolandırıcılık şüphesinde hesap askıya alınabilir.</p>
<h2>7. Platformun Hakları</h2><p>Mefticaret, platform güvenliği ve mevzuat gereği içerik kaldırma ve inceleme hakkını saklı tutar.</p>
<h2>8. Fikri Mülkiyet</h2><p>Satıcı, yüklediği içeriklerin haklarına sahip olduğunu beyan eder.</p>
<h2>9. Rekabet</h2><p>Satıcı, platform verilerini platform dışı haksız rekabet amacıyla kullanamaz.</p>
<h2>10. Gizlilik</h2><p>Taraflar, müşteri verilerini yalnız siparişin ifası amacıyla ve KVKK'ya uygun işler.</p>$t$,
'["6563 Sayılı Elektronik Ticaret Kanunu","6698 Sayılı KVKK"]'),
('distance_selling','platform','Mefticaret Mesafeli Satış Sözleşmesi','Mesafeli Satış Sözleşmesi',
$t$<h2>1. Taraflar</h2><p><strong>Satıcı:</strong> {{SATICI_ADI}}</p><p><strong>Alıcı:</strong> {{ALICI_ADI}}, {{TESLIMAT_ADRESI}}</p>
<h2>2. Ürünler</h2><p>{{URUN_LISTESI}}</p><p><strong>Toplam:</strong> {{TOPLAM_TUTAR}}</p>
<h2>3. Cayma Hakkı</h2><p>Alıcı teslimattan itibaren 14 gün içinde cayma hakkını kullanabilir.</p>
<h2>4. Uyuşmazlık</h2><p>Tüketici Hakem Heyetleri ve Tüketici Mahkemeleri yetkilidir.</p>$t$,
'["6502 Sayılı TKHK","Mesafeli Sözleşmeler Yönetmeliği"]');

-- Platform politikaları taslak olarak oluşturulur (süper yönetici gözden geçirip yayınlar).
INSERT INTO public.policies (store_id, policy_type, policy_key, title, draft_content, template_id, is_mandatory, version)
SELECT NULL, 'platform', policy_key, title, content, id, true, '1.0'
FROM public.policy_templates WHERE policy_type = 'platform';
