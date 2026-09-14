ALTER TABLE public.ledger_entries DISABLE TRIGGER USER;
DELETE FROM public.ledger_entries WHERE store_id IN (SELECT id FROM public.stores WHERE is_demo = true);
DELETE FROM public.stores WHERE is_demo = true;
ALTER TABLE public.ledger_entries ENABLE TRIGGER USER;