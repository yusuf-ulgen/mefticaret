ALTER TABLE public.products DROP COLUMN IF EXISTS search_vector;
ALTER TABLE public.orders DROP COLUMN IF EXISTS search_vector;
ALTER TABLE public.customers DROP COLUMN IF EXISTS search_vector;
ALTER TABLE public.store_pages DROP COLUMN IF EXISTS search_vector;

CREATE OR REPLACE FUNCTION public.fts_simple(_text text)
RETURNS tsvector LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public AS $$
  SELECT to_tsvector('simple', coalesce(_text, ''));
$$;
REVOKE ALL ON FUNCTION public.fts_simple(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fts_simple(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.product_fts_text(_title text, _sku text, _barcode text, _slug text, _vendor text, _description text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT coalesce(_title,'') || ' ' || coalesce(_sku,'') || ' ' || coalesce(_barcode,'') || ' ' ||
         coalesce(_slug,'') || ' ' || coalesce(_vendor,'') || ' ' || coalesce(_description,'');
$$;
REVOKE ALL ON FUNCTION public.product_fts_text(text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.product_fts_text(text,text,text,text,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.order_fts_text(_order_number text, _customer_name text, _customer_email text, _customer_phone text, _invoice_number text, _tracking_number text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT coalesce(_order_number,'') || ' ' || coalesce(_customer_name,'') || ' ' || coalesce(_customer_email,'') || ' ' ||
         coalesce(_customer_phone,'') || ' ' || coalesce(_invoice_number,'') || ' ' || coalesce(_tracking_number,'');
$$;
REVOKE ALL ON FUNCTION public.order_fts_text(text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.order_fts_text(text,text,text,text,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.customer_fts_text(_full_name text, _email text, _phone text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT coalesce(_full_name,'') || ' ' || coalesce(_email,'') || ' ' || coalesce(_phone,'');
$$;
REVOKE ALL ON FUNCTION public.customer_fts_text(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_fts_text(text,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.page_fts_text(_title text, _slug text, _excerpt text, _body text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT coalesce(_title,'') || ' ' || coalesce(_slug,'') || ' ' || coalesce(_excerpt,'') || ' ' || coalesce(_body,'');
$$;
REVOKE ALL ON FUNCTION public.page_fts_text(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.page_fts_text(text,text,text,text) TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS products_search_idx ON public.products
  USING gin (public.fts_simple(public.product_fts_text(title, sku, barcode, slug, vendor, description)));
CREATE INDEX IF NOT EXISTS orders_search_idx ON public.orders
  USING gin (public.fts_simple(public.order_fts_text(order_number, customer_name, customer_email, customer_phone, invoice_number, tracking_number)));
CREATE INDEX IF NOT EXISTS customers_search_idx ON public.customers
  USING gin (public.fts_simple(public.customer_fts_text(full_name, email, phone)));
CREATE INDEX IF NOT EXISTS store_pages_search_idx ON public.store_pages
  USING gin (public.fts_simple(public.page_fts_text(title, slug, excerpt, body)));

CREATE OR REPLACE FUNCTION public.search_store(_store_id uuid, _term text, _kinds text[] DEFAULT NULL, _limit integer DEFAULT 20)
RETURNS TABLE(kind text, id uuid, title text, subtitle text, rank real)
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH q AS (
    SELECT websearch_to_tsquery('simple', _term) AS tsq, GREATEST(COALESCE(_limit,20),1) AS lim
  )
  SELECT * FROM (
    SELECT 'product'::text, p.id, p.title,
           (p.status::text || ' · ' || p.base_price::text || ' ' || p.currency),
           ts_rank(public.fts_simple(public.product_fts_text(p.title, p.sku, p.barcode, p.slug, p.vendor, p.description)), q.tsq)
      FROM public.products p, q
     WHERE p.store_id = _store_id AND (_kinds IS NULL OR 'product' = ANY(_kinds))
       AND public.fts_simple(public.product_fts_text(p.title, p.sku, p.barcode, p.slug, p.vendor, p.description)) @@ q.tsq
     ORDER BY 5 DESC LIMIT (SELECT lim FROM q)
  ) products
  UNION ALL
  SELECT * FROM (
    SELECT 'order'::text, o.id, o.order_number,
           (COALESCE(o.customer_name,'Misafir') || ' · ' || o.grand_total::text || ' ' || o.currency),
           ts_rank(public.fts_simple(public.order_fts_text(o.order_number, o.customer_name, o.customer_email, o.customer_phone, o.invoice_number, o.tracking_number)), q.tsq)
      FROM public.orders o, q
     WHERE o.store_id = _store_id AND (_kinds IS NULL OR 'order' = ANY(_kinds))
       AND public.fts_simple(public.order_fts_text(o.order_number, o.customer_name, o.customer_email, o.customer_phone, o.invoice_number, o.tracking_number)) @@ q.tsq
     ORDER BY 5 DESC LIMIT (SELECT lim FROM q)
  ) orders
  UNION ALL
  SELECT * FROM (
    SELECT 'customer'::text, c.id, c.full_name, c.email,
           ts_rank(public.fts_simple(public.customer_fts_text(c.full_name, c.email, c.phone)), q.tsq)
      FROM public.customers c, q
     WHERE c.store_id = _store_id AND (_kinds IS NULL OR 'customer' = ANY(_kinds))
       AND public.fts_simple(public.customer_fts_text(c.full_name, c.email, c.phone)) @@ q.tsq
     ORDER BY 5 DESC LIMIT (SELECT lim FROM q)
  ) customers
  UNION ALL
  SELECT * FROM (
    SELECT CASE WHEN sp.page_kind = 'blog' THEN 'blog' ELSE 'page' END, sp.id, sp.title,
           ('/' || sp.slug || CASE WHEN sp.is_published THEN ' · yayında' ELSE ' · taslak' END),
           ts_rank(public.fts_simple(public.page_fts_text(sp.title, sp.slug, sp.excerpt, sp.body)), q.tsq)
      FROM public.store_pages sp, q
     WHERE sp.store_id = _store_id
       AND (_kinds IS NULL OR (CASE WHEN sp.page_kind = 'blog' THEN 'blog' ELSE 'page' END) = ANY(_kinds))
       AND public.fts_simple(public.page_fts_text(sp.title, sp.slug, sp.excerpt, sp.body)) @@ q.tsq
     ORDER BY 5 DESC LIMIT (SELECT lim FROM q)
  ) pages
  ORDER BY 5 DESC;
$$;

-- Cache/kuyruk yardımcı işlevleri yalnızca sistem servislerine açılır.
REVOKE ALL ON FUNCTION public.cache_get(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cache_set(text, text, jsonb, integer, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cache_invalidate(text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cache_invalidate_on_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_jobs(integer, public.job_kind[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_job(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_job(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_job(public.job_kind, jsonb, uuid, integer, timestamptz, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cache_get(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cache_set(text, text, jsonb, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cache_invalidate(text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_jobs(integer, public.job_kind[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_job(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_job(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_job(public.job_kind, jsonb, uuid, integer, timestamptz, integer, text) TO service_role;