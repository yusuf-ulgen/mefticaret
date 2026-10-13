ALTER TABLE public.kolay_receipt_checks ADD COLUMN IF NOT EXISTS receipt_sha256 text;
ALTER TABLE public.kolay_receipt_checks ADD COLUMN IF NOT EXISTS bank_transaction_reference text;
ALTER TABLE public.kolay_receipt_checks ADD COLUMN IF NOT EXISTS reviewed_by uuid;
ALTER TABLE public.kolay_receipt_checks ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
CREATE UNIQUE INDEX receipt_image_once ON public.kolay_receipt_checks(store_id, receipt_sha256) WHERE receipt_sha256 IS NOT NULL;
CREATE UNIQUE INDEX receipt_bank_transaction_once ON public.kolay_receipt_checks(store_id, bank_transaction_reference) WHERE status = 'approved';

CREATE OR REPLACE FUNCTION public.review_payment_receipt(p_check_id uuid, p_actor uuid, p_approve boolean, p_bank_reference text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.kolay_receipt_checks; o public.orders;
BEGIN
  SELECT * INTO c FROM public.kolay_receipt_checks WHERE id = p_check_id FOR UPDATE;
  IF NOT FOUND OR NOT app_private.can_manage_store(c.store_id, p_actor) THEN RAISE EXCEPTION 'Dekont inceleme yetkisi yok'; END IF;
  IF c.status IN ('approved','rejected') THEN RETURN jsonb_build_object('status', c.status, 'alreadyReviewed', true); END IF;
  IF c.status <> 'pending_review' THEN RAISE EXCEPTION 'Dekont onaya uygun değil'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = c.order_id AND store_id = c.store_id FOR UPDATE;
  IF NOT FOUND OR o.payment_status <> 'pending' OR o.status IN ('cancelled','returned','refunded') THEN RAISE EXCEPTION 'Sipariş tahsilat onayına uygun değil'; END IF;
  IF p_approve THEN
    IF length(trim(COALESCE(p_bank_reference,''))) < 3 THEN RAISE EXCEPTION 'Doğrulanmış banka işlem referansı gerekli'; END IF;
    UPDATE public.kolay_receipt_checks SET status = 'approved', bank_transaction_reference = trim(p_bank_reference), reviewed_by = p_actor, reviewed_at = now() WHERE id = c.id;
    UPDATE public.orders SET payment_status = 'paid' WHERE id = o.id;
    INSERT INTO public.order_events(order_id, store_id, actor_id, kind, message, meta)
    VALUES (o.id, o.store_id, p_actor, 'payment', 'Banka tahsilatı açık manuel onayla doğrulandı', jsonb_build_object('receipt_check_id',c.id));
  ELSE
    UPDATE public.kolay_receipt_checks SET status = 'rejected', reviewed_by = p_actor, reviewed_at = now() WHERE id = c.id;
  END IF;
  RETURN jsonb_build_object('status', CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, 'alreadyReviewed', false);
END $$;
REVOKE ALL ON FUNCTION public.review_payment_receipt(uuid,uuid,boolean,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_payment_receipt(uuid,uuid,boolean,text) TO service_role;
