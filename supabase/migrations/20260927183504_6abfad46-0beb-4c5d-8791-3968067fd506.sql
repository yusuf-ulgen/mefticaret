CREATE OR REPLACE FUNCTION app_private.is_store_published(_store_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'public', 'app_private'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.store_themes t WHERE t.store_id = _store_id AND t.is_published)
      OR EXISTS (SELECT 1 FROM public.v2_themes v WHERE v.store_id = _store_id AND v.status = 'active' AND v.published_snapshot IS NOT NULL)
$$;