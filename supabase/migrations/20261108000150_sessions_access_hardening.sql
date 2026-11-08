-- Sessions access hardening.
--
-- Before this, any participant could UPDATE any column of their session
-- (dates, room links, outcome, status) and DELETE the row. Best practice here is
-- default-deny: clients may touch only the few columns their role needs, and
-- everything else (payment, scheduling, video room, party ids) changes only
-- through SECURITY DEFINER functions or the service role.
--
-- Coexists with payments_core's guard_session_payment_columns() (money fields,
-- paid-cancel rule); this trigger covers every other column and status flow.
-- "Client request" = current_user in (authenticated, anon), same convention as
-- payments_core; definer functions and the service role bypass.

-- ---------------------------------------------------------------- policies
DROP POLICY IF EXISTS "Participants can update sessions" ON public.sessions;
DROP POLICY IF EXISTS "Participants and Admin can update sessions" ON public.sessions;
DROP POLICY IF EXISTS "Babalawos can update their sessions" ON public.sessions;
DROP POLICY IF EXISTS "Participants update own sessions" ON public.sessions;
CREATE POLICY "Participants update own sessions" ON public.sessions
  FOR UPDATE TO authenticated
  USING (auth.uid() IN (user_id, babalawo_id))
  WITH CHECK (auth.uid() IN (user_id, babalawo_id));

-- Nobody but admins (policy "Admins can view all sessions" is FOR ALL) deletes
-- bookings: a deleted paid session would orphan payments and erase evidence.
DROP POLICY IF EXISTS "Participants and Admin can delete their sessions" ON public.sessions;

-- ----------------------------------------------------------- column + flow guard
CREATE OR REPLACE FUNCTION public.guard_session_client_updates()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
-- NOT security definer: the check below needs current_user to be the caller's role.
AS $$
DECLARE
  uid        uuid := auth.uid();
  is_bab     boolean;
  allowed    text[];
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;
  IF public.is_admin() THEN RETURN NEW; END IF;

  is_bab := uid IS NOT NULL AND uid = OLD.babalawo_id;
  IF NOT is_bab AND (uid IS NULL OR uid <> OLD.user_id) THEN
    RAISE EXCEPTION 'Not a participant of this session' USING ERRCODE = '42501';
  END IF;

  -- Whitelist: the Babalawo records the consultation outcome; the client can
  -- only move status. Any other column (including ones added later, such as
  -- meeting links or consent flags) is server-managed by default.
  IF is_bab THEN
    allowed := ARRAY['status', 'notes', 'primary_odu', 'other_odus', 'ritual_recommendations',
                     'items_needed', 'deadline', 'next_appointment', 'warning', 'updated_at'];
  ELSE
    allowed := ARRAY['status', 'updated_at'];
  END IF;

  IF (to_jsonb(NEW) - allowed) IS DISTINCT FROM (to_jsonb(OLD) - allowed) THEN
    RAISE EXCEPTION 'These session fields cannot be changed directly' USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status::text IN ('completed', 'cancelled') THEN
      RAISE EXCEPTION 'A % session cannot change status', OLD.status USING ERRCODE = '42501';
    END IF;

    IF NEW.status::text = 'cancelled' THEN
      NULL;  -- either party; paid sessions are additionally forced through cancel_session()
    ELSIF NOT is_bab THEN
      RAISE EXCEPTION 'Only the Babalawo can move a session to %', NEW.status USING ERRCODE = '42501';
    ELSIF COALESCE(OLD.payment_status::text, '') <> 'paid' THEN
      RAISE EXCEPTION 'The session must be paid before it can move to %', NEW.status USING ERRCODE = '42501';
    ELSIF NOT (
         (OLD.status::text = 'pending'     AND NEW.status::text = 'confirmed')
      OR (OLD.status::text = 'confirmed'   AND NEW.status::text IN ('in_progress', 'completed'))
      OR (OLD.status::text = 'in_progress' AND NEW.status::text = 'completed')
    ) THEN
      RAISE EXCEPTION 'Invalid status change % -> %', OLD.status, NEW.status USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_session_client_updates ON public.sessions;
CREATE TRIGGER trg_guard_session_client_updates
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.guard_session_client_updates();
