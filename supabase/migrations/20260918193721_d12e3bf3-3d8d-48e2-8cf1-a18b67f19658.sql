ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS accepts_sms boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepts_whatsapp boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.loyalty_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  points_balance integer NOT NULL DEFAULT 0,
  lifetime_points integer NOT NULL DEFAULT 0,
  tier text NOT NULL DEFAULT 'classic',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, customer_id)
);

CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'earn',
  points integer NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT loyalty_transactions_kind_check CHECK (kind IN ('earn','redeem','adjust','expire'))
);

CREATE INDEX IF NOT EXISTS loyalty_tx_customer_idx ON public.loyalty_transactions (customer_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_tx_order_earn_idx ON public.loyalty_transactions (order_id) WHERE kind = 'earn' AND order_id IS NOT NULL;

GRANT SELECT ON public.loyalty_accounts TO authenticated;
GRANT ALL ON public.loyalty_accounts TO service_role;
GRANT SELECT ON public.loyalty_transactions TO authenticated;
GRANT ALL ON public.loyalty_transactions TO service_role;

ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY loyalty_accounts_read ON public.loyalty_accounts
  FOR SELECT TO authenticated
  USING (
    app_private.can_manage_store(store_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.customers c WHERE c.id = loyalty_accounts.customer_id AND c.user_id = auth.uid())
  );

CREATE POLICY loyalty_tx_read ON public.loyalty_transactions
  FOR SELECT TO authenticated
  USING (
    app_private.can_manage_store(store_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.customers c WHERE c.id = loyalty_transactions.customer_id AND c.user_id = auth.uid())
  );

CREATE TRIGGER loyalty_accounts_tenant_refs
  BEFORE INSERT OR UPDATE ON public.loyalty_accounts
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs();

CREATE TRIGGER loyalty_transactions_tenant_refs
  BEFORE INSERT OR UPDATE ON public.loyalty_transactions
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs();

CREATE OR REPLACE FUNCTION public.loyalty_tier_for(_points integer)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN _points >= 5000 THEN 'vip' WHEN _points >= 1000 THEN 'gold' ELSE 'classic' END
$$;

CREATE OR REPLACE FUNCTION public.award_loyalty_points_on_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _points integer;
BEGIN
  IF NEW.customer_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.payment_status <> 'paid' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.payment_status = 'paid' THEN RETURN NEW; END IF;

  _points := floor(COALESCE(NEW.grand_total, 0) / 10)::integer;
  IF _points <= 0 THEN RETURN NEW; END IF;

  INSERT INTO public.loyalty_transactions (store_id, customer_id, order_id, kind, points, description)
  VALUES (NEW.store_id, NEW.customer_id, NEW.id, 'earn', _points, 'Sipariş ' || NEW.order_number)
  ON CONFLICT (order_id) WHERE kind = 'earn' AND order_id IS NOT NULL DO NOTHING;

  IF NOT FOUND THEN RETURN NEW; END IF;

  INSERT INTO public.loyalty_accounts (store_id, customer_id, points_balance, lifetime_points, tier)
  VALUES (NEW.store_id, NEW.customer_id, _points, _points, public.loyalty_tier_for(_points))
  ON CONFLICT (store_id, customer_id) DO UPDATE
    SET points_balance = public.loyalty_accounts.points_balance + EXCLUDED.points_balance,
        lifetime_points = public.loyalty_accounts.lifetime_points + EXCLUDED.lifetime_points,
        tier = public.loyalty_tier_for(public.loyalty_accounts.lifetime_points + EXCLUDED.lifetime_points),
        updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_award_loyalty ON public.orders;
CREATE TRIGGER orders_award_loyalty
  AFTER INSERT OR UPDATE OF payment_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.award_loyalty_points_on_paid();