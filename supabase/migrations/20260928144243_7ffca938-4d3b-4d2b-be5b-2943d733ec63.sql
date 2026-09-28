insert into public.store_payment_methods (store_id, connector_id, display_name, instructions, is_active, installments_enabled)
select i.store_id, c.id,
  case c.code when 'iyzico' then 'Kredi / banka kartı (iyzico)' else 'Kredi / banka kartı (PayTR)' end,
  'Sipariş sonrası güvenli ödeme sayfasında kartınızla ödeyin.', true, true
from public.app_installations i
join public.apps a on a.id = i.app_id
join public.connectors c on c.code = case a.code when 'iyzico-pay' then 'iyzico' when 'paytr-pay' then 'paytr' end
where i.status = 'installed'
  and not exists (select 1 from public.store_payment_methods m where m.store_id = i.store_id and m.connector_id = c.id);