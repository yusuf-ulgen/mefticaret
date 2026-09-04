ALTER TABLE public.store_themes
  ADD COLUMN IF NOT EXISTS design_tokens jsonb NOT NULL DEFAULT '{}'::jsonb;