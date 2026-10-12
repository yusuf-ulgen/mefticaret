CREATE TABLE public.platform_analytics_saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'view' CHECK (kind IN ('view','report')),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.platform_analytics_saved_views TO service_role;
ALTER TABLE public.platform_analytics_saved_views ENABLE ROW LEVEL SECURITY;
CREATE INDEX platform_analytics_saved_views_owner_idx ON public.platform_analytics_saved_views(owner_id, kind);

-- Mağaza başına ilk olay zamanları (onboarding hunisi ve ilk satış). Yalnız sunucu (service_role).
CREATE OR REPLACE FUNCTION public.platform_store_milestones()
RETURNS TABLE(store_id uuid, first_product_at timestamptz, product_count bigint, first_payment_method_at timestamptz,
  first_domain_verified_at timestamptz, first_order_at timestamptz, last_order_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id,
    (SELECT min(p.created_at) FROM products p WHERE p.store_id = s.id),
    (SELECT count(*) FROM products p WHERE p.store_id = s.id),
    (SELECT min(m.created_at) FROM store_payment_methods m WHERE m.store_id = s.id AND m.is_active),
    (SELECT min(d.verified_at) FROM store_domains d WHERE d.store_id = s.id AND d.type = 'custom' AND d.verified_at IS NOT NULL),
    (SELECT min(coalesce(o.placed_at, o.created_at)) FROM orders o WHERE o.store_id = s.id AND o.payment_status IN ('paid','partially_refunded','refunded')),
    (SELECT max(coalesce(o.placed_at, o.created_at)) FROM orders o WHERE o.store_id = s.id AND o.payment_status IN ('paid','partially_refunded','refunded'))
  FROM stores s;
$$;
REVOKE ALL ON FUNCTION public.platform_store_milestones() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_store_milestones() TO service_role;

CREATE INDEX IF NOT EXISTS orders_placed_at_idx ON public.orders(placed_at);
CREATE INDEX IF NOT EXISTS payments_created_at_idx ON public.payments(created_at);