REVOKE ALL ON FUNCTION public.publish_due_blog_posts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_due_blog_posts() TO service_role;