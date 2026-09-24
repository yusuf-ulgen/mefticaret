REVOKE EXECUTE ON FUNCTION public.analytics_v2_compare(timestamptz, timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_v2_compare(timestamptz, timestamptz) TO service_role;
CREATE OR REPLACE FUNCTION public.analytics_v2_compare(_from timestamptz, _to timestamptz)
RETURNS TABLE(store_id uuid, name text, slug text, revenue numeric, orders bigint, visitors bigint, conversion_rate numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.id, s.name, s.slug, coalesce(sum(d.revenue),0), coalesce(sum(d.orders),0)::bigint, coalesce(sum(d.visitors),0)::bigint,
    CASE WHEN coalesce(sum(d.sessions),0)>0 THEN round(sum(d.orders)::numeric/sum(d.sessions),4) ELSE 0 END
  FROM stores s JOIN analytics_daily_summary d ON d.store_id=s.id
  WHERE d.date >= (_from AT TIME ZONE 'Europe/Istanbul')::date AND d.date < (_to AT TIME ZONE 'Europe/Istanbul')::date + 1
  GROUP BY s.id, s.name, s.slug ORDER BY 4 DESC LIMIT 200;
$$;