-- Automated payouts: an approved withdrawal is paid by bank transfer through the same provider
-- that received the client's money (Alex, 12 Nov 2026). A withdrawal held across both providers
-- becomes two transfers, one per provider part.
--
-- Flow: admin approves -> one payout_transfers row per provider part ('queued') -> the API's job
-- sends each one ('sending' -> 'pending') -> the provider's webhook or the job's check says
-- 'success' or 'failed'. Each success moves that part from held to paid out; when every part
-- is paid the withdrawal is completed. A failed transfer waits for an admin: retry it, or pay it
-- by hand and record the bank reference. Nothing is sent while automated payouts are switched
-- off (the default) or a cap would be passed: the transfer waits with the reason shown.
--
-- References are ours and unique (ifa_po_<hex>), so asking the provider twice can never pay twice.

INSERT INTO public.admin_settings(setting_key, setting_value, description, is_public) VALUES
  ('payouts_auto_enabled', 'false', 'Send approved withdrawals by bank transfer automatically', false),
  ('payouts_paystack_enabled', 'true', 'Send automated payouts through Paystack', false),
  ('payouts_flutterwave_enabled', 'true', 'Send automated payouts through Flutterwave', false),
  ('payout_single_max', '500000', 'Largest automated transfer (naira); larger ones wait for an admin', false),
  ('payout_daily_max', '3000000', 'Most paid out automatically per day (naira, Lagos day)', false)
ON CONFLICT (setting_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public._setting_on(p_key text, p_default boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT lower(btrim(setting_value)) IN ('true', 'on', '1', 'yes')
                   FROM public.admin_settings WHERE setting_key = p_key AND NULLIF(btrim(setting_value), '') IS NOT NULL), p_default);
$$;

CREATE TABLE IF NOT EXISTS public.payout_transfers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id      uuid NOT NULL REFERENCES public.withdrawal_requests(id) ON DELETE CASCADE,
  babalawo_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider           text NOT NULL CHECK (provider IN ('paystack', 'flutterwave')),
  amount             numeric(12,2) NOT NULL CHECK (amount > 0),
  reference          text NOT NULL UNIQUE DEFAULT ('ifa_po_' || replace(gen_random_uuid()::text, '-', '')),
  status             text NOT NULL DEFAULT 'queued'
                     CHECK (status IN ('queued', 'sending', 'pending', 'success', 'failed', 'reversed', 'cancelled', 'paid_manually')),
  hold_reason        text,
  provider_transfer_id text,
  fee                numeric(12,2),
  failure_reason     text,
  attempts           integer NOT NULL DEFAULT 0,
  last_checked_at    timestamptz,
  sent_at            timestamptz,
  completed_at       timestamptz,
  manual_reference   text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payout_transfers_open ON public.payout_transfers(status, created_at)
  WHERE status IN ('queued', 'sending', 'pending');
CREATE INDEX IF NOT EXISTS payout_transfers_withdrawal ON public.payout_transfers(withdrawal_id);
DROP TRIGGER IF EXISTS payout_transfers_updated_at ON public.payout_transfers;
CREATE TRIGGER payout_transfers_updated_at BEFORE UPDATE ON public.payout_transfers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.payout_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Babalawos read own payout transfers" ON public.payout_transfers;
CREATE POLICY "Babalawos read own payout transfers" ON public.payout_transfers FOR SELECT USING (babalawo_id = auth.uid());
DROP POLICY IF EXISTS "Admins read payout transfers" ON public.payout_transfers;
CREATE POLICY "Admins read payout transfers" ON public.payout_transfers FOR SELECT USING (public.is_admin());
REVOKE ALL ON public.payout_transfers FROM anon, authenticated;
GRANT SELECT ON public.payout_transfers TO authenticated;
GRANT ALL ON public.payout_transfers TO service_role;

CREATE OR REPLACE FUNCTION public._notify_admins(p_type text, p_title text, p_message text, p_data jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a uuid;
BEGIN
  FOR a IN SELECT DISTINCT user_id FROM user_roles WHERE role = 'admin' LOOP
    PERFORM create_notification(a, p_type, p_title, p_message, p_data, 'high');
  END LOOP;
END $$;

-- ------------------------------------------------------------------ queue on approval
CREATE OR REPLACE FUNCTION public.queue_payout_transfers()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p text; v_amt numeric;
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending'
     AND _setting_on('payouts_auto_enabled') THEN
    FOR p IN SELECT jsonb_object_keys(NEW.provider_parts) LOOP
      v_amt := (NEW.provider_parts ->> p)::numeric;
      IF v_amt > 0 THEN
        INSERT INTO payout_transfers(withdrawal_id, babalawo_id, provider, amount) VALUES (NEW.id, NEW.babalawo_id, p, v_amt);
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_queue_payout_transfers ON public.withdrawal_requests;
CREATE TRIGGER trg_queue_payout_transfers AFTER UPDATE OF status ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.queue_payout_transfers();

-- An admin can't reject or hand-pay a withdrawal while its transfers are on their way or paid.
CREATE OR REPLACE FUNCTION public.guard_withdrawal_with_transfers()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('rejected', 'completed')
     AND COALESCE(current_setting('ifa.payout_complete', true), '') <> 'on'
     AND EXISTS (SELECT 1 FROM payout_transfers t WHERE t.withdrawal_id = NEW.id
                  AND t.status IN ('sending', 'pending', 'success', 'paid_manually')) THEN
    RAISE EXCEPTION 'This withdrawal is being paid by bank transfer. Use the transfer actions instead.';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('rejected', 'completed')
     AND COALESCE(current_setting('ifa.payout_complete', true), '') <> 'on' THEN
    -- Queued or failed transfers are dropped when an admin rejects or pays by hand.
    UPDATE payout_transfers SET status = 'cancelled', hold_reason = NULL
     WHERE withdrawal_id = NEW.id AND status IN ('queued', 'failed');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_withdrawal_with_transfers ON public.withdrawal_requests;
CREATE TRIGGER trg_guard_withdrawal_with_transfers BEFORE UPDATE OF status ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_withdrawal_with_transfers();

-- ------------------------------------------------------------------ sending (API only)
-- The next transfers to send, claimed so two workers can't both send one. A transfer that the
-- switches or caps hold back stays queued with the reason.
CREATE OR REPLACE FUNCTION public._claim_payout_transfers(p_limit integer DEFAULT 10)
RETURNS SETOF public.payout_transfers LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t payout_transfers%ROWTYPE; d babalawo_bank_details%ROWTYPE; w withdrawal_requests%ROWTYPE; v_today numeric; v_reason text;
BEGIN
  FOR t IN SELECT * FROM payout_transfers WHERE status = 'queued' ORDER BY created_at LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP
    v_reason := NULL;
    SELECT * INTO d FROM babalawo_bank_details WHERE babalawo_id = t.babalawo_id;
    SELECT * INTO w FROM withdrawal_requests WHERE id = t.withdrawal_id;
    SELECT COALESCE(sum(amount), 0) INTO v_today FROM payout_transfers
     WHERE status IN ('sending', 'pending', 'success')
       AND (sent_at AT TIME ZONE 'Africa/Lagos')::date = (now() AT TIME ZONE 'Africa/Lagos')::date;
    IF NOT _setting_on('payouts_auto_enabled') THEN v_reason := 'Automated payouts are switched off';
    ELSIF NOT _setting_on('payouts_' || t.provider || '_enabled', true) THEN v_reason := initcap(t.provider) || ' payouts are switched off';
    ELSIF t.amount > get_setting_numeric('payout_single_max', 500000) THEN v_reason := 'Above the largest automated transfer: pay by hand or raise the limit';
    ELSIF v_today + t.amount > get_setting_numeric('payout_daily_max', 3000000) THEN v_reason := 'Today''s automated payout limit is reached';
    ELSIF d.babalawo_id IS NULL OR d.status <> 'verified' THEN v_reason := 'The payout account is not verified';
    ELSIF d.usable_from > now() THEN v_reason := 'The payout account was changed recently';
    ELSIF w.status <> 'approved' THEN v_reason := 'The withdrawal is no longer approved';
    -- Only pay the account the Babalawo asked for. If it changed since, an admin rejects the
    -- withdrawal and the Babalawo asks again (to the new account, after its cool-down).
    ELSIF w.bank_snapshot ->> 'account_number' IS DISTINCT FROM d.account_number
       OR (w.bank_snapshot ->> 'bank_id')::int IS DISTINCT FROM d.bank_id THEN
      v_reason := 'The payout account changed after this withdrawal was asked for: reject it so the Babalawo asks again';
    ELSIF (t.provider = 'paystack' AND d.paystack_bank_code IS NULL) OR (t.provider = 'flutterwave' AND d.flutterwave_bank_code IS NULL) THEN
      v_reason := initcap(t.provider) || ' can''t pay this bank: pay by hand';
    END IF;
    IF v_reason IS NOT NULL THEN
      UPDATE payout_transfers SET hold_reason = v_reason WHERE id = t.id AND hold_reason IS DISTINCT FROM v_reason;
      CONTINUE;
    END IF;
    UPDATE payout_transfers SET status = 'sending', hold_reason = NULL, attempts = attempts + 1, sent_at = now()
     WHERE id = t.id RETURNING * INTO t;
    RETURN NEXT t;
  END LOOP;
END $$;

-- What the provider says about a transfer. Idempotent: a repeated answer changes nothing.
CREATE OR REPLACE FUNCTION public._payout_transfer_update(
  p_reference text, p_status text, p_provider_id text DEFAULT NULL, p_fee numeric DEFAULT NULL, p_reason text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t payout_transfers%ROWTYPE; w withdrawal_requests%ROWTYPE; v_left int;
BEGIN
  SELECT * INTO t FROM payout_transfers WHERE reference = p_reference FOR UPDATE;
  IF NOT FOUND THEN RETURN 'unknown'; END IF;
  UPDATE payout_transfers SET last_checked_at = now(),
         provider_transfer_id = COALESCE(p_provider_id, provider_transfer_id), fee = COALESCE(p_fee, fee)
   WHERE id = t.id;
  IF p_status NOT IN ('pending', 'success', 'failed', 'reversed', 'not_found') THEN RAISE EXCEPTION 'Bad transfer status %', p_status; END IF;

  IF p_status = 'pending' THEN
    -- p_reason here says what the provider is waiting for (an OTP on Paystack, for example).
    UPDATE payout_transfers SET status = 'pending', hold_reason = p_reason WHERE id = t.id AND status IN ('sending', 'pending');
    RETURN 'pending';
  END IF;
  IF p_status = 'not_found' THEN
    -- The provider never got it (we asked after an unclear answer): send it again, same reference.
    UPDATE payout_transfers SET status = 'queued' WHERE id = t.id AND status IN ('sending', 'pending');
    RETURN 'requeued';
  END IF;

  IF p_status = 'success' THEN
    IF t.status IN ('success', 'reversed') THEN RETURN t.status; END IF;
    IF t.status NOT IN ('sending', 'pending', 'failed') THEN RETURN 'ignored'; END IF;
    UPDATE payout_transfers SET status = 'success', completed_at = now(), failure_reason = NULL WHERE id = t.id;
    SELECT * INTO w FROM withdrawal_requests WHERE id = t.withdrawal_id FOR UPDATE;
    PERFORM _bparts_use(jsonb_build_object(t.provider, 1));
    UPDATE babalawo_wallets SET held_balance = held_balance - t.amount, lifetime_paid_out = lifetime_paid_out + t.amount,
           updated_at = now() WHERE babalawo_id = t.babalawo_id;
    INSERT INTO babalawo_ledger(babalawo_id, entry_type, amount, withdrawal_id, note)
      VALUES (t.babalawo_id, 'withdrawal_paid', t.amount, t.withdrawal_id, t.provider || ' ' || t.reference);
    INSERT INTO payouts(babalawo_id, amount, method, reference, status)
      VALUES (t.babalawo_id, t.amount, t.provider || '_transfer', t.reference, 'paid');
    SELECT count(*) INTO v_left FROM payout_transfers
     WHERE withdrawal_id = t.withdrawal_id AND status NOT IN ('success', 'paid_manually', 'cancelled');
    IF v_left = 0 THEN
      PERFORM set_config('ifa.payout_complete', 'on', true);
      UPDATE withdrawal_requests SET status = 'completed', payout_reference = t.reference, processed_at = now()
       WHERE id = t.withdrawal_id AND status = 'approved';
      PERFORM set_config('ifa.payout_complete', '', true);
      PERFORM create_notification(t.babalawo_id, 'withdrawal_paid', 'Withdrawal paid',
        format('₦%s has been sent to your bank account.', to_char(w.amount, 'FM999,999,999,990.00')),
        jsonb_build_object('withdrawal_id', t.withdrawal_id), 'normal');
    END IF;
    RETURN 'success';
  END IF;

  IF p_status = 'failed' THEN
    IF t.status NOT IN ('sending', 'pending') THEN RETURN t.status; END IF;
    UPDATE payout_transfers SET status = 'failed', failure_reason = left(p_reason, 500) WHERE id = t.id;
    PERFORM _notify_admins('payout_failed', 'A payout failed',
      format('%s transfer of ₦%s failed: %s', initcap(t.provider), to_char(t.amount, 'FM999,999,990.00'), COALESCE(p_reason, 'no reason given')),
      jsonb_build_object('withdrawal_id', t.withdrawal_id, 'transfer_id', t.id));
    RETURN 'failed';
  END IF;

  -- reversed: the bank sent the money back to our provider balance after it was paid.
  IF t.status = 'reversed' THEN RETURN 'reversed'; END IF;
  IF t.status <> 'success' THEN
    UPDATE payout_transfers SET status = 'failed', failure_reason = COALESCE(p_reason, 'Reversed by the bank') WHERE id = t.id;
    RETURN 'failed';
  END IF;
  UPDATE payout_transfers SET status = 'reversed', failure_reason = COALESCE(p_reason, 'Reversed by the bank') WHERE id = t.id;
  -- Give the Babalawo their money back to withdraw again (it is back in that provider's balance).
  PERFORM _bparts_use(jsonb_build_object(t.provider, 1));
  UPDATE babalawo_wallets SET available_balance = available_balance + t.amount, lifetime_paid_out = lifetime_paid_out - t.amount,
         updated_at = now() WHERE babalawo_id = t.babalawo_id;
  INSERT INTO babalawo_ledger(babalawo_id, entry_type, amount, withdrawal_id, note)
    VALUES (t.babalawo_id, 'withdrawal_reject', t.amount, t.withdrawal_id, 'Transfer reversed by the bank');
  PERFORM create_notification(t.babalawo_id, 'withdrawal_reversed', 'Your bank returned a payout',
    format('₦%s came back from your bank and is available to withdraw again. Please check your payout account.',
           to_char(t.amount, 'FM999,999,990.00')), jsonb_build_object('withdrawal_id', t.withdrawal_id), 'high');
  PERFORM _notify_admins('payout_reversed', 'A payout was reversed',
    format('%s transfer of ₦%s was reversed by the bank.', initcap(t.provider), to_char(t.amount, 'FM999,999,990.00')),
    jsonb_build_object('withdrawal_id', t.withdrawal_id, 'transfer_id', t.id));
  RETURN 'reversed';
END $$;

-- ------------------------------------------------------------------ admin actions
-- retry: send a failed transfer again under a new reference (the provider confirmed the old one failed).
-- paid_manually: it was paid outside the automated flow; record the bank reference.
CREATE OR REPLACE FUNCTION public.admin_payout_transfer_action(p_id uuid, p_action text, p_reference text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t payout_transfers%ROWTYPE; v_ref text := NULLIF(btrim(p_reference), ''); v_left int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO t FROM payout_transfers WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found'; END IF;
  IF p_action = 'retry' THEN
    IF t.status <> 'failed' THEN RAISE EXCEPTION 'Only failed transfers can be retried'; END IF;
    UPDATE payout_transfers SET status = 'cancelled', failure_reason = COALESCE(failure_reason, '') || ' (retried)' WHERE id = t.id;
    INSERT INTO payout_transfers(withdrawal_id, babalawo_id, provider, amount) VALUES (t.withdrawal_id, t.babalawo_id, t.provider, t.amount);
  ELSIF p_action = 'paid_manually' THEN
    IF t.status NOT IN ('queued', 'failed') THEN RAISE EXCEPTION 'Only waiting or failed transfers can be marked paid by hand'; END IF;
    IF v_ref IS NULL THEN RAISE EXCEPTION 'A bank transfer reference is required'; END IF;
    UPDATE payout_transfers SET status = 'paid_manually', manual_reference = v_ref, completed_at = now(), hold_reason = NULL WHERE id = t.id;
    PERFORM _bparts_use(jsonb_build_object(t.provider, 1));
    UPDATE babalawo_wallets SET held_balance = held_balance - t.amount, lifetime_paid_out = lifetime_paid_out + t.amount,
           updated_at = now() WHERE babalawo_id = t.babalawo_id;
    INSERT INTO babalawo_ledger(babalawo_id, entry_type, amount, withdrawal_id, note)
      VALUES (t.babalawo_id, 'withdrawal_paid', t.amount, t.withdrawal_id, v_ref);
    INSERT INTO payouts(babalawo_id, amount, method, reference, status) VALUES (t.babalawo_id, t.amount, 'bank_transfer', v_ref, 'paid');
    SELECT count(*) INTO v_left FROM payout_transfers
     WHERE withdrawal_id = t.withdrawal_id AND status NOT IN ('success', 'paid_manually', 'cancelled');
    IF v_left = 0 THEN
      PERFORM set_config('ifa.payout_complete', 'on', true);
      UPDATE withdrawal_requests SET status = 'completed', payout_reference = v_ref, processed_by = auth.uid(), processed_at = now()
       WHERE id = t.withdrawal_id AND status = 'approved';
      PERFORM set_config('ifa.payout_complete', '', true);
      PERFORM create_notification(t.babalawo_id, 'withdrawal_paid', 'Withdrawal paid', 'Your withdrawal has been sent to your bank account.',
        jsonb_build_object('withdrawal_id', t.withdrawal_id), 'normal');
    END IF;
  ELSE
    RAISE EXCEPTION 'Unknown action %', p_action;
  END IF;
  INSERT INTO admin_audit_log(admin_id, action, target_type, target_id, details)
    VALUES (auth.uid(), 'payout_' || p_action, 'payout_transfer', p_id::text, jsonb_build_object('reference', v_ref));
END $$;

-- ------------------------------------------------------------------ grants
REVOKE ALL ON FUNCTION public._claim_payout_transfers(integer), public._payout_transfer_update(text, text, text, numeric, text),
              public._notify_admins(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._claim_payout_transfers(integer), public._payout_transfer_update(text, text, text, numeric, text),
              public._notify_admins(text, text, text, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.admin_payout_transfer_action(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_payout_transfer_action(uuid, text, text) TO authenticated;
