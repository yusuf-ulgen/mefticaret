CREATE TABLE IF NOT EXISTS public.competitor_products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name text NOT NULL,
  url text,
  source text NOT NULL DEFAULT 'web',
  competitor_title text,
  competitor_description text,
  competitor_category text,
  competitor_price numeric,
  previous_price numeric,
  currency text NOT NULL DEFAULT 'TRY',
  visibility_score integer,
  serp_position integer,
  content_score integer,
  ai_analysis text,
  ai_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  alert_threshold_pct numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  last_checked_at timestamptz,
  last_price_change_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.competitor_price_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  competitor_id uuid NOT NULL REFERENCES public.competitor_products(id) ON DELETE CASCADE,
  price numeric NOT NULL,
  currency text NOT NULL DEFAULT 'TRY',
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_content_drafts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid,
  kind text NOT NULL,
  tone text,
  title text,
  content text NOT NULL DEFAULT '',
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  applied_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS competitor_products_store_idx ON public.competitor_products (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS competitor_products_product_idx ON public.competitor_products (product_id);
CREATE INDEX IF NOT EXISTS competitor_price_history_idx ON public.competitor_price_history (competitor_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS ai_content_drafts_store_idx ON public.ai_content_drafts (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_content_drafts_entity_idx ON public.ai_content_drafts (store_id, entity_type, entity_id);

DROP TRIGGER IF EXISTS competitor_products_updated_at ON public.competitor_products;
CREATE TRIGGER competitor_products_updated_at BEFORE UPDATE ON public.competitor_products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS ai_content_drafts_updated_at ON public.ai_content_drafts;
CREATE TRIGGER ai_content_drafts_updated_at BEFORE UPDATE ON public.ai_content_drafts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitor_products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitor_price_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_content_drafts TO authenticated;
GRANT ALL ON public.competitor_products TO service_role;
GRANT ALL ON public.competitor_price_history TO service_role;
GRANT ALL ON public.ai_content_drafts TO service_role;

ALTER TABLE public.competitor_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_content_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "competitor products managers" ON public.competitor_products;
CREATE POLICY "competitor products managers" ON public.competitor_products
FOR ALL TO authenticated
USING (app_private.can_manage_store(store_id, auth.uid()))
WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

DROP POLICY IF EXISTS "competitor price history managers" ON public.competitor_price_history;
CREATE POLICY "competitor price history managers" ON public.competitor_price_history
FOR ALL TO authenticated
USING (app_private.can_manage_store(store_id, auth.uid()))
WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));

DROP POLICY IF EXISTS "ai content drafts managers" ON public.ai_content_drafts;
CREATE POLICY "ai content drafts managers" ON public.ai_content_drafts
FOR ALL TO authenticated
USING (app_private.can_manage_store(store_id, auth.uid()))
WITH CHECK (app_private.can_manage_store(store_id, auth.uid()));