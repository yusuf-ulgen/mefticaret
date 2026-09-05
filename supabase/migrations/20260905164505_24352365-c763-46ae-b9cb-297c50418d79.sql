INSERT INTO public.apps (code, name, tagline, description, category, developer, developer_url, version, logo_emoji, pricing_model, price, currency, is_active, is_featured, sort_order, permissions, settings_schema)
VALUES (
  'tiktok-dm',
  'TikTok DM Otomasyonu',
  'Video ve canlı yayın yorumlarından otomatik DM satışı',
  'TikTok video yorumlarını ve canlı yayın sohbetini anahtar kelimelere göre yakalar, otomatik DM gönderir, ürün kartı / stok / sepet bağlantısı paylaşır ve yapay zekâ ile viral tonda yanıt önerir. CRM panelinde müşteri LTV, sipariş, kargo ve terk edilmiş sepet verisini gösterir.',
  'social',
  'Mefticaret',
  'https://developers.tiktok.com/doc/tiktok-api-v2-overview/',
  '1.0.0',
  '🎵',
  'monthly',
  299,
  'TRY',
  true,
  true,
  19,
  ARRAY['read_products','read_orders','read_customers','write_customers','read_inventory','read_store']::text[],
  '[{"key":"auto_comment_dm","label":"Yorumlara otomatik DM gönder","type":"boolean","default":true},{"key":"live_automation","label":"Canlı yayın otomasyonu","type":"boolean","default":true},{"key":"autonomous_ai","label":"Otonom yapay zekâ yanıtı","type":"boolean","default":false},{"key":"confidence","label":"Güven eşiği (%)","type":"number","default":70}]'::jsonb
)
ON CONFLICT (code) DO NOTHING;