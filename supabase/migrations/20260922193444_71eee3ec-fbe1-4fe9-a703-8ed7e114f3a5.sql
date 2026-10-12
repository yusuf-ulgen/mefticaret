-- Canlı önizleme oturumları: kaydedilmemiş tema ayarları geçici olarak burada tutulur.
CREATE TABLE IF NOT EXISTS public.theme_preview_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS theme_preview_sessions_store_idx
  ON public.theme_preview_sessions (store_id, expires_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.theme_preview_sessions TO authenticated;
GRANT ALL ON public.theme_preview_sessions TO service_role;

ALTER TABLE public.theme_preview_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "theme_preview_sessions_manage" ON public.theme_preview_sessions
  FOR ALL TO authenticated
  USING (
    app_private.can_manage_store(store_id, auth.uid())
    OR app_private.has_role(auth.uid(), 'platform_admin')
  )
  WITH CHECK (
    app_private.can_manage_store(store_id, auth.uid())
    OR app_private.has_role(auth.uid(), 'platform_admin')
  );

CREATE TRIGGER set_theme_preview_sessions_updated_at BEFORE UPDATE ON public.theme_preview_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();