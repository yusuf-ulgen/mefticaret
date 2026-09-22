DO $$
BEGIN
  FOR i IN 1..1 LOOP NULL; END LOOP;
END $$;

ALTER TABLE public.xml_feeds REPLICA IDENTITY FULL;
ALTER TABLE public.xml_import_logs REPLICA IDENTITY FULL;
ALTER TABLE public.xml_export_logs REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='xml_feeds') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.xml_feeds;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='xml_import_logs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.xml_import_logs;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='xml_export_logs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.xml_export_logs;
  END IF;
END $$;