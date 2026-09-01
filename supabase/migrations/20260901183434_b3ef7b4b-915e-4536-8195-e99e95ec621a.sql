ALTER FUNCTION public.product_fts_text(text,text,text,text,text,text) SET search_path = public;
ALTER FUNCTION public.order_fts_text(text,text,text,text,text,text) SET search_path = public;
ALTER FUNCTION public.customer_fts_text(text,text,text) SET search_path = public;
ALTER FUNCTION public.page_fts_text(text,text,text,text) SET search_path = public;
REVOKE ALL ON FUNCTION public.enqueue_job(public.job_kind, jsonb, uuid, integer, timestamptz, integer, text) FROM authenticated;