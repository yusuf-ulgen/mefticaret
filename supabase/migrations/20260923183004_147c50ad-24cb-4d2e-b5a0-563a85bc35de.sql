ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_digital boolean NOT NULL DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_digital boolean NOT NULL DEFAULT false;

CREATE TABLE public.kolay_digital_assets (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  sub_type text NOT NULL CHECK (sub_type IN ('ebook','pattern','license','recipe','design')),
  file_path text,
  file_name text,
  access_url text CHECK (access_url IS NULL OR access_url ~* '^https://'),
  delivery_note text CHECK (delivery_note IS NULL OR length(delivery_note) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kolay_digital_assets TO authenticated;
GRANT ALL ON public.kolay_digital_assets TO service_role;
ALTER TABLE public.kolay_digital_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store managers manage digital assets" ON public.kolay_digital_assets
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid())
    AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.store_id = kolay_digital_assets.store_id));
CREATE INDEX kolay_digital_assets_store_idx ON public.kolay_digital_assets(store_id);

CREATE OR REPLACE FUNCTION public.kolay_digital_assets_touch() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER kolay_digital_assets_touch BEFORE UPDATE ON public.kolay_digital_assets
  FOR EACH ROW EXECUTE FUNCTION public.kolay_digital_assets_touch();

CREATE POLICY "Store managers upload digital files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'digital-assets' AND app_private.can_manage_store(((storage.foldername(name))[1])::uuid, auth.uid()));
CREATE POLICY "Store managers read digital files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'digital-assets' AND app_private.can_manage_store(((storage.foldername(name))[1])::uuid, auth.uid()));
CREATE POLICY "Store managers delete digital files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'digital-assets' AND app_private.can_manage_store(((storage.foldername(name))[1])::uuid, auth.uid()));