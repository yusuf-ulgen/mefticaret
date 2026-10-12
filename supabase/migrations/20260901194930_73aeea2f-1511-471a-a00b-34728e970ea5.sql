CREATE OR REPLACE FUNCTION public.seed_demo_store(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _store public.stores;
  _rec record;
  _pid uuid; _cust uuid; _did uuid; _cart uuid; _oid uuid; _wid uuid;
  _i int; _n int; _slug text;
  _product_ids uuid[]; _customer_ids uuid[];
  _p1 uuid; _p2 uuid; _pr1 numeric; _pr2 numeric; _t1 text; _t2 text; _q1 int; _q2 int;
  _v1 uuid; _v2 uuid;
  _subtotal numeric; _discount numeric; _tax numeric; _ship numeric; _total numeric;
  _status public.order_status; _pay public.payment_status; _ful public.fulfillment_status;
  _names text[] := ARRAY['Ayşe Demir','Mert Kaya','Elif Yılmaz','Burak Şahin','Zeynep Aydın','Can Aksoy',
    'Deniz Koç','Selin Arslan','Emre Doğan','Nur Çelik','Kerem Tunç','Melis Ergin','Onur Bilgin','Sude Kara',
    'Yusuf Altın','Ece Yalın','Barış Ünal','Gizem Toprak','Tolga Erdem','Pelin Sever'];
  _cities text[] := ARRAY['İstanbul','Ankara','İzmir','Bursa','Antalya','Adana','Konya','Eskişehir','Trabzon','Gaziantep'];
  _out jsonb;
BEGIN
  SELECT * INTO _store FROM public.stores WHERE id = _store_id;
  IF _store.id IS NULL THEN RAISE EXCEPTION 'Mağaza bulunamadı: %', _store_id; END IF;
  IF NOT COALESCE(_store.is_demo, false) THEN
    RAISE EXCEPTION 'seed_demo_store yalnızca demo mağazalarda çalışır';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT app_private.can_manage_store(_store_id, auth.uid()) THEN
    RAISE EXCEPTION 'Bu mağazada demo veri oluşturma yetkiniz yok';
  END IF;

  INSERT INTO public.categories (store_id, name, slug, description, sort_order, is_active)
  SELECT _store_id, c.name, c.slug, c.name || ' kategorisindeki tüm ürünler', c.ord, true
    FROM (VALUES ('Kadın','kadin',1),('Erkek','erkek',2),('Çocuk','cocuk',3),('Ayakkabı','ayakkabi',4),
                 ('Çanta','canta',5),('Aksesuar','aksesuar',6),('Elektronik','elektronik',7),
                 ('Ev & Yaşam','ev-yasam',8)) AS c(name, slug, ord)
  ON CONFLICT (store_id, slug) DO NOTHING;

  INSERT INTO public.collections (store_id, title, slug, description, sort_order)
  SELECT _store_id, c.title, c.slug, c.descr, c.ord
    FROM (VALUES ('Yeni Gelenler','yeni-gelenler','Vitrine yeni giren parçalar',1),
                 ('Çok Satanlar','cok-satanlar','En çok tercih edilen ürünler',2),
                 ('İndirim','indirim','Fiyatı düşen ürünler',3),
                 ('Sezon Ürünleri','sezon-urunleri','Sezona özel seçkiler',4),
                 ('Öne Çıkanlar','one-cikanlar','Editör seçkisi',5)) AS c(title, slug, descr, ord)
  ON CONFLICT (store_id, slug) DO NOTHING;

  FOR _rec IN
    SELECT * FROM (VALUES
      (1,'Oversize Pamuklu Tişört','kadin','Tişört',449,599,'active'),
      (2,'Yüksek Bel Straight Jean','kadin','Pantolon',899,1199,'active'),
      (3,'Keten Gömlek','kadin','Gömlek',749,0,'active'),
      (4,'Triko Kazak','kadin','Kazak',829,999,'active'),
      (5,'Midi Şifon Elbise','kadin','Elbise',1249,1599,'active'),
      (6,'Kruvaze Blazer Ceket','kadin','Ceket',1899,0,'active'),
      (7,'Slim Fit Oxford Gömlek','erkek','Gömlek',699,899,'active'),
      (8,'Basic Bisiklet Yaka Tişört','erkek','Tişört',299,0,'active'),
      (9,'Chino Pantolon','erkek','Pantolon',849,0,'active'),
      (10,'Kapüşonlu Sweatshirt','erkek','Sweatshirt',949,1199,'active'),
      (11,'Şişme Mont','erkek','Mont',2499,2999,'active'),
      (12,'Yün Karışımlı Palto','erkek','Palto',3299,0,'draft'),
      (13,'Çocuk Pamuklu Pijama Takımı','cocuk','Pijama',379,499,'active'),
      (14,'Çocuk Kot Ceket','cocuk','Ceket',649,0,'active'),
      (15,'Çocuk Sweatshirt','cocuk','Sweatshirt',429,0,'active'),
      (16,'Deri Sneaker','ayakkabi','Sneaker',1799,2199,'active'),
      (17,'Koşu Ayakkabısı','ayakkabi','Spor Ayakkabı',1599,0,'active'),
      (18,'Klasik Loafer','ayakkabi','Klasik',1399,1699,'active'),
      (19,'Bilekli Bot','ayakkabi','Bot',2099,0,'active'),
      (20,'Deri Omuz Çantası','canta','Omuz Çantası',1699,2099,'active'),
      (21,'Sırt Çantası','canta','Sırt Çantası',999,0,'active'),
      (22,'Şehir Tipi Laptop Çantası','canta','Laptop Çantası',1199,1499,'active'),
      (23,'Güneş Gözlüğü','aksesuar','Gözlük',899,0,'active'),
      (24,'Deri Kemer','aksesuar','Kemer',449,0,'active'),
      (25,'Çelik Kordon Saat','aksesuar','Saat',2799,3499,'active'),
      (26,'Kablosuz Kulaklık','elektronik','Kulaklık',1999,2499,'active'),
      (27,'Bluetooth Hoparlör','elektronik','Hoparlör',1299,0,'active'),
      (28,'Akıllı Bileklik','elektronik','Giyilebilir',899,1099,'active'),
      (29,'Pamuk Nevresim Takımı','ev-yasam','Nevresim',1099,1399,'active'),
      (30,'Seramik Kahve Fincanı Seti','ev-yasam','Mutfak',549,0,'archived')
    ) AS p(idx, title, cat, ptype, price, compare, status)
  LOOP
    _slug := 'demo-' || _rec.idx || '-' ||
             regexp_replace(lower(translate(_rec.title, 'ğüşıöçĞÜŞİÖÇ', 'gusiocgusioc')), '[^a-z0-9]+', '-', 'g');
    _slug := btrim(_slug, '-');

    SELECT id INTO _pid FROM public.products WHERE store_id = _store_id AND slug = _slug;
    IF _pid IS NULL THEN
      INSERT INTO public.products (store_id, title, slug, description, status, product_type, tags,
                                   base_price, compare_at_price, currency, track_inventory, sku, barcode,
                                   seo, category_id, vendor, cost_price, tax_rate, weight_grams,
                                   length_cm, width_cm, height_cm)
      VALUES (_store_id, _rec.title, _slug,
              _rec.title || ' — nefes alan kaliteli kumaş ve özenli dikiş detayları. Günlük kullanım için tasarlandı, 30°C''de yıkanabilir.',
              _rec.status::public.product_status, _rec.ptype,
              CASE WHEN _rec.idx % 4 = 0 THEN ARRAY['featured','yeni-sezon'] ELSE ARRAY['yeni-sezon'] END,
              _rec.price, NULLIF(_rec.compare, 0), _store.currency, true,
              'MEFD-' || lpad(_rec.idx::text, 4, '0'), '8688' || lpad(_rec.idx::text, 9, '0'),
              jsonb_build_object(
                'title', _rec.title || ' | ' || _store.name,
                'description', _rec.title || ' modelini avantajlı fiyatla keşfedin. Aynı gün kargo, 14 gün içinde kolay iade.',
                'slug', _slug),
              (SELECT id FROM public.categories WHERE store_id = _store_id AND slug = _rec.cat),
              'Mefti Studio', round(_rec.price * 0.52, 2), 10, 450, 32, 24, 6)
      RETURNING id INTO _pid;

      FOR _i IN 1..2 LOOP
        INSERT INTO public.product_variants (product_id, store_id, title, sku, barcode, options, price,
                                             compare_at_price, cost_price, stock, low_stock_threshold,
                                             weight_grams, position)
        VALUES (_pid, _store_id,
                CASE _i WHEN 1 THEN 'M / Siyah' ELSE 'L / Beyaz' END,
                'MEFD-' || lpad(_rec.idx::text, 4, '0') || '-' || _i,
                '8699' || lpad((_rec.idx * 10 + _i)::text, 9, '0'),
                jsonb_build_object('Beden', CASE _i WHEN 1 THEN 'M' ELSE 'L' END,
                                   'Renk', CASE _i WHEN 1 THEN 'Siyah' ELSE 'Beyaz' END),
                _rec.price, NULLIF(_rec.compare, 0), round(_rec.price * 0.52, 2),
                CASE WHEN _rec.idx % 10 = 0 THEN 0
                     WHEN _rec.idx % 7 = 0 THEN 3
                     ELSE 12 + ((_rec.idx * _i) % 40) END,
                5, 450, _i)
        ON CONFLICT (store_id, sku) DO NOTHING;
      END LOOP;

      INSERT INTO public.product_images (product_id, store_id, url, alt, position)
      SELECT _pid, _store_id,
             'https://picsum.photos/seed/mefti-' || _rec.idx || '-' || g || '/900/1100',
             _rec.title || ' ürün görseli ' || g, g
        FROM generate_series(1, 2) g;

      INSERT INTO public.product_collections (product_id, collection_id)
      SELECT _pid, c.id FROM public.collections c
       WHERE c.store_id = _store_id
         AND c.slug IN (
           CASE WHEN _rec.idx % 3 = 0 THEN 'cok-satanlar' ELSE 'yeni-gelenler' END,
           CASE WHEN _rec.compare > 0 THEN 'indirim' ELSE 'sezon-urunleri' END,
           CASE WHEN _rec.idx % 4 = 0 THEN 'one-cikanlar' ELSE 'sezon-urunleri' END)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  FOR _i IN 1..20 LOOP
    SELECT id INTO _cust FROM public.customers
     WHERE store_id = _store_id AND email = 'demo' || _i || '@mefticaret.test';
    IF _cust IS NULL THEN
      INSERT INTO public.customers (store_id, full_name, first_name, last_name, email, phone,
                                    accepts_marketing, tags, notes, created_at, last_activity_at)
      VALUES (_store_id, _names[_i],
              split_part(_names[_i], ' ', 1), split_part(_names[_i], ' ', 2),
              'demo' || _i || '@mefticaret.test',
              '+90 5' || lpad((300000000 + _i * 111111)::text, 9, '0'),
              (_i % 3 <> 0),
              CASE WHEN _i % 5 = 0 THEN ARRAY['vip'] WHEN _i % 4 = 0 THEN ARRAY['yeni'] ELSE ARRAY['demo'] END,
              'Demo müşteri kaydı',
              now() - ((_i * 4) || ' days')::interval,
              now() - ((_i) || ' days')::interval);
    END IF;
  END LOOP;

  SELECT array_agg(id ORDER BY created_at) INTO _product_ids
    FROM public.products WHERE store_id = _store_id AND status = 'active';
  SELECT array_agg(id ORDER BY created_at) INTO _customer_ids
    FROM public.customers WHERE store_id = _store_id;
  _n := COALESCE(array_length(_product_ids, 1), 0);

  IF _n >= 2 THEN
    FOR _i IN 1..20 LOOP
      IF EXISTS (SELECT 1 FROM public.orders
                  WHERE store_id = _store_id AND order_number = 'DMO-' || lpad(_i::text, 4, '0')) THEN
        CONTINUE;
      END IF;

      _p1 := _product_ids[1 + ((_i * 2) % _n)];
      _p2 := _product_ids[1 + ((_i * 2 + 1) % _n)];
      SELECT title, base_price INTO _t1, _pr1 FROM public.products WHERE id = _p1;
      SELECT title, base_price INTO _t2, _pr2 FROM public.products WHERE id = _p2;
      SELECT id INTO _v1 FROM public.product_variants WHERE product_id = _p1 ORDER BY position LIMIT 1;
      SELECT id INTO _v2 FROM public.product_variants WHERE product_id = _p2 ORDER BY position LIMIT 1;
      _q1 := 1 + (_i % 3);
      _q2 := 1 + ((_i + 1) % 2);

      _subtotal := round(_pr1 * _q1 + _pr2 * _q2, 2);
      _discount := CASE WHEN _i % 5 = 0 THEN round(_subtotal * 0.10, 2) ELSE 0 END;
      _tax := round((_subtotal - _discount) * 0.10, 2);
      _ship := CASE WHEN _subtotal - _discount >= 750 THEN 0 ELSE 49.90 END;
      _total := round(_subtotal - _discount + _tax + _ship, 2);

      SELECT CASE _i % 7
               WHEN 0 THEN 'pending'
               WHEN 1 THEN 'paid'
               WHEN 2 THEN 'processing'
               WHEN 3 THEN 'shipped'
               WHEN 4 THEN 'delivered'
               WHEN 5 THEN 'cancelled'
               ELSE 'refunded' END INTO _status;
      _pay := CASE _status
                WHEN 'pending' THEN 'pending'::public.payment_status
                WHEN 'cancelled' THEN 'failed'::public.payment_status
                WHEN 'refunded' THEN 'refunded'::public.payment_status
                ELSE 'paid'::public.payment_status END;
      _ful := CASE _status
                WHEN 'delivered' THEN 'fulfilled'::public.fulfillment_status
                WHEN 'shipped' THEN 'fulfilled'::public.fulfillment_status
                WHEN 'refunded' THEN 'returned'::public.fulfillment_status
                ELSE 'unfulfilled'::public.fulfillment_status END;

      _cust := _customer_ids[1 + (_i % COALESCE(array_length(_customer_ids, 1), 1))];

      INSERT INTO public.orders (store_id, customer_id, order_number, status, payment_status,
                                 fulfillment_status, currency, subtotal, discount_total, shipping_total,
                                 tax_total, grand_total, discount_code, customer_email, customer_name,
                                 customer_phone, shipping_address, billing_address, shipping_carrier,
                                 tracking_number, note, placed_at, created_at)
      SELECT _store_id, c.id, 'DMO-' || lpad(_i::text, 4, '0'), _status, _pay, _ful, _store.currency,
             _subtotal, _discount, _ship, _tax, _total,
             CASE WHEN _discount > 0 THEN 'WELCOME10' ELSE NULL END,
             c.email, c.full_name, c.phone,
             jsonb_build_object('full_name', c.full_name, 'line1', 'Demo Mah. ' || _i || '. Sok. No:' || _i,
                                'city', _cities[1 + (_i % 10)], 'country_code', 'TR'),
             jsonb_build_object('full_name', c.full_name, 'line1', 'Demo Mah. ' || _i || '. Sok. No:' || _i,
                                'city', _cities[1 + (_i % 10)], 'country_code', 'TR'),
             CASE WHEN _status IN ('shipped','delivered') THEN 'Mefti Kargo' ELSE NULL END,
             CASE WHEN _status IN ('shipped','delivered') THEN 'MK' || lpad(_i::text, 9, '0') ELSE NULL END,
             'Demo sipariş kaydı',
             now() - ((_i * 3) || ' days')::interval,
             now() - ((_i * 3) || ' days')::interval
        FROM public.customers c WHERE c.id = _cust
      RETURNING id INTO _oid;

      INSERT INTO public.order_items (order_id, store_id, product_id, variant_id, title, variant_title,
                                      sku, unit_price, quantity, line_total, tax_rate, tax_total)
      VALUES (_oid, _store_id, _p1, _v1, _t1, 'M / Siyah',
              (SELECT sku FROM public.product_variants WHERE id = _v1),
              _pr1, _q1, round(_pr1 * _q1, 2), 10, round(_pr1 * _q1 * 0.10, 2)),
             (_oid, _store_id, _p2, _v2, _t2, 'M / Siyah',
              (SELECT sku FROM public.product_variants WHERE id = _v2),
              _pr2, _q2, round(_pr2 * _q2, 2), 10, round(_pr2 * _q2 * 0.10, 2));

      INSERT INTO public.order_addresses (order_id, store_id, kind, full_name, phone, line1, district,
                                          city, postal_code, country_code)
      SELECT _oid, _store_id, k.kind, c.full_name, c.phone,
             'Demo Mah. ' || _i || '. Sok. No:' || _i, 'Merkez',
             _cities[1 + (_i % 10)], lpad(((_i * 137) % 81000 + 1000)::text, 5, '0'), 'TR'
        FROM public.customers c, (VALUES ('billing'), ('shipping')) AS k(kind)
       WHERE c.id = _cust;
    END LOOP;
  END IF;

  FOR _i IN 1..10 LOOP
    IF EXISTS (SELECT 1 FROM public.abandoned_carts
                WHERE store_id = _store_id AND cart_token = 'demo-cart-' || _i) THEN
      CONTINUE;
    END IF;

    _p1 := _product_ids[1 + ((_i * 3) % GREATEST(_n, 1))];
    SELECT title, base_price INTO _t1, _pr1 FROM public.products WHERE id = _p1;
    SELECT id INTO _v1 FROM public.product_variants WHERE product_id = _p1 ORDER BY position LIMIT 1;
    _q1 := 1 + (_i % 2);
    _subtotal := round(_pr1 * _q1, 2);
    _cust := _customer_ids[1 + ((_i * 2) % COALESCE(array_length(_customer_ids, 1), 1))];

    INSERT INTO public.carts (store_id, customer_id, session_token, currency, subtotal, discount_total,
                              shipping_total, tax_total, grand_total, abandoned_at, created_at, updated_at)
    VALUES (_store_id, _cust, 'demo-cart-' || _i, _store.currency, _subtotal, 0, 49.90,
            round(_subtotal * 0.10, 2), round(_subtotal * 1.10 + 49.90, 2),
            now() - ((_i * 2) || ' days')::interval,
            now() - ((_i * 2 + 1) || ' days')::interval,
            now() - ((_i * 2) || ' days')::interval)
    RETURNING id INTO _cart;

    INSERT INTO public.cart_items (cart_id, store_id, product_id, variant_id, title, variant_title, sku,
                                   unit_price, quantity, line_total)
    VALUES (_cart, _store_id, _p1, _v1, _t1, 'M / Siyah',
            (SELECT sku FROM public.product_variants WHERE id = _v1),
            _pr1, _q1, _subtotal);

    INSERT INTO public.abandoned_carts (store_id, cart_token, customer_email, customer_name, items,
                                        item_count, total, currency, recovered_order_id, last_seen_at,
                                        created_at)
    SELECT _store_id, 'demo-cart-' || _i, c.email, c.full_name,
           jsonb_build_array(jsonb_build_object('title', _t1, 'quantity', _q1, 'unit_price', _pr1)),
           _q1, round(_subtotal * 1.10 + 49.90, 2), _store.currency,
           CASE WHEN _i % 5 = 0
                THEN (SELECT id FROM public.orders WHERE store_id = _store_id
                       ORDER BY placed_at DESC LIMIT 1)
                ELSE NULL END,
           now() - ((_i * 2) || ' days')::interval,
           now() - ((_i * 2 + 1) || ' days')::interval
      FROM public.customers c WHERE c.id = _cust;
  END LOOP;

  FOR _rec IN
    SELECT * FROM (VALUES
      ('WELCOME10','Hoş geldin indirimi','percentage',10,0,500,30),
      ('SAVE20','Sepette %20','percentage',20,750,200,45),
      ('MEFTICARET15','Mefticaret özel %15','percentage',15,500,100,60),
      ('NEWUSER','Yeni üyeye 100 TL','fixed_amount',100,400,150,90),
      ('FREESHIP','Ücretsiz kargo','free_shipping',0,300,500,120)
    ) AS d(code, title, dtype, value, min_sub, usage_limit, days)
  LOOP
    SELECT id INTO _did FROM public.discounts WHERE store_id = _store_id AND code = _rec.code;
    IF _did IS NULL THEN
      INSERT INTO public.discounts (store_id, code, title, type, value, min_subtotal, usage_limit,
                                    used_count, starts_at, ends_at, is_active)
      VALUES (_store_id, _rec.code, _rec.title, _rec.dtype::public.discount_type, _rec.value,
              _rec.min_sub, _rec.usage_limit, (_rec.value::int % 7), now() - interval '15 days',
              now() + (_rec.days || ' days')::interval, _rec.code <> 'NEWUSER')
      RETURNING id INTO _did;
    END IF;

    INSERT INTO public.discount_codes (store_id, discount_id, code, usage_limit, usage_count,
                                       per_customer_limit, is_active, expires_at)
    VALUES (_store_id, _did, _rec.code, _rec.usage_limit, (_rec.value::int % 7), 1,
            _rec.code <> 'NEWUSER', now() + (_rec.days || ' days')::interval)
    ON CONFLICT (store_id, code) DO NOTHING;
  END LOOP;

  INSERT INTO public.store_themes (store_id, hero_title, hero_subtitle, hero_cta_label, announcement,
                                   show_announcement, is_published, published_at)
  VALUES (_store_id, _store.name || ' yeni sezon', 'Seçkin parçalar, hızlı teslimat, güvenli ödeme.',
          'Koleksiyonu keşfet', 'Tüm siparişlerde kargo bedava', true, true, now())
  ON CONFLICT (store_id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.store_theme_sections WHERE store_id = _store_id) THEN
    INSERT INTO public.store_theme_sections (store_id, type, position, is_enabled, settings)
    VALUES
      (_store_id, 'announcement_bar', 0, true, jsonb_build_object('text','Tüm siparişlerde kargo bedava','linkLabel','Detaylar','linkUrl','/s/' || _store.slug || '/products','tone','accent')),
      (_store_id, 'header', 1, true, jsonb_build_object('showSearch',true,'showCart',true,'showFavorites',true,'sticky',true,'tagline','Yeni sezon vitrini')),
      (_store_id, 'hero', 2, true, jsonb_build_object('title',_store.name || ' yeni sezon','subtitle','Seçkin parçalar, hızlı teslimat, güvenli ödeme.','ctaLabel','Koleksiyonu keşfet','ctaUrl','#urunler','imageUrl','https://picsum.photos/seed/mefti-hero/1600/900','align','left','height',460)),
      (_store_id, 'category_grid', 3, true, jsonb_build_object('title','Kategoriler','source','collections','limit',8,'columns',4)),
      (_store_id, 'product_grid', 4, true, jsonb_build_object('title','Öne çıkan ürünler','collectionSlug','one-cikanlar','limit',8,'columns',4,'showSearch',false,'showPrice',true)),
      (_store_id, 'banner', 5, true, jsonb_build_object('title','Sezon sonu %40 indirim','text','Stoklar tükenmeden yeni koleksiyonu keşfet.','ctaLabel','İncele','ctaUrl','#urunler','imageUrl','','style','gradient')),
      (_store_id, 'product_slider', 6, true, jsonb_build_object('title','Çok satanlar','collectionSlug','cok-satanlar','limit',10,'cardWidth',240)),
      (_store_id, 'product_grid', 7, true, jsonb_build_object('title','Yeni gelenler','collectionSlug','yeni-gelenler','limit',8,'columns',4,'showSearch',true,'showPrice',true)),
      (_store_id, 'image_text', 8, true, jsonb_build_object('title','Atölyemizden','text','Her parça sınırlı sayıda üretilir ve tek tek kontrol edilir.','imageUrl','https://picsum.photos/seed/mefti-atolye/1200/800','imagePosition','left','ctaLabel','Hakkımızda','ctaUrl','/s/' || _store.slug || '/about')),
      (_store_id, 'testimonials', 9, true, jsonb_build_object('title','Müşterilerimiz ne diyor?','items','Kalitesi beklediğimden iyi çıktı, kargo hızlıydı. | Ayşe D.')),
      (_store_id, 'newsletter', 10, true, jsonb_build_object('title','Kampanyaları ilk sen öğren','text','E-posta listemize katıl, yeni koleksiyon ve indirimlerden haberdar ol.','buttonLabel','Kaydol','successMessage','Teşekkürler! Kaydınızı aldık.')),
      (_store_id, 'footer', 11, true, jsonb_build_object('about',_store.name || ' — çevrim içi mağaza','email','destek@mefticaret.test','phone','+90 850 000 00 00','showLegalLinks',true,'showPages',true,'copyright','© ' || to_char(now(),'YYYY') || ' ' || _store.name));
  END IF;

  SELECT id INTO _wid FROM public.store_webhooks WHERE store_id = _store_id AND name = 'Demo entegrasyon';
  IF _wid IS NULL THEN
    INSERT INTO public.store_webhooks (store_id, name, description, target_url, events, secret,
                                       is_active, api_version, max_attempts, signature_algorithm)
    VALUES (_store_id, 'Demo entegrasyon', 'Sipariş ve ürün olaylarını dinleyen demo uç nokta',
            'https://webhook.site/mefticaret-demo',
            ARRAY['order.created','order.updated','order.paid','order.fulfilled','product.created','product.updated','customer.created'],
            encode(gen_random_bytes(24), 'hex'), true, 'v1', 5, 'sha256')
    RETURNING id INTO _wid;

    INSERT INTO public.webhook_deliveries (webhook_id, store_id, event, payload, status, response_status,
                                           attempt, error_message, next_retry_at, delivered_at, duration_ms)
    VALUES
      (_wid, _store_id, 'order.created', jsonb_build_object('demo', true), 'success', 200, 1, NULL, NULL, now() - interval '2 hours', 184),
      (_wid, _store_id, 'order.paid', jsonb_build_object('demo', true), 'success', 200, 1, NULL, NULL, now() - interval '5 hours', 142),
      (_wid, _store_id, 'product.updated', jsonb_build_object('demo', true), 'failed', 500, 2, 'Uç nokta 500 döndü', now() + interval '10 minutes', NULL, 2312),
      (_wid, _store_id, 'customer.created', jsonb_build_object('demo', true), 'pending', NULL, 0, NULL, now() + interval '1 minute', NULL, NULL);
  END IF;

  FOR _i IN 0..89 LOOP
    PERFORM public.rollup_store_daily_stats((current_date - _i)::date);
  END LOOP;

  SELECT jsonb_build_object(
           'store', _store.slug,
           'products', (SELECT count(*) FROM public.products WHERE store_id = _store_id),
           'variants', (SELECT count(*) FROM public.product_variants WHERE store_id = _store_id),
           'categories', (SELECT count(*) FROM public.categories WHERE store_id = _store_id),
           'collections', (SELECT count(*) FROM public.collections WHERE store_id = _store_id),
           'customers', (SELECT count(*) FROM public.customers WHERE store_id = _store_id),
           'orders', (SELECT count(*) FROM public.orders WHERE store_id = _store_id),
           'abandoned_carts', (SELECT count(*) FROM public.abandoned_carts WHERE store_id = _store_id),
           'discounts', (SELECT count(*) FROM public.discounts WHERE store_id = _store_id),
           'theme_sections', (SELECT count(*) FROM public.store_theme_sections WHERE store_id = _store_id))
    INTO _out;

  RETURN _out;
END;
$fn$;

REVOKE ALL ON FUNCTION public.seed_demo_store(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_demo_store(uuid) TO service_role;