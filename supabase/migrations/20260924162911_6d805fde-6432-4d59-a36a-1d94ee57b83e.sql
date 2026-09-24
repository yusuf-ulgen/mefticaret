ALTER TABLE public.analytics_events DROP CONSTRAINT analytics_events_kind_check;
ALTER TABLE public.analytics_events ADD CONSTRAINT analytics_events_kind_check
  CHECK (kind = ANY (ARRAY['page_view','page_leave','product_view','add_to_cart','checkout','purchase','search']));
ALTER TABLE public.analytics_events ADD CONSTRAINT analytics_events_time_on_page_check
  CHECK (time_on_page_ms IS NULL OR (time_on_page_ms >= 0 AND time_on_page_ms <= 86400000));