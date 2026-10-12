CREATE TABLE public.ai_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  models jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_model text,
  requires_api_key boolean NOT NULL DEFAULT true,
  api_key_secret_name text,
  is_enabled boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_providers TO authenticated;
GRANT ALL ON public.ai_providers TO service_role;
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_providers_read" ON public.ai_providers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ai_providers_admin_write" ON public.ai_providers
  FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'platform_admin'));

CREATE TRIGGER ai_providers_set_updated_at BEFORE UPDATE ON public.ai_providers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.store_ai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  provider_code text NOT NULL DEFAULT 'lovable',
  model text NOT NULL DEFAULT 'google/gemini-3.7-flash',
  creativity numeric(3,2) NOT NULL DEFAULT 0.70,
  brand_tone text NOT NULL DEFAULT 'premium',
  language text NOT NULL DEFAULT 'tr',
  monthly_token_limit integer NOT NULL DEFAULT 500000,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_ai_settings TO authenticated;
GRANT ALL ON public.store_ai_settings TO service_role;
ALTER TABLE public.store_ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store_ai_settings_read" ON public.store_ai_settings
  FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));
CREATE POLICY "store_ai_settings_manage" ON public.store_ai_settings
  FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

CREATE TRIGGER store_ai_settings_set_updated_at BEFORE UPDATE ON public.store_ai_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ai_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  task text NOT NULL,
  provider_code text NOT NULL DEFAULT 'lovable',
  model text NOT NULL,
  prompt text,
  output text,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  duration_ms integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  error text,
  entity text,
  entity_id text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_generations_store_created_idx ON public.ai_generations (store_id, created_at DESC);
CREATE INDEX ai_generations_store_task_idx ON public.ai_generations (store_id, task);

GRANT SELECT ON public.ai_generations TO authenticated;
GRANT ALL ON public.ai_generations TO service_role;
ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_generations_read" ON public.ai_generations
  FOR SELECT TO authenticated USING (app_private.is_store_member(store_id, auth.uid()));

INSERT INTO public.ai_providers (code, name, description, models, default_model, requires_api_key, api_key_secret_name, is_enabled, sort_order)
VALUES
  ('lovable', 'Lovable AI', 'Yerleşik ağ geçidi; Gemini ve GPT modellerine anahtar gerektirmeden erişir.',
    '["google/gemini-3.7-flash","google/gemini-3.6-flash","google/gemini-3.1-pro-preview","openai/gpt-5.5","openai/gpt-5.4-mini"]'::jsonb,
    'google/gemini-3.7-flash', false, NULL, true, 0),
  ('openai', 'OpenAI', 'GPT model ailesi; kendi OpenAI API anahtarınızla çalışır.',
    '["gpt-4.1","gpt-4o","gpt-4o-mini"]'::jsonb, 'gpt-4.1', true, 'OPENAI_API_KEY', false, 1),
  ('gemini', 'Google Gemini', 'Google Generative AI; kendi Gemini API anahtarınızla çalışır.',
    '["gemini-2.5-pro","gemini-2.5-flash"]'::jsonb, 'gemini-2.5-flash', true, 'GEMINI_API_KEY', false, 2),
  ('anthropic', 'Anthropic Claude', 'Claude model ailesi; kendi Anthropic API anahtarınızla çalışır.',
    '["claude-sonnet-4-5","claude-opus-4-1"]'::jsonb, 'claude-sonnet-4-5', true, 'ANTHROPIC_API_KEY', false, 3);