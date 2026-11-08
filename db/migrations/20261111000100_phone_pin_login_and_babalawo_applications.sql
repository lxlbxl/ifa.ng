-- Phone + PIN login (replaces email sign-up / sign-in for people) and the
-- Babalawo application waitlist.
--
-- Login: a person types their phone number. If it already has a PIN they
-- enter the PIN; otherwise we send a one-time code by WhatsApp/SMS, then they
-- choose a PIN. The API server (Better Auth plugin, server/src/phoneAuth*.ts)
-- is the only reader/writer of the auth.* tables below; browsers never reach
-- them. Codes and PINs are stored only as keyed hashes.

-- ---------------------------------------------------------------------------
-- 1. Auth tables (service_role only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth.phone_otps (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone        text NOT NULL,
  code_hash    text NOT NULL,
  purpose      text NOT NULL CHECK (purpose IN ('login', 'reset_pin')),
  channel      text NOT NULL,
  attempts     integer NOT NULL DEFAULT 0,
  expires_at   timestamptz NOT NULL,
  consumed_at  timestamptz,
  ip           text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS phone_otps_phone_idx ON auth.phone_otps(phone, created_at DESC);

CREATE TABLE IF NOT EXISTS auth.phone_pins (
  user_id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash         text NOT NULL,
  failed_attempts  integer NOT NULL DEFAULT 0,
  lock_count       integer NOT NULL DEFAULT 0,
  locked_until     timestamptz,
  set_at           timestamptz NOT NULL DEFAULT now()
);

-- One-time permission to set (or reset) a PIN, handed out after a correct OTP.
CREATE TABLE IF NOT EXISTS auth.pin_tickets (
  token_hash  text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz
);

-- Sliding-window counters for rate limits (per phone, per IP). Kept in the
-- database so limits survive restarts and hold across API instances.
CREATE TABLE IF NOT EXISTS auth.rate_events (
  bucket  text NOT NULL,
  key     text NOT NULL,
  at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_events_lookup_idx ON auth.rate_events(bucket, key, at DESC);

REVOKE ALL ON auth.phone_otps, auth.phone_pins, auth.pin_tickets, auth.rate_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON auth.phone_otps, auth.phone_pins, auth.pin_tickets, auth.rate_events TO service_role;

-- Phone numbers are stored in E.164 (+2348012345678). auth.users.phone is already UNIQUE.
ALTER TABLE auth.users DROP CONSTRAINT IF EXISTS users_phone_e164;
ALTER TABLE auth.users ADD CONSTRAINT users_phone_e164 CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{6,14}$');

-- Keep the profile's phone in step with the login phone.
CREATE OR REPLACE FUNCTION auth.sync_profile_phone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.phone IS DISTINCT FROM OLD.phone) THEN
    UPDATE public.profiles SET phone = NEW.phone WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS users_sync_profile_phone ON auth.users;
-- Runs after on_auth_user_created (alphabetical order among AFTER triggers: "on_..." < "users_...").
CREATE TRIGGER users_sync_profile_phone AFTER INSERT OR UPDATE OF phone ON auth.users
  FOR EACH ROW EXECUTE FUNCTION auth.sync_profile_phone();

-- ---------------------------------------------------------------------------
-- 2. What the client wants to talk about (picked on the first booking step)
-- ---------------------------------------------------------------------------
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS consultation_topic text
  CHECK (consultation_topic IS NULL OR consultation_topic IN ('general', 'spiritual', 'personal', 'unsure'));

-- The client sets the topic on their own session (column is otherwise server-managed).
CREATE OR REPLACE FUNCTION public.set_session_topic(p_session_id bigint, p_topic text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501'; END IF;
  IF p_topic NOT IN ('general', 'spiritual', 'personal', 'unsure') THEN RAISE EXCEPTION 'Unknown topic'; END IF;
  UPDATE public.sessions SET consultation_topic = p_topic
   WHERE id = p_session_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found' USING ERRCODE = '42501'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_session_topic(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_session_topic(bigint, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Babalawo applications (waitlist, reviewed by an admin)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.babalawo_applications (
  id                bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id           uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name         text NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 2 AND 120),
  phone             text,
  email             text CHECK (email IS NULL OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  country           text,
  city              text,
  ile_name          text CHECK (ile_name IS NULL OR char_length(ile_name) <= 200),
  years_practising  integer CHECK (years_practising IS NULL OR years_practising BETWEEN 0 AND 90),
  specialties       text[] NOT NULL DEFAULT '{}',
  languages         text[] NOT NULL DEFAULT '{}',
  consults_online   text CHECK (consults_online IS NULL OR consults_online IN ('yes', 'sometimes', 'no')),
  bio               text CHECK (bio IS NULL OR char_length(bio) <= 3000),
  referral          text CHECK (referral IS NULL OR char_length(referral) <= 300),
  status            text NOT NULL DEFAULT 'waitlisted'
                    CHECK (status IN ('waitlisted', 'approved', 'rejected')),
  review_notes      text,
  reviewed_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS babalawo_applications_status_idx ON public.babalawo_applications(status, created_at DESC);
DROP TRIGGER IF EXISTS babalawo_applications_updated_at ON public.babalawo_applications;
CREATE TRIGGER babalawo_applications_updated_at BEFORE UPDATE ON public.babalawo_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.babalawo_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Applicants and admins read applications" ON public.babalawo_applications;
CREATE POLICY "Applicants and admins read applications" ON public.babalawo_applications
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
-- No direct writes: submit_babalawo_application and admin_review_babalawo_application below.
REVOKE INSERT, UPDATE, DELETE ON public.babalawo_applications FROM anon, authenticated;
GRANT SELECT ON public.babalawo_applications TO authenticated;

-- The signed-in applicant submits (or, while still waitlisted, updates) their application.
CREATE OR REPLACE FUNCTION public.submit_babalawo_application(
  p_full_name text, p_email text DEFAULT NULL, p_country text DEFAULT NULL, p_city text DEFAULT NULL,
  p_ile_name text DEFAULT NULL, p_years_practising integer DEFAULT NULL,
  p_specialties text[] DEFAULT '{}', p_languages text[] DEFAULT '{}',
  p_consults_online text DEFAULT NULL, p_bio text DEFAULT NULL, p_referral text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id bigint;
  v_status text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501'; END IF;
  SELECT id, status INTO v_id, v_status FROM babalawo_applications WHERE user_id = v_uid;
  IF v_status IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'This application has already been reviewed';
  END IF;
  INSERT INTO babalawo_applications AS a (user_id, full_name, phone, email, country, city, ile_name,
      years_practising, specialties, languages, consults_online, bio, referral)
  VALUES (v_uid, btrim(p_full_name), (SELECT phone FROM auth.users WHERE id = v_uid), NULLIF(btrim(p_email), ''),
      NULLIF(btrim(p_country), ''), NULLIF(btrim(p_city), ''), NULLIF(btrim(p_ile_name), ''), p_years_practising,
      COALESCE(p_specialties[1:20], '{}'), COALESCE(p_languages[1:20], '{}'), p_consults_online,
      NULLIF(btrim(p_bio), ''), NULLIF(btrim(p_referral), ''))
  ON CONFLICT (user_id) DO UPDATE SET
      full_name = EXCLUDED.full_name, email = EXCLUDED.email, country = EXCLUDED.country, city = EXCLUDED.city,
      ile_name = EXCLUDED.ile_name, years_practising = EXCLUDED.years_practising, specialties = EXCLUDED.specialties,
      languages = EXCLUDED.languages, consults_online = EXCLUDED.consults_online, bio = EXCLUDED.bio,
      referral = EXCLUDED.referral
  RETURNING id INTO v_id;
  -- The applicant's display name follows what they typed, if they had none yet.
  UPDATE auth.users SET name = btrim(p_full_name) WHERE id = v_uid AND name = '';
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.submit_babalawo_application(text, text, text, text, text, integer, text[], text[], text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_babalawo_application(text, text, text, text, text, integer, text[], text[], text, text, text) TO authenticated;

-- Admin decision. Approving grants the babalawo role and creates a verified,
-- visible Babalawo profile from the application.
CREATE OR REPLACE FUNCTION public.admin_review_babalawo_application(p_id bigint, p_decision text, p_notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a public.babalawo_applications;
BEGIN
  PERFORM public._require_admin();
  IF p_decision NOT IN ('approved', 'rejected', 'waitlisted') THEN RAISE EXCEPTION 'Invalid decision %', p_decision; END IF;
  IF p_decision = 'rejected' AND COALESCE(btrim(p_notes), '') = '' THEN
    RAISE EXCEPTION 'A reason is required when rejecting';
  END IF;
  SELECT * INTO a FROM babalawo_applications WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;

  UPDATE babalawo_applications SET status = p_decision, review_notes = p_notes,
         reviewed_by = auth.uid(), reviewed_at = now() WHERE id = p_id;

  IF p_decision = 'approved' THEN
    INSERT INTO user_roles (user_id, role, granted_by) VALUES (a.user_id, 'babalawo', auth.uid()) ON CONFLICT DO NOTHING;
    UPDATE profiles SET role = 'babalawo', full_name = COALESCE(NULLIF(full_name, ''), a.full_name) WHERE id = a.user_id;
    INSERT INTO babalawos (user_id, bio, specialties, languages, experience_years, city, country,
                           is_verified, is_active, review_status, reviewed_by, reviewed_at)
    VALUES (a.user_id, a.bio, a.specialties, a.languages, a.years_practising, a.city, a.country,
            true, true, 'approved', auth.uid(), now())
    ON CONFLICT (user_id) DO UPDATE SET
      bio = COALESCE(babalawos.bio, EXCLUDED.bio), specialties = COALESCE(babalawos.specialties, EXCLUDED.specialties),
      languages = COALESCE(babalawos.languages, EXCLUDED.languages),
      experience_years = COALESCE(babalawos.experience_years, EXCLUDED.experience_years),
      city = COALESCE(babalawos.city, EXCLUDED.city), country = COALESCE(babalawos.country, EXCLUDED.country),
      is_verified = true, is_active = true, review_status = 'approved',
      reviewed_by = auth.uid(), reviewed_at = now();
  END IF;

  INSERT INTO notifications (user_id, type, title, message)
  VALUES (a.user_id, 'verification',
          CASE p_decision WHEN 'approved' THEN 'Welcome to IFA.ng'
                          WHEN 'rejected' THEN 'About your Babalawo application'
                          ELSE 'Your application is on the waitlist' END,
          CASE p_decision WHEN 'approved' THEN 'Your application was approved. Sign in to set up your hours and fee.'
                          ELSE COALESCE(p_notes, 'We will be in touch.') END);
  PERFORM public._admin_log('review_babalawo_application', 'babalawo_application', p_id::text,
                            jsonb_build_object('decision', p_decision, 'notes', p_notes, 'user_id', a.user_id));
END $$;
REVOKE ALL ON FUNCTION public.admin_review_babalawo_application(bigint, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_babalawo_application(bigint, text, text) TO authenticated;
