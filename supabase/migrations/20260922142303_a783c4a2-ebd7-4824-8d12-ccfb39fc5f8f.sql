ALTER TABLE public.supplier_products DROP COLUMN IF EXISTS feed_id;

DROP TABLE IF EXISTS public.xml_category_mappings CASCADE;
DROP TABLE IF EXISTS public.supplier_feed_runs CASCADE;
DROP TABLE IF EXISTS public.supplier_import_jobs CASCADE;
DROP TABLE IF EXISTS public.supplier_feeds CASCADE;

DROP TYPE IF EXISTS public.supplier_feed_kind;
DROP TYPE IF EXISTS public.supplier_feed_run_status;
DROP TYPE IF EXISTS public.supplier_feed_schedule;
DROP TYPE IF EXISTS public.supplier_match_key;