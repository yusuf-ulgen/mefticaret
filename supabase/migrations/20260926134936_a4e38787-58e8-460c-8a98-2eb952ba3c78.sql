CREATE TABLE public.chat_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE CHECK (char_length(endpoint) <= 1000 AND endpoint LIKE 'https://%'),
  p256dh text NOT NULL CHECK (char_length(p256dh) <= 200),
  auth text NOT NULL CHECK (char_length(auth) <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_push_subscriptions_user_idx ON public.chat_push_subscriptions(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_push_subscriptions TO authenticated;
GRANT ALL ON public.chat_push_subscriptions TO service_role;
ALTER TABLE public.chat_push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own push subs" ON public.chat_push_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);