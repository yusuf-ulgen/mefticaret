-- TikTok DM & Social Inbox modülü

CREATE TABLE public.tiktok_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  open_id text NOT NULL,
  union_id text,
  username text,
  display_name text,
  avatar_url text,
  verify_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  scopes text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'disconnected',
  status_message text,
  token_expires_at timestamptz,
  auto_comment_dm_enabled boolean NOT NULL DEFAULT true,
  live_automation_enabled boolean NOT NULL DEFAULT true,
  autonomous_ai_enabled boolean NOT NULL DEFAULT false,
  ai_confidence_threshold numeric NOT NULL DEFAULT 0.7,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id)
);
CREATE UNIQUE INDEX tiktok_accounts_open_id_idx ON public.tiktok_accounts(open_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tiktok_accounts TO authenticated;
GRANT ALL ON public.tiktok_accounts TO service_role;
ALTER TABLE public.tiktok_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tt account read" ON public.tiktok_accounts
  FOR SELECT TO authenticated USING (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "tt account insert" ON public.tiktok_accounts
  FOR INSERT TO authenticated WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "tt account update" ON public.tiktok_accounts
  FOR UPDATE TO authenticated USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "tt account delete" ON public.tiktok_accounts
  FOR DELETE TO authenticated USING (app_private.can_manage_store(store_id, auth.uid()));

CREATE TABLE public.tiktok_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.tiktok_accounts(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz,
  refresh_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id)
);
GRANT ALL ON public.tiktok_credentials TO service_role;
ALTER TABLE public.tiktok_credentials ENABLE ROW LEVEL SECURITY;
-- Bilinçli olarak authenticated politikası yok: anahtarlar yalnızca sunucu tarafında okunur.

CREATE TABLE public.tiktok_comment_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  match_type text NOT NULL DEFAULT 'contains',
  target_video_id text,
  source text NOT NULL DEFAULT 'all',
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  dm_template text NOT NULL DEFAULT 'Selam {{name}}! Sorduğun ürünün tüm detayları burada 👇',
  public_reply text NOT NULL DEFAULT 'DM attık, kutuna bak 📩',
  send_product_card boolean NOT NULL DEFAULT true,
  reply_to_comment boolean NOT NULL DEFAULT true,
  pin_product_card boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  triggered_count integer NOT NULL DEFAULT 0,
  dm_sent_count integer NOT NULL DEFAULT 0,
  conversion_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tiktok_comment_rules_store_idx ON public.tiktok_comment_rules(store_id, is_active, priority);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tiktok_comment_rules TO authenticated;
GRANT ALL ON public.tiktok_comment_rules TO service_role;
ALTER TABLE public.tiktok_comment_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tt rules read" ON public.tiktok_comment_rules
  FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "tt rules insert" ON public.tiktok_comment_rules
  FOR INSERT TO authenticated WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "tt rules update" ON public.tiktok_comment_rules
  FOR UPDATE TO authenticated USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "tt rules delete" ON public.tiktok_comment_rules
  FOR DELETE TO authenticated USING (app_private.can_manage_store(store_id, auth.uid()));

CREATE TABLE public.tiktok_events (
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
CREATE UNIQUE INDEX tiktok_events_external_idx ON public.tiktok_events(event_type, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX tiktok_events_pending_idx ON public.tiktok_events(status, created_at);

GRANT SELECT ON public.tiktok_events TO authenticated;
GRANT ALL ON public.tiktok_events TO service_role;
ALTER TABLE public.tiktok_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tt events read" ON public.tiktok_events
  FOR SELECT TO authenticated
  USING (store_id IS NOT NULL AND app_private.is_store_member(store_id, auth.uid()));

CREATE TABLE public.tiktok_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES public.tiktok_comment_rules(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.omni_conversations(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'comment',
  video_id text,
  comment_id text,
  live_room_id text,
  tiktok_user_id text,
  username text,
  text text,
  matched_keyword text,
  dm_status text NOT NULL DEFAULT 'pending',
  reply_status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX tiktok_interactions_comment_idx ON public.tiktok_interactions(comment_id) WHERE comment_id IS NOT NULL;
CREATE INDEX tiktok_interactions_store_idx ON public.tiktok_interactions(store_id, created_at DESC);

GRANT SELECT ON public.tiktok_interactions TO authenticated;
GRANT ALL ON public.tiktok_interactions TO service_role;
ALTER TABLE public.tiktok_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tt interactions read" ON public.tiktok_interactions
  FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));

CREATE TRIGGER update_tiktok_accounts_updated_at BEFORE UPDATE ON public.tiktok_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_tiktok_credentials_updated_at BEFORE UPDATE ON public.tiktok_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_tiktok_comment_rules_updated_at BEFORE UPDATE ON public.tiktok_comment_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_tiktok_interactions_updated_at BEFORE UPDATE ON public.tiktok_interactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();