-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('platform_admin','agency','seller','customer');
CREATE TYPE public.store_role AS ENUM ('owner','admin','staff','marketing','support');
CREATE TYPE public.store_status AS ENUM ('draft','active','suspended','archived');
CREATE TYPE public.domain_type AS ENUM ('subdomain','custom');
CREATE TYPE public.domain_status AS ENUM ('pending','verifying','verified','failed');

-- ============ UTIL ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  locale TEXT NOT NULL DEFAULT 'tr',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ USER ROLES (platform level) ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'platform_admin'));

-- ============ PLANS ============
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price_monthly NUMERIC(12,2) NOT NULL DEFAULT 0,
  price_yearly NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'TRY',
  trial_days INT NOT NULL DEFAULT 0,
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_public_read" ON public.plans FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY "plans_admin_write" ON public.plans FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'platform_admin')) WITH CHECK (public.has_role(auth.uid(),'platform_admin'));
CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ STORES ============
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  industry TEXT,
  logo_url TEXT,
  currency TEXT NOT NULL DEFAULT 'TRY',
  locale TEXT NOT NULL DEFAULT 'tr',
  timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
  status public.store_status NOT NULL DEFAULT 'draft',
  plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  onboarding_step INT NOT NULL DEFAULT 1,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stores_owner ON public.stores(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT SELECT ON public.stores TO anon;
GRANT ALL ON public.stores TO service_role;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- ============ STORE USERS ============
CREATE TABLE public.store_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.store_role NOT NULL DEFAULT 'staff',
  permissions TEXT[] NOT NULL DEFAULT '{}',
  invited_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, user_id)
);
CREATE INDEX idx_store_users_user ON public.store_users(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_users TO authenticated;
GRANT ALL ON public.store_users TO service_role;
ALTER TABLE public.store_users ENABLE ROW LEVEL SECURITY;

-- tenant helpers (security definer -> no RLS recursion)
CREATE OR REPLACE FUNCTION public.is_store_member(_store_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.stores s WHERE s.id = _store_id AND s.owner_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.store_users su WHERE su.store_id = _store_id AND su.user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.has_store_role(_store_id UUID, _user_id UUID, _roles public.store_role[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.stores s WHERE s.id = _store_id AND s.owner_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.store_users su WHERE su.store_id = _store_id AND su.user_id = _user_id AND su.role = ANY(_roles));
$$;

CREATE OR REPLACE FUNCTION public.can_manage_store(_store_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_store_role(_store_id, _user_id, ARRAY['owner','admin']::public.store_role[])
      OR public.has_role(_user_id, 'platform_admin');
$$;

CREATE POLICY "stores_select_members" ON public.stores FOR SELECT TO anon, authenticated
USING (is_demo OR public.is_store_member(id, auth.uid()) OR public.has_role(auth.uid(),'platform_admin'));
CREATE POLICY "stores_insert_own" ON public.stores FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid() AND is_demo = false);
CREATE POLICY "stores_update_managers" ON public.stores FOR UPDATE TO authenticated
USING (public.can_manage_store(id, auth.uid())) WITH CHECK (public.can_manage_store(id, auth.uid()));
CREATE POLICY "stores_delete_owner" ON public.stores FOR DELETE TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'platform_admin'));
CREATE TRIGGER trg_stores_updated BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "store_users_select_members" ON public.store_users FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_store_member(store_id, auth.uid()) OR public.has_role(auth.uid(),'platform_admin'));
CREATE POLICY "store_users_manage" ON public.store_users FOR ALL TO authenticated
USING (public.can_manage_store(store_id, auth.uid())) WITH CHECK (public.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER trg_store_users_updated BEFORE UPDATE ON public.store_users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ STORE DOMAINS ============
CREATE TABLE public.store_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL UNIQUE,
  type public.domain_type NOT NULL DEFAULT 'custom',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  status public.domain_status NOT NULL DEFAULT 'pending',
  ssl_active BOOLEAN NOT NULL DEFAULT false,
  verification_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(12),'hex'),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_store_domains_store ON public.store_domains(store_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_domains TO authenticated;
GRANT ALL ON public.store_domains TO service_role;
ALTER TABLE public.store_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store_domains_select" ON public.store_domains FOR SELECT TO authenticated
USING (public.is_store_member(store_id, auth.uid()) OR public.has_role(auth.uid(),'platform_admin'));
CREATE POLICY "store_domains_manage" ON public.store_domains FOR ALL TO authenticated
USING (public.can_manage_store(store_id, auth.uid())) WITH CHECK (public.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER trg_store_domains_updated BEFORE UPDATE ON public.store_domains FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ STORE SETTINGS ============
CREATE TABLE public.store_settings (
  store_id UUID PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  contact_email TEXT,
  contact_phone TEXT,
  address JSONB NOT NULL DEFAULT '{}'::jsonb,
  legal_name TEXT,
  tax_number TEXT,
  tax_included_prices BOOLEAN NOT NULL DEFAULT true,
  default_tax_rate NUMERIC(5,2) NOT NULL DEFAULT 20,
  guest_checkout BOOLEAN NOT NULL DEFAULT true,
  weight_unit TEXT NOT NULL DEFAULT 'kg',
  seo JSONB NOT NULL DEFAULT '{}'::jsonb,
  social JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_settings TO authenticated;
GRANT ALL ON public.store_settings TO service_role;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store_settings_select" ON public.store_settings FOR SELECT TO authenticated
USING (public.is_store_member(store_id, auth.uid()) OR public.has_role(auth.uid(),'platform_admin'));
CREATE POLICY "store_settings_manage" ON public.store_settings FOR ALL TO authenticated
USING (public.can_manage_store(store_id, auth.uid())) WITH CHECK (public.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER trg_store_settings_updated BEFORE UPDATE ON public.store_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ DAILY STATS ============
CREATE TABLE public.store_daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  stat_date DATE NOT NULL,
  revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
  orders_count INT NOT NULL DEFAULT 0,
  visitors INT NOT NULL DEFAULT 0,
  sessions INT NOT NULL DEFAULT 0,
  new_customers INT NOT NULL DEFAULT 0,
  abandoned_carts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, stat_date)
);
CREATE INDEX idx_stats_store_date ON public.store_daily_stats(store_id, stat_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_daily_stats TO authenticated;
GRANT SELECT ON public.store_daily_stats TO anon;
GRANT ALL ON public.store_daily_stats TO service_role;
ALTER TABLE public.store_daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stats_select" ON public.store_daily_stats FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.is_demo)
   OR public.is_store_member(store_id, auth.uid())
   OR public.has_role(auth.uid(),'platform_admin'));
CREATE POLICY "stats_manage" ON public.store_daily_stats FOR ALL TO authenticated
USING (public.can_manage_store(store_id, auth.uid())) WITH CHECK (public.can_manage_store(store_id, auth.uid()));

-- ============ AUDIT LOGS ============
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  old_value JSONB,
  new_value JSONB,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_store ON public.audit_logs(store_id, created_at DESC);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select" ON public.audit_logs FOR SELECT TO authenticated
USING ((store_id IS NOT NULL AND public.is_store_member(store_id, auth.uid())) OR actor_id = auth.uid() OR public.has_role(auth.uid(),'platform_admin'));
CREATE POLICY "audit_insert_self" ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid() AND (store_id IS NULL OR public.is_store_member(store_id, auth.uid())));

-- ============ DEMO DATA ============
INSERT INTO public.plans (code,name,description,price_monthly,price_yearly,trial_days,limits,features,sort_order) VALUES
('free','Ücretsiz','Fikrini denemeye başla',0,0,0,'{"products":25,"orders":50,"staff":1,"domains":0,"storage_mb":500,"ai_credits":50,"apps":2}','["1 mağaza","Temel tema","Mefshop alt alan adı"]',1),
('starter','Başlangıç','Küçük işletmeler için',499,4990,14,'{"products":500,"orders":1000,"staff":2,"domains":1,"storage_mb":5000,"ai_credits":500,"apps":10}','["Özel domain","Kupon sistemi","Temel analitik"]',2),
('professional','Profesyonel','Büyüyen markalar için',1299,12990,14,'{"products":10000,"orders":20000,"staff":5,"domains":3,"storage_mb":50000,"ai_credits":5000,"apps":50}','["Pazaryeri entegrasyonları","AI asistan","Otomasyon","API erişimi"]',3),
('business','Business','Yüksek hacimli satış',3499,34990,14,'{"products":100000,"orders":200000,"staff":15,"domains":10,"storage_mb":250000,"ai_credits":25000,"apps":200}','["Çoklu depo","Gelişmiş raporlar","Webhook","Öncelikli destek"]',4),
('enterprise','Enterprise','Kurumsal ölçek',0,0,30,'{"products":-1,"orders":-1,"staff":-1,"domains":-1,"storage_mb":-1,"ai_credits":-1,"apps":-1}','["Sınırsız limitler","SLA","Özel entegrasyon","Hesap yöneticisi"]',5);

INSERT INTO public.stores (id,name,slug,industry,currency,status,onboarding_step,onboarding_completed,is_demo,published_at,plan_id)
VALUES ('11111111-1111-1111-1111-111111111111','Demo Mağaza — Atlas Moda','atlas-moda','moda','TRY','active',10,true,true,now(),(SELECT id FROM public.plans WHERE code='professional'));

INSERT INTO public.store_domains (store_id,hostname,type,is_primary,status,ssl_active,verified_at) VALUES
('11111111-1111-1111-1111-111111111111','atlas-moda.mefshop.com','subdomain',true,'verified',true,now()),
('11111111-1111-1111-1111-111111111111','www.atlasmoda.com','custom',false,'pending',false,NULL);

INSERT INTO public.store_settings (store_id,contact_email,contact_phone,legal_name,tax_number)
VALUES ('11111111-1111-1111-1111-111111111111','destek@atlasmoda.com','+90 212 000 00 00','Atlas Moda Tekstil A.Ş.','1234567890');

INSERT INTO public.store_daily_stats (store_id, stat_date, revenue, orders_count, visitors, sessions, new_customers, abandoned_carts)
SELECT '11111111-1111-1111-1111-111111111111',
       d::date,
       round((14000 + random()*22000 + (90 - (CURRENT_DATE - d::date)) * 120)::numeric, 2),
       (18 + floor(random()*40))::int,
       (600 + floor(random()*1400))::int,
       (800 + floor(random()*1800))::int,
       (4 + floor(random()*22))::int,
       (5 + floor(random()*30))::int
FROM generate_series(CURRENT_DATE - INTERVAL '89 days', CURRENT_DATE, INTERVAL '1 day') AS d;