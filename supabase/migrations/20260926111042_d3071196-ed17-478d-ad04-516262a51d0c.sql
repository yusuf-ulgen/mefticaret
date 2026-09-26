CREATE TABLE public.chat_user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle text UNIQUE CHECK (handle ~ '^[a-z0-9_.]{3,24}$'),
  bio text CHECK (char_length(bio) <= 140),
  store_url text CHECK (store_url IS NULL OR (store_url ~ '^https://' AND char_length(store_url) <= 200)),
  user_type text NOT NULL DEFAULT 'customer' CHECK (user_type IN ('seller','customer')),
  phone_hash text,
  last_seen_privacy text NOT NULL DEFAULT 'everyone' CHECK (last_seen_privacy IN ('everyone','contacts','nobody')),
  photo_privacy text NOT NULL DEFAULT 'everyone' CHECK (photo_privacy IN ('everyone','contacts','nobody')),
  online_privacy text NOT NULL DEFAULT 'everyone' CHECK (online_privacy IN ('everyone','contacts','nobody')),
  notifications_enabled boolean NOT NULL DEFAULT true,
  sound text NOT NULL DEFAULT 'pop' CHECK (sound IN ('pop','chime','ding','none')),
  vibrate boolean NOT NULL DEFAULT true,
  consent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_user_settings_phone_idx ON public.chat_user_settings(phone_hash);
GRANT SELECT, INSERT, UPDATE ON public.chat_user_settings TO authenticated;
GRANT ALL ON public.chat_user_settings TO service_role;
ALTER TABLE public.chat_user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat settings own read" ON public.chat_user_settings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "chat settings own insert" ON public.chat_user_settings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "chat settings own update" ON public.chat_user_settings FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER chat_user_settings_updated BEFORE UPDATE ON public.chat_user_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.chat_blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.chat_blocks TO authenticated;
GRANT ALL ON public.chat_blocks TO service_role;
ALTER TABLE public.chat_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat blocks own read" ON public.chat_blocks FOR SELECT TO authenticated USING (blocker_id = auth.uid());
CREATE POLICY "chat blocks own insert" ON public.chat_blocks FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid());
CREATE POLICY "chat blocks own delete" ON public.chat_blocks FOR DELETE TO authenticated USING (blocker_id = auth.uid());

CREATE TABLE public.chat_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  reported_user_id uuid,
  reason text NOT NULL CHECK (reason IN ('spam','abuse','fraud','inappropriate','other')),
  note text CHECK (char_length(note) <= 500),
  message_snapshot text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, message_id)
);
GRANT SELECT, UPDATE ON public.chat_reports TO authenticated;
GRANT ALL ON public.chat_reports TO service_role;
ALTER TABLE public.chat_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat reports own or admin read" ON public.chat_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR app_private.has_role(auth.uid(), 'platform_admin'::public.app_role));
CREATE POLICY "chat reports admin update" ON public.chat_reports FOR UPDATE TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'::public.app_role)) WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'::public.app_role));
CREATE TRIGGER chat_reports_updated BEFORE UPDATE ON public.chat_reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.chat_participants ADD COLUMN IF NOT EXISTS mute_until timestamptz;

CREATE OR REPLACE FUNCTION app_private.chat_block_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.chat_conversations c
    JOIN public.chat_participants p ON p.conversation_id = c.id AND p.user_id <> NEW.sender_id
    JOIN public.chat_blocks b ON (b.blocker_id = p.user_id AND b.blocked_id = NEW.sender_id)
                              OR (b.blocker_id = NEW.sender_id AND b.blocked_id = p.user_id)
    WHERE c.id = NEW.conversation_id AND c.kind <> 'group'
  ) THEN
    RAISE EXCEPTION 'Bu kişiyle mesajlaşma engellendi.';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION app_private.chat_block_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER chat_messages_block_guard BEFORE INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION app_private.chat_block_guard();