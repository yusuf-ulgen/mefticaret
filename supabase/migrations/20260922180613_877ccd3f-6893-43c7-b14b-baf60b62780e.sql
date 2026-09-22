CREATE TABLE public.xml_product_hashes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  feed_id UUID NOT NULL REFERENCES public.xml_feeds(id) ON DELETE CASCADE,
  product_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (feed_id, product_key)
);

CREATE INDEX xml_product_hashes_store_idx ON public.xml_product_hashes (store_id);

GRANT SELECT ON public.xml_product_hashes TO authenticated;
GRANT ALL ON public.xml_product_hashes TO service_role;
ALTER TABLE public.xml_product_hashes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "xml_product_hashes_read" ON public.xml_product_hashes
  FOR SELECT TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'::app_role));

CREATE TRIGGER xml_product_hashes_touch
  BEFORE UPDATE ON public.xml_product_hashes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.xml_feeds
  ADD COLUMN IF NOT EXISTS last_full_sync_at TIMESTAMPTZ;