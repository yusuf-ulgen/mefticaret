CREATE INDEX IF NOT EXISTS orders_customer_phone_normalized_idx
  ON public.orders (store_id, (right(regexp_replace(COALESCE(customer_phone, ''), '[^0-9]', '', 'g'), 10)));
CREATE INDEX IF NOT EXISTS orders_customer_email_normalized_idx
  ON public.orders (store_id, (lower(COALESCE(customer_email, ''))));

-- Kullanıcının RLS bağlamında yalnız görüntülenen müşteri sayfasını özetler.
CREATE OR REPLACE FUNCTION public.customer_page_summaries(p_store_id uuid, p_customer_ids uuid[])
RETURNS TABLE(customer_id uuid, orders_count bigint, total_spent numeric, last_order_at timestamptz, currency text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT c.id, count(o.id),
    COALESCE(sum(o.grand_total) FILTER (WHERE o.payment_status = 'paid' AND o.currency = s.currency), 0),
    max(o.placed_at), COALESCE(s.currency, 'TRY')::text
  FROM public.customers c
  JOIN public.stores s ON s.id = c.store_id
  LEFT JOIN public.orders o ON o.store_id = c.store_id
    AND o.status NOT IN ('cancelled', 'refunded', 'returned')
    AND (
      (length(right(regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g'), 10)) = 10
       AND right(regexp_replace(COALESCE(o.customer_phone, ''), '[^0-9]', '', 'g'), 10) = right(regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g'), 10))
      OR (length(COALESCE(c.email, '')) > 0 AND lower(o.customer_email) = lower(c.email))
    )
  WHERE c.store_id = p_store_id AND c.id = ANY(p_customer_ids)
    AND cardinality(p_customer_ids) <= 50
  GROUP BY c.id, s.currency;
$$;
REVOKE ALL ON FUNCTION public.customer_page_summaries(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_page_summaries(uuid, uuid[]) TO authenticated, service_role;
