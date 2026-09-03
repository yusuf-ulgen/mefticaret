ALTER TABLE public.automation_workflows
  ADD COLUMN IF NOT EXISTS canvas jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb;

COMMENT ON COLUMN public.automation_workflows.canvas IS 'Visual automation builder graph: nodes, positions, and edges.';