ALTER TABLE public.xml_feeds
  ADD COLUMN IF NOT EXISTS variant_mode text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS variant_config jsonb NOT NULL DEFAULT '{"parent_node_path": "", "variant_node_path": "", "parent_sku_field": "", "option_attributes": []}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.xml_feeds'::regclass AND conname = 'xml_feeds_variant_mode_check'
  ) THEN
    ALTER TABLE public.xml_feeds
      ADD CONSTRAINT xml_feeds_variant_mode_check CHECK (variant_mode IN ('none', 'nested', 'flat'));
  END IF;
END $$;