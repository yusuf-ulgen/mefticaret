ALTER TABLE public.store_themes
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS button_style text NOT NULL DEFAULT 'solid',
  ADD COLUMN IF NOT EXISTS card_style text NOT NULL DEFAULT 'soft',
  ADD COLUMN IF NOT EXISTS content_width integer NOT NULL DEFAULT 1140,
  ADD COLUMN IF NOT EXISTS section_spacing integer NOT NULL DEFAULT 48;