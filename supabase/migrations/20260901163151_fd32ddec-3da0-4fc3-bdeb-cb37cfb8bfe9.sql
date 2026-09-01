CREATE OR REPLACE FUNCTION public.record_order_ledger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rate numeric := 0.02;
  store_acc uuid;
  platform_acc uuid;
BEGIN
  SELECT COALESCE(p.commission_rate, 0.02) INTO rate
  FROM public.stores s LEFT JOIN public.plans p ON p.id = s.plan_id
  WHERE s.id = NEW.store_id;

  store_acc := public.ensure_ledger_account(NEW.store_id, 'store', NEW.currency);
  platform_acc := public.ensure_ledger_account(NEW.store_id, 'platform', NEW.currency);

  INSERT INTO public.ledger_entries (store_id, order_id, kind, direction, amount, currency, description, occurred_at, account_id, counter_account_id, customer_id, status)
  VALUES (NEW.store_id, NEW.id, 'sale', 'credit', COALESCE(NEW.subtotal,0), NEW.currency,
          'Sipariş ' || NEW.order_number || ' ürün tutarı', NEW.placed_at, store_acc, NULL, NEW.customer_id, 'posted');

  IF COALESCE(NEW.shipping_total,0) > 0 THEN
    INSERT INTO public.ledger_entries (store_id, order_id, kind, direction, amount, currency, description, occurred_at, account_id, customer_id, status)
    VALUES (NEW.store_id, NEW.id, 'shipping', 'credit', NEW.shipping_total, NEW.currency,
            'Sipariş ' || NEW.order_number || ' kargo bedeli', NEW.placed_at, store_acc, NEW.customer_id, 'posted');
  END IF;

  IF COALESCE(NEW.discount_total,0) > 0 THEN
    INSERT INTO public.ledger_entries (store_id, order_id, kind, direction, amount, currency, description, occurred_at, account_id, customer_id, status)
    VALUES (NEW.store_id, NEW.id, 'discount', 'debit', NEW.discount_total, NEW.currency,
            'Sipariş ' || NEW.order_number || ' indirim', NEW.placed_at, store_acc, NEW.customer_id, 'posted');
  END IF;

  INSERT INTO public.ledger_entries (store_id, order_id, kind, direction, amount, currency, description, occurred_at, meta, account_id, counter_account_id, status)
  VALUES (NEW.store_id, NEW.id, 'platform_fee', 'debit', ROUND(COALESCE(NEW.grand_total,0) * rate, 2), NEW.currency,
          'Platform komisyonu', NEW.placed_at, jsonb_build_object('rate', rate), platform_acc, store_acc, 'posted');

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_return_refund_ledger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  store_acc uuid;
BEGIN
  IF NEW.status = 'refunded' AND OLD.status <> 'refunded' AND COALESCE(NEW.refund_amount,0) > 0 THEN
    store_acc := public.ensure_ledger_account(NEW.store_id, 'store', NEW.currency);
    INSERT INTO public.ledger_entries (store_id, order_id, kind, direction, amount, currency, description, occurred_at, meta, account_id, status)
    VALUES (NEW.store_id, NEW.order_id, 'refund', 'debit', NEW.refund_amount, NEW.currency,
            'İade ' || NEW.return_number, now(), jsonb_build_object('return_id', NEW.id), store_acc, 'posted');
  END IF;
  RETURN NEW;
END; $function$;