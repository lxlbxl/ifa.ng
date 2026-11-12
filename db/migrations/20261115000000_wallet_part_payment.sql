-- Pay part from the wallet, the rest by card / bank transfer.
--
-- A consultation or an Ebo can now be paid with whatever is in the client's wallet plus
-- Paystack or Flutterwave for the difference. Nothing is taken from the wallet until the
-- gateway confirms the card part. At that moment, in one transaction, the wallet part is
-- debited and the session (or Ebo) is paid in full. If the wallet no longer holds enough
-- (the client spent it in another tab), the card money is put in the wallet instead and
-- nothing is booked, exactly like a slot taken while paying.
--
-- Refunds keep working as before: the full price goes back to the client's wallet.

INSERT INTO public.admin_settings(setting_key, setting_value, description, is_public)
VALUES ('min_card_payment', '100', 'Smallest amount (NGN) charged by card when the wallet pays the rest', true)
ON CONFLICT (setting_key) DO NOTHING;

ALTER TABLE public.payment_intents ADD COLUMN IF NOT EXISTS wallet_amount numeric(12,2) NOT NULL DEFAULT 0
  CHECK (wallet_amount >= 0);
COMMENT ON COLUMN public.payment_intents.wallet_amount IS
  'Part of the price paid from the wallet when the gateway confirms; amount is the card part only.';

-- How much of p_total the wallet would pay, leaving at least the card minimum for the gateway.
CREATE OR REPLACE FUNCTION public._wallet_share(p_user uuid, p_total numeric)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_bal numeric; v_min numeric := public.get_setting_numeric('min_card_payment', 100);
BEGIN
  SELECT balance INTO v_bal FROM wallets WHERE user_id = p_user;
  v_bal := COALESCE(v_bal, 0);
  IF v_bal >= p_total THEN
    RAISE EXCEPTION 'Your wallet already covers this. Choose Pay from wallet.';
  END IF;
  RETURN GREATEST(0, LEAST(v_bal, p_total - v_min));
END $$;

DROP FUNCTION IF EXISTS public.create_payment_intent(uuid, text, text, numeric, uuid, date, text, boolean, uuid, text);
CREATE OR REPLACE FUNCTION public.create_payment_intent(
  p_user uuid, p_kind text, p_gateway text, p_amount numeric DEFAULT NULL,
  p_babalawo_user_id uuid DEFAULT NULL, p_session_date date DEFAULT NULL, p_start_time text DEFAULT NULL,
  p_is_instant boolean DEFAULT false, p_ebo_id uuid DEFAULT NULL, p_ebo_attendance text DEFAULT NULL,
  p_use_wallet boolean DEFAULT false)
RETURNS TABLE(reference text, amount numeric, wallet_amount numeric, total numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_amt numeric; v_wal numeric := 0; v_ref text; e ebo_prescriptions%ROWTYPE;
BEGIN
  IF public.is_suspended(p_user) THEN RAISE EXCEPTION 'Your account is suspended'; END IF;
  IF p_kind = 'wallet_topup' THEN
    v_amt := p_amount;
    IF v_amt IS NULL OR v_amt < get_setting_numeric('min_wallet_topup', 100) OR v_amt > 5000000 THEN
      RAISE EXCEPTION 'Invalid top-up amount';
    END IF;
  ELSIF p_kind = 'session' THEN
    IF p_user = p_babalawo_user_id THEN RAISE EXCEPTION 'You cannot book yourself'; END IF;
    IF NOT EXISTS (SELECT 1 FROM babalawos WHERE user_id = p_babalawo_user_id AND COALESCE(is_active, true)) THEN
      RAISE EXCEPTION 'Babalawo not available';
    END IF;
    IF p_session_date IS NULL OR p_start_time IS NULL THEN RAISE EXCEPTION 'Date and time required'; END IF;
    PERFORM _assert_bookable(p_babalawo_user_id, p_session_date, p_start_time, COALESCE(p_is_instant, false));
    v_amt := get_session_price(p_babalawo_user_id, p_is_instant);
  ELSIF p_kind = 'ebo' THEN
    SELECT * INTO e FROM ebo_prescriptions WHERE id = p_ebo_id;
    IF NOT FOUND OR e.client_id IS DISTINCT FROM p_user OR e.status = 'draft' THEN RAISE EXCEPTION 'Ebo not found'; END IF;
    IF e.status <> 'sent' OR e.performed_by <> 'babalawo' THEN RAISE EXCEPTION 'This Ebo is not waiting for payment'; END IF;
    IF e.expires_at IS NOT NULL AND e.expires_at < now() THEN RAISE EXCEPTION 'This quote has expired. Ask your Babalawo to renew it.'; END IF;
    IF COALESCE(p_ebo_attendance, '') NOT IN ('present','absent') THEN RAISE EXCEPTION 'Choose whether you will join the ritual'; END IF;
    v_amt := e.amount_due;
  ELSE RAISE EXCEPTION 'Bad kind'; END IF;

  IF COALESCE(p_use_wallet, false) AND p_kind IN ('session', 'ebo') THEN
    v_wal := _wallet_share(p_user, v_amt);
  END IF;

  v_ref := 'IFANG-' || upper(left(p_gateway, 3)) || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));
  INSERT INTO payment_intents(user_id, kind, gateway, reference, amount, wallet_amount, babalawo_user_id, session_date, start_time,
                              is_instant, ebo_id, ebo_attendance)
  VALUES (p_user, p_kind, p_gateway, v_ref, v_amt - v_wal, v_wal,
          CASE WHEN p_kind = 'ebo' THEN e.babalawo_id ELSE p_babalawo_user_id END,
          p_session_date, p_start_time, COALESCE(p_is_instant, false), CASE WHEN p_kind = 'ebo' THEN p_ebo_id END,
          CASE WHEN p_kind = 'ebo' THEN p_ebo_attendance END);
  RETURN QUERY SELECT v_ref, v_amt - v_wal, v_wal, v_amt;
END $$;

-- Called ONLY by the API after the provider confirmed the charge.
CREATE OR REPLACE FUNCTION public.settle_payment_intent(
  p_reference text, p_paid_amount numeric, p_currency text, p_gateway_tx text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i payment_intents%ROWTYPE; v_session bigint; v_bal numeric; v_total numeric;
BEGIN
  SELECT * INTO i FROM payment_intents WHERE reference = p_reference FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'unknown_reference'); END IF;
  IF i.status = 'succeeded' THEN
    RETURN jsonb_build_object('status', 'already_settled', 'kind', i.kind, 'session_id', i.session_id, 'ebo_id', i.ebo_id, 'user_id', i.user_id);
  END IF;
  IF COALESCE(p_currency, 'NGN') <> i.currency OR p_paid_amount IS NULL OR p_paid_amount < i.amount THEN
    UPDATE payment_intents SET status = 'needs_review', gateway_transaction_id = p_gateway_tx,
           failure_reason = format('amount/currency mismatch: expected %s %s, got %s %s', i.amount, i.currency, p_paid_amount, p_currency)
     WHERE id = i.id;
    PERFORM log_payment_audit(NULL, 'amount_mismatch', jsonb_build_object('reference', p_reference, 'expected', i.amount, 'paid', p_paid_amount));
    RETURN jsonb_build_object('status', 'amount_mismatch');
  END IF;

  IF i.kind = 'wallet_topup' THEN
    PERFORM _wallet_apply(i.user_id, i.amount, 'credit', 'payment_gateway', i.gateway, i.reference,
                          'Wallet top-up via ' || i.gateway, 'topup-' || i.reference, true);
  ELSE
    v_total := i.amount + i.wallet_amount;
    -- The wallet part is taken only now. If it is no longer there, keep the card money in the wallet.
    IF i.wallet_amount > 0 THEN
      INSERT INTO wallets(user_id) VALUES (i.user_id) ON CONFLICT (user_id) DO NOTHING;
      SELECT balance INTO v_bal FROM wallets WHERE user_id = i.user_id FOR UPDATE;
      IF COALESCE(v_bal, 0) < i.wallet_amount THEN
        PERFORM _wallet_apply(i.user_id, i.amount, 'credit', 'payment_gateway', i.gateway, i.reference,
                              'Wallet no longer covered the rest - payment held in wallet', 'topup-' || i.reference, true);
        UPDATE payment_intents SET status = 'succeeded', settled_at = now(), gateway_transaction_id = p_gateway_tx,
               failure_reason = 'wallet_short_credited_to_wallet' WHERE id = i.id;
        RETURN jsonb_build_object('status', 'wallet_short_credited_to_wallet', 'kind', i.kind, 'user_id', i.user_id);
      END IF;
    END IF;

    IF i.kind = 'ebo' THEN
      BEGIN
        IF i.wallet_amount > 0 THEN
          PERFORM _wallet_apply(i.user_id, i.wallet_amount, 'debit', 'ebo_payment', NULL, i.reference,
                                'Ebo: wallet part, rest by ' || i.gateway, 'intent-wallet-' || i.reference);
        END IF;
        PERFORM _ebo_mark_paid(i.ebo_id, i.gateway, i.reference, p_gateway_tx, true, COALESCE(i.ebo_attendance, 'absent'));
      EXCEPTION WHEN SQLSTATE 'IF002' THEN
        -- the wallet debit above is rolled back with this block, so only the card money moves
        PERFORM _wallet_apply(i.user_id, i.amount, 'credit', 'payment_gateway', i.gateway, i.reference,
                              'Ebo no longer payable - payment held in wallet', 'topup-' || i.reference, true);
        UPDATE payment_intents SET status = 'succeeded', settled_at = now(), gateway_transaction_id = p_gateway_tx,
               failure_reason = 'ebo_unavailable_credited_to_wallet' WHERE id = i.id;
        RETURN jsonb_build_object('status', 'ebo_unavailable_credited_to_wallet', 'kind', i.kind, 'user_id', i.user_id);
      END;
    ELSE
      BEGIN
        PERFORM _assert_bookable(i.babalawo_user_id, i.session_date, i.start_time, i.is_instant);
        IF i.wallet_amount > 0 THEN
          PERFORM _wallet_apply(i.user_id, i.wallet_amount, 'debit', 'session_payment', NULL, i.reference,
                                'Consultation: wallet part, rest by ' || i.gateway, 'intent-wallet-' || i.reference);
        END IF;
        v_session := _create_paid_session(i.user_id, i.babalawo_user_id, i.session_date, i.start_time, i.is_instant,
                                          v_total, i.gateway, i.reference, p_gateway_tx, true);
      EXCEPTION WHEN unique_violation OR SQLSTATE 'IF001' THEN
        PERFORM _wallet_apply(i.user_id, i.amount, 'credit', 'payment_gateway', i.gateway, i.reference,
                              'Slot unavailable - payment held in wallet', 'topup-' || i.reference, true);
        UPDATE payment_intents SET status = 'succeeded', settled_at = now(), gateway_transaction_id = p_gateway_tx,
               failure_reason = 'slot_taken_credited_to_wallet' WHERE id = i.id;
        RETURN jsonb_build_object('status', 'slot_taken_credited_to_wallet', 'kind', i.kind, 'user_id', i.user_id);
      END;
    END IF;
  END IF;
  UPDATE payment_intents SET status = 'succeeded', settled_at = now(), gateway_transaction_id = p_gateway_tx,
         session_id = CASE WHEN i.kind = 'session' THEN v_session END
   WHERE id = i.id;
  PERFORM log_payment_audit(NULL, 'intent_settled', jsonb_build_object('reference', p_reference, 'kind', i.kind,
          'card', i.amount, 'wallet', i.wallet_amount));
  IF i.kind = 'ebo' THEN SELECT ritual_session_id INTO v_session FROM ebo_prescriptions WHERE id = i.ebo_id; END IF;
  RETURN jsonb_build_object('status', 'settled', 'kind', i.kind, 'session_id', v_session, 'ebo_id', i.ebo_id, 'user_id', i.user_id);
END $$;

DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname IN ('_wallet_share', 'create_payment_intent', 'settle_payment_intent')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;
