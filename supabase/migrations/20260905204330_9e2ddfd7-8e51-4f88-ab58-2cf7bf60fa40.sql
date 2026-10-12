-- 1) blog_authors: e-posta artık anonim okumaya kapalı, herkese açık okuma yayınlanmış mağazalara sınırlı
DROP POLICY IF EXISTS "blog_authors_public_read" ON public.blog_authors;
REVOKE SELECT ON public.blog_authors FROM anon;
GRANT SELECT (id, store_id, name, slug, title, bio, avatar_url, created_at, updated_at) ON public.blog_authors TO anon;
CREATE POLICY "blog_authors_public_read" ON public.blog_authors
  FOR SELECT TO anon USING (app_private.is_store_published(store_id));

-- 2) blog_categories
DROP POLICY IF EXISTS "blog_categories_public_read" ON public.blog_categories;
CREATE POLICY "blog_categories_public_read" ON public.blog_categories
  FOR SELECT TO anon USING (app_private.is_store_published(store_id));

-- 3) blog_tags
DROP POLICY IF EXISTS "blog_tags_public_read" ON public.blog_tags;
CREATE POLICY "blog_tags_public_read" ON public.blog_tags
  FOR SELECT TO anon USING (app_private.is_store_published(store_id));

-- 4) store_page_tags
DROP POLICY IF EXISTS "store_page_tags_public_read" ON public.store_page_tags;
CREATE POLICY "store_page_tags_public_read" ON public.store_page_tags
  FOR SELECT TO anon USING (app_private.is_store_published(store_id));