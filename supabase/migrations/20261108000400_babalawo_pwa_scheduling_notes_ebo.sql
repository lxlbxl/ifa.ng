-- Babalawo PWA: scheduling extras, consultation notes, Ebo prescriptions, push subscriptions.
-- Session ids are bigint. Babalawo/client ids are auth.users ids (sessions.babalawo_id / user_id).

-- 1. Scheduling settings (one row per Babalawo)
CREATE TABLE IF NOT EXISTS public.babalawo_scheduling_settings (
  babalawo_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'Africa/Lagos',
  slot_minutes int NOT NULL DEFAULT 60 CHECK (slot_minutes BETWEEN 15 AND 240),
  buffer_minutes int NOT NULL DEFAULT 0 CHECK (buffer_minutes BETWEEN 0 AND 120),
  min_notice_hours int NOT NULL DEFAULT 2 CHECK (min_notice_hours BETWEEN 0 AND 168),
  max_advance_days int NOT NULL DEFAULT 60 CHECK (max_advance_days BETWEEN 1 AND 365),
  accepting_bookings boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Date-specific exceptions: block part/all of a day, or add an extra window
CREATE TABLE IF NOT EXISTS public.availability_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  babalawo_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exception_date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('blocked','extra')),
  start_time time,
  end_time time,            -- null start/end on 'blocked' = whole day
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind = 'blocked' OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time))
);
CREATE INDEX IF NOT EXISTS availability_exceptions_lookup ON public.availability_exceptions (babalawo_id, exception_date);

-- 3. Time off ranges
CREATE TABLE IF NOT EXISTS public.babalawo_time_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  babalawo_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS babalawo_time_off_lookup ON public.babalawo_time_off (babalawo_id, start_date, end_date);

-- 4. Consultation notes (AI draft -> Babalawo approval -> client visible)
CREATE TABLE IF NOT EXISTS public.consultation_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id bigint NOT NULL UNIQUE REFERENCES public.sessions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','shared')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('ai','manual')),
  summary text,
  action_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  primary_odu text,
  other_odus text[] NOT NULL DEFAULT '{}',
  ritual_recommendations text,
  items_needed text,
  warning text,
  deadline date,
  next_appointment timestamptz,
  language text CHECK (language IN ('en','yo','mixed')),
  transcript_confidence numeric,
  transcript_id uuid,
  drafted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF to_regclass('public.session_transcripts') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consultation_notes_transcript_fk') THEN
    ALTER TABLE public.consultation_notes
      ADD CONSTRAINT consultation_notes_transcript_fk
      FOREIGN KEY (transcript_id) REFERENCES public.session_transcripts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Ebo / Etutu prescriptions
CREATE TABLE IF NOT EXISTS public.ebo_prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id bigint NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  babalawo_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'ebo' CHECK (kind IN ('ebo','etutu','other')),
  title text NOT NULL,
  description text,
  items text,
  estimated_cost numeric CHECK (estimated_cost IS NULL OR estimated_cost >= 0),
  due_date date,
  status text NOT NULL DEFAULT 'prescribed' CHECK (status IN ('prescribed','in_progress','completed','cancelled')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ebo_prescriptions_session ON public.ebo_prescriptions (session_id);
CREATE INDEX IF NOT EXISTS ebo_prescriptions_client ON public.ebo_prescriptions (client_id, status);

-- 6. Web push subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Helper: is the caller a party to this session
CREATE OR REPLACE FUNCTION public.is_session_babalawo(_session_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.sessions WHERE id = _session_id AND babalawo_id = auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.is_session_client(_session_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.sessions WHERE id = _session_id AND user_id = auth.uid());
$$;

-- RLS
ALTER TABLE public.babalawo_scheduling_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.babalawo_time_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ebo_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Scheduling tables: owner manages; any signed-in user can read (booking needs them)
CREATE POLICY sched_settings_read ON public.babalawo_scheduling_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY sched_settings_write ON public.babalawo_scheduling_settings FOR ALL TO authenticated
  USING (babalawo_id = auth.uid()) WITH CHECK (babalawo_id = auth.uid());
CREATE POLICY avail_exc_read ON public.availability_exceptions FOR SELECT TO authenticated USING (true);
CREATE POLICY avail_exc_write ON public.availability_exceptions FOR ALL TO authenticated
  USING (babalawo_id = auth.uid()) WITH CHECK (babalawo_id = auth.uid());
CREATE POLICY time_off_read ON public.babalawo_time_off FOR SELECT TO authenticated USING (true);
CREATE POLICY time_off_write ON public.babalawo_time_off FOR ALL TO authenticated
  USING (babalawo_id = auth.uid()) WITH CHECK (babalawo_id = auth.uid());

-- Notes: Babalawo of the session full access; client reads once approved/shared; admin reads all
CREATE POLICY notes_babalawo_all ON public.consultation_notes FOR ALL TO authenticated
  USING (public.is_session_babalawo(session_id)) WITH CHECK (public.is_session_babalawo(session_id));
CREATE POLICY notes_client_read ON public.consultation_notes FOR SELECT TO authenticated
  USING (status IN ('approved','shared') AND public.is_session_client(session_id));
CREATE POLICY notes_admin_read ON public.consultation_notes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Ebo: Babalawo manages their own; client reads theirs and may mark progress via RPC below
CREATE POLICY ebo_babalawo_all ON public.ebo_prescriptions FOR ALL TO authenticated
  USING (babalawo_id = auth.uid() AND public.is_session_babalawo(session_id))
  WITH CHECK (babalawo_id = auth.uid() AND public.is_session_babalawo(session_id));
CREATE POLICY ebo_client_read ON public.ebo_prescriptions FOR SELECT TO authenticated USING (client_id = auth.uid());
CREATE POLICY ebo_admin_read ON public.ebo_prescriptions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY push_own ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Client marks their own Ebo progress (status only)
CREATE OR REPLACE FUNCTION public.set_ebo_status(p_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_status NOT IN ('in_progress','completed') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  UPDATE public.ebo_prescriptions
     SET status = p_status,
         completed_at = CASE WHEN p_status = 'completed' THEN now() ELSE NULL END,
         updated_at = now()
   WHERE id = p_id AND client_id = auth.uid() AND status <> 'cancelled';
  IF NOT FOUND THEN RAISE EXCEPTION 'Prescription not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_ebo_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_ebo_status(uuid, text) TO authenticated;

-- Approving notes stamps who/when and mirrors outcome text to legacy sessions columns;
-- AI/anon callers can't self-approve or change source.
CREATE OR REPLACE FUNCTION public.consultation_notes_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status IN ('approved','shared') AND (TG_OP = 'INSERT' OR OLD.status = 'draft') THEN
    IF auth.uid() IS NOT NULL AND NOT public.is_session_babalawo(NEW.session_id) THEN
      RAISE EXCEPTION 'Only the session Babalawo can approve notes';
    END IF;
    NEW.approved_at := COALESCE(NEW.approved_at, now());
    NEW.approved_by := COALESCE(NEW.approved_by, auth.uid());
  END IF;
  -- A human edit turns an AI draft into a Babalawo-owned manual note
  IF TG_OP = 'UPDATE' AND auth.uid() IS NOT NULL AND OLD.source = 'ai' AND OLD.status = 'draft' THEN
    NEW.source := 'manual';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER consultation_notes_before_write BEFORE INSERT OR UPDATE ON public.consultation_notes
  FOR EACH ROW EXECUTE FUNCTION public.consultation_notes_before_write();

CREATE OR REPLACE FUNCTION public.consultation_notes_after_approve()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('approved','shared') THEN
    UPDATE public.sessions SET
      primary_odu = COALESCE(NEW.primary_odu, primary_odu),
      ritual_recommendations = COALESCE(NEW.ritual_recommendations, ritual_recommendations),
      warning = COALESCE(NEW.warning, warning),
      notes = COALESCE(NEW.summary, notes)
    WHERE id = NEW.session_id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER consultation_notes_after_approve AFTER INSERT OR UPDATE ON public.consultation_notes
  FOR EACH ROW EXECUTE FUNCTION public.consultation_notes_after_approve();
