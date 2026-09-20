-- Yeni nesil genişleme paketi: otomatik yeniden fiyatlama, B2B cari hesap, passkey kasa.

CREATE TABLE IF NOT EXISTS public.repricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Rakip takibi',
  is_active boolean NOT NULL DEFAULT true,
  strategy text NOT NULL DEFAULT 'undercut_percent'
    CHECK (strategy IN ('match', 'undercut_amount', 'undercut_percent', 'premium_percent')),
  value numeric(12,2) NOT NULL DEFAULT 2,
  min_margin_pct numeric(6,2) NOT NULL DEFAULT 10,
  floor_price numeric(14,2),
  ceiling_price numeric(14,2),
  max_change_pct numeric(6,2) NOT NULL DEFAULT 15,
  rounding text NOT NULL DEFAULT 'psych_99',
  auto_apply boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS repricing_rules_store_idx ON public.repricing_rules (store_id, is_active);

CREATE TABLE IF NOT EXISTS public.repricing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES public.repricing_rules(id) ON DELETE SET NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  competitor_id uuid REFERENCES public.competitor_products(id) ON DELETE SET NULL,
  old_price numeric(14,2) NOT NULL,
  suggested_price numeric(14,2) NOT NULL,
  competitor_price numeric(14,2),
  currency text NOT NULL DEFAULT 'TRY',
  reason text NOT NULL DEFAULT '',
  applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS repricing_events_store_idx ON public.repricing_events (store_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.b2b_credit_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  contact_email text NOT NULL DEFAULT '',
  tax_id text NOT NULL DEFAULT '',
  currency text NOT NULL DEFAULT 'TRY',
  credit_limit numeric(14,2) NOT NULL DEFAULT 0,
  balance numeric(14,2) NOT NULL DEFAULT 0,
  term_days integer NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'closed')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS b2b_credit_accounts_store_idx ON public.b2b_credit_accounts (store_id, status);

CREATE TABLE IF NOT EXISTS public.b2b_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.b2b_credit_accounts(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('charge', 'payment', 'adjustment')),
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'TRY',
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  note text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS b2b_credit_transactions_account_idx
  ON public.b2b_credit_transactions (store_id, account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.webauthn_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text NOT NULL DEFAULT '',
  label text NOT NULL DEFAULT 'Passkey',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE INDEX IF NOT EXISTS webauthn_credentials_user_idx ON public.webauthn_credentials (user_id);

CREATE TABLE IF NOT EXISTS public.webauthn_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('register', 'authenticate')),
  challenge text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '5 minutes',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webauthn_challenges_user_idx ON public.webauthn_challenges (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.repricing_rules TO authenticated;
GRANT ALL ON public.repricing_rules TO service_role;
GRANT SELECT ON public.repricing_events TO authenticated;
GRANT ALL ON public.repricing_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.b2b_credit_accounts TO authenticated;
GRANT ALL ON public.b2b_credit_accounts TO service_role;
GRANT SELECT, INSERT ON public.b2b_credit_transactions TO authenticated;
GRANT ALL ON public.b2b_credit_transactions TO service_role;
GRANT SELECT, DELETE ON public.webauthn_credentials TO authenticated;
GRANT ALL ON public.webauthn_credentials TO service_role;
GRANT ALL ON public.webauthn_challenges TO service_role;

ALTER TABLE public.repricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repricing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b2b_credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b2b_credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "repricing_rules_read" ON public.repricing_rules FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "repricing_rules_write" ON public.repricing_rules FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "repricing_events_read" ON public.repricing_events FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "b2b_credit_accounts_read" ON public.b2b_credit_accounts FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "b2b_credit_accounts_write" ON public.b2b_credit_accounts FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "b2b_credit_transactions_read" ON public.b2b_credit_transactions FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "b2b_credit_transactions_write" ON public.b2b_credit_transactions FOR INSERT TO authenticated
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "webauthn_credentials_own_read" ON public.webauthn_credentials FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "webauthn_credentials_own_delete" ON public.webauthn_credentials FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER repricing_rules_tenant_guard
  BEFORE INSERT OR UPDATE ON public.repricing_rules
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs();
CREATE TRIGGER repricing_events_tenant_guard
  BEFORE INSERT OR UPDATE ON public.repricing_events
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs();
CREATE TRIGGER b2b_credit_accounts_tenant_guard
  BEFORE INSERT OR UPDATE ON public.b2b_credit_accounts
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs();
CREATE TRIGGER b2b_credit_transactions_tenant_guard
  BEFORE INSERT OR UPDATE ON public.b2b_credit_transactions
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs();