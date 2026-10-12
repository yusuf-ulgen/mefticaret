ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS refund_number text,
  ADD COLUMN IF NOT EXISTS refund_method text NOT NULL DEFAULT 'manual' CHECK (refund_method IN ('original_payment','store_credit','manual')),
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS total_tax numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS created_by uuid;
CREATE UNIQUE INDEX IF NOT EXISTS refunds_store_idem_uniq ON public.refunds(store_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS refunds_store_number_uniq ON public.refunds(store_id, refund_number) WHERE refund_number IS NOT NULL;

CREATE TABLE public.refund_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id uuid NOT NULL REFERENCES public.refunds(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  subtotal numeric NOT NULL DEFAULT 0,
  total_tax numeric NOT NULL DEFAULT 0,
  restock boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.refund_line_items TO authenticated;
GRANT ALL ON public.refund_line_items TO service_role;
ALTER TABLE public.refund_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "refund_lines_manager_read" ON public.refund_line_items FOR SELECT TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()));
CREATE INDEX ON public.refund_line_items(refund_id);

CREATE TABLE public.refund_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id uuid NOT NULL REFERENCES public.refunds(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  provider text NOT NULL,
  payment_reference text,
  amount numeric NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed')),
  provider_refund_id text,
  provider_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.refund_transactions TO authenticated;
GRANT ALL ON public.refund_transactions TO service_role;
ALTER TABLE public.refund_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "refund_tx_manager_read" ON public.refund_transactions FOR SELECT TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER refund_transactions_updated_at BEFORE UPDATE ON public.refund_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.customer_store_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'TRY',
  refund_id uuid REFERENCES public.refunds(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.customer_store_credits TO authenticated;
GRANT ALL ON public.customer_store_credits TO service_role;
ALTER TABLE public.customer_store_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store_credit_manager_read" ON public.customer_store_credits FOR SELECT TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "store_credit_customer_read" ON public.customer_store_credits FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.user_id = auth.uid()));
CREATE INDEX ON public.customer_store_credits(store_id, customer_id);

CREATE TABLE public.payment_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  provider_key text NOT NULL CHECK (provider_key IN ('iyzico','paytr','stripe','paypal','bank_transfer','cash_on_delivery')),
  display_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  is_test_mode boolean NOT NULL DEFAULT true,
  credentials_encrypted text,
  credential_hint jsonb NOT NULL DEFAULT '{}'::jsonb,
  supported_currencies jsonb NOT NULL DEFAULT '["TRY"]'::jsonb,
  instructions text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, provider_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_providers TO authenticated;
GRANT ALL ON public.payment_providers TO service_role;
ALTER TABLE public.payment_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_providers_manage" ON public.payment_providers FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER payment_providers_updated_at BEFORE UPDATE ON public.payment_providers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.payment_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_provider_id uuid NOT NULL REFERENCES public.payment_providers(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  min_amount numeric NOT NULL DEFAULT 0 CHECK (min_amount >= 0),
  installment_count integer NOT NULL CHECK (installment_count BETWEEN 1 AND 18),
  extra_rate numeric NOT NULL DEFAULT 0 CHECK (extra_rate >= 0 AND extra_rate <= 100),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_provider_id, installment_count)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_installments TO authenticated;
GRANT ALL ON public.payment_installments TO service_role;
ALTER TABLE public.payment_installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_installments_manage" ON public.payment_installments FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

-- İade oluşturma: kilitli kontrol + idempotency + satırlar.
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
    WHERE order_id = p_order_id AND status IN ('pending','processed');
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
      WHERE l.order_item_id = v_item.id AND r.status IN ('pending','processed') AND r.id <> v_refund_id;
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
REVOKE ALL ON FUNCTION public.create_order_refund(uuid, jsonb, numeric, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_refund(uuid, jsonb, numeric, text, text, text, text) TO authenticated;

-- İade sonuçlandırma: yalnız sunucu (service_role).
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
  IF v_refund.status <> 'pending' THEN RETURN; END IF;
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
REVOKE ALL ON FUNCTION public.finalize_order_refund(uuid, boolean, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_order_refund(uuid, boolean, uuid, text) TO service_role;

-- Bekleyen iadeyi iptal (yönetici).
CREATE OR REPLACE FUNCTION public.cancel_order_refund(p_refund_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_refund public.refunds%ROWTYPE;
BEGIN
  SELECT * INTO v_refund FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND OR NOT app_private.can_manage_store(v_refund.store_id, auth.uid()) THEN RAISE EXCEPTION 'İade bulunamadı'; END IF;
  IF v_refund.status NOT IN ('pending','failed') THEN RAISE EXCEPTION 'Tamamlanmış iade iptal edilemez'; END IF;
  IF EXISTS (SELECT 1 FROM public.refund_transactions WHERE refund_id = p_refund_id AND status = 'succeeded') THEN
    RAISE EXCEPTION 'Sağlayıcıda tamamlanmış iade iptal edilemez';
  END IF;
  UPDATE public.refunds SET status = 'cancelled' WHERE id = p_refund_id;
  INSERT INTO public.order_events(order_id, store_id, kind, message, actor_id, meta)
  VALUES (v_refund.order_id, v_refund.store_id, 'refund_cancelled', COALESCE(v_refund.refund_number,'İade') || ' iptal edildi', auth.uid(), jsonb_build_object('refund_id', p_refund_id));
END $$;
REVOKE ALL ON FUNCTION public.cancel_order_refund(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_order_refund(uuid) TO authenticated;