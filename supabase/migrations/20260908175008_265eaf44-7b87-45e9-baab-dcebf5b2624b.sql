ALTER TABLE public.supplier_feeds
  ADD COLUMN IF NOT EXISTS filter_rules jsonb NOT NULL DEFAULT '{}'::jsonb;