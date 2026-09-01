ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

UPDATE public.customers
SET first_name = COALESCE(first_name, NULLIF(split_part(full_name, ' ', 1), '')),
    last_name = COALESCE(
      last_name,
      NULLIF(regexp_replace(full_name, '^\S+\s*', ''), '')
    ),
    last_activity_at = COALESCE(last_activity_at, updated_at, created_at);

CREATE OR REPLACE FUNCTION public.touch_customer_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    UPDATE public.customers c
    SET last_activity_at = GREATEST(COALESCE(c.last_activity_at, NEW.placed_at), NEW.placed_at),
        orders_count = (
          SELECT COUNT(*) FROM public.orders o
          WHERE o.customer_id = NEW.customer_id AND o.status <> 'cancelled'
        ),
        total_spent = (
          SELECT COALESCE(SUM(o.grand_total), 0) FROM public.orders o
          WHERE o.customer_id = NEW.customer_id AND o.status <> 'cancelled'
        )
    WHERE c.id = NEW.customer_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS orders_touch_customer ON public.orders;
CREATE TRIGGER orders_touch_customer
AFTER INSERT OR UPDATE OF status, grand_total ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.touch_customer_activity();

CREATE TABLE IF NOT EXISTS public.customer_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  color text NOT NULL DEFAULT 'slate',
  is_system boolean NOT NULL DEFAULT false,
  min_orders integer NOT NULL DEFAULT 0,
  min_spent numeric(14,2) NOT NULL DEFAULT 0,
  inactive_days integer,
  new_within_days integer,
  required_tags text[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_segments TO authenticated;
GRANT ALL ON public.customer_segments TO service_role;

ALTER TABLE public.customer_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store team can view segments"
ON public.customer_segments FOR SELECT TO authenticated
USING (app_private.is_store_member(store_id, auth.uid()));

CREATE POLICY "Store team can create segments"
ON public.customer_segments FOR INSERT TO authenticated
WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "Store team can update segments"
ON public.customer_segments FOR UPDATE TO authenticated
USING (app_private.can_manage_store(store_id, auth.uid()))
WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "Store team can delete segments"
ON public.customer_segments FOR DELETE TO authenticated
USING (app_private.can_manage_store(store_id, auth.uid()));

CREATE TRIGGER customer_segments_set_updated_at
BEFORE UPDATE ON public.customer_segments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS customer_segments_store_idx ON public.customer_segments (store_id, sort_order);
CREATE INDEX IF NOT EXISTS customers_activity_idx ON public.customers (store_id, last_activity_at DESC);