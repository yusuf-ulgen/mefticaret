ALTER TABLE public.qnbpay_refunds DROP CONSTRAINT IF EXISTS qnbpay_refund_status_chk;
ALTER TABLE public.qnbpay_refunds ADD CONSTRAINT qnbpay_refund_status_chk CHECK (status IN ('pending','processing','completed','failed','unknown','duplicate'));
ALTER TABLE public.qnbpay_refunds ADD COLUMN IF NOT EXISTS provider_refund_key text;
ALTER TABLE public.qnbpay_refunds ADD COLUMN IF NOT EXISTS accounted_at timestamptz;
ALTER TABLE public.qnbpay_refunds ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES public.qnbpay_refunds(id);
ALTER TABLE public.qnbpay_refunds ADD COLUMN IF NOT EXISTS request_key text;
-- Önceki kayıtlar silinmez ve tarihsel toplamlar kanıtsız değiştirilmez.
WITH ranked AS (SELECT id, row_number() OVER (PARTITION BY transaction_id, ref_no ORDER BY (status='completed') DESC, created_at, id) n FROM public.qnbpay_refunds WHERE ref_no IS NOT NULL)
UPDATE public.qnbpay_refunds r SET provider_refund_key = 'ref:' || r.ref_no FROM ranked x WHERE x.id=r.id AND x.n=1;
UPDATE public.qnbpay_refunds SET accounted_at=created_at WHERE status='completed';
CREATE UNIQUE INDEX qnbpay_refund_provider_once ON public.qnbpay_refunds(transaction_id,provider_refund_key) WHERE provider_refund_key IS NOT NULL;
CREATE UNIQUE INDEX qnbpay_refund_request_once ON public.qnbpay_refunds(transaction_id,request_key) WHERE request_key IS NOT NULL;

CREATE TABLE public.qnbpay_refund_events (
  event_key text PRIMARY KEY,
  transaction_id uuid NOT NULL REFERENCES public.qnbpay_transactions(id),
  provider_reference text,
  amount numeric NOT NULL CHECK (amount > 0),
  needs_reconciliation boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qnbpay_refund_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.qnbpay_refund_events TO authenticated;
GRANT ALL ON public.qnbpay_refund_events TO service_role;
CREATE POLICY qnbpay_refund_event_admin_read ON public.qnbpay_refund_events FOR SELECT TO authenticated USING (app_private.has_role(auth.uid(),'platform_admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.record_qnbpay_refund(
  p_transaction_id uuid, p_provider_reference text, p_amount numeric,
  p_apply boolean, p_succeeded boolean, p_refund_id uuid DEFAULT NULL,
  p_event_key text DEFAULT NULL, p_payload jsonb DEFAULT '{}'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tx public.qnbpay_transactions; r public.qnbpay_refunds; total numeric; inserted_event text;
BEGIN
  SELECT * INTO tx FROM public.qnbpay_transactions WHERE id=p_transaction_id FOR UPDATE;
  IF NOT FOUND OR p_amount IS NULL OR p_amount <= 0 OR p_amount > tx.amount THEN RAISE EXCEPTION 'Geçersiz iade işlemi veya tutarı'; END IF;
  IF p_event_key IS NOT NULL THEN
    INSERT INTO public.qnbpay_refund_events(event_key,transaction_id,provider_reference,amount,payload)
    VALUES(p_event_key,tx.id,p_provider_reference,p_amount,p_payload) ON CONFLICT DO NOTHING RETURNING event_key INTO inserted_event;
    IF inserted_event IS NULL THEN RETURN jsonb_build_object('duplicate',true,'applied',false); END IF;
  END IF;
  IF NULLIF(trim(p_provider_reference),'') IS NULL THEN
    IF p_apply THEN RAISE EXCEPTION 'Sağlayıcı iade referansı gerekli'; END IF;
    RETURN jsonb_build_object('applied',false,'needsReconciliation',true);
  END IF;
  SELECT * INTO r FROM public.qnbpay_refunds WHERE transaction_id=tx.id AND
    (provider_refund_key='ref:'||p_provider_reference OR ref_no=p_provider_reference)
    ORDER BY accounted_at NULLS LAST, created_at, id LIMIT 1 FOR UPDATE;
  IF FOUND AND r.amount <> p_amount THEN RAISE EXCEPTION 'Aynı iade referansında tutar uyuşmazlığı'; END IF;
  IF r.id IS NULL AND p_refund_id IS NOT NULL THEN
    SELECT * INTO r FROM public.qnbpay_refunds WHERE id=p_refund_id AND transaction_id=tx.id FOR UPDATE;
    IF NOT FOUND OR r.amount <> p_amount THEN RAISE EXCEPTION 'İade talebi uyuşmuyor'; END IF;
    UPDATE public.qnbpay_refunds SET provider_refund_key='ref:'||p_provider_reference,ref_no=p_provider_reference WHERE id=r.id;
  END IF;
  IF r.id IS NULL THEN
    INSERT INTO public.qnbpay_refunds(transaction_id,amount,status,ref_no,provider_refund_key,webhook_payload)
    VALUES(tx.id,p_amount,'pending',p_provider_reference,'ref:'||p_provider_reference,p_payload) RETURNING * INTO r;
  END IF;
  IF p_refund_id IS NOT NULL AND p_refund_id <> r.id THEN
    UPDATE public.qnbpay_refunds SET status='duplicate', duplicate_of=r.id, ref_no=p_provider_reference WHERE id=p_refund_id AND transaction_id=tx.id AND accounted_at IS NULL;
  END IF;
  IF NOT p_apply THEN
    IF r.accounted_at IS NOT NULL THEN UPDATE public.qnbpay_refund_events SET needs_reconciliation=false WHERE event_key=p_event_key; END IF;
    RETURN jsonb_build_object('refundId',r.id,'applied',false,'needsReconciliation',r.accounted_at IS NULL);
  END IF;
  IF r.accounted_at IS NOT NULL THEN RETURN jsonb_build_object('refundId',r.id,'duplicate',true,'applied',false); END IF;
  IF NOT p_succeeded THEN
    UPDATE public.qnbpay_refunds SET status='failed',response_summary=p_payload WHERE id=r.id;
    RETURN jsonb_build_object('refundId',r.id,'applied',false);
  END IF;
  total := COALESCE(tx.refunded_amount,0)+p_amount;
  IF total > tx.amount THEN RAISE EXCEPTION 'İade toplamı tahsilatı aşamaz'; END IF;
  UPDATE public.qnbpay_refunds SET status='completed',accounted_at=now(),response_summary=p_payload,ref_no=p_provider_reference WHERE id=r.id;
  UPDATE public.qnbpay_transactions SET refunded_amount=total,status=CASE WHEN total >= tx.amount THEN 'refunded' ELSE 'partial_refunded' END WHERE id=tx.id;
  UPDATE public.qnbpay_refund_events SET needs_reconciliation=false WHERE transaction_id=tx.id AND provider_reference=p_provider_reference;
  RETURN jsonb_build_object('refundId',r.id,'applied',true,'total',total);
END $$;
REVOKE ALL ON FUNCTION public.record_qnbpay_refund(uuid,text,numeric,boolean,boolean,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_qnbpay_refund(uuid,text,numeric,boolean,boolean,uuid,text,jsonb) TO service_role;
