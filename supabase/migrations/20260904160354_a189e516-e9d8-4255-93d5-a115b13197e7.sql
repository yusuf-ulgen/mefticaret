ALTER TABLE public.platform_seo_ai_settings
  ADD COLUMN IF NOT EXISTS run_days smallint[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6]::smallint[],
  ADD COLUMN IF NOT EXISTS daily_minute smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS concurrency smallint NOT NULL DEFAULT 4;