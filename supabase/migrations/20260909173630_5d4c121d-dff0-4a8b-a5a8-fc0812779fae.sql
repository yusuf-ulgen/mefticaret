ALTER TABLE public.platform_pages ADD COLUMN IF NOT EXISTS show_contact_form boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.platform_contact_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  subject text,
  message text NOT NULL,
  page_slug text,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.platform_contact_messages TO authenticated;
GRANT ALL ON public.platform_contact_messages TO service_role;

ALTER TABLE public.platform_contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins read contact messages" ON public.platform_contact_messages;
CREATE POLICY "Platform admins read contact messages"
  ON public.platform_contact_messages FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'));

DROP POLICY IF EXISTS "Platform admins update contact messages" ON public.platform_contact_messages;
CREATE POLICY "Platform admins update contact messages"
  ON public.platform_contact_messages FOR UPDATE TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'));

CREATE INDEX IF NOT EXISTS platform_contact_messages_created_idx
  ON public.platform_contact_messages (created_at DESC);

DROP TRIGGER IF EXISTS platform_contact_messages_set_updated_at ON public.platform_contact_messages;
CREATE TRIGGER platform_contact_messages_set_updated_at
  BEFORE UPDATE ON public.platform_contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Satıcı self-update: korumalı alanlar artık BEFORE UPDATE tetikleyicileriyle
-- (guard_marketplace_seller_update / guard_seller_admin_fields) doğrulanıyor.
-- Kendine referanslı alt sorgular no-op olabildiği için WITH CHECK'ten kaldırıldı.
DROP POLICY IF EXISTS "Sellers update own profile fields" ON public.marketplace_sellers;
CREATE POLICY "Sellers update own profile fields"
  ON public.marketplace_sellers FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());