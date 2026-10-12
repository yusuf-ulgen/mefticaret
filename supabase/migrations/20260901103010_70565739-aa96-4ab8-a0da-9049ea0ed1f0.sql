ALTER TABLE public.store_domains
  ADD COLUMN IF NOT EXISTS ssl_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ssl_issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS ssl_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS redirect_to_hostname text,
  ADD COLUMN IF NOT EXISTS dns_target text,
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS dns_records jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS store_domains_hostname_key ON public.store_domains (hostname);
CREATE UNIQUE INDEX IF NOT EXISTS store_domains_one_primary ON public.store_domains (store_id) WHERE is_primary;

UPDATE public.store_domains SET ssl_status = 'active' WHERE ssl_active AND ssl_status = 'pending';