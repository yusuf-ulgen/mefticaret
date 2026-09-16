CREATE OR REPLACE FUNCTION public.store_public_campaign(_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ss.campaign_banner
  FROM public.stores s
  JOIN public.store_settings ss ON ss.store_id = s.id
  WHERE s.slug = _slug
    AND s.status = 'active'
    AND ss.campaign_banner IS NOT NULL
    AND coalesce((ss.campaign_banner->>'ends_at')::timestamptz, now() + interval '1 day') > now()
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.store_public_campaign(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.store_public_campaign(text) TO anon, authenticated, service_role;