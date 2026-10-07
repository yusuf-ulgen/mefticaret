CREATE TABLE IF NOT EXISTS public.einvoice_credentials (
  kind text PRIMARY KEY,
  username text NOT NULL,
  secret_payload text NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.einvoice_credentials TO service_role;
ALTER TABLE public.einvoice_credentials ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.einvoice_credentials_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.kind NOT IN ('efatura','earsiv') THEN RAISE EXCEPTION 'invalid kind'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER einvoice_credentials_validate BEFORE INSERT OR UPDATE ON public.einvoice_credentials
  FOR EACH ROW EXECUTE FUNCTION public.einvoice_credentials_validate();