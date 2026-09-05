-- Instagram DM & Social Inbox modülü

CREATE TABLE public.instagram_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  ig_user_id text NOT NULL,
  ig_username text,
  page_id text,
  page_name text,
  verify_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  scopes text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'disconnected',
  status_message text,
  token_expires_at timestamptz,
  auto_comment_dm_enabled boolean NOT NULL DEFAULT true,
  autonomous_ai_enabled boolean NOT NULL DEFAULT false,
  ai_confidence_threshold numeric NOT NULL DEFAULT 0.7,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id)
);
CREATE UNIQUE INDEX instagram_accounts_ig_user_idx ON public.instagram_accounts(ig_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instagram_accounts TO authenticated;
GRANT ALL ON public.instagram_accounts TO service_role;
ALTER TABLE public.instagram_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ig account read" ON public.instagram_accounts
  FOR SELECT TO authenticated USING (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "ig account insert" ON public.instagram_accounts
  FOR INSERT TO authenticated WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "ig account update" ON public.instagram_accounts
  FOR UPDATE TO authenticated USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "ig account delete" ON public.instagram_accounts
  FOR DELETE TO authenticated USING (app_private.can_manage_store(store_id, auth.uid()));

CREATE TABLE public.instagram_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id)
);
GRANT ALL ON public.instagram_credentials TO service_role;
ALTER TABLE public.instagram_credentials ENABLE ROW LEVEL SECURITY;
-- Bilinçli olarak authenticated politikası yok: anahtarlar yalnızca sunucu tarafında okunur.

CREATE TABLE public.instagram_comment_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  match_type text NOT NULL DEFAULT 'contains',
  target_post_id text,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  dm_template text NOT NULL DEFAULT 'Merhaba {{name}}! İlgilendiğin ürünün detayları burada 👇',
  public_reply text NOT NULL DEFAULT 'DM üzerinden detaylar gönderildi 📩',
  send_product_card boolean NOT NULL DEFAULT true,
  reply_to_comment boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  triggered_count integer NOT NULL DEFAULT 0,
  dm_sent_count integer NOT NULL DEFAULT 0,
  conversion_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX instagram_comment_rules_store_idx ON public.instagram_comment_rules(store_id, is_active, priority);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instagram_comment_rules TO authenticated;
GRANT ALL ON public.instagram_comment_rules TO service_role;
ALTER TABLE public.instagram_comment_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ig rules read" ON public.instagram_comment_rules
  FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "ig rules insert" ON public.instagram_comment_rules
  FOR INSERT TO authenticated WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "ig rules update" ON public.instagram_comment_rules
  FOR UPDATE TO authenticated USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "ig rules delete" ON public.instagram_comment_rules
  FOR DELETE TO authenticated USING (app_private.can_manage_store(store_id, auth.uid()));

CREATE TABLE public.instagram_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  external_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX instagram_events_external_idx ON public.instagram_events(event_type, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX instagram_events_pending_idx ON public.instagram_events(status, created_at);

GRANT SELECT ON public.instagram_events TO authenticated;
GRANT ALL ON public.instagram_events TO service_role;
ALTER TABLE public.instagram_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ig events read" ON public.instagram_events
  FOR SELECT TO authenticated
  USING (store_id IS NOT NULL AND app_private.is_store_member(store_id, auth.uid()));

CREATE TABLE public.instagram_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES public.instagram_comment_rules(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.omni_conversations(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'comment',
  post_id text,
  comment_id text,
  ig_user_id text,
  username text,
  text text,
  matched_keyword text,
  dm_status text NOT NULL DEFAULT 'pending',
  reply_status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX instagram_interactions_comment_idx ON public.instagram_interactions(comment_id) WHERE comment_id IS NOT NULL;
CREATE INDEX instagram_interactions_store_idx ON public.instagram_interactions(store_id, created_at DESC);

GRANT SELECT ON public.instagram_interactions TO authenticated;
GRANT ALL ON public.instagram_interactions TO service_role;
ALTER TABLE public.instagram_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ig interactions read" ON public.instagram_interactions
  FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));

CREATE TRIGGER update_instagram_accounts_updated_at BEFORE UPDATE ON public.instagram_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_instagram_credentials_updated_at BEFORE UPDATE ON public.instagram_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_instagram_comment_rules_updated_at BEFORE UPDATE ON public.instagram_comment_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_instagram_interactions_updated_at BEFORE UPDATE ON public.instagram_interactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();