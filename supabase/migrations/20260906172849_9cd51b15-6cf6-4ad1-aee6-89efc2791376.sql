-- 1) Site Kit: anonim ziyaretçiler yalnızca herkese açık kolonları okusun
revoke select on public.store_site_kit from anon;
grant select (id, store_id, provider, is_enabled, public_config, created_at, updated_at)
  on public.store_site_kit to anon;
revoke select (secret_config) on public.store_site_kit from anon, authenticated;
grant select (secret_config) on public.store_site_kit to service_role;

-- 2) Webhook imza anahtarı: yalnızca mağaza yöneticileri okuyabilsin
drop policy if exists "store_webhooks_read" on public.store_webhooks;
create policy "store_webhooks_manager_read"
  on public.store_webhooks
  for select
  to authenticated
  using (app_private.can_manage_store(store_id, auth.uid()));

-- 3) API anahtarı özetleri: yalnızca mağaza yöneticileri okuyabilsin
drop policy if exists "api_keys_member_read" on public.api_keys;