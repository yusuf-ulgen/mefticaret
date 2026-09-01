REVOKE ALL ON FUNCTION public.ledger_entries_block_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ledger_entries_guard_immutable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_ledger_account(uuid, public.ledger_account_kind, text, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ledger_account_balance(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ledger_store_balances(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ledger_account_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ledger_store_balances(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_ledger_account(uuid, public.ledger_account_kind, text, uuid, uuid, text) TO service_role;