-- 1) Rate limit counters (server-only)
CREATE TABLE public.rate_limit_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_key text NOT NULL,
  window_started_at timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket_key, window_started_at)
);
GRANT ALL ON public.rate_limit_counters TO service_role;
ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rate_limit_service_only" ON public.rate_limit_counters FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX rate_limit_counters_window_idx ON public.rate_limit_counters (window_started_at);
CREATE TRIGGER rate_limit_counters_set_updated_at BEFORE UPDATE ON public.rate_limit_counters FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.consume_rate_limit(_bucket_key text, _limit integer, _window_seconds integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _window_start timestamptz;
  _hits integer;
BEGIN
  IF _limit <= 0 OR _window_seconds <= 0 THEN
    RAISE EXCEPTION 'Geçersiz hız sınırı parametresi';
  END IF;

  _window_start := to_timestamp(floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds);

  INSERT INTO public.rate_limit_counters (bucket_key, window_started_at, hits)
  VALUES (_bucket_key, _window_start, 1)
  ON CONFLICT (bucket_key, window_started_at)
  DO UPDATE SET hits = public.rate_limit_counters.hits + 1, updated_at = now()
  RETURNING hits INTO _hits;

  DELETE FROM public.rate_limit_counters
   WHERE window_started_at < now() - interval '1 day';

  RETURN jsonb_build_object(
    'allowed', _hits <= _limit,
    'hits', _hits,
    'limit', _limit,
    'remaining', GREATEST(_limit - _hits, 0),
    'reset_at', _window_start + make_interval(secs => _window_seconds)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO service_role;

-- 2) Security events
CREATE TABLE public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  ip text,
  user_agent text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "security_events_store_admin_read" ON public.security_events FOR SELECT TO authenticated
  USING (store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "security_events_own_read" ON public.security_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE INDEX security_events_store_created_idx ON public.security_events (store_id, created_at DESC);

-- 3) Consent records
CREATE TABLE public.consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  subject_email text,
  subject_token text,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  consent_type text NOT NULL,
  granted boolean NOT NULL DEFAULT true,
  policy_version text NOT NULL DEFAULT 'v1',
  source text NOT NULL DEFAULT 'storefront',
  ip text,
  user_agent text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.consent_records TO authenticated;
GRANT INSERT ON public.consent_records TO anon, authenticated;
GRANT ALL ON public.consent_records TO service_role;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consent_records_admin_read" ON public.consent_records FOR SELECT TO authenticated
  USING (store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "consent_records_public_insert" ON public.consent_records FOR INSERT TO anon, authenticated
  WITH CHECK (store_id IS NULL OR app_private.is_store_published(store_id) OR app_private.is_store_member(store_id, auth.uid()));
CREATE INDEX consent_records_store_created_idx ON public.consent_records (store_id, created_at DESC);
CREATE INDEX consent_records_email_idx ON public.consent_records (store_id, subject_email);

-- 4) Data processing records (ROPA)
CREATE TABLE public.data_processing_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  activity text NOT NULL,
  purpose text NOT NULL,
  legal_basis text NOT NULL DEFAULT 'consent',
  data_categories text[] NOT NULL DEFAULT '{}',
  data_subjects text[] NOT NULL DEFAULT '{}',
  recipients text[] NOT NULL DEFAULT '{}',
  retention_period text,
  cross_border_transfer boolean NOT NULL DEFAULT false,
  transfer_details text,
  security_measures text,
  responsible_person text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_processing_records TO authenticated;
GRANT ALL ON public.data_processing_records TO service_role;
ALTER TABLE public.data_processing_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ropa_member_read" ON public.data_processing_records FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "ropa_admin_write" ON public.data_processing_records FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER data_processing_records_set_updated_at BEFORE UPDATE ON public.data_processing_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) Data subject requests
CREATE TABLE public.data_subject_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'export',
  subject_email text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  reason text,
  result_path text,
  result_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  handled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT data_subject_requests_kind_check CHECK (kind IN ('export','delete','access','rectify')),
  CONSTRAINT data_subject_requests_status_check CHECK (status IN ('pending','in_progress','completed','rejected'))
);
GRANT SELECT, INSERT, UPDATE ON public.data_subject_requests TO authenticated;
GRANT INSERT ON public.data_subject_requests TO anon;
GRANT ALL ON public.data_subject_requests TO service_role;
ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dsr_admin_read" ON public.data_subject_requests FOR SELECT TO authenticated
  USING (store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "dsr_own_read" ON public.data_subject_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "dsr_public_insert" ON public.data_subject_requests FOR INSERT TO anon, authenticated
  WITH CHECK (store_id IS NULL OR app_private.is_store_published(store_id) OR app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "dsr_admin_update" ON public.data_subject_requests FOR UPDATE TO authenticated
  USING (store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid()));
CREATE INDEX dsr_store_created_idx ON public.data_subject_requests (store_id, created_at DESC);
CREATE TRIGGER data_subject_requests_set_updated_at BEFORE UPDATE ON public.data_subject_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();