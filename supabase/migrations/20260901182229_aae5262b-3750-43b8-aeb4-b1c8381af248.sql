-- =====================================================================
-- ORGANIZATIONS
-- =====================================================================
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  owner_id uuid NOT NULL,
  billing_email text,
  tax_id text,
  country_code text NOT NULL DEFAULT 'TR',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "organizations_select" ON public.organizations FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "organizations_insert" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "organizations_update" ON public.organizations FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (owner_id = auth.uid() OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "organizations_delete" ON public.organizations FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS stores_organization_id_idx ON public.stores(organization_id);

-- =====================================================================
-- RBAC CATALOG (platform managed)
-- =====================================================================
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  scope text NOT NULL DEFAULT 'store',
  description text,
  is_system boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.roles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_read" ON public.roles FOR SELECT USING (true);
CREATE POLICY "roles_manage" ON public.roles FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER roles_updated_at BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  resource text NOT NULL,
  action text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.permissions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "permissions_read" ON public.permissions FOR SELECT USING (true);
CREATE POLICY "permissions_manage" ON public.permissions FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER permissions_updated_at BEFORE UPDATE ON public.permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, permission_id)
);
GRANT SELECT ON public.role_permissions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_permissions_read" ON public.role_permissions FOR SELECT USING (true);
CREATE POLICY "role_permissions_manage" ON public.role_permissions FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'));

-- =====================================================================
-- CATALOG: brands, vendors, categories
-- =====================================================================
CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  logo_url text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, slug)
);
GRANT SELECT ON public.brands TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brands_public_read" ON public.brands FOR SELECT
  USING (is_active AND app_private.is_store_published(store_id));
CREATE POLICY "brands_member_read" ON public.brands FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "brands_manage" ON public.brands FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER brands_updated_at BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  email text,
  phone text,
  tax_id text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendors_member_read" ON public.vendors FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "vendors_manage" ON public.vendors FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER vendors_updated_at BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  image_url text,
  path text,
  level integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  seo jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, slug)
);
CREATE INDEX categories_store_parent_idx ON public.categories(store_id, parent_id);
GRANT SELECT ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_public_read" ON public.categories FOR SELECT
  USING (is_active AND app_private.is_store_published(store_id));
CREATE POLICY "categories_member_read" ON public.categories FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "categories_manage" ON public.categories FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER categories_updated_at BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS products_category_id_idx ON public.products(category_id);
CREATE INDEX IF NOT EXISTS products_brand_id_idx ON public.products(brand_id);

-- =====================================================================
-- PRODUCT OPTIONS
-- =====================================================================
CREATE TABLE public.product_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, name)
);
GRANT SELECT ON public.product_options TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_options TO authenticated;
GRANT ALL ON public.product_options TO service_role;
ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_options_public_read" ON public.product_options FOR SELECT
  USING (app_private.is_store_published(store_id));
CREATE POLICY "product_options_member_read" ON public.product_options FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "product_options_manage" ON public.product_options FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER product_options_updated_at BEFORE UPDATE ON public.product_options
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.product_option_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.product_options(id) ON DELETE CASCADE,
  value text NOT NULL,
  color_hex text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (option_id, value)
);
GRANT SELECT ON public.product_option_values TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_option_values TO authenticated;
GRANT ALL ON public.product_option_values TO service_role;
ALTER TABLE public.product_option_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_option_values_public_read" ON public.product_option_values FOR SELECT
  USING (app_private.is_store_published(store_id));
CREATE POLICY "product_option_values_member_read" ON public.product_option_values FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "product_option_values_manage" ON public.product_option_values FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE TABLE public.product_variant_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.product_options(id) ON DELETE CASCADE,
  option_value_id uuid NOT NULL REFERENCES public.product_option_values(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (variant_id, option_id)
);
GRANT SELECT ON public.product_variant_options TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variant_options TO authenticated;
GRANT ALL ON public.product_variant_options TO service_role;
ALTER TABLE public.product_variant_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_variant_options_public_read" ON public.product_variant_options FOR SELECT
  USING (app_private.is_store_published(store_id));
CREATE POLICY "product_variant_options_member_read" ON public.product_variant_options FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "product_variant_options_manage" ON public.product_variant_options FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

-- =====================================================================
-- CUSTOMER TAGS
-- =====================================================================
CREATE TABLE public.customer_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, tag)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_tags TO authenticated;
GRANT ALL ON public.customer_tags TO service_role;
ALTER TABLE public.customer_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customer_tags_member_read" ON public.customer_tags FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "customer_tags_manage" ON public.customer_tags FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

-- =====================================================================
-- CARTS
-- =====================================================================
CREATE TABLE public.carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  user_id uuid,
  session_token text,
  currency text NOT NULL DEFAULT 'TRY',
  discount_code text,
  note text,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount_total numeric(14,2) NOT NULL DEFAULT 0,
  shipping_total numeric(14,2) NOT NULL DEFAULT 0,
  tax_total numeric(14,2) NOT NULL DEFAULT 0,
  grand_total numeric(14,2) NOT NULL DEFAULT 0,
  completed_at timestamptz,
  abandoned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX carts_store_user_idx ON public.carts(store_id, user_id);
CREATE INDEX carts_store_session_idx ON public.carts(store_id, session_token);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.carts TO authenticated;
GRANT ALL ON public.carts TO service_role;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "carts_owner_all" ON public.carts FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "carts_store_read" ON public.carts FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER carts_updated_at BEFORE UPDATE ON public.carts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  title text NOT NULL,
  variant_title text,
  sku text,
  image_url text,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  line_total numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cart_items_cart_idx ON public.cart_items(cart_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT ALL ON public.cart_items TO service_role;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cart_items_owner_all" ON public.cart_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id AND c.user_id = auth.uid()));
CREATE POLICY "cart_items_store_read" ON public.cart_items FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER cart_items_updated_at BEFORE UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- ORDER DETAIL TABLES
-- =====================================================================
CREATE TABLE public.order_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'shipping',
  full_name text NOT NULL,
  phone text,
  company text,
  line1 text NOT NULL,
  line2 text,
  district text,
  city text NOT NULL,
  state text,
  postal_code text,
  country_code text NOT NULL DEFAULT 'TR',
  tax_id text,
  tax_office text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_addresses TO authenticated;
GRANT ALL ON public.order_addresses TO service_role;
ALTER TABLE public.order_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_addresses_member_read" ON public.order_addresses FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "order_addresses_manage" ON public.order_addresses FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE TABLE public.order_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  author_id uuid,
  author_name text,
  body text NOT NULL,
  is_internal boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_notes_order_idx ON public.order_notes(order_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_notes TO authenticated;
GRANT ALL ON public.order_notes TO service_role;
ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_notes_member_read" ON public.order_notes FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "order_notes_manage" ON public.order_notes FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE TABLE public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  from_status order_status,
  to_status order_status NOT NULL,
  actor_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_status_history_order_idx ON public.order_status_history(order_id, created_at DESC);
GRANT SELECT, INSERT ON public.order_status_history TO authenticated;
GRANT ALL ON public.order_status_history TO service_role;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_status_history_member_read" ON public.order_status_history FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "order_status_history_insert" ON public.order_status_history FOR INSERT TO authenticated
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

-- Sipariş durumu değiştiğinde geçmişe otomatik kayıt
CREATE OR REPLACE FUNCTION public.record_order_status_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_status_history (order_id, store_id, from_status, to_status, actor_id)
    VALUES (NEW.id, NEW.store_id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_order_status_history() FROM anon, authenticated;
CREATE TRIGGER orders_status_history AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.record_order_status_history();

-- =====================================================================
-- PAYMENTS
-- =====================================================================
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  provider text NOT NULL,
  method text,
  status payment_status NOT NULL DEFAULT 'pending',
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  installment_count integer NOT NULL DEFAULT 1,
  provider_reference text,
  captured_at timestamptz,
  failure_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_store_order_idx ON public.payments(store_id, order_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_member_read" ON public.payments FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "payments_manage" ON public.payments FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  provider_reference text,
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_transactions_payment_idx ON public.payment_transactions(payment_id, created_at DESC);
GRANT SELECT ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_transactions_member_read" ON public.payment_transactions FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE TABLE public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  return_request_id uuid REFERENCES public.return_requests(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  status text NOT NULL DEFAULT 'pending',
  reason text,
  provider_reference text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.refunds TO authenticated;
GRANT ALL ON public.refunds TO service_role;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "refunds_member_read" ON public.refunds FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "refunds_manage" ON public.refunds FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER refunds_updated_at BEFORE UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- SHIPPING METHODS
-- =====================================================================
CREATE TABLE public.shipping_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES public.shipping_zones(id) ON DELETE SET NULL,
  carrier_code text,
  name text NOT NULL,
  description text,
  base_price numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  free_over numeric(14,2),
  min_delivery_days integer,
  max_delivery_days integer,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shipping_methods TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_methods TO authenticated;
GRANT ALL ON public.shipping_methods TO service_role;
ALTER TABLE public.shipping_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shipping_methods_public_read" ON public.shipping_methods FOR SELECT
  USING (is_active AND app_private.is_store_published(store_id));
CREATE POLICY "shipping_methods_member_read" ON public.shipping_methods FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "shipping_methods_manage" ON public.shipping_methods FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER shipping_methods_updated_at BEFORE UPDATE ON public.shipping_methods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- DISCOUNT CODES
-- =====================================================================
CREATE TABLE public.discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  discount_id uuid NOT NULL REFERENCES public.discounts(id) ON DELETE CASCADE,
  code text NOT NULL,
  usage_limit integer,
  usage_count integer NOT NULL DEFAULT 0,
  per_customer_limit integer,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discount_codes TO authenticated;
GRANT ALL ON public.discount_codes TO service_role;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "discount_codes_member_read" ON public.discount_codes FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "discount_codes_manage" ON public.discount_codes FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER discount_codes_updated_at BEFORE UPDATE ON public.discount_codes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- MARKETPLACE SELLER TABLES
-- =====================================================================
CREATE TABLE public.seller_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES public.marketplace_sellers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  commission_rate numeric(6,3),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (seller_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_products TO authenticated;
GRANT ALL ON public.seller_products TO service_role;
ALTER TABLE public.seller_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seller_products_store_read" ON public.seller_products FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "seller_products_owner_read" ON public.seller_products FOR SELECT TO authenticated
  USING (seller_id = app_private.approved_seller_id(store_id, auth.uid()));
CREATE POLICY "seller_products_manage" ON public.seller_products FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER seller_products_updated_at BEFORE UPDATE ON public.seller_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.seller_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES public.marketplace_sellers(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status order_status NOT NULL DEFAULT 'pending',
  items_total numeric(14,2) NOT NULL DEFAULT 0,
  commission_total numeric(14,2) NOT NULL DEFAULT 0,
  payout_total numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (seller_id, order_id)
);
GRANT SELECT, INSERT, UPDATE ON public.seller_orders TO authenticated;
GRANT ALL ON public.seller_orders TO service_role;
ALTER TABLE public.seller_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seller_orders_store_read" ON public.seller_orders FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "seller_orders_owner_read" ON public.seller_orders FOR SELECT TO authenticated
  USING (seller_id = app_private.approved_seller_id(store_id, auth.uid()));
CREATE POLICY "seller_orders_manage" ON public.seller_orders FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER seller_orders_updated_at BEFORE UPDATE ON public.seller_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  seller_id uuid REFERENCES public.marketplace_sellers(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  rate numeric(6,3) NOT NULL DEFAULT 0,
  base_amount numeric(14,2) NOT NULL DEFAULT 0,
  commission_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX commissions_store_seller_idx ON public.commissions(store_id, seller_id);
GRANT SELECT, INSERT, UPDATE ON public.commissions TO authenticated;
GRANT ALL ON public.commissions TO service_role;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commissions_store_read" ON public.commissions FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "commissions_owner_read" ON public.commissions FOR SELECT TO authenticated
  USING (seller_id IS NOT NULL AND seller_id = app_private.approved_seller_id(store_id, auth.uid()));
CREATE POLICY "commissions_manage" ON public.commissions FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER commissions_updated_at BEFORE UPDATE ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- THEME SETTINGS
-- =====================================================================
CREATE TABLE public.theme_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  setting_key text NOT NULL,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, setting_key)
);
GRANT SELECT ON public.theme_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.theme_settings TO authenticated;
GRANT ALL ON public.theme_settings TO service_role;
ALTER TABLE public.theme_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "theme_settings_public_read" ON public.theme_settings FOR SELECT
  USING (app_private.is_store_published(store_id));
CREATE POLICY "theme_settings_member_read" ON public.theme_settings FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "theme_settings_manage" ON public.theme_settings FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER theme_settings_updated_at BEFORE UPDATE ON public.theme_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- APP PERMISSIONS
-- =====================================================================
CREATE TABLE public.app_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id uuid NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  scope text NOT NULL,
  label text NOT NULL,
  description text,
  is_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, scope)
);
GRANT SELECT ON public.app_permissions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_permissions TO authenticated;
GRANT ALL ON public.app_permissions TO service_role;
ALTER TABLE public.app_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_permissions_read" ON public.app_permissions FOR SELECT USING (true);
CREATE POLICY "app_permissions_manage" ON public.app_permissions FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'));

-- =====================================================================
-- MENUS
-- =====================================================================
CREATE TABLE public.menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  handle text NOT NULL,
  title text NOT NULL,
  location text NOT NULL DEFAULT 'header',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, handle)
);
GRANT SELECT ON public.menus TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menus TO authenticated;
GRANT ALL ON public.menus TO service_role;
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menus_public_read" ON public.menus FOR SELECT
  USING (is_active AND app_private.is_store_published(store_id));
CREATE POLICY "menus_member_read" ON public.menus FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "menus_manage" ON public.menus FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER menus_updated_at BEFORE UPDATE ON public.menus
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.store_menu_items ADD COLUMN IF NOT EXISTS menu_id uuid REFERENCES public.menus(id) ON DELETE CASCADE;
ALTER TABLE public.store_menu_items ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.store_menu_items(id) ON DELETE CASCADE;

-- =====================================================================
-- ROLE / PERMISSION SEED
-- =====================================================================
INSERT INTO public.roles (code, label, scope, description, sort_order) VALUES
  ('platform_admin', 'Platform Yöneticisi', 'platform', 'Tüm platform yönetimi', 1),
  ('agency', 'Ajans', 'platform', 'Birden fazla mağazayı yönetir', 2),
  ('seller', 'Satıcı', 'marketplace', 'Pazaryeri satıcısı', 3),
  ('customer', 'Müşteri', 'storefront', 'Vitrin müşterisi', 4),
  ('owner', 'Mağaza Sahibi', 'store', 'Mağaza sahibi, tüm yetkiler', 5),
  ('admin', 'Mağaza Yöneticisi', 'store', 'Mağaza yönetimi', 6),
  ('staff', 'Personel', 'store', 'Sipariş ve ürün işlemleri', 7),
  ('marketing', 'Pazarlama', 'store', 'Pazarlama ve içerik', 8),
  ('support', 'Destek', 'store', 'Müşteri destek işlemleri', 9);

INSERT INTO public.permissions (code, label, resource, action) VALUES
  ('products.read', 'Ürünleri görüntüle', 'products', 'read'),
  ('products.write', 'Ürünleri düzenle', 'products', 'write'),
  ('orders.read', 'Siparişleri görüntüle', 'orders', 'read'),
  ('orders.write', 'Siparişleri düzenle', 'orders', 'write'),
  ('customers.read', 'Müşterileri görüntüle', 'customers', 'read'),
  ('customers.write', 'Müşterileri düzenle', 'customers', 'write'),
  ('inventory.read', 'Stokları görüntüle', 'inventory', 'read'),
  ('inventory.write', 'Stokları düzenle', 'inventory', 'write'),
  ('marketing.write', 'Pazarlama yönetimi', 'marketing', 'write'),
  ('content.write', 'İçerik yönetimi', 'content', 'write'),
  ('settings.write', 'Ayarları düzenle', 'settings', 'write'),
  ('billing.write', 'Abonelik ve faturalama', 'billing', 'write'),
  ('support.write', 'Destek taleplerini yönet', 'support', 'write'),
  ('api.manage', 'API ve OAuth yönetimi', 'api', 'manage');

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.code IN ('owner', 'admin', 'platform_admin');

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p
  ON p.code IN ('products.read','products.write','orders.read','orders.write','inventory.read','inventory.write','customers.read')
WHERE r.code = 'staff';

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p
  ON p.code IN ('marketing.write','content.write','products.read','customers.read')
WHERE r.code = 'marketing';

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p
  ON p.code IN ('support.write','orders.read','customers.read')
WHERE r.code = 'support';