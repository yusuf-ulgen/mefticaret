CREATE TABLE public.product_subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  name text NOT NULL,
  interval_days integer NOT NULL DEFAULT 30 CHECK (interval_days BETWEEN 1 AND 365),
  discount_percent numeric NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 90),
  min_cycles integer NOT NULL DEFAULT 1 CHECK (min_cycles >= 1),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_subscription_plans TO authenticated;
GRANT ALL ON public.product_subscription_plans TO service_role;
ALTER TABLE public.product_subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "psp_member_read" ON public.product_subscription_plans FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "psp_manage" ON public.product_subscription_plans FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER psp_set_updated_at BEFORE UPDATE ON public.product_subscription_plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER psp_tenant_guard BEFORE INSERT OR UPDATE ON public.product_subscription_plans FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs();

CREATE TABLE public.customer_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.product_subscription_plans(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','canceled')),
  next_order_at timestamptz NOT NULL DEFAULT now(),
  last_order_at timestamptz,
  cycles_completed integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_subscriptions TO authenticated;
GRANT ALL ON public.customer_subscriptions TO service_role;
ALTER TABLE public.customer_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs_member_read" ON public.customer_subscriptions FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "cs_manage" ON public.customer_subscriptions FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER cs_set_updated_at BEFORE UPDATE ON public.customer_subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER cs_tenant_guard BEFORE INSERT OR UPDATE ON public.customer_subscriptions FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs();

CREATE TABLE public.customer_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  balance numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, customer_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_wallets TO authenticated;
GRANT ALL ON public.customer_wallets TO service_role;
ALTER TABLE public.customer_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cw_member_read" ON public.customer_wallets FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "cw_manage" ON public.customer_wallets FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER cw_set_updated_at BEFORE UPDATE ON public.customer_wallets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER cw_tenant_guard BEFORE INSERT OR UPDATE ON public.customer_wallets FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs();

CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  wallet_id uuid NOT NULL REFERENCES public.customer_wallets(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('topup','spend','refund','adjustment')),
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'TRY',
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wt_member_read" ON public.wallet_transactions FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "wt_manage" ON public.wallet_transactions FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER wt_tenant_guard BEFORE INSERT OR UPDATE ON public.wallet_transactions FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs();

CREATE INDEX product_subscription_plans_store_idx ON public.product_subscription_plans (store_id);
CREATE INDEX customer_subscriptions_store_next_idx ON public.customer_subscriptions (store_id, next_order_at);
CREATE INDEX wallet_transactions_wallet_idx ON public.wallet_transactions (wallet_id, created_at DESC);