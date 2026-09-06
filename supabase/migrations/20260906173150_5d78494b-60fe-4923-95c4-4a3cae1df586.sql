revoke select on public.store_site_kit from anon;
grant select (id, store_id, provider, is_enabled, public_config, created_at, updated_at)
  on public.store_site_kit to anon;
notify pgrst, 'reload schema';