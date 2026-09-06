insert into public.product_collections (product_id, collection_id)
select p.id, c.id
from public.products p
join public.collections c on c.store_id = p.store_id
where p.store_id = 'a4f1c2d8-9b3e-4c17-8f6a-2b5d7e9c1043'
  and (c.slug = 'yeni-gelenler' or (c.slug = 'indirimdekiler' and p.compare_at_price > p.base_price))
on conflict do nothing;