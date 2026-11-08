-- Function to rollback wallet transactions
CREATE OR REPLACE FUNCTION rollback_wallet_transaction(p_transaction_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_transaction_record RECORD;
  v_wallet_id UUID;
BEGIN
  -- Get transaction details
  SELECT * INTO v_transaction_record
  FROM wallet_transactions
  WHERE id = p_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found: %', p_transaction_id;
  END IF;

  -- Check if already rolled back
  IF v_transaction_record.status = 'rolled_back' THEN
    RETURN TRUE;
  END IF;

  -- Get wallet ID
  SELECT id INTO v_wallet_id
  FROM wallets
  WHERE user_id = v_transaction_record.user_id;

  IF v_transaction_record.transaction_type = 'debit' THEN
    -- Reverse debit (add money back)
    UPDATE wallets
    SET
      balance = balance + v_transaction_record.amount,
      updated_at = NOW()
    WHERE id = v_wallet_id;

    -- Create reversal transaction
    INSERT INTO wallet_transactions (
      user_id,
      amount,
      transaction_type,
      transaction_source,
      description,
      status
    ) VALUES (
      v_transaction_record.user_id,
      v_transaction_record.amount,
      'credit',
      'rollback',
      'Rollback of transaction: ' || p_transaction_id::TEXT,
      'completed'
    );

  ELSIF v_transaction_record.transaction_type = 'credit' THEN
    -- Reverse credit (deduct money back)
    UPDATE wallets
    SET
      balance = balance - v_transaction_record.amount,
      updated_at = NOW()
    WHERE id = v_wallet_id;

    -- Create reversal transaction
    INSERT INTO wallet_transactions (
      user_id,
      amount,
      transaction_type,
      transaction_source,
      description,
      status
    ) VALUES (
      v_transaction_record.user_id,
      v_transaction_record.amount,
      'debit',
      'rollback',
      'Rollback of transaction: ' || p_transaction_id::TEXT,
      'completed'
    );
  END IF;

  -- Mark original transaction as rolled back
  UPDATE wallet_transactions
  SET status = 'rolled_back'
  WHERE id = p_transaction_id;

  RETURN TRUE;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Rollback failed: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check for duplicate sessions
CREATE OR REPLACE FUNCTION check_duplicate_session(
  p_user_id UUID,
  p_babalawo_id BIGINT,
  p_session_date DATE,
  p_start_time TEXT,
  p_idempotency_key TEXT
)
RETURNS UUID AS $$
DECLARE
  v_existing_session_id BIGINT;
BEGIN
  -- Check by idempotency key first
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_session_id
    FROM sessions
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      RETURN v_existing_session_id::UUID;
    END IF;
  END IF;

  -- Check by duplicate_check_key (user + babalawo + date + time)
  SELECT id INTO v_existing_session_id
  FROM sessions
  WHERE user_id = p_user_id
    AND babalawo_id = p_babalawo_id
    AND session_date = p_session_date
    AND start_time = p_start_time
    AND status NOT IN ('cancelled', 'completed')
    AND created_at > NOW() - INTERVAL '10 minutes'
  LIMIT 1;

  IF FOUND THEN
    RETURN v_existing_session_id::UUID;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check babalawo concurrent sessions
CREATE OR REPLACE FUNCTION check_babalawo_concurrent_sessions(
  p_babalawo_id BIGINT,
  p_max_concurrent INT DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
  v_active_count INT;
BEGIN
  SELECT COUNT(*) INTO v_active_count
  FROM sessions
  WHERE babalawo_id = p_babalawo_id
    AND status = 'in_progress'
    AND created_at > NOW() - INTERVAL '24 hours';

  RETURN v_active_count < p_max_concurrent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_data JSONB DEFAULT NULL,
  p_priority TEXT DEFAULT 'normal'
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    data,
    priority
  ) VALUES (
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_data,
    p_priority
  ) RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log payment audit event
CREATE OR REPLACE FUNCTION log_payment_audit(
  p_payment_id UUID,
  p_event_type TEXT,
  p_event_data JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO payment_audit_log (
    payment_id,
    event_type,
    event_data,
    ip_address,
    user_agent
  ) VALUES (
    p_payment_id,
    p_event_type,
    p_event_data,
    p_ip_address,
    p_user_agent
  ) RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the update_wallet_balance function to return transaction ID
CREATE OR REPLACE FUNCTION public.update_wallet_balance(
  p_user_id UUID,
  p_amount NUMERIC,
  p_transaction_type TEXT,
  p_transaction_source TEXT,
  p_payment_gateway TEXT DEFAULT NULL,
  p_payment_reference TEXT DEFAULT NULL,
  p_session_id BIGINT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
  v_new_balance NUMERIC;
BEGIN
  -- Check for duplicate transaction using idempotency key
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_transaction_id
    FROM wallet_transactions
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN v_transaction_id;
    END IF;
  END IF;

  -- Get or create wallet
  SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = p_user_id;

  IF v_wallet_id IS NULL THEN
    INSERT INTO public.wallets (user_id) VALUES (p_user_id) RETURNING id INTO v_wallet_id;
  END IF;

  -- Calculate new balance
  IF p_transaction_type = 'credit' THEN
    UPDATE public.wallets
    SET balance = balance + p_amount, updated_at = now()
    WHERE id = v_wallet_id
    RETURNING balance INTO v_new_balance;
  ELSE
    -- Check sufficient balance for debit
    SELECT balance INTO v_new_balance FROM public.wallets WHERE id = v_wallet_id;
    IF v_new_balance < p_amount THEN
      RAISE EXCEPTION 'Insufficient balance';
    END IF;

    UPDATE public.wallets
    SET balance = balance - p_amount, updated_at = now()
    WHERE id = v_wallet_id
    RETURNING balance INTO v_new_balance;
  END IF;

  -- Create transaction record
  INSERT INTO public.wallet_transactions (
    user_id,
    amount,
    transaction_type,
    transaction_source,
    payment_gateway,
    payment_reference,
    session_id,
    description,
    balance_after,
    idempotency_key,
    status
  ) VALUES (
    p_user_id,
    p_amount,
    p_transaction_type,
    p_transaction_source,
    p_payment_gateway,
    p_payment_reference,
    p_session_id,
    p_description,
    v_new_balance,
    p_idempotency_key,
    'completed'
  ) RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON FUNCTION rollback_wallet_transaction(UUID) IS 'Rollback a wallet transaction and reverse the balance change';
COMMENT ON FUNCTION check_duplicate_session(UUID, BIGINT, DATE, TEXT, TEXT) IS 'Check if a duplicate session exists to prevent double booking';
COMMENT ON FUNCTION check_babalawo_concurrent_sessions(BIGINT, INT) IS 'Check if babalawo can accept more concurrent sessions';
COMMENT ON FUNCTION create_notification(UUID, TEXT, TEXT, TEXT, JSONB, TEXT) IS 'Create a notification for a user';
COMMENT ON FUNCTION log_payment_audit(UUID, TEXT, JSONB, INET, TEXT) IS 'Log a payment audit event';
