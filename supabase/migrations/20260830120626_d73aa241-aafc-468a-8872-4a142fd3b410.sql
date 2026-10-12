CREATE TABLE public.store_menu_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  location text NOT NULL DEFAULT 'header' CHECK (location IN ('header','footer')),
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'url' CHECK (kind IN ('home','collection','page','product','cart','account','url')),
  target text,
  position integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX store_menu_items_store_loc_idx ON public.store_menu_items (store_id, location, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_menu_items TO authenticated;
GRANT SELECT ON public.store_menu_items TO anon;
GRANT ALL ON public.store_menu_items TO service_role;

ALTER TABLE public.store_menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY store_menu_items_read ON public.store_menu_items FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));

CREATE POLICY store_menu_items_write ON public.store_menu_items FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY store_menu_items_select_public ON public.store_menu_items FOR SELECT TO anon
  USING (is_visible AND app_private.is_store_published(store_id));

CREATE TRIGGER store_menu_items_set_updated_at BEFORE UPDATE ON public.store_menu_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();