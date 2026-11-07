-- Google Meet as the default video provider, with two-sided consent, recordings,
-- transcripts and a notification outbox. Agora stays as the fallback provider.
-- Depends on: public.is_admin() (existing / hardened by the roles migration).
-- All writes to recordings, transcripts and the outbox are service-role only.

------------------------------------------------------------------------------
-- 1. sessions: video provider + Meet fields
------------------------------------------------------------------------------
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS video_provider text NOT NULL DEFAULT 'google_meet',
  ADD COLUMN IF NOT EXISTS meet_uri text,
  ADD COLUMN IF NOT EXISTS meet_code text,
  ADD COLUMN IF NOT EXISTS meet_space_name text,
  ADD COLUMN IF NOT EXISTS meet_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS recording_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recording_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recording_next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS recording_last_error text,
  ADD COLUMN IF NOT EXISTS video_fallback_reason text;

ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_video_provider_check;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_video_provider_check
  CHECK (video_provider IN ('google_meet', 'agora'));

ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_recording_status_check;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_recording_status_check
  CHECK (recording_status IN ('none','awaiting_consent','scheduled','processing',
                              'transcribed','notes_drafted','failed','unavailable'));

-- Existing sessions were created before Meet existed: keep them on Agora.
UPDATE public.sessions SET video_provider = 'agora'
 WHERE meet_uri IS NULL AND video_provider = 'google_meet' AND meet_created_at IS NULL
   AND agora_channel_name IS NOT NULL;

-- The Babalawo's Google-account email (needed to add them as Meet co-host).
-- Falls back to their login email when empty.
ALTER TABLE public.babalawos ADD COLUMN IF NOT EXISTS google_email text;

CREATE INDEX IF NOT EXISTS idx_sessions_recording_queue
  ON public.sessions (recording_status, recording_next_attempt_at)
  WHERE recording_status IN ('scheduled','processing');

-- Participant helper (SECURITY DEFINER so it works inside other tables' RLS).
CREATE OR REPLACE FUNCTION public.is_session_participant(p_session_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sessions s
     WHERE s.id = p_session_id AND (s.user_id = auth.uid() OR s.babalawo_id = auth.uid())
  );
$$;

-- Absolute start of a session. Booking stores date + 'HH:MM' text; the client's
-- timezone (user_timezone) is what the booking UI used, default Africa/Lagos.
CREATE OR REPLACE FUNCTION public.session_start_at(p_session_id bigint)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ((s.session_date::text || ' ' || s.start_time::text)::timestamp)
         AT TIME ZONE COALESCE(NULLIF(s.user_timezone, ''), 'Africa/Lagos')
    FROM public.sessions s WHERE s.id = p_session_id;
$$;

------------------------------------------------------------------------------
-- 2. Consent (explicit, per party, versioned, withdrawable)
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.session_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id bigint NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  party text NOT NULL CHECK (party IN ('client','babalawo')),
  recording_consent boolean NOT NULL,
  ai_processing_consent boolean NOT NULL,
  consent_version text NOT NULL DEFAULT '2026-11',
  consented_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  UNIQUE (session_id, party)
);
ALTER TABLE public.session_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "consents readable by participants and admins" ON public.session_consents;
CREATE POLICY "consents readable by participants and admins" ON public.session_consents
  FOR SELECT USING (public.is_session_participant(session_id) OR public.is_admin());
-- No INSERT/UPDATE/DELETE policies: writes only via record_session_consent().

CREATE OR REPLACE FUNCTION public.session_has_full_consent(p_session_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*) = 2 FROM public.session_consents c
   WHERE c.session_id = p_session_id AND c.withdrawn_at IS NULL
     AND c.recording_consent AND c.ai_processing_consent;
$$;

-- The UI calls this. A party records their own decision (yes or no) and may
-- change it until the session starts. Recording is only ever armed when BOTH
-- parties said yes to recording and AI processing.
CREATE OR REPLACE FUNCTION public.record_session_consent(
  p_session_id bigint, p_recording boolean, p_ai boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.sessions%ROWTYPE;
  v_party text;
  v_new_status text;
BEGIN
  SELECT * INTO s FROM public.sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'session not found'; END IF;
  IF auth.uid() = s.user_id THEN v_party := 'client';
  ELSIF auth.uid() = s.babalawo_id THEN v_party := 'babalawo';
  ELSE RAISE EXCEPTION 'not a participant'; END IF;

  IF s.status::text IN ('completed','cancelled') THEN
    RAISE EXCEPTION 'session is closed';
  END IF;
  IF public.session_start_at(p_session_id) IS NOT NULL
     AND now() > public.session_start_at(p_session_id) + interval '10 minutes' THEN
    RAISE EXCEPTION 'consent can no longer be changed after the session has started';
  END IF;
  -- AI processing needs a recording; reject the contradictory combination.
  IF p_ai AND NOT p_recording THEN
    RAISE EXCEPTION 'AI processing requires recording consent';
  END IF;

  INSERT INTO public.session_consents (session_id, user_id, party, recording_consent, ai_processing_consent)
  VALUES (p_session_id, auth.uid(), v_party, p_recording, p_ai)
  ON CONFLICT (session_id, party) DO UPDATE
    SET recording_consent = EXCLUDED.recording_consent,
        ai_processing_consent = EXCLUDED.ai_processing_consent,
        consented_at = now(),
        withdrawn_at = CASE WHEN EXCLUDED.recording_consent THEN NULL ELSE now() END;

  IF public.session_has_full_consent(p_session_id) THEN
    v_new_status := CASE WHEN s.meet_space_name IS NOT NULL THEN 'scheduled' ELSE 'awaiting_consent' END;
  ELSE
    v_new_status := 'none';
  END IF;

  -- Never downgrade a session whose recording is already being processed.
  IF s.recording_status NOT IN ('processing','transcribed','notes_drafted') THEN
    UPDATE public.sessions SET recording_status = v_new_status WHERE id = p_session_id;
  END IF;
  RETURN v_new_status;
END $$;
REVOKE ALL ON FUNCTION public.record_session_consent(bigint, boolean, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_session_consent(bigint, boolean, boolean) TO authenticated;

------------------------------------------------------------------------------
-- 3. Recordings + transcripts (service-role writes; participants read via RLS
--    for metadata, media is only served through the session-media function)
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.session_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id bigint NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'meet' CHECK (source IN ('meet','upload')),
  conference_record text,
  recording_resource text,
  drive_file_id text,
  storage_path text,            -- private bucket 'session-recordings' (audio copy)
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','ready','processing','done','failed')),
  duration_seconds integer,
  retention_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, recording_resource)
);
CREATE TABLE IF NOT EXISTS public.session_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id bigint NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  recording_id uuid REFERENCES public.session_recordings(id) ON DELETE SET NULL,
  source text NOT NULL,         -- 'stt:openai', 'stt:http', 'meet_native'
  language text,                -- 'en' | 'yo' | 'mixed'
  text text NOT NULL,
  segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence numeric,
  quality jsonb NOT NULL DEFAULT '{}'::jsonb,   -- accuracy checks
  needs_review boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_session_transcripts_session ON public.session_transcripts(session_id);
CREATE INDEX IF NOT EXISTS idx_session_recordings_session ON public.session_recordings(session_id);

ALTER TABLE public.session_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_transcripts ENABLE ROW LEVEL SECURITY;

-- Metadata: both participants and admins. (No transcript text for clients here:
-- clients get it only through session-media after the Babalawo approves notes.)
DROP POLICY IF EXISTS "recordings metadata readable" ON public.session_recordings;
CREATE POLICY "recordings metadata readable" ON public.session_recordings
  FOR SELECT USING (public.is_session_participant(session_id) OR public.is_admin());

DROP POLICY IF EXISTS "transcripts readable by babalawo and admin" ON public.session_transcripts;
CREATE POLICY "transcripts readable by babalawo and admin" ON public.session_transcripts
  FOR SELECT USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.babalawo_id = auth.uid())
  );

-- Private bucket: no storage.objects policies on purpose, so only the service
-- role (workers / edge functions) can touch it. Users get 10-minute signed URLs.
INSERT INTO storage.buckets (id, name, public)
VALUES ('session-recordings', 'session-recordings', false)
ON CONFLICT (id) DO UPDATE SET public = false;

------------------------------------------------------------------------------
-- 4. Notification outbox (WhatsApp + SMS), de-duplicated
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id bigint NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN
    ('meet_link','reminder_24h','reminder_1h','rescheduled','completed','notes_ready','fallback_video')),
  dedupe_key text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE (session_id, kind, dedupe_key)
);
CREATE INDEX IF NOT EXISTS idx_outbox_due ON public.notification_outbox (next_attempt_at) WHERE status = 'pending';
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "outbox admin read" ON public.notification_outbox;
CREATE POLICY "outbox admin read" ON public.notification_outbox FOR SELECT USING (public.is_admin());

-- Opt-in/out of WhatsApp/SMS per profile (default on; phone must exist).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sms_opt_in boolean NOT NULL DEFAULT true;

-- Reschedule + completion enqueue notifications automatically.
CREATE OR REPLACE FUNCTION public.enqueue_session_notifications()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.session_date IS DISTINCT FROM OLD.session_date
        OR NEW.start_time IS DISTINCT FROM OLD.start_time)
       AND NEW.status::text NOT IN ('cancelled','completed') THEN
      INSERT INTO public.notification_outbox (session_id, kind, dedupe_key)
      VALUES (NEW.id, 'rescheduled', NEW.session_date::text || 'T' || NEW.start_time::text)
      ON CONFLICT DO NOTHING;
    END IF;
    IF NEW.status::text = 'completed' AND OLD.status::text IS DISTINCT FROM 'completed' THEN
      INSERT INTO public.notification_outbox (session_id, kind) VALUES (NEW.id, 'completed')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_enqueue_session_notifications ON public.sessions;
CREATE TRIGGER trg_enqueue_session_notifications
  AFTER UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.enqueue_session_notifications();

------------------------------------------------------------------------------
-- 4b. Audit trail for access to sensitive media
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL, target text, actor text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit admin read" ON public.admin_audit_log;
CREATE POLICY "audit admin read" ON public.admin_audit_log FOR SELECT USING (public.is_admin());

-- 5. Settings (admin-only table). Credentials are NOT stored here: they are
--    edge-function / worker secrets. See docs/GOOGLE_MEET.md.
------------------------------------------------------------------------------
INSERT INTO public.admin_settings (setting_key, setting_value, description) VALUES
  ('video_provider', 'google_meet', 'Default video provider: google_meet or agora'),
  ('video_fallback_provider', 'agora', 'Fallback when Meet link creation fails'),
  ('recording_retention_days', '90', 'Days to keep recordings and audio before deletion'),
  ('stt_provider', 'openai', 'Speech-to-text provider: openai or http'),
  ('whatsapp_notifications_enabled', 'true', 'Send WhatsApp notifications')
ON CONFLICT (setting_key) DO UPDATE
  SET setting_value = EXCLUDED.setting_value
  WHERE public.admin_settings.setting_key IN ('video_provider');
