-- ============ CACHE ============
CREATE TABLE IF NOT EXISTS public.cache_entries (
  cache_key text PRIMARY KEY,
  namespace text NOT NULL,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  value jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cache_entries_ns_idx ON public.cache_entries (namespace, store_id);
CREATE INDEX IF NOT EXISTS cache_entries_expires_idx ON public.cache_entries (expires_at);

GRANT ALL ON public.cache_entries TO service_role;
ALTER TABLE public.cache_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cache_entries_service_only" ON public.cache_entries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS cache_entries_set_updated_at ON public.cache_entries;
CREATE TRIGGER cache_entries_set_updated_at BEFORE UPDATE ON public.cache_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.cache_get(_key text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT value FROM public.cache_entries WHERE cache_key = _key AND expires_at > now();
$$;

CREATE OR REPLACE FUNCTION public.cache_set(_key text, _namespace text, _value jsonb, _ttl_seconds integer, _store_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.cache_entries (cache_key, namespace, store_id, value, expires_at)
  VALUES (_key, _namespace, _store_id, _value, now() + make_interval(secs => GREATEST(_ttl_seconds, 1)))
  ON CONFLICT (cache_key) DO UPDATE
    SET value = EXCLUDED.value,
        namespace = EXCLUDED.namespace,
        store_id = EXCLUDED.store_id,
        expires_at = EXCLUDED.expires_at,
        updated_at = now();
END; $$;

CREATE OR REPLACE FUNCTION public.cache_invalidate(_namespace text DEFAULT NULL, _store_id uuid DEFAULT NULL, _prefix text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE affected integer := 0;
BEGIN
  DELETE FROM public.cache_entries
   WHERE (_namespace IS NULL OR namespace = _namespace)
     AND (_store_id IS NULL OR store_id = _store_id)
     AND (_prefix IS NULL OR cache_key LIKE _prefix || '%');
  GET DIAGNOSTICS affected = ROW_COUNT;
  DELETE FROM public.cache_entries WHERE expires_at < now() - interval '1 hour';
  RETURN affected;
END; $$;

CREATE OR REPLACE FUNCTION public.cache_invalidate_on_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _store uuid;
BEGIN
  _store := COALESCE(
    (to_jsonb(COALESCE(NEW, OLD)) ->> 'store_id')::uuid,
    NULL
  );
  PERFORM public.cache_invalidate(NULL, _store, NULL);
  RETURN NULL;
END; $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','product_variants','categories','collections','store_settings','store_themes','store_theme_sections'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS cache_invalidate_trg ON public.%I', t);
    EXECUTE format('CREATE TRIGGER cache_invalidate_trg AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.cache_invalidate_on_change()', t);
  END LOOP;
END $$;

-- ============ QUEUE ============
DO $$ BEGIN
  CREATE TYPE public.job_kind AS ENUM ('email','sms','whatsapp','image','feed_sync','marketplace_sync','webhook','analytics','ai','sitemap','invoice');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.job_status AS ENUM ('queued','running','succeeded','failed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.job_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  kind public.job_kind NOT NULL,
  status public.job_status NOT NULL DEFAULT 'queued',
  priority integer NOT NULL DEFAULT 5,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  dedupe_key text,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  run_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  last_error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_queue_due_idx ON public.job_queue (status, run_at, priority);
CREATE INDEX IF NOT EXISTS job_queue_store_idx ON public.job_queue (store_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS job_queue_dedupe_idx ON public.job_queue (dedupe_key)
  WHERE dedupe_key IS NOT NULL AND status IN ('queued','running');

GRANT SELECT ON public.job_queue TO authenticated;
GRANT ALL ON public.job_queue TO service_role;
ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_queue_store_read" ON public.job_queue
  FOR SELECT TO authenticated
  USING (store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "job_queue_platform_read" ON public.job_queue
  FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'::public.app_role));
CREATE POLICY "job_queue_service" ON public.job_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS job_queue_set_updated_at ON public.job_queue;
CREATE TRIGGER job_queue_set_updated_at BEFORE UPDATE ON public.job_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.enqueue_job(
  _kind public.job_kind,
  _payload jsonb DEFAULT '{}'::jsonb,
  _store_id uuid DEFAULT NULL,
  _priority integer DEFAULT 5,
  _run_at timestamptz DEFAULT now(),
  _max_attempts integer DEFAULT 5,
  _dedupe_key text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.job_queue (store_id, kind, payload, priority, run_at, max_attempts, dedupe_key, created_by)
  VALUES (_store_id, _kind, COALESCE(_payload, '{}'::jsonb), COALESCE(_priority,5), COALESCE(_run_at, now()),
          COALESCE(_max_attempts,5), _dedupe_key, auth.uid())
  ON CONFLICT DO NOTHING
  RETURNING id INTO _id;
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.claim_jobs(_limit integer DEFAULT 10, _kinds public.job_kind[] DEFAULT NULL)
RETURNS SETOF public.job_queue LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT j.id FROM public.job_queue j
     WHERE (j.status = 'queued' AND j.run_at <= now())
        OR (j.status = 'running' AND j.locked_at < now() - interval '10 minutes')
       AND (_kinds IS NULL OR j.kind = ANY(_kinds))
     ORDER BY j.priority ASC, j.run_at ASC
     LIMIT GREATEST(COALESCE(_limit,10), 1)
     FOR UPDATE SKIP LOCKED
  )
  UPDATE public.job_queue q
     SET status = 'running',
         attempts = q.attempts + 1,
         locked_at = now(),
         started_at = COALESCE(q.started_at, now())
   WHERE q.id IN (SELECT id FROM due)
  RETURNING q.*;
END; $$;

CREATE OR REPLACE FUNCTION public.complete_job(_id uuid, _result jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.job_queue
     SET status = 'succeeded', result = COALESCE(_result,'{}'::jsonb), finished_at = now(), locked_at = NULL, last_error = NULL
   WHERE id = _id;
$$;

CREATE OR REPLACE FUNCTION public.fail_job(_id uuid, _error text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _job public.job_queue;
BEGIN
  SELECT * INTO _job FROM public.job_queue WHERE id = _id;
  IF _job.id IS NULL THEN RETURN; END IF;

  IF _job.attempts >= _job.max_attempts THEN
    UPDATE public.job_queue
       SET status = 'failed', last_error = _error, finished_at = now(), locked_at = NULL
     WHERE id = _id;
  ELSE
    UPDATE public.job_queue
       SET status = 'queued', last_error = _error, locked_at = NULL,
           run_at = now() + make_interval(secs => LEAST(3600, POWER(3, _job.attempts)::integer * 30))
     WHERE id = _id;
  END IF;
END; $$;

-- ============ FULL TEXT SEARCH ============
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce(title,'') || ' ' || coalesce(sku,'') || ' ' || coalesce(barcode,'') || ' ' ||
      coalesce(slug,'') || ' ' || coalesce(vendor,'') || ' ' || coalesce(description,''))
  ) STORED;
CREATE INDEX IF NOT EXISTS products_search_idx ON public.products USING gin (search_vector);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce(order_number,'') || ' ' || coalesce(customer_name,'') || ' ' || coalesce(customer_email,'') || ' ' ||
      coalesce(customer_phone,'') || ' ' || coalesce(invoice_number,'') || ' ' || coalesce(tracking_number,''))
  ) STORED;
CREATE INDEX IF NOT EXISTS orders_search_idx ON public.orders USING gin (search_vector);

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce(full_name,'') || ' ' || coalesce(email,'') || ' ' || coalesce(phone,''))
  ) STORED;
CREATE INDEX IF NOT EXISTS customers_search_idx ON public.customers USING gin (search_vector);

ALTER TABLE public.store_pages ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce(title,'') || ' ' || coalesce(slug,'') || ' ' || coalesce(excerpt,'') || ' ' || coalesce(body,''))
  ) STORED;
CREATE INDEX IF NOT EXISTS store_pages_search_idx ON public.store_pages USING gin (search_vector);

CREATE OR REPLACE FUNCTION public.search_store(_store_id uuid, _term text, _kinds text[] DEFAULT NULL, _limit integer DEFAULT 20)
RETURNS TABLE(kind text, id uuid, title text, subtitle text, rank real)
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH q AS (
    SELECT websearch_to_tsquery('simple', _term) AS tsq, GREATEST(COALESCE(_limit,20),1) AS lim
  )
  SELECT * FROM (
    SELECT 'product'::text, p.id, p.title,
           (p.status::text || ' · ' || p.base_price::text || ' ' || p.currency),
           ts_rank(p.search_vector, q.tsq)
      FROM public.products p, q
     WHERE p.store_id = _store_id AND (_kinds IS NULL OR 'product' = ANY(_kinds)) AND p.search_vector @@ q.tsq
     ORDER BY ts_rank(p.search_vector, q.tsq) DESC LIMIT (SELECT lim FROM q)
  ) products
  UNION ALL
  SELECT * FROM (
    SELECT 'order'::text, o.id, o.order_number,
           (COALESCE(o.customer_name,'Misafir') || ' · ' || o.grand_total::text || ' ' || o.currency),
           ts_rank(o.search_vector, q.tsq)
      FROM public.orders o, q
     WHERE o.store_id = _store_id AND (_kinds IS NULL OR 'order' = ANY(_kinds)) AND o.search_vector @@ q.tsq
     ORDER BY ts_rank(o.search_vector, q.tsq) DESC LIMIT (SELECT lim FROM q)
  ) orders
  UNION ALL
  SELECT * FROM (
    SELECT 'customer'::text, c.id, c.full_name, c.email, ts_rank(c.search_vector, q.tsq)
      FROM public.customers c, q
     WHERE c.store_id = _store_id AND (_kinds IS NULL OR 'customer' = ANY(_kinds)) AND c.search_vector @@ q.tsq
     ORDER BY ts_rank(c.search_vector, q.tsq) DESC LIMIT (SELECT lim FROM q)
  ) customers
  UNION ALL
  SELECT * FROM (
    SELECT CASE WHEN sp.page_kind = 'blog' THEN 'blog' ELSE 'page' END, sp.id, sp.title,
           ('/' || sp.slug || CASE WHEN sp.is_published THEN ' · yayında' ELSE ' · taslak' END),
           ts_rank(sp.search_vector, q.tsq)
      FROM public.store_pages sp, q
     WHERE sp.store_id = _store_id
       AND (_kinds IS NULL OR (CASE WHEN sp.page_kind = 'blog' THEN 'blog' ELSE 'page' END) = ANY(_kinds))
       AND sp.search_vector @@ q.tsq
     ORDER BY ts_rank(sp.search_vector, q.tsq) DESC LIMIT (SELECT lim FROM q)
  ) pages
  ORDER BY 5 DESC;
$$;