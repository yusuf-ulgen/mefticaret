CREATE TABLE public.email_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  sector text,
  campaign_tag text,
  subject text NOT NULL DEFAULT '',
  preview_text text NOT NULL DEFAULT '',
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  accent_color text NOT NULL DEFAULT '#111111',
  source_template text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_designs_store_idx ON public.email_designs (store_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_designs TO authenticated;
GRANT ALL ON public.email_designs TO service_role;
ALTER TABLE public.email_designs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_designs_manage" ON public.email_designs FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "email_designs_select" ON public.email_designs FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER email_designs_set_updated_at BEFORE UPDATE ON public.email_designs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  design_id uuid REFERENCES public.email_designs(id) ON DELETE SET NULL,
  subject text NOT NULL DEFAULT '',
  preview_text text NOT NULL DEFAULT '',
  audience jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sending','sent','failed')),
  ab_enabled boolean NOT NULL DEFAULT false,
  scheduled_at timestamptz,
  sent_at timestamptz,
  recipients_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_campaigns_store_idx ON public.email_campaigns (store_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_campaigns TO authenticated;
GRANT ALL ON public.email_campaigns TO service_role;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_campaigns_manage" ON public.email_campaigns FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "email_campaigns_select" ON public.email_campaigns FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER email_campaigns_set_updated_at BEFORE UPDATE ON public.email_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER email_campaigns_tenant_guard BEFORE INSERT OR UPDATE ON public.email_campaigns
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs();

CREATE TABLE public.email_campaign_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'A',
  subject text NOT NULL DEFAULT '',
  preview_text text NOT NULL DEFAULT '',
  design_id uuid REFERENCES public.email_designs(id) ON DELETE SET NULL,
  weight integer NOT NULL DEFAULT 50,
  sent_count integer NOT NULL DEFAULT 0,
  open_count integer NOT NULL DEFAULT 0,
  click_count integer NOT NULL DEFAULT 0,
  unsubscribe_count integer NOT NULL DEFAULT 0,
  revenue numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_campaign_variants_campaign_idx ON public.email_campaign_variants (campaign_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_campaign_variants TO authenticated;
GRANT ALL ON public.email_campaign_variants TO service_role;
ALTER TABLE public.email_campaign_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_variants_manage" ON public.email_campaign_variants FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "email_variants_select" ON public.email_campaign_variants FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER email_variants_set_updated_at BEFORE UPDATE ON public.email_campaign_variants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER email_variants_tenant_guard BEFORE INSERT OR UPDATE ON public.email_campaign_variants
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs();

CREATE TABLE public.email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.email_campaign_variants(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  recipient text NOT NULL,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','suppressed')),
  error text,
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  unsubscribed_at timestamptz,
  revenue numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_sends_campaign_idx ON public.email_sends (campaign_id, created_at DESC);
CREATE INDEX email_sends_store_idx ON public.email_sends (store_id, created_at DESC);
GRANT SELECT ON public.email_sends TO authenticated;
GRANT ALL ON public.email_sends TO service_role;
ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_sends_select" ON public.email_sends FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE TABLE public.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  send_id uuid REFERENCES public.email_sends(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('open','click','unsubscribe','bounce')),
  url text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_events_campaign_idx ON public.email_events (campaign_id, created_at DESC);
GRANT SELECT ON public.email_events TO authenticated;
GRANT ALL ON public.email_events TO service_role;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_events_select" ON public.email_events FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE TABLE public.email_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  source text NOT NULL DEFAULT 'storefront',
  status text NOT NULL DEFAULT 'subscribed' CHECK (status IN ('subscribed','unsubscribed')),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, email)
);
CREATE INDEX email_subscribers_store_idx ON public.email_subscribers (store_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_subscribers TO authenticated;
GRANT INSERT ON public.email_subscribers TO anon;
GRANT ALL ON public.email_subscribers TO service_role;
ALTER TABLE public.email_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_subscribers_manage" ON public.email_subscribers FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "email_subscribers_select" ON public.email_subscribers FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "email_subscribers_public_insert" ON public.email_subscribers FOR INSERT TO anon
  WITH CHECK (status = 'subscribed' AND EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.status = 'active'
  ));
CREATE TRIGGER email_subscribers_set_updated_at BEFORE UPDATE ON public.email_subscribers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();