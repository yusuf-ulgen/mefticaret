update public.store_theme_sections
set settings = settings - 'collectionSlug'
where store_id = 'a4f1c2d8-9b3e-4c17-8f6a-2b5d7e9c1043'
  and type in ('product_grid', 'product_slider');

update public.store_theme_sections
set settings = jsonb_set(settings, '{linkUrl}', '"/s/utebaylar-market/products"')
where store_id = 'a4f1c2d8-9b3e-4c17-8f6a-2b5d7e9c1043' and type = 'announcement_bar';

update public.store_theme_sections
set settings = settings
  || jsonb_build_object(
       'title', 'Ütebaylar Market — ev, mutfak ve teknolojide net fiyat',
       'subtitle', 'Aynı gün kargo, 14 gün içinde koşulsuz iade, güvenli ödeme.')
where store_id = 'a4f1c2d8-9b3e-4c17-8f6a-2b5d7e9c1043' and type = 'hero';

update public.store_theme_sections
set settings = jsonb_set(settings, '{ctaUrl}', '"/s/utebaylar-market/about"')
where store_id = 'a4f1c2d8-9b3e-4c17-8f6a-2b5d7e9c1043' and type = 'image_text';

update public.store_theme_sections
set settings = settings
  || jsonb_build_object(
       'about', 'Ütebaylar Market — ev, mutfak, elektronik ve tekstil ürünleri',
       'copyright', '© 2026 Ütebaylar Market',
       'email', 'utebaylargrup@gmail.com')
where store_id = 'a4f1c2d8-9b3e-4c17-8f6a-2b5d7e9c1043' and type = 'footer';

update public.store_theme_sections
set settings = jsonb_set(settings, '{title}', '"Öne çıkan ürünler"')
where store_id = 'a4f1c2d8-9b3e-4c17-8f6a-2b5d7e9c1043' and type = 'product_grid' and position = 4;

update public.store_theme_sections
set settings = jsonb_set(settings, '{title}', '"Çok satanlar"')
where store_id = 'a4f1c2d8-9b3e-4c17-8f6a-2b5d7e9c1043' and type = 'product_slider';

update public.store_theme_sections
set settings = jsonb_set(settings, '{title}', '"Yeni gelenler"')
where store_id = 'a4f1c2d8-9b3e-4c17-8f6a-2b5d7e9c1043' and type = 'product_grid' and position = 7;