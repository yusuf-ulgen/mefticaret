insert into public.site_sections (section_key, kind, title, subtitle, sort_order, is_enabled, items)
values (
  'header_mega', 'megamenu', 'Mega menü', 'Üst menüdeki açılır panellerin içeriği.', 15, true,
  '[
    {"menu":"E-Ticaret","group":"Mağaza","label":"Ürün ve stok yönetimi","desc":"Varyant, barkod, çoklu depo","href":"#moduller","icon":"Boxes"},
    {"menu":"E-Ticaret","group":"Mağaza","label":"Sipariş ve kargo","desc":"Etiket, takip, iade akışı","href":"#moduller","icon":"Truck"},
    {"menu":"E-Ticaret","group":"Mağaza","label":"Ödeme altyapısı","desc":"Sanal POS ve taksit","href":"#moduller","icon":"CreditCard"},
    {"menu":"E-Ticaret","group":"Büyüme","label":"Tema editörü","desc":"Sürükle-bırak vitrin tasarımı","href":"#moduller","icon":"LayoutDashboard","badge":"YENİ"},
    {"menu":"E-Ticaret","group":"Büyüme","label":"SEO merkezi","desc":"Otomatik SEO ve içerik","href":"#moduller","icon":"BarChart3"},
    {"menu":"Entegrasyonlar","group":"Pazaryerleri","label":"Trendyol & Hepsiburada","desc":"Ürün, stok, sipariş eşitleme","href":"#entegrasyonlar","icon":"ShoppingBag"},
    {"menu":"Entegrasyonlar","group":"Pazaryerleri","label":"Facebook Marketplace","desc":"Item API ile ilan yayını","href":"#entegrasyonlar","icon":"Globe"},
    {"menu":"Entegrasyonlar","group":"Sosyal","label":"Instagram & TikTok DM","desc":"Mesaj otomasyonu ve satış","href":"#entegrasyonlar","icon":"MessageSquare"},
    {"menu":"Entegrasyonlar","group":"Sosyal","label":"Uygulama mağazası","desc":"Tek tıkla kurulum","href":"#entegrasyonlar","icon":"Zap"},
    {"menu":"Çözümler","group":"Ekipler","label":"Süper admin paneli","desc":"Platformun tamamını yönet","href":"#moduller","icon":"ShieldCheck"},
    {"menu":"Çözümler","group":"Ekipler","label":"Çok mağazalı yapı","desc":"Tek hesap, sınırsız mağaza","href":"#moduller","icon":"Store"},
    {"menu":"Çözümler","group":"Destek","label":"7/24 destek","desc":"Uzman ekip ve eğitim","href":"#sss","icon":"Headphones"}
  ]'::jsonb
)
on conflict (section_key) do update set kind = excluded.kind, items = excluded.items, is_enabled = true;