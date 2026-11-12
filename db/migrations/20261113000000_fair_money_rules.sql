-- Fair money rules for consultations (launch-readiness review, blockers 3 and 4).
--
--  * Consult Now: a paid instant session waits for the Babalawo to accept within
--    instant_accept_minutes (default 3). If they don't, the client is refunded in full.
--    The client can also cancel while waiting and is refunded in full.
--  * Attendance: joining from the session page records who joined. A session that ends
--    with the Babalawo never joining is refunded automatically (babalawo_no_show_refund),
--    unless the Babalawo marked it completed themselves (the client can still dispute).
--  * A Babalawo cannot start or complete a booked session before its start time.
--  * Earnings wait earnings_hold_hours (default 48) after completion before they can be
--    withdrawn, and are not released while a dispute on the session is open.
--  * A person holds at most one slot at a time while paying.

INSERT INTO public.admin_settings (setting_key, setting_value, description, is_public) VALUES
  ('instant_accept_minutes', '3', 'Minutes a Babalawo has to accept a Consult Now request before the client is refunded', true),
  ('earnings_hold_hours', '48', 'Hours after a session ends before the Babalawo can withdraw its earnings (dispute window)', true),
  ('babalawo_no_show_refund', 'true', 'Refund the client automatically when the Babalawo never joins', true)
ON CONFLICT (setting_key) DO NOTHING;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS accept_deadline     timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at         timestamptz,
  ADD COLUMN IF NOT EXISTS client_joined_at    timestamptz,
  ADD COLUMN IF NOT EXISTS babalawo_joined_at  timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at        timestamptz,
  ADD COLUMN IF NOT EXISTS earnings_release_at timestamptz,
  ADD COLUMN IF NOT EXISTS no_show             text CHECK (no_show IN ('babalawo'));

-- ------------------------------------------------------------------ helpers
CREATE OR REPLACE FUNCTION public._session_minutes(p_babalawo uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT NULLIF(slot_minutes, 0) FROM babalawo_scheduling_settings WHERE babalawo_id = p_babalawo),
    public.get_setting_numeric('default_session_minutes', 60)::int, 60)
$$;

/** When a session is over: booked start + its length; Consult Now from acceptance. */
CREATE OR REPLACE FUNCTION public.session_end_at(p_session_id bigint)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN s.is_instant THEN COALESCE(s.accepted_at, s.created_at) + make_interval(mins => public._session_minutes(s.babalawo_id))
    ELSE public.session_start_at(s.id) + CASE WHEN s.end_time > s.start_time THEN s.end_time - s.start_time
                                              ELSE make_interval(mins => public._session_minutes(s.babalawo_id)) END
  END FROM sessions s WHERE s.id = p_session_id
$$;

-- ------------------------------------------------------- paid session creation
CREATE OR REPLACE FUNCTION public._create_paid_session(
  p_user uuid, p_babalawo uuid, p_date date, p_start text, p_is_instant boolean,
  p_amount numeric, p_method text, p_reference text, p_gateway_tx text DEFAULT NULL, p_verified boolean DEFAULT false)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plat numeric; v_baba numeric; v_commission numeric; v_session bigint; v_mins int; v_n uuid;
BEGIN
  SELECT COALESCE(commission_platform_percent, 20), COALESCE(commission_babalawo_percent, 80)
    INTO v_plat, v_baba FROM babalawos WHERE user_id = p_babalawo;
  v_plat := COALESCE(v_plat, 20); v_baba := COALESCE(v_baba, 80);
  IF v_plat + v_baba <> 100 THEN v_plat := 20; v_baba := 80; END IF;
  v_commission := round(p_amount * v_plat / 100, 2);
  v_mins := public._session_minutes(p_babalawo);

  INSERT INTO sessions(user_id, babalawo_id, session_date, start_time, end_time, status, payment_status, amount,
                       payment_reference, is_instant, notes, accept_deadline)
  VALUES (p_user, p_babalawo, p_date, p_start::time, p_start::time + make_interval(mins => v_mins),
          (CASE WHEN p_is_instant THEN 'pending' ELSE 'confirmed' END)::session_status_enum,
          'paid', p_amount, p_reference, p_is_instant, CASE WHEN p_is_instant THEN 'Instant consultation' END,
          CASE WHEN p_is_instant THEN now() + make_interval(mins => public.get_setting_numeric('instant_accept_minutes', 3)::int) END)
  RETURNING id INTO v_session;

  INSERT INTO payments(user_id, session_id, amount, commission_amount, babalawo_amount, payment_gateway,
                       payment_reference, status, webhook_verified, gateway_transaction_id, commission_platform_percent)
  VALUES (p_user, v_session, p_amount, v_commission, p_amount - v_commission, p_method, p_reference,
          'completed', p_verified OR p_method = 'wallet', p_gateway_tx, v_plat);

  PERFORM _babalawo_escrow_credit(p_babalawo, v_session, p_amount - v_commission);
  v_n := create_notification(p_babalawo, CASE WHEN p_is_instant THEN 'instant_session_request' ELSE 'session_booked' END,
          CASE WHEN p_is_instant THEN 'New Instant Session' ELSE 'New booking' END,
          CASE WHEN p_is_instant THEN 'A client has paid to consult you now. Accept within '
                 || public.get_setting_numeric('instant_accept_minutes', 3)::int || ' minutes or they are refunded.'
               ELSE 'A client has paid for a consultation.' END,
          jsonb_build_object('session_id', v_session),
          CASE WHEN p_is_instant THEN 'urgent' ELSE 'high' END);
  IF p_is_instant AND v_n IS NOT NULL THEN
    UPDATE notifications SET action_url = '/session/' || v_session WHERE id = v_n;
  END IF;
  RETURN v_session;
END $$;

-- ------------------------------------------------------------ Consult Now
CREATE OR REPLACE FUNCTION public.accept_instant_session(p_session_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s sessions%ROWTYPE;
BEGIN
  SELECT * INTO s FROM sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND OR s.babalawo_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Session not found'; END IF;
  IF NOT COALESCE(s.is_instant, false) THEN RAISE EXCEPTION 'This is not a Consult Now request'; END IF;
  IF s.status = 'in_progress' THEN RETURN jsonb_build_object('accepted', true, 'already', true); END IF;
  IF s.status <> 'pending' OR s.payment_status <> 'paid' THEN
    RAISE EXCEPTION 'This request is no longer waiting (it was cancelled or refunded)';
  END IF;
  IF s.accept_deadline < now() THEN RAISE EXCEPTION 'This request has expired and the client was refunded'; END IF;
  UPDATE sessions SET status = 'in_progress', accepted_at = now(), babalawo_joined_at = COALESCE(babalawo_joined_at, now())
   WHERE id = s.id;
  PERFORM create_notification(s.user_id, 'instant_session_accepted', 'Your Babalawo is ready',
          'Your Babalawo accepted. Join the consultation now.', jsonb_build_object('session_id', s.id), 'urgent');
  RETURN jsonb_build_object('accepted', true);
END $$;

/** Refund Consult Now requests nobody accepted in time. Run every 30 seconds by the API's jobs. */
CREATE OR REPLACE FUNCTION public.expire_unaccepted_instant_sessions()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT id, user_id, babalawo_id FROM sessions
            WHERE is_instant AND status = 'pending' AND payment_status = 'paid' AND accept_deadline <= now()
            FOR UPDATE SKIP LOCKED LOOP
    PERFORM _refund_session(r.id, 'Babalawo did not accept in time', NULL);
    PERFORM create_notification(r.user_id, 'instant_session_expired', 'Refunded to your wallet',
            'Your Babalawo could not take the consultation right now, so we refunded you in full. Try again or book a time.',
            jsonb_build_object('session_id', r.id), 'high');
    PERFORM create_notification(r.babalawo_id, 'instant_session_missed', 'Consult Now request missed',
            'A client waited but the request was not accepted in time, so they were refunded.',
            jsonb_build_object('session_id', r.id), 'normal');
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- ------------------------------------------------------------- attendance
CREATE OR REPLACE FUNCTION public.record_session_join(p_session_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s sessions%ROWTYPE;
BEGIN
  SELECT * INTO s FROM sessions WHERE id = p_session_id;
  IF NOT FOUND OR auth.uid() IS NULL OR auth.uid() NOT IN (s.user_id, s.babalawo_id) THEN RAISE EXCEPTION 'Session not found'; END IF;
  IF s.payment_status <> 'paid' OR s.status NOT IN ('confirmed', 'in_progress') THEN RETURN; END IF;
  -- Only joins near the session count (from 15 minutes before the start).
  IF NOT COALESCE(s.is_instant, false) AND now() < public.session_start_at(s.id) - interval '15 minutes' THEN RETURN; END IF;
  IF auth.uid() = s.babalawo_id THEN
    UPDATE sessions SET babalawo_joined_at = COALESCE(babalawo_joined_at, now()) WHERE id = s.id;
  ELSE
    UPDATE sessions SET client_joined_at = COALESCE(client_joined_at, now()) WHERE id = s.id;
  END IF;
END $$;

-- ------------------------------------------------------------- cancellation
CREATE OR REPLACE FUNCTION public.cancel_session(p_session_id bigint, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s sessions%ROWTYPE; v_uid uuid := auth.uid(); v_hours numeric; v_refund numeric := 0;
BEGIN
  SELECT * INTO s FROM sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
  IF v_uid IS NULL OR (v_uid <> s.user_id AND v_uid <> s.babalawo_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF s.status IN ('cancelled','completed') THEN RAISE EXCEPTION 'Session already %', s.status; END IF;
  v_hours := extract(epoch FROM (public.session_start_at(s.id) - now())) / 3600;
  IF s.payment_status = 'paid' THEN
    -- Babalawo / admin cancellations are always refunded. A client gets a full refund with enough
    -- notice, or while a Consult Now request is still waiting to be accepted.
    IF v_uid = s.user_id AND NOT public.is_admin()
       AND NOT (COALESCE(s.is_instant, false) AND s.status = 'pending')
       AND v_hours < get_setting_numeric('cancellation_full_refund_hours', 24) THEN
      UPDATE sessions SET status = 'cancelled' WHERE id = s.id;
      RETURN jsonb_build_object('cancelled', true, 'refunded', 0, 'reason', 'late_cancellation');
    END IF;
    v_refund := _refund_session(s.id, COALESCE(p_reason, 'Session cancelled'), v_uid);
    IF v_uid = s.user_id THEN
      PERFORM create_notification(s.babalawo_id, 'session_cancelled', 'Consultation cancelled',
              'Your client cancelled a consultation.', jsonb_build_object('session_id', s.id), 'normal');
    ELSE
      PERFORM create_notification(s.user_id, 'session_cancelled', 'Consultation cancelled',
              'Your consultation was cancelled and refunded to your wallet.', jsonb_build_object('session_id', s.id), 'high');
    END IF;
  ELSE
    UPDATE sessions SET status = 'cancelled' WHERE id = s.id;
  END IF;
  RETURN jsonb_build_object('cancelled', true, 'refunded', v_refund);
END $$;

-- -------------------------------------------- completion, no-shows, earnings hold
CREATE OR REPLACE FUNCTION public.stamp_session_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    NEW.completed_at := now();
    NEW.earnings_release_at := now() + make_interval(hours => public.get_setting_numeric('earnings_hold_hours', 48)::int);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_stamp_session_completion ON public.sessions;
CREATE TRIGGER trg_stamp_session_completion BEFORE UPDATE OF status ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.stamp_session_completion();

-- Completion no longer releases money at once: release_held_earnings() does, after the hold.
DROP TRIGGER IF EXISTS trigger_credit_babalawo_on_completion ON public.sessions;

CREATE OR REPLACE FUNCTION public.release_held_earnings()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_amt numeric; n int := 0;
BEGIN
  FOR r IN SELECT s.id, s.babalawo_id FROM sessions s
            WHERE s.status = 'completed' AND s.payment_status = 'paid'
              AND COALESCE(s.earnings_release_at, s.updated_at) <= now()
              AND NOT EXISTS (SELECT 1 FROM babalawo_ledger l WHERE l.session_id = s.id AND l.entry_type = 'release')
              AND NOT EXISTS (SELECT 1 FROM disputes d WHERE d.session_id = s.id AND d.status IN ('open', 'investigating'))
            FOR UPDATE OF s SKIP LOCKED LOOP
    SELECT amount INTO v_amt FROM babalawo_ledger WHERE session_id = r.id AND entry_type = 'earning';
    CONTINUE WHEN v_amt IS NULL;
    INSERT INTO babalawo_ledger(babalawo_id, entry_type, amount, session_id, note)
      VALUES (r.babalawo_id, 'release', v_amt, r.id, 'Session completed') ON CONFLICT DO NOTHING;
    IF FOUND THEN
      UPDATE babalawo_wallets SET pending_balance = pending_balance - v_amt,
             available_balance = available_balance + v_amt, updated_at = now() WHERE babalawo_id = r.babalawo_id;
      n := n + 1;
    END IF;
  END LOOP;
  RETURN n;
END $$;

/**
 * Sessions whose time is over (plus 2 hours of grace): completed if the Babalawo joined,
 * otherwise a Babalawo no-show, refunded automatically unless the admin turned that off.
 */
CREATE OR REPLACE FUNCTION public.auto_complete_sessions()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_refund boolean := COALESCE(
  (SELECT lower(setting_value) FROM admin_settings WHERE setting_key = 'babalawo_no_show_refund'), 'true') <> 'false';
BEGIN
  FOR r IN SELECT id, user_id, babalawo_id, babalawo_joined_at, payment_status FROM sessions
            WHERE status IN ('confirmed', 'in_progress') AND no_show IS NULL
              AND public.session_end_at(id) < now() - interval '2 hours'
            FOR UPDATE SKIP LOCKED LOOP
    -- Ebo ritual sessions (no consultation payment) follow the Ebo rules instead.
    IF r.babalawo_joined_at IS NOT NULL OR r.payment_status IS DISTINCT FROM 'paid'
       OR NOT EXISTS (SELECT 1 FROM payments p WHERE p.session_id = r.id AND p.amount > 0) THEN
      UPDATE sessions SET status = 'completed' WHERE id = r.id;
    ELSE
      UPDATE sessions SET no_show = 'babalawo' WHERE id = r.id;
      IF v_refund THEN
        PERFORM _refund_session(r.id, 'Babalawo did not join', NULL);
        PERFORM create_notification(r.user_id, 'session_no_show_refund', 'Refunded to your wallet',
                'Your Babalawo did not join the consultation, so we refunded you in full.',
                jsonb_build_object('session_id', r.id), 'high');
      END IF;
      PERFORM create_notification(r.babalawo_id, 'session_no_show', 'Missed consultation',
              'You did not join a booked consultation. ' ||
              CASE WHEN v_refund THEN 'The client was refunded.' ELSE 'An admin will review it.' END,
              jsonb_build_object('session_id', r.id), 'high');
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------- slot holds
CREATE OR REPLACE FUNCTION public.release_my_other_slot_holds()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- One active hold per person: taking a slot lets go of any other they were holding.
  IF NEW.status = 'locked' THEN
    UPDATE slot_locks SET status = 'released'
     WHERE locked_by_user_id = NEW.locked_by_user_id AND status = 'locked' AND id <> NEW.id;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_one_slot_hold_per_person ON public.slot_locks;
CREATE TRIGGER trg_one_slot_hold_per_person AFTER INSERT OR UPDATE OF status, locked_by_user_id ON public.slot_locks
  FOR EACH ROW WHEN (NEW.status = 'locked') EXECUTE FUNCTION public.release_my_other_slot_holds();

-- ------------------------------------------- booking rules (Consult Now additions)
CREATE OR REPLACE FUNCTION public._assert_bookable(p_babalawo uuid, p_date date, p_start text, p_is_instant boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_step int := 60; v_buffer int := 0; v_notice int := 0; v_adv int := 365; v_accept boolean := true; v_tz text := 'Africa/Lagos';
  v_t time := p_start::time; v_end time; v_start_ts timestamptz; v_ok boolean := false; v_status text;
BEGIN
  IF p_is_instant THEN
    SELECT current_status INTO v_status FROM babalawos WHERE user_id = p_babalawo;
    IF v_status IS DISTINCT FROM 'online' THEN
      RAISE EXCEPTION 'This babalawo is not available for instant consultation' USING ERRCODE = 'IF001';
    END IF;
    IF EXISTS (SELECT 1 FROM sessions WHERE babalawo_id = p_babalawo AND status = 'in_progress') THEN
      RAISE EXCEPTION 'This babalawo is currently in another session' USING ERRCODE = 'IF001';
    END IF;
    -- Another client is already waiting for this Babalawo to accept.
    IF EXISTS (SELECT 1 FROM sessions WHERE babalawo_id = p_babalawo AND is_instant AND status = 'pending'
                 AND accept_deadline > now()) THEN
      RAISE EXCEPTION 'This babalawo is answering another client right now' USING ERRCODE = 'IF001';
    END IF;
    -- A booked session starts soon: Consult Now would run into it.
    IF EXISTS (SELECT 1 FROM sessions s WHERE s.babalawo_id = p_babalawo AND NOT COALESCE(s.is_instant, false)
                 AND s.status IN ('confirmed', 'in_progress')
                 AND public.session_start_at(s.id) BETWEEN now() - interval '2 hours' AND now() + make_interval(mins => 75)) THEN
      RAISE EXCEPTION 'This babalawo has a booked consultation soon' USING ERRCODE = 'IF001';
    END IF;
    RETURN;
  END IF;

  IF to_regclass('public.babalawo_scheduling_settings') IS NOT NULL THEN
    SELECT COALESCE(slot_minutes,60), COALESCE(buffer_minutes,0), COALESCE(min_notice_hours,0),
           COALESCE(max_advance_days,365), COALESCE(accepting_bookings,true), COALESCE(timezone,'Africa/Lagos')
      INTO v_step, v_buffer, v_notice, v_adv, v_accept, v_tz
      FROM babalawo_scheduling_settings WHERE babalawo_id = p_babalawo;
    IF NOT FOUND THEN v_step := 60; v_buffer := 0; v_notice := 0; v_adv := 365; v_accept := true; v_tz := 'Africa/Lagos'; END IF;
  END IF;
  IF NOT v_accept THEN RAISE EXCEPTION 'This babalawo is not accepting bookings' USING ERRCODE = 'IF001'; END IF;

  v_end := v_t + make_interval(mins => v_step);
  v_start_ts := (p_date + v_t) AT TIME ZONE v_tz;
  IF v_start_ts < now() + make_interval(hours => v_notice) THEN
    RAISE EXCEPTION 'That time is too soon to book' USING ERRCODE = 'IF001';
  END IF;
  IF v_start_ts > now() + make_interval(days => v_adv) THEN
    RAISE EXCEPTION 'That date is too far ahead' USING ERRCODE = 'IF001';
  END IF;

  IF to_regclass('public.babalawo_time_off') IS NOT NULL AND EXISTS (
       SELECT 1 FROM babalawo_time_off WHERE babalawo_id = p_babalawo AND p_date BETWEEN start_date AND end_date) THEN
    RAISE EXCEPTION 'Babalawo is on time off that day' USING ERRCODE = 'IF001';
  END IF;

  IF to_regclass('public.availability_exceptions') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM availability_exceptions e WHERE e.babalawo_id = p_babalawo AND e.exception_date = p_date
                 AND e.kind = 'blocked'
                 AND (e.start_time IS NULL OR e.end_time IS NULL OR (v_t < e.end_time AND v_end > e.start_time))) THEN
      RAISE EXCEPTION 'That time is blocked' USING ERRCODE = 'IF001';
    END IF;
    v_ok := EXISTS (SELECT 1 FROM availability_exceptions e WHERE e.babalawo_id = p_babalawo AND e.exception_date = p_date
                      AND e.kind = 'extra' AND v_t >= e.start_time AND v_end <= e.end_time);
  END IF;
  IF NOT v_ok THEN
    v_ok := EXISTS (SELECT 1 FROM availability a WHERE a.babalawo_id = p_babalawo AND COALESCE(a.is_available, true)
                      AND a.day_of_week = extract(dow FROM p_date)::int AND v_t >= a.start_time AND v_end <= a.end_time);
  END IF;
  IF NOT v_ok THEN RAISE EXCEPTION 'That time is outside the babalawo''s working hours' USING ERRCODE = 'IF001'; END IF;

  IF EXISTS (SELECT 1 FROM sessions s WHERE s.babalawo_id = p_babalawo AND s.session_date = p_date
               AND s.status IN ('pending','confirmed','in_progress') AND NOT COALESCE(s.is_instant, false)
               AND v_t < s.start_time + make_interval(mins => v_step + v_buffer)
               AND v_end + make_interval(mins => v_buffer) > s.start_time) THEN
    RAISE EXCEPTION 'That slot is already booked' USING ERRCODE = 'IF001';
  END IF;
END $$;

-- ------------------------------------------- session guard (start-time rule, Consult Now)
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
    ELSIF COALESCE(OLD.is_instant, false) AND OLD.status::text = 'pending' THEN
      RAISE EXCEPTION 'Accept the Consult Now request instead' USING ERRCODE = '42501';
    ELSIF NEW.status::text IN ('in_progress', 'completed') AND NOT COALESCE(OLD.is_instant, false)
          AND now() < public.session_start_at(OLD.id) - interval '15 minutes' THEN
      RAISE EXCEPTION 'This consultation has not started yet' USING ERRCODE = '42501';
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

-- ---------------------------------------------------------------- grants
REVOKE ALL ON FUNCTION public._session_minutes(uuid), public._create_paid_session(uuid, uuid, date, text, boolean, numeric, text, text, text, boolean),
  public.expire_unaccepted_instant_sessions(), public.release_held_earnings(), public.auto_complete_sessions(),
  public.stamp_session_completion(), public.release_my_other_slot_holds()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accept_instant_session(bigint), public.record_session_join(bigint),
  public.cancel_session(bigint, text), public.session_end_at(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_instant_session(bigint), public.record_session_join(bigint),
  public.cancel_session(bigint, text), public.session_end_at(bigint) TO authenticated;
