CREATE TABLE public.kolay_custom_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  main_name text NOT NULL CHECK (char_length(main_name) BETWEEN 2 AND 60),
  sub_name text NOT NULL CHECK (char_length(sub_name) BETWEEN 2 AND 60),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, main_name, sub_name)
);
GRANT SELECT, INSERT, DELETE ON public.kolay_custom_categories TO authenticated;
GRANT ALL ON public.kolay_custom_categories TO service_role;
ALTER TABLE public.kolay_custom_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store managers read custom categories" ON public.kolay_custom_categories FOR SELECT TO authenticated USING (app_private.can_manage_store(auth.uid(), store_id));
CREATE POLICY "Store managers add custom categories" ON public.kolay_custom_categories FOR INSERT TO authenticated WITH CHECK (app_private.can_manage_store(auth.uid(), store_id) AND created_by = auth.uid());
CREATE POLICY "Store managers delete custom categories" ON public.kolay_custom_categories FOR DELETE TO authenticated USING (app_private.can_manage_store(auth.uid(), store_id));