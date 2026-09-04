CREATE TABLE IF NOT EXISTS public.platform_seo_ai_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  singleton_key text NOT NULL DEFAULT 'global' UNIQUE,
  is_enabled boolean NOT NULL DEFAULT true,
  run_landing boolean NOT NULL DEFAULT true,
  run_products boolean NOT NULL DEFAULT true,
  run_collections boolean NOT NULL DEFAULT true,
  run_blog boolean NOT NULL DEFAULT true,
  run_campaigns boolean NOT NULL DEFAULT true,
  autofix_enabled boolean NOT NULL DEFAULT true,
  ai_enabled boolean NOT NULL DEFAULT true,
  provider_code text NOT NULL DEFAULT 'lovable',
  model text NOT NULL DEFAULT 'google/gemini-3.7-flash',
  max_stores_per_run integer NOT NULL DEFAULT 20,
  max_items_per_store integer NOT NULL DEFAULT 8,
  daily_hour integer NOT NULL DEFAULT 3,
  focus_keywords text NOT NULL DEFAULT '',
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_seo_ai_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trigger text NOT NULL DEFAULT 'cron',
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  stores_audited integer NOT NULL DEFAULT 0,
  issues_found integer NOT NULL DEFAULT 0,
  autofixed integer NOT NULL DEFAULT 0,
  ai_updates integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  average_score numeric NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_seo_ai_actions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES public.platform_seo_ai_runs(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  scope text NOT NULL,
  action text NOT NULL,
  target text,
  before_value text,
  after_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_seo_ai_runs_started_idx ON public.platform_seo_ai_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS platform_seo_ai_actions_run_idx ON public.platform_seo_ai_actions (run_id, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_seo_ai_actions_store_idx ON public.platform_seo_ai_actions (store_id, created_at DESC);

DROP TRIGGER IF EXISTS platform_seo_ai_settings_updated_at ON public.platform_seo_ai_settings;
CREATE TRIGGER platform_seo_ai_settings_updated_at
BEFORE UPDATE ON public.platform_seo_ai_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT ON public.platform_seo_ai_settings TO authenticated;
GRANT SELECT ON public.platform_seo_ai_runs TO authenticated;
GRANT SELECT ON public.platform_seo_ai_actions TO authenticated;
GRANT ALL ON public.platform_seo_ai_settings TO service_role;
GRANT ALL ON public.platform_seo_ai_runs TO service_role;
GRANT ALL ON public.platform_seo_ai_actions TO service_role;

ALTER TABLE public.platform_seo_ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_seo_ai_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_seo_ai_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seo ai settings admin read" ON public.platform_seo_ai_settings;
CREATE POLICY "seo ai settings admin read" ON public.platform_seo_ai_settings
FOR SELECT TO authenticated USING (app_private.has_role(auth.uid(), 'platform_admin'));

DROP POLICY IF EXISTS "seo ai runs admin read" ON public.platform_seo_ai_runs;
CREATE POLICY "seo ai runs admin read" ON public.platform_seo_ai_runs
FOR SELECT TO authenticated USING (app_private.has_role(auth.uid(), 'platform_admin'));

DROP POLICY IF EXISTS "seo ai actions admin read" ON public.platform_seo_ai_actions;
CREATE POLICY "seo ai actions admin read" ON public.platform_seo_ai_actions
FOR SELECT TO authenticated USING (app_private.has_role(auth.uid(), 'platform_admin'));

INSERT INTO public.platform_seo_ai_settings (singleton_key)
VALUES ('global')
ON CONFLICT (singleton_key) DO NOTHING;