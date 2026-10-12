-- ENUMS
CREATE TYPE public.message_channel AS ENUM ('email','sms','whatsapp','push');
CREATE TYPE public.automation_trigger AS ENUM ('cart_abandoned','order_placed','order_paid','order_shipped','order_delivered','customer_created','back_in_stock','review_received','manual');
CREATE TYPE public.automation_step_kind AS ENUM ('wait','email','sms','whatsapp','push','condition','end');
CREATE TYPE public.automation_condition AS ENUM ('order_placed','order_paid','email_opened','has_tag','cart_still_active');
CREATE TYPE public.automation_run_status AS ENUM ('active','waiting','completed','stopped','failed');
CREATE TYPE public.message_delivery_status AS ENUM ('queued','sent','delivered','read','failed');
CREATE TYPE public.whatsapp_direction AS ENUM ('inbound','outbound');

-- MESSAGE TEMPLATES
CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  channel public.message_channel NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  subject text,
  body text NOT NULL DEFAULT '',
  whatsapp_template_name text,
  whatsapp_language text NOT NULL DEFAULT 'tr',
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates read" ON public.message_templates FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "templates write" ON public.message_templates FOR INSERT TO authenticated WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "templates update" ON public.message_templates FOR UPDATE TO authenticated USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "templates delete" ON public.message_templates FOR DELETE TO authenticated USING (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER message_templates_set_updated_at BEFORE UPDATE ON public.message_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- WORKFLOWS
CREATE TABLE public.automation_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  trigger_event public.automation_trigger NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  runs_count integer NOT NULL DEFAULT 0,
  completed_count integer NOT NULL DEFAULT 0,
  messages_sent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_workflows TO authenticated;
GRANT ALL ON public.automation_workflows TO service_role;
ALTER TABLE public.automation_workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wf read" ON public.automation_workflows FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "wf insert" ON public.automation_workflows FOR INSERT TO authenticated WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "wf update" ON public.automation_workflows FOR UPDATE TO authenticated USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "wf delete" ON public.automation_workflows FOR DELETE TO authenticated USING (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER automation_workflows_set_updated_at BEFORE UPDATE ON public.automation_workflows FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- STEPS
CREATE TABLE public.automation_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.automation_workflows(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  kind public.automation_step_kind NOT NULL,
  title text,
  wait_minutes integer NOT NULL DEFAULT 0,
  template_id uuid REFERENCES public.message_templates(id) ON DELETE SET NULL,
  condition_kind public.automation_condition,
  on_true text NOT NULL DEFAULT 'end',
  on_false text NOT NULL DEFAULT 'continue',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX automation_steps_workflow_idx ON public.automation_steps(workflow_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_steps TO authenticated;
GRANT ALL ON public.automation_steps TO service_role;
ALTER TABLE public.automation_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "steps read" ON public.automation_steps FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "steps insert" ON public.automation_steps FOR INSERT TO authenticated WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "steps update" ON public.automation_steps FOR UPDATE TO authenticated USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "steps delete" ON public.automation_steps FOR DELETE TO authenticated USING (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER automation_steps_set_updated_at BEFORE UPDATE ON public.automation_steps FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RUNS
CREATE TABLE public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.automation_workflows(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  cart_id uuid REFERENCES public.abandoned_carts(id) ON DELETE SET NULL,
  status public.automation_run_status NOT NULL DEFAULT 'active',
  current_position integer NOT NULL DEFAULT 0,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX automation_runs_due_idx ON public.automation_runs(status, next_run_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_runs TO authenticated;
GRANT ALL ON public.automation_runs TO service_role;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "runs read" ON public.automation_runs FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "runs insert" ON public.automation_runs FOR INSERT TO authenticated WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "runs update" ON public.automation_runs FOR UPDATE TO authenticated USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "runs delete" ON public.automation_runs FOR DELETE TO authenticated USING (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER automation_runs_set_updated_at BEFORE UPDATE ON public.automation_runs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RUN EVENTS
CREATE TABLE public.automation_run_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.automation_runs(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  step_id uuid REFERENCES public.automation_steps(id) ON DELETE SET NULL,
  kind public.automation_step_kind NOT NULL,
  outcome text NOT NULL DEFAULT 'ok',
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX automation_run_events_run_idx ON public.automation_run_events(run_id, created_at DESC);
GRANT SELECT, INSERT ON public.automation_run_events TO authenticated;
GRANT ALL ON public.automation_run_events TO service_role;
ALTER TABLE public.automation_run_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "run events read" ON public.automation_run_events FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "run events insert" ON public.automation_run_events FOR INSERT TO authenticated WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

-- MESSAGE DELIVERIES
CREATE TABLE public.message_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  channel public.message_channel NOT NULL,
  run_id uuid REFERENCES public.automation_runs(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.message_templates(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  recipient text NOT NULL,
  subject text,
  body text NOT NULL DEFAULT '',
  status public.message_delivery_status NOT NULL DEFAULT 'queued',
  provider_message_id text,
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX message_deliveries_store_idx ON public.message_deliveries(store_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.message_deliveries TO authenticated;
GRANT ALL ON public.message_deliveries TO service_role;
ALTER TABLE public.message_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deliveries read" ON public.message_deliveries FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "deliveries insert" ON public.message_deliveries FOR INSERT TO authenticated WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "deliveries update" ON public.message_deliveries FOR UPDATE TO authenticated USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER message_deliveries_set_updated_at BEFORE UPDATE ON public.message_deliveries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- WHATSAPP ACCOUNTS
CREATE TABLE public.whatsapp_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  display_phone text NOT NULL,
  phone_number_id text NOT NULL,
  waba_id text,
  verify_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  business_name text,
  status text NOT NULL DEFAULT 'disconnected',
  auto_reply_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_accounts TO authenticated;
GRANT ALL ON public.whatsapp_accounts TO service_role;
ALTER TABLE public.whatsapp_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa account read" ON public.whatsapp_accounts FOR SELECT TO authenticated USING (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "wa account insert" ON public.whatsapp_accounts FOR INSERT TO authenticated WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "wa account update" ON public.whatsapp_accounts FOR UPDATE TO authenticated USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "wa account delete" ON public.whatsapp_accounts FOR DELETE TO authenticated USING (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER whatsapp_accounts_set_updated_at BEFORE UPDATE ON public.whatsapp_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- WHATSAPP CONVERSATIONS
CREATE TABLE public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  wa_id text NOT NULL,
  contact_name text,
  status text NOT NULL DEFAULT 'open',
  unread_count integer NOT NULL DEFAULT 0,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, wa_id)
);
CREATE INDEX whatsapp_conversations_store_idx ON public.whatsapp_conversations(store_id, last_message_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversations TO authenticated;
GRANT ALL ON public.whatsapp_conversations TO service_role;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa conv read" ON public.whatsapp_conversations FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "wa conv insert" ON public.whatsapp_conversations FOR INSERT TO authenticated WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "wa conv update" ON public.whatsapp_conversations FOR UPDATE TO authenticated USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "wa conv delete" ON public.whatsapp_conversations FOR DELETE TO authenticated USING (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER whatsapp_conversations_set_updated_at BEFORE UPDATE ON public.whatsapp_conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- WHATSAPP MESSAGES
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  direction public.whatsapp_direction NOT NULL,
  wa_message_id text,
  message_type text NOT NULL DEFAULT 'text',
  body text NOT NULL DEFAULT '',
  template_name text,
  status public.message_delivery_status NOT NULL DEFAULT 'queued',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX whatsapp_messages_conv_idx ON public.whatsapp_messages(conversation_id, created_at);
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa msg read" ON public.whatsapp_messages FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "wa msg insert" ON public.whatsapp_messages FOR INSERT TO authenticated WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "wa msg update" ON public.whatsapp_messages FOR UPDATE TO authenticated USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

-- WHATSAPP AUTO REPLIES
CREATE TABLE public.whatsapp_auto_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  match_type text NOT NULL DEFAULT 'contains',
  reply_body text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_auto_replies TO authenticated;
GRANT ALL ON public.whatsapp_auto_replies TO service_role;
ALTER TABLE public.whatsapp_auto_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa reply read" ON public.whatsapp_auto_replies FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "wa reply insert" ON public.whatsapp_auto_replies FOR INSERT TO authenticated WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "wa reply update" ON public.whatsapp_auto_replies FOR UPDATE TO authenticated USING (app_private.can_manage_store(store_id, auth.uid())) WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));
CREATE POLICY "wa reply delete" ON public.whatsapp_auto_replies FOR DELETE TO authenticated USING (app_private.can_manage_store(store_id, auth.uid()));
CREATE TRIGGER whatsapp_auto_replies_set_updated_at BEFORE UPDATE ON public.whatsapp_auto_replies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();