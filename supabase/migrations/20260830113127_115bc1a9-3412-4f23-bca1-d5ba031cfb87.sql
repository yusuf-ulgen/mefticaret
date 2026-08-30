CREATE TYPE public.return_status AS ENUM ('requested','approved','rejected','received','refunded','cancelled');
CREATE TYPE public.return_reason AS ENUM ('damaged','wrong_item','not_as_described','size_fit','changed_mind','other');

CREATE TABLE public.return_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  return_number text NOT NULL,
  status public.return_status NOT NULL DEFAULT 'requested',
  reason public.return_reason NOT NULL DEFAULT 'other',
  customer_note text,
  staff_note text,
  refund_amount numeric NOT NULL DEFAULT 0,
  restock boolean NOT NULL DEFAULT true,
  currency text NOT NULL DEFAULT 'TRY',
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, return_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.return_requests TO authenticated;
GRANT SELECT ON public.return_requests TO anon;
GRANT ALL ON public.return_requests TO service_role;
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "returns_select_store" ON public.return_requests FOR SELECT TO authenticated
USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::public.app_role));
CREATE POLICY "returns_manage_store" ON public.return_requests FOR ALL TO authenticated
USING (app_private.can_manage_store(store_id, auth.uid()))
WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "returns_select_own_customer" ON public.return_requests FOR SELECT TO authenticated
USING (customer_id IN (SELECT c.id FROM public.customers c WHERE c.user_id = auth.uid()));
CREATE POLICY "returns_insert_own_customer" ON public.return_requests FOR INSERT TO authenticated
WITH CHECK (customer_id IN (SELECT c.id FROM public.customers c WHERE c.user_id = auth.uid()));

CREATE TABLE public.return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.return_requests(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  title text NOT NULL,
  variant_title text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.return_items TO authenticated;
GRANT SELECT ON public.return_items TO anon;
GRANT ALL ON public.return_items TO service_role;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "return_items_select_store" ON public.return_items FOR SELECT TO authenticated
USING (app_private.is_store_member(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::public.app_role));
CREATE POLICY "return_items_manage_store" ON public.return_items FOR ALL TO authenticated
USING (app_private.can_manage_store(store_id, auth.uid()))
WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "return_items_select_own_customer" ON public.return_items FOR SELECT TO authenticated
USING (return_id IN (SELECT r.id FROM public.return_requests r JOIN public.customers c ON c.id = r.customer_id WHERE c.user_id = auth.uid()));

CREATE INDEX idx_return_requests_store ON public.return_requests(store_id, created_at DESC);
CREATE INDEX idx_return_items_return ON public.return_items(return_id);

CREATE TRIGGER return_requests_set_updated_at BEFORE UPDATE ON public.return_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.notify_new_return()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.notifications (store_id, kind, title, message, entity, entity_id, meta)
  VALUES (NEW.store_id, 'order', 'Yeni iade talebi: ' || NEW.return_number,
          'Talep edilen tutar: ' || NEW.refund_amount || ' ' || NEW.currency,
          'return_request', NEW.id::text, jsonb_build_object('order_id', NEW.order_id));
  RETURN NEW;
END; $$;

CREATE TRIGGER return_requests_notify_new AFTER INSERT ON public.return_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_new_return();

CREATE OR REPLACE FUNCTION public.record_return_refund_ledger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'refunded' AND OLD.status <> 'refunded' AND COALESCE(NEW.refund_amount,0) > 0 THEN
    INSERT INTO public.ledger_entries (store_id, order_id, kind, direction, amount, currency, description, occurred_at, meta)
    VALUES (NEW.store_id, NEW.order_id, 'refund', 'debit', NEW.refund_amount, NEW.currency,
            'İade ' || NEW.return_number, now(), jsonb_build_object('return_id', NEW.id));
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER return_requests_record_refund AFTER UPDATE ON public.return_requests
FOR EACH ROW EXECUTE FUNCTION public.record_return_refund_ledger();