CREATE OR REPLACE FUNCTION public.publish_theme_version(_store_id uuid, _label text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  _snapshot jsonb;
  _id uuid;
BEGIN
  SELECT jsonb_build_object(
           'theme', to_jsonb(t),
           'sections', COALESCE((
             SELECT jsonb_agg(to_jsonb(s) ORDER BY s.position)
               FROM public.store_theme_sections s WHERE s.store_id = _store_id), '[]'::jsonb))
    INTO _snapshot
    FROM public.store_themes t
   WHERE t.store_id = _store_id;

  IF _snapshot IS NULL THEN
    RAISE EXCEPTION 'Bu mağaza için tema kaydı bulunamadı';
  END IF;

  UPDATE public.store_themes
     SET is_published = true, published_at = now(), updated_at = now()
   WHERE store_id = _store_id;

  UPDATE public.store_theme_versions SET is_published = false WHERE store_id = _store_id;

  INSERT INTO public.store_theme_versions (store_id, label, snapshot, is_published, created_by)
  VALUES (_store_id,
          COALESCE(NULLIF(btrim(_label), ''), 'Yayın ' || to_char(now(), 'DD.MM.YYYY HH24:MI')),
          _snapshot, true, auth.uid())
  RETURNING id INTO _id;

  RETURN _id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.restore_theme_version(_version_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  _v public.store_theme_versions;
  _theme jsonb;
BEGIN
  SELECT * INTO _v FROM public.store_theme_versions WHERE id = _version_id;
  IF _v.id IS NULL THEN RAISE EXCEPTION 'Tema sürümü bulunamadı'; END IF;

  _theme := _v.snapshot -> 'theme';

  UPDATE public.store_themes t SET
    preset = r.preset,
    primary_color = r.primary_color,
    accent_color = r.accent_color,
    background_color = r.background_color,
    font_pair = r.font_pair,
    radius = r.radius,
    layout = r.layout,
    hero_title = r.hero_title,
    hero_subtitle = r.hero_subtitle,
    hero_cta_label = r.hero_cta_label,
    announcement = r.announcement,
    show_announcement = r.show_announcement,
    custom_css = r.custom_css,
    custom_js = r.custom_js,
    logo_url = r.logo_url,
    button_style = r.button_style,
    card_style = r.card_style,
    content_width = r.content_width,
    section_spacing = r.section_spacing,
    updated_at = now()
  FROM jsonb_populate_record(NULL::public.store_themes, _theme) r
  WHERE t.store_id = _v.store_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tema güncellenemedi: yetkiniz yok veya tema bulunamadı';
  END IF;

  DELETE FROM public.store_theme_sections WHERE store_id = _v.store_id;

  INSERT INTO public.store_theme_sections (store_id, type, position, is_enabled, settings, visibility)
  SELECT _v.store_id,
         x ->> 'type',
         COALESCE((x ->> 'position')::int, 0),
         COALESCE((x ->> 'is_enabled')::boolean, true),
         COALESCE(x -> 'settings', '{}'::jsonb),
         COALESCE(x -> 'visibility', '{"desktop":true,"tablet":true,"mobile":true}'::jsonb)
    FROM jsonb_array_elements(COALESCE(_v.snapshot -> 'sections', '[]'::jsonb)) x;

  UPDATE public.store_theme_versions SET is_published = (id = _version_id) WHERE store_id = _v.store_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.publish_theme_version(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_theme_version(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_theme_version(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_theme_version(uuid) TO authenticated, service_role;