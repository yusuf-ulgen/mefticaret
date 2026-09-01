CREATE OR REPLACE FUNCTION public.guard_support_ticket_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF app_private.has_role(auth.uid(), 'platform_admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.store_id IS DISTINCT FROM OLD.store_id
     OR NEW.requester_id IS DISTINCT FROM OLD.requester_id
     OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    RAISE EXCEPTION 'Bu alanları yalnızca platform yöneticisi değiştirebilir';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status NOT IN ('open'::public.support_ticket_status,
                            'pending'::public.support_ticket_status,
                            'closed'::public.support_ticket_status) THEN
    RAISE EXCEPTION 'Bu durum yalnızca platform yöneticisi tarafından atanabilir';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_tickets_guard_update ON public.support_tickets;
CREATE TRIGGER support_tickets_guard_update
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.guard_support_ticket_update();

DROP POLICY IF EXISTS "Ilgili taraflar talebi guncelleyebilir" ON public.support_tickets;
CREATE POLICY "Ilgili taraflar talebi guncelleyebilir"
  ON public.support_tickets FOR UPDATE
  TO authenticated
  USING (
    requester_id = auth.uid()
    OR (store_id IS NOT NULL AND app_private.is_store_member(store_id, auth.uid()))
  )
  WITH CHECK (
    requester_id = auth.uid()
    OR (store_id IS NOT NULL AND app_private.is_store_member(store_id, auth.uid()))
  );

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.support_ticket_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;