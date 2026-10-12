CREATE POLICY "Signed-in visitors read published themes" ON public.store_themes FOR SELECT TO authenticated
  USING (is_published);

CREATE OR REPLACE FUNCTION app_private.is_store_published(_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'app_private'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.store_themes t WHERE t.store_id = _store_id AND t.is_published)
$$;