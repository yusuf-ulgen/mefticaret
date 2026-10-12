-- ===== Güvenlik & güvenlik duvarı katmanı (sec_*) =====

CREATE TABLE public.sec_ip_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  ip_address INET,
  ip_range CIDR,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('whitelist','blacklist','rate_limit')),
  rate_limit_per_minute INTEGER,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  hits_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ip_address IS NOT NULL OR ip_range IS NOT NULL)
);
CREATE INDEX idx_sec_ip_rules_lookup ON public.sec_ip_rules(is_active, rule_type);
CREATE INDEX idx_sec_ip_rules_store ON public.sec_ip_rules(store_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sec_ip_rules TO authenticated;
GRANT ALL ON public.sec_ip_rules TO service_role;
ALTER TABLE public.sec_ip_rules ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sec_ip_reputation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address INET NOT NULL UNIQUE,
  reputation_score INTEGER NOT NULL DEFAULT 100 CHECK (reputation_score BETWEEN 0 AND 100),
  country_code TEXT,
  isp TEXT,
  is_vpn BOOLEAN NOT NULL DEFAULT false,
  is_tor BOOLEAN NOT NULL DEFAULT false,
  is_datacenter BOOLEAN NOT NULL DEFAULT false,
  threat_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sec_ip_reputation TO authenticated;
GRANT ALL ON public.sec_ip_reputation TO service_role;
ALTER TABLE public.sec_ip_reputation ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sec_blocked_countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_sec_blocked_countries_uniq ON public.sec_blocked_countries(COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid), country_code);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sec_blocked_countries TO authenticated;
GRANT ALL ON public.sec_blocked_countries TO service_role;
ALTER TABLE public.sec_blocked_countries ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sec_attack_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  attack_type TEXT NOT NULL CHECK (attack_type IN ('sql_injection','xss','csrf','brute_force','ddos','path_traversal','rfi','lfi','rate_limit','bot','fraud','country_block','ip_block','header_anomaly','payload_size')),
  ip_address INET,
  user_agent TEXT,
  request_method TEXT,
  request_url TEXT,
  request_payload TEXT,
  country_code TEXT,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  action_taken TEXT NOT NULL DEFAULT 'log' CHECK (action_taken IN ('log','block','captcha','alert','throttle')),
  is_false_positive BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sec_attack_logs_time ON public.sec_attack_logs(created_at DESC);
CREATE INDEX idx_sec_attack_logs_store ON public.sec_attack_logs(store_id, created_at DESC);
CREATE INDEX idx_sec_attack_logs_ip ON public.sec_attack_logs(ip_address);
GRANT SELECT, UPDATE ON public.sec_attack_logs TO authenticated;
GRANT ALL ON public.sec_attack_logs TO service_role;
ALTER TABLE public.sec_attack_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sec_threat_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  threat_type TEXT NOT NULL,
  indicator TEXT NOT NULL CHECK (indicator IN ('ip','domain','hash','email','phone')),
  indicator_value TEXT NOT NULL,
  confidence_score INTEGER NOT NULL DEFAULT 50 CHECK (confidence_score BETWEEN 0 AND 100),
  source TEXT,
  description TEXT,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_sec_threat_uniq ON public.sec_threat_intelligence(indicator, indicator_value);
GRANT SELECT ON public.sec_threat_intelligence TO authenticated;
GRANT ALL ON public.sec_threat_intelligence TO service_role;
ALTER TABLE public.sec_threat_intelligence ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sec_login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  identifier TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  attempt_type TEXT NOT NULL DEFAULT 'admin' CHECK (attempt_type IN ('admin','customer','api','supplier','home_maker')),
  status TEXT NOT NULL CHECK (status IN ('success','failed','blocked')),
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sec_login_attempts_id ON public.sec_login_attempts(identifier, created_at DESC);
CREATE INDEX idx_sec_login_attempts_ip ON public.sec_login_attempts(ip_address, created_at DESC);
GRANT SELECT ON public.sec_login_attempts TO authenticated;
GRANT ALL ON public.sec_login_attempts TO service_role;
ALTER TABLE public.sec_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sec_lockouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  identifier_type TEXT NOT NULL CHECK (identifier_type IN ('ip','email','account')),
  identifier_value TEXT NOT NULL,
  lockout_reason TEXT,
  lockout_count INTEGER NOT NULL DEFAULT 1,
  locked_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_sec_lockouts_uniq ON public.sec_lockouts(identifier_type, identifier_value);
CREATE INDEX idx_sec_lockouts_until ON public.sec_lockouts(locked_until);
GRANT SELECT, DELETE ON public.sec_lockouts TO authenticated;
GRANT ALL ON public.sec_lockouts TO service_role;
ALTER TABLE public.sec_lockouts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sec_waf_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('sql','xss','csrf','path','header','body','bot','custom')),
  pattern TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'block' CHECK (action IN ('block','log','captcha')),
  severity TEXT NOT NULL DEFAULT 'high' CHECK (severity IN ('low','medium','high','critical')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  hits_count BIGINT NOT NULL DEFAULT 0,
  last_hit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sec_waf_rules TO authenticated;
GRANT ALL ON public.sec_waf_rules TO service_role;
ALTER TABLE public.sec_waf_rules ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sec_waf_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waf_rule_id UUID NOT NULL REFERENCES public.sec_waf_rules(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  path_pattern TEXT NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sec_waf_exceptions TO authenticated;
GRANT ALL ON public.sec_waf_exceptions TO service_role;
ALTER TABLE public.sec_waf_exceptions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sec_rate_limit_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  endpoint_pattern TEXT NOT NULL,
  max_requests INTEGER NOT NULL CHECK (max_requests > 0),
  window_seconds INTEGER NOT NULL CHECK (window_seconds > 0),
  action TEXT NOT NULL DEFAULT 'throttle' CHECK (action IN ('throttle','block','captcha')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sec_rate_limit_rules TO authenticated;
GRANT ALL ON public.sec_rate_limit_rules TO service_role;
ALTER TABLE public.sec_rate_limit_rules ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sec_fraud_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('velocity','geolocation','device','amount','email','phone','card','behavior')),
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  action TEXT NOT NULL DEFAULT 'flag' CHECK (action IN ('flag','hold','block','notify')),
  risk_score_weight INTEGER NOT NULL DEFAULT 10 CHECK (risk_score_weight BETWEEN 1 AND 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sec_fraud_rules TO authenticated;
GRANT ALL ON public.sec_fraud_rules TO service_role;
ALTER TABLE public.sec_fraud_rules ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sec_fraud_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id UUID,
  customer_id UUID,
  ip_address INET,
  total_risk_score INTEGER NOT NULL DEFAULT 0 CHECK (total_risk_score BETWEEN 0 AND 100),
  triggered_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  action_taken TEXT NOT NULL DEFAULT 'auto_approve' CHECK (action_taken IN ('auto_approve','manual_review','sms_verify','auto_reject','notify_seller')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sec_fraud_scores_store ON public.sec_fraud_scores(store_id, created_at DESC);
CREATE INDEX idx_sec_fraud_scores_status ON public.sec_fraud_scores(status);
GRANT SELECT, UPDATE ON public.sec_fraud_scores TO authenticated;
GRANT ALL ON public.sec_fraud_scores TO service_role;
ALTER TABLE public.sec_fraud_scores ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sec_fraud_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fraud_score_id UUID NOT NULL REFERENCES public.sec_fraud_scores(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES public.sec_fraud_rules(id) ON DELETE SET NULL,
  signal_type TEXT NOT NULL,
  signal_value TEXT,
  risk_contribution INTEGER NOT NULL DEFAULT 0 CHECK (risk_contribution BETWEEN 0 AND 100),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sec_fraud_signals_score ON public.sec_fraud_signals(fraud_score_id);
GRANT SELECT ON public.sec_fraud_signals TO authenticated;
GRANT ALL ON public.sec_fraud_signals TO service_role;
ALTER TABLE public.sec_fraud_signals ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sec_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL,
  device_fingerprint TEXT,
  device_name TEXT,
  ip_address INET,
  user_agent TEXT,
  country_code TEXT,
  city TEXT,
  is_trusted_device BOOLEAN NOT NULL DEFAULT false,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sec_sessions_user ON public.sec_sessions(user_id, last_activity_at DESC);
CREATE UNIQUE INDEX idx_sec_sessions_token ON public.sec_sessions(session_token_hash);
GRANT SELECT, UPDATE ON public.sec_sessions TO authenticated;
GRANT ALL ON public.sec_sessions TO service_role;
ALTER TABLE public.sec_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sec_trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  device_name TEXT,
  device_type TEXT CHECK (device_type IN ('mobile','tablet','desktop','unknown')),
  browser TEXT,
  os TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trusted_until TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX idx_sec_trusted_devices_uniq ON public.sec_trusted_devices(user_id, device_fingerprint);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sec_trusted_devices TO authenticated;
GRANT ALL ON public.sec_trusted_devices TO service_role;
ALTER TABLE public.sec_trusted_devices ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sec_ssl_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active','expiring','expired','pending','error')),
  issued_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  issuer TEXT,
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_sec_ssl_domain ON public.sec_ssl_certificates(domain);
GRANT SELECT ON public.sec_ssl_certificates TO authenticated;
GRANT ALL ON public.sec_ssl_certificates TO service_role;
ALTER TABLE public.sec_ssl_certificates ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sec_data_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  data_type TEXT NOT NULL CHECK (data_type IN ('orders','customers','logs','analytics','sessions','attacks')),
  retention_days INTEGER NOT NULL CHECK (retention_days > 0),
  auto_delete BOOLEAN NOT NULL DEFAULT false,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_sec_retention_uniq ON public.sec_data_retention_policies(COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid), data_type);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sec_data_retention_policies TO authenticated;
GRANT ALL ON public.sec_data_retention_policies TO service_role;
ALTER TABLE public.sec_data_retention_policies ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sec_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  waf_mode TEXT NOT NULL DEFAULT 'active' CHECK (waf_mode IN ('passive','active','aggressive')),
  password_min_length INTEGER NOT NULL DEFAULT 8 CHECK (password_min_length BETWEEN 8 AND 64),
  password_require_upper BOOLEAN NOT NULL DEFAULT true,
  password_require_digit BOOLEAN NOT NULL DEFAULT true,
  password_require_symbol BOOLEAN NOT NULL DEFAULT false,
  password_max_age_days INTEGER,
  admin_session_hours INTEGER NOT NULL DEFAULT 2,
  seller_session_hours INTEGER NOT NULL DEFAULT 8,
  customer_session_days INTEGER NOT NULL DEFAULT 30,
  brute_force_max_attempts INTEGER NOT NULL DEFAULT 5,
  brute_force_lock_minutes INTEGER NOT NULL DEFAULT 15,
  brute_force_ip_ban_attempts INTEGER NOT NULL DEFAULT 20,
  admin_2fa TEXT NOT NULL DEFAULT 'required' CHECK (admin_2fa IN ('required','optional','off')),
  seller_2fa TEXT NOT NULL DEFAULT 'optional' CHECK (seller_2fa IN ('required','optional','off')),
  customer_2fa TEXT NOT NULL DEFAULT 'optional' CHECK (customer_2fa IN ('required','optional','off')),
  alert_email TEXT,
  alert_webhook_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sec_settings TO authenticated;
GRANT ALL ON public.sec_settings TO service_role;
ALTER TABLE public.sec_settings ENABLE ROW LEVEL SECURITY;

-- ===== RLS politikaları =====

-- Platform geneli (store_id NULL) kayıtlar: yalnız platform yöneticisi.
CREATE POLICY "sec_ip_rules_select" ON public.sec_ip_rules FOR SELECT TO authenticated
USING ((store_id IS NOT NULL AND app_private.is_store_member(store_id, auth.uid())) OR app_private.has_role(auth.uid(),'platform_admin'));
CREATE POLICY "sec_ip_rules_write" ON public.sec_ip_rules FOR ALL TO authenticated
USING ((store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid())) OR app_private.has_role(auth.uid(),'platform_admin'))
WITH CHECK ((store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid())) OR app_private.has_role(auth.uid(),'platform_admin'));

CREATE POLICY "sec_ip_reputation_select" ON public.sec_ip_reputation FOR SELECT TO authenticated
USING (app_private.has_role(auth.uid(),'platform_admin'));

CREATE POLICY "sec_blocked_countries_select" ON public.sec_blocked_countries FOR SELECT TO authenticated
USING ((store_id IS NOT NULL AND app_private.is_store_member(store_id, auth.uid())) OR app_private.has_role(auth.uid(),'platform_admin'));
CREATE POLICY "sec_blocked_countries_write" ON public.sec_blocked_countries FOR ALL TO authenticated
USING ((store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid())) OR app_private.has_role(auth.uid(),'platform_admin'))
WITH CHECK ((store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid())) OR app_private.has_role(auth.uid(),'platform_admin'));

CREATE POLICY "sec_attack_logs_select" ON public.sec_attack_logs FOR SELECT TO authenticated
USING ((store_id IS NOT NULL AND app_private.is_store_member(store_id, auth.uid())) OR app_private.has_role(auth.uid(),'platform_admin'));
CREATE POLICY "sec_attack_logs_update" ON public.sec_attack_logs FOR UPDATE TO authenticated
USING ((store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid())) OR app_private.has_role(auth.uid(),'platform_admin'))
WITH CHECK ((store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid())) OR app_private.has_role(auth.uid(),'platform_admin'));

CREATE POLICY "sec_threat_intel_select" ON public.sec_threat_intelligence FOR SELECT TO authenticated
USING (app_private.has_role(auth.uid(),'platform_admin'));

CREATE POLICY "sec_login_attempts_select" ON public.sec_login_attempts FOR SELECT TO authenticated
USING ((store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid())) OR app_private.has_role(auth.uid(),'platform_admin'));

CREATE POLICY "sec_lockouts_select" ON public.sec_lockouts FOR SELECT TO authenticated
USING ((store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid())) OR app_private.has_role(auth.uid(),'platform_admin'));
CREATE POLICY "sec_lockouts_delete" ON public.sec_lockouts FOR DELETE TO authenticated
USING ((store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid())) OR app_private.has_role(auth.uid(),'platform_admin'));

CREATE POLICY "sec_waf_rules_select" ON public.sec_waf_rules FOR SELECT TO authenticated
USING (app_private.has_role(auth.uid(),'platform_admin'));

CREATE POLICY "sec_waf_exceptions_select" ON public.sec_waf_exceptions FOR SELECT TO authenticated
USING ((store_id IS NOT NULL AND app_private.is_store_member(store_id, auth.uid())) OR app_private.has_role(auth.uid(),'platform_admin'));
CREATE POLICY "sec_waf_exceptions_write" ON public.sec_waf_exceptions FOR ALL TO authenticated
USING (app_private.has_role(auth.uid(),'platform_admin')) WITH CHECK (app_private.has_role(auth.uid(),'platform_admin'));

CREATE POLICY "sec_rate_limit_rules_select" ON public.sec_rate_limit_rules FOR SELECT TO authenticated
USING ((store_id IS NOT NULL AND app_private.is_store_member(store_id, auth.uid())) OR app_private.has_role(auth.uid(),'platform_admin'));
CREATE POLICY "sec_rate_limit_rules_write" ON public.sec_rate_limit_rules FOR ALL TO authenticated
USING ((store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid())) OR app_private.has_role(auth.uid(),'platform_admin'))
WITH CHECK ((store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid())) OR app_private.has_role(auth.uid(),'platform_admin'));

CREATE POLICY "sec_fraud_rules_select" ON public.sec_fraud_rules FOR SELECT TO authenticated
USING ((store_id IS NOT NULL AND app_private.is_store_member(store_id, auth.uid())) OR app_private.has_role(auth.uid(),'platform_admin'));
CREATE POLICY "sec_fraud_rules_write" ON public.sec_fraud_rules FOR ALL TO authenticated
USING ((store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid())) OR app_private.has_role(auth.uid(),'platform_admin'))
WITH CHECK ((store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid())) OR app_private.has_role(auth.uid(),'platform_admin'));

CREATE POLICY "sec_fraud_scores_select" ON public.sec_fraud_scores FOR SELECT TO authenticated
USING ((store_id IS NOT NULL AND app_private.is_store_member(store_id, auth.uid())) OR app_private.has_role(auth.uid(),'platform_admin'));
CREATE POLICY "sec_fraud_scores_update" ON public.sec_fraud_scores FOR UPDATE TO authenticated
USING ((store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid())) OR app_private.has_role(auth.uid(),'platform_admin'))
WITH CHECK ((store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid())) OR app_private.has_role(auth.uid(),'platform_admin'));

CREATE POLICY "sec_fraud_signals_select" ON public.sec_fraud_signals FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.sec_fraud_scores s WHERE s.id = fraud_score_id
  AND ((s.store_id IS NOT NULL AND app_private.is_store_member(s.store_id, auth.uid())) OR app_private.has_role(auth.uid(),'platform_admin'))));

CREATE POLICY "sec_sessions_select_own" ON public.sec_sessions FOR SELECT TO authenticated
USING (user_id = auth.uid() OR app_private.has_role(auth.uid(),'platform_admin'));
CREATE POLICY "sec_sessions_update_own" ON public.sec_sessions FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR app_private.has_role(auth.uid(),'platform_admin'))
WITH CHECK (user_id = auth.uid() OR app_private.has_role(auth.uid(),'platform_admin'));

CREATE POLICY "sec_trusted_devices_own" ON public.sec_trusted_devices FOR ALL TO authenticated
USING (user_id = auth.uid() OR app_private.has_role(auth.uid(),'platform_admin'))
WITH CHECK (user_id = auth.uid());

CREATE POLICY "sec_ssl_select" ON public.sec_ssl_certificates FOR SELECT TO authenticated
USING ((store_id IS NOT NULL AND app_private.is_store_member(store_id, auth.uid())) OR app_private.has_role(auth.uid(),'platform_admin'));

CREATE POLICY "sec_retention_select" ON public.sec_data_retention_policies FOR SELECT TO authenticated
USING ((store_id IS NOT NULL AND app_private.is_store_member(store_id, auth.uid())) OR app_private.has_role(auth.uid(),'platform_admin'));
CREATE POLICY "sec_retention_write" ON public.sec_data_retention_policies FOR ALL TO authenticated
USING ((store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid())) OR app_private.has_role(auth.uid(),'platform_admin'))
WITH CHECK ((store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid())) OR app_private.has_role(auth.uid(),'platform_admin'));

CREATE POLICY "sec_settings_select" ON public.sec_settings FOR SELECT TO authenticated
USING ((store_id IS NOT NULL AND app_private.is_store_member(store_id, auth.uid())) OR app_private.has_role(auth.uid(),'platform_admin'));
CREATE POLICY "sec_settings_write" ON public.sec_settings FOR ALL TO authenticated
USING ((store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid())) OR app_private.has_role(auth.uid(),'platform_admin'))
WITH CHECK ((store_id IS NOT NULL AND app_private.can_manage_store(store_id, auth.uid())) OR app_private.has_role(auth.uid(),'platform_admin'));

-- updated_at tetikleyicileri
CREATE TRIGGER trg_sec_ip_rules_updated BEFORE UPDATE ON public.sec_ip_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sec_ip_reputation_updated BEFORE UPDATE ON public.sec_ip_reputation FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sec_blocked_countries_updated BEFORE UPDATE ON public.sec_blocked_countries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sec_lockouts_updated BEFORE UPDATE ON public.sec_lockouts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sec_waf_rules_updated BEFORE UPDATE ON public.sec_waf_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sec_rate_limit_rules_updated BEFORE UPDATE ON public.sec_rate_limit_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sec_fraud_rules_updated BEFORE UPDATE ON public.sec_fraud_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sec_fraud_scores_updated BEFORE UPDATE ON public.sec_fraud_scores FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sec_ssl_updated BEFORE UPDATE ON public.sec_ssl_certificates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sec_retention_updated BEFORE UPDATE ON public.sec_data_retention_policies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sec_settings_updated BEFORE UPDATE ON public.sec_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Varsayılan WAF kuralları =====
INSERT INTO public.sec_waf_rules (rule_name, rule_type, pattern, action, severity) VALUES
  ('SQL Injection: union/select', 'sql', '(?i)(union[\s/*]+select|select\s+.*\s+from\s+information_schema|\bor\s+1\s*=\s*1\b|;\s*drop\s+table|\bsleep\s*\(\s*\d)', 'block', 'critical'),
  ('SQL Injection: yorum kaçışı', 'sql', '(?i)(--\s|\/\*!|\bxp_cmdshell\b|\bbenchmark\s*\()', 'block', 'high'),
  ('XSS: script etiketi', 'xss', '(?i)(<script\b|javascript:|onerror\s*=|onload\s*=|<iframe\b|document\.cookie)', 'block', 'high'),
  ('Path traversal', 'path', '(\.\./|\.\.\\|%2e%2e%2f|/etc/passwd|/proc/self/environ)', 'block', 'high'),
  ('Uzak dosya çağırma (RFI)', 'custom', '(?i)(=https?%3a%2f%2f|=https?://[^\s]+\.(php|txt)\b)', 'block', 'medium'),
  ('Şablon/komut enjeksiyonu', 'custom', '(\$\{jndi:|\{\{.*\}\}|\|\s*(curl|wget|nc)\s)', 'block', 'critical'),
  ('Bilinen tarama araçları', 'bot', '(?i)(sqlmap|nikto|nessus|acunetix|dirbuster|masscan|zgrab)', 'block', 'high'),
  ('Başlık anomalisi: boş user-agent', 'header', '^$', 'log', 'low');

-- ===== Varsayılan dolandırıcılık kuralları (platform geneli) =====
INSERT INTO public.sec_fraud_rules (store_id, rule_name, rule_type, conditions, action, risk_score_weight) VALUES
  (NULL, 'Aynı IP, 3 farklı kart', 'velocity', '{"window_minutes":60,"distinct_cards":3}', 'hold', 40),
  (NULL, 'Aynı müşteri, saatte 5 sipariş', 'velocity', '{"window_minutes":60,"orders":5}', 'flag', 30),
  (NULL, 'Aynı cihaz, 3 farklı hesap', 'device', '{"window_hours":24,"accounts":3}', 'hold', 50),
  (NULL, 'Yurt dışı kart, Türkiye IP', 'geolocation', '{"card_country_mismatch":true}', 'flag', 20),
  (NULL, 'VPN/Proxy tespiti', 'geolocation', '{"vpn_or_proxy":true}', 'flag', 25),
  (NULL, 'İlk sipariş, yüksek tutar', 'amount', '{"first_order":true,"min_amount":5000}', 'flag', 20),
  (NULL, 'Kargo adresi faturadan farklı', 'behavior', '{"address_mismatch":true}', 'flag', 10),
  (NULL, 'Çok hızlı ödeme (30 sn altı)', 'behavior', '{"checkout_seconds_below":30}', 'flag', 20),
  (NULL, 'Geçici e-posta servisi', 'email', '{"disposable_domain":true}', 'hold', 40),
  (NULL, 'Yeni kayıt, hızlı alışveriş', 'email', '{"account_age_minutes_below":60}', 'flag', 15),
  (NULL, 'Geçersiz telefon numarası', 'phone', '{"invalid_phone":true}', 'flag', 20),
  (NULL, 'Yeni cihaz, büyük sipariş', 'device', '{"new_device":true,"min_amount":3000}', 'flag', 15);

-- ===== Varsayılan saklama politikaları (platform geneli) =====
INSERT INTO public.sec_data_retention_policies (store_id, data_type, retention_days, auto_delete) VALUES
  (NULL, 'orders', 3650, false),
  (NULL, 'customers', 1825, false),
  (NULL, 'analytics', 730, true),
  (NULL, 'logs', 365, true),
  (NULL, 'attacks', 365, true),
  (NULL, 'sessions', 90, true);
