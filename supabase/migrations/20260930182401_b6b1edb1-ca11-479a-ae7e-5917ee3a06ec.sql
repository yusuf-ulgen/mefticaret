DROP POLICY IF EXISTS "Placeholders readable" ON public.policy_placeholders;
DROP POLICY IF EXISTS "Templates readable" ON public.policy_templates;
CREATE POLICY "Placeholders readable by store staff" ON public.policy_placeholders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.store_users su WHERE su.user_id = auth.uid()));
CREATE POLICY "Templates readable by store staff" ON public.policy_templates FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.store_users su WHERE su.user_id = auth.uid()));