ALTER TABLE public.b2b_credit_accounts
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE CASCADE;

ALTER TABLE public.rfq_requests
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS b2b_credit_accounts_store_supplier_idx
  ON public.b2b_credit_accounts (store_id, supplier_id)
  WHERE supplier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS rfq_requests_supplier_idx
  ON public.rfq_requests (supplier_id, created_at DESC)
  WHERE supplier_id IS NOT NULL;

DROP POLICY IF EXISTS "Supplier portal reads own credit account" ON public.b2b_credit_accounts;
CREATE POLICY "Supplier portal reads own credit account"
ON public.b2b_credit_accounts FOR SELECT TO authenticated
USING (
  supplier_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.id = supplier_id
      AND s.store_id = b2b_credit_accounts.store_id
      AND s.portal_enabled = true
      AND s.portal_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Supplier portal reads own credit transactions" ON public.b2b_credit_transactions;
CREATE POLICY "Supplier portal reads own credit transactions"
ON public.b2b_credit_transactions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.b2b_credit_accounts a
    JOIN public.suppliers s ON s.id = a.supplier_id
    WHERE a.id = b2b_credit_transactions.account_id
      AND a.store_id = b2b_credit_transactions.store_id
      AND s.portal_enabled = true
      AND s.portal_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Supplier portal reads own rfqs" ON public.rfq_requests;
CREATE POLICY "Supplier portal reads own rfqs"
ON public.rfq_requests FOR SELECT TO authenticated
USING (
  supplier_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.id = supplier_id
      AND s.store_id = rfq_requests.store_id
      AND s.portal_enabled = true
      AND s.portal_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Supplier portal reads own supplier products" ON public.supplier_products;
CREATE POLICY "Supplier portal reads own supplier products"
ON public.supplier_products FOR SELECT TO authenticated
USING (
  supplier_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.id = supplier_id
      AND s.store_id = supplier_products.store_id
      AND s.portal_enabled = true
      AND s.portal_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Supplier portal reads own feeds" ON public.supplier_feeds;
CREATE POLICY "Supplier portal reads own feeds"
ON public.supplier_feeds FOR SELECT TO authenticated
USING (
  supplier_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.id = supplier_id
      AND s.store_id = supplier_feeds.store_id
      AND s.portal_enabled = true
      AND s.portal_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Supplier portal reads own feed runs" ON public.supplier_feed_runs;
CREATE POLICY "Supplier portal reads own feed runs"
ON public.supplier_feed_runs FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.supplier_feeds f
    JOIN public.suppliers s ON s.id = f.supplier_id
    WHERE f.id = supplier_feed_runs.feed_id
      AND f.store_id = supplier_feed_runs.store_id
      AND s.portal_enabled = true
      AND s.portal_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Supplier portal reads own dropship orders" ON public.dropship_orders;
CREATE POLICY "Supplier portal reads own dropship orders"
ON public.dropship_orders FOR SELECT TO authenticated
USING (
  supplier_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.id = supplier_id
      AND s.store_id = dropship_orders.store_id
      AND s.portal_enabled = true
      AND s.portal_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Supplier portal reads own import jobs" ON public.supplier_import_jobs;
CREATE POLICY "Supplier portal reads own import jobs"
ON public.supplier_import_jobs FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.id = supplier_import_jobs.supplier_id
      AND s.store_id = supplier_import_jobs.store_id
      AND s.portal_enabled = true
      AND s.portal_user_id = auth.uid()
  )
);