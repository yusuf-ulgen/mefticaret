ALTER TYPE public.xml_schedule ADD VALUE IF NOT EXISTS 'custom';
ALTER TABLE public.xml_feeds ADD COLUMN IF NOT EXISTS cron_expression text;
ALTER TABLE public.xml_feeds ADD CONSTRAINT xml_feeds_cron_expression_len CHECK (cron_expression IS NULL OR char_length(cron_expression) BETWEEN 9 AND 100);