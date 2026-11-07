-- Roles table, privilege-escalation guards, admin audit log, disputes and admin RPCs.
-- Owner: "Secure users, roles and admin" workstream.
--
-- BOOTSTRAPPING THE FIRST ADMIN (run once in the Supabase SQL editor, as postgres):
--   insert into public.user_roles (user_id, role)
--   select id, 'admin' from auth.users where email = 'you@example.com'
--   on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 1. user_roles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.user_role NOT NULL,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Backfill from the legacy profiles.role column (every user gets 'user').
INSERT INTO public.user_roles (user_id, role)
SELECT id, COALESCE(role, 'user') FROM public.profiles
ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user' FROM public.profiles
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Role helpers (SECURITY DEFINER so RLS on user_roles cannot recurse)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.user_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

CREATE OR REPLACE FUNCTION public.get_my_roles()
RETURNS public.user_role[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(array_agg(role), ARRAY[]::public.user_role[])
  FROM public.user_roles WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.user_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.user_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_roles() TO authenticated, service_role;

-- user_roles policies: read your own roles (admins read all). NO client writes at all;
-- roles change only through admin_set_user_role() or the service role.
DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. Keep profiles.role as a read-only mirror (highest privilege wins)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_profile_role()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := COALESCE(NEW.user_id, OLD.user_id);
  top public.user_role;
BEGIN
  SELECT CASE
           WHEN bool_or(role = 'admin') THEN 'admin'
           WHEN bool_or(role = 'babalawo') THEN 'babalawo'
           ELSE 'user' END::public.user_role
    INTO top FROM public.user_roles WHERE user_id = uid;
  PERFORM set_config('app.role_sync', '1', true);
  UPDATE public.profiles SET role = COALESCE(top, 'user') WHERE id = uid;
  PERFORM set_config('app.role_sync', '', true);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_role ON public.user_roles;
CREATE TRIGGER trg_sync_profile_role
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_role();

-- ---------------------------------------------------------------------------
-- 4. Close privilege escalation on profiles
--    * role cannot be changed by any logged-in client
--    * clients cannot create a profile with an elevated role
--    (auth.uid() IS NULL = service role / SQL editor / auth triggers: allowed)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_profile_role()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR current_setting('app.role_sync', true) = '1' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.role := 'user';
  ELSIF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Changing roles is not permitted' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_role ON public.profiles;
CREATE TRIGGER trg_guard_profile_role
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_reason text,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

-- Suspension fields are admin-only too.
CREATE OR REPLACE FUNCTION public.guard_profile_suspension()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin()
     AND (NEW.is_suspended IS DISTINCT FROM OLD.is_suspended
          OR NEW.suspended_reason IS DISTINCT FROM OLD.suspended_reason
          OR NEW.suspended_at IS DISTINCT FROM OLD.suspended_at) THEN
    RAISE EXCEPTION 'Only admins can change suspension' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_profile_suspension ON public.profiles;
CREATE TRIGGER trg_guard_profile_suspension
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_suspension();

CREATE OR REPLACE FUNCTION public.is_suspended(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE((SELECT is_suspended FROM public.profiles WHERE id = _user_id), false); $$;
GRANT EXECUTE ON FUNCTION public.is_suspended(uuid) TO authenticated, service_role;

-- Suspended users cannot book new sessions.
DROP POLICY IF EXISTS "Suspended users cannot book" ON public.sessions;
CREATE POLICY "Suspended users cannot book" ON public.sessions
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_suspended(auth.uid()));

-- ---------------------------------------------------------------------------
-- 5. New-user trigger: only 'user' / 'babalawo' can be self-selected at signup
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  wanted text := COALESCE(NEW.raw_user_meta_data->>'role', 'user');
  effective public.user_role := CASE WHEN wanted = 'babalawo' THEN 'babalawo' ELSE 'user' END;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), effective)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;

  IF effective = 'babalawo' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'babalawo') ON CONFLICT DO NOTHING;
    -- Babalawo rows start unverified and hidden until an admin approves them.
    BEGIN
      INSERT INTO public.babalawos (user_id, is_verified, is_active)
      VALUES (NEW.id, false, true);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'handle_new_user: babalawo row not created: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Babalawo verification state is admin-controlled
-- ---------------------------------------------------------------------------
ALTER TABLE public.babalawos
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending','approved','rejected','suspended')),
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- Already-verified babalawos stay approved.
UPDATE public.babalawos SET review_status = 'approved' WHERE is_verified = true AND review_status = 'pending';

CREATE OR REPLACE FUNCTION public.guard_babalawo_admin_fields()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.is_verified := false;
    NEW.is_featured := false;
    NEW.review_status := 'pending';
    NEW.review_notes := NULL; NEW.reviewed_by := NULL; NEW.reviewed_at := NULL;
    NEW.rating := 0;
    NEW.total_sessions := 0;
    NEW.commission_platform_percent := 20;
    NEW.commission_babalawo_percent := 80;
  ELSIF NEW.is_verified IS DISTINCT FROM OLD.is_verified
     OR NEW.is_featured IS DISTINCT FROM OLD.is_featured
     OR NEW.review_status IS DISTINCT FROM OLD.review_status
     OR NEW.review_notes IS DISTINCT FROM OLD.review_notes
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.rating IS DISTINCT FROM OLD.rating
     OR NEW.total_sessions IS DISTINCT FROM OLD.total_sessions
     OR NEW.commission_platform_percent IS DISTINCT FROM OLD.commission_platform_percent
     OR NEW.commission_babalawo_percent IS DISTINCT FROM OLD.commission_babalawo_percent
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'These fields can only be changed by an admin' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_babalawo_admin_fields ON public.babalawos;
CREATE TRIGGER trg_guard_babalawo_admin_fields
  BEFORE INSERT OR UPDATE ON public.babalawos
  FOR EACH ROW EXECUTE FUNCTION public.guard_babalawo_admin_fields();

-- Only users who actually hold the babalawo role may own a babalawo row.
DROP POLICY IF EXISTS "Babalawos can manage their own profile" ON public.babalawos;
CREATE POLICY "Babalawos can manage their own profile" ON public.babalawos
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.has_role(auth.uid(), 'babalawo'))
  WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(), 'babalawo'));

-- ---------------------------------------------------------------------------
-- 7. Notifications: no spoofing other users
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Users or admins insert notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- ---------------------------------------------------------------------------
-- 8. Admin audit log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action      text NOT NULL,
  target_type text NOT NULL,
  target_id   text,
  details     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_log(created_at DESC);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read audit log" ON public.admin_audit_log;
CREATE POLICY "Admins read audit log" ON public.admin_audit_log
  FOR SELECT TO authenticated USING (public.is_admin());
-- no client INSERT/UPDATE/DELETE: written only by the SECURITY DEFINER RPCs below.

CREATE OR REPLACE FUNCTION public._admin_log(_action text, _type text, _target text, _details jsonb)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
      VALUES (auth.uid(), _action, _type, _target, COALESCE(_details, '{}'::jsonb)); $$;
REVOKE ALL ON FUNCTION public._admin_log(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._require_admin()
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public._require_admin() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. Disputes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.disputes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  raised_by       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason          text NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 4000),
  status          text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','investigating','resolved_refund','resolved_dismissed')),
  resolution_note text,
  refund_requested boolean NOT NULL DEFAULT false,
  resolved_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON public.disputes(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_disputes_session ON public.disputes(session_id);
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants view own disputes" ON public.disputes;
CREATE POLICY "Participants view own disputes" ON public.disputes
  FOR SELECT TO authenticated USING (
    public.is_admin() OR raised_by = auth.uid() OR EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = disputes.session_id AND (s.user_id = auth.uid() OR s.babalawo_id = auth.uid())));

DROP POLICY IF EXISTS "Participants raise disputes" ON public.disputes;
CREATE POLICY "Participants raise disputes" ON public.disputes
  FOR INSERT TO authenticated WITH CHECK (
    raised_by = auth.uid() AND status = 'open' AND resolved_by IS NULL AND resolution_note IS NULL
    AND EXISTS (SELECT 1 FROM public.sessions s
                WHERE s.id = session_id AND (s.user_id = auth.uid() OR s.babalawo_id = auth.uid())));
-- no UPDATE/DELETE policy: only admin_resolve_dispute() changes disputes.

-- ---------------------------------------------------------------------------
-- 10. Admin RPCs (all SECURITY DEFINER, all audited)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user_id uuid, _role public.user_role, _grant boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public._require_admin();
  IF _role = 'user' THEN
    RAISE EXCEPTION 'The base user role cannot be changed';
  END IF;
  IF _grant THEN
    INSERT INTO public.user_roles (user_id, role, granted_by) VALUES (_user_id, _role, auth.uid())
    ON CONFLICT DO NOTHING;
  ELSE
    IF _role = 'admin' AND _user_id = auth.uid() THEN
      RAISE EXCEPTION 'You cannot remove your own admin role';
    END IF;
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
  END IF;
  PERFORM public._admin_log(CASE WHEN _grant THEN 'grant_role' ELSE 'revoke_role' END,
                            'user', _user_id::text, jsonb_build_object('role', _role));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_suspended(_user_id uuid, _suspended boolean, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public._require_admin();
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot suspend yourself';
  END IF;
  UPDATE public.profiles
     SET is_suspended = _suspended,
         suspended_reason = CASE WHEN _suspended THEN _reason ELSE NULL END,
         suspended_at = CASE WHEN _suspended THEN now() ELSE NULL END
   WHERE id = _user_id;
  IF _suspended THEN
    UPDATE public.babalawos SET is_active = false WHERE user_id = _user_id;
  END IF;
  PERFORM public._admin_log(CASE WHEN _suspended THEN 'suspend_user' ELSE 'unsuspend_user' END,
                            'user', _user_id::text, jsonb_build_object('reason', _reason));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_babalawo(_user_id uuid, _status text, _notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public._require_admin();
  IF _status NOT IN ('approved','rejected','pending','suspended') THEN
    RAISE EXCEPTION 'Invalid status %', _status;
  END IF;
  IF _status = 'rejected' AND COALESCE(btrim(_notes), '') = '' THEN
    RAISE EXCEPTION 'A reason is required when rejecting';
  END IF;
  UPDATE public.babalawos
     SET review_status = _status,
         is_verified = (_status = 'approved'),
         is_active = CASE WHEN _status = 'approved' THEN true ELSE is_active END,
         review_notes = _notes, reviewed_by = auth.uid(), reviewed_at = now()
   WHERE user_id = _user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Babalawo not found'; END IF;
  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (_user_id, 'verification',
          CASE _status WHEN 'approved' THEN 'Your profile is verified'
                       WHEN 'rejected' THEN 'Verification needs changes'
                       ELSE 'Verification status updated' END,
          CASE _status WHEN 'approved' THEN 'You are now visible to clients and can accept bookings.'
                       ELSE COALESCE(_notes, 'Your verification status is now ' || _status || '.') END);
  PERFORM public._admin_log('review_babalawo', 'babalawo', _user_id::text,
                            jsonb_build_object('status', _status, 'notes', _notes));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_session_status(_session_id uuid, _status public.session_status_enum, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE old_status text;
BEGIN
  PERFORM public._require_admin();
  SELECT status::text INTO old_status FROM public.sessions WHERE id = _session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
  UPDATE public.sessions SET status = _status WHERE id = _session_id;
  PERFORM public._admin_log('update_session_status', 'session', _session_id::text,
                            jsonb_build_object('from', old_status, 'to', _status, 'reason', _reason));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(_dispute_id uuid, _status text, _note text, _refund boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE d public.disputes%ROWTYPE;
BEGIN
  PERFORM public._require_admin();
  IF _status NOT IN ('investigating','resolved_refund','resolved_dismissed') THEN
    RAISE EXCEPTION 'Invalid status %', _status;
  END IF;
  IF _status LIKE 'resolved_%' AND COALESCE(btrim(_note), '') = '' THEN
    RAISE EXCEPTION 'A resolution note is required';
  END IF;
  UPDATE public.disputes
     SET status = _status,
         resolution_note = _note,
         refund_requested = (_status = 'resolved_refund') AND COALESCE(_refund, false),
         resolved_by = CASE WHEN _status LIKE 'resolved_%' THEN auth.uid() ELSE NULL END,
         resolved_at = CASE WHEN _status LIKE 'resolved_%' THEN now() ELSE NULL END,
         updated_at = now()
   WHERE id = _dispute_id RETURNING * INTO d;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dispute not found'; END IF;
  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (d.raised_by, 'dispute', 'Dispute update',
          'Your dispute is now: ' || replace(_status, '_', ' ') || COALESCE('. ' || _note, ''));
  PERFORM public._admin_log('resolve_dispute', 'dispute', _dispute_id::text,
                            jsonb_build_object('status', _status, 'refund', _refund, 'note', _note));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, public.user_role, boolean),
                       public.admin_set_user_suspended(uuid, boolean, text),
                       public.admin_review_babalawo(uuid, text, text),
                       public.admin_update_session_status(uuid, public.session_status_enum, text),
                       public.admin_resolve_dispute(uuid, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.user_role, boolean),
                          public.admin_set_user_suspended(uuid, boolean, text),
                          public.admin_review_babalawo(uuid, text, text),
                          public.admin_update_session_status(uuid, public.session_status_enum, text),
                          public.admin_resolve_dispute(uuid, text, text, boolean) TO authenticated;
