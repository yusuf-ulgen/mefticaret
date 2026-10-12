CREATE TABLE public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  code text not null,
  initial_amount numeric(12,2) not null check (initial_amount > 0),
  balance numeric(12,2) not null check (balance >= 0),
  currency text not null default 'TRY',
  status text not null default 'active' check (status in ('active','disabled','depleted')),
  customer_email text,
  note text,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE UNIQUE INDEX gift_cards_store_code_idx ON public.gift_cards(store_id, upper(code));
CREATE INDEX gift_cards_store_created_idx ON public.gift_cards(store_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.gift_cards TO authenticated;
GRANT ALL ON public.gift_cards TO service_role;

ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store members read gift cards" ON public.gift_cards
  FOR SELECT TO authenticated
  USING (app_private.is_store_member(auth.uid(), store_id));

CREATE POLICY "Store managers insert gift cards" ON public.gift_cards
  FOR INSERT TO authenticated
  WITH CHECK (app_private.can_manage_store(auth.uid(), store_id));

CREATE POLICY "Store managers update gift cards" ON public.gift_cards
  FOR UPDATE TO authenticated
  USING (app_private.can_manage_store(auth.uid(), store_id))
  WITH CHECK (app_private.can_manage_store(auth.uid(), store_id));

CREATE TRIGGER gift_cards_set_updated_at
  BEFORE UPDATE ON public.gift_cards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.gift_card_transactions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  gift_card_id uuid not null references public.gift_cards(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  kind text not null check (kind in ('issue','redeem','adjust','refund')),
  amount numeric(12,2) not null,
  balance_after numeric(12,2) not null,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

CREATE INDEX gift_card_tx_card_idx ON public.gift_card_transactions(gift_card_id, created_at DESC);
CREATE INDEX gift_card_tx_store_idx ON public.gift_card_transactions(store_id, created_at DESC);

GRANT SELECT, INSERT ON public.gift_card_transactions TO authenticated;
GRANT ALL ON public.gift_card_transactions TO service_role;

ALTER TABLE public.gift_card_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store members read gift card transactions" ON public.gift_card_transactions
  FOR SELECT TO authenticated
  USING (app_private.is_store_member(auth.uid(), store_id));

CREATE POLICY "Store managers insert gift card transactions" ON public.gift_card_transactions
  FOR INSERT TO authenticated
  WITH CHECK (app_private.can_manage_store(auth.uid(), store_id));