ALTER TABLE public.analytics_events ADD COLUMN IF NOT EXISTS city text;
CREATE INDEX IF NOT EXISTS analytics_events_store_city_idx ON public.analytics_events (store_id, city, created_at DESC);