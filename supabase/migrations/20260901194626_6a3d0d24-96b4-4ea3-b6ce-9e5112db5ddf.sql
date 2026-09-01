REVOKE ALL ON FUNCTION public.seed_demo_store(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_theme_version(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_theme_version(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.seed_demo_store(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.publish_theme_version(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_theme_version(uuid) TO authenticated, service_role;