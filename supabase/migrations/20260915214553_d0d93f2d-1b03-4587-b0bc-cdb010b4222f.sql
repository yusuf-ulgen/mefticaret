alter table public.store_settings
  add column if not exists instagram_url text,
  add column if not exists facebook_url text;

insert into public.connectors (code, name, kind, description, supports_installments, supports_test_mode, sort_order)
values ('mefpay', 'Mefpay (Kredi/Banka Kartı)', 'payment', 'Mefticaret altyapısı üzerinden kartla güvenli tahsilat', true, true, 1)
on conflict (code) do update set name = excluded.name, description = excluded.description, is_active = true;