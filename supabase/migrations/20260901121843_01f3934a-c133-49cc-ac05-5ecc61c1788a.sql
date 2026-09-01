CREATE TYPE public.seller_status AS ENUM ('pending','approved','rejected','suspended');

CREATE TABLE public.marketplace_sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text NOT NULL,
  legal_name text,
  email text,
  phone text,
  tax_id text,
  iban text,
  about text,
  commission_rate numeric NOT NULL DEFAULT 0.10,
  status public.seller_status NOT NULL DEFAULT 'pending',
  rejection_reason text,
  approved_at timestamptz,
  suspended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_sellers TO authenticated;
GRANT ALL ON public.marketplace_sellers TO service_role;
ALTER TABLE public.marketplace_sellers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.seller_payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES public.marketplace_sellers(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'TRY',
  iban text,
  note text,
  status public.payout_status NOT NULL DEFAULT 'pending',
  admin_note text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_payout_requests TO authenticated;
GRANT ALL ON public.seller_payout_requests TO service_role;
ALTER TABLE public.seller_payout_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES public.marketplace_sellers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS marketplace_sellers_store_idx ON public.marketplace_sellers(store_id, status);
CREATE INDEX IF NOT EXISTS marketplace_sellers_user_idx ON public.marketplace_sellers(user_id);
CREATE INDEX IF NOT EXISTS seller_payout_requests_seller_idx ON public.seller_payout_requests(seller_id, status);
CREATE INDEX IF NOT EXISTS products_seller_idx ON public.products(seller_id);

CREATE OR REPLACE FUNCTION app_private.approved_seller_id(_store_id uuid, _user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.id FROM public.marketplace_sellers s
  WHERE s.store_id = _store_id AND s.user_id = _user_id AND s.status = 'approved'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.guard_seller_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT app_private.can_manage_store(NEW.store_id, auth.uid()) THEN
    NEW.status := OLD.status;
    NEW.commission_rate := OLD.commission_rate;
    NEW.store_id := OLD.store_id;
    NEW.user_id := OLD.user_id;
    NEW.approved_at := OLD.approved_at;
    NEW.suspended_at := OLD.suspended_at;
    NEW.rejection_reason := OLD.rejection_reason;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER marketplace_sellers_guard_admin_fields
BEFORE UPDATE ON public.marketplace_sellers
FOR EACH ROW EXECUTE FUNCTION public.guard_seller_admin_fields();

CREATE TRIGGER marketplace_sellers_set_updated_at
BEFORE UPDATE ON public.marketplace_sellers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER seller_payout_requests_set_updated_at
BEFORE UPDATE ON public.seller_payout_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Sellers see own record" ON public.marketplace_sellers
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "Users apply as seller" ON public.marketplace_sellers
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Managers create sellers" ON public.marketplace_sellers
FOR INSERT TO authenticated
WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "Sellers and managers update" ON public.marketplace_sellers
FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR app_private.can_manage_store(store_id, auth.uid()))
WITH CHECK (user_id = auth.uid() OR app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "Managers delete sellers" ON public.marketplace_sellers
FOR DELETE TO authenticated
USING (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "Payout requests visible to owner and managers" ON public.seller_payout_requests
FOR SELECT TO authenticated
USING (
  app_private.can_manage_store(store_id, auth.uid())
  OR EXISTS (SELECT 1 FROM public.marketplace_sellers s WHERE s.id = seller_id AND s.user_id = auth.uid())
);

CREATE POLICY "Sellers request payouts" ON public.seller_payout_requests
FOR INSERT TO authenticated
WITH CHECK (
  status = 'pending'
  AND seller_id = app_private.approved_seller_id(store_id, auth.uid())
);

CREATE POLICY "Managers manage payout requests" ON public.seller_payout_requests
FOR UPDATE TO authenticated
USING (app_private.can_manage_store(store_id, auth.uid()))
WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "Managers delete payout requests" ON public.seller_payout_requests
FOR DELETE TO authenticated
USING (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "Sellers manage own products" ON public.products
FOR ALL TO authenticated
USING (seller_id IS NOT NULL AND seller_id = app_private.approved_seller_id(store_id, auth.uid()))
WITH CHECK (seller_id IS NOT NULL AND seller_id = app_private.approved_seller_id(store_id, auth.uid()));

CREATE POLICY "Sellers manage own variants" ON public.product_variants
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.products p
  WHERE p.id = product_variants.product_id
    AND p.seller_id IS NOT NULL
    AND p.seller_id = app_private.approved_seller_id(p.store_id, auth.uid())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.products p
  WHERE p.id = product_variants.product_id
    AND p.seller_id IS NOT NULL
    AND p.seller_id = app_private.approved_seller_id(p.store_id, auth.uid())
));

CREATE POLICY "Sellers manage own product images" ON public.product_images
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.products p
  WHERE p.id = product_images.product_id
    AND p.seller_id IS NOT NULL
    AND p.seller_id = app_private.approved_seller_id(p.store_id, auth.uid())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.products p
  WHERE p.id = product_images.product_id
    AND p.seller_id IS NOT NULL
    AND p.seller_id = app_private.approved_seller_id(p.store_id, auth.uid())
));

CREATE POLICY "Sellers see own order items" ON public.order_items
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.products p
  WHERE p.id = order_items.product_id
    AND p.seller_id IS NOT NULL
    AND p.seller_id = app_private.approved_seller_id(p.store_id, auth.uid())
));

CREATE POLICY "Sellers see orders containing own products" ON public.orders
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.order_items oi
  JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = orders.id
    AND p.seller_id IS NOT NULL
    AND p.seller_id = app_private.approved_seller_id(p.store_id, auth.uid())
));