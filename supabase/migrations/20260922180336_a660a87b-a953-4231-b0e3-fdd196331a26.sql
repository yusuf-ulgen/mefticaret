ALTER TABLE public.xml_import_logs
  ADD COLUMN IF NOT EXISTS unchanged_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delta_sync_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.xml_feeds
  ADD COLUMN IF NOT EXISTS delta_sync_config jsonb NOT NULL DEFAULT jsonb_build_object(
    'enabled', true,
    'hash_fields', jsonb_build_array('price', 'stock', 'title', 'images'),
    'force_full_sync_hours', 168
  );