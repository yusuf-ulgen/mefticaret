-- ============ OMNI-CHANNEL MESAJ MERKEZİ ============
CREATE TABLE public.omni_channel_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('instagram','tiktok','messenger','telegram','live_chat','email','marketplace','whatsapp')),
  account_name text NOT NULL,
  external_id text,
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected','connected','error','paused')),
  status_message text,
  is_active boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, channel, account_name)
);

CREATE TABLE public.omni_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.omni_channel_accounts(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('instagram','tiktok','messenger','telegram','live_chat','email','marketplace','whatsapp')),
  external_id text,
  participant_handle text NOT NULL,
  participant_name text,
  avatar_url text,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','closed')),
  tags text[] NOT NULL DEFAULT '{}',
  internal_note text,
  unread_count integer NOT NULL DEFAULT 0,
  message_count integer NOT NULL DEFAULT 0,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  first_response_seconds integer,
  converted_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, channel, participant_handle)
);
CREATE INDEX omni_conversations_store_idx ON public.omni_conversations (store_id, last_message_at DESC);
CREATE INDEX omni_conversations_status_idx ON public.omni_conversations (store_id, status);

CREATE TABLE public.omni_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.omni_conversations(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  body text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  external_id text,
  is_ai boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('queued','sent','delivered','read','failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX omni_messages_conversation_idx ON public.omni_messages (conversation_id, created_at);

CREATE TABLE public.omni_quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.omni_auto_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('greeting','off_hours','order_status')),
  body text NOT NULL,
  working_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, kind)
);

-- ============ PAZARYERİ OPERASYON ============
CREATE TABLE public.marketplace_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES public.marketplace_channels(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  marketplace text NOT NULL,
  external_return_id text,
  external_order_number text,
  customer_name text,
  reason text,
  reason_detail text,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','rejected','received','refunded','cancelled')),
  is_exchange boolean NOT NULL DEFAULT false,
  auto_restock boolean NOT NULL DEFAULT false,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX marketplace_returns_store_idx ON public.marketplace_returns (store_id, status, requested_at DESC);

CREATE TABLE public.marketplace_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES public.marketplace_channels(id) ON DELETE SET NULL,
  marketplace text NOT NULL,
  external_id text,
  period_start date NOT NULL,
  period_end date NOT NULL,
  gross_amount numeric(14,2) NOT NULL DEFAULT 0,
  commission_amount numeric(14,2) NOT NULL DEFAULT 0,
  shipping_amount numeric(14,2) NOT NULL DEFAULT 0,
  service_fee numeric(14,2) NOT NULL DEFAULT 0,
  other_deductions numeric(14,2) NOT NULL DEFAULT 0,
  net_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reconciled','paid','disputed')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX marketplace_settlements_store_idx ON public.marketplace_settlements (store_id, period_start DESC);

CREATE TABLE public.marketplace_listing_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.marketplace_channels(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  external_listing_id text,
  external_barcode text,
  title text,
  price numeric(14,2),
  stock_multiplier integer NOT NULL DEFAULT 1 CHECK (stock_multiplier > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','queued','listed','error','removed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX marketplace_listing_links_idx ON public.marketplace_listing_links (store_id, channel_id, product_id);

-- ============ SÜPER ADMIN ============
CREATE TABLE public.store_admin_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note text NOT NULL,
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX store_admin_notes_store_idx ON public.store_admin_notes (store_id, created_at DESC);

CREATE TABLE public.admin_impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  reason text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
CREATE INDEX admin_impersonation_sessions_idx ON public.admin_impersonation_sessions (store_id, started_at DESC);

-- ============ PAZARLAMA & VİTRİN ============
CREATE TABLE public.store_popups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  animation text NOT NULL DEFAULT 'fade' CHECK (animation IN ('fade','slide-up','zoom','bounce','shake')),
  position text NOT NULL DEFAULT 'center' CHECK (position IN ('center','bottom-right','bottom-left','bottom-bar','top-bar')),
  headline text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  cta_label text,
  cta_url text,
  image_url text,
  accent_color text,
  display_rules jsonb NOT NULL DEFAULT '{"delaySeconds":3,"frequency":"session","pages":["all"]}'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX store_popups_store_idx ON public.store_popups (store_id, is_active);

CREATE TABLE public.store_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('instagram','facebook','whatsapp','tiktok','storefront')),
  caption text NOT NULL DEFAULT '',
  image_url text,
  link_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','queued','published','failed')),
  error text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX store_stories_store_idx ON public.store_stories (store_id, created_at DESC);

CREATE TABLE public.store_product_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('google_shopping','tiktok_shop','instagram_shop','facebook_catalog')),
  is_active boolean NOT NULL DEFAULT true,
  token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  currency text NOT NULL DEFAULT 'TRY',
  include_out_of_stock boolean NOT NULL DEFAULT false,
  category_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_built_at timestamptz,
  item_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, kind)
);

-- ============ TRIGGERS ============
CREATE TRIGGER omni_channel_accounts_touch BEFORE UPDATE ON public.omni_channel_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER omni_conversations_touch BEFORE UPDATE ON public.omni_conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER omni_auto_replies_touch BEFORE UPDATE ON public.omni_auto_replies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER marketplace_returns_touch BEFORE UPDATE ON public.marketplace_returns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER marketplace_settlements_touch BEFORE UPDATE ON public.marketplace_settlements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER marketplace_listing_links_touch BEFORE UPDATE ON public.marketplace_listing_links FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER store_popups_touch BEFORE UPDATE ON public.store_popups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER store_stories_touch BEFORE UPDATE ON public.store_stories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER store_product_feeds_touch BEFORE UPDATE ON public.store_product_feeds FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ GRANTS ============
GRANT SELECT, INSERT, UPDATE, DELETE ON public.omni_channel_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.omni_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.omni_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.omni_quick_replies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.omni_auto_replies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_returns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_settlements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_listing_links TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_admin_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_impersonation_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_popups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_stories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_product_feeds TO authenticated;
GRANT SELECT ON public.store_popups TO anon;
GRANT SELECT ON public.store_stories TO anon;
GRANT ALL ON public.omni_channel_accounts TO service_role;
GRANT ALL ON public.omni_conversations TO service_role;
GRANT ALL ON public.omni_messages TO service_role;
GRANT ALL ON public.omni_quick_replies TO service_role;
GRANT ALL ON public.omni_auto_replies TO service_role;
GRANT ALL ON public.marketplace_returns TO service_role;
GRANT ALL ON public.marketplace_settlements TO service_role;
GRANT ALL ON public.marketplace_listing_links TO service_role;
GRANT ALL ON public.store_admin_notes TO service_role;
GRANT ALL ON public.admin_impersonation_sessions TO service_role;
GRANT ALL ON public.store_popups TO service_role;
GRANT ALL ON public.store_stories TO service_role;
GRANT ALL ON public.store_product_feeds TO service_role;

-- ============ RLS ============
ALTER TABLE public.omni_channel_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omni_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omni_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omni_quick_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omni_auto_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_listing_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_admin_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_impersonation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_popups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_product_feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store managers manage omni accounts" ON public.omni_channel_accounts
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "Store members read omni conversations" ON public.omni_conversations
  FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "Store members insert omni conversations" ON public.omni_conversations
  FOR INSERT TO authenticated WITH CHECK (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "Store members update omni conversations" ON public.omni_conversations
  FOR UPDATE TO authenticated
  USING (app_private.is_store_member(store_id, auth.uid()))
  WITH CHECK (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "Store managers delete omni conversations" ON public.omni_conversations
  FOR DELETE TO authenticated USING (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "Store members read omni messages" ON public.omni_messages
  FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "Store members insert omni messages" ON public.omni_messages
  FOR INSERT TO authenticated WITH CHECK (app_private.is_store_member(store_id, auth.uid()));

CREATE POLICY "Store members read quick replies" ON public.omni_quick_replies
  FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "Store managers manage quick replies" ON public.omni_quick_replies
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "Store members read auto replies" ON public.omni_auto_replies
  FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "Store managers manage auto replies" ON public.omni_auto_replies
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "Store members read marketplace returns" ON public.marketplace_returns
  FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "Store managers manage marketplace returns" ON public.marketplace_returns
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "Store members read settlements" ON public.marketplace_settlements
  FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "Store managers manage settlements" ON public.marketplace_settlements
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "Store members read listing links" ON public.marketplace_listing_links
  FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "Store managers manage listing links" ON public.marketplace_listing_links
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE POLICY "Platform admins manage store notes" ON public.store_admin_notes
  FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'::public.app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'::public.app_role));

CREATE POLICY "Platform admins manage impersonation" ON public.admin_impersonation_sessions
  FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'::public.app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'::public.app_role));

CREATE POLICY "Store members read popups" ON public.store_popups
  FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "Store managers manage popups" ON public.store_popups
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "Public reads active popups" ON public.store_popups
  FOR SELECT TO anon USING (is_active = true);

CREATE POLICY "Store members read stories" ON public.store_stories
  FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "Store managers manage stories" ON public.store_stories
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "Public reads published stories" ON public.store_stories
  FOR SELECT TO anon USING (status = 'published');

CREATE POLICY "Store managers manage product feeds" ON public.store_product_feeds
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));