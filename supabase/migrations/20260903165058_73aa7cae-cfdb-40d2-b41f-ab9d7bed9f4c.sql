CREATE OR REPLACE FUNCTION public.site_kit_public_config(store_slug text)
RETURNS TABLE (provider text, public_config jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT k.provider, k.public_config
  FROM public.store_site_kit k
  JOIN public.stores s ON s.id = k.store_id
  WHERE s.slug = store_slug
    AND k.is_enabled = true
    AND app_private.is_store_published(k.store_id);
$$;