insert into public.plan_features (plan_id, metric_key, label, unit, limit_value, is_enabled, sort_order)
select f.plan_id, m.metric_key, m.label, 'modül', null, f.is_enabled, m.sort_order
from public.plan_features f
cross join (values
  ('module_product_feeds', 'Ürün Akışları', 101),
  ('module_xml_integrator', 'XML Entegratör', 112)
) as m(metric_key, label, sort_order)
where f.metric_key = 'module_xml_feed'
on conflict (plan_id, metric_key) do nothing;

delete from public.plan_features where metric_key = 'module_xml_feed';