
CREATE TABLE public.fw_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT false,
  auto_mitigation boolean NOT NULL DEFAULT true,
  level1_rpm integer NOT NULL DEFAULT 60000,
  level2_rpm integer NOT NULL DEFAULT 300000,
  level3_rpm integer NOT NULL DEFAULT 1200000,
  level4_rpm integer NOT NULL DEFAULT 6000000,
  auto_ban_per_minute integer NOT NULL DEFAULT 600,
  auto_ban_minutes integer NOT NULL DEFAULT 60,
  current_level smallint NOT NULL DEFAULT 0,
  level_changed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.fw_settings (id) VALUES (true);

CREATE TABLE public.fw_country_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL UNIQUE CHECK (country_code ~ '^[A-Z]{2}$'),
  country_name text NOT NULL,
  rule_type text NOT NULL CHECK (rule_type IN ('block','allow','captcha','rate_limit')),
  reason text,
  added_by_user_id uuid,
  hits_count bigint NOT NULL DEFAULT 0,
  last_hit_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fw_asn_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asn_number integer NOT NULL UNIQUE CHECK (asn_number > 0),
  asn_name text NOT NULL,
  rule_type text NOT NULL CHECK (rule_type IN ('block','captcha','rate_limit')),
  reason text,
  hits_count bigint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fw_endpoint_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_prefix text NOT NULL UNIQUE CHECK (path_prefix LIKE '/%'),
  limit_count integer NOT NULL CHECK (limit_count BETWEEN 1 AND 100000),
  window_seconds integer NOT NULL CHECK (window_seconds BETWEEN 1 AND 86400),
  on_exceed text NOT NULL DEFAULT 'block' CHECK (on_exceed IN ('block','captcha')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fw_traffic_minutes (
  minute timestamptz PRIMARY KEY,
  requests bigint NOT NULL DEFAULT 0,
  blocked bigint NOT NULL DEFAULT 0,
  challenged bigint NOT NULL DEFAULT 0,
  countries jsonb NOT NULL DEFAULT '{}'::jsonb,
  paths jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.fw_traffic_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_at timestamptz NOT NULL,
  requests_total bigint NOT NULL DEFAULT 0,
  requests_blocked bigint NOT NULL DEFAULT 0,
  requests_challenged bigint NOT NULL DEFAULT 0,
  top_countries jsonb NOT NULL DEFAULT '[]'::jsonb,
  top_endpoints jsonb NOT NULL DEFAULT '[]'::jsonb,
  level smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fw_traffic_snapshots_at ON public.fw_traffic_snapshots (snapshot_at DESC);

CREATE TABLE public.fw_ddos_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL DEFAULT 'application',
  severity text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  peak_level smallint NOT NULL DEFAULT 1,
  peak_rpm bigint NOT NULL DEFAULT 0,
  total_requests bigint NOT NULL DEFAULT 0,
  blocked_requests bigint NOT NULL DEFAULT 0,
  source_countries jsonb NOT NULL DEFAULT '[]'::jsonb,
  targeted_endpoints jsonb NOT NULL DEFAULT '[]'::jsonb,
  mitigation_action text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.fw_rate_limit_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  endpoint text NOT NULL,
  requests_in_window integer NOT NULL,
  window_seconds integer NOT NULL,
  limit_threshold integer NOT NULL,
  action_taken text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fw_rlv_created ON public.fw_rate_limit_violations (created_at DESC);

CREATE TABLE public.fw_captcha_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  answer integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','passed','failed','expired')),
  attempts_count integer NOT NULL DEFAULT 0,
  passed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '5 minutes',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fw_captcha_passes (
  ip_address text PRIMARY KEY,
  expires_at timestamptz NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fw_settings, public.fw_country_rules, public.fw_asn_rules, public.fw_endpoint_limits, public.fw_traffic_snapshots, public.fw_ddos_events, public.fw_rate_limit_violations TO authenticated;
GRANT SELECT ON public.fw_captcha_challenges, public.fw_traffic_minutes TO authenticated;
GRANT ALL ON public.fw_settings, public.fw_country_rules, public.fw_asn_rules, public.fw_endpoint_limits, public.fw_traffic_minutes, public.fw_traffic_snapshots, public.fw_ddos_events, public.fw_rate_limit_violations, public.fw_captcha_challenges, public.fw_captcha_passes TO service_role;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['fw_settings','fw_country_rules','fw_asn_rules','fw_endpoint_limits','fw_traffic_minutes','fw_traffic_snapshots','fw_ddos_events','fw_rate_limit_violations','fw_captcha_challenges','fw_captcha_passes'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['fw_settings','fw_country_rules','fw_asn_rules','fw_endpoint_limits','fw_traffic_snapshots','fw_ddos_events','fw_rate_limit_violations'] LOOP
    EXECUTE format('CREATE POLICY "fw platform admin manage" ON public.%I FOR ALL TO authenticated USING (app_private.has_role(auth.uid(), ''platform_admin'')) WITH CHECK (app_private.has_role(auth.uid(), ''platform_admin''))', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['fw_captcha_challenges','fw_traffic_minutes'] LOOP
    EXECUTE format('CREATE POLICY "fw platform admin read" ON public.%I FOR SELECT TO authenticated USING (app_private.has_role(auth.uid(), ''platform_admin''))', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.fw_bump_traffic(_minute timestamptz, _blocked int, _challenged int, _country text, _path text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.fw_traffic_minutes AS t (minute, requests, blocked, challenged, countries, paths)
  VALUES (_minute, 1, _blocked, _challenged,
    jsonb_build_object(coalesce(nullif(_country,''),'XX'), 1),
    jsonb_build_object(left(coalesce(_path,'/'),80), 1))
  ON CONFLICT (minute) DO UPDATE SET
    requests = t.requests + 1,
    blocked = t.blocked + _blocked,
    challenged = t.challenged + _challenged,
    countries = jsonb_set(t.countries, ARRAY[coalesce(nullif(_country,''),'XX')],
      to_jsonb(coalesce((t.countries->>coalesce(nullif(_country,''),'XX'))::bigint,0) + 1)),
    paths = CASE WHEN (SELECT count(*) FROM jsonb_object_keys(t.paths)) < 200 OR t.paths ? left(coalesce(_path,'/'),80)
      THEN jsonb_set(t.paths, ARRAY[left(coalesce(_path,'/'),80)],
        to_jsonb(coalesce((t.paths->>left(coalesce(_path,'/'),80))::bigint,0) + 1))
      ELSE t.paths END;
$$;
REVOKE ALL ON FUNCTION public.fw_bump_traffic(timestamptz,int,int,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fw_bump_traffic(timestamptz,int,int,text,text) TO service_role;

INSERT INTO public.fw_country_rules (country_code, country_name, rule_type, reason, is_active) VALUES
 ('TR','Türkiye','allow','Ana pazar — her zaman izinli',true),
 ('CY','Kuzey Kıbrıs','allow','Her zaman izinli',true),
 ('AZ','Azerbaycan','allow','İş ortaklığı',true),
 ('RU','Rusya','captcha','Yüksek riskli (istatistik)',false),
 ('CN','Çin','captcha','Yüksek riskli (istatistik)',false),
 ('KP','Kuzey Kore','captcha','Yüksek riskli (istatistik)',false),
 ('IR','İran','captcha','Yüksek riskli (istatistik)',false),
 ('NG','Nijerya','captcha','Yüksek riskli (istatistik)',false),
 ('UA','Ukrayna','captcha','Yüksek riskli (istatistik)',false),
 ('RO','Romanya','captcha','Yüksek riskli (istatistik)',false),
 ('BG','Bulgaristan','captcha','Yüksek riskli (istatistik)',false),
 ('BR','Brezilya','captcha','Yüksek riskli (istatistik)',false);

INSERT INTO public.fw_asn_rules (asn_number, asn_name, rule_type, reason, is_active) VALUES
 (16509,'Amazon AWS','captcha','Datacenter — bot trafiği',false),
 (15169,'Google Cloud','captcha','Datacenter — bot trafiği',false),
 (8075,'Microsoft Azure','captcha','Datacenter — bot trafiği',false),
 (14061,'DigitalOcean','block','Datacenter — bot trafiği',false),
 (16276,'OVH','captcha','Datacenter — bot trafiği',false);

INSERT INTO public.fw_endpoint_limits (path_prefix, limit_count, window_seconds, on_exceed) VALUES
 ('/login',5,60,'captcha'),
 ('/auth',10,60,'captcha'),
 ('/register',10,60,'captcha'),
 ('/forgot-password',3,60,'block'),
 ('/admin/login',5,60,'captcha'),
 ('/odeme',20,60,'block');
