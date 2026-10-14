-- Recover legacy ownership only when an exact order/line commission has one owner.
-- Never infer ownership from an order header or expose all lines to its suppliers.
INSERT INTO public.order_item_suppliers(order_item_id, supplier_id, order_id, store_id, source)
SELECT i.id, min(c.supplier_id::text)::uuid, i.order_id, i.store_id, 'commission_history_recovery'
FROM public.order_items i
JOIN public.supplier_commission_entries c ON c.order_item_id = i.id AND c.order_id = i.order_id
WHERE NOT EXISTS (SELECT 1 FROM public.order_item_suppliers x WHERE x.order_item_id = i.id)
GROUP BY i.id, i.order_id, i.store_id
HAVING count(DISTINCT c.supplier_id) = 1
ON CONFLICT DO NOTHING;

--> statement-breakpoint
-- A version, active flag and public pointer must become visible together.
CREATE OR REPLACE FUNCTION public.publish_policy_version(
  p_policy_id uuid, p_store_id uuid, p_content text, p_bump text,
  p_effective_date date, p_change_summary text, p_requires_acceptance boolean,
  p_expected_updated_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  policy public.policies%ROWTYPE;
  next_version text;
  latest_version text;
  version_id uuid;
  actor uuid := auth.uid();
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Oturum gerekli'; END IF;
  IF p_store_id IS NULL THEN
    IF NOT app_private.has_role(actor, 'platform_admin') THEN RAISE EXCEPTION 'Platform yetkisi gerekli'; END IF;
  ELSIF NOT app_private.can_manage_store(p_store_id, actor) THEN
    RAISE EXCEPTION 'Mağaza yönetici yetkisi gerekli';
  END IF;
  SELECT * INTO policy FROM public.policies
    WHERE id = p_policy_id AND store_id IS NOT DISTINCT FROM p_store_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Politika bulunamadı'; END IF;
  IF policy.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Taslak değişti. Sayfayı yenileyip tekrar yayınlayın.';
  END IF;
  IF p_bump NOT IN ('minor', 'major') OR p_bump IS NULL OR p_effective_date IS NULL
     OR coalesce(length(btrim(p_change_summary)), 0) < 2
     OR coalesce(length(btrim(regexp_replace(p_content, '<[^>]*>', '', 'g'))), 0) = 0 THEN
    RAISE EXCEPTION 'Yayın bilgileri veya politika metni eksik';
  END IF;
  -- An earlier non-atomic publish may have left an immutable inactive version.
  -- Preserve it and advance the version instead of permanently blocking publication.
  SELECT version INTO latest_version FROM public.policy_versions
    WHERE policy_id = policy.id AND version ~ '^[0-9]+\.[0-9]+$'
    ORDER BY split_part(version, '.', 1)::int DESC, split_part(version, '.', 2)::int DESC LIMIT 1;
  next_version := CASE WHEN latest_version IS NULL THEN '1.0'
    WHEN p_bump = 'major' THEN ((split_part(latest_version, '.', 1))::int + 1)::text || '.0'
    ELSE split_part(latest_version, '.', 1) || '.' || ((split_part(latest_version, '.', 2))::int + 1)::text END;
  INSERT INTO public.policy_versions(
    policy_id, store_id, version, title, content, effective_date,
    change_summary, requires_acceptance, created_by, published_at, is_active
  ) VALUES (
    policy.id, p_store_id, next_version, policy.title, p_content, p_effective_date,
    p_change_summary, p_requires_acceptance, actor, now(), false
  ) RETURNING id INTO version_id;
  UPDATE public.policy_versions SET is_active = false WHERE policy_id = policy.id AND is_active;
  UPDATE public.policy_versions SET is_active = true WHERE id = version_id;
  UPDATE public.policies SET current_version_id = version_id, version = next_version,
    effective_date = p_effective_date, change_summary = p_change_summary,
    requires_acceptance = p_requires_acceptance, last_reviewed_at = now(), last_reviewed_by = actor,
    is_visible = true
    WHERE id = policy.id;
  RETURN jsonb_build_object('version', next_version);
END $$;
REVOKE ALL ON FUNCTION public.publish_policy_version(uuid,uuid,text,text,date,text,boolean,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_policy_version(uuid,uuid,text,text,date,text,boolean,timestamptz) TO authenticated;
