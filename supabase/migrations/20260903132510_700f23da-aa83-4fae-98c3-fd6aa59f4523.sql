insert into public.apps (code, name, category, tagline, description, developer, developer_url, version, logo_emoji, permissions, pricing_model, price, currency, settings_schema, is_featured, is_active, sort_order)
values
('verimor-sms','Verimor SMS','sms','Toplu ve işlemsel SMS gönderimi','Verimor SMS API ile sipariş, kargo, terk edilmiş sepet ve pazarlama bildirimlerini SMS olarak gönderin. Kredi bakiyesi bağlantı testinde doğrulanır.','MefTicaret','https://developer.verimor.com.tr/smsapi','1.0.0','✉️',array['read_customers','read_orders','read_store'],'usage',0,'TRY','[{"key":"username","label":"Kullanıcı adı (numara)","type":"text"},{"key":"password","label":"API şifresi","type":"password"},{"key":"source_addr","label":"Gönderici başlığı","type":"text"},{"key":"valid_for_minutes","label":"Geçerlilik süresi (dakika, opsiyonel)","type":"number"}]'::jsonb,true,true,150)
on conflict (code) do update set
  name = excluded.name,
  category = excluded.category,
  tagline = excluded.tagline,
  description = excluded.description,
  developer_url = excluded.developer_url,
  logo_emoji = excluded.logo_emoji,
  permissions = excluded.permissions,
  pricing_model = excluded.pricing_model,
  settings_schema = excluded.settings_schema,
  is_featured = excluded.is_featured,
  is_active = true,
  sort_order = excluded.sort_order;