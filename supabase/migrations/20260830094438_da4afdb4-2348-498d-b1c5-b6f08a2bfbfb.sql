CREATE TYPE public.review_status AS ENUM ('pending', 'published', 'rejected');

ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'review';

CREATE TABLE public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text,
  body text,
  is_verified_purchase boolean NOT NULL DEFAULT false,
  status public.review_status NOT NULL DEFAULT 'pending',
  reply text,
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX product_reviews_product_idx ON public.product_reviews (product_id, status);
CREATE INDEX product_reviews_store_idx ON public.product_reviews (store_id, created_at DESC);
CREATE UNIQUE INDEX product_reviews_user_product_idx ON public.product_reviews (product_id, user_id) WHERE user_id IS NOT NULL;

GRANT SELECT ON public.product_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_reviews TO authenticated;
GRANT ALL ON public.product_reviews TO service_role;

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published reviews of published stores"
ON public.product_reviews FOR SELECT TO anon, authenticated
USING (
  status = 'published'
  AND EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = product_reviews.store_id
      AND s.status = 'active'
      AND s.published_at IS NOT NULL
  )
);

CREATE POLICY "Customers can read their own reviews"
ON public.product_reviews FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Customers can create their own reviews"
ON public.product_reviews FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Customers can delete their pending reviews"
ON public.product_reviews FOR DELETE TO authenticated
USING (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Store members can read store reviews"
ON public.product_reviews FOR SELECT TO authenticated
USING (app_private.is_store_member(store_id, auth.uid()));

CREATE POLICY "Store managers can moderate reviews"
ON public.product_reviews FOR UPDATE TO authenticated
USING (app_private.can_manage_store(store_id, auth.uid()))
WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "Store managers can delete reviews"
ON public.product_reviews FOR DELETE TO authenticated
USING (app_private.can_manage_store(store_id, auth.uid()));

CREATE TRIGGER product_reviews_set_updated_at
BEFORE UPDATE ON public.product_reviews
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.notify_new_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (store_id, kind, title, message, entity, entity_id, meta)
  VALUES (NEW.store_id, 'review', 'Yeni ürün yorumu',
          NEW.author_name || ' — ' || NEW.rating || ' yıldız',
          'product_review', NEW.id::text, jsonb_build_object('rating', NEW.rating, 'product_id', NEW.product_id));
  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.notify_new_review() FROM anon, authenticated;

CREATE TRIGGER product_reviews_notify_new
AFTER INSERT ON public.product_reviews
FOR EACH ROW EXECUTE FUNCTION public.notify_new_review();