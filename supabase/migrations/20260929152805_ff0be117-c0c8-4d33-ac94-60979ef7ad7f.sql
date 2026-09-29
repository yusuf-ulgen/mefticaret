DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['blog_settings','blog_comments','blog_post_revisions','blog_related_posts'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', CASE t WHEN 'blog_settings' THEN 'blog_settings manage' WHEN 'blog_comments' THEN 'blog_comments manage' WHEN 'blog_post_revisions' THEN 'blog_revisions manage' ELSE 'blog_related manage' END, t);
    EXECUTE format($p$CREATE POLICY "%s manage v2" ON public.%I FOR ALL TO authenticated
      USING (CASE WHEN store_id IS NULL THEN app_private.has_role(auth.uid(),'platform_admin'::app_role) ELSE app_private.can_manage_store(store_id, auth.uid()) END)
      WITH CHECK (CASE WHEN store_id IS NULL THEN app_private.has_role(auth.uid(),'platform_admin'::app_role) ELSE app_private.can_manage_store(store_id, auth.uid()) END)$p$, t, t);
  END LOOP;
END $$;
DROP POLICY IF EXISTS "blog_views read" ON public.blog_post_views;
CREATE POLICY "blog_views read v2" ON public.blog_post_views FOR SELECT TO authenticated
  USING (CASE WHEN store_id IS NULL THEN app_private.has_role(auth.uid(),'platform_admin'::app_role) ELSE app_private.can_manage_store(store_id, auth.uid()) END);
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);
DROP FUNCTION IF EXISTS public.can_manage_store(uuid, uuid);