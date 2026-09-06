do $$
declare
  v_store uuid := 'a4f1c2d8-9b3e-4c17-8f6a-2b5d7e9c1043';
  v_owner uuid := '095f2528-3feb-4e9d-8b0a-7a41e72554f4';
  v_wh uuid;
  v_cat uuid;
  v_prod uuid;
  v_img uuid;
  r record;
  c record;
begin
  insert into public.stores (id, owner_id, name, slug, industry, currency, locale, timezone, status, onboarding_step, onboarding_completed, is_demo, published_at)
  values (v_store, v_owner, 'Ütebaylar Market', 'utebaylar-market', 'perakende', 'TRY', 'tr', 'Europe/Istanbul', 'active', 5, true, false, now())
  on conflict (id) do update set name = excluded.name, status = 'active', is_demo = false, published_at = coalesce(public.stores.published_at, now());

  insert into public.store_users (store_id, user_id, role)
  values (v_store, v_owner, 'owner')
  on conflict do nothing;

  insert into public.store_settings (store_id, contact_email, contact_phone, legal_name, base_currency, default_locale, guest_checkout)
  values (v_store, 'utebaylargrup@gmail.com', '+90 555 000 00 00', 'Ütebaylar Grup', 'TRY', 'tr', true)
  on conflict (store_id) do update set contact_email = excluded.contact_email;

  insert into public.warehouses (store_id, code, name, kind, country, city, is_default, is_active)
  values (v_store, 'MERKEZ', 'Merkez Depo', 'warehouse', 'TR', 'İstanbul', true, true)
  on conflict do nothing;
  select id into v_wh from public.warehouses where store_id = v_store order by created_at limit 1;

  for c in
    select * from (values
      ('Ev & Yaşam','ev-yasam',0),
      ('Mutfak','mutfak',1),
      ('Elektronik','elektronik',2),
      ('Tekstil','tekstil',3)
    ) as t(name, slug, ord)
  loop
    insert into public.categories (store_id, name, slug, level, sort_order, is_active)
    values (v_store, c.name, c.slug, 0, c.ord, true)
    on conflict do nothing;
  end loop;

  insert into public.collections (store_id, title, slug, description, sort_order)
  values
    (v_store, 'Yeni Gelenler', 'yeni-gelenler', 'Bu haftanın yeni ürünleri', 0),
    (v_store, 'İndirimdekiler', 'indirimdekiler', 'Fırsat ürünleri', 1)
  on conflict do nothing;

  for r in
    select * from (values
      ('Pamuklu Nevresim Takımı','pamuklu-nevresim-takimi','tekstil',1299,1799,'{Beyaz,Bej,Gri}'::text[]),
      ('Çift Kişilik Yorgan','cift-kisilik-yorgan','tekstil',899,1099,'{Krem,Gri}'::text[]),
      ('Havlu Seti 4''lü','havlu-seti-4lu','tekstil',449,599,'{Mavi,Beyaz,Bordo}'::text[]),
      ('Çelik Tencere Seti','celik-tencere-seti','mutfak',2490,3190,'{Gümüş,Siyah}'::text[]),
      ('Granit Tava 26 cm','granit-tava-26-cm','mutfak',549,749,'{Siyah,Kahve}'::text[]),
      ('Cam Saklama Kabı 6''lı','cam-saklama-kabi-6li','mutfak',329,429,'{Şeffaf,Yeşil}'::text[]),
      ('Filtre Kahve Makinesi','filtre-kahve-makinesi','elektronik',1890,2290,'{Siyah,Beyaz}'::text[]),
      ('Kablosuz Kulaklık','kablosuz-kulaklik','elektronik',1290,1690,'{Siyah,Beyaz,Mavi}'::text[]),
      ('Robot Süpürge','robot-supurge','elektronik',7490,8990,'{Siyah,Gümüş}'::text[]),
      ('Dekoratif Masa Lambası','dekoratif-masa-lambasi','ev-yasam',699,899,'{Altın,Siyah}'::text[]),
      ('Bambu Servis Tepsisi','bambu-servis-tepsisi','ev-yasam',249,329,'{Kahve,Krem}'::text[]),
      ('Yumuşak Peluş Battaniye','yumusak-plus-battaniye','ev-yasam',479,649,'{Gri,Pembe,Lacivert}'::text[])
    ) as t(title, slug, cat, price, compare, colors)
  loop
    select id into v_cat from public.categories where store_id = v_store and slug = r.cat;

    insert into public.products (store_id, title, slug, description, status, vendor, product_type, tags, base_price, compare_at_price, currency, track_inventory, category_id, sku)
    values (v_store, r.title, r.slug,
      r.title || ' — Ütebaylar Market güvencesiyle, hızlı kargo ve 14 gün içinde koşulsuz iade imkânıyla satılır.',
      'active', 'Ütebaylar', initcap(replace(r.cat,'-',' ')), r.colors, r.price, r.compare, 'TRY', true, v_cat,
      'UM-' || upper(left(replace(r.slug,'-',''),8)))
    on conflict (store_id, slug) do update set status='active', base_price=excluded.base_price, tags=excluded.tags, category_id=excluded.category_id
    returning id into v_prod;

    if v_prod is null then
      select id into v_prod from public.products where store_id = v_store and slug = r.slug;
    end if;

    insert into public.product_images (product_id, store_id, url, alt, position)
    values (v_prod, v_store, 'https://picsum.photos/seed/' || r.slug || '/900/900', r.title, 0)
    on conflict do nothing;
    select id into v_img from public.product_images where product_id = v_prod order by position limit 1;

    for i in 1 .. array_length(r.colors, 1) loop
      insert into public.product_variants (product_id, store_id, title, sku, options, price, compare_at_price, stock, position, image_id, low_stock_threshold)
      values (v_prod, v_store, r.colors[i], 'UM-' || upper(left(replace(r.slug,'-',''),8)) || '-' || i,
        jsonb_build_object('Renk', r.colors[i]), r.price, r.compare, 25 + i * 7, i - 1, v_img, 5)
      on conflict do nothing;
    end loop;
  end loop;

  insert into public.inventory_levels (store_id, warehouse_id, variant_id, product_id, on_hand, min_stock)
  select v_store, v_wh, v.id, v.product_id, v.stock, 5
  from public.product_variants v
  join public.products p on p.id = v.product_id
  where p.store_id = v_store
  on conflict do nothing;

  insert into public.store_themes (store_id, preset, primary_color, accent_color, background_color, font_pair, radius, layout, hero_title, hero_subtitle, hero_cta_label, announcement, show_announcement, is_published, published_at)
  values (v_store, 'wokiee-mega', '#101418', '#d92d20', '#ffffff', 'jost', 12, 'wide',
    'Ütebaylar Market — ev, mutfak ve teknolojide net fiyat',
    'Binlerce üründe aynı gün kargo, 14 gün içinde koşulsuz iade.',
    'Ürünleri keşfet', 'Tüm siparişlerde kargo bedava', true, true, now())
  on conflict (store_id) do update set is_published = true, published_at = now();

  insert into public.store_theme_sections (store_id, type, position, is_enabled, settings, visibility)
  select v_store, s.type, s.position, s.is_enabled,
    (s.settings::text)::jsonb, s.visibility
  from public.store_theme_sections s
  where s.store_id = 'ba825092-7093-4950-bcd3-1ae33423170b'
    and not exists (select 1 from public.store_theme_sections x where x.store_id = v_store);
end $$;