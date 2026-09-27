DROP POLICY "Store managers read custom categories" ON public.kolay_custom_categories;
DROP POLICY "Store managers add custom categories" ON public.kolay_custom_categories;
DROP POLICY "Store managers delete custom categories" ON public.kolay_custom_categories;
CREATE POLICY "Store managers read custom categories" ON public.kolay_custom_categories FOR SELECT TO authenticated USING (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "Store managers add custom categories" ON public.kolay_custom_categories FOR INSERT TO authenticated WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Store managers delete custom categories" ON public.kolay_custom_categories FOR DELETE TO authenticated USING (app_private.can_manage_store(store_id, auth.uid()));