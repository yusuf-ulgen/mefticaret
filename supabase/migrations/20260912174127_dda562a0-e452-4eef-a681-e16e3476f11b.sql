with modules(metric_key, label, sort_order) as (
  values
    ('module_xml_feed', 'XML / CSV Entegratör', 101),
    ('module_migration', 'Mağaza Taşıma', 102),
    ('module_automation', 'Otomasyon Akışları', 103),
    ('module_omnichannel', 'Omni-Channel Mesajlaşma', 104),
    ('module_ai', 'AI Stüdyo', 105),
    ('module_multi_language', 'Çoklu Dil & Çeviri', 106),
    ('module_advanced_analytics', 'İleri Analitik', 107),
    ('module_marketplace', 'Pazaryeri Operasyonu', 108),
    ('module_mobile_app', 'Mobil Uygulama', 109),
    ('module_multi_currency', 'Marketler & Çoklu Para Birimi', 110),
    ('module_api', 'API & Webhook', 111)
)
insert into public.plan_features (plan_id, metric_key, label, unit, limit_value, is_enabled, sort_order)
select
  p.id,
  m.metric_key,
  m.label,
  'modül',
  null,
  case p.code
    when 'free' then false
    when 'starter' then m.metric_key in ('module_xml_feed', 'module_migration')
    when 'professional' then m.metric_key in (
      'module_xml_feed', 'module_migration', 'module_automation', 'module_omnichannel',
      'module_ai', 'module_multi_language', 'module_advanced_analytics'
    )
    else true
  end,
  m.sort_order
from public.plans p
cross join modules m
on conflict (plan_id, metric_key) do nothing;