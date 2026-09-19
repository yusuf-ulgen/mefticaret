DROP TRIGGER IF EXISTS translation_entries_version ON public.translation_entries;

CREATE OR REPLACE FUNCTION public.record_translation_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(OLD.translated_value,'') = COALESCE(NEW.translated_value,'') THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.translation_versions (store_id, entry_id, locale, translation_key, old_value, new_value, version, changed_by)
  VALUES (NEW.store_id, NEW.id, NEW.locale, NEW.translation_key,
          OLD.translated_value, NEW.translated_value, NEW.version,
          COALESCE(NEW.updated_by, auth.uid()));
  RETURN NULL;
END;
$function$;

CREATE TRIGGER translation_entries_version
AFTER UPDATE ON public.translation_entries
FOR EACH ROW EXECUTE FUNCTION public.record_translation_version();