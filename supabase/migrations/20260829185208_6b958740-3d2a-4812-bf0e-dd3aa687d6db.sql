-- Faz 10: finansal ledger + payouts

CREATE TYPE public.ledger_entry_kind AS ENUM (
  'sale','shipping','discount','platform_fee','payment_fee','refund','payout','adjustment'
);
CREATE TYPE public.ledger_direction AS ENUM ('credit','debit');
CREATE TYPE public.payout_status AS ENUM ('pending','processing','paid','failed');

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS commission_rate numeric NOT NULL DEFAULT 0.02;

UPDATE public.plans SET commission_rate = CASE code
  WHEN 'free' THEN 0.04
  WHEN 'starter' THEN 0.03
  WHEN 'professional' THEN 0.02
  WHEN 'business' THEN 0.015
  WHEN 'enterprise' THEN 0.008
  ELSE commission_rate END;

CREATE TABLE public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  payout_id uuid,
  kind public.ledger_entry_kind NOT NULL,
  direction public.ledger_direction NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'TRY',
  description text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ledger_entries_store_idx ON public.ledger_entries (store_id, occurred_at DESC);
CREATE INDEX ledger_entries_order_idx ON public.ledger_entries (order_id);

CREATE TABLE public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  gross_amount numeric NOT NULL DEFAULT 0,
  fee_amount numeric NOT NULL DEFAULT 0,
  refund_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  status public.payout_status NOT NULL DEFAULT 'pending',
  reference text,
  note text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payouts_store_idx ON public.payouts (store_id, period_start DESC);

ALTER TABLE public.ledger_entries
  ADD CONSTRAINT ledger_entries_payout_fkey FOREIGN KEY (payout_id) REFERENCES public.payouts(id) ON DELETE SET NULL;

GRANT SELECT ON public.ledger_entries TO authenticated;
GRANT ALL ON public.ledger_entries TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.payouts TO authenticated;
GRANT ALL ON public.payouts TO service_role;

ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ledger_select_members" ON public.ledger_entries
  FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));

CREATE POLICY "payouts_select_members" ON public.payouts
  FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));

CREATE POLICY "payouts_insert_managers" ON public.payouts
  FOR INSERT TO authenticated
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "payouts_update_managers" ON public.payouts
  FOR UPDATE TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE TRIGGER payouts_set_updated_at BEFORE UPDATE ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sipariş oluştuğunda finans kayıtlarını otomatik üret
CREATE OR REPLACE FUNCTION public.record_order_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rate numeric := 0.02;
BEGIN
  SELECT COALESCE(p.commission_rate, 0.02) INTO rate
  FROM public.stores s LEFT JOIN public.plans p ON p.id = s.plan_id
  WHERE s.id = NEW.store_id;

  INSERT INTO public.ledger_entries (store_id, order_id, kind, direction, amount, currency, description, occurred_at)
  VALUES (NEW.store_id, NEW.id, 'sale', 'credit', COALESCE(NEW.subtotal,0), NEW.currency,
          'Sipariş ' || NEW.order_number || ' ürün tutarı', NEW.placed_at);

  IF COALESCE(NEW.shipping_total,0) > 0 THEN
    INSERT INTO public.ledger_entries (store_id, order_id, kind, direction, amount, currency, description, occurred_at)
    VALUES (NEW.store_id, NEW.id, 'shipping', 'credit', NEW.shipping_total, NEW.currency,
            'Sipariş ' || NEW.order_number || ' kargo bedeli', NEW.placed_at);
  END IF;

  IF COALESCE(NEW.discount_total,0) > 0 THEN
    INSERT INTO public.ledger_entries (store_id, order_id, kind, direction, amount, currency, description, occurred_at)
    VALUES (NEW.store_id, NEW.id, 'discount', 'debit', NEW.discount_total, NEW.currency,
            'Sipariş ' || NEW.order_number || ' indirim', NEW.placed_at);
  END IF;

  INSERT INTO public.ledger_entries (store_id, order_id, kind, direction, amount, currency, description, occurred_at, meta)
  VALUES (NEW.store_id, NEW.id, 'platform_fee', 'debit', ROUND(COALESCE(NEW.grand_total,0) * rate, 2), NEW.currency,
          'Platform komisyonu', NEW.placed_at, jsonb_build_object('rate', rate));

  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_record_ledger AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.record_order_ledger();

-- Mevcut demo siparişleri için geriye dönük kayıtlar
INSERT INTO public.ledger_entries (store_id, order_id, kind, direction, amount, currency, description, occurred_at)
SELECT o.store_id, o.id, 'sale', 'credit', COALESCE(o.subtotal,0), o.currency,
       'Sipariş ' || o.order_number || ' ürün tutarı', o.placed_at
FROM public.orders o;

INSERT INTO public.ledger_entries (store_id, order_id, kind, direction, amount, currency, description, occurred_at)
SELECT o.store_id, o.id, 'shipping', 'credit', o.shipping_total, o.currency,
       'Sipariş ' || o.order_number || ' kargo bedeli', o.placed_at
FROM public.orders o WHERE COALESCE(o.shipping_total,0) > 0;

INSERT INTO public.ledger_entries (store_id, order_id, kind, direction, amount, currency, description, occurred_at)
SELECT o.store_id, o.id, 'discount', 'debit', o.discount_total, o.currency,
       'Sipariş ' || o.order_number || ' indirim', o.placed_at
FROM public.orders o WHERE COALESCE(o.discount_total,0) > 0;

INSERT INTO public.ledger_entries (store_id, order_id, kind, direction, amount, currency, description, occurred_at, meta)
SELECT o.store_id, o.id, 'platform_fee', 'debit',
       ROUND(COALESCE(o.grand_total,0) * COALESCE(p.commission_rate, 0.02), 2), o.currency,
       'Platform komisyonu', o.placed_at,
       jsonb_build_object('rate', COALESCE(p.commission_rate, 0.02))
FROM public.orders o
JOIN public.stores s ON s.id = o.store_id
LEFT JOIN public.plans p ON p.id = s.plan_id;

-- Örnek ödeme aktarımı (demo mağaza)
INSERT INTO public.payouts (store_id, period_start, period_end, gross_amount, fee_amount, refund_amount, net_amount, currency, status, reference, paid_at)
SELECT s.id,
       (current_date - INTERVAL '30 day')::date,
       (current_date - INTERVAL '16 day')::date,
       COALESCE(SUM(CASE WHEN l.direction = 'credit' THEN l.amount ELSE 0 END), 0),
       COALESCE(SUM(CASE WHEN l.kind IN ('platform_fee','payment_fee') THEN l.amount ELSE 0 END), 0),
       0,
       COALESCE(SUM(CASE WHEN l.direction = 'credit' THEN l.amount ELSE -l.amount END), 0),
       s.currency, 'paid', 'PAYOUT-DEMO-001', now() - INTERVAL '14 day'
FROM public.stores s
LEFT JOIN public.ledger_entries l
  ON l.store_id = s.id
  AND l.occurred_at >= (current_date - INTERVAL '30 day')
  AND l.occurred_at < (current_date - INTERVAL '15 day')
WHERE s.is_demo = true
GROUP BY s.id, s.currency;