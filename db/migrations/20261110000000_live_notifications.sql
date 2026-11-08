-- Live notifications without Supabase Realtime.
-- Each new notification row wakes the API, which pushes it to that person's open
-- browser tabs over Server-Sent Events (GET /v1/notifications/stream). Only the
-- ids travel through NOTIFY; the API reads the row itself before sending it.
CREATE OR REPLACE FUNCTION public.notify_new_notification()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('ifa_notifications', json_build_object('id', NEW.id, 'user_id', NEW.user_id)::text);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_new_notification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notifications_live ON public.notifications;
CREATE TRIGGER notifications_live AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_notification();
