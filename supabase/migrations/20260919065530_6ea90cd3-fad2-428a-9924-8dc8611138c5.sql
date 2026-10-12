CREATE OR REPLACE FUNCTION public.bump_translation_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF COALESCE(OLD.translated_value,'') <> COALESCE(NEW.translated_value,'') THEN
    NEW.version := COALESCE(OLD.version, 1) + 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_translation_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.translated_value,'') = COALESCE(NEW.translated_value,'') THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.translation_versions (store_id, entry_id, locale, translation_key, old_value, new_value, version, changed_by)
  VALUES (NEW.store_id, NEW.id, NEW.locale, NEW.translation_key,
          CASE WHEN TG_OP = 'UPDATE' THEN OLD.translated_value ELSE NULL END,
          NEW.translated_value, NEW.version, COALESCE(NEW.updated_by, auth.uid()));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS translation_entries_version ON public.translation_entries;
CREATE TRIGGER translation_entries_bump_version
  BEFORE UPDATE ON public.translation_entries
  FOR EACH ROW EXECUTE FUNCTION public.bump_translation_version();
CREATE TRIGGER translation_entries_version
  AFTER INSERT OR UPDATE ON public.translation_entries
  FOR EACH ROW EXECUTE FUNCTION public.record_translation_version();

REVOKE ALL ON FUNCTION public.bump_translation_version() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.record_translation_version() FROM anon, authenticated, PUBLIC;