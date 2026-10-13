ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS checkout_policy_version_ids uuid[];
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS checkout_acceptance_meta jsonb;

CREATE OR REPLACE FUNCTION public.record_order_policy_acceptance() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE valid_count integer;
BEGIN
  IF NEW.checkout_policy_version_ids IS NULL THEN RETURN NEW; END IF;
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Checkout kabulü yalnız sunucudan kaydedilir'; END IF;
  IF cardinality(NEW.checkout_policy_version_ids) <> 3 THEN RAISE EXCEPTION 'Üç yayınlanmış politika sürümü gerekli'; END IF;
  -- Acceptance counters are updated below: take write locks in one stable order,
  -- rather than upgrading shared locks in concurrent checkouts.
  PERFORM p.id FROM public.policies p WHERE p.store_id=NEW.store_id AND p.current_version_id=ANY(NEW.checkout_policy_version_ids) ORDER BY p.id FOR UPDATE;
  SELECT count(*) INTO valid_count FROM public.policies p JOIN public.policy_versions v ON v.id=p.current_version_id AND v.policy_id=p.id
    WHERE p.store_id=NEW.store_id AND v.store_id=NEW.store_id AND p.is_visible AND v.is_active AND v.published_at IS NOT NULL AND length(trim(v.content))>0
    AND (v.effective_date IS NULL OR v.effective_date<=CURRENT_DATE) AND p.policy_key IN ('privacy','refund','distance_selling') AND v.id=ANY(NEW.checkout_policy_version_ids);
  IF valid_count <> 3 THEN RAISE EXCEPTION 'Politika metinleri eksik veya değişti. Güncel metinleri yeniden onaylayın'; END IF;
  INSERT INTO public.policy_acceptances(policy_id,policy_version_id,store_id,version_label,user_type,user_id,subject_email,order_number,ip_address,user_agent,acceptance_method)
  SELECT p.id,v.id,NEW.store_id,v.version,'customer',NULLIF(NEW.checkout_acceptance_meta->>'userId','')::uuid,NEW.customer_email,NEW.order_number,NEW.checkout_acceptance_meta->>'ip',NEW.checkout_acceptance_meta->>'userAgent','checkout'
  FROM public.policies p JOIN public.policy_versions v ON v.id=p.current_version_id WHERE p.store_id=NEW.store_id AND v.id=ANY(NEW.checkout_policy_version_ids);
  UPDATE public.policies SET acceptance_count=COALESCE(acceptance_count,0)+1 WHERE store_id=NEW.store_id AND current_version_id=ANY(NEW.checkout_policy_version_ids);
  RETURN NEW;
END $$;
CREATE TRIGGER order_policy_evidence AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.record_order_policy_acceptance();
