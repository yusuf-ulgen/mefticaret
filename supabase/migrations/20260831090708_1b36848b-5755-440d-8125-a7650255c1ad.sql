-- Fix swapped argument order in RLS policies (function signature is (_store_id, _user_id))

DROP POLICY IF EXISTS "Store members read purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Store managers insert purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Store managers update purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Store managers delete draft purchase orders" ON public.purchase_orders;

CREATE POLICY "Store members read purchase orders" ON public.purchase_orders
  FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));

CREATE POLICY "Store managers insert purchase orders" ON public.purchase_orders
  FOR INSERT TO authenticated
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "Store managers update purchase orders" ON public.purchase_orders
  FOR UPDATE TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "Store managers delete draft purchase orders" ON public.purchase_orders
  FOR DELETE TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) AND status = 'draft');

DROP POLICY IF EXISTS "Store members read purchase order items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Store managers insert purchase order items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Store managers update purchase order items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Store managers delete purchase order items" ON public.purchase_order_items;

CREATE POLICY "Store members read purchase order items" ON public.purchase_order_items
  FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));

CREATE POLICY "Store managers insert purchase order items" ON public.purchase_order_items
  FOR INSERT TO authenticated
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "Store managers update purchase order items" ON public.purchase_order_items
  FOR UPDATE TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "Store managers delete purchase order items" ON public.purchase_order_items
  FOR DELETE TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()));

DROP POLICY IF EXISTS "Store members read suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Store managers insert suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Store managers update suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Store managers delete suppliers" ON public.suppliers;

CREATE POLICY "Store members read suppliers" ON public.suppliers
  FOR SELECT TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()));

CREATE POLICY "Store managers insert suppliers" ON public.suppliers
  FOR INSERT TO authenticated
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "Store managers update suppliers" ON public.suppliers
  FOR UPDATE TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "Store managers delete suppliers" ON public.suppliers
  FOR DELETE TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()));