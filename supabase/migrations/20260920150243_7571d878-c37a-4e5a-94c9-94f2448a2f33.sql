CREATE POLICY "webauthn_challenges_no_client_access" ON public.webauthn_challenges
  FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);