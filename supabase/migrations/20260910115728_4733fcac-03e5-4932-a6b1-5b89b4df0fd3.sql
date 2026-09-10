ALTER TABLE public.platform_posts ADD COLUMN IF NOT EXISTS category text;
CREATE INDEX IF NOT EXISTS platform_posts_category_idx ON public.platform_posts (category);