-- Create slot_locks table for real-time availability locking
CREATE TABLE IF NOT EXISTS public.slot_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  babalawo_id BIGINT NOT NULL REFERENCES public.babalawos(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  start_time TEXT NOT NULL,
  locked_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  locked_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  payment_reference TEXT,
  status TEXT DEFAULT 'locked' CHECK (status IN ('locked', 'completed', 'expired', 'released')),
  UNIQUE(babalawo_id, session_date, start_time)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_slot_locks_babalawo ON public.slot_locks(babalawo_id, session_date);
CREATE INDEX IF NOT EXISTS idx_slot_locks_user ON public.slot_locks(locked_by_user_id);
CREATE INDEX IF NOT EXISTS idx_slot_locks_expires ON public.slot_locks(expires_at);
CREATE INDEX IF NOT EXISTS idx_slot_locks_status ON public.slot_locks(status);

-- Enable RLS
ALTER TABLE public.slot_locks ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own slot locks"
ON public.slot_locks FOR SELECT
USING (auth.uid() = locked_by_user_id OR is_admin());

CREATE POLICY "Users can create slot locks"
ON public.slot_locks FOR INSERT
WITH CHECK (auth.uid() = locked_by_user_id);

CREATE POLICY "Users can update their own slot locks"
ON public.slot_locks FOR UPDATE
USING (auth.uid() = locked_by_user_id);

-- Function to acquire slot lock
CREATE OR REPLACE FUNCTION acquire_slot_lock(
  p_babalawo_id BIGINT,
  p_session_date DATE,
  p_start_time TEXT,
  p_user_id UUID,
  p_lock_duration_minutes INT DEFAULT 5
)
RETURNS JSONB AS $$
DECLARE
  v_lock_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_existing_lock RECORD;
BEGIN
  -- Check for existing valid lock
  SELECT * INTO v_existing_lock
  FROM slot_locks
  WHERE babalawo_id = p_babalawo_id
    AND session_date = p_session_date
    AND start_time = p_start_time
    AND status = 'locked'
    AND expires_at > NOW();

  -- If lock exists and belongs to another user, deny
  IF FOUND AND v_existing_lock.locked_by_user_id != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'This time slot is currently being booked by another user',
      'locked_by_other', true,
      'expires_at', v_existing_lock.expires_at
    );
  END IF;

  -- If lock exists and belongs to this user, extend it
  IF FOUND AND v_existing_lock.locked_by_user_id = p_user_id THEN
    v_expires_at := NOW() + (p_lock_duration_minutes || ' minutes')::INTERVAL;

    UPDATE slot_locks
    SET expires_at = v_expires_at,
        locked_at = NOW()
    WHERE id = v_existing_lock.id
    RETURNING id INTO v_lock_id;

    RETURN jsonb_build_object(
      'success', true,
      'lock_id', v_lock_id,
      'message', 'Lock extended',
      'expires_at', v_expires_at
    );
  END IF;

  -- Create new lock
  v_expires_at := NOW() + (p_lock_duration_minutes || ' minutes')::INTERVAL;

  INSERT INTO slot_locks (
    babalawo_id,
    session_date,
    start_time,
    locked_by_user_id,
    expires_at,
    status
  ) VALUES (
    p_babalawo_id,
    p_session_date,
    p_start_time,
    p_user_id,
    v_expires_at,
    'locked'
  )
  ON CONFLICT (babalawo_id, session_date, start_time)
  DO UPDATE SET
    locked_by_user_id = p_user_id,
    locked_at = NOW(),
    expires_at = v_expires_at,
    status = 'locked'
  WHERE slot_locks.status != 'locked' OR slot_locks.expires_at <= NOW()
  RETURNING id INTO v_lock_id;

  IF v_lock_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Failed to acquire lock',
      'locked_by_other', true
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'lock_id', v_lock_id,
    'message', 'Lock acquired successfully',
    'expires_at', v_expires_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to release slot lock
CREATE OR REPLACE FUNCTION release_slot_lock(
  p_lock_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE slot_locks
  SET status = 'released'
  WHERE id = p_lock_id
    AND locked_by_user_id = p_user_id
    AND status = 'locked';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete slot lock (called after successful booking)
CREATE OR REPLACE FUNCTION complete_slot_lock(
  p_babalawo_id BIGINT,
  p_session_date DATE,
  p_start_time TEXT,
  p_user_id UUID,
  p_payment_reference TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE slot_locks
  SET
    status = 'completed',
    payment_reference = p_payment_reference
  WHERE babalawo_id = p_babalawo_id
    AND session_date = p_session_date
    AND start_time = p_start_time
    AND locked_by_user_id = p_user_id
    AND status = 'locked';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup expired locks
CREATE OR REPLACE FUNCTION cleanup_expired_slot_locks()
RETURNS INT AS $$
DECLARE
  v_deleted_count INT;
BEGIN
  UPDATE slot_locks
  SET status = 'expired'
  WHERE status = 'locked'
    AND expires_at <= NOW();

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create periodic cleanup job (requires pg_cron extension)
-- This is optional and can be handled by application code if pg_cron is not available
-- SELECT cron.schedule('cleanup-expired-locks', '*/5 * * * *', 'SELECT cleanup_expired_slot_locks()');

-- Add email settings to admin_settings table
INSERT INTO admin_settings (setting_key, setting_value, description) VALUES
  ('email_provider', '', 'Email provider: sendgrid, resend, smtp'),
  ('sendgrid_api_key', '', 'SendGrid API key'),
  ('resend_api_key', '', 'Resend API key'),
  ('smtp_host', '', 'SMTP server host'),
  ('smtp_port', '587', 'SMTP server port'),
  ('smtp_username', '', 'SMTP username'),
  ('smtp_password', '', 'SMTP password'),
  ('smtp_from_email', '', 'From email address'),
  ('smtp_from_name', 'IFA Connect', 'From name'),
  ('email_notifications_enabled', 'true', 'Enable/disable email notifications')
ON CONFLICT (setting_key) DO NOTHING;

-- Add payment gateway fee settings
INSERT INTO admin_settings (setting_key, setting_value, description) VALUES
  ('flutterwave_fee_percent', '1.4', 'Flutterwave fee percentage'),
  ('flutterwave_fee_cap', '2000', 'Flutterwave fee cap in Naira'),
  ('paystack_fee_percent', '1.5', 'Paystack fee percentage'),
  ('paystack_fee_cap', '2000', 'Paystack fee cap in Naira'),
  ('show_payment_fees', 'true', 'Show payment fees to users')
ON CONFLICT (setting_key) DO NOTHING;

-- Comments
COMMENT ON TABLE slot_locks IS 'Temporary locks on time slots during booking process to prevent double booking';
COMMENT ON FUNCTION acquire_slot_lock IS 'Acquire a lock on a time slot for a specific duration (default 5 minutes)';
COMMENT ON FUNCTION release_slot_lock IS 'Release a slot lock manually';
COMMENT ON FUNCTION complete_slot_lock IS 'Mark a slot lock as completed after successful booking';
COMMENT ON FUNCTION cleanup_expired_slot_locks IS 'Cleanup expired slot locks (should be run periodically)';
