CREATE TABLE public.store_seo_redirects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  source_path TEXT NOT NULL CHECK (source_path LIKE '/%' AND length(source_path) <= 500),
  target_path TEXT NOT NULL CHECK (target_path LIKE '/%' OR target_path ~ '^https?://' AND length(target_path) <= 1000),
  status_code INTEGER NOT NULL DEFAULT 301 CHECK (status_code IN (301, 302)),
  is_active BOOLEAN NOT NULL DEFAULT true,
  hit_count INTEGER NOT NULL DEFAULT 0 CHECK (hit_count >= 0),
  last_hit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, source_path)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_seo_redirects TO authenticated;
GRANT ALL ON public.store_seo_redirects TO service_role;

ALTER TABLE public.store_seo_redirects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seo_redirects_select_managers" ON public.store_seo_redirects
  FOR SELECT TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "seo_redirects_manage_managers" ON public.store_seo_redirects
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE TRIGGER store_seo_redirects_updated_at
  BEFORE UPDATE ON public.store_seo_redirects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.store_seo_404s (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  path TEXT NOT NULL CHECK (path LIKE '/%' AND length(path) <= 500),
  hit_count INTEGER NOT NULL DEFAULT 1 CHECK (hit_count >= 0),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  referrer TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, path)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_seo_404s TO authenticated;
GRANT ALL ON public.store_seo_404s TO service_role;

ALTER TABLE public.store_seo_404s ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seo_404s_select_managers" ON public.store_seo_404s
  FOR SELECT TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "seo_404s_manage_managers" ON public.store_seo_404s
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE TRIGGER store_seo_404s_updated_at
  BEFORE UPDATE ON public.store_seo_404s
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX store_seo_redirects_active_source_idx
  ON public.store_seo_redirects (store_id, source_path)
  WHERE is_active = true;
CREATE INDEX store_seo_404s_recent_idx
  ON public.store_seo_404s (store_id, last_seen_at DESC);