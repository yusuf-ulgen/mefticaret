CREATE TABLE IF NOT EXISTS public.qnbpay_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  environment text NOT NULL DEFAULT 'test',
  is_enabled boolean NOT NULL DEFAULT false,
  test_merchant_key text NOT NULL DEFAULT '',
  test_app_id text NOT NULL DEFAULT '',
  live_merchant_key text NOT NULL DEFAULT '',
  live_app_id text NOT NULL DEFAULT '',
  currency_code text NOT NULL DEFAULT 'TRY',
  max_installments integer NOT NULL DEFAULT 12,
  selected_installments integer[] NOT NULL DEFAULT '{}'::integer[],
  is_commission_from_user boolean NOT NULL DEFAULT false,
  transaction_type text NOT NULL DEFAULT 'Auth',
  payment_completed_by text NOT NULL DEFAULT 'app',
  force_3d boolean NOT NULL DEFAULT true,
  sale_webhook_key text,
  refund_webhook_key text,
  return_origin text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qnbpay_environment_chk CHECK (environment IN ('test','live')),
  CONSTRAINT qnbpay_txn_type_chk CHECK (transaction_type IN ('Auth','PreAuth')),
  CONSTRAINT qnbpay_completed_by_chk CHECK (payment_completed_by IN ('app','merchant'))
);

GRANT SELECT ON public.qnbpay_settings TO authenticated;
GRANT ALL ON public.qnbpay_settings TO service_role;
ALTER TABLE public.qnbpay_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform yoneticileri qnbpay ayarlarini okur"
ON public.qnbpay_settings FOR SELECT TO authenticated
USING (app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE TRIGGER set_qnbpay_settings_updated_at
BEFORE UPDATE ON public.qnbpay_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.qnbpay_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  environment text NOT NULL DEFAULT 'test',
  purpose text NOT NULL DEFAULT 'other',
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  charge_item_code text,
  qnbpay_invoice_id text NOT NULL,
  order_id text,
  transaction_id text,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  installment integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  transaction_status text,
  transaction_type text NOT NULL DEFAULT 'Auth',
  payment_status integer,
  md_status integer,
  status_code integer,
  status_description text,
  error_code text,
  error_message text,
  bank_status_code text,
  bank_status_description text,
  credit_card_no text,
  merchant_commission numeric,
  user_commission numeric,
  refunded_amount numeric NOT NULL DEFAULT 0,
  checkout_url text,
  description text,
  request_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  webhook_payload jsonb,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (environment, qnbpay_invoice_id),
  CONSTRAINT qnbpay_txn_env_chk CHECK (environment IN ('test','live')),
  CONSTRAINT qnbpay_txn_purpose_chk CHECK (purpose IN ('plan','theme','app','commission','invoice','other')),
  CONSTRAINT qnbpay_txn_status_chk CHECK (status IN ('pending','preauth','completed','failed','cancelled','refunded','partial_refunded'))
);

CREATE INDEX IF NOT EXISTS qnbpay_transactions_created_idx ON public.qnbpay_transactions (created_at DESC);
GRANT SELECT ON public.qnbpay_transactions TO authenticated;
GRANT ALL ON public.qnbpay_transactions TO service_role;
ALTER TABLE public.qnbpay_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform yoneticileri qnbpay islemlerini okur"
ON public.qnbpay_transactions FOR SELECT TO authenticated
USING (app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE TRIGGER set_qnbpay_transactions_updated_at
BEFORE UPDATE ON public.qnbpay_transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.qnbpay_refunds (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id uuid NOT NULL REFERENCES public.qnbpay_transactions(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  ref_no text,
  status_code integer,
  status_description text,
  response_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  webhook_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qnbpay_refund_status_chk CHECK (status IN ('pending','completed','failed'))
);

GRANT SELECT ON public.qnbpay_refunds TO authenticated;
GRANT ALL ON public.qnbpay_refunds TO service_role;
ALTER TABLE public.qnbpay_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform yoneticileri qnbpay iadelerini okur"
ON public.qnbpay_refunds FOR SELECT TO authenticated
USING (app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE TRIGGER set_qnbpay_refunds_updated_at
BEFORE UPDATE ON public.qnbpay_refunds FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.platform_charge_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind text NOT NULL DEFAULT 'theme',
  code text NOT NULL,
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  commission_rate numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, code),
  CONSTRAINT platform_charge_kind_chk CHECK (kind IN ('theme','service','commission','other'))
);

GRANT SELECT ON public.platform_charge_items TO authenticated;
GRANT ALL ON public.platform_charge_items TO service_role;
ALTER TABLE public.platform_charge_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform yoneticileri fiyat kalemlerini okur"
ON public.platform_charge_items FOR SELECT TO authenticated
USING (app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE TRIGGER set_platform_charge_items_updated_at
BEFORE UPDATE ON public.platform_charge_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.qnbpay_settings (environment, is_enabled, test_merchant_key, test_app_id, currency_code)
SELECT 'test', false, '$2y$10$N9IJkgazXMUwCzpn7NJrZePy3v.dIFOQUyW4yGfT3eWry6m.KxanK', '07fb70f9d8de575f32baa6518e38c5d6', 'TRY'
WHERE NOT EXISTS (SELECT 1 FROM public.qnbpay_settings);