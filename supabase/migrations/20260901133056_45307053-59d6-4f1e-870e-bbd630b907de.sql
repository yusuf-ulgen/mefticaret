-- ============ APP STORE ============
CREATE TYPE public.app_category AS ENUM (
  'seo','marketing','payment','shipping','accounting','crm','analytics',
  'social','email','sms','whatsapp','ai','reviews','loyalty','dropshipping'
);
CREATE TYPE public.app_pricing_model AS ENUM ('free','monthly','one_time','usage');
CREATE TYPE public.app_install_status AS ENUM ('installed','paused','uninstalled');

CREATE TABLE public.apps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  category public.app_category NOT NULL,
  tagline text,
  description text,
  developer text NOT NULL DEFAULT 'Mefticaret',
  developer_url text,
  version text NOT NULL DEFAULT '1.0.0',
  logo_url text,
  logo_emoji text,
  permissions text[] NOT NULL DEFAULT '{}',
  pricing_model public.app_pricing_model NOT NULL DEFAULT 'free',
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  settings_schema jsonb NOT NULL DEFAULT '[]',
  is_featured boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  install_count integer NOT NULL DEFAULT 0,
  rating numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.apps TO anon;
GRANT SELECT ON public.apps TO authenticated;
GRANT ALL ON public.apps TO service_role;
ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apps_public_read" ON public.apps FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY "apps_admin_all" ON public.apps FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER apps_set_updated_at BEFORE UPDATE ON public.apps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.app_installations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  app_id uuid NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  status public.app_install_status NOT NULL DEFAULT 'installed',
  granted_permissions text[] NOT NULL DEFAULT '{}',
  settings jsonb NOT NULL DEFAULT '{}',
  installed_by uuid,
  installed_at timestamptz NOT NULL DEFAULT now(),
  uninstalled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, app_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_installations TO authenticated;
GRANT ALL ON public.app_installations TO service_role;
ALTER TABLE public.app_installations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_installations_member_read" ON public.app_installations FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "app_installations_manage" ON public.app_installations FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER app_installations_set_updated_at BEFORE UPDATE ON public.app_installations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX app_installations_store_idx ON public.app_installations (store_id, status);

-- ============ API KEYS ============
CREATE TABLE public.api_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  api_version text NOT NULL DEFAULT 'v1',
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  last_used_at timestamptz,
  request_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX api_keys_hash_idx ON public.api_keys (key_hash);
CREATE INDEX api_keys_store_idx ON public.api_keys (store_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_keys_member_read" ON public.api_keys FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "api_keys_manage" ON public.api_keys FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER api_keys_set_updated_at BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.api_request_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  api_version text NOT NULL DEFAULT 'v1',
  method text NOT NULL,
  path text NOT NULL,
  status_code integer NOT NULL DEFAULT 200,
  duration_ms integer,
  ip_address text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX api_request_logs_store_idx ON public.api_request_logs (store_id, created_at DESC);
GRANT SELECT ON public.api_request_logs TO authenticated;
GRANT ALL ON public.api_request_logs TO service_role;
ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_request_logs_member_read" ON public.api_request_logs FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));

-- ============ WEBHOOK UPGRADES ============
ALTER TABLE public.store_webhooks
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS api_version text NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS signature_algorithm text NOT NULL DEFAULT 'sha256';

ALTER TABLE public.webhook_deliveries
  ADD COLUMN IF NOT EXISTS signature text,
  ADD COLUMN IF NOT EXISTS duration_ms integer,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS manual_retry boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS webhook_deliveries_retry_idx
  ON public.webhook_deliveries (next_retry_at)
  WHERE status = 'failed';

-- ============ SEED APP CATALOG ============
INSERT INTO public.apps (code, name, category, tagline, description, developer, version, logo_emoji, permissions, pricing_model, price, settings_schema, is_featured, sort_order) VALUES
('seo-booster','SEO Booster','seo','Otomatik meta etiket ve şema üretimi','Ürün ve kategori sayfaların için otomatik başlık, açıklama ve JSON-LD şeması üretir; kırık bağlantıları raporlar.','Mefticaret','1.4.0','🚀','{read_products,write_products,read_store}','free',0,'[{"key":"auto_meta","label":"Otomatik meta üret","type":"boolean","default":true},{"key":"title_suffix","label":"Başlık soneki","type":"text"}]',true,1),
('sitemap-pro','Sitemap Pro','seo','Gelişmiş site haritası yönetimi','Çok dilli site haritaları, öncelik ayarları ve arama motoru bildirimi.','Mefticaret','1.1.0','🗺️','{read_products,read_store}','monthly',99,'[{"key":"ping_engines","label":"Arama motorlarına bildir","type":"boolean","default":true}]',false,2),
('campaign-studio','Kampanya Stüdyosu','marketing','İndirim ve kampanya otomasyonu','Sepet tutarına, ürün grubuna ve müşteri segmentine göre otomatik kampanya kuralları.','Mefticaret','2.0.1','🎯','{read_orders,read_customers,write_products}','monthly',249,'[{"key":"auto_apply","label":"Otomatik uygula","type":"boolean","default":false}]',true,3),
('google-ads-sync','Google Ads Sync','marketing','Ürün feed ve dönüşüm takibi','Ürün kataloğunu Google Merchant''a aktarır, dönüşüm etiketlerini kurar.','Mefticaret','1.2.0','📣','{read_products,read_orders}','monthly',199,'[{"key":"merchant_id","label":"Merchant ID","type":"text"}]',false,4),
('iyzico-pay','iyzico Ödeme','payment','Kredi kartı ve taksit desteği','3D Secure, taksit tablosu ve otomatik iade destekli ödeme entegrasyonu.','iyzico','3.1.0','💳','{read_orders,write_orders,read_store}','usage',0,'[{"key":"api_key","label":"API anahtarı","type":"password"},{"key":"sandbox","label":"Test modu","type":"boolean","default":true}]',true,5),
('paytr-pay','PayTR Ödeme','payment','Sanal POS ve link ile ödeme','Sanal POS, ödeme linki ve taksit seçenekleri.','PayTR','2.4.0','🏦','{read_orders,write_orders}','usage',0,'[{"key":"merchant_id","label":"Mağaza no","type":"text"},{"key":"merchant_key","label":"Mağaza anahtarı","type":"password"}]',false,6),
('aras-kargo','Aras Kargo','shipping','Otomatik gönderi ve takip','Sipariş onayında otomatik gönderi oluşturur, takip numarasını müşteriye iletir.','Aras Kargo','1.8.0','🚚','{read_orders,write_orders,read_store}','free',0,'[{"key":"customer_code","label":"Müşteri kodu","type":"text"},{"key":"auto_create","label":"Otomatik gönderi","type":"boolean","default":true}]',true,7),
('yurtici-kargo','Yurtiçi Kargo','shipping','Barkod ve etiket üretimi','Toplu etiket basımı, teslim durumu senkronizasyonu.','Yurtiçi Kargo','1.5.2','📦','{read_orders,write_orders}','free',0,'[{"key":"user_code","label":"Kullanıcı kodu","type":"text"}]',false,8),
('e-fatura','e-Fatura Köprüsü','accounting','GİB uyumlu e-fatura/e-arşiv','Siparişlerden otomatik e-arşiv fatura oluşturur ve müşteriye e-posta ile gönderir.','Mefticaret','2.2.0','🧾','{read_orders,read_customers,read_store}','monthly',179,'[{"key":"integrator","label":"Entegratör","type":"select","options":["Foriba","Uyumsoft","Nilvera"]},{"key":"auto_issue","label":"Otomatik fatura kes","type":"boolean","default":false}]',true,9),
('logo-muhasebe','Logo Muhasebe','accounting','Ön muhasebe senkronizasyonu','Sipariş, iade ve stok hareketlerini muhasebe programına aktarır.','Logo','1.0.6','📊','{read_orders,read_products}','monthly',299,'[{"key":"company_code","label":"Firma kodu","type":"text"}]',false,10),
('crm-desk','CRM Desk','crm','Müşteri kartı ve etkileşim geçmişi','Müşteri notları, segmentler, görev atama ve satış hunisi takibi.','Mefticaret','1.6.0','🗂️','{read_customers,write_customers,read_orders}','monthly',149,'[{"key":"pipeline_stages","label":"Huni aşamaları","type":"text"}]',false,11),
('whatsapp-crm','WhatsApp CRM','whatsapp','Tek panelden WhatsApp yönetimi','Sipariş bildirimleri, sepet hatırlatmaları ve canlı destek için WhatsApp Business API.','Mefticaret','2.1.0','💬','{read_orders,read_customers}','monthly',219,'[{"key":"phone_number_id","label":"Telefon numarası ID","type":"text"},{"key":"token","label":"Erişim jetonu","type":"password"}]',true,12),
('ga4-analytics','GA4 Analitik','analytics','Gelişmiş e-ticaret ölçümü','Görüntüleme, sepete ekleme ve satın alma olaylarını GA4''e gönderir.','Google','1.9.0','📈','{read_orders,read_products}','free',0,'[{"key":"measurement_id","label":"Ölçüm ID","type":"text"}]',true,13),
('heatmap-lens','Heatmap Lens','analytics','Isı haritası ve oturum kaydı','Ziyaretçi davranışını ısı haritası ve tıklama analizi ile görselleştirir.','Mefticaret','1.0.3','🔍','{read_store}','monthly',129,'[{"key":"sample_rate","label":"Örnekleme oranı","type":"number","default":50}]',false,14),
('meta-pixel','Meta Pixel & Katalog','social','Facebook/Instagram entegrasyonu','Pixel kurulumu, ürün kataloğu senkronizasyonu ve Instagram Shopping.','Meta','2.3.0','📱','{read_products,read_orders}','free',0,'[{"key":"pixel_id","label":"Pixel ID","type":"text"}]',false,15),
('tiktok-shop','TikTok Shop','social','TikTok mağaza senkronu','Ürünlerini TikTok Shop''a aktarır, siparişleri geri çeker.','TikTok','1.3.0','🎵','{read_products,write_products,read_orders,write_orders}','usage',0,'[{"key":"shop_id","label":"Shop ID","type":"text"}]',false,16),
('mail-flows','Mail Flows','email','E-posta otomasyon akışları','Hoş geldin, terk edilmiş sepet, satın alma sonrası ve geri kazanım e-postaları.','Mefticaret','2.5.0','✉️','{read_customers,read_orders}','monthly',159,'[{"key":"from_name","label":"Gönderen adı","type":"text"},{"key":"abandoned_delay_hours","label":"Sepet hatırlatma (saat)","type":"number","default":6}]',true,17),
('sms-blast','SMS Blast','sms','Toplu ve işlemsel SMS','Sipariş durumu SMS''leri ve kampanya gönderimleri; IYS uyumlu izin yönetimi.','Mefticaret','1.7.0','📲','{read_customers,read_orders}','usage',0,'[{"key":"sender_title","label":"Gönderici başlığı","type":"text"}]',false,18),
('ai-copywriter','AI Copywriter','ai','Ürün metni ve SEO üretimi','Yapay zekâ ile ürün açıklaması, SEO metni ve sosyal medya içeriği üretir.','Mefticaret','3.0.0','🤖','{read_products,write_products}','usage',0,'[{"key":"tone","label":"Ton","type":"select","options":["Profesyonel","Samimi","Lüks","Eğlenceli"]},{"key":"language","label":"Dil","type":"select","options":["Türkçe","İngilizce"]}]',true,19),
('ai-support-bot','AI Destek Botu','ai','7/24 müşteri asistanı','Ürün, kargo ve iade sorularını mağaza verilerine dayanarak yanıtlar.','Mefticaret','1.4.0','🧠','{read_products,read_orders,read_customers}','monthly',329,'[{"key":"greeting","label":"Karşılama mesajı","type":"text"},{"key":"handoff_email","label":"Devretme e-postası","type":"text"}]',false,20),
('review-collector','Yorum Toplayıcı','reviews','Otomatik yorum daveti','Teslimat sonrası fotoğraflı yorum daveti gönderir, yorumları moderasyona düşürür.','Mefticaret','1.5.0','⭐','{read_orders,read_customers}','monthly',119,'[{"key":"delay_days","label":"Teslimattan sonra (gün)","type":"number","default":5},{"key":"reward_coupon","label":"Ödül kuponu","type":"text"}]',true,21),
('trust-badges','Güven Rozetleri','reviews','Puan ve rozet gösterimi','Ürün ve vitrin sayfalarında toplu puan, rozet ve müşteri memnuniyeti göstergeleri.','Mefticaret','1.1.0','🛡️','{read_products}','free',0,'[{"key":"position","label":"Konum","type":"select","options":["Ürün kartı","Ürün detayı","Footer"]}]',false,22),
('loyalty-club','Sadakat Kulübü','loyalty','Puan, seviye ve ödül sistemi','Alışverişten puan kazandırır, seviyelere göre indirim ve ücretsiz kargo tanımlar.','Mefticaret','2.0.0','🏆','{read_orders,read_customers,write_customers}','monthly',189,'[{"key":"points_per_currency","label":"1 TL = puan","type":"number","default":1},{"key":"tiers","label":"Seviye eşikleri","type":"text"}]',true,23),
('dropship-hub','Dropship Hub','dropshipping','Tedarikçi kataloğu ve otomatik sipariş','Tedarikçi ürünlerini içe aktarır, stok/fiyat senkronize eder ve siparişi otomatik iletir.','Mefticaret','1.9.0','🌐','{read_products,write_products,read_orders,write_orders}','monthly',279,'[{"key":"markup_percent","label":"Kâr marjı (%)","type":"number","default":35},{"key":"auto_forward","label":"Siparişi otomatik ilet","type":"boolean","default":true}]',true,24);