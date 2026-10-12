CREATE OR REPLACE FUNCTION public.ledger_account_balance(_account_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(SUM(CASE WHEN e.direction = 'credit' THEN e.amount ELSE -e.amount END), 0)
    FROM public.ledger_entries e
   WHERE e.account_id = _account_id
     AND e.status = 'posted';
$$;

CREATE OR REPLACE FUNCTION public.ledger_store_balances(_store_id uuid)
RETURNS TABLE (
  account_id uuid,
  account_kind public.ledger_account_kind,
  account_name text,
  currency text,
  seller_id uuid,
  credit numeric,
  debit numeric,
  balance numeric,
  pending numeric
) LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT a.id,
         a.kind,
         a.name,
         a.currency,
         a.seller_id,
         COALESCE(SUM(CASE WHEN e.status = 'posted' AND e.direction = 'credit' THEN e.amount ELSE 0 END), 0),
         COALESCE(SUM(CASE WHEN e.status = 'posted' AND e.direction = 'debit' THEN e.amount ELSE 0 END), 0),
         COALESCE(SUM(CASE WHEN e.status = 'posted' THEN (CASE WHEN e.direction = 'credit' THEN e.amount ELSE -e.amount END) ELSE 0 END), 0),
         COALESCE(SUM(CASE WHEN e.status = 'pending' THEN (CASE WHEN e.direction = 'credit' THEN e.amount ELSE -e.amount END) ELSE 0 END), 0)
    FROM public.ledger_accounts a
    LEFT JOIN public.ledger_entries e ON e.account_id = a.id
   WHERE a.store_id = _store_id
   GROUP BY a.id, a.kind, a.name, a.currency, a.seller_id
   ORDER BY a.kind, a.name;
$$;