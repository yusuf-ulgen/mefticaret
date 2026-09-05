INSERT INTO public.apps (code, name, tagline, description, category, developer, developer_url, version, logo_emoji, pricing_model, price, currency, is_active, is_featured, sort_order, permissions, settings_schema)
VALUES (
  'instagram-dm',
  'Instagram DM Otomasyonu',
  'Yorumdan DM''e otomatik satış asistanı',
  'Instagram yorumlarını anahtar kelimelere göre yakalar, otomatik DM gönderir, ürün/stok/sepet bağlantısı paylaşır ve yapay zekâ ile yanıt önerir. Sosyal CRM panelinde müşteri LTV, sipariş ve sepet verisini gösterir.',
  'social',
  'Mefticaret',
  'https://developers.facebook.com/docs/instagram-platform',
  '1.0.0',
  '📸',
  'monthly',
  299,
  'TRY',
  true,
  true,
  18,
  ARRAY['read_products','read_orders','read_customers','write_customers','read_inventory','read_store']::text[],
  '[{"key":"auto_reply","label":"Yorumları otomatik yanıtla","type":"boolean","default":true},{"key":"autonomous_ai","label":"Otonom yapay zekâ yanıtı","type":"boolean","default":false},{"key":"confidence","label":"Güven eşiği (%)","type":"number","default":70}]'::jsonb
)
ON CONFLICT (code) DO NOTHING;