INSERT INTO public.apps (code, name, tagline, description, category, developer, developer_url, logo_emoji, pricing_model, price, currency, is_active, is_featured, permissions, sort_order, version)
VALUES (
  'mobile-app-builder',
  'Mobil Uygulama Oluşturucu',
  'Kodsuz iOS & Android mağaza uygulaması',
  'Sürükle-bırak mobil tema düzenleyici, canlı telefon önizlemesi, push bildirim otomasyonları, derin bağlantılar, uygulamaya özel indirim ve App Store / Google Play yayın ayarları. Vitrin ürünleri ve tema renkleri otomatik senkronlanır.',
  'marketing',
  'Mefticaret',
  'https://mefticaret.com',
  '📱',
  'free',
  0,
  'TRY',
  true,
  true,
  ARRAY['read_products','read_store','write_store','read_orders','read_customers'],
  5,
  '1.0.0'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  logo_emoji = EXCLUDED.logo_emoji,
  is_active = true,
  is_featured = true,
  permissions = EXCLUDED.permissions,
  updated_at = now();