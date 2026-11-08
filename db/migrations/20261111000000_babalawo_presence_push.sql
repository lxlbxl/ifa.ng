-- Babalawo Online/Offline presence and web push delivery.
--
-- babalawos.current_status ('online' | 'busy' | 'offline') stays the one source of
-- truth that Consult Now and _assert_bookable read. From here on a Babalawo can only
-- change it through the API (POST /v1/me/presence), which refuses Online unless
-- notifications are on for that device. Admins and the service role may still set it.

-- 1. Presence columns
ALTER TABLE public.babalawos ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;
ALTER TABLE public.babalawos ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
UPDATE public.babalawos SET current_status = 'offline'
 WHERE current_status IS NULL OR current_status NOT IN ('online', 'busy', 'offline');
ALTER TABLE public.babalawos ALTER COLUMN current_status SET DEFAULT 'offline';
ALTER TABLE public.babalawos DROP CONSTRAINT IF EXISTS babalawos_current_status_check;
ALTER TABLE public.babalawos ADD CONSTRAINT babalawos_current_status_check
  CHECK (current_status IS NULL OR current_status IN ('online', 'busy', 'offline'));

-- 2. Only the API (service role) or an admin may change presence.
CREATE OR REPLACE FUNCTION public.guard_babalawo_presence()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      NEW.current_status := 'offline';
      NEW.status_changed_at := NULL;
      NEW.last_seen_at := NULL;
    ELSIF NEW.current_status IS DISTINCT FROM OLD.current_status
       OR NEW.status_changed_at IS DISTINCT FROM OLD.status_changed_at
       OR NEW.last_seen_at IS DISTINCT FROM OLD.last_seen_at THEN
      RAISE EXCEPTION 'Use the Online switch in the app to change your status' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_babalawo_presence ON public.babalawos;
CREATE TRIGGER trg_guard_babalawo_presence BEFORE INSERT OR UPDATE ON public.babalawos
  FOR EACH ROW EXECUTE FUNCTION public.guard_babalawo_presence();

-- 3. Public presence check, used by Consult Now. Anyone may ask.
CREATE OR REPLACE FUNCTION public.babalawo_presence(p_babalawo uuid)
RETURNS TABLE(status text, available_now boolean, last_seen_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH b AS (
    SELECT COALESCE(b.current_status, 'offline') AS st, b.last_seen_at AS seen,
           b.is_verified AND COALESCE(b.is_active, true) AS listed,
           EXISTS (SELECT 1 FROM sessions s WHERE s.babalawo_id = b.user_id AND s.status = 'in_progress') AS in_session
      FROM babalawos b WHERE b.user_id = p_babalawo
  )
  SELECT CASE WHEN NOT listed THEN 'offline' WHEN st = 'online' AND in_session THEN 'busy' ELSE st END,
         listed AND st = 'online' AND NOT in_session,
         seen
    FROM b
$$;
REVOKE ALL ON FUNCTION public.babalawo_presence(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.babalawo_presence(uuid) TO anon, authenticated, service_role;

-- 4. Push subscription health
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS last_success_at timestamptz;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS failure_count int NOT NULL DEFAULT 0;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS push_subscriptions_user ON public.push_subscriptions (user_id);

-- 5. Each notification is pushed at most once.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS pushed_at timestamptz;
CREATE INDEX IF NOT EXISTS notifications_unpushed ON public.notifications (created_at) WHERE pushed_at IS NULL;

-- 6. Stale Online: no heartbeat for 15 minutes and no way to reach them by push,
--    or no heartbeat at all for 12 hours. Returns the Babalawos switched off.
CREATE OR REPLACE FUNCTION public.expire_stale_presence()
RETURNS SETOF uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH gone AS (
    UPDATE babalawos b SET current_status = 'offline', status_changed_at = now()
     WHERE b.current_status = 'online'
       AND (
         COALESCE(b.last_seen_at, b.status_changed_at, 'epoch') < now() - interval '12 hours'
         OR (COALESCE(b.last_seen_at, b.status_changed_at, 'epoch') < now() - interval '15 minutes'
             AND NOT EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.user_id = b.user_id AND p.failure_count < 3))
       )
     RETURNING b.user_id
  )
  SELECT user_id FROM gone;
END $$;
REVOKE ALL ON FUNCTION public.expire_stale_presence() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_presence() TO service_role;
