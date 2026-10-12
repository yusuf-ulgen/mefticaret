CREATE TYPE public.support_ticket_status AS ENUM ('open','pending','answered','resolved','closed');
CREATE TYPE public.support_ticket_priority AS ENUM ('low','normal','high','urgent');
CREATE TYPE public.support_ticket_category AS ENUM ('billing','technical','account','store','marketplace','api','other');

CREATE TABLE public.support_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  requester_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requester_email text,
  subject text NOT NULL,
  category public.support_ticket_category NOT NULL DEFAULT 'other',
  priority public.support_ticket_priority NOT NULL DEFAULT 'normal',
  status public.support_ticket_status NOT NULL DEFAULT 'open',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_reply_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX support_tickets_status_idx ON public.support_tickets (status, created_at DESC);
CREATE INDEX support_tickets_store_idx ON public.support_tickets (store_id);
CREATE INDEX support_tickets_requester_idx ON public.support_tickets (requester_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanicilar kendi taleplerini gorur" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (requester_id = auth.uid()
         OR app_private.has_role(auth.uid(), 'platform_admin'::public.app_role)
         OR (store_id IS NOT NULL AND app_private.is_store_member(store_id, auth.uid())));

CREATE POLICY "Kullanicilar talep olusturur" ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());

CREATE POLICY "Platform yoneticisi talepleri yonetir" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'::public.app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'::public.app_role));

CREATE POLICY "Platform yoneticisi talep siler" ON public.support_tickets
  FOR DELETE TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'::public.app_role));

CREATE TRIGGER support_tickets_set_updated_at BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.support_ticket_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text,
  body text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX support_ticket_messages_ticket_idx ON public.support_ticket_messages (ticket_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_ticket_messages TO authenticated;
GRANT ALL ON public.support_ticket_messages TO service_role;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Talep yazismalarini ilgili taraflar gorur" ON public.support_ticket_messages
  FOR SELECT TO authenticated
  USING (
    app_private.has_role(auth.uid(), 'platform_admin'::public.app_role)
    OR (
      is_internal = false
      AND EXISTS (
        SELECT 1 FROM public.support_tickets t
        WHERE t.id = ticket_id
          AND (t.requester_id = auth.uid()
               OR (t.store_id IS NOT NULL AND app_private.is_store_member(t.store_id, auth.uid())))
      )
    )
  );

CREATE POLICY "Ilgili taraflar mesaj ekler" ON public.support_ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      app_private.has_role(auth.uid(), 'platform_admin'::public.app_role)
      OR (
        is_internal = false
        AND EXISTS (
          SELECT 1 FROM public.support_tickets t
          WHERE t.id = ticket_id
            AND (t.requester_id = auth.uid()
                 OR (t.store_id IS NOT NULL AND app_private.is_store_member(t.store_id, auth.uid())))
        )
      )
    )
  );

CREATE POLICY "Platform yoneticisi mesaji siler" ON public.support_ticket_messages
  FOR DELETE TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'::public.app_role));

CREATE TRIGGER support_ticket_messages_set_updated_at BEFORE UPDATE ON public.support_ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.platform_settings (
  key text NOT NULL PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  label text,
  description text,
  is_public boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Herkese acik ayarlar okunur" ON public.platform_settings
  FOR SELECT TO anon, authenticated
  USING (is_public = true OR app_private.has_role(auth.uid(), 'platform_admin'::public.app_role));

CREATE POLICY "Platform yoneticisi ayar ekler" ON public.platform_settings
  FOR INSERT TO authenticated
  WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'::public.app_role));

CREATE POLICY "Platform yoneticisi ayar guenceller" ON public.platform_settings
  FOR UPDATE TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'::public.app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'::public.app_role));

CREATE POLICY "Platform yoneticisi ayar siler" ON public.platform_settings
  FOR DELETE TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'::public.app_role));

CREATE TRIGGER platform_settings_set_updated_at BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.platform_settings (key, value, label, description, is_public) VALUES
  ('platform.name', '"Mefticaret"'::jsonb, 'Platform adı', 'Panel ve e-postalarda görünen marka adı', true),
  ('platform.support_email', '"destek@mefticaret.com"'::jsonb, 'Destek e-postası', 'Destek taleplerinin yanıtlandığı adres', true),
  ('platform.maintenance_mode', 'false'::jsonb, 'Bakım modu', 'Açıkken vitrinler bakım bildirimi gösterir', true),
  ('platform.signup_enabled', 'true'::jsonb, 'Yeni kayıtlar açık', 'Kapatıldığında yeni mağaza kaydı alınmaz', true),
  ('platform.default_commission_rate', '0.02'::jsonb, 'Varsayılan komisyon oranı', 'Paket bazlı oran tanımlı değilse kullanılır', false),
  ('platform.default_currency', '"TRY"'::jsonb, 'Varsayılan para birimi', 'Yeni mağazalar için başlangıç para birimi', true);