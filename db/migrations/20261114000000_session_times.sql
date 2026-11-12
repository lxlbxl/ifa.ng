-- One real start time for every session, whatever time zone each person is in.
--
-- A booked time is picked on the Babalawo's calendar: session_date + start_time are the
-- Babalawo's own wall clock (their scheduling time zone, default Africa/Lagos). That is what
-- _assert_bookable already checked. Until now, session_start_at() read the same numbers in the
-- client's time zone, so a client abroad got reminders, join windows and refunds at the wrong hour.
--
-- Now: starts_at / ends_at hold the real instants and are set by a trigger; everything reads them.
-- user_timezone is the client's own zone (from profiles.timezone), used only to word messages.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone text;
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at   timestamptz;

/** The zone a Babalawo's calendar is in (same rule as _assert_bookable and the booking screen). */
CREATE OR REPLACE FUNCTION public._babalawo_tz(p_babalawo uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT NULLIF(timezone, '') FROM babalawo_scheduling_settings WHERE babalawo_id = p_babalawo), 'Africa/Lagos')
$$;

CREATE OR REPLACE FUNCTION public.set_session_times()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tz text := public._babalawo_tz(NEW.babalawo_id); v_len interval; v_local timestamp; v_client_tz text;
BEGIN
  v_len := CASE WHEN NEW.end_time IS NOT NULL AND NEW.start_time IS NOT NULL AND NEW.end_time <> NEW.start_time
                THEN NEW.end_time - NEW.start_time ELSE make_interval(mins => public._session_minutes(NEW.babalawo_id)) END;
  IF v_len < interval '0' THEN v_len := v_len + interval '24 hours'; END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT NULLIF(timezone, '') INTO v_client_tz FROM profiles WHERE id = NEW.user_id;
    NEW.user_timezone := COALESCE(v_client_tz, NULLIF(NEW.user_timezone, ''), 'Africa/Lagos');
    IF COALESCE(NEW.is_instant, false) THEN
      -- Consult Now starts when it is paid; the date/time shown is the Babalawo's clock right now.
      v_local := now() AT TIME ZONE v_tz;
      NEW.session_date := v_local::date;
      NEW.start_time := date_trunc('minute', v_local)::time;
      NEW.end_time := (date_trunc('minute', v_local) + v_len)::time;
      NEW.starts_at := now();
      NEW.ends_at := now() + v_len;
      RETURN NEW;
    END IF;
  ELSIF COALESCE(NEW.is_instant, false) THEN
    RETURN NEW;
  END IF;

  NEW.starts_at := (NEW.session_date + NEW.start_time) AT TIME ZONE v_tz;
  NEW.ends_at := NEW.starts_at + v_len;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_session_times ON public.sessions;
CREATE TRIGGER trg_session_times BEFORE INSERT OR UPDATE OF session_date, start_time, end_time ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_session_times();

-- Existing rows.
UPDATE public.sessions s
   SET starts_at = (s.session_date + s.start_time) AT TIME ZONE public._babalawo_tz(s.babalawo_id),
       ends_at = (s.session_date + s.start_time) AT TIME ZONE public._babalawo_tz(s.babalawo_id)
                 + CASE WHEN s.end_time > s.start_time THEN s.end_time - s.start_time
                        WHEN s.end_time < s.start_time THEN s.end_time - s.start_time + interval '24 hours'
                        ELSE make_interval(mins => public._session_minutes(s.babalawo_id)) END
 WHERE s.starts_at IS NULL AND s.session_date IS NOT NULL AND s.start_time IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_starts_at ON public.sessions(starts_at);

CREATE OR REPLACE FUNCTION public.session_start_at(p_session_id bigint)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(s.starts_at, (s.session_date + s.start_time) AT TIME ZONE public._babalawo_tz(s.babalawo_id))
    FROM public.sessions s WHERE s.id = p_session_id;
$$;

CREATE OR REPLACE FUNCTION public.session_end_at(p_session_id bigint)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN s.is_instant THEN COALESCE(s.accepted_at, s.created_at) + make_interval(mins => public._session_minutes(s.babalawo_id))
    ELSE COALESCE(s.ends_at, public.session_start_at(s.id) + make_interval(mins => public._session_minutes(s.babalawo_id)))
  END FROM sessions s WHERE s.id = p_session_id
$$;

-- The Ebo ritual time (an instant) is written on the Babalawo's clock, like every other session.
CREATE OR REPLACE FUNCTION public._ebo_ritual_session(p_id uuid)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e ebo_prescriptions%ROWTYPE; v_tz text; v_local timestamp; v_sid bigint;
BEGIN
  SELECT * INTO e FROM ebo_prescriptions WHERE id = p_id;
  IF e.attendance IS DISTINCT FROM 'present' OR e.ritual_at IS NULL THEN RETURN NULL; END IF;
  v_tz := public._babalawo_tz(e.babalawo_id);
  v_tz := COALESCE(v_tz, 'Africa/Lagos');
  v_local := e.ritual_at AT TIME ZONE v_tz;
  BEGIN
    IF e.ritual_session_id IS NOT NULL THEN
      UPDATE sessions SET session_date = v_local::date, start_time = v_local::time,
             end_time = (v_local + make_interval(mins => e.ritual_minutes))::time, status = 'confirmed'
       WHERE id = e.ritual_session_id RETURNING id INTO v_sid;
    END IF;
    IF v_sid IS NULL THEN
      INSERT INTO sessions(user_id, babalawo_id, session_date, start_time, end_time, status, payment_status, amount,
                           payment_reference, is_instant, notes, user_timezone, session_type, ebo_id)
      VALUES (e.client_id, e.babalawo_id, v_local::date, v_local::time, (v_local + make_interval(mins => e.ritual_minutes))::time,
              'confirmed', 'paid', 0, NULL, false, 'Ebo ritual: ' || e.title, v_tz, 'ebo_ritual', p_id)
      RETURNING id INTO v_sid;
    END IF;
  EXCEPTION WHEN unique_violation THEN
    PERFORM create_notification(e.babalawo_id, 'ebo_time_clash', 'Pick another time for the Ebo ritual',
            e.title || ': you already have a session at that time.', jsonb_build_object('ebo_id', p_id, 'action_url', '/dashboard'), 'high');
    PERFORM _ebo_log(p_id, 'ritual_time_clash');
    RETURN NULL;
  END;
  UPDATE ebo_prescriptions SET ritual_session_id = v_sid WHERE id = p_id;
  RETURN v_sid;
END $$;

REVOKE ALL ON FUNCTION public._babalawo_tz(uuid), public.set_session_times() FROM PUBLIC, anon, authenticated;
