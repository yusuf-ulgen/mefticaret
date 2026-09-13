create or replace function app_private.seller_privileged_unchanged(_id uuid, _status seller_status, _commission numeric, _iban text, _approved_at timestamptz, _suspended_at timestamptz, _rejection text, _store_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select exists (
    select 1 from public.marketplace_sellers s
    where s.id = _id
      and s.status is not distinct from _status
      and s.commission_rate is not distinct from _commission
      and s.iban is not distinct from _iban
      and s.approved_at is not distinct from _approved_at
      and s.suspended_at is not distinct from _suspended_at
      and s.rejection_reason is not distinct from _rejection
      and s.store_id is not distinct from _store_id
      and s.user_id is not distinct from _user_id
  )
$$;

revoke all on function app_private.seller_privileged_unchanged(uuid, seller_status, numeric, text, timestamptz, timestamptz, text, uuid, uuid) from public;
grant execute on function app_private.seller_privileged_unchanged(uuid, seller_status, numeric, text, timestamptz, timestamptz, text, uuid, uuid) to authenticated, service_role;

drop policy if exists "Sellers update own profile fields" on public.marketplace_sellers;

create policy "Sellers update own profile fields"
on public.marketplace_sellers
for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and app_private.seller_privileged_unchanged(id, status, commission_rate, iban, approved_at, suspended_at, rejection_reason, store_id, user_id)
);