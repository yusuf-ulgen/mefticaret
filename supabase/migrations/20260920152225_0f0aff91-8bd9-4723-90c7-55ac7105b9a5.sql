CREATE TABLE public.gamification_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'spin_wheel' CHECK (kind IN ('spin_wheel','scratch_card')),
  is_active boolean NOT NULL DEFAULT false,
  headline text NOT NULL DEFAULT 'Şansını dene!',
  body text,
  cta_label text NOT NULL DEFAULT 'Çevir',
  prizes jsonb NOT NULL DEFAULT '[]'::jsonb,
  discount_type text NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent','amount')),
  code_prefix text NOT NULL DEFAULT 'SANS',
  code_valid_days integer NOT NULL DEFAULT 7,
  max_plays_per_email integer NOT NULL DEFAULT 1,
  show_delay_seconds integer NOT NULL DEFAULT 6,
  plays_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.gamification_plays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.gamification_campaigns(id) ON DELETE CASCADE,
  email text NOT NULL,
  prize_label text NOT NULL,
  prize_value numeric(12,2) NOT NULL DEFAULT 0,
  discount_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX gamification_plays_campaign_idx ON public.gamification_plays (campaign_id, created_at DESC);
CREATE INDEX gamification_campaigns_store_active_idx ON public.gamification_campaigns (store_id) WHERE is_active;

CREATE TABLE public.pickup_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  address_line text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  phone text,
  opening_hours text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.rfq_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  rfq_id uuid NOT NULL REFERENCES public.rfq_requests(id) ON DELETE CASCADE,
  author_kind text NOT NULL DEFAULT 'rep' CHECK (author_kind IN ('rep','buyer')),
  author_id uuid,
  body text NOT NULL,
  quoted_total numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rfq_messages_rfq_idx ON public.rfq_messages (rfq_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gamification_campaigns TO authenticated;
GRANT SELECT ON public.gamification_campaigns TO anon;
GRANT ALL ON public.gamification_campaigns TO service_role;

GRANT SELECT ON public.gamification_plays TO authenticated;
GRANT ALL ON public.gamification_plays TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pickup_locations TO authenticated;
GRANT SELECT ON public.pickup_locations TO anon;
GRANT ALL ON public.pickup_locations TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rfq_messages TO authenticated;
GRANT ALL ON public.rfq_messages TO service_role;

ALTER TABLE public.gamification_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_plays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gamification_campaigns_member_read" ON public.gamification_campaigns
  FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "gamification_campaigns_public_read" ON public.gamification_campaigns
  FOR SELECT TO anon
  USING (is_active);

CREATE POLICY "gamification_campaigns_manage" ON public.gamification_campaigns
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "gamification_plays_member_read" ON public.gamification_plays
  FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "pickup_locations_member_read" ON public.pickup_locations
  FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "pickup_locations_public_read" ON public.pickup_locations
  FOR SELECT TO anon
  USING (is_active);

CREATE POLICY "pickup_locations_manage" ON public.pickup_locations
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "rfq_messages_member_read" ON public.rfq_messages
  FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "rfq_messages_manage" ON public.rfq_messages
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE TRIGGER gamification_campaigns_tenant_guard BEFORE INSERT OR UPDATE ON public.gamification_campaigns
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs();
CREATE TRIGGER gamification_plays_tenant_guard BEFORE INSERT OR UPDATE ON public.gamification_plays
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs();
CREATE TRIGGER pickup_locations_tenant_guard BEFORE INSERT OR UPDATE ON public.pickup_locations
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs();
CREATE TRIGGER rfq_messages_tenant_guard BEFORE INSERT OR UPDATE ON public.rfq_messages
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs();

CREATE TRIGGER gamification_campaigns_updated_at BEFORE UPDATE ON public.gamification_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER pickup_locations_updated_at BEFORE UPDATE ON public.pickup_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();