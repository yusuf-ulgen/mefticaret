CREATE TABLE public.platform_page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  session_id text NOT NULL,
  path text NOT NULL,
  page_title text,
  referrer_host text,
  source text,
  device text,
  country text,
  city text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.platform_page_views TO service_role;
ALTER TABLE public.platform_page_views ENABLE ROW LEVEL SECURITY;
CREATE INDEX platform_page_views_created_idx ON public.platform_page_views (created_at DESC);