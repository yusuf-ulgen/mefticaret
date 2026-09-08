create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  provider text not null default 'odeal',
  environment text not null default 'sandbox',
  external_id text not null unique,
  provider_payment_id text,
  unique_key text,
  status text not null default 'PENDING',
  amount numeric(14,2) not null,
  currency text not null default 'TRY',
  checkout_url text,
  reason text,
  raw_callback jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoice_payments_invoice_idx on public.invoice_payments(invoice_id);
create index if not exists invoice_payments_provider_payment_idx on public.invoice_payments(provider_payment_id);

grant select on public.invoice_payments to authenticated;
grant all on public.invoice_payments to service_role;

alter table public.invoice_payments enable row level security;

drop policy if exists "invoice_payments_store_read" on public.invoice_payments;
create policy "invoice_payments_store_read"
on public.invoice_payments
for select
to authenticated
using (app_private.can_manage_store(store_id, auth.uid()));
