CREATE OR REPLACE FUNCTION public.analytics_v2(_store_id uuid, _section text, _from timestamptz, _to timestamptz, _bucket text DEFAULT 'day')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _len interval := _to - _from;
  _pfrom timestamptz := _from - (_to - _from);
  _b text := CASE WHEN _bucket IN ('hour','day','week','month') THEN _bucket ELSE 'day' END;
  res jsonb;
BEGIN
  IF _to <= _from OR _len > interval '400 days' THEN RAISE EXCEPTION 'invalid_range'; END IF;

  IF _section = 'overview' THEN
    WITH per AS (
      SELECT p.k, p.f, p.t FROM (VALUES ('current', _from, _to), ('previous', _pfrom, _from)) AS p(k, f, t)
    ), o AS (
      SELECT per.k, count(x.id) AS orders, coalesce(sum(x.grand_total),0) AS revenue
      FROM per LEFT JOIN orders x ON x.store_id = _store_id AND x.placed_at >= per.f AND x.placed_at < per.t
        AND x.payment_status IN ('paid','partially_refunded') AND x.status <> 'cancelled'
      GROUP BY per.k
    ), e AS (
      SELECT per.k, count(DISTINCT a.visitor_id) AS visitors, count(DISTINCT a.session_id) AS sessions
      FROM per LEFT JOIN analytics_events a ON a.store_id = _store_id AND a.created_at >= per.f AND a.created_at < per.t
      GROUP BY per.k
    )
    SELECT jsonb_build_object(
      'current', (SELECT jsonb_build_object('revenue', o.revenue, 'orders', o.orders, 'aov', CASE WHEN o.orders>0 THEN round(o.revenue/o.orders,2) ELSE 0 END,
                   'visitors', e.visitors, 'sessions', e.sessions, 'conversion_rate', CASE WHEN e.sessions>0 THEN round(o.orders::numeric/e.sessions,4) ELSE 0 END)
                  FROM o JOIN e USING (k) WHERE k='current'),
      'previous', (SELECT jsonb_build_object('revenue', o.revenue, 'orders', o.orders, 'aov', CASE WHEN o.orders>0 THEN round(o.revenue/o.orders,2) ELSE 0 END,
                   'visitors', e.visitors, 'sessions', e.sessions, 'conversion_rate', CASE WHEN e.sessions>0 THEN round(o.orders::numeric/e.sessions,4) ELSE 0 END)
                  FROM o JOIN e USING (k) WHERE k='previous')
    ) INTO res;
    RETURN res;
  END IF;

  IF _section = 'series' THEN
    WITH buckets AS (
      SELECT generate_series(date_trunc(_b, _from AT TIME ZONE 'Europe/Istanbul'), date_trunc(_b, (_to - interval '1 second') AT TIME ZONE 'Europe/Istanbul'), ('1 ' || _b)::interval) AS b
    ), o AS (
      SELECT date_trunc(_b, placed_at AT TIME ZONE 'Europe/Istanbul') b, count(*) orders, sum(grand_total) revenue
      FROM orders WHERE store_id=_store_id AND placed_at>=_from AND placed_at<_to AND payment_status IN ('paid','partially_refunded') AND status<>'cancelled' GROUP BY 1
    ), e AS (
      SELECT date_trunc(_b, created_at AT TIME ZONE 'Europe/Istanbul') b, count(DISTINCT visitor_id) visitors, count(DISTINCT session_id) sessions
      FROM analytics_events WHERE store_id=_store_id AND created_at>=_from AND created_at<_to GROUP BY 1
    )
    SELECT coalesce(jsonb_agg(jsonb_build_object('t', to_char(buckets.b, 'YYYY-MM-DD"T"HH24:MI'), 'revenue', coalesce(o.revenue,0), 'orders', coalesce(o.orders,0),
      'visitors', coalesce(e.visitors,0), 'sessions', coalesce(e.sessions,0),
      'conversion_rate', CASE WHEN coalesce(e.sessions,0)>0 THEN round(coalesce(o.orders,0)::numeric/e.sessions,4) ELSE 0 END) ORDER BY buckets.b), '[]')
    INTO res FROM buckets LEFT JOIN o USING (b) LEFT JOIN e USING (b);
    RETURN res;
  END IF;

  IF _section = 'sales' THEN
    SELECT jsonb_build_object(
      'breakdown', (SELECT jsonb_build_object('gross', coalesce(sum(subtotal),0), 'discount', coalesce(sum(discount_total),0), 'tax', coalesce(sum(tax_total),0),
                     'shipping', coalesce(sum(shipping_total),0), 'total', coalesce(sum(grand_total),0), 'orders', count(*))
                    FROM orders WHERE store_id=_store_id AND placed_at>=_from AND placed_at<_to AND payment_status IN ('paid','partially_refunded') AND status<>'cancelled'),
      'refunds', (SELECT coalesce(sum(amount),0) FROM refunds WHERE store_id=_store_id AND status IN ('succeeded','completed','processed') AND created_at>=_from AND created_at<_to),
      'payment_methods', (SELECT coalesce(jsonb_agg(jsonb_build_object('method', m, 'amount', amt, 'count', c) ORDER BY amt DESC), '[]') FROM (
          SELECT coalesce(nullif(p.method,''), p.provider) m, sum(p.amount) amt, count(*) c FROM payments p
          WHERE p.store_id=_store_id AND p.status IN ('paid','partially_refunded') AND coalesce(p.captured_at,p.created_at)>=_from AND coalesce(p.captured_at,p.created_at)<_to GROUP BY 1) q),
      'heatmap', (SELECT coalesce(jsonb_agg(jsonb_build_object('dow', d, 'hour', h, 'orders', c, 'revenue', r)), '[]') FROM (
          SELECT extract(isodow FROM placed_at AT TIME ZONE 'Europe/Istanbul')::int d, extract(hour FROM placed_at AT TIME ZONE 'Europe/Istanbul')::int h, count(*) c, sum(grand_total) r
          FROM orders WHERE store_id=_store_id AND placed_at>=_from AND placed_at<_to AND payment_status IN ('paid','partially_refunded') AND status<>'cancelled' GROUP BY 1,2) q)
    ) INTO res;
    RETURN res;
  END IF;

  IF _section = 'orders' THEN
    SELECT jsonb_build_object(
      'statuses', (SELECT coalesce(jsonb_agg(jsonb_build_object('status', status, 'count', c)), '[]') FROM (
          SELECT status::text, count(*) c FROM orders WHERE store_id=_store_id AND placed_at>=_from AND placed_at<_to GROUP BY 1) q),
      'total', (SELECT count(*) FROM orders WHERE store_id=_store_id AND placed_at>=_from AND placed_at<_to),
      'avg_fulfillment_hours', (SELECT round(avg(extract(epoch FROM (s.first_ship - o.placed_at))/3600)::numeric, 1) FROM orders o
          JOIN LATERAL (SELECT min(shipped_at) first_ship FROM shipments sh WHERE sh.order_id=o.id AND sh.shipped_at IS NOT NULL) s ON s.first_ship IS NOT NULL
          WHERE o.store_id=_store_id AND o.placed_at>=_from AND o.placed_at<_to),
      'refunded_orders', (SELECT count(DISTINCT order_id) FROM refunds WHERE store_id=_store_id AND created_at>=_from AND created_at<_to AND order_id IS NOT NULL)
    ) INTO res;
    RETURN res;
  END IF;

  IF _section = 'products' THEN
    SELECT jsonb_build_object(
      'top', (SELECT coalesce(jsonb_agg(q ORDER BY q.revenue DESC), '[]') FROM (
          SELECT oi.product_id, max(oi.title) title, sum(oi.quantity)::int quantity, sum(oi.line_total) revenue FROM order_items oi JOIN orders o ON o.id=oi.order_id
          WHERE o.store_id=_store_id AND o.placed_at>=_from AND o.placed_at<_to AND o.payment_status IN ('paid','partially_refunded') AND o.status<>'cancelled'
          GROUP BY oi.product_id ORDER BY sum(oi.line_total) DESC LIMIT 10) q),
      'viewed', (SELECT coalesce(jsonb_agg(q ORDER BY q.views DESC), '[]') FROM (
          SELECT a.product_id, p.title, count(*)::int views, count(DISTINCT a.session_id)::int sessions FROM analytics_events a JOIN products p ON p.id=a.product_id
          WHERE a.store_id=_store_id AND a.kind='product_view' AND a.created_at>=_from AND a.created_at<_to GROUP BY 1,2 ORDER BY 3 DESC LIMIT 10) q),
      'abandoned', (SELECT coalesce(jsonb_agg(q ORDER BY q.carted_sessions DESC), '[]') FROM (
          SELECT a.product_id, p.title, count(DISTINCT a.session_id)::int carted_sessions,
            count(DISTINCT a.session_id) FILTER (WHERE EXISTS (SELECT 1 FROM analytics_events b WHERE b.store_id=_store_id AND b.session_id=a.session_id AND b.kind='purchase' AND b.created_at>=a.created_at))::int purchased_sessions
          FROM analytics_events a JOIN products p ON p.id=a.product_id
          WHERE a.store_id=_store_id AND a.kind='add_to_cart' AND a.created_at>=_from AND a.created_at<_to GROUP BY 1,2 ORDER BY 3 DESC LIMIT 10) q),
      'low_stock', (SELECT coalesce(jsonb_agg(q ORDER BY q.stock), '[]') FROM (
          SELECT v.id variant_id, p.id product_id, p.title, v.title variant_title, v.stock, v.low_stock_threshold FROM product_variants v JOIN products p ON p.id=v.product_id
          WHERE v.store_id=_store_id AND p.status='active' AND p.track_inventory AND v.stock <= greatest(v.low_stock_threshold, 0) ORDER BY v.stock LIMIT 20) q)
    ) INTO res;
    RETURN res;
  END IF;

  IF _section = 'customers' THEN
    WITH po AS (
      SELECT o.* FROM orders o WHERE o.store_id=_store_id AND o.placed_at>=_from AND o.placed_at<_to AND o.payment_status IN ('paid','partially_refunded') AND o.status<>'cancelled'
    ), cust AS (
      SELECT DISTINCT customer_id FROM po WHERE customer_id IS NOT NULL
    )
    SELECT jsonb_build_object(
      'returning', (SELECT count(*) FROM cust WHERE EXISTS (SELECT 1 FROM orders p WHERE p.store_id=_store_id AND p.customer_id=cust.customer_id AND p.placed_at<_from)),
      'new', (SELECT count(*) FROM cust WHERE NOT EXISTS (SELECT 1 FROM orders p WHERE p.store_id=_store_id AND p.customer_id=cust.customer_id AND p.placed_at<_from)),
      'guest_orders', (SELECT count(*) FROM po WHERE customer_id IS NULL),
      'top', (SELECT coalesce(jsonb_agg(q ORDER BY q.spent DESC), '[]') FROM (
          SELECT po.customer_id, max(coalesce(c.full_name, po.customer_name)) name, max(coalesce(c.email, po.customer_email)) email, count(*)::int orders, sum(po.grand_total) spent
          FROM po LEFT JOIN customers c ON c.id=po.customer_id WHERE po.customer_id IS NOT NULL GROUP BY po.customer_id ORDER BY sum(po.grand_total) DESC LIMIT 10) q),
      'provinces', (SELECT coalesce(jsonb_agg(q ORDER BY q.orders DESC), '[]') FROM (
          SELECT initcap(lower(trim(shipping_address->>'city'))) province, count(*)::int orders, sum(grand_total) revenue FROM po
          WHERE coalesce(trim(shipping_address->>'city'),'')<>'' GROUP BY 1 ORDER BY 2 DESC LIMIT 81) q),
      'ltv', (SELECT round(coalesce(avg(total_spent),0),2) FROM customers WHERE store_id=_store_id AND orders_count>0),
      'avg_orders_per_customer', (SELECT round(coalesce(avg(orders_count),0),2) FROM customers WHERE store_id=_store_id AND orders_count>0)
    ) INTO res;
    RETURN res;
  END IF;

  IF _section = 'traffic' THEN
    WITH s AS (
      SELECT session_id,
        (array_agg(source ORDER BY created_at))[1] src, (array_agg(medium ORDER BY created_at))[1] med, (array_agg(campaign ORDER BY created_at))[1] camp,
        (array_agg(referrer_host ORDER BY created_at))[1] ref, (array_agg(device ORDER BY created_at))[1] dev,
        (array_agg(country ORDER BY created_at))[1] ctry, (array_agg(city ORDER BY created_at))[1] cty,
        bool_or(kind='purchase') purchased, sum(value) FILTER (WHERE kind='purchase') rev
      FROM analytics_events WHERE store_id=_store_id AND created_at>=_from AND created_at<_to GROUP BY session_id
    ), c AS (
      SELECT *, CASE
        WHEN lower(coalesce(med,'')) IN ('email','e-mail','newsletter') OR lower(coalesce(src,'')) LIKE '%mail%' THEN 'email'
        WHEN lower(coalesce(med,'')) IN ('cpc','ppc','paid','paid_social','paidsocial','ads','display','cpm') THEN 'ads'
        WHEN coalesce(ref, src, '') ~* '(facebook|instagram|tiktok|twitter|x\.com|t\.co|linkedin|pinterest|youtube|whatsapp|telegram)' OR lower(coalesce(med,''))='social' THEN 'social'
        WHEN coalesce(ref, src, '') ~* '(google|bing|yandex|duckduckgo|yahoo|ecosia)' OR lower(coalesce(med,''))='organic' THEN 'organic'
        WHEN coalesce(src,'direct')='direct' AND ref IS NULL THEN 'direct'
        ELSE 'referral' END channel
      FROM s
    )
    SELECT jsonb_build_object(
      'sessions', (SELECT count(*) FROM c),
      'channels', (SELECT coalesce(jsonb_agg(jsonb_build_object('channel', channel, 'sessions', n, 'purchases', p)), '[]') FROM (SELECT channel, count(*) n, count(*) FILTER (WHERE purchased) p FROM c GROUP BY 1) q),
      'devices', (SELECT coalesce(jsonb_agg(jsonb_build_object('device', d, 'sessions', n)), '[]') FROM (SELECT coalesce(dev,'bilinmiyor') d, count(*) n FROM c GROUP BY 1) q),
      'countries', (SELECT coalesce(jsonb_agg(jsonb_build_object('country', k, 'sessions', n) ORDER BY n DESC), '[]') FROM (SELECT coalesce(ctry,'—') k, count(*) n FROM c GROUP BY 1 ORDER BY 2 DESC LIMIT 15) q),
      'cities', (SELECT coalesce(jsonb_agg(jsonb_build_object('city', k, 'sessions', n) ORDER BY n DESC), '[]') FROM (SELECT cty k, count(*) n FROM c WHERE cty IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 15) q),
      'referrers', (SELECT coalesce(jsonb_agg(jsonb_build_object('host', k, 'sessions', n) ORDER BY n DESC), '[]') FROM (SELECT ref k, count(*) n FROM c WHERE ref IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 10) q),
      'campaigns', (SELECT coalesce(jsonb_agg(jsonb_build_object('campaign', camp, 'source', src, 'medium', med, 'sessions', n, 'purchases', p, 'revenue', r) ORDER BY n DESC), '[]') FROM (
          SELECT camp, src, med, count(*) n, count(*) FILTER (WHERE purchased) p, coalesce(sum(rev),0) r FROM c WHERE camp IS NOT NULL GROUP BY 1,2,3 ORDER BY 4 DESC LIMIT 20) q)
    ) INTO res;
    RETURN res;
  END IF;

  IF _section = 'funnel' THEN
    SELECT jsonb_build_object(
      'visitors', count(DISTINCT session_id),
      'product_view', count(DISTINCT session_id) FILTER (WHERE kind='product_view'),
      'add_to_cart', count(DISTINCT session_id) FILTER (WHERE kind='add_to_cart'),
      'checkout', count(DISTINCT session_id) FILTER (WHERE kind='checkout'),
      'purchase', count(DISTINCT session_id) FILTER (WHERE kind='purchase')
    ) INTO res FROM analytics_events WHERE store_id=_store_id AND created_at>=_from AND created_at<_to;
    RETURN res;
  END IF;

  IF _section = 'live' THEN
    WITH recent AS (
      SELECT DISTINCT ON (session_id) session_id, visitor_id, path, page_title, device, country, city, created_at
      FROM analytics_events WHERE store_id=_store_id AND created_at >= now() - interval '5 minutes' AND kind <> 'page_leave'
      ORDER BY session_id, created_at DESC
    )
    SELECT jsonb_build_object(
      'active_visitors', (SELECT count(DISTINCT visitor_id) FROM recent),
      'pages', (SELECT coalesce(jsonb_agg(jsonb_build_object('path', path, 'title', t, 'visitors', n) ORDER BY n DESC), '[]') FROM (
          SELECT coalesce(path,'/') path, max(page_title) t, count(*) n FROM recent GROUP BY 1 ORDER BY 3 DESC LIMIT 20) q),
      'sessions', (SELECT coalesce(jsonb_agg(jsonb_build_object('path', path, 'device', device, 'country', country, 'city', city, 'at', created_at) ORDER BY created_at DESC), '[]') FROM (SELECT * FROM recent ORDER BY created_at DESC LIMIT 30) q),
      'carts', (SELECT count(DISTINCT session_id) FROM analytics_events WHERE store_id=_store_id AND kind='add_to_cart' AND created_at >= now() - interval '5 minutes'),
      'checkouts', (SELECT count(DISTINCT session_id) FROM analytics_events WHERE store_id=_store_id AND kind='checkout' AND created_at >= now() - interval '5 minutes'),
      'recent_orders', (SELECT coalesce(jsonb_agg(q ORDER BY q.placed_at DESC), '[]') FROM (
          SELECT id, order_number, grand_total, currency, status, payment_status, placed_at, shipping_address->>'city' city FROM orders WHERE store_id=_store_id ORDER BY placed_at DESC LIMIT 5) q)
    ) INTO res;
    RETURN res;
  END IF;

  RAISE EXCEPTION 'unknown_section';
END;
$$;
GRANT EXECUTE ON FUNCTION public.analytics_v2(uuid, text, timestamptz, timestamptz, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.analytics_v2(uuid, text, timestamptz, timestamptz, text) FROM anon;

CREATE OR REPLACE FUNCTION public.analytics_v2_compare(_from timestamptz, _to timestamptz)
RETURNS TABLE(store_id uuid, name text, slug text, revenue numeric, orders bigint, visitors bigint, conversion_rate numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name, s.slug, coalesce(sum(d.revenue),0), coalesce(sum(d.orders),0)::bigint, coalesce(sum(d.visitors),0)::bigint,
    CASE WHEN coalesce(sum(d.sessions),0)>0 THEN round(sum(d.orders)::numeric/sum(d.sessions),4) ELSE 0 END
  FROM stores s JOIN analytics_daily_summary d ON d.store_id=s.id
  WHERE app_private.has_role(auth.uid(), 'platform_admin')
    AND d.date >= (_from AT TIME ZONE 'Europe/Istanbul')::date AND d.date < (_to AT TIME ZONE 'Europe/Istanbul')::date + 1
  GROUP BY s.id, s.name, s.slug
  ORDER BY 4 DESC
  LIMIT 200;
$$;
REVOKE EXECUTE ON FUNCTION public.analytics_v2_compare(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.analytics_v2_compare(timestamptz, timestamptz) TO authenticated;