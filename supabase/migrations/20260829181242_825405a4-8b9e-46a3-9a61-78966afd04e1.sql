CREATE TYPE public.order_status AS ENUM ('pending','processing','shipped','delivered','cancelled','refunded');
CREATE TYPE public.payment_status AS ENUM ('pending','paid','partially_refunded','refunded','failed');
CREATE TYPE public.fulfillment_status AS ENUM ('unfulfilled','partially_fulfilled','fulfilled','returned');
CREATE TYPE public.discount_type AS ENUM ('percentage','fixed_amount','free_shipping');

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid,
  full_name text NOT NULL,
  email text,
  phone text,
  accepts_marketing boolean NOT NULL DEFAULT false,
  notes text,
  tags text[] NOT NULL DEFAULT '{}',
  total_spent numeric(12,2) NOT NULL DEFAULT 0,
  orders_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX customers_store_email_key ON public.customers(store_id, lower(email)) WHERE email IS NOT NULL;
CREATE INDEX customers_store_idx ON public.customers(store_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers_read" ON public.customers FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "customers_write" ON public.customers FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER customers_set_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  label text,
  recipient text NOT NULL,
  phone text,
  country text NOT NULL DEFAULT 'TR',
  city text,
  district text,
  line1 text NOT NULL,
  line2 text,
  postal_code text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_addresses_customer_idx ON public.customer_addresses(customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_addresses TO authenticated;
GRANT ALL ON public.customer_addresses TO service_role;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customer_addresses_read" ON public.customer_addresses FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "customer_addresses_write" ON public.customer_addresses FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER customer_addresses_set_updated_at BEFORE UPDATE ON public.customer_addresses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text,
  type public.discount_type NOT NULL DEFAULT 'percentage',
  value numeric(12,2) NOT NULL DEFAULT 0,
  min_subtotal numeric(12,2) NOT NULL DEFAULT 0,
  usage_limit integer,
  used_count integer NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX discounts_store_code_key ON public.discounts(store_id, upper(code));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discounts TO authenticated;
GRANT ALL ON public.discounts TO service_role;
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "discounts_read" ON public.discounts FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "discounts_write" ON public.discounts FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER discounts_set_updated_at BEFORE UPDATE ON public.discounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  order_number text NOT NULL,
  status public.order_status NOT NULL DEFAULT 'pending',
  payment_status public.payment_status NOT NULL DEFAULT 'pending',
  fulfillment_status public.fulfillment_status NOT NULL DEFAULT 'unfulfilled',
  currency text NOT NULL DEFAULT 'TRY',
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount_total numeric(12,2) NOT NULL DEFAULT 0,
  shipping_total numeric(12,2) NOT NULL DEFAULT 0,
  tax_total numeric(12,2) NOT NULL DEFAULT 0,
  grand_total numeric(12,2) NOT NULL DEFAULT 0,
  discount_code text,
  customer_email text,
  customer_name text,
  shipping_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  billing_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  shipping_carrier text,
  tracking_number text,
  note text,
  placed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX orders_store_number_key ON public.orders(store_id, order_number);
CREATE INDEX orders_store_placed_idx ON public.orders(store_id, placed_at DESC);
CREATE INDEX orders_customer_idx ON public.orders(customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_read" ON public.orders FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "orders_write" ON public.orders FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  title text NOT NULL,
  variant_title text,
  sku text,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  line_total numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_items_order_idx ON public.order_items(order_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items_read" ON public.order_items FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "order_items_write" ON public.order_items FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE TABLE public.order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  actor_id uuid,
  kind text NOT NULL,
  message text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_events_order_idx ON public.order_events(order_id, created_at DESC);
GRANT SELECT, INSERT ON public.order_events TO authenticated;
GRANT ALL ON public.order_events TO service_role;
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_events_read" ON public.order_events FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "order_events_insert" ON public.order_events FOR INSERT TO authenticated
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

DO $$
DECLARE
  s_id uuid; c1 uuid; c2 uuid; c3 uuid; o_id uuid; pick uuid;
  v RECORD; i integer := 0;
  st public.order_status; ps public.payment_status; fs public.fulfillment_status;
  sub numeric; disc numeric; ship numeric; tax numeric;
BEGIN
  SELECT id INTO s_id FROM public.stores WHERE is_demo = true ORDER BY created_at LIMIT 1;
  IF s_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.customers (store_id, full_name, email, phone, accepts_marketing, tags)
  VALUES (s_id, 'Elif Yıldırım', 'elif.yildirim@example.com', '+90 532 111 22 33', true, ARRAY['vip']),
         (s_id, 'Mert Kaya', 'mert.kaya@example.com', '+90 533 444 55 66', false, ARRAY['yeni']),
         (s_id, 'Zeynep Demir', 'zeynep.demir@example.com', '+90 534 777 88 99', true, ARRAY['tekrar-alan']);

  SELECT id INTO c1 FROM public.customers WHERE store_id = s_id AND email = 'elif.yildirim@example.com';
  SELECT id INTO c2 FROM public.customers WHERE store_id = s_id AND email = 'mert.kaya@example.com';
  SELECT id INTO c3 FROM public.customers WHERE store_id = s_id AND email = 'zeynep.demir@example.com';

  INSERT INTO public.customer_addresses (customer_id, store_id, label, recipient, phone, city, district, line1, postal_code, is_default)
  VALUES (c1, s_id, 'Ev', 'Elif Yıldırım', '+90 532 111 22 33', 'İstanbul', 'Kadıköy', 'Caferağa Mah. Moda Cad. No 12/4', '34710', true),
         (c2, s_id, 'İş', 'Mert Kaya', '+90 533 444 55 66', 'Ankara', 'Çankaya', 'Kızılay Mah. Atatürk Blv. No 88', '06420', true),
         (c3, s_id, 'Ev', 'Zeynep Demir', '+90 534 777 88 99', 'İzmir', 'Karşıyaka', 'Bostanlı Mah. Sahil Cad. No 5', '35590', true);

  INSERT INTO public.discounts (store_id, code, title, type, value, min_subtotal, usage_limit, used_count, ends_at)
  VALUES (s_id, 'HOSGELDIN10', 'İlk siparişe %10', 'percentage', 10, 500, 500, 42, now() + interval '60 days'),
         (s_id, 'KARGOBEDAVA', 'Ücretsiz kargo', 'free_shipping', 0, 750, NULL, 118, now() + interval '30 days'),
         (s_id, 'SEZON250', '250 TL indirim', 'fixed_amount', 250, 2000, 200, 17, now() + interval '20 days');

  FOR v IN
    SELECT pv.id AS variant_id, pv.product_id, pv.title AS variant_title, pv.sku, pv.price, p.title
    FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
    WHERE pv.store_id = s_id
    ORDER BY pv.created_at
    LIMIT 8
  LOOP
    i := i + 1;
    st := (ARRAY['delivered','shipped','processing','pending','cancelled','delivered','delivered','processing']::public.order_status[])[i];
    ps := CASE WHEN st IN ('delivered','shipped','processing') THEN 'paid'::public.payment_status
               WHEN st = 'cancelled' THEN 'refunded'::public.payment_status
               ELSE 'pending'::public.payment_status END;
    fs := CASE WHEN st = 'delivered' THEN 'fulfilled'::public.fulfillment_status
               WHEN st = 'shipped' THEN 'partially_fulfilled'::public.fulfillment_status
               ELSE 'unfulfilled'::public.fulfillment_status END;
    pick := (ARRAY[c1, c2, c3])[(i % 3) + 1];
    sub := round(v.price * (1 + (i % 3)), 2);
    disc := CASE WHEN i % 3 = 0 THEN 250 ELSE 0 END;
    ship := CASE WHEN i % 2 = 0 THEN 0 ELSE 49.90 END;
    tax := round(sub * 0.18, 2);

    INSERT INTO public.orders (
      store_id, customer_id, order_number, status, payment_status, fulfillment_status,
      subtotal, discount_total, shipping_total, tax_total, grand_total,
      customer_email, customer_name, shipping_address, billing_address,
      shipping_carrier, tracking_number, placed_at
    )
    SELECT s_id, c.id,
      'MEF-' || to_char(now() - (i || ' days')::interval, 'YYYYMM') || '-' || lpad(i::text, 4, '0'),
      st, ps, fs, sub, disc, ship, tax, sub + tax + ship - disc,
      c.email, c.full_name,
      jsonb_build_object('recipient', c.full_name, 'city', 'İstanbul', 'district', 'Kadıköy', 'line1', 'Moda Cad. No 12', 'country', 'TR'),
      jsonb_build_object('recipient', c.full_name, 'city', 'İstanbul', 'district', 'Kadıköy', 'line1', 'Moda Cad. No 12', 'country', 'TR'),
      CASE WHEN i % 2 = 0 THEN 'Yurtiçi Kargo' ELSE 'MNG Kargo' END,
      CASE WHEN st IN ('shipped','delivered') THEN 'TR' || lpad((100000 + i * 137)::text, 9, '0') ELSE NULL END,
      now() - (i || ' days')::interval
    FROM public.customers c WHERE c.id = pick
    RETURNING id INTO o_id;

    INSERT INTO public.order_items (order_id, store_id, product_id, variant_id, title, variant_title, sku, unit_price, quantity, line_total)
    VALUES (o_id, s_id, v.product_id, v.variant_id, v.title, v.variant_title, v.sku, v.price, 1 + (i % 3), sub);

    INSERT INTO public.order_events (order_id, store_id, kind, message)
    VALUES (o_id, s_id, 'created', 'Sipariş oluşturuldu'),
           (o_id, s_id, 'status', 'Durum: ' || st::text);
  END LOOP;

  UPDATE public.customers c SET orders_count = agg.cnt, total_spent = agg.total
  FROM (SELECT customer_id, count(*) AS cnt, sum(grand_total) AS total FROM public.orders WHERE store_id = s_id GROUP BY customer_id) agg
  WHERE c.id = agg.customer_id;
END $$;