CREATE OR REPLACE FUNCTION app_private.orders_split_to_suppliers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.payment_status = 'paid'
     AND (TG_OP = 'INSERT' OR OLD.payment_status IS DISTINCT FROM 'paid') THEN
    PERFORM app_private.split_order_to_suppliers(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;