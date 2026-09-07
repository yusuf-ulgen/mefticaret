-- Anonim (oturumsuz) erişimden iç kimlik kolonlarını kaldır.
REVOKE SELECT ON public.product_reviews FROM anon;
GRANT SELECT (id, store_id, product_id, author_name, rating, title, body, is_verified_purchase, status, reply, replied_at, created_at, updated_at)
  ON public.product_reviews TO anon;

REVOKE SELECT ON public.product_questions FROM anon;
GRANT SELECT (id, store_id, product_id, author_name, question, answer, answered_at, status, created_at, updated_at)
  ON public.product_questions TO anon;
