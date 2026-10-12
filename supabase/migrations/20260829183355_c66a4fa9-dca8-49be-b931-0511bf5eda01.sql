CREATE OR REPLACE FUNCTION app_private.is_store_published(_store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_private AS $$
  SELECT EXISTS (SELECT 1 FROM public.store_themes t WHERE t.store_id = _store_id AND t.is_published)
$$;

GRANT SELECT ON public.stores TO anon;
GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.product_variants TO anon;
GRANT SELECT ON public.product_images TO anon;
GRANT SELECT ON public.collections TO anon;
GRANT SELECT ON public.product_collections TO anon;

CREATE POLICY stores_select_published_anon ON public.stores
  FOR SELECT TO anon USING (app_private.is_store_published(id));

CREATE POLICY products_select_public ON public.products
  FOR SELECT TO anon USING (status = 'active' AND app_private.is_store_published(store_id));

CREATE POLICY product_variants_select_public ON public.product_variants
  FOR SELECT TO anon USING (app_private.is_store_published(store_id)
    AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.status = 'active'));

CREATE POLICY product_images_select_public ON public.product_images
  FOR SELECT TO anon USING (app_private.is_store_published(store_id)
    AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.status = 'active'));

CREATE POLICY collections_select_public ON public.collections
  FOR SELECT TO anon USING (app_private.is_store_published(store_id));

CREATE POLICY product_collections_select_public ON public.product_collections
  FOR SELECT TO anon USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_id AND p.status = 'active' AND app_private.is_store_published(p.store_id)));