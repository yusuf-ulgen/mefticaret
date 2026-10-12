ALTER TABLE public.platform_pages
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS canonical_url text,
  ADD COLUMN IF NOT EXISTS noindex boolean NOT NULL DEFAULT false;

ALTER TABLE public.platform_posts
  ADD COLUMN IF NOT EXISTS noindex boolean NOT NULL DEFAULT false;