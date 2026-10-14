ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS is_digital boolean NOT NULL DEFAULT false;
UPDATE public.order_items i SET is_digital = p.is_digital FROM public.products p WHERE p.id = i.product_id;
UPDATE public.order_items i SET is_digital = true FROM public.orders o WHERE o.id = i.order_id AND o.is_digital;

CREATE OR REPLACE FUNCTION public.snapshot_order_item_delivery() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    SELECT COALESCE(p.is_digital, false) INTO NEW.is_digital FROM public.products p WHERE p.id = NEW.product_id AND p.store_id = NEW.store_id;
    NEW.is_digital := COALESCE(NEW.is_digital, false);
  ELSE
    SELECT COALESCE(o.is_digital, false) INTO NEW.is_digital FROM public.orders o WHERE o.id = NEW.order_id AND o.store_id = NEW.store_id;
    NEW.is_digital := COALESCE(NEW.is_digital, false);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS order_item_delivery_snapshot ON public.order_items;
CREATE TRIGGER order_item_delivery_snapshot BEFORE INSERT ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.snapshot_order_item_delivery();

CREATE OR REPLACE FUNCTION public.guard_physical_shipment_item() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.order_items i JOIN public.shipments s ON s.id = NEW.shipment_id
    WHERE i.id = NEW.order_item_id AND i.order_id = s.order_id AND i.store_id = s.store_id AND NOT i.is_digital
    AND NEW.quantity > 0 AND NEW.quantity <= i.quantity) THEN
    RAISE EXCEPTION 'Sevkiyat yalnız aynı siparişin fiziksel kalemlerini içerebilir';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS shipment_item_physical_guard ON public.shipment_items;
CREATE TRIGGER shipment_item_physical_guard BEFORE INSERT OR UPDATE ON public.shipment_items FOR EACH ROW EXECUTE FUNCTION public.guard_physical_shipment_item();

CREATE OR REPLACE FUNCTION public.sync_order_fulfillment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target uuid := COALESCE(NEW.order_id, OLD.order_id); required_qty bigint; sent_qty bigint; digital_count bigint;
BEGIN
  SELECT COALESCE(sum(quantity) FILTER(WHERE NOT is_digital),0), count(*) FILTER(WHERE is_digital)
    INTO required_qty,digital_count FROM public.order_items WHERE order_id=target;
  SELECT COALESCE(sum(least(i.quantity, COALESCE(sent.qty,0))),0) INTO sent_qty
  FROM public.order_items i LEFT JOIN (
    SELECT si.order_item_id,sum(si.quantity) qty FROM public.shipment_items si
    JOIN public.shipments s ON s.id=si.shipment_id
    WHERE s.order_id=target AND s.status IN ('picked_up','in_transit','out_for_delivery','delivered')
    GROUP BY si.order_item_id
  ) sent ON sent.order_item_id=i.id WHERE i.order_id=target AND NOT i.is_digital;
  UPDATE public.orders o SET fulfillment_status=CASE
    WHEN sent_qty=0 THEN o.fulfillment_status
    WHEN sent_qty>=required_qty AND digital_count=0 THEN 'fulfilled'::public.fulfillment_status
    ELSE 'partially_fulfilled'::public.fulfillment_status END,
    shipping_carrier=COALESCE((SELECT carrier FROM public.shipments WHERE order_id=target ORDER BY created_at DESC LIMIT 1),o.shipping_carrier),
    tracking_number=COALESCE((SELECT tracking_number FROM public.shipments WHERE order_id=target ORDER BY created_at DESC LIMIT 1),o.tracking_number)
  WHERE o.id=target AND o.status NOT IN ('cancelled','returned','refunded');
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.sync_order_fulfillment() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.store_order_summary(_store_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH scoped AS (SELECT * FROM public.orders WHERE store_id = _store_id),
  statuses AS (SELECT status::text key, count(*) value FROM scoped GROUP BY status),
  revenues AS (SELECT currency, sum(grand_total) total FROM scoped WHERE payment_status = 'paid' AND status <> 'cancelled' GROUP BY currency)
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM scoped),
    'counts', COALESCE((SELECT jsonb_object_agg(key, value) FROM statuses), '{}'::jsonb),
    'awaitingPayment', (SELECT count(*) FROM scoped WHERE payment_status = 'pending' AND status NOT IN ('cancelled', 'returned', 'refunded')),
    'paidRevenue', COALESCE((SELECT jsonb_object_agg(currency, total) FROM revenues), '{}'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.store_order_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.store_order_summary(uuid) TO authenticated;

ALTER TABLE public.kolay_receipt_checks ADD COLUMN IF NOT EXISTS receipt_sha256 text;
ALTER TABLE public.kolay_receipt_checks ADD COLUMN IF NOT EXISTS bank_transaction_reference text;
ALTER TABLE public.kolay_receipt_checks ADD COLUMN IF NOT EXISTS reviewed_by uuid;
ALTER TABLE public.kolay_receipt_checks ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS receipt_image_once ON public.kolay_receipt_checks(store_id, receipt_sha256) WHERE receipt_sha256 IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS receipt_bank_transaction_once ON public.kolay_receipt_checks(store_id, bank_transaction_reference) WHERE status = 'approved';

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

ALTER TABLE public.qnbpay_refunds DROP CONSTRAINT IF EXISTS qnbpay_refund_status_chk;
ALTER TABLE public.qnbpay_refunds ADD CONSTRAINT qnbpay_refund_status_chk CHECK (status IN ('pending','processing','completed','failed','unknown','duplicate'));
ALTER TABLE public.qnbpay_refunds ADD COLUMN IF NOT EXISTS provider_refund_key text;
ALTER TABLE public.qnbpay_refunds ADD COLUMN IF NOT EXISTS accounted_at timestamptz;
ALTER TABLE public.qnbpay_refunds ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES public.qnbpay_refunds(id);
ALTER TABLE public.qnbpay_refunds ADD COLUMN IF NOT EXISTS request_key text;
WITH ranked AS (SELECT id, row_number() OVER (PARTITION BY transaction_id, ref_no ORDER BY (status='completed') DESC, created_at, id) n FROM public.qnbpay_refunds WHERE ref_no IS NOT NULL)
UPDATE public.qnbpay_refunds r SET provider_refund_key = 'ref:' || r.ref_no FROM ranked x WHERE x.id=r.id AND x.n=1;
UPDATE public.qnbpay_refunds SET accounted_at=created_at WHERE status='completed';
CREATE UNIQUE INDEX IF NOT EXISTS qnbpay_refund_provider_once ON public.qnbpay_refunds(transaction_id,provider_refund_key) WHERE provider_refund_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS qnbpay_refund_request_once ON public.qnbpay_refunds(transaction_id,request_key) WHERE request_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.qnbpay_refund_events (
  event_key text PRIMARY KEY,
  transaction_id uuid NOT NULL REFERENCES public.qnbpay_transactions(id),
  provider_reference text,
  amount numeric NOT NULL CHECK (amount > 0),
  needs_reconciliation boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.qnbpay_refund_events TO authenticated;
GRANT ALL ON public.qnbpay_refund_events TO service_role;
ALTER TABLE public.qnbpay_refund_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS qnbpay_refund_event_admin_read ON public.qnbpay_refund_events;
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

CREATE OR REPLACE FUNCTION public.claim_order_refund(p_refund_id uuid,p_actor uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.refunds;
BEGIN
  SELECT * INTO r FROM public.refunds WHERE id=p_refund_id FOR UPDATE;
  IF NOT FOUND OR NOT app_private.can_manage_store(r.store_id,p_actor) THEN RAISE EXCEPTION 'İade işleme yetkisi yok'; END IF;
  IF r.status IN ('processed','processing') THEN RETURN jsonb_build_object('claimed',false,'status',r.status); END IF;
  IF r.status NOT IN ('pending','failed') THEN RAISE EXCEPTION 'İade işlenemez'; END IF;
  UPDATE public.refunds SET status='processing',processed_by=p_actor WHERE id=r.id;
  RETURN jsonb_build_object('claimed',true,'status','processing');
END $$;
REVOKE ALL ON FUNCTION public.claim_order_refund(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_order_refund(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_qnbpay_refund(p_transaction_id uuid,p_amount numeric,p_request_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tx public.qnbpay_transactions; r public.qnbpay_refunds; reserved numeric; amount numeric;
BEGIN
  SELECT * INTO tx FROM public.qnbpay_transactions WHERE id=p_transaction_id FOR UPDATE;
  IF NOT FOUND OR NULLIF(trim(p_request_key),'') IS NULL THEN RAISE EXCEPTION 'İade işlem anahtarı gerekli'; END IF;
  SELECT * INTO r FROM public.qnbpay_refunds WHERE transaction_id=tx.id AND request_key=p_request_key FOR UPDATE;
  IF FOUND AND r.status='duplicate' AND r.duplicate_of IS NOT NULL THEN SELECT * INTO r FROM public.qnbpay_refunds WHERE id=r.duplicate_of; END IF;
  IF r.id IS NOT NULL AND r.status <> 'failed' THEN RETURN jsonb_build_object('claimed',false,'id',r.id,'status',r.status,'refNo',r.ref_no,'amount',r.amount); END IF;
  amount := CASE WHEN p_amount > 0 THEN p_amount ELSE tx.amount-COALESCE(tx.refunded_amount,0) END;
  IF r.id IS NOT NULL AND r.amount <> amount THEN RAISE EXCEPTION 'İşlem anahtarı farklı tutarla kullanılamaz'; END IF;
  SELECT COALESCE(sum(q.amount),0) INTO reserved FROM public.qnbpay_refunds q WHERE q.transaction_id=tx.id AND q.request_key IS NOT NULL AND q.status IN ('pending','processing','unknown') AND q.id IS DISTINCT FROM r.id;
  IF amount <= 0 OR amount+COALESCE(tx.refunded_amount,0)+reserved > tx.amount THEN RAISE EXCEPTION 'İade edilebilir tutar yetersiz veya başka işlem sürüyor'; END IF;
  IF r.id IS NULL THEN
    INSERT INTO public.qnbpay_refunds(transaction_id,amount,status,request_key) VALUES(tx.id,amount,'processing',p_request_key) RETURNING * INTO r;
  ELSE
    UPDATE public.qnbpay_refunds SET status='processing' WHERE id=r.id;
  END IF;
  RETURN jsonb_build_object('claimed',true,'id',r.id,'status','processing','amount',amount);
END $$;
REVOKE ALL ON FUNCTION public.claim_qnbpay_refund(uuid,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_qnbpay_refund(uuid,numeric,text) TO service_role;

CREATE OR REPLACE FUNCTION public.create_order_refund(
  p_order_id uuid, p_lines jsonb, p_amount numeric, p_method text,
  p_reason text, p_note text, p_idempotency_key text, p_actor uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_existing uuid;
  v_refunded numeric;
  v_refundable numeric;
  v_refund_id uuid;
  v_next int;
  v_line jsonb;
  v_item public.order_items%ROWTYPE;
  v_qty int;
  v_done int;
  v_tax numeric := 0;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sipariş bulunamadı'; END IF;
  IF NOT app_private.can_manage_store(v_order.store_id, p_actor) THEN RAISE EXCEPTION 'Yetkiniz yok'; END IF;
  IF p_method NOT IN ('original_payment','store_credit','manual') THEN RAISE EXCEPTION 'Geçersiz iade yöntemi'; END IF;
  IF p_idempotency_key IS NULL OR length(p_idempotency_key) < 8 THEN RAISE EXCEPTION 'Geçersiz işlem anahtarı'; END IF;
  SELECT id INTO v_existing FROM public.refunds WHERE store_id = v_order.store_id AND idempotency_key = p_idempotency_key;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  IF v_order.payment_status NOT IN ('paid','partially_refunded') THEN RAISE EXCEPTION 'Yalnızca ödemesi alınmış siparişler iade edilebilir'; END IF;
  IF p_method = 'store_credit' AND v_order.customer_id IS NULL THEN RAISE EXCEPTION 'Mağaza kredisi için kayıtlı müşteri gerekli'; END IF;
  SELECT COALESCE(sum(amount),0) INTO v_refunded FROM public.refunds
    WHERE order_id = p_order_id AND status IN ('pending','processing','processed');
  v_refundable := v_order.grand_total - v_refunded;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'İade tutarı sıfırdan büyük olmalı'; END IF;
  IF p_amount > v_refundable + 0.001 THEN RAISE EXCEPTION 'İade tutarı kalan iade edilebilir tutarı (%) aşamaz', round(v_refundable,2); END IF;
  SELECT COALESCE(max(NULLIF(regexp_replace(refund_number,'\D','','g'),'')::int),0) + 1 INTO v_next
    FROM public.refunds WHERE store_id = v_order.store_id;
  INSERT INTO public.refunds(store_id, order_id, amount, currency, status, reason, note, refund_method, refund_number, idempotency_key, created_by)
  VALUES (v_order.store_id, p_order_id, round(p_amount,2), v_order.currency, 'pending', p_reason, p_note, p_method,
          'REF-' || lpad(v_next::text, 4, '0'), p_idempotency_key, p_actor)
  RETURNING id INTO v_refund_id;
  FOR v_line IN SELECT * FROM jsonb_array_elements(COALESCE(p_lines,'[]'::jsonb)) LOOP
    v_qty := (v_line->>'quantity')::int;
    IF v_qty IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;
    SELECT * INTO v_item FROM public.order_items WHERE id = (v_line->>'order_item_id')::uuid AND order_id = p_order_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Sipariş kalemi bulunamadı'; END IF;
    SELECT COALESCE(sum(l.quantity),0) INTO v_done FROM public.refund_line_items l
      JOIN public.refunds r ON r.id = l.refund_id
      WHERE l.order_item_id = v_item.id AND r.status IN ('pending','processing','processed') AND r.id <> v_refund_id;
    IF v_done + v_qty > v_item.quantity THEN RAISE EXCEPTION '% için en fazla % adet iade edilebilir', v_item.title, v_item.quantity - v_done; END IF;
    INSERT INTO public.refund_line_items(refund_id, store_id, order_item_id, quantity, subtotal, total_tax, restock)
    VALUES (v_refund_id, v_order.store_id, v_item.id, v_qty,
            round(v_item.unit_price * v_qty, 2),
            round(CASE WHEN v_item.quantity > 0 THEN v_item.tax_total * v_qty / v_item.quantity ELSE 0 END, 2),
            COALESCE((v_line->>'restock')::boolean, false));
  END LOOP;
  SELECT COALESCE(sum(total_tax),0) INTO v_tax FROM public.refund_line_items WHERE refund_id = v_refund_id;
  UPDATE public.refunds SET total_tax = v_tax WHERE id = v_refund_id;
  INSERT INTO public.order_events(order_id, store_id, kind, message, actor_id, meta)
  VALUES (p_order_id, v_order.store_id, 'refund_created', 'İade oluşturuldu', p_actor,
          jsonb_build_object('refund_id', v_refund_id, 'amount', p_amount, 'method', p_method, 'reason', p_reason));
  RETURN v_refund_id;
END $$;
REVOKE ALL ON FUNCTION public.create_order_refund(uuid,jsonb,numeric,text,text,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_refund(uuid,jsonb,numeric,text,text,text,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_order_refund(p_refund_id uuid, p_actor uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_refund public.refunds%ROWTYPE;
BEGIN
  SELECT * INTO v_refund FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND OR NOT app_private.can_manage_store(v_refund.store_id, p_actor) THEN RAISE EXCEPTION 'İade bulunamadı'; END IF;
  IF v_refund.status NOT IN ('pending','failed') THEN RAISE EXCEPTION 'Tamamlanmış iade iptal edilemez'; END IF;
  IF EXISTS (SELECT 1 FROM public.refund_transactions WHERE refund_id = p_refund_id AND status = 'succeeded') THEN
    RAISE EXCEPTION 'Sağlayıcıda tamamlanmış iade iptal edilemez';
  END IF;
  UPDATE public.refunds SET status = 'cancelled' WHERE id = p_refund_id;
  INSERT INTO public.order_events(order_id, store_id, kind, message, actor_id, meta)
  VALUES (v_refund.order_id, v_refund.store_id, 'refund_cancelled', COALESCE(v_refund.refund_number,'İade') || ' iptal edildi', p_actor, jsonb_build_object('refund_id', p_refund_id));
END $$;
REVOKE ALL ON FUNCTION public.cancel_order_refund(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order_refund(uuid,uuid) TO service_role;

CREATE TABLE IF NOT EXISTS public.order_item_suppliers (
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(order_item_id,supplier_id)
);
REVOKE ALL ON public.order_item_suppliers FROM anon,authenticated;
GRANT ALL ON public.order_item_suppliers TO service_role;
ALTER TABLE public.order_item_suppliers ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS order_item_supplier_order ON public.order_item_suppliers(order_id);

CREATE OR REPLACE FUNCTION public.snapshot_order_item_supplier() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.order_item_suppliers(order_item_id,supplier_id,order_id,store_id,source)
  SELECT NEW.id,supplier_id,NEW.order_id,NEW.store_id,'order_snapshot' FROM (
    SELECT l.supplier_id FROM public.store_supplier_imports l WHERE l.store_id=NEW.store_id AND l.product_id=NEW.product_id
    UNION SELECT sp.supplier_id FROM public.supplier_products sp WHERE
      (NEW.variant_id IS NOT NULL AND sp.variant_id=NEW.variant_id) OR
      (NEW.variant_id IS NULL AND NEW.product_id IS NOT NULL AND sp.product_id=NEW.product_id)
  ) suppliers ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS order_item_supplier_snapshot ON public.order_items;
CREATE TRIGGER order_item_supplier_snapshot AFTER INSERT ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.snapshot_order_item_supplier();

CREATE OR REPLACE FUNCTION public.snapshot_commission_supplier() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.order_item_suppliers(order_item_id,supplier_id,order_id,store_id,source)
  SELECT i.id,NEW.supplier_id,i.order_id,i.store_id,'commission_snapshot' FROM public.order_items i WHERE i.id=NEW.order_item_id AND i.order_id=NEW.order_id ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS commission_supplier_snapshot ON public.supplier_commission_entries;
CREATE TRIGGER commission_supplier_snapshot AFTER INSERT ON public.supplier_commission_entries FOR EACH ROW EXECUTE FUNCTION public.snapshot_commission_supplier();
INSERT INTO public.order_item_suppliers(order_item_id,supplier_id,order_id,store_id,source)
SELECT i.id,c.supplier_id,i.order_id,i.store_id,'commission_history' FROM public.order_items i JOIN public.supplier_commission_entries c ON c.order_item_id=i.id AND c.order_id=i.order_id ON CONFLICT DO NOTHING;
INSERT INTO public.order_item_suppliers(order_item_id,supplier_id,order_id,store_id,source)
SELECT i.id,l.supplier_id,i.order_id,i.store_id,'import_history' FROM public.order_items i JOIN public.store_supplier_imports l ON l.product_id=i.product_id AND l.store_id=i.store_id WHERE NOT EXISTS(SELECT 1 FROM public.order_item_suppliers x WHERE x.order_item_id=i.id) ON CONFLICT DO NOTHING;
INSERT INTO public.order_item_suppliers(order_item_id,supplier_id,order_id,store_id,source)
SELECT i.id,sp.supplier_id,i.order_id,i.store_id,'catalog_history' FROM public.order_items i JOIN public.supplier_products sp ON
  (i.variant_id IS NOT NULL AND sp.variant_id=i.variant_id) OR (i.variant_id IS NULL AND sp.product_id=i.product_id)
WHERE NOT EXISTS(SELECT 1 FROM public.order_item_suppliers x WHERE x.order_item_id=i.id) ON CONFLICT DO NOTHING;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS checkout_policy_version_ids uuid[];
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS checkout_acceptance_meta jsonb;

CREATE OR REPLACE FUNCTION public.record_order_policy_acceptance() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE valid_count integer;
BEGIN
  IF NEW.checkout_policy_version_ids IS NULL THEN RETURN NEW; END IF;
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Checkout kabulü yalnız sunucudan kaydedilir'; END IF;
  IF cardinality(NEW.checkout_policy_version_ids) <> 3 THEN RAISE EXCEPTION 'Üç yayınlanmış politika sürümü gerekli'; END IF;
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
DROP TRIGGER IF EXISTS order_policy_evidence ON public.orders;
CREATE TRIGGER order_policy_evidence AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.record_order_policy_acceptance();

ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS requested_plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS requested_billing_interval text NOT NULL DEFAULT 'monthly' CHECK(requested_billing_interval IN ('monthly','yearly'));

CREATE TABLE IF NOT EXISTS public.platform_post_redirects (
  old_slug text PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES public.platform_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_post_redirects TO anon,authenticated;
GRANT ALL ON public.platform_post_redirects TO service_role;
ALTER TABLE public.platform_post_redirects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS post_redirect_public ON public.platform_post_redirects;
CREATE POLICY post_redirect_public ON public.platform_post_redirects FOR SELECT TO anon,authenticated USING(EXISTS(SELECT 1 FROM public.platform_posts p WHERE p.id=post_id AND p.is_published));
CREATE OR REPLACE FUNCTION public.preserve_platform_post_slug() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF OLD.slug IS DISTINCT FROM NEW.slug THEN
    INSERT INTO public.platform_post_redirects(old_slug,post_id) VALUES(OLD.slug,NEW.id)
    ON CONFLICT(old_slug) DO UPDATE SET post_id=EXCLUDED.post_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS platform_post_slug_history ON public.platform_posts;
CREATE TRIGGER platform_post_slug_history AFTER UPDATE OF slug ON public.platform_posts FOR EACH ROW EXECUTE FUNCTION public.preserve_platform_post_slug();

CREATE INDEX IF NOT EXISTS orders_customer_phone_normalized_idx
  ON public.orders (store_id, (right(regexp_replace(COALESCE(customer_phone, ''), '[^0-9]', '', 'g'), 10)));
CREATE INDEX IF NOT EXISTS orders_customer_email_normalized_idx
  ON public.orders (store_id, (lower(COALESCE(customer_email, ''))));

CREATE OR REPLACE FUNCTION public.customer_page_summaries(p_store_id uuid, p_customer_ids uuid[])
RETURNS TABLE(customer_id uuid, orders_count bigint, total_spent numeric, last_order_at timestamptz, currency text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT c.id, count(o.id),
    COALESCE(sum(o.grand_total) FILTER (WHERE o.payment_status = 'paid' AND o.currency = s.currency), 0),
    max(o.placed_at), COALESCE(s.currency, 'TRY')::text
  FROM public.customers c
  JOIN public.stores s ON s.id = c.store_id
  LEFT JOIN public.orders o ON o.store_id = c.store_id
    AND o.status NOT IN ('cancelled', 'refunded', 'returned')
    AND (
      (length(right(regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g'), 10)) = 10
       AND right(regexp_replace(COALESCE(o.customer_phone, ''), '[^0-9]', '', 'g'), 10) = right(regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g'), 10))
      OR (length(COALESCE(c.email, '')) > 0 AND lower(o.customer_email) = lower(c.email))
    )
  WHERE c.store_id = p_store_id AND c.id = ANY(p_customer_ids)
    AND cardinality(p_customer_ids) <= 50
  GROUP BY c.id, s.currency;
$$;
REVOKE ALL ON FUNCTION public.customer_page_summaries(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_page_summaries(uuid, uuid[]) TO authenticated, service_role;