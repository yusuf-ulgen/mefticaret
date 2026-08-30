CREATE POLICY "Customers can read own record" ON public.customers FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Customers can update own profile" ON public.customers FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Customers manage own addresses" ON public.customer_addresses FOR ALL TO authenticated USING (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())) WITH CHECK (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));

CREATE POLICY "Customers read own orders" ON public.orders FOR SELECT TO authenticated USING (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));

CREATE POLICY "Customers read own order items" ON public.order_items FOR SELECT TO authenticated USING (order_id IN (SELECT o.id FROM public.orders o JOIN public.customers c ON c.id = o.customer_id WHERE c.user_id = auth.uid()));

CREATE POLICY "Customers read own order events" ON public.order_events FOR SELECT TO authenticated USING (order_id IN (SELECT o.id FROM public.orders o JOIN public.customers c ON c.id = o.customer_id WHERE c.user_id = auth.uid()));