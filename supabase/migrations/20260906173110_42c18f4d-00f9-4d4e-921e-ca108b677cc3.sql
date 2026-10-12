grant select on public.store_site_kit to anon;
revoke select (secret_config) on public.store_site_kit from anon;
notify pgrst, 'reload schema';