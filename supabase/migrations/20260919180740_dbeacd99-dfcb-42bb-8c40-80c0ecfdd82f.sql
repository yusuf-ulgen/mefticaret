ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS storefront_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS banner_headline text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS banner_body text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS banner_cta_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS landing_headline text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS landing_body text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS discount_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS email_campaigns_store_slug_idx
  ON public.email_campaigns (store_id, slug) WHERE slug IS NOT NULL;

GRANT SELECT (
  id, store_id, name, slug, storefront_enabled, banner_headline, banner_body,
  banner_cta_label, landing_headline, landing_body, discount_code, starts_at, ends_at
) ON public.email_campaigns TO anon;

DROP POLICY IF EXISTS "email_campaigns_public_select" ON public.email_campaigns;
CREATE POLICY "email_campaigns_public_select" ON public.email_campaigns FOR SELECT TO anon
  USING (
    storefront_enabled
    AND slug IS NOT NULL
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
    AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.status = 'active')
  );

CREATE TABLE IF NOT EXISTS public.campaign_storefront_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('view', 'click')),
  session_id text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campaign_storefront_events_store_idx
  ON public.campaign_storefront_events (store_id, campaign_id, created_at DESC);

GRANT SELECT ON public.campaign_storefront_events TO authenticated;
GRANT INSERT ON public.campaign_storefront_events TO anon, authenticated;
GRANT ALL ON public.campaign_storefront_events TO service_role;
ALTER TABLE public.campaign_storefront_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_storefront_events_select" ON public.campaign_storefront_events
  FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "campaign_storefront_events_public_insert" ON public.campaign_storefront_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.email_campaigns c
    JOIN public.stores s ON s.id = c.store_id
    WHERE c.id = campaign_id AND c.store_id = campaign_storefront_events.store_id
      AND c.storefront_enabled AND s.status = 'active'
  ));

CREATE TRIGGER campaign_storefront_events_tenant_guard
  BEFORE INSERT OR UPDATE ON public.campaign_storefront_events
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_refs();