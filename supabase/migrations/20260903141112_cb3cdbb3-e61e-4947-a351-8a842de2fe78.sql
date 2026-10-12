alter table public.analytics_events drop constraint if exists analytics_events_kind_check;
alter table public.analytics_events add constraint analytics_events_kind_check check (kind = any (array['page_view'::text,'product_view'::text,'add_to_cart'::text,'checkout'::text,'purchase'::text,'search'::text]));
alter table public.analytics_events add column if not exists search_term text;
alter table public.analytics_events add column if not exists search_results integer;
create index if not exists analytics_events_search_idx on public.analytics_events (store_id, created_at desc) where kind = 'search';