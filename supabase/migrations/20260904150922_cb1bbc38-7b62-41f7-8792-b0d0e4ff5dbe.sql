
CREATE TABLE IF NOT EXISTS public.seo_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'completed',
  source text NOT NULL DEFAULT 'manual',
  triggered_by uuid,
  score integer NOT NULL DEFAULT 0,
  technical_score integer NOT NULL DEFAULT 0,
  onpage_score integer NOT NULL DEFAULT 0,
  content_score integer NOT NULL DEFAULT 0,
  schema_score integer NOT NULL DEFAULT 0,
  performance_score integer NOT NULL DEFAULT 0,
  mobile_score integer NOT NULL DEFAULT 0,
  linking_score integer NOT NULL DEFAULT 0,
  pages_count integer NOT NULL DEFAULT 0,
  critical_count integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  info_count integer NOT NULL DEFAULT 0,
  passed_count integer NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_audit_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES public.seo_audits(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  url text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  title text,
  score integer NOT NULL DEFAULT 0,
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  critical_count integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  info_count integer NOT NULL DEFAULT 0,
  indexable boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  audit_id uuid REFERENCES public.seo_audits(id) ON DELETE SET NULL,
  code text NOT NULL,
  category text NOT NULL,
  severity text NOT NULL,
  entity_type text NOT NULL DEFAULT 'store',
  entity_id uuid,
  url text,
  title text,
  message text NOT NULL,
  fix_hint text,
  autofixable boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS seo_audits_store_created_idx ON public.seo_audits (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS seo_audit_pages_audit_idx ON public.seo_audit_pages (audit_id, score);
CREATE INDEX IF NOT EXISTS seo_audit_pages_store_idx ON public.seo_audit_pages (store_id, entity_type);
CREATE INDEX IF NOT EXISTS seo_issues_store_status_idx ON public.seo_issues (store_id, status, severity);
CREATE INDEX IF NOT EXISTS seo_issues_audit_idx ON public.seo_issues (audit_id);
CREATE UNIQUE INDEX IF NOT EXISTS seo_issues_unique_open_idx
  ON public.seo_issues (store_id, code, entity_type, COALESCE(entity_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(url, ''));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_audits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_audit_pages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_issues TO authenticated;
GRANT ALL ON public.seo_audits TO service_role;
GRANT ALL ON public.seo_audit_pages TO service_role;
GRANT ALL ON public.seo_issues TO service_role;

ALTER TABLE public.seo_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_audit_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY seo_audits_manage ON public.seo_audits FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY seo_audit_pages_manage ON public.seo_audit_pages FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY seo_issues_manage ON public.seo_issues FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()) OR app_private.has_role(auth.uid(), 'platform_admin'));

CREATE TRIGGER seo_audits_touch BEFORE UPDATE ON public.seo_audits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER seo_issues_touch BEFORE UPDATE ON public.seo_issues
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
