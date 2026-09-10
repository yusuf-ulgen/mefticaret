CREATE TABLE public.migration_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  provider text NOT NULL,
  label text,
  shop_domain text,
  config_ref text,
  scope jsonb NOT NULL DEFAULT '[]'::jsonb,
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  last_error text,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX migration_sources_store_idx ON public.migration_sources(store_id);

CREATE TABLE public.migration_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES public.migration_sources(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'run',
  scope jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  cursor jsonb NOT NULL DEFAULT '{}'::jsonb,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  sample jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX migration_jobs_store_idx ON public.migration_jobs(store_id, created_at DESC);
CREATE INDEX migration_jobs_source_idx ON public.migration_jobs(source_id);

CREATE TABLE public.migration_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.migration_jobs(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.migration_sources(id) ON DELETE CASCADE,
  entity text NOT NULL,
  external_id text NOT NULL,
  local_id uuid,
  action text NOT NULL DEFAULT 'created',
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX migration_records_job_idx ON public.migration_records(job_id, entity);
CREATE INDEX migration_records_lookup_idx ON public.migration_records(store_id, entity, external_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.migration_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.migration_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.migration_records TO authenticated;
GRANT ALL ON public.migration_sources TO service_role;
GRANT ALL ON public.migration_jobs TO service_role;
GRANT ALL ON public.migration_records TO service_role;

ALTER TABLE public.migration_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "migration_sources_manage" ON public.migration_sources FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "migration_jobs_manage" ON public.migration_jobs FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "migration_records_manage" ON public.migration_records FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE TRIGGER migration_sources_touch BEFORE UPDATE ON public.migration_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER migration_jobs_touch BEFORE UPDATE ON public.migration_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();