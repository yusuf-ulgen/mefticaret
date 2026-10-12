CREATE POLICY "return_items_insert_own_customer" ON public.return_items
FOR INSERT TO authenticated
WITH CHECK (
  return_id IN (
    SELECT r.id FROM public.return_requests r
    JOIN public.customers c ON c.id = r.customer_id
    WHERE c.user_id = auth.uid()
  )
);

CREATE POLICY "returns_update_own_customer" ON public.return_requests
FOR UPDATE TO authenticated
USING (
  status = 'requested'
  AND customer_id IN (SELECT c.id FROM public.customers c WHERE c.user_id = auth.uid())
)
WITH CHECK (
  customer_id IN (SELECT c.id FROM public.customers c WHERE c.user_id = auth.uid())
);