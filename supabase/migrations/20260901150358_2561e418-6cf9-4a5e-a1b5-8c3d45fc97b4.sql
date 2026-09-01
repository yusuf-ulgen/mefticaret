CREATE TABLE public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  session_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('page_view','product_view','add_to_cart','checkout','purchase')),
  path text,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  value numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  quantity integer NOT NULL DEFAULT 0,
  source text,
  medium text,
  campaign text,
  referrer text,
  referrer_host text,
  device text,
  country text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX analytics_events_store_created_idx ON public.analytics_events (store_id, created_at DESC);
CREATE INDEX analytics_events_store_kind_idx ON public.analytics_events (store_id, kind, created_at DESC);
CREATE INDEX analytics_events_session_idx ON public.analytics_events (store_id, session_id);
CREATE INDEX analytics_events_visitor_idx ON public.analytics_events (store_id, visitor_id);

GRANT SELECT ON public.analytics_events TO authenticated;
GRANT ALL ON public.analytics_events TO service_role;

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store members read analytics events"
  ON public.analytics_events FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
