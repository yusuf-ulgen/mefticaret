INSERT INTO public.platform_settings (key, value, label, description, is_public)
VALUES ('v2_seller_design', '{"enabled": false}'::jsonb, 'Satıcı paneli yeni tasarım (v2)', 'Açıkken satıcı paneli beyaz/siyah/mor v2 tasarımıyla görünür. Kapatınca eski görünüm döner.', true)
ON CONFLICT (key) DO NOTHING;