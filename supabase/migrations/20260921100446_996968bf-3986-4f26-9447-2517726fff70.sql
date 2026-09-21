CREATE OR REPLACE FUNCTION public.ledger_entries_block_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.stores s WHERE s.id = OLD.store_id AND s.is_test) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Finans defteri kayıtları silinemez; ters kayıt (reversal) oluşturun';
END; $function$;

CREATE OR REPLACE FUNCTION public.ledger_entries_guard_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.stores s WHERE s.id = OLD.store_id AND s.is_test) THEN
    RETURN NEW;
  END IF;

  IF NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.direction IS DISTINCT FROM OLD.direction
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.occurred_at IS DISTINCT FROM OLD.occurred_at
     OR NEW.store_id IS DISTINCT FROM OLD.store_id
     OR NEW.order_id IS DISTINCT FROM OLD.order_id
     OR (OLD.account_id IS NOT NULL AND NEW.account_id IS DISTINCT FROM OLD.account_id)
     OR (OLD.counter_account_id IS NOT NULL AND NEW.counter_account_id IS DISTINCT FROM OLD.counter_account_id)
     OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
     OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.reverses_entry_id IS DISTINCT FROM OLD.reverses_entry_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Finans defteri kaydının finansal alanları değiştirilemez';
  END IF;

  IF OLD.status IN ('posted','cancelled','failed') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Kesinleşmiş kaydın durumu değiştirilemez';
  END IF;

  RETURN NEW;
END; $function$;