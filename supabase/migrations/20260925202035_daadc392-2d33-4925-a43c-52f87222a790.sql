CREATE OR REPLACE FUNCTION public.sec_bump_waf_hit(_rule_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.sec_waf_rules
     SET hits_count = hits_count + 1, last_hit_at = now()
   WHERE id = _rule_id;
$$;
REVOKE ALL ON FUNCTION public.sec_bump_waf_hit(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sec_bump_waf_hit(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.sec_bump_ip_rule_hit(_rule_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.sec_ip_rules
     SET hits_count = hits_count + 1
   WHERE id = _rule_id;
$$;
REVOKE ALL ON FUNCTION public.sec_bump_ip_rule_hit(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sec_bump_ip_rule_hit(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.sec_cleanup()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  removed_locks INTEGER := 0;
  removed_attacks INTEGER := 0;
  removed_attempts INTEGER := 0;
  attack_days INTEGER := 365;
BEGIN
  SELECT COALESCE(MIN(retention_days), 365) INTO attack_days
    FROM public.sec_data_retention_policies
   WHERE store_id IS NULL AND data_type = 'attacks' AND auto_delete;

  DELETE FROM public.sec_lockouts WHERE locked_until < now() - INTERVAL '7 days';
  GET DIAGNOSTICS removed_locks = ROW_COUNT;

  DELETE FROM public.sec_attack_logs WHERE created_at < now() - (attack_days || ' days')::interval;
  GET DIAGNOSTICS removed_attacks = ROW_COUNT;

  DELETE FROM public.sec_login_attempts WHERE created_at < now() - INTERVAL '90 days';
  GET DIAGNOSTICS removed_attempts = ROW_COUNT;

  UPDATE public.sec_ip_rules SET is_active = false
   WHERE is_active AND expires_at IS NOT NULL AND expires_at < now();

  RETURN jsonb_build_object('lockouts', removed_locks, 'attacks', removed_attacks, 'attempts', removed_attempts);
END;
$$;
REVOKE ALL ON FUNCTION public.sec_cleanup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sec_cleanup() TO service_role;
