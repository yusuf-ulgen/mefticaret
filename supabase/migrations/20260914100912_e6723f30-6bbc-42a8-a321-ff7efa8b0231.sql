-- 1) Denetim kayıtları artık istemciden eklenemez (yalnızca service-role).
drop policy if exists "audit_insert_self" on public.audit_logs;
revoke insert on public.audit_logs from authenticated;
revoke insert on public.audit_logs from anon;

-- 2) Taslak ürün görselleri anonim okunamaz.
create or replace function app_private.is_public_product_asset(_store_id uuid, _product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select exists (
    select 1
    from public.products p
    join public.stores s on s.id = p.store_id
    where p.id = _product_id
      and p.store_id = _store_id
      and p.status = 'active'::product_status
      and s.status = 'active'::store_status
  )
$$;

grant execute on function app_private.is_public_product_asset(uuid, uuid) to anon, authenticated, service_role;

drop policy if exists "store_media_read" on storage.objects;

create policy "store_media_read" on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'store-media'
  and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  and (
    (auth.uid() is not null and app_private.can_manage_store(((storage.foldername(name))[1])::uuid, auth.uid()))
    or (
      (storage.foldername(name))[2] = 'products'
      and (storage.foldername(name))[3] ~ '^[0-9a-fA-F-]{36}$'
      and app_private.is_public_product_asset(
        ((storage.foldername(name))[1])::uuid,
        ((storage.foldername(name))[3])::uuid
      )
    )
  )
);