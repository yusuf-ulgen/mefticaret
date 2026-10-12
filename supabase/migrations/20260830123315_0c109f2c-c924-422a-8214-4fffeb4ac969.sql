DROP POLICY IF EXISTS "Storefront can read shipments" ON public.shipments;
DROP POLICY IF EXISTS "Storefront can read shipment items" ON public.shipment_items;

REVOKE SELECT ON public.shipments FROM anon;
REVOKE SELECT ON public.shipment_items FROM anon;