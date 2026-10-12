CREATE OR REPLACE FUNCTION app_private.guard_store_owner_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR app_private.has_role(auth.uid(), 'platform_admin'::app_role)
     OR OLD.owner_id = auth.uid() THEN
    RETURN NEW;
  END IF;
  NEW.owner_id := OLD.owner_id;
  NEW.plan_id := OLD.plan_id;
  NEW.is_demo := OLD.is_demo;
  NEW.store_kind := OLD.store_kind;
  RETURN NEW;
END;
$$;

UPDATE public.stores
SET plan_id = NULL,
    updated_at = now()
WHERE store_kind = 'micro'
  AND plan_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_micro_store_billing_isolation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _kind text;
BEGIN
  IF TG_TABLE_NAME = 'stores' THEN
    IF NEW.store_kind = 'micro' AND NEW.plan_id IS NOT NULL THEN
      RAISE EXCEPTION 'Kolay Panel mağazalarına kurumsal paket bağlanamaz';
    END IF;
    RETURN NEW;
  END IF;

  SELECT store_kind INTO _kind FROM public.stores WHERE id = NEW.store_id;
  IF _kind = 'micro' THEN
    RAISE EXCEPTION 'Kolay Panel mağazalarına kurumsal abonelik bağlanamaz';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stores_enforce_micro_billing ON public.stores;
CREATE TRIGGER stores_enforce_micro_billing
BEFORE INSERT OR UPDATE OF store_kind, plan_id ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.enforce_micro_store_billing_isolation();

DROP TRIGGER IF EXISTS subscriptions_enforce_micro_billing ON public.subscriptions;
CREATE TRIGGER subscriptions_enforce_micro_billing
BEFORE INSERT OR UPDATE OF store_id, plan_id ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.enforce_micro_store_billing_isolation();

REVOKE ALL ON FUNCTION public.enforce_micro_store_billing_isolation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_micro_store_billing_isolation() TO service_role;

CREATE OR REPLACE FUNCTION public.create_home_maker_store(
  _user_id uuid,
  _full_name text,
  _store_name text,
  _category text,
  _slug_base text
)
RETURNS TABLE(store_id uuid, store_slug text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing uuid;
  _id uuid;
  _slug text;
  _attempt integer := 0;
  _published_at timestamptz := now();
BEGIN
  SELECT h.store_id INTO _existing
  FROM public.home_maker_profiles h
  JOIN public.stores s ON s.id = h.store_id
  WHERE h.user_id = _user_id AND s.store_kind = 'micro';

  IF _existing IS NOT NULL THEN
    RETURN QUERY SELECT s.id, s.slug FROM public.stores s WHERE s.id = _existing;
    RETURN;
  END IF;

  _slug := NULLIF(trim(_slug_base), '');
  IF _slug IS NULL THEN _slug := 'magaza'; END IF;

  WHILE EXISTS (SELECT 1 FROM public.stores s WHERE s.slug = _slug) LOOP
    _attempt := _attempt + 1;
    _slug := left(_slug_base, 105) || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 4);
    IF _attempt > 20 THEN RAISE EXCEPTION 'Benzersiz mağaza adresi oluşturulamadı'; END IF;
  END LOOP;

  INSERT INTO public.stores (
    owner_id, name, slug, industry, currency, locale, plan_id, store_kind,
    onboarding_step, onboarding_completed, status, published_at, is_demo
  ) VALUES (
    _user_id, _store_name, _slug, _category, 'TRY', 'tr', NULL, 'micro',
    4, true, 'active', _published_at, false
  ) RETURNING id INTO _id;

  INSERT INTO public.store_users (store_id, user_id, role, permissions)
  VALUES (_id, _user_id, 'owner', ARRAY['*']::text[]);

  INSERT INTO public.store_settings (store_id, bio)
  VALUES (_id, _category || ' ürünleri');

  INSERT INTO public.store_domains (
    store_id, hostname, type, is_primary, status, ssl_active, verified_at
  ) VALUES (
    _id, _slug || '.mefticaret.com', 'subdomain', true, 'verified', true, _published_at
  );

  INSERT INTO public.store_themes (
    store_id, preset, primary_color, accent_color, background_color, font_pair,
    radius, layout, hero_title, hero_subtitle, hero_cta_label, announcement,
    show_announcement, button_style, card_style, content_width, section_spacing,
    is_published, published_at
  ) VALUES (
    _id, 'home-maker-shop', '#11162f', '#6d28d9', '#ffffff', 'sora-manrope',
    0.75, 'card-grid', _store_name, _category || ' ürünleri', 'Ürünleri incele', NULL,
    false, 'solid', 'flat', 900, 32, true, _published_at
  );

  INSERT INTO public.home_maker_profiles (
    user_id, full_name, store_name, category, store_id, panel_mode
  ) VALUES (
    _user_id, _full_name, _store_name, _category, _id, 'micro'
  ) ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    store_name = EXCLUDED.store_name,
    category = EXCLUDED.category,
    store_id = EXCLUDED.store_id,
    panel_mode = 'micro',
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'home_maker')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN QUERY SELECT _id, _slug;
END;
$$;

REVOKE ALL ON FUNCTION public.create_home_maker_store(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_home_maker_store(uuid, text, text, text, text) TO service_role;