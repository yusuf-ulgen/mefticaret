ALTER TABLE public.chat_conversations DROP CONSTRAINT chat_conversations_kind_check;
ALTER TABLE public.chat_conversations ADD CONSTRAINT chat_conversations_kind_check CHECK (kind = ANY (ARRAY['direct','group','support','store_team','store_inbox']));
CREATE UNIQUE INDEX IF NOT EXISTS chat_conv_store_team_uniq ON public.chat_conversations(store_id) WHERE kind = 'store_team';
CREATE UNIQUE INDEX IF NOT EXISTS chat_conv_store_inbox_uniq ON public.chat_conversations(store_id, created_by) WHERE kind = 'store_inbox';