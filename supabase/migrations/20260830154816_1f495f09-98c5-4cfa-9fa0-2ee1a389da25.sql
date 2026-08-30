CREATE TABLE public.stock_alerts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  email text not null,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

CREATE INDEX stock_alerts_store_idx ON public.stock_alerts(store_id, created_at DESC);
CREATE UNIQUE INDEX stock_alerts_unique_idx ON public.stock_alerts(store_id, product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(email));

GRANT SELECT, UPDATE, DELETE ON public.stock_alerts TO authenticated;
GRANT ALL ON public.stock_alerts TO service_role;

ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store members read stock alerts" ON public.stock_alerts
  FOR SELECT TO authenticated
  USING (app_private.is_store_member(auth.uid(), store_id));

CREATE POLICY "Store managers update stock alerts" ON public.stock_alerts
  FOR UPDATE TO authenticated
  USING (app_private.can_manage_store(auth.uid(), store_id))
  WITH CHECK (app_private.can_manage_store(auth.uid(), store_id));

CREATE POLICY "Store managers delete stock alerts" ON public.stock_alerts
  FOR DELETE TO authenticated
  USING (app_private.can_manage_store(auth.uid(), store_id));