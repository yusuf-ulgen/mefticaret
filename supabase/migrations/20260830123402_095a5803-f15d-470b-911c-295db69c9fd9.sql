DROP POLICY IF EXISTS "Visitors can create their own cart snapshot" ON public.abandoned_carts;
DROP POLICY IF EXISTS "Visitors can update their own cart snapshot" ON public.abandoned_carts;

REVOKE INSERT, UPDATE ON public.abandoned_carts FROM anon, authenticated;
GRANT ALL ON public.abandoned_carts TO service_role;