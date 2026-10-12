-- Satıcılar kendi başvurularını onaylayamaz, komisyon oranını değiştiremez.
create or replace function app_private.guard_marketplace_seller_update()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  if app_private.can_manage_store(new.store_id, auth.uid())
     or app_private.has_role(auth.uid(), 'platform_admin'::app_role) then
    return new;
  end if;
  if new.status is distinct from old.status
     or new.commission_rate is distinct from old.commission_rate
     or new.approved_at is distinct from old.approved_at
     or new.suspended_at is distinct from old.suspended_at
     or new.rejection_reason is distinct from old.rejection_reason
     or new.store_id is distinct from old.store_id
     or new.user_id is distinct from old.user_id then
    raise exception 'Satıcı bu alanları kendisi değiştiremez';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_marketplace_seller_update on public.marketplace_sellers;
create trigger guard_marketplace_seller_update
before update on public.marketplace_sellers
for each row execute function app_private.guard_marketplace_seller_update();

drop policy if exists "Sellers and managers update" on public.marketplace_sellers;

create policy "Managers update sellers"
on public.marketplace_sellers
for update
to authenticated
using (app_private.can_manage_store(store_id, auth.uid()))
with check (app_private.can_manage_store(store_id, auth.uid()));

create policy "Sellers update own profile fields"
on public.marketplace_sellers
for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and status = (select s.status from public.marketplace_sellers s where s.id = marketplace_sellers.id)
  and commission_rate = (select s.commission_rate from public.marketplace_sellers s where s.id = marketplace_sellers.id)
  and approved_at is not distinct from (select s.approved_at from public.marketplace_sellers s where s.id = marketplace_sellers.id)
  and rejection_reason is not distinct from (select s.rejection_reason from public.marketplace_sellers s where s.id = marketplace_sellers.id)
);

-- Müşteriler iade talebinde yalnızca kendi notunu güncelleyebilir.
create or replace function app_private.guard_return_request_update()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  if app_private.can_manage_store(new.store_id, auth.uid())
     or app_private.has_role(auth.uid(), 'platform_admin'::app_role) then
    return new;
  end if;
  if new.status is distinct from old.status
     or new.refund_amount is distinct from old.refund_amount
     or new.restock is distinct from old.restock
     or new.staff_note is distinct from old.staff_note
     or new.resolved_at is distinct from old.resolved_at
     or new.store_id is distinct from old.store_id
     or new.order_id is distinct from old.order_id
     or new.customer_id is distinct from old.customer_id
     or new.currency is distinct from old.currency then
    raise exception 'Müşteri bu alanları değiştiremez';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_return_request_update on public.return_requests;
create trigger guard_return_request_update
before update on public.return_requests
for each row execute function app_private.guard_return_request_update();

drop policy if exists "returns_update_own_customer" on public.return_requests;

create policy "returns_update_own_customer"
on public.return_requests
for update
to authenticated
using (
  status = 'requested'::return_status
  and customer_id in (select c.id from public.customers c where c.user_id = auth.uid())
)
with check (
  customer_id in (select c.id from public.customers c where c.user_id = auth.uid())
  and status = 'requested'::return_status
  and refund_amount is not distinct from (select r.refund_amount from public.return_requests r where r.id = return_requests.id)
  and restock is not distinct from (select r.restock from public.return_requests r where r.id = return_requests.id)
  and staff_note is not distinct from (select r.staff_note from public.return_requests r where r.id = return_requests.id)
);