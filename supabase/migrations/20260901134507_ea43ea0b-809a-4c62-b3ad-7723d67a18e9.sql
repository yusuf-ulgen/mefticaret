ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS seo jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.store_pages
  ADD COLUMN IF NOT EXISTS seo jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS page_kind text NOT NULL DEFAULT 'page',
  ADD COLUMN IF NOT EXISTS author_name text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

ALTER TABLE public.products
  ALTER COLUMN seo SET DEFAULT '{}'::jsonb;

UPDATE public.products SET seo = '{}'::jsonb WHERE seo IS NULL;

CREATE INDEX IF NOT EXISTS store_pages_kind_idx
  ON public.store_pages (store_id, page_kind, is_published);
