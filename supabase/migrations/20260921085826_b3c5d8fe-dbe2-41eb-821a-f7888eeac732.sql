-- 1) Flash sale yarış durumu: satır kilidi ile atomik stok rezervasyonu
CREATE OR REPLACE FUNCTION public.reserve_variant_stock(_variant_id uuid, _qty integer)
RETURNS TABLE(stock_before integer, stock_after integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _before integer;
BEGIN
  IF _qty IS NULL OR _qty <= 0 THEN
    RAISE EXCEPTION 'Geçersiz miktar';
  END IF;

  SELECT stock INTO _before
  FROM public.product_variants
  WHERE id = _variant_id
  FOR UPDATE;

  IF _before IS NULL THEN
    RAISE EXCEPTION 'Ürün varyantı bulunamadı';
  END IF;

  IF _before < _qty THEN
    RAISE EXCEPTION 'Yeterli stok yok (kalan %)', _before;
  END IF;

  UPDATE public.product_variants
  SET stock = _before - _qty
  WHERE id = _variant_id;

  RETURN QUERY SELECT _before, _before - _qty;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_variant_stock(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_variant_stock(uuid, integer) TO service_role;

-- 2) Hata kayıt masası
CREATE TABLE IF NOT EXISTS public.app_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL UNIQUE,
  severity text NOT NULL DEFAULT 'WARNING',
  source text NOT NULL DEFAULT 'server',
  message text NOT NULL,
  stack text,
  route text,
  user_id uuid,
  store_id uuid,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurrences integer NOT NULL DEFAULT 1,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_error_logs_last_seen_idx ON public.app_error_logs (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS app_error_logs_severity_idx ON public.app_error_logs (severity, last_seen_at DESC);

GRANT SELECT, UPDATE ON public.app_error_logs TO authenticated;
GRANT ALL ON public.app_error_logs TO service_role;

ALTER TABLE public.app_error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_error_logs_platform_admin_read" ON public.app_error_logs;
CREATE POLICY "app_error_logs_platform_admin_read" ON public.app_error_logs
  FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'::app_role));

DROP POLICY IF EXISTS "app_error_logs_platform_admin_update" ON public.app_error_logs;
CREATE POLICY "app_error_logs_platform_admin_update" ON public.app_error_logs
  FOR UPDATE TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'::app_role));

DROP TRIGGER IF EXISTS app_error_logs_touch ON public.app_error_logs;
CREATE TRIGGER app_error_logs_touch
  BEFORE UPDATE ON public.app_error_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Aynı hata tekrar ederse sayaç artar; yeni ise kayıt açılır.
CREATE OR REPLACE FUNCTION public.record_app_error(
  _fingerprint text,
  _severity text,
  _source text,
  _message text,
  _stack text DEFAULT NULL,
  _route text DEFAULT NULL,
  _user_id uuid DEFAULT NULL,
  _store_id uuid DEFAULT NULL,
  _meta jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(id uuid, occurrences integer, is_new boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.app_error_logs;
  _existing boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.app_error_logs WHERE fingerprint = _fingerprint) INTO _existing;

  INSERT INTO public.app_error_logs AS l (
    fingerprint, severity, source, message, stack, route, user_id, store_id, meta
  ) VALUES (
    left(_fingerprint, 200),
    CASE upper(coalesce(_severity, 'WARNING')) WHEN 'CRITICAL' THEN 'CRITICAL' WHEN 'INFO' THEN 'INFO' ELSE 'WARNING' END,
    left(coalesce(_source, 'server'), 60),
    left(coalesce(_message, 'bilinmeyen hata'), 2000),
    left(_stack, 8000),
    left(_route, 300),
    _user_id,
    _store_id,
    coalesce(_meta, '{}'::jsonb)
  )
  ON CONFLICT (fingerprint) DO UPDATE
    SET occurrences = l.occurrences + 1,
        last_seen_at = now(),
        severity = EXCLUDED.severity,
        message = EXCLUDED.message,
        stack = coalesce(EXCLUDED.stack, l.stack),
        route = coalesce(EXCLUDED.route, l.route),
        resolved_at = NULL,
        resolved_by = NULL
  RETURNING * INTO _row;

  RETURN QUERY SELECT _row.id, _row.occurrences, NOT _existing;
END;
$$;

REVOKE ALL ON FUNCTION public.record_app_error(text, text, text, text, text, text, uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_app_error(text, text, text, text, text, text, uuid, uuid, jsonb) TO service_role;

-- 3) Önbellek isabet oranı ölçümü
CREATE TABLE IF NOT EXISTS public.cache_metrics (
  bucket timestamptz PRIMARY KEY,
  hits bigint NOT NULL DEFAULT 0,
  misses bigint NOT NULL DEFAULT 0
);

GRANT SELECT ON public.cache_metrics TO authenticated;
GRANT ALL ON public.cache_metrics TO service_role;
ALTER TABLE public.cache_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cache_metrics_platform_admin_read" ON public.cache_metrics;
CREATE POLICY "cache_metrics_platform_admin_read" ON public.cache_metrics
  FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'::app_role));

CREATE OR REPLACE FUNCTION public.cache_track(_hits integer, _misses integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.cache_metrics (bucket, hits, misses)
  VALUES (date_trunc('minute', now()), greatest(coalesce(_hits, 0), 0), greatest(coalesce(_misses, 0), 0))
  ON CONFLICT (bucket) DO UPDATE
    SET hits = public.cache_metrics.hits + EXCLUDED.hits,
        misses = public.cache_metrics.misses + EXCLUDED.misses;

  DELETE FROM public.cache_metrics WHERE bucket < now() - interval '3 days';
END;
$$;

REVOKE ALL ON FUNCTION public.cache_track(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cache_track(integer, integer) TO service_role;

-- 4) Uyarı susturma penceresi
CREATE TABLE IF NOT EXISTS public.monitoring_alerts (
  alert_key text PRIMARY KEY,
  severity text NOT NULL DEFAULT 'WARNING',
  title text NOT NULL,
  detail text,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  send_count integer NOT NULL DEFAULT 1
);

GRANT SELECT ON public.monitoring_alerts TO authenticated;
GRANT ALL ON public.monitoring_alerts TO service_role;
ALTER TABLE public.monitoring_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monitoring_alerts_platform_admin_read" ON public.monitoring_alerts;
CREATE POLICY "monitoring_alerts_platform_admin_read" ON public.monitoring_alerts
  FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'::app_role));

-- Uyarıyı yalnızca susturma penceresi dolduysa gönderilebilir işaretler.
CREATE OR REPLACE FUNCTION public.claim_monitoring_alert(
  _alert_key text,
  _severity text,
  _title text,
  _detail text DEFAULT NULL,
  _mute_seconds integer DEFAULT 900
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _last timestamptz;
BEGIN
  SELECT last_sent_at INTO _last FROM public.monitoring_alerts WHERE alert_key = _alert_key FOR UPDATE;

  IF _last IS NOT NULL AND _last > now() - make_interval(secs => greatest(coalesce(_mute_seconds, 900), 1)) THEN
    RETURN false;
  END IF;

  INSERT INTO public.monitoring_alerts (alert_key, severity, title, detail)
  VALUES (left(_alert_key, 200), upper(coalesce(_severity, 'WARNING')), left(coalesce(_title, ''), 300), left(_detail, 2000))
  ON CONFLICT (alert_key) DO UPDATE
    SET last_sent_at = now(),
        severity = EXCLUDED.severity,
        title = EXCLUDED.title,
        detail = EXCLUDED.detail,
        send_count = public.monitoring_alerts.send_count + 1;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_monitoring_alert(text, text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_monitoring_alert(text, text, text, text, integer) TO service_role;

-- 5) Veritabanı gecikme ölçümü için hafif yardımcı
CREATE OR REPLACE FUNCTION public.db_ping()
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = public
AS $$ SELECT now() $$;

GRANT EXECUTE ON FUNCTION public.db_ping() TO authenticated, service_role;