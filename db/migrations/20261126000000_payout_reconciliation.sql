-- Payouts, part 5: approving small withdrawals automatically, checking the provider balances
-- against what the platform owes, and one admin view of the money.
--
-- Auto-approval is off by default (payout_auto_approve_max = 0). When on, a pending withdrawal is
-- approved by the server only if it is small, the payout account has been verified for a while,
-- the Babalawo has no open dispute, and they haven't already had too much approved today. Anything
-- else waits for an admin as before.
--
-- Reconciliation: a job reads each provider's naira balance and stores it beside what we owe on that
-- provider (client wallets + Babalawo money not yet paid out). If the balance is short by more than
-- what was collected in the last two days (money not yet settled into the balance), admins are told.

INSERT INTO public.admin_settings(setting_key, setting_value, description, is_public) VALUES
  ('payout_auto_approve_max', '0', 'Approve withdrawals up to this amount automatically (naira; 0 = never)', false),
  ('payout_auto_approve_account_days', '7', 'Payout account verified at least this many days before auto-approval', false),
  ('payout_auto_approve_daily_max', '200000', 'Most auto-approved per Babalawo per day (naira, Lagos day)', false),
  ('payout_stuck_hours', '24', 'Tell admins about a transfer still on its way after this many hours', false)
ON CONFLICT (setting_key) DO NOTHING;

ALTER TABLE public.withdrawal_requests ADD COLUMN IF NOT EXISTS auto_approved boolean NOT NULL DEFAULT false;
ALTER TABLE public.payout_transfers ADD COLUMN IF NOT EXISTS stuck_notified_at timestamptz;

-- ------------------------------------------------------------------ auto-approval
CREATE OR REPLACE FUNCTION public.auto_approve_withdrawals()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w withdrawal_requests%ROWTYPE; v_n int := 0; v_today numeric;
  v_max numeric := get_setting_numeric('payout_auto_approve_max', 0);
  v_days numeric := get_setting_numeric('payout_auto_approve_account_days', 7);
  v_daily numeric := get_setting_numeric('payout_auto_approve_daily_max', 200000);
BEGIN
  IF v_max <= 0 THEN RETURN 0; END IF;
  FOR w IN SELECT * FROM withdrawal_requests WHERE status = 'pending' AND amount <= v_max
            ORDER BY created_at LIMIT 50 FOR UPDATE SKIP LOCKED LOOP
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM babalawo_bank_details d WHERE d.babalawo_id = w.babalawo_id
      AND d.status = 'verified' AND d.usable_from <= now() AND d.verified_at <= now() - make_interval(days => v_days::int)
      AND d.account_number = w.bank_snapshot ->> 'account_number');
    CONTINUE WHEN EXISTS (SELECT 1 FROM disputes x JOIN sessions s ON s.id = x.session_id
      WHERE s.babalawo_id = w.babalawo_id AND x.status IN ('open', 'investigating'));
    SELECT COALESCE(sum(amount), 0) INTO v_today FROM withdrawal_requests
     WHERE babalawo_id = w.babalawo_id AND auto_approved
       AND (processed_at AT TIME ZONE 'Africa/Lagos')::date = (now() AT TIME ZONE 'Africa/Lagos')::date;
    CONTINUE WHEN v_today + w.amount > v_daily;
    UPDATE withdrawal_requests SET status = 'approved', auto_approved = true, processed_at = now(),
           admin_note = 'Approved automatically' WHERE id = w.id;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END $$;

-- ------------------------------------------------------------------ reconciliation
CREATE TABLE IF NOT EXISTS public.provider_balance_checks (
  id              bigserial PRIMARY KEY,
  provider        text NOT NULL CHECK (provider IN ('paystack', 'flutterwave')),
  balance         numeric(14,2) NOT NULL,
  owed            numeric(14,2) NOT NULL,
  recent_collected numeric(14,2) NOT NULL DEFAULT 0,
  difference      numeric(14,2) GENERATED ALWAYS AS (balance - owed) STORED,
  short           boolean NOT NULL DEFAULT false,
  checked_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS provider_balance_checks_latest ON public.provider_balance_checks(provider, checked_at DESC);
ALTER TABLE public.provider_balance_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read balance checks" ON public.provider_balance_checks;
CREATE POLICY "Admins read balance checks" ON public.provider_balance_checks FOR SELECT USING (public.is_admin());
REVOKE ALL ON public.provider_balance_checks FROM anon, authenticated;
GRANT SELECT ON public.provider_balance_checks TO authenticated;
GRANT ALL ON public.provider_balance_checks TO service_role;
GRANT USAGE ON SEQUENCE public.provider_balance_checks_id_seq TO service_role;

-- What we owe on one provider: money that isn't the platform's.
CREATE OR REPLACE FUNCTION public._provider_owed(p_provider text)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT sum(balance) FROM wallet_parts WHERE provider = p_provider), 0)
       + COALESCE((SELECT sum(pending + available + held) FROM babalawo_balance_parts WHERE provider = p_provider), 0);
$$;

-- Store one balance reading; tell admins when it is short (once a day per provider).
CREATE OR REPLACE FUNCTION public._record_provider_balance(p_provider text, p_balance numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owed numeric := _provider_owed(p_provider); v_recent numeric; v_short boolean; v_told boolean;
BEGIN
  SELECT COALESCE(sum((provider_parts ->> p_provider)::numeric), 0) INTO v_recent FROM payments
   WHERE status IN ('completed', 'refunded') AND created_at > now() - interval '2 days';
  v_short := p_balance + v_recent < v_owed;
  SELECT EXISTS (SELECT 1 FROM provider_balance_checks WHERE provider = p_provider AND short
                   AND checked_at > now() - interval '1 day') INTO v_told;
  INSERT INTO provider_balance_checks(provider, balance, owed, recent_collected, short)
    VALUES (p_provider, p_balance, v_owed, v_recent, v_short);
  IF v_short AND NOT v_told THEN
    PERFORM _notify_admins('provider_balance_short', initcap(p_provider) || ' balance is short',
      format('%s holds ₦%s but IFA.ng owes ₦%s on it (₦%s collected in the last two days may not have settled yet). Check settlements and refunds.',
        initcap(p_provider), to_char(p_balance, 'FM999,999,999,990.00'), to_char(v_owed, 'FM999,999,999,990.00'),
        to_char(v_recent, 'FM999,999,999,990.00')),
      jsonb_build_object('provider', p_provider));
  END IF;
  RETURN jsonb_build_object('provider', p_provider, 'balance', p_balance, 'owed', v_owed, 'short', v_short);
END $$;

-- Transfers on their way for too long: tell admins once each.
CREATE OR REPLACE FUNCTION public.flag_stuck_payout_transfers()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t payout_transfers%ROWTYPE; v_n int := 0;
BEGIN
  FOR t IN UPDATE payout_transfers SET stuck_notified_at = now()
            WHERE status IN ('sending', 'pending') AND stuck_notified_at IS NULL
              AND sent_at < now() - make_interval(hours => get_setting_numeric('payout_stuck_hours', 24)::int)
            RETURNING * LOOP
    PERFORM _notify_admins('payout_stuck', 'A payout is taking long',
      format('%s transfer of ₦%s (%s) has been on its way since %s. Check it on the %s dashboard.',
        initcap(t.provider), to_char(t.amount, 'FM999,999,990.00'), t.reference,
        to_char(t.sent_at AT TIME ZONE 'Africa/Lagos', 'DD Mon HH24:MI'), initcap(t.provider)),
      jsonb_build_object('withdrawal_id', t.withdrawal_id, 'transfer_id', t.id));
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END $$;

-- ------------------------------------------------------------------ the admin money view
CREATE OR REPLACE FUNCTION public.admin_payout_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_today date := (now() AT TIME ZONE 'Africa/Lagos')::date;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'providers', (SELECT jsonb_object_agg(p.provider, jsonb_build_object(
        'owed', _provider_owed(p.provider),
        'last_check', (SELECT jsonb_build_object('balance', c.balance, 'owed', c.owed, 'difference', c.difference,
                                                 'short', c.short, 'checked_at', c.checked_at)
                         FROM provider_balance_checks c WHERE c.provider = p.provider ORDER BY c.checked_at DESC LIMIT 1),
        'paid_today', COALESCE((SELECT sum(amount) FROM payout_transfers t WHERE t.provider = p.provider AND t.status = 'success'
                                  AND (t.completed_at AT TIME ZONE 'Africa/Lagos')::date = v_today), 0),
        'paid_30d', COALESCE((SELECT sum(amount) FROM payout_transfers t WHERE t.provider = p.provider AND t.status = 'success'
                                AND t.completed_at > now() - interval '30 days'), 0),
        'fees_30d', COALESCE((SELECT sum(fee) FROM payout_transfers t WHERE t.provider = p.provider AND t.status = 'success'
                                AND t.completed_at > now() - interval '30 days'), 0),
        'on_the_way', COALESCE((SELECT sum(amount) FROM payout_transfers t WHERE t.provider = p.provider
                                  AND t.status IN ('sending', 'pending')), 0)))
      FROM (VALUES ('paystack'), ('flutterwave')) p(provider)),
    'auto_enabled', _setting_on('payouts_auto_enabled'),
    'auto_approve_max', get_setting_numeric('payout_auto_approve_max', 0),
    'daily_max', get_setting_numeric('payout_daily_max', 3000000),
    'sent_today', COALESCE((SELECT sum(amount) FROM payout_transfers WHERE status IN ('sending', 'pending', 'success')
                              AND (sent_at AT TIME ZONE 'Africa/Lagos')::date = v_today), 0),
    'waiting_approval', (SELECT jsonb_build_object('count', count(*), 'amount', COALESCE(sum(amount), 0))
                           FROM withdrawal_requests WHERE status = 'pending'),
    'held', (SELECT jsonb_build_object('count', count(*), 'amount', COALESCE(sum(amount), 0))
               FROM payout_transfers WHERE status = 'queued' AND hold_reason IS NOT NULL),
    'failed', (SELECT jsonb_build_object('count', count(*), 'amount', COALESCE(sum(amount), 0))
                 FROM payout_transfers WHERE status = 'failed'),
    'stuck', (SELECT count(*) FROM payout_transfers WHERE status IN ('sending', 'pending') AND stuck_notified_at IS NOT NULL));
END $$;

-- ------------------------------------------------------------------ grants
REVOKE ALL ON FUNCTION public.auto_approve_withdrawals(), public._provider_owed(text), public._record_provider_balance(text, numeric),
              public.flag_stuck_payout_transfers(), public._setting_on(text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_approve_withdrawals(), public._provider_owed(text), public._record_provider_balance(text, numeric),
              public.flag_stuck_payout_transfers(), public._setting_on(text, boolean) TO service_role;
REVOKE ALL ON FUNCTION public.admin_payout_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_payout_overview() TO authenticated;
