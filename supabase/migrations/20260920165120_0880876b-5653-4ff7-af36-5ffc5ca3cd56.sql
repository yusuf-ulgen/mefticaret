-- 1. gamification_campaigns: require published store for public reads
DROP POLICY IF EXISTS gamification_campaigns_public_read ON public.gamification_campaigns;
CREATE POLICY gamification_campaigns_public_read
ON public.gamification_campaigns
FOR SELECT
TO anon, authenticated
USING (is_active AND app_private.is_store_published(store_id));

-- 2. product_options: only for active products
DROP POLICY IF EXISTS product_options_public_read ON public.product_options;
CREATE POLICY product_options_public_read
ON public.product_options
FOR SELECT
TO anon, authenticated
USING (
  app_private.is_store_published(store_id)
  AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_options.product_id AND p.status = 'active'::public.product_status
  )
);

-- 3. product_option_values: join through option to product
DROP POLICY IF EXISTS product_option_values_public_read ON public.product_option_values;
CREATE POLICY product_option_values_public_read
ON public.product_option_values
FOR SELECT
TO anon, authenticated
USING (
  app_private.is_store_published(store_id)
  AND EXISTS (
    SELECT 1
    FROM public.product_options po
    JOIN public.products p ON p.id = po.product_id
    WHERE po.id = product_option_values.option_id
      AND p.status = 'active'::public.product_status
  )
);

-- 4. product_variant_options: join through option to product
DROP POLICY IF EXISTS product_variant_options_public_read ON public.product_variant_options;
CREATE POLICY product_variant_options_public_read
ON public.product_variant_options
FOR SELECT
TO anon, authenticated
USING (
  app_private.is_store_published(store_id)
  AND EXISTS (
    SELECT 1
    FROM public.product_options po
    JOIN public.products p ON p.id = po.product_id
    WHERE po.id = product_variant_options.option_id
      AND p.status = 'active'::public.product_status
  )
);

-- 5. product_country_rules: only for active products
DROP POLICY IF EXISTS product_country_rules_public_read ON public.product_country_rules;
CREATE POLICY product_country_rules_public_read
ON public.product_country_rules
FOR SELECT
TO anon, authenticated
USING (
  app_private.is_store_published(store_id)
  AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_country_rules.product_id AND p.status = 'active'::public.product_status
  )
);