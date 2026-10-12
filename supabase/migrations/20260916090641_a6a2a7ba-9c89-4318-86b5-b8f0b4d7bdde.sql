ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS campaign_banner jsonb;

CREATE TABLE IF NOT EXISTS public.store_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'kg',
  quantity numeric(12,3) NOT NULL DEFAULT 0,
  expiry_date date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_materials TO authenticated;
GRANT ALL ON public.store_materials TO service_role;
ALTER TABLE public.store_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store_materials_member_all" ON public.store_materials FOR ALL TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE INDEX IF NOT EXISTS store_materials_store_idx ON public.store_materials (store_id, expiry_date);
CREATE TRIGGER store_materials_set_updated_at BEFORE UPDATE ON public.store_materials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.product_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.store_materials(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, material_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_materials TO authenticated;
GRANT ALL ON public.product_materials TO service_role;
ALTER TABLE public.product_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_materials_member_all" ON public.product_materials FOR ALL TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE INDEX IF NOT EXISTS product_materials_product_idx ON public.product_materials (product_id);

CREATE TABLE IF NOT EXISTS public.order_delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  to_store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','cancelled')),
  note text,
  requested_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.order_delegations TO authenticated;
GRANT ALL ON public.order_delegations TO service_role;
ALTER TABLE public.order_delegations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_delegations_select" ON public.order_delegations FOR SELECT TO authenticated
  USING (app_private.is_store_member(from_store_id, auth.uid()) OR app_private.is_store_member(to_store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "order_delegations_insert" ON public.order_delegations FOR INSERT TO authenticated
  WITH CHECK (app_private.is_store_member(from_store_id, auth.uid()));
CREATE POLICY "order_delegations_update" ON public.order_delegations FOR UPDATE TO authenticated
  USING (app_private.is_store_member(from_store_id, auth.uid()) OR app_private.is_store_member(to_store_id, auth.uid()))
  WITH CHECK (app_private.is_store_member(from_store_id, auth.uid()) OR app_private.is_store_member(to_store_id, auth.uid()));
CREATE INDEX IF NOT EXISTS order_delegations_order_idx ON public.order_delegations (order_id);
CREATE INDEX IF NOT EXISTS order_delegations_to_idx ON public.order_delegations (to_store_id, status);
CREATE TRIGGER order_delegations_set_updated_at BEFORE UPDATE ON public.order_delegations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.kolay_nearby_stores(_store_id uuid)
RETURNS TABLE(id uuid, name text, slug text, city text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT s.id, lower(trim(coalesce(ss.address->>'city', ''))) AS city
    FROM public.stores s
    LEFT JOIN public.store_settings ss ON ss.store_id = s.id
    WHERE s.id = _store_id
      AND (app_private.is_store_member(s.id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  )
  SELECT s.id, s.name, s.slug, ss.address->>'city' AS city
  FROM public.stores s
  JOIN public.store_settings ss ON ss.store_id = s.id
  JOIN me ON true
  WHERE s.id <> me.id
    AND s.status = 'active'
    AND me.city <> ''
    AND lower(trim(coalesce(ss.address->>'city', ''))) = me.city
  ORDER BY s.name
  LIMIT 50;
$$;
REVOKE ALL ON FUNCTION public.kolay_nearby_stores(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kolay_nearby_stores(uuid) TO authenticated, service_role;