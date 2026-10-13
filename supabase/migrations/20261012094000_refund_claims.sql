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
  p_reason text, p_note text, p_idempotency_key text
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
  IF NOT app_private.can_manage_store(v_order.store_id, auth.uid()) THEN RAISE EXCEPTION 'Yetkiniz yok'; END IF;
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
          'REF-' || lpad(v_next::text, 4, '0'), p_idempotency_key, auth.uid())
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
  VALUES (p_order_id, v_order.store_id, 'refund_created', 'İade oluşturuldu', auth.uid(),
          jsonb_build_object('refund_id', v_refund_id, 'amount', p_amount, 'method', p_method, 'reason', p_reason));
  RETURN v_refund_id;
END $$;

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

CREATE OR REPLACE FUNCTION public.finalize_order_refund(p_refund_id uuid, p_success boolean, p_actor uuid, p_message text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_refund public.refunds%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_total numeric;
  l record;
BEGIN
  SELECT * INTO v_refund FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'İade bulunamadı'; END IF;
  IF v_refund.status NOT IN ('pending','processing') THEN RETURN; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = v_refund.order_id FOR UPDATE;

  IF NOT p_success THEN
    UPDATE public.refunds SET status = 'failed', processed_by = p_actor WHERE id = p_refund_id;
    INSERT INTO public.order_events(order_id, store_id, kind, message, actor_id, meta)
    VALUES (v_order.id, v_order.store_id, 'refund_failed', COALESCE(p_message,'İade başarısız'), p_actor, jsonb_build_object('refund_id', p_refund_id));
    RETURN;
  END IF;

  UPDATE public.refunds SET status = 'processed', processed_at = now(), processed_by = p_actor WHERE id = p_refund_id;

  FOR l IN SELECT li.quantity, oi.variant_id FROM public.refund_line_items li
           JOIN public.order_items oi ON oi.id = li.order_item_id
           WHERE li.refund_id = p_refund_id AND li.restock AND oi.variant_id IS NOT NULL LOOP
    UPDATE public.product_variants SET stock = stock + l.quantity WHERE id = l.variant_id;
  END LOOP;

  IF v_refund.refund_method = 'store_credit' AND v_order.customer_id IS NOT NULL THEN
    INSERT INTO public.customer_store_credits(store_id, customer_id, amount, currency, refund_id, order_id, note)
    VALUES (v_order.store_id, v_order.customer_id, v_refund.amount, v_refund.currency, p_refund_id, v_order.id, v_refund.refund_number || ' iadesi');
  END IF;

  SELECT COALESCE(sum(amount),0) INTO v_total FROM public.refunds WHERE order_id = v_order.id AND status = 'processed';
  UPDATE public.orders SET payment_status = CASE WHEN v_total >= v_order.grand_total - 0.001 THEN 'refunded'::payment_status ELSE 'partially_refunded'::payment_status END
    WHERE id = v_order.id;

  INSERT INTO public.order_events(order_id, store_id, kind, message, actor_id, meta)
  VALUES (v_order.id, v_order.store_id, 'refund_processed', v_refund.refund_number || ' iadesi tamamlandı', p_actor,
          jsonb_build_object('refund_id', p_refund_id, 'amount', v_refund.amount, 'method', v_refund.refund_method));
END $$;

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
