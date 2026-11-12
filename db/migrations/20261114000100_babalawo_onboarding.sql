-- Babalawo onboarding: what a profile needs before clients can find and book it.
--
-- Listed (shown to clients, bookable): verified, active, a photo, a price within the platform's
-- range, and weekly hours. Also asked for, shown on the checklist: bank details (for withdrawals)
-- and a Google email (makes them co-host of their Meet calls, so they can admit, mute and record).

CREATE OR REPLACE FUNCTION public._babalawo_onboarding(v_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_photo boolean; v_price boolean; v_hours boolean; v_bank boolean; v_google boolean; v_bio boolean;
  v_verified boolean; v_active boolean;
BEGIN
  SELECT COALESCE(NULLIF(b.profile_picture_url, ''), NULLIF(p.avatar_url, '')) IS NOT NULL,
         COALESCE(b.session_price, b.hourly_rate, 0) > 0
           AND COALESCE(b.session_price, b.hourly_rate) >= public.get_setting_numeric('min_session_price', 0)
           AND COALESCE(b.session_price, b.hourly_rate) <= public.get_setting_numeric('max_session_price', 100000000),
         EXISTS (SELECT 1 FROM availability a WHERE a.babalawo_id = v_id AND COALESCE(a.is_available, true)),
         EXISTS (SELECT 1 FROM babalawo_bank_details d WHERE d.babalawo_id = v_id),
         NULLIF(trim(b.google_email), '') IS NOT NULL,
         length(COALESCE(trim(b.bio), '')) >= 40,
         b.is_verified, COALESCE(b.is_active, true)
    INTO v_photo, v_price, v_hours, v_bank, v_google, v_bio, v_verified, v_active
    FROM babalawos b JOIN profiles p ON p.id = b.user_id WHERE b.user_id = v_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'photo', v_photo, 'price', v_price, 'hours', v_hours, 'bio', v_bio,
    'bank', v_bank, 'google_email', v_google, 'verified', v_verified, 'active', v_active,
    'listed', v_verified AND v_active AND v_photo AND v_price AND v_hours);
END $$;

/** The checklist on a Babalawo's home page: their own, or anyone's for an admin. */
CREATE OR REPLACE FUNCTION public.babalawo_onboarding(p_babalawo uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid := COALESCE(p_babalawo, auth.uid());
BEGIN
  IF v_id IS NULL OR (v_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  RETURN public._babalawo_onboarding(v_id);
END $$;

/** Shown to clients and bookable: verified, active, photo, price and hours. */
CREATE OR REPLACE FUNCTION public._babalawo_listed(p_babalawo uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((public._babalawo_onboarding(p_babalawo) ->> 'listed')::boolean, false)
$$;

CREATE OR REPLACE FUNCTION public.get_public_babalawos()
RETURNS TABLE(id uuid, full_name text, avatar_url text, specialties text[], experience_years integer,
              hourly_rate numeric, bio text, verification_status text, rating real, total_sessions integer,
              languages text[], timezone text, is_active boolean, is_featured boolean, current_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.user_id, p.full_name, COALESCE(NULLIF(b.profile_picture_url, ''), p.avatar_url), b.specialties,
         b.experience_years, b.hourly_rate, b.bio,
         CASE WHEN b.is_verified THEN 'approved' ELSE 'pending' END,
         b.rating, b.total_sessions, b.languages, b.timezone, b.is_active,
         COALESCE(b.is_featured, false), COALESCE(b.current_status, 'offline')
  FROM public.babalawos b
  JOIN public.profiles p ON p.id = b.user_id
  WHERE b.is_verified AND COALESCE(b.is_active, true) AND public._babalawo_listed(b.user_id)
$$;

REVOKE ALL ON FUNCTION public._babalawo_listed(uuid), public._babalawo_onboarding(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.babalawo_onboarding(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.babalawo_onboarding(uuid) TO authenticated;

-- Bookings and Consult Now only for listed Babalawos (same rules as before, plus this check).
CREATE OR REPLACE FUNCTION public._assert_bookable(p_babalawo uuid, p_date date, p_start text, p_is_instant boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_step int := 60; v_buffer int := 0; v_notice int := 0; v_adv int := 365; v_accept boolean := true; v_tz text := 'Africa/Lagos';
  v_t time := p_start::time; v_end time; v_start_ts timestamptz; v_ok boolean := false; v_status text;
BEGIN
  IF NOT public._babalawo_listed(p_babalawo) THEN
    RAISE EXCEPTION 'This babalawo is not taking bookings yet' USING ERRCODE = 'IF001';
  END IF;
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

-- Who can walk into a Meet call without knocking. OPEN: anyone with the link (only shown to the
-- two people in the session). TRUSTED: people without a Google account wait to be admitted.
INSERT INTO public.admin_settings (setting_key, setting_value, description, is_public) VALUES
  ('meet_access_type', 'OPEN', 'Google Meet entry: OPEN (link holders walk in) or TRUSTED (guests ask to join)', false)
ON CONFLICT (setting_key) DO NOTHING;
