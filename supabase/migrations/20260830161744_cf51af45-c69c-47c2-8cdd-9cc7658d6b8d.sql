ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'question';

CREATE TABLE public.product_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  question text NOT NULL,
  answer text,
  answered_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX product_questions_product_idx ON public.product_questions (product_id, status);
CREATE INDEX product_questions_store_idx ON public.product_questions (store_id, created_at DESC);

GRANT SELECT ON public.product_questions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_questions TO authenticated;
GRANT ALL ON public.product_questions TO service_role;

ALTER TABLE public.product_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published questions of published stores"
ON public.product_questions FOR SELECT TO anon, authenticated
USING (
  status = 'published'
  AND EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = product_questions.store_id
      AND s.status = 'active'
      AND s.published_at IS NOT NULL
  )
);

CREATE POLICY "Customers can read their own questions"
ON public.product_questions FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Customers can ask questions"
ON public.product_questions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Customers can delete their pending questions"
ON public.product_questions FOR DELETE TO authenticated
USING (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Store members can read store questions"
ON public.product_questions FOR SELECT TO authenticated
USING (app_private.is_store_member(store_id, auth.uid()));

CREATE POLICY "Store managers can moderate questions"
ON public.product_questions FOR UPDATE TO authenticated
USING (app_private.can_manage_store(store_id, auth.uid()))
WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "Store managers can delete questions"
ON public.product_questions FOR DELETE TO authenticated
USING (app_private.can_manage_store(store_id, auth.uid()));

CREATE TRIGGER product_questions_set_updated_at
BEFORE UPDATE ON public.product_questions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.notify_new_question()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (store_id, kind, title, message, entity, entity_id, meta)
  VALUES (
    NEW.store_id,
    'question',
    'Yeni ürün sorusu',
    NEW.author_name || ' bir soru sordu: ' || left(NEW.question, 120),
    'product_questions',
    NEW.id,
    jsonb_build_object('product_id', NEW.product_id)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER product_questions_notify
AFTER INSERT ON public.product_questions
FOR EACH ROW EXECUTE FUNCTION public.notify_new_question();