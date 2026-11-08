-- Add security and tracking fields to payments table
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS webhook_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS babalawo_id BIGINT REFERENCES public.babalawos(id);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_payments_idempotency ON public.payments(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_payments_babalawo ON public.payments(babalawo_id);
CREATE INDEX IF NOT EXISTS idx_payments_webhook ON public.payments(webhook_verified);

-- Add unique constraint on idempotency key
ALTER TABLE public.payments ADD CONSTRAINT unique_idempotency_key UNIQUE (idempotency_key);

-- Add security fields to sessions table
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS duplicate_check_key TEXT;

-- Add indexes for sessions
CREATE INDEX IF NOT EXISTS idx_sessions_idempotency ON public.sessions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_sessions_duplicate_check ON public.sessions(duplicate_check_key);

-- Add unique constraint on session idempotency key
ALTER TABLE public.sessions ADD CONSTRAINT unique_session_idempotency UNIQUE (idempotency_key);

-- Add webhook verification to wallet transactions
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS webhook_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';

-- Add indexes for wallet transactions
CREATE INDEX IF NOT EXISTS idx_wallet_tx_idempotency ON public.wallet_transactions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_status ON public.wallet_transactions(status);

-- Add constraint for wallet transaction idempotency
ALTER TABLE public.wallet_transactions ADD CONSTRAINT unique_wallet_tx_idempotency UNIQUE (idempotency_key);

-- Add notification table for real-time notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Add indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- Add payment audit log table
CREATE TABLE IF NOT EXISTS public.payment_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for audit log
CREATE INDEX IF NOT EXISTS idx_payment_audit_payment ON public.payment_audit_log(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_created ON public.payment_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_audit_event_type ON public.payment_audit_log(event_type);

-- Enable RLS on payment audit log
ALTER TABLE public.payment_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policy for payment audit log (admins only)
CREATE POLICY "Admins can view payment audit log"
ON public.payment_audit_log FOR SELECT
USING (is_admin());

-- Comment on tables
COMMENT ON TABLE public.notifications IS 'Real-time notifications for users including instant session requests';
COMMENT ON TABLE public.payment_audit_log IS 'Audit trail for all payment-related events';
COMMENT ON COLUMN public.payments.webhook_verified IS 'Whether payment was verified via webhook (server-side)';
COMMENT ON COLUMN public.payments.idempotency_key IS 'Unique key to prevent duplicate payments';
COMMENT ON COLUMN public.sessions.idempotency_key IS 'Unique key to prevent duplicate session bookings';
