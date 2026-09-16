alter table public.store_settings
  add column if not exists daily_order_limit integer,
  add column if not exists trust_badges text[] not null default '{}',
  add column if not exists gallery jsonb not null default '[]'::jsonb,
  add column if not exists delivery_methods text[] not null default array['shipping']::text[],
  add column if not exists cold_pack_enabled boolean not null default false,
  add column if not exists cold_pack_fee numeric(12,2) not null default 0,
  add column if not exists voice_alerts boolean not null default false;

alter table public.products
  add column if not exists made_to_order boolean not null default false,
  add column if not exists prep_days integer not null default 0,
  add column if not exists custom_note_enabled boolean not null default false,
  add column if not exists custom_note_label text;

create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'TRY',
  status text not null default 'pending' check (status in ('pending','approved','paid','rejected')),
  iban text,
  account_holder text,
  requested_by uuid,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payout_requests_store_idx on public.payout_requests (store_id, created_at desc);

grant select on public.payout_requests to authenticated;
grant all on public.payout_requests to service_role;

alter table public.payout_requests enable row level security;

drop policy if exists payout_requests_select on public.payout_requests;
create policy payout_requests_select on public.payout_requests
  for select to authenticated
  using (
    app_private.is_store_member(store_id, auth.uid())
    or app_private.has_role(auth.uid(), 'platform_admin'::app_role)
  );

drop policy if exists payout_requests_admin_manage on public.payout_requests;
create policy payout_requests_admin_manage on public.payout_requests
  for all to authenticated
  using (app_private.has_role(auth.uid(), 'platform_admin'::app_role))
  with check (app_private.has_role(auth.uid(), 'platform_admin'::app_role));

drop trigger if exists payout_requests_touch on public.payout_requests;
create trigger payout_requests_touch before update on public.payout_requests
  for each row execute function public.set_updated_at();