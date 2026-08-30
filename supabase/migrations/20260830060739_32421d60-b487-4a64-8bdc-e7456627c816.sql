CREATE TABLE public.abandoned_carts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  cart_token text NOT NULL,
  customer_email text,
  customer_name text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  item_count integer NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  recovered_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, cart_token)
);

GRANT SELECT, DELETE ON public.abandoned_carts TO authenticated;
GRANT INSERT, UPDATE ON public.abandoned_carts TO anon, authenticated;
GRANT ALL ON public.abandoned_carts TO service_role;

ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store members can view abandoned carts"
  ON public.abandoned_carts FOR SELECT TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "Store members can delete abandoned carts"
  ON public.abandoned_carts FOR DELETE TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "Visitors can create their own cart snapshot"
  ON public.abandoned_carts FOR INSERT TO anon, authenticated
  WITH CHECK (cart_token IS NOT NULL AND length(cart_token) BETWEEN 16 AND 128);

CREATE POLICY "Visitors can update their own cart snapshot"
  ON public.abandoned_carts FOR UPDATE TO anon, authenticated
  USING (cart_token IS NOT NULL)
  WITH CHECK (cart_token IS NOT NULL AND length(cart_token) BETWEEN 16 AND 128);

CREATE TRIGGER abandoned_carts_set_updated_at
  BEFORE UPDATE ON public.abandoned_carts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();