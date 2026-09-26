CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'direct' CHECK (kind IN ('direct','group','support')),
  title text CHECK (title IS NULL OR char_length(title) <= 80),
  created_by uuid NOT NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.chat_participants (
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  display_role text NOT NULL DEFAULT 'customer' CHECK (display_role IN ('admin','seller','customer')),
  muted boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX chat_participants_user_idx ON public.chat_participants(user_id);
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'text' CHECK (kind IN ('text','image','file','audio')),
  body text CHECK (body IS NULL OR char_length(body) <= 4000),
  reply_to_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  attachment_path text,
  attachment_name text,
  attachment_size bigint,
  attachment_mime text,
  duration_ms integer,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_conv_idx ON public.chat_messages(conversation_id, created_at DESC);
CREATE TABLE public.chat_reactions (
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL CHECK (char_length(emoji) <= 16),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
CREATE TABLE public.chat_presence (
  user_id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'online' CHECK (status IN ('online','dnd','invisible')),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_conversations, public.chat_participants, public.chat_messages, public.chat_reactions, public.chat_presence TO authenticated;
GRANT ALL ON public.chat_conversations, public.chat_participants, public.chat_messages, public.chat_reactions, public.chat_presence TO service_role;

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_presence ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION app_private.is_chat_member(_conv uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chat_participants WHERE conversation_id = _conv AND user_id = _uid)
$$;
CREATE OR REPLACE FUNCTION app_private.shares_chat(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _a = _b OR EXISTS (
    SELECT 1 FROM public.chat_participants p1 JOIN public.chat_participants p2 ON p1.conversation_id = p2.conversation_id
    WHERE p1.user_id = _a AND p2.user_id = _b)
$$;
GRANT EXECUTE ON FUNCTION app_private.is_chat_member(uuid, uuid), app_private.shares_chat(uuid, uuid) TO authenticated;

CREATE POLICY "chat conv members read" ON public.chat_conversations FOR SELECT TO authenticated
  USING (app_private.is_chat_member(id, auth.uid()));
CREATE POLICY "chat part members read" ON public.chat_participants FOR SELECT TO authenticated
  USING (app_private.is_chat_member(conversation_id, auth.uid()));
CREATE POLICY "chat part self update" ON public.chat_participants FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "chat msg members read" ON public.chat_messages FOR SELECT TO authenticated
  USING (app_private.is_chat_member(conversation_id, auth.uid()));
CREATE POLICY "chat msg members send" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND deleted_at IS NULL AND app_private.is_chat_member(conversation_id, auth.uid()));
CREATE POLICY "chat react read" ON public.chat_reactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.id = message_id AND app_private.is_chat_member(m.conversation_id, auth.uid())));
CREATE POLICY "chat react own write" ON public.chat_reactions FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.id = message_id AND app_private.is_chat_member(m.conversation_id, auth.uid())));
CREATE POLICY "chat presence read" ON public.chat_presence FOR SELECT TO authenticated
  USING (app_private.shares_chat(auth.uid(), user_id));
CREATE POLICY "chat presence own" ON public.chat_presence FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Mesaj eklendiğinde sohbet özetini güncelle
CREATE OR REPLACE FUNCTION public.chat_after_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.chat_conversations SET
    last_message_at = NEW.created_at,
    last_message_preview = CASE NEW.kind WHEN 'text' THEN left(coalesce(NEW.body,''), 120)
      WHEN 'image' THEN '📷 Fotoğraf' WHEN 'audio' THEN '🎤 Sesli mesaj' ELSE '📎 ' || coalesce(NEW.attachment_name,'Dosya') END,
    updated_at = now()
  WHERE id = NEW.conversation_id;
  UPDATE public.chat_participants SET last_read_at = NEW.created_at, archived = false
    WHERE conversation_id = NEW.conversation_id AND user_id = NEW.sender_id;
  RETURN NEW;
END $$;
CREATE TRIGGER chat_after_message AFTER INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.chat_after_message();

ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_participants REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;

CREATE POLICY "chat media member read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-media' AND app_private.is_chat_member(((storage.foldername(name))[1])::uuid, auth.uid()));
CREATE POLICY "chat media member upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-media' AND app_private.is_chat_member(((storage.foldername(name))[1])::uuid, auth.uid()));