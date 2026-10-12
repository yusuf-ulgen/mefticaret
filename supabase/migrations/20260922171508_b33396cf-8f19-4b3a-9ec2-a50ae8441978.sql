ALTER TABLE public.xml_category_mappings
  ADD COLUMN IF NOT EXISTS ai_confidence numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_ai_suggested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_reasoning text;

ALTER TABLE public.xml_feeds
  ADD COLUMN IF NOT EXISTS ai_auto_map_enabled boolean NOT NULL DEFAULT true;