-- Recover legacy ownership only when an exact order/line commission has one owner.
-- Never infer ownership from an order header or expose all lines to its suppliers.
INSERT INTO public.order_item_suppliers(order_item_id, supplier_id, order_id, store_id, source)
SELECT i.id, min(c.supplier_id::text)::uuid, i.order_id, i.store_id, 'commission_history_recovery'
FROM public.order_items i
JOIN public.supplier_commission_entries c ON c.order_item_id = i.id AND c.order_id = i.order_id
WHERE NOT EXISTS (SELECT 1 FROM public.order_item_suppliers x WHERE x.order_item_id = i.id)
GROUP BY i.id, i.order_id, i.store_id
HAVING count(DISTINCT c.supplier_id) = 1
ON CONFLICT DO NOTHING;
