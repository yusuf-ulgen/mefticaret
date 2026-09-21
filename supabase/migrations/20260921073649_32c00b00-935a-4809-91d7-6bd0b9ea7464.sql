DROP POLICY IF EXISTS "pickup_locations_public_read" ON public.pickup_locations;

CREATE POLICY "pickup_locations_public_read"
ON public.pickup_locations
FOR SELECT
TO anon
USING (
  is_active
  AND app_private.is_store_published(store_id)
);