CREATE TABLE public.ai_engine_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  model_fast TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  model_smart TEXT NOT NULL DEFAULT 'gpt-4o',
  model_image TEXT NOT NULL DEFAULT 'dall-e-3',
  fast_input_usd_per_mtok NUMERIC(12,4) NOT NULL DEFAULT 0.15,
  fast_output_usd_per_mtok NUMERIC(12,4) NOT NULL DEFAULT 0.60,
  smart_input_usd_per_mtok NUMERIC(12,4) NOT NULL DEFAULT 2.50,
  smart_output_usd_per_mtok NUMERIC(12,4) NOT NULL DEFAULT 10.00,
  image_unit_usd NUMERIC(12,4) NOT NULL DEFAULT 0.04,
  credit_cost_text INTEGER NOT NULL DEFAULT 1 CHECK (credit_cost_text >= 0),
  credit_cost_image INTEGER NOT NULL DEFAULT 2 CHECK (credit_cost_image >= 0),
  credit_cost_campaign INTEGER NOT NULL DEFAULT 2 CHECK (credit_cost_campaign >= 0),
  credit_cost_copilot INTEGER NOT NULL DEFAULT 2 CHECK (credit_cost_copilot >= 0),
  free_monthly_credits INTEGER NOT NULL DEFAULT 0 CHECK (free_monthly_credits >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
GRANT SELECT ON public.ai_engine_settings TO authenticated;
GRANT ALL ON public.ai_engine_settings TO service_role;
ALTER TABLE public.ai_engine_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_engine_settings_admin_read" ON public.ai_engine_settings FOR SELECT TO authenticated
USING (app_private.has_role(auth.uid(),'platform_admin'::public.app_role));
INSERT INTO public.ai_engine_settings (id) VALUES (TRUE);

CREATE TABLE public.ai_credit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  credits INTEGER NOT NULL CHECK (credits > 0),
  price NUMERIC(12,2) NOT NULL CHECK (price > 0),
  currency TEXT NOT NULL DEFAULT 'TRY',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_credit_packages TO anon, authenticated;
GRANT ALL ON public.ai_credit_packages TO service_role;
ALTER TABLE public.ai_credit_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_credit_packages_public_read" ON public.ai_credit_packages FOR SELECT TO anon, authenticated
USING (is_active OR app_private.has_role(auth.uid(),'platform_admin'::public.app_role));

INSERT INTO public.ai_credit_packages (code, name, credits, price, currency, description, sort_order) VALUES
  ('starter_ai', 'Başlangıç AI Paketi', 50, 1299.00, 'TRY', 'Küçük mağazalar için 50 yapay zekâ kredisi.', 1),
  ('pro_ai', 'Pro AI Paketi', 100, 2499.00, 'TRY', 'Büyüyen mağazalar için 100 yapay zekâ kredisi.', 2),
  ('enterprise_ai', 'Kurumsal AI Paketi', 250, 5999.00, 'TRY', 'Yoğun kullanım için 250 yapay zekâ kredisi.', 3);

CREATE TABLE public.store_ai_credits (
  store_id UUID PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_purchased INTEGER NOT NULL DEFAULT 0,
  lifetime_used INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.store_ai_credits TO authenticated;
GRANT ALL ON public.store_ai_credits TO service_role;
ALTER TABLE public.store_ai_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store_ai_credits_read" ON public.store_ai_credits FOR SELECT TO authenticated
USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(),'platform_admin'::public.app_role));

CREATE TABLE public.ai_credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reason TEXT NOT NULL,
  task TEXT,
  user_id UUID,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_credit_ledger_store ON public.ai_credit_ledger(store_id, created_at DESC);
GRANT SELECT ON public.ai_credit_ledger TO authenticated;
GRANT ALL ON public.ai_credit_ledger TO service_role;
ALTER TABLE public.ai_credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_credit_ledger_read" ON public.ai_credit_ledger FOR SELECT TO authenticated
USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(),'platform_admin'::public.app_role));

CREATE TABLE public.ai_credit_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.ai_credit_packages(id) ON DELETE SET NULL,
  package_code TEXT NOT NULL,
  credits INTEGER NOT NULL CHECK (credits > 0),
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TRY',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','canceled')),
  transaction_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  fulfilled_at TIMESTAMPTZ
);
CREATE INDEX idx_ai_credit_orders_store ON public.ai_credit_orders(store_id, created_at DESC);
CREATE INDEX idx_ai_credit_orders_tx ON public.ai_credit_orders(transaction_id);
GRANT SELECT ON public.ai_credit_orders TO authenticated;
GRANT ALL ON public.ai_credit_orders TO service_role;
ALTER TABLE public.ai_credit_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_credit_orders_read" ON public.ai_credit_orders FOR SELECT TO authenticated
USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(),'platform_admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.consume_ai_credits(
  _store_id UUID, _credits INTEGER, _reason TEXT, _task TEXT, _user_id UUID
) RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _balance INTEGER;
BEGIN
  IF _credits <= 0 THEN
    SELECT balance INTO _balance FROM public.store_ai_credits WHERE store_id = _store_id;
    RETURN COALESCE(_balance, 0);
  END IF;

  INSERT INTO public.store_ai_credits (store_id) VALUES (_store_id)
  ON CONFLICT (store_id) DO NOTHING;

  UPDATE public.store_ai_credits
     SET balance = balance - _credits,
         lifetime_used = lifetime_used + _credits,
         updated_at = now()
   WHERE store_id = _store_id AND balance >= _credits
  RETURNING balance INTO _balance;

  IF _balance IS NULL THEN
    RAISE EXCEPTION 'INSUFFICIENT_AI_CREDITS';
  END IF;

  INSERT INTO public.ai_credit_ledger (store_id, delta, balance_after, reason, task, user_id)
  VALUES (_store_id, -_credits, _balance, _reason, _task, _user_id);

  RETURN _balance;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_ai_credits(UUID, INTEGER, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_ai_credits(UUID, INTEGER, TEXT, TEXT, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.grant_ai_credits(
  _store_id UUID, _credits INTEGER, _reason TEXT, _user_id UUID, _meta JSONB
) RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _balance INTEGER;
BEGIN
  IF _credits <= 0 THEN RAISE EXCEPTION 'INVALID_CREDIT_AMOUNT'; END IF;

  INSERT INTO public.store_ai_credits (store_id, balance, lifetime_purchased)
  VALUES (_store_id, _credits, _credits)
  ON CONFLICT (store_id) DO UPDATE
    SET balance = public.store_ai_credits.balance + _credits,
        lifetime_purchased = public.store_ai_credits.lifetime_purchased + _credits,
        updated_at = now()
  RETURNING balance INTO _balance;

  INSERT INTO public.ai_credit_ledger (store_id, delta, balance_after, reason, user_id, meta)
  VALUES (_store_id, _credits, _balance, _reason, _user_id, COALESCE(_meta, '{}'::jsonb));

  RETURN _balance;
END;
$$;
REVOKE ALL ON FUNCTION public.grant_ai_credits(UUID, INTEGER, TEXT, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_ai_credits(UUID, INTEGER, TEXT, UUID, JSONB) TO service_role;

ALTER TABLE public.ai_generations
  ADD COLUMN IF NOT EXISTS credits_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0;