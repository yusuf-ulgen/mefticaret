CREATE TABLE IF NOT EXISTS public.store_site_kit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  provider text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'unconfigured',
  public_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  secret_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_tested_at timestamptz,
  last_test_result text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, provider)
);

CREATE INDEX IF NOT EXISTS store_site_kit_store_idx ON public.store_site_kit (store_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_site_kit TO authenticated;
GRANT ALL ON public.store_site_kit TO service_role;

ALTER TABLE public.store_site_kit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_kit_manage" ON public.store_site_kit;
CREATE POLICY "site_kit_manage" ON public.store_site_kit
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.site_kit_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS store_site_kit_updated_at ON public.store_site_kit;
CREATE TRIGGER store_site_kit_updated_at BEFORE UPDATE ON public.store_site_kit
  FOR EACH ROW EXECUTE FUNCTION public.site_kit_touch_updated_at();

CREATE OR REPLACE FUNCTION public.site_kit_public_config(store_slug text)
RETURNS TABLE (provider text, public_config jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT k.provider, k.public_config
  FROM public.store_site_kit k
  JOIN public.stores s ON s.id = k.store_id
  WHERE s.slug = store_slug
    AND k.is_enabled = true;
$$;

REVOKE ALL ON FUNCTION public.site_kit_public_config(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.site_kit_public_config(text) TO anon, authenticated, service_role;