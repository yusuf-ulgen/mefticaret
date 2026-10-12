-- ENUMS
DO $$ BEGIN CREATE TYPE public.subscription_status AS ENUM ('trialing','active','past_due','canceled','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.billing_interval AS ENUM ('monthly','yearly'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.subscription_item_kind AS ENUM ('plan','addon','usage'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.billing_cycle_status AS ENUM ('open','closed','invoiced'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.invoice_status AS ENUM ('draft','open','paid','void','uncollectible'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- PLAN FEATURES (limits, DB-driven)
CREATE TABLE public.plan_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  label text NOT NULL,
  unit text,
  limit_value bigint,
  is_enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, metric_key)
);
GRANT SELECT ON public.plan_features TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_features TO authenticated;
GRANT ALL ON public.plan_features TO service_role;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_features_public_read" ON public.plan_features FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "plan_features_admin_write" ON public.plan_features FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin')) WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER plan_features_set_updated_at BEFORE UPDATE ON public.plan_features FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SUBSCRIPTIONS
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  status public.subscription_status NOT NULL DEFAULT 'trialing',
  billing_interval public.billing_interval NOT NULL DEFAULT 'monthly',
  currency text NOT NULL DEFAULT 'TRY',
  amount numeric NOT NULL DEFAULT 0,
  trial_ends_at timestamptz,
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL DEFAULT (now() + interval '1 month'),
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscriptions_select" ON public.subscriptions FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "subscriptions_manage" ON public.subscriptions FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER subscriptions_set_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SUBSCRIPTION ITEMS
CREATE TABLE public.subscription_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  kind public.subscription_item_kind NOT NULL DEFAULT 'plan',
  metric_key text,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_items TO authenticated;
GRANT ALL ON public.subscription_items TO service_role;
ALTER TABLE public.subscription_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscription_items_select" ON public.subscription_items FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "subscription_items_manage" ON public.subscription_items FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER subscription_items_set_updated_at BEFORE UPDATE ON public.subscription_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- USAGE RECORDS
CREATE TABLE public.usage_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  metric_key text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  period_start date NOT NULL DEFAULT date_trunc('month', now())::date,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX usage_records_store_metric_idx ON public.usage_records (store_id, metric_key, period_start);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usage_records TO authenticated;
GRANT ALL ON public.usage_records TO service_role;
ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_records_select" ON public.usage_records FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "usage_records_manage" ON public.usage_records FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

-- BILLING CYCLES
CREATE TABLE public.billing_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  status public.billing_cycle_status NOT NULL DEFAULT 'open',
  amount_due numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_cycles TO authenticated;
GRANT ALL ON public.billing_cycles TO service_role;
ALTER TABLE public.billing_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_cycles_select" ON public.billing_cycles FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "billing_cycles_manage" ON public.billing_cycles FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER billing_cycles_set_updated_at BEFORE UPDATE ON public.billing_cycles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- INVOICES
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  billing_cycle_id uuid REFERENCES public.billing_cycles(id) ON DELETE SET NULL,
  invoice_number text NOT NULL UNIQUE,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  subtotal numeric NOT NULL DEFAULT 0,
  tax_total numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  issued_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices_select" ON public.invoices FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "invoices_manage" ON public.invoices FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER invoices_set_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- DEFAULT PLANS (idempotent)
INSERT INTO public.plans (code, name, description, price_monthly, price_yearly, currency, commission_rate, trial_days, is_active, sort_order)
VALUES
  ('free','Ücretsiz','Mağazanı ücretsiz kur ve test et.',0,0,'TRY',0.05,14,true,1),
  ('starter','Başlangıç','Küçük ölçekli mağazalar için temel paket.',499,4990,'TRY',0.03,14,true,2),
  ('professional','Profesyonel','Büyüyen mağazalar için gelişmiş araçlar.',1299,12990,'TRY',0.02,14,true,3),
  ('business','Business','Yüksek hacimli operasyonlar için.',2999,29990,'TRY',0.015,14,true,4),
  ('enterprise','Enterprise','Kurumsal ölçek, sınırsız kullanım.',9999,99990,'TRY',0.01,30,true,5)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, is_active = true;

-- DEFAULT PLAN FEATURES (limit_value NULL = sınırsız)
INSERT INTO public.plan_features (plan_id, metric_key, label, unit, limit_value, sort_order)
SELECT p.id, m.metric_key, m.label, m.unit,
  CASE p.code
    WHEN 'free' THEN m.free
    WHEN 'starter' THEN m.starter
    WHEN 'professional' THEN m.professional
    WHEN 'business' THEN m.business
    ELSE m.enterprise
  END,
  m.sort_order
FROM public.plans p
CROSS JOIN (VALUES
  ('products','Ürün','adet',50::bigint,1000::bigint,10000::bigint,100000::bigint,NULL::bigint,1),
  ('orders','Sipariş','adet/ay',50,1000,10000,100000,NULL,2),
  ('staff','Personel','kişi',1,3,10,25,NULL,3),
  ('storage','Depolama','MB',500,5000,25000,100000,NULL,4),
  ('domains','Domain','adet',0,1,3,10,NULL,5),
  ('themes','Tema','adet',1,3,10,25,NULL,6),
  ('apps','Uygulama','adet',1,5,15,50,NULL,7),
  ('api_requests','API','istek/ay',0,10000,100000,1000000,NULL,8),
  ('ai_credits','AI kullanımı','kredi/ay',20,200,2000,10000,NULL,9),
  ('emails','E-posta','adet/ay',100,2000,20000,100000,NULL,10),
  ('sms','SMS','adet/ay',0,100,1000,10000,NULL,11),
  ('monthly_sales','Aylık satış','TRY/ay',25000,250000,2500000,25000000,NULL,12)
) AS m(metric_key,label,unit,free,starter,professional,business,enterprise,sort_order)
WHERE p.code IN ('free','starter','professional','business','enterprise')
ON CONFLICT (plan_id, metric_key) DO NOTHING;

-- MEVCUT MAĞAZALAR İÇİN ABONELİK
INSERT INTO public.subscriptions (store_id, plan_id, status, billing_interval, currency, amount, trial_ends_at, current_period_start, current_period_end)
SELECT s.id,
       COALESCE(s.plan_id, (SELECT id FROM public.plans WHERE code = 'free')),
       'trialing'::public.subscription_status,
       'monthly'::public.billing_interval,
       s.currency,
       COALESCE((SELECT price_monthly FROM public.plans pl WHERE pl.id = s.plan_id), 0),
       now() + interval '14 days',
       date_trunc('month', now()),
       date_trunc('month', now()) + interval '1 month'
FROM public.stores s
ON CONFLICT (store_id) DO NOTHING;