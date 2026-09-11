CREATE TABLE public.admin_panel_auth (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  totp_secret text,
  totp_enrolled_at timestamptz,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  last_login_ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.admin_panel_auth TO service_role;

ALTER TABLE public.admin_panel_auth ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER admin_panel_auth_touch
BEFORE UPDATE ON public.admin_panel_auth
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.admin_panel_auth (user_id, email)
SELECT u.id, u.email
FROM auth.users u
WHERE u.email = 'utebaylargrup@gmail.com'
ON CONFLICT (user_id) DO NOTHING;