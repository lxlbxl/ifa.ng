-- ============================================================================
-- IFA Connect - Phase 2 to Phase 5 Improvements
-- Created: 2026-01-19
-- Description: Comprehensive improvements for notifications, SMS, analytics, and monitoring
-- ============================================================================

-- ============================================================================
-- PHASE 2: Real-time Notifications & SMS
-- ============================================================================

-- Add SMS settings to admin_settings
INSERT INTO admin_settings (setting_key, setting_value, description) VALUES
  ('sms_provider', 'termii', 'SMS provider (currently supports termii)'),
  ('termii_api_key', '', 'Termii API key for SMS'),
  ('termii_sender_id', 'IFA Connect', 'Termii sender ID (max 11 characters)'),
  ('sms_notifications_enabled', 'false', 'Enable/disable SMS notifications')
ON CONFLICT (setting_key) DO NOTHING;

-- Add Sentry/error tracking settings
INSERT INTO admin_settings (setting_key, setting_value, description) VALUES
  ('sentry_dsn', '', 'Sentry DSN for error tracking'),
  ('sentry_environment', 'production', 'Sentry environment (development/staging/production)'),
  ('error_tracking_enabled', 'false', 'Enable/disable error tracking')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================================
-- PHASE 3: Enhanced Notifications Table
-- ============================================================================

-- Check if notifications table exists, if not create it
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  read BOOLEAN DEFAULT FALSE,
  email_sent BOOLEAN DEFAULT FALSE,
  sms_sent BOOLEAN DEFAULT FALSE,
  push_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

-- RLS for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE notifications
  SET read = TRUE, read_at = NOW()
  WHERE id = p_notification_id
    AND user_id = auth.uid();

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE notifications
  SET read = TRUE, read_at = NOW()
  WHERE user_id = auth.uid()
    AND read = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count()
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM notifications
  WHERE user_id = auth.uid()
    AND read = FALSE;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PHASE 4: Payment Analytics Tables
-- ============================================================================

-- Payment statistics table for caching
CREATE TABLE IF NOT EXISTS public.payment_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  gateway TEXT NOT NULL,
  total_transactions INT DEFAULT 0,
  successful_transactions INT DEFAULT 0,
  failed_transactions INT DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,
  total_fees DECIMAL(10,2) DEFAULT 0,
  total_commission DECIMAL(10,2) DEFAULT 0,
  average_transaction_time_ms INT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, gateway)
);

CREATE INDEX IF NOT EXISTS idx_payment_stats_date ON public.payment_statistics(date DESC);
CREATE INDEX IF NOT EXISTS idx_payment_stats_gateway ON public.payment_statistics(gateway);

-- Function to calculate payment statistics
CREATE OR REPLACE FUNCTION calculate_payment_statistics(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  date DATE,
  gateway TEXT,
  total_transactions BIGINT,
  successful_transactions BIGINT,
  failed_transactions BIGINT,
  total_amount DECIMAL,
  success_rate DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.created_at::DATE as date,
    p.payment_method as gateway,
    COUNT(*) as total_transactions,
    COUNT(*) FILTER (WHERE p.status = 'completed') as successful_transactions,
    COUNT(*) FILTER (WHERE p.status = 'failed') as failed_transactions,
    COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'completed'), 0) as total_amount,
    ROUND(
      (COUNT(*) FILTER (WHERE p.status = 'completed')::DECIMAL / NULLIF(COUNT(*), 0)) * 100,
      2
    ) as success_rate
  FROM payments p
  WHERE p.created_at::DATE BETWEEN p_start_date AND p_end_date
  GROUP BY p.created_at::DATE, p.payment_method
  ORDER BY p.created_at::DATE DESC, p.payment_method;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get top earning babalawos
CREATE OR REPLACE FUNCTION get_top_earning_babalawos(
  p_limit INT DEFAULT 10,
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  babalawo_id BIGINT,
  babalawo_name TEXT,
  total_sessions BIGINT,
  total_earnings DECIMAL,
  average_session_price DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id as babalawo_id,
    b.full_name as babalawo_name,
    COUNT(s.id) as total_sessions,
    COALESCE(SUM(p.amount), 0) as total_earnings,
    ROUND(AVG(p.amount), 2) as average_session_price
  FROM babalawos b
  LEFT JOIN sessions s ON s.babalawo_id = b.id
  LEFT JOIN payments p ON p.session_id = s.id
  WHERE p.status = 'completed'
    AND p.created_at::DATE BETWEEN p_start_date AND p_end_date
  GROUP BY b.id, b.full_name
  ORDER BY total_earnings DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get payment failure reasons
CREATE OR REPLACE FUNCTION get_payment_failure_reasons(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  failure_reason TEXT,
  count BIGINT,
  percentage DECIMAL
) AS $$
DECLARE
  v_total_failures BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_total_failures
  FROM payment_audit_log
  WHERE event_type = 'payment_failed'
    AND created_at::DATE BETWEEN p_start_date AND p_end_date;

  RETURN QUERY
  SELECT
    COALESCE(event_data->>'error_message', 'Unknown') as failure_reason,
    COUNT(*) as count,
    ROUND((COUNT(*)::DECIMAL / NULLIF(v_total_failures, 0)) * 100, 2) as percentage
  FROM payment_audit_log
  WHERE event_type = 'payment_failed'
    AND created_at::DATE BETWEEN p_start_date AND p_end_date
  GROUP BY COALESCE(event_data->>'error_message', 'Unknown')
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PHASE 5: Session Reminders
-- ============================================================================

-- Add reminder settings
INSERT INTO admin_settings (setting_key, setting_value, description) VALUES
  ('session_reminder_enabled', 'true', 'Enable session reminders'),
  ('session_reminder_minutes', '30', 'Minutes before session to send reminder'),
  ('session_reminder_channels', 'email,sms', 'Channels for reminders (comma-separated: email,sms,push)')
ON CONFLICT (setting_key) DO NOTHING;

-- Function to get upcoming sessions needing reminders
CREATE OR REPLACE FUNCTION get_sessions_needing_reminders(
  p_reminder_minutes INT DEFAULT 30
)
RETURNS TABLE (
  session_id BIGINT,
  user_id UUID,
  babalawo_id BIGINT,
  session_date DATE,
  start_time TEXT,
  user_email TEXT,
  user_phone TEXT,
  babalawo_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id as session_id,
    s.user_id,
    s.babalawo_id,
    s.session_date,
    s.start_time,
    up.email as user_email,
    up.phone_number as user_phone,
    b.full_name as babalawo_name
  FROM sessions s
  JOIN auth.users au ON au.id = s.user_id
  JOIN user_profiles up ON up.user_id = s.user_id
  JOIN babalawos b ON b.id = s.babalawo_id
  WHERE s.status = 'scheduled'
    AND s.reminder_sent = FALSE
    AND (s.session_date + s.start_time::TIME) - NOW() <= (p_reminder_minutes || ' minutes')::INTERVAL
    AND (s.session_date + s.start_time::TIME) > NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add reminder_sent column to sessions if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'reminder_sent'
  ) THEN
    ALTER TABLE sessions ADD COLUMN reminder_sent BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- ============================================================================
-- PHASE 5: Audit Log Enhancements
-- ============================================================================

-- Add more indexes to payment_audit_log if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_audit_log') THEN
    CREATE INDEX IF NOT EXISTS idx_payment_audit_event_type ON payment_audit_log(event_type);
    CREATE INDEX IF NOT EXISTS idx_payment_audit_ip ON payment_audit_log(ip_address);
  END IF;
END $$;

-- Function to get recent audit logs
CREATE OR REPLACE FUNCTION get_recent_audit_logs(
  p_limit INT DEFAULT 100,
  p_event_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  payment_id UUID,
  event_type TEXT,
  event_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pal.id,
    pal.payment_id,
    pal.event_type,
    pal.event_data,
    pal.ip_address,
    pal.user_agent,
    pal.created_at
  FROM payment_audit_log pal
  WHERE (p_event_type IS NULL OR pal.event_type = p_event_type)
  ORDER BY pal.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE notifications IS 'Notification system for users with multi-channel support (email, SMS, push)';
COMMENT ON TABLE payment_statistics IS 'Cached payment statistics for analytics dashboard';
COMMENT ON FUNCTION calculate_payment_statistics IS 'Calculate payment statistics for a date range';
COMMENT ON FUNCTION get_top_earning_babalawos IS 'Get top earning babalawos for analytics';
COMMENT ON FUNCTION get_payment_failure_reasons IS 'Analyze payment failure patterns';
COMMENT ON FUNCTION get_sessions_needing_reminders IS 'Get sessions that need reminders sent';
COMMENT ON FUNCTION get_recent_audit_logs IS 'Get recent audit logs for monitoring';
