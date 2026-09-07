-- Gizli entegrasyon anahtarları ayrı bir tabloya taşınır ve API'den tamamen çıkarılır.

CREATE TABLE IF NOT EXISTS public.store_site_kit_secrets (
  store_id uuid NOT NULL,
  provider text NOT NULL,
  secret_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, provider)
);

GRANT ALL ON public.store_site_kit_secrets TO service_role;
ALTER TABLE public.store_site_kit_secrets ENABLE ROW LEVEL SECURITY;

INSERT INTO public.store_site_kit_secrets (store_id, provider, secret_config)
SELECT s.store_id, s.provider, COALESCE(s.secret_config, '{}'::jsonb)
FROM public.store_site_kit s
WHERE COALESCE(s.secret_config, '{}'::jsonb) <> '{}'::jsonb
ON CONFLICT (store_id, provider) DO UPDATE SET secret_config = EXCLUDED.secret_config;

-- Görünüm ve yardımcı fonksiyonlar artık gerekmiyor
DROP VIEW IF EXISTS public.store_site_kit_public;
DROP FUNCTION IF EXISTS public.site_kit_list(uuid);
DROP FUNCTION IF EXISTS public.site_kit_upsert(uuid, text, boolean, text, jsonb, jsonb);

ALTER TABLE public.store_site_kit DROP COLUMN IF EXISTS secret_config;

-- Vitrin okuma yetkisi geri verilir (artık gizli kolon yok)
GRANT SELECT (id, store_id, provider, is_enabled, public_config, created_at, updated_at)
  ON public.store_site_kit TO anon;

DROP POLICY IF EXISTS "site_kit_public_read" ON public.store_site_kit;
CREATE POLICY "site_kit_public_read" ON public.store_site_kit
  FOR SELECT TO anon
  USING (is_enabled AND app_private.is_store_published(store_id));

NOTIFY pgrst, 'reload schema';