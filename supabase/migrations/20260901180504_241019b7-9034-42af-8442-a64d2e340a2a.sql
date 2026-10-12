-- ============ SUPPORT SYSTEM ============
DO $$ BEGIN
  CREATE TYPE public.support_channel AS ENUM ('ticket', 'chat', 'email');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.support_author_role AS ENUM ('customer', 'store', 'platform', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS channel public.support_channel NOT NULL DEFAULT 'ticket',
  ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.support_ticket_messages
  ADD COLUMN IF NOT EXISTS author_role public.support_author_role NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS support_tickets_store_status_idx ON public.support_tickets (store_id, status);
CREATE INDEX IF NOT EXISTS support_ticket_messages_ticket_idx ON public.support_ticket_messages (ticket_id, created_at);

CREATE TABLE IF NOT EXISTS public.support_departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.support_departments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_departments TO authenticated;
GRANT ALL ON public.support_departments TO service_role;

ALTER TABLE public.support_departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active departments are readable" ON public.support_departments;
CREATE POLICY "Active departments are readable"
  ON public.support_departments FOR SELECT
  USING (is_active OR app_private.has_role(auth.uid(), 'platform_admin'::public.app_role));

DROP POLICY IF EXISTS "Platform admins manage departments" ON public.support_departments;
CREATE POLICY "Platform admins manage departments"
  ON public.support_departments FOR ALL
  TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'::public.app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'::public.app_role));

DROP TRIGGER IF EXISTS support_departments_updated_at ON public.support_departments;
CREATE TRIGGER support_departments_updated_at
  BEFORE UPDATE ON public.support_departments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.support_departments (code, label, description, sort_order) VALUES
  ('general', 'Genel', 'Genel sorular ve talepler', 10),
  ('billing', 'Faturalama', 'Abonelik, fatura ve ödeme konuları', 20),
  ('technical', 'Teknik Destek', 'Hata, performans ve teknik sorunlar', 30),
  ('store', 'Mağaza Yönetimi', 'Mağaza ayarları, tema ve domain', 40),
  ('marketplace', 'Pazaryeri', 'Satıcı ve pazaryeri entegrasyonları', 50),
  ('api', 'API & Entegrasyon', 'API, webhook ve uygulama entegrasyonları', 60)
ON CONFLICT (code) DO NOTHING;

-- ============ SUPPORT ATTACHMENT STORAGE POLICIES ============
DROP POLICY IF EXISTS "Support attachments readable by owners" ON storage.objects;
CREATE POLICY "Support attachments readable by owners"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND (
      app_private.has_role(auth.uid(), 'platform_admin'::public.app_role)
      OR owner = auth.uid()
      OR app_private.is_store_member(NULLIF((storage.foldername(name))[1], '')::uuid, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Support attachments uploadable by members" ON storage.objects;
CREATE POLICY "Support attachments uploadable by members"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'support-attachments'
    AND (
      app_private.has_role(auth.uid(), 'platform_admin'::public.app_role)
      OR app_private.is_store_member(NULLIF((storage.foldername(name))[1], '')::uuid, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Support attachments deletable by owners" ON storage.objects;
CREATE POLICY "Support attachments deletable by owners"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND (
      app_private.has_role(auth.uid(), 'platform_admin'::public.app_role)
      OR owner = auth.uid()
    )
  );

-- ============ OAUTH 2.0 ============
CREATE TABLE IF NOT EXISTS public.oauth_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  client_id TEXT NOT NULL UNIQUE,
  client_secret_hash TEXT NOT NULL,
  secret_prefix TEXT NOT NULL,
  redirect_uris TEXT[] NOT NULL DEFAULT '{}',
  allowed_scopes TEXT[] NOT NULL DEFAULT '{}',
  grant_types TEXT[] NOT NULL DEFAULT ARRAY['authorization_code','client_credentials','refresh_token'],
  is_trusted BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.oauth_clients TO authenticated;
GRANT ALL ON public.oauth_clients TO service_role;
ALTER TABLE public.oauth_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store managers manage oauth clients" ON public.oauth_clients;
CREATE POLICY "Store managers manage oauth clients"
  ON public.oauth_clients FOR ALL
  TO authenticated
  USING (
    app_private.has_role(auth.uid(), 'platform_admin'::public.app_role)
    OR app_private.can_manage_store(store_id, auth.uid())
  )
  WITH CHECK (
    app_private.has_role(auth.uid(), 'platform_admin'::public.app_role)
    OR app_private.can_manage_store(store_id, auth.uid())
  );

DROP TRIGGER IF EXISTS oauth_clients_updated_at ON public.oauth_clients;
CREATE TRIGGER oauth_clients_updated_at
  BEFORE UPDATE ON public.oauth_clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.oauth_authorization_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.oauth_clients(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID,
  code_hash TEXT NOT NULL UNIQUE,
  redirect_uri TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  code_challenge TEXT,
  code_challenge_method TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.oauth_authorization_codes TO service_role;
ALTER TABLE public.oauth_authorization_codes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.oauth_access_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.oauth_clients(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID,
  token_hash TEXT NOT NULL UNIQUE,
  refresh_token_hash TEXT UNIQUE,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  api_version TEXT NOT NULL DEFAULT 'v1',
  grant_type TEXT NOT NULL DEFAULT 'authorization_code',
  expires_at TIMESTAMPTZ NOT NULL,
  refresh_expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  request_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.oauth_access_tokens TO authenticated;
GRANT ALL ON public.oauth_access_tokens TO service_role;
ALTER TABLE public.oauth_access_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store managers view oauth tokens" ON public.oauth_access_tokens;
CREATE POLICY "Store managers view oauth tokens"
  ON public.oauth_access_tokens FOR SELECT
  TO authenticated
  USING (
    app_private.has_role(auth.uid(), 'platform_admin'::public.app_role)
    OR app_private.can_manage_store(store_id, auth.uid())
  );

DROP POLICY IF EXISTS "Store managers revoke oauth tokens" ON public.oauth_access_tokens;
CREATE POLICY "Store managers revoke oauth tokens"
  ON public.oauth_access_tokens FOR UPDATE
  TO authenticated
  USING (
    app_private.has_role(auth.uid(), 'platform_admin'::public.app_role)
    OR app_private.can_manage_store(store_id, auth.uid())
  )
  WITH CHECK (
    app_private.has_role(auth.uid(), 'platform_admin'::public.app_role)
    OR app_private.can_manage_store(store_id, auth.uid())
  );

DROP TRIGGER IF EXISTS oauth_access_tokens_updated_at ON public.oauth_access_tokens;
CREATE TRIGGER oauth_access_tokens_updated_at
  BEFORE UPDATE ON public.oauth_access_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS oauth_access_tokens_client_idx ON public.oauth_access_tokens (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS oauth_codes_client_idx ON public.oauth_authorization_codes (client_id, created_at DESC);