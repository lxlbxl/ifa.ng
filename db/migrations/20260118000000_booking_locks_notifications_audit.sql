-- January 2026 features, rebuilt for the baseline.
--
-- The January 2026 work added booking slot locks, duplicate-booking checks,
-- notification helpers and a payment audit log. Its original migration files
-- (20240620*, 20250118*, 20250119*) were written against a schema that never
-- existed in production (profiles.user_id, babalawo_earnings, notifications
-- with recipient_id, uuid vs bigint ids) and do not apply. This file keeps
-- what the app and the later migrations call, with the same function
-- signatures the frontend uses, written against the baseline:
--   * person ids (babalawo_id, user_id) are uuid = auth.users.id
--   * every function that takes p_user_id checks it is the caller
--
-- Dropped on purpose: email_settings/email_templates/send_email (email goes
-- through the API server), babalawo_earnings (never existed),
-- payment_statistics and analytics RPCs (no caller).

-- ---------------------------------------------------------------------------
-- Columns used by the booking and notification code
-- ---------------------------------------------------------------------------
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS sessions_idempotency_key_uq
  ON public.sessions(idempotency_key) WHERE idempotency_key IS NOT NULL;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS reminder_sent boolean NOT NULL DEFAULT false;

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS data jsonb;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal'
  CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON public.notifications(user_id) WHERE NOT COALESCE(read, false);

-- Payment tracking fields (from the January payment-security work; the
-- payments migration 20261108000200 writes webhook_verified).
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS webhook_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS babalawo_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS ip_address inet;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS user_agent text;
CREATE UNIQUE INDEX IF NOT EXISTS payments_idempotency_key_uq
  ON public.payments(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS payments_babalawo_idx ON public.payments(babalawo_id);

ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS webhook_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed';
CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_idempotency_key_uq
  ON public.wallet_transactions(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Reviews can be flagged by participants for moderation.
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS flagged boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
-- Server/internal helper. Not callable from browsers (see grants below).
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid, p_type text, p_title text, p_message text,
  p_data jsonb DEFAULT NULL, p_priority text DEFAULT 'normal')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, data, priority, action_url)
  VALUES (p_user_id, p_type, p_title, p_message, p_data, COALESCE(p_priority, 'normal'), p_data->>'action_url')
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.create_notification(uuid, text, text, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, jsonb, text) TO service_role;

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH u AS (UPDATE public.notifications SET read = true
             WHERE id = p_notification_id AND user_id = auth.uid() RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM u)
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH u AS (UPDATE public.notifications SET read = true
             WHERE user_id = auth.uid() AND NOT COALESCE(read, false) RETURNING 1)
  SELECT count(*)::int FROM u
$$;

CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.notifications WHERE user_id = auth.uid() AND NOT COALESCE(read, false)
$$;

REVOKE ALL ON FUNCTION public.mark_notification_read(uuid), public.mark_all_notifications_read(),
  public.get_unread_notification_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid), public.mark_all_notifications_read(),
  public.get_unread_notification_count() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Payment audit log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id  uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  event_type  text NOT NULL,
  event_data  jsonb,
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_audit_log_created_idx ON public.payment_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS payment_audit_log_event_idx ON public.payment_audit_log(event_type);
ALTER TABLE public.payment_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view payment audit log" ON public.payment_audit_log
  FOR SELECT USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.log_payment_audit(
  p_payment_id uuid, p_event_type text, p_event_data jsonb DEFAULT NULL,
  p_ip_address inet DEFAULT NULL, p_user_agent text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.payment_audit_log (payment_id, event_type, event_data, ip_address, user_agent)
  VALUES (p_payment_id, p_event_type, p_event_data, p_ip_address, p_user_agent)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.log_payment_audit(uuid, text, jsonb, inet, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_payment_audit(uuid, text, jsonb, inet, text) TO service_role;

-- Admin audit viewer.
CREATE OR REPLACE FUNCTION public.get_recent_audit_logs(p_limit integer DEFAULT 100, p_event_type text DEFAULT NULL)
RETURNS TABLE(id uuid, payment_id uuid, event_type text, event_data jsonb, ip_address inet,
              user_agent text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin only' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
    SELECT l.id, l.payment_id, l.event_type, l.event_data, l.ip_address, l.user_agent, l.created_at
    FROM public.payment_audit_log l
    WHERE p_event_type IS NULL OR l.event_type = p_event_type
    ORDER BY l.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 1000);
END $$;
REVOKE ALL ON FUNCTION public.get_recent_audit_logs(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_recent_audit_logs(integer, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Booking slot locks: hold a time slot for a few minutes while the client pays
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.slot_locks (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  babalawo_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date       date NOT NULL,
  start_time         text NOT NULL,          -- 'HH:MM', as the booking UI sends it
  locked_by_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  locked_at          timestamptz NOT NULL DEFAULT now(),
  expires_at         timestamptz NOT NULL,
  payment_reference  text,
  status             text NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'completed', 'expired', 'released')),
  UNIQUE (babalawo_id, session_date, start_time)
);
CREATE INDEX IF NOT EXISTS slot_locks_expires_idx ON public.slot_locks(expires_at) WHERE status = 'locked';
CREATE INDEX IF NOT EXISTS slot_locks_user_idx ON public.slot_locks(locked_by_user_id);
ALTER TABLE public.slot_locks ENABLE ROW LEVEL SECURITY;
-- Reads only; all writes go through the functions below.
CREATE POLICY "Users can view their own slot locks" ON public.slot_locks
  FOR SELECT USING (locked_by_user_id = auth.uid() OR public.is_admin());

CREATE OR REPLACE FUNCTION public._assert_caller(p_user_id uuid)
RETURNS void LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.acquire_slot_lock(
  p_babalawo_id uuid, p_session_date date, p_start_time text, p_user_id uuid,
  p_lock_duration_minutes integer DEFAULT 5)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_minutes int := LEAST(GREATEST(COALESCE(p_lock_duration_minutes, 5), 1), 15);
  v_expires timestamptz := now() + make_interval(mins => v_minutes);
  v_id uuid;
  v_holder uuid;
BEGIN
  PERFORM public._assert_caller(p_user_id);

  INSERT INTO public.slot_locks AS l (babalawo_id, session_date, start_time, locked_by_user_id, expires_at, status)
  VALUES (p_babalawo_id, p_session_date, p_start_time, p_user_id, v_expires, 'locked')
  ON CONFLICT (babalawo_id, session_date, start_time) DO UPDATE
    SET locked_by_user_id = EXCLUDED.locked_by_user_id, locked_at = now(),
        expires_at = EXCLUDED.expires_at, status = 'locked', payment_reference = NULL
    WHERE l.status <> 'locked' OR l.expires_at <= now() OR l.locked_by_user_id = EXCLUDED.locked_by_user_id
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT expires_at, locked_by_user_id INTO v_expires, v_holder FROM public.slot_locks
     WHERE babalawo_id = p_babalawo_id AND session_date = p_session_date AND start_time = p_start_time;
    RETURN jsonb_build_object('success', false, 'locked_by_other', true, 'expires_at', v_expires,
      'message', 'This time slot is currently being booked by another user');
  END IF;
  RETURN jsonb_build_object('success', true, 'lock_id', v_id, 'expires_at', v_expires,
    'message', 'Lock acquired');
END $$;

CREATE OR REPLACE FUNCTION public.release_slot_lock(p_lock_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._assert_caller(p_user_id);
  UPDATE public.slot_locks SET status = 'released'
   WHERE id = p_lock_id AND locked_by_user_id = p_user_id AND status = 'locked';
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.complete_slot_lock(p_lock_id uuid, p_user_id uuid, p_payment_reference text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._assert_caller(p_user_id);
  UPDATE public.slot_locks SET status = 'completed', payment_reference = COALESCE(p_payment_reference, payment_reference)
   WHERE id = p_lock_id AND locked_by_user_id = p_user_id AND status = 'locked';
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_slot_locks()
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH u AS (UPDATE public.slot_locks SET status = 'expired'
             WHERE status = 'locked' AND expires_at <= now() RETURNING 1)
  SELECT count(*)::int FROM u
$$;

REVOKE ALL ON FUNCTION public.acquire_slot_lock(uuid, date, text, uuid, integer),
  public.release_slot_lock(uuid, uuid), public.complete_slot_lock(uuid, uuid, text),
  public.cleanup_expired_slot_locks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acquire_slot_lock(uuid, date, text, uuid, integer),
  public.release_slot_lock(uuid, uuid), public.complete_slot_lock(uuid, uuid, text),
  public.cleanup_expired_slot_locks() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Booking checks (server-side helpers)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_duplicate_session(
  p_user_id uuid, p_babalawo_id uuid, p_session_date date, p_start_time text, p_idempotency_key text)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.sessions
  WHERE (p_idempotency_key IS NOT NULL AND idempotency_key = p_idempotency_key)
     OR (user_id = p_user_id AND babalawo_id = p_babalawo_id AND session_date = p_session_date
         AND start_time = p_start_time::time AND status NOT IN ('cancelled', 'completed'))
  ORDER BY id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.check_babalawo_concurrent_sessions(p_babalawo_id uuid, p_max_concurrent integer DEFAULT 1)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*) < COALESCE(p_max_concurrent, 1) FROM public.sessions
  WHERE babalawo_id = p_babalawo_id AND status = 'in_progress' AND updated_at > now() - interval '24 hours'
$$;

REVOKE ALL ON FUNCTION public.check_duplicate_session(uuid, uuid, date, text, text),
  public.check_babalawo_concurrent_sessions(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_duplicate_session(uuid, uuid, date, text, text),
  public.check_babalawo_concurrent_sessions(uuid, integer) TO service_role;
