insert into public.plan_features (plan_id, metric_key, label, unit, limit_value, is_enabled, sort_order)
select p.id, 'module_notification_v2', 'Müşteri Bildirimleri v2', 'modül', null, true, 130
from public.plans p
on conflict (plan_id, metric_key) do nothing;