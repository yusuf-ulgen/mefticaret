ALTER TABLE public.xml_feeds
  ADD COLUMN IF NOT EXISTS connection_type text NOT NULL DEFAULT 'url',
  ADD COLUMN IF NOT EXISTS ftp_config jsonb NOT NULL DEFAULT jsonb_build_object(
    'host', '',
    'port', 21,
    'username', '',
    'password', '',
    'passive', true,
    'ssl', false,
    'file_path', '/export/products.xml'
  ),
  ADD COLUMN IF NOT EXISTS webhook_token text NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public.xml_feeds
  DROP CONSTRAINT IF EXISTS xml_feeds_connection_type_check;

ALTER TABLE public.xml_feeds
  ADD CONSTRAINT xml_feeds_connection_type_check
  CHECK (connection_type IN ('url', 'ftp', 'sftp', 'webhook'));

CREATE UNIQUE INDEX IF NOT EXISTS xml_feeds_webhook_token_key
  ON public.xml_feeds (webhook_token);