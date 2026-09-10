CREATE TABLE public.migration_credentials (
  source_id uuid NOT NULL PRIMARY KEY REFERENCES public.migration_sources(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.migration_credentials TO service_role;

ALTER TABLE public.migration_credentials ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER migration_credentials_touch BEFORE UPDATE ON public.migration_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();