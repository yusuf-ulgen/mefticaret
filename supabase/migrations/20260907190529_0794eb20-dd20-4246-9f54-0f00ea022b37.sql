alter table public.invoices add column if not exists pay_token text;
update public.invoices set pay_token = encode(gen_random_bytes(16), 'hex') where pay_token is null;
create unique index if not exists invoices_pay_token_key on public.invoices (pay_token);
alter table public.invoices alter column pay_token set default encode(gen_random_bytes(16), 'hex');
alter table public.invoices alter column pay_token set not null;

alter table public.subscriptions add column if not exists past_due_since timestamptz;
alter table public.subscriptions add column if not exists frozen_at timestamptz;

create table if not exists public.billing_reminders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete cascade,
  kind text not null,
  channel text not null default 'panel',
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now()
);

create unique index if not exists billing_reminders_invoice_kind_key
  on public.billing_reminders (invoice_id, kind) where invoice_id is not null;
create index if not exists billing_reminders_store_idx on public.billing_reminders (store_id, sent_at desc);

grant select on public.billing_reminders to authenticated;
grant all on public.billing_reminders to service_role;
alter table public.billing_reminders enable row level security;

drop policy if exists billing_reminders_read on public.billing_reminders;
create policy billing_reminders_read on public.billing_reminders
  for select to authenticated
  using (app_private.can_manage_store(store_id, auth.uid()));

comment on table public.billing_reminders is 'Abonelik yenileme hatırlatıcıları ve kademeli kısıtlama olay kayıtları. Yazma yalnızca sunucu (service_role) tarafından yapılır.';
comment on column public.invoices.pay_token is 'Faturaya özel ödeme linki jetonu (/fatura/<token>).';