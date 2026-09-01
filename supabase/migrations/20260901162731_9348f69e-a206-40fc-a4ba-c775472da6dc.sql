-- 1) Enums
DO $$ BEGIN
  CREATE TYPE public.ledger_account_kind AS ENUM ('store','seller','platform','customer','payment_provider','gateway');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ledger_entry_status AS ENUM ('pending','posted','cancelled','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE public.ledger_entry_kind ADD VALUE IF NOT EXISTS 'customer_payment';
ALTER TYPE public.ledger_entry_kind ADD VALUE IF NOT EXISTS 'seller_earning';
ALTER TYPE public.ledger_entry_kind ADD VALUE IF NOT EXISTS 'marketplace_commission';
ALTER TYPE public.ledger_entry_kind ADD VALUE IF NOT EXISTS 'withdrawal';
ALTER TYPE public.ledger_entry_kind ADD VALUE IF NOT EXISTS 'wallet_in';
ALTER TYPE public.ledger_entry_kind ADD VALUE IF NOT EXISTS 'wallet_out';

-- 2) Accounts
CREATE TABLE IF NOT EXISTS public.ledger_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  kind public.ledger_account_kind NOT NULL DEFAULT 'store',
  name text NOT NULL,
  code text,
  currency text NOT NULL DEFAULT 'TRY',
  seller_id uuid REFERENCES public.marketplace_sellers(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ledger_accounts_unique_scope
  ON public.ledger_accounts (store_id, kind, currency, COALESCE(seller_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(customer_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT ON public.ledger_accounts TO authenticated;
GRANT ALL ON public.ledger_accounts TO service_role;
ALTER TABLE public.ledger_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ledger_accounts_store_read" ON public.ledger_accounts
  FOR SELECT TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "ledger_accounts_seller_read" ON public.ledger_accounts
  FOR SELECT TO authenticated
  USING (seller_id IN (SELECT s.id FROM public.marketplace_sellers s WHERE s.user_id = auth.uid()));

CREATE TRIGGER ledger_accounts_set_updated_at
  BEFORE UPDATE ON public.ledger_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Ledger entry columns
ALTER TABLE public.ledger_entries
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.ledger_accounts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS counter_account_id uuid REFERENCES public.ledger_accounts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS status public.ledger_entry_status NOT NULL DEFAULT 'posted',
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES public.marketplace_sellers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reverses_entry_id uuid REFERENCES public.ledger_entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ledger_entries_account_idx ON public.ledger_entries (account_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS ledger_entries_store_status_idx ON public.ledger_entries (store_id, status, occurred_at DESC);
CREATE INDEX IF NOT EXISTS ledger_entries_seller_idx ON public.ledger_entries (seller_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS ledger_entries_reference_idx ON public.ledger_entries (store_id, reference);

-- 4) Immutability guards
CREATE OR REPLACE FUNCTION public.ledger_entries_block_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Finans defteri kayıtları silinemez; ters kayıt (reversal) oluşturun';
END; $$;

CREATE OR REPLACE FUNCTION public.ledger_entries_guard_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.direction IS DISTINCT FROM OLD.direction
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.occurred_at IS DISTINCT FROM OLD.occurred_at
     OR NEW.store_id IS DISTINCT FROM OLD.store_id
     OR NEW.order_id IS DISTINCT FROM OLD.order_id
     OR (OLD.account_id IS NOT NULL AND NEW.account_id IS DISTINCT FROM OLD.account_id)
     OR (OLD.counter_account_id IS NOT NULL AND NEW.counter_account_id IS DISTINCT FROM OLD.counter_account_id)
     OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
     OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.reverses_entry_id IS DISTINCT FROM OLD.reverses_entry_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Finans defteri kaydının finansal alanları değiştirilemez';
  END IF;

  IF OLD.status IN ('posted','cancelled','failed') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Kesinleşmiş kaydın durumu değiştirilemez';
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS ledger_entries_no_delete ON public.ledger_entries;
CREATE TRIGGER ledger_entries_no_delete
  BEFORE DELETE ON public.ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.ledger_entries_block_delete();

DROP TRIGGER IF EXISTS ledger_entries_immutable ON public.ledger_entries;
CREATE TRIGGER ledger_entries_immutable
  BEFORE UPDATE ON public.ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.ledger_entries_guard_immutable();

-- 5) Account resolver + balances
CREATE OR REPLACE FUNCTION public.ensure_ledger_account(
  _store_id uuid,
  _kind public.ledger_account_kind,
  _currency text DEFAULT 'TRY',
  _seller_id uuid DEFAULT NULL,
  _customer_id uuid DEFAULT NULL,
  _name text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  found uuid;
BEGIN
  SELECT id INTO found FROM public.ledger_accounts
   WHERE store_id = _store_id
     AND kind = _kind
     AND currency = COALESCE(_currency, 'TRY')
     AND COALESCE(seller_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(_seller_id, '00000000-0000-0000-0000-000000000000'::uuid)
     AND COALESCE(customer_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(_customer_id, '00000000-0000-0000-0000-000000000000'::uuid)
   LIMIT 1;

  IF found IS NOT NULL THEN RETURN found; END IF;

  INSERT INTO public.ledger_accounts (store_id, kind, currency, seller_id, customer_id, name)
  VALUES (_store_id, _kind, COALESCE(_currency,'TRY'), _seller_id, _customer_id,
          COALESCE(_name, CASE _kind
            WHEN 'store' THEN 'Mağaza kasası'
            WHEN 'seller' THEN 'Satıcı hesabı'
            WHEN 'platform' THEN 'Platform hesabı'
            WHEN 'customer' THEN 'Müşteri cüzdanı'
            WHEN 'payment_provider' THEN 'Ödeme sağlayıcı'
            ELSE 'Hesap' END))
  RETURNING id INTO found;

  RETURN found;
END; $$;

CREATE OR REPLACE FUNCTION public.ledger_account_balance(_account_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(CASE WHEN e.direction = 'credit' THEN e.amount ELSE -e.amount END), 0)
    FROM public.ledger_entries e
   WHERE e.account_id = _account_id
     AND e.status = 'posted';
$$;

CREATE OR REPLACE FUNCTION public.ledger_store_balances(_store_id uuid)
RETURNS TABLE (
  account_id uuid,
  account_kind public.ledger_account_kind,
  account_name text,
  currency text,
  seller_id uuid,
  credit numeric,
  debit numeric,
  balance numeric,
  pending numeric
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id,
         a.kind,
         a.name,
         a.currency,
         a.seller_id,
         COALESCE(SUM(CASE WHEN e.status = 'posted' AND e.direction = 'credit' THEN e.amount ELSE 0 END), 0),
         COALESCE(SUM(CASE WHEN e.status = 'posted' AND e.direction = 'debit' THEN e.amount ELSE 0 END), 0),
         COALESCE(SUM(CASE WHEN e.status = 'posted' THEN (CASE WHEN e.direction = 'credit' THEN e.amount ELSE -e.amount END) ELSE 0 END), 0),
         COALESCE(SUM(CASE WHEN e.status = 'pending' THEN (CASE WHEN e.direction = 'credit' THEN e.amount ELSE -e.amount END) ELSE 0 END), 0)
    FROM public.ledger_accounts a
    LEFT JOIN public.ledger_entries e ON e.account_id = a.id
   WHERE a.store_id = _store_id
     AND app_private.can_manage_store(a.store_id, auth.uid())
   GROUP BY a.id, a.kind, a.name, a.currency, a.seller_id
   ORDER BY a.kind, a.name;
$$;

GRANT EXECUTE ON FUNCTION public.ledger_account_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ledger_store_balances(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_ledger_account(uuid, public.ledger_account_kind, text, uuid, uuid, text) TO service_role;

-- 6) Backfill store accounts and attach existing entries
INSERT INTO public.ledger_accounts (store_id, kind, currency, name)
SELECT s.id, 'store', COALESCE(s.currency, 'TRY'), 'Mağaza kasası'
  FROM public.stores s
ON CONFLICT DO NOTHING;

UPDATE public.ledger_entries e
   SET account_id = a.id
  FROM public.ledger_accounts a
 WHERE e.account_id IS NULL
   AND a.store_id = e.store_id
   AND a.kind = 'store';
