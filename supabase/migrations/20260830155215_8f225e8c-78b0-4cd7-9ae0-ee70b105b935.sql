CREATE OR REPLACE FUNCTION public.notify_stock_alerts_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  waiting integer := 0;
BEGIN
  IF NEW.stock > 0 AND COALESCE(OLD.stock, 0) <= 0 THEN
    SELECT COUNT(*) INTO waiting
    FROM public.stock_alerts sa
    WHERE sa.product_id = NEW.product_id
      AND sa.notified_at IS NULL;

    IF waiting > 0 THEN
      INSERT INTO public.notifications (store_id, kind, title, message, entity, entity_id, meta)
      VALUES (NEW.store_id, 'inventory', 'Stok bildirimi hazır: ' || NEW.title,
              waiting || ' müşteri bu ürün için haber bekliyor', 'variant', NEW.id::text,
              jsonb_build_object('waiting', waiting, 'product_id', NEW.product_id, 'stock', NEW.stock));
    END IF;
  END IF;
  RETURN NEW;
END; $function$;

CREATE TRIGGER product_variants_notify_stock_alerts
AFTER UPDATE ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.notify_stock_alerts_ready();