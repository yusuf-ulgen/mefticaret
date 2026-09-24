ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text;

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS inventory_policy text NOT NULL DEFAULT 'deny',
  ADD COLUMN IF NOT EXISTS weight_unit text NOT NULL DEFAULT 'g',
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS option1 text,
  ADD COLUMN IF NOT EXISTS option2 text,
  ADD COLUMN IF NOT EXISTS option3 text;
DO $$ BEGIN
  ALTER TABLE public.product_variants ADD CONSTRAINT product_variants_inventory_policy_chk CHECK (inventory_policy IN ('deny','continue'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.product_variants ADD CONSTRAINT product_variants_weight_unit_chk CHECK (weight_unit IN ('kg','g','lb'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS width integer,
  ADD COLUMN IF NOT EXISTS height integer,
  ADD COLUMN IF NOT EXISTS size_bytes bigint,
  ADD COLUMN IF NOT EXISTS cdn_url text;
DO $$ BEGIN
  ALTER TABLE public.product_images ADD CONSTRAINT product_images_media_type_chk CHECK (media_type IN ('image','video'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS collection_type text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS rules jsonb NOT NULL DEFAULT '{"match":"all","conditions":[]}'::jsonb,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;
DO $$ BEGIN
  ALTER TABLE public.collections ADD CONSTRAINT collections_type_chk CHECK (collection_type IN ('manual','smart'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.product_collections ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS verified_email boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_exempt boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.customers WHERE email IS NOT NULL
    GROUP BY store_id, lower(email) HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS customers_store_email_uniq ON public.customers (store_id, lower(email)) WHERE email IS NOT NULL;
  END IF;
END $$;

ALTER TABLE public.customer_addresses
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

ALTER TABLE public.customer_segments
  ADD COLUMN IF NOT EXISTS query jsonb,
  ADD COLUMN IF NOT EXISTS customer_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  admin_user_id uuid,
  note text NOT NULL CHECK (char_length(note) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.customer_notes TO authenticated;
GRANT ALL ON public.customer_notes TO service_role;
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS customer_notes_customer_idx ON public.customer_notes (customer_id, created_at DESC);
CREATE POLICY "Store team can view customer notes" ON public.customer_notes FOR SELECT TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "Store team can add customer notes" ON public.customer_notes FOR INSERT TO authenticated
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) AND admin_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.store_id = customer_notes.store_id));
CREATE POLICY "Authors can delete own notes" ON public.customer_notes FOR DELETE TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) AND admin_user_id = auth.uid());

INSERT INTO public.plan_features (plan_id, metric_key, label, unit, limit_value, is_enabled, sort_order)
SELECT p.id, f.key, f.label, NULL, NULL, false, f.sort
FROM public.plans p
CROSS JOIN (VALUES ('module_v2_products','Ürünler v2',310),('module_v2_customers','Müşteriler v2',311),('module_v2_collections','Koleksiyonlar v2',312)) AS f(key,label,sort)
WHERE NOT EXISTS (SELECT 1 FROM public.plan_features pf WHERE pf.plan_id = p.id AND pf.metric_key = f.key);