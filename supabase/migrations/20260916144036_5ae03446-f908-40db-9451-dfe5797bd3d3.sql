ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'home_maker';

CREATE TABLE public.home_maker_profiles (
  user_id uuid NOT NULL PRIMARY KEY,
  full_name text NOT NULL,
  store_name text NOT NULL,
  category text NOT NULL,
  panel_mode text NOT NULL DEFAULT 'micro',
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT home_maker_profiles_panel_mode_check CHECK (panel_mode IN ('micro', 'corporate'))
);

GRANT SELECT, INSERT, UPDATE ON public.home_maker_profiles TO authenticated;
GRANT ALL ON public.home_maker_profiles TO service_role;

ALTER TABLE public.home_maker_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "home_maker_profiles_select_own" ON public.home_maker_profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "home_maker_profiles_insert_own" ON public.home_maker_profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "home_maker_profiles_update_own" ON public.home_maker_profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER home_maker_profiles_touch
  BEFORE UPDATE ON public.home_maker_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();