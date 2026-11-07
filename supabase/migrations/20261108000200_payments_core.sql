-- =====================================================================
-- Payments & wallet hardening
-- Money movement is decided ONLY on the server:
--   * clients can no longer call wallet/credit functions or write balances
--   * prices are computed in the database, never trusted from the browser
--   * gateway payments are settled by edge functions (service_role) after the
--     provider has confirmed the charge, idempotently
--   * babalawo earnings sit in escrow (pending) until the session completes
-- Assumes public.is_admin() exists (roles thread redefines it on user_roles).
-- Convention: sessions.babalawo_id / *.babalawo_id = babalawo's auth user id.
-- =====================================================================

-- ---------------------------------------------------------------- settings
INSERT INTO public.admin_settings (setting_key, setting_value, description) VALUES
  ('min_session_price', '2000', 'Lowest price (NGN) a babalawo may set'),
  ('max_session_price', '500000', 'Highest price (NGN) a babalawo may set'),
  ('min_withdrawal_amount', '5000', 'Smallest withdrawal (NGN)'),
  ('min_wallet_topup', '100', 'Smallest wallet top-up (NGN)'),
  ('cancellation_full_refund_hours', '24', 'Client gets a full refund if cancelling at least this many hours before start')
ON CONFLICT (setting_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_setting_numeric(p_key text, p_default numeric)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT NULLIF(btrim(setting_value), '')::numeric
                   FROM public.admin_settings WHERE setting_key = p_key), p_default);
$$;

-- ----------------------------------------------------------- price columns
ALTER TABLE public.babalawos ADD COLUMN IF NOT EXISTS session_price numeric(12,2);
ALTER TABLE public.babalawos ADD COLUMN IF NOT EXISTS instant_price numeric(12,2);

CREATE OR REPLACE FUNCTION public.get_session_price(p_babalawo_user_id uuid, p_is_instant boolean DEFAULT false)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    CASE WHEN p_is_instant THEN NULLIF(b.instant_price, 0) END,
    NULLIF(b.session_price, 0),
    NULLIF(b.hourly_rate, 0),
    15000)
  FROM (SELECT 1) d LEFT JOIN public.babalawos b ON b.user_id = p_babalawo_user_id;
$$;

CREATE OR REPLACE FUNCTION public.set_my_session_price(p_price numeric, p_instant_price numeric DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_min numeric := get_setting_numeric('min_session_price', 2000);
        v_max numeric := get_setting_numeric('max_session_price', 500000);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_price IS NULL OR p_price < v_min OR p_price > v_max THEN
    RAISE EXCEPTION 'Price must be between % and %', v_min, v_max;
  END IF;
  IF p_instant_price IS NOT NULL AND (p_instant_price < v_min OR p_instant_price > v_max) THEN
    RAISE EXCEPTION 'Instant price must be between % and %', v_min, v_max;
  END IF;
  UPDATE public.babalawos SET session_price = p_price, instant_price = p_instant_price, updated_at = now()
   WHERE user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Only babalawos can set a price'; END IF;
END $$;

-- Babalawos must not be able to write price / commission columns directly.
CREATE OR REPLACE FUNCTION public.guard_babalawo_money_columns()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
    IF NEW.session_price IS DISTINCT FROM OLD.session_price
       OR NEW.instant_price IS DISTINCT FROM OLD.instant_price
       OR NEW.hourly_rate IS DISTINCT FROM OLD.hourly_rate
       OR NEW.commission_platform_percent IS DISTINCT FROM OLD.commission_platform_percent
       OR NEW.commission_babalawo_percent IS DISTINCT FROM OLD.commission_babalawo_percent THEN
      RAISE EXCEPTION 'Use set_my_session_price(); commission is admin-only';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_babalawo_money ON public.babalawos;
CREATE TRIGGER trg_guard_babalawo_money BEFORE UPDATE ON public.babalawos
  FOR EACH ROW EXECUTE FUNCTION public.guard_babalawo_money_columns();

-- ------------------------------------------------------ wallet table fixes
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_transaction_source_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_transaction_source_check
  CHECK (transaction_source IN ('payment_gateway','session_payment','refund','admin_adjustment','rollback'));
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS balance_after numeric;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS webhook_verified boolean DEFAULT false;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS status text DEFAULT 'completed';
CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_tx_idem ON public.wallet_transactions(idempotency_key) WHERE idempotency_key IS NOT NULL;
ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_balance_nonneg;
ALTER TABLE public.wallets ADD CONSTRAINT wallets_balance_nonneg CHECK (balance >= 0);

-- Users may only READ their wallet. All writes go through definer functions.
DROP POLICY IF EXISTS "Users can update their own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can insert their own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Admins can view all wallets" ON public.wallets;
CREATE POLICY "Admins can view all wallets" ON public.wallets FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "Admins can view all wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Admins can view all wallet transactions" ON public.wallet_transactions FOR SELECT USING (public.is_admin());
REVOKE INSERT, UPDATE, DELETE ON public.wallets, public.wallet_transactions FROM anon, authenticated;

-- ----------------------------------------------- babalawo wallet + ledger
ALTER TABLE public.babalawo_wallets ADD COLUMN IF NOT EXISTS pending_balance numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.babalawo_wallets ADD COLUMN IF NOT EXISTS held_balance numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.babalawo_wallets ADD COLUMN IF NOT EXISTS lifetime_earned numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.babalawo_wallets ADD COLUMN IF NOT EXISTS lifetime_paid_out numeric(12,2) NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS uq_babalawo_wallets_babalawo ON public.babalawo_wallets(babalawo_id);
DROP POLICY IF EXISTS "Babalawos can update their own wallet" ON public.babalawo_wallets;
DROP POLICY IF EXISTS "Admins can view all babalawo wallets" ON public.babalawo_wallets;
CREATE POLICY "Admins can view all babalawo wallets" ON public.babalawo_wallets FOR SELECT USING (public.is_admin());
REVOKE INSERT, UPDATE, DELETE ON public.babalawo_wallets FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.babalawo_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  babalawo_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_type text NOT NULL CHECK (entry_type IN
    ('earning','release','refund_reversal','withdrawal_hold','withdrawal_reject','withdrawal_paid','adjustment')),
  amount numeric(12,2) NOT NULL,          -- always positive; entry_type gives direction
  session_id bigint,
  withdrawal_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- one earning / release / reversal per session => replays can never double pay
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_session_entry ON public.babalawo_ledger(session_id, entry_type)
  WHERE session_id IS NOT NULL AND entry_type IN ('earning','release','refund_reversal');
CREATE INDEX IF NOT EXISTS idx_ledger_babalawo ON public.babalawo_ledger(babalawo_id, created_at DESC);
ALTER TABLE public.babalawo_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Babalawos read own ledger" ON public.babalawo_ledger;
CREATE POLICY "Babalawos read own ledger" ON public.babalawo_ledger FOR SELECT USING (auth.uid() = babalawo_id OR public.is_admin());
REVOKE INSERT, UPDATE, DELETE ON public.babalawo_ledger FROM anon, authenticated;

CREATE OR REPLACE VIEW public.babalawo_ledger_view WITH (security_invoker = true) AS
  SELECT * FROM public.babalawo_ledger;
CREATE OR REPLACE VIEW public.my_babalawo_earnings WITH (security_invoker = true) AS
  SELECT w.babalawo_id,
         w.pending_balance, w.available_balance, w.held_balance,
         w.lifetime_earned, w.lifetime_paid_out, w.updated_at
    FROM public.babalawo_wallets w WHERE w.babalawo_id = auth.uid();
GRANT SELECT ON public.my_babalawo_earnings, public.babalawo_ledger_view TO authenticated;

-- ----------------------------------------------------- payments / intents
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS gateway_transaction_id text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS currency text DEFAULT 'NGN';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS commission_platform_percent numeric;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS refunded_amount numeric(12,2) NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_session ON public.payments(session_id) WHERE session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_reference ON public.payments(payment_reference) WHERE payment_reference IS NOT NULL;
DROP POLICY IF EXISTS "Admins can view all payments" ON public.payments;
CREATE POLICY "Admins can view all payments" ON public.payments FOR SELECT USING (public.is_admin());
REVOKE INSERT, UPDATE, DELETE ON public.payments FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('session','wallet_topup')),
  gateway text NOT NULL CHECK (gateway IN ('paystack','flutterwave')),
  reference text NOT NULL UNIQUE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),   -- NGN, computed on the server
  currency text NOT NULL DEFAULT 'NGN',
  babalawo_user_id uuid,
  session_date date,
  start_time text,
  is_instant boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed','expired','needs_review')),
  session_id bigint,
  gateway_transaction_id text,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_intents_user ON public.payment_intents(user_id, created_at DESC);
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own intents" ON public.payment_intents;
CREATE POLICY "Users read own intents" ON public.payment_intents FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
REVOKE INSERT, UPDATE, DELETE ON public.payment_intents FROM anon, authenticated;

-- ---------------------------------------------------- sessions protection
CREATE UNIQUE INDEX IF NOT EXISTS uq_sessions_active_slot
  ON public.sessions(babalawo_id, session_date, start_time)
  WHERE status <> 'cancelled' AND NOT COALESCE(is_instant, false);

CREATE OR REPLACE FUNCTION public.guard_session_payment_columns()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- only evaluated for direct client calls; definer functions run as the owner
  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Sessions can only be created through the booking functions';
  END IF;
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status
     OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.payment_reference IS DISTINCT FROM OLD.payment_reference
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.babalawo_id IS DISTINCT FROM OLD.babalawo_id THEN
    RAISE EXCEPTION 'Payment fields on a session cannot be changed from the client';
  END IF;
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed'
     AND auth.uid() IS DISTINCT FROM OLD.babalawo_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only the babalawo can complete a session';
  END IF;
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' AND OLD.payment_status = 'paid' THEN
    RAISE EXCEPTION 'Use cancel_session() to cancel a paid session';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_session_payment ON public.sessions;
CREATE TRIGGER trg_guard_session_payment BEFORE INSERT OR UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.guard_session_payment_columns();
DROP POLICY IF EXISTS "Users can create their own sessions" ON public.sessions;

-- ============================================================ core wallet
CREATE OR REPLACE FUNCTION public._wallet_apply(
  p_user_id uuid, p_amount numeric, p_type text, p_source text,
  p_gateway text DEFAULT NULL, p_reference text DEFAULT NULL,
  p_description text DEFAULT NULL, p_idempotency_key text DEFAULT NULL, p_verified boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_wallet uuid; v_tx uuid; v_bal numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_type NOT IN ('credit','debit') THEN RAISE EXCEPTION 'Bad type'; END IF;
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_tx FROM wallet_transactions WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN RETURN v_tx; END IF;
  END IF;
  INSERT INTO wallets(user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT id INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;
  IF p_type = 'credit' THEN
    UPDATE wallets SET balance = balance + p_amount, updated_at = now() WHERE id = v_wallet RETURNING balance INTO v_bal;
  ELSE
    UPDATE wallets SET balance = balance - p_amount, updated_at = now()
      WHERE id = v_wallet AND balance >= p_amount RETURNING balance INTO v_bal;
    IF v_bal IS NULL THEN RAISE EXCEPTION 'Insufficient wallet balance'; END IF;
  END IF;
  INSERT INTO wallet_transactions(user_id, wallet_id, amount, transaction_type, transaction_source, payment_gateway,
      payment_reference, description, balance_after, idempotency_key, status, webhook_verified)
  VALUES (p_user_id, v_wallet, p_amount, p_type, p_source, p_gateway, p_reference, p_description,
      v_bal, p_idempotency_key, 'completed', p_verified)
  RETURNING id INTO v_tx;
  RETURN v_tx;
END $$;

CREATE OR REPLACE FUNCTION public._babalawo_escrow_credit(p_babalawo uuid, p_session_id bigint, p_amount numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO babalawo_ledger(babalawo_id, entry_type, amount, session_id, note)
    VALUES (p_babalawo, 'earning', p_amount, p_session_id, 'Session paid, held until completion')
    ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN; END IF;
  INSERT INTO babalawo_wallets(babalawo_id) VALUES (p_babalawo) ON CONFLICT (babalawo_id) DO NOTHING;
  UPDATE babalawo_wallets SET pending_balance = pending_balance + p_amount,
         lifetime_earned = lifetime_earned + p_amount, updated_at = now() WHERE babalawo_id = p_babalawo;
END $$;

-- Server-side booking rules (weekly hours, exceptions, time off, notice, buffer, overlaps).
-- The UI mirrors these, but this is the enforcement point. Raises SQLSTATE IF001.
CREATE OR REPLACE FUNCTION public._assert_bookable(p_babalawo uuid, p_date date, p_start text, p_is_instant boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_step int := 60; v_buffer int := 0; v_notice int := 0; v_adv int := 365; v_accept boolean := true; v_tz text := 'Africa/Lagos';
  v_t time := p_start::time; v_end time; v_start_ts timestamptz; v_ok boolean := false; v_status text;
BEGIN
  IF p_is_instant THEN
    SELECT current_status INTO v_status FROM babalawos WHERE user_id = p_babalawo;
    IF v_status IS DISTINCT FROM 'online' THEN
      RAISE EXCEPTION 'This babalawo is not available for instant consultation' USING ERRCODE = 'IF001';
    END IF;
    IF EXISTS (SELECT 1 FROM sessions WHERE babalawo_id = p_babalawo AND status = 'in_progress') THEN
      RAISE EXCEPTION 'This babalawo is currently in another session' USING ERRCODE = 'IF001';
    END IF;
    RETURN;
  END IF;

  IF to_regclass('public.babalawo_scheduling_settings') IS NOT NULL THEN
    SELECT COALESCE(slot_minutes,60), COALESCE(buffer_minutes,0), COALESCE(min_notice_hours,0),
           COALESCE(max_advance_days,365), COALESCE(accepting_bookings,true), COALESCE(timezone,'Africa/Lagos')
      INTO v_step, v_buffer, v_notice, v_adv, v_accept, v_tz
      FROM babalawo_scheduling_settings WHERE babalawo_id = p_babalawo;
    IF NOT FOUND THEN v_step := 60; v_buffer := 0; v_notice := 0; v_adv := 365; v_accept := true; v_tz := 'Africa/Lagos'; END IF;
  END IF;
  IF NOT v_accept THEN RAISE EXCEPTION 'This babalawo is not accepting bookings' USING ERRCODE = 'IF001'; END IF;

  v_end := v_t + make_interval(mins => v_step);
  v_start_ts := (p_date + v_t) AT TIME ZONE v_tz;
  IF v_start_ts < now() + make_interval(hours => v_notice) THEN
    RAISE EXCEPTION 'That time is too soon to book' USING ERRCODE = 'IF001';
  END IF;
  IF v_start_ts > now() + make_interval(days => v_adv) THEN
    RAISE EXCEPTION 'That date is too far ahead' USING ERRCODE = 'IF001';
  END IF;

  IF to_regclass('public.babalawo_time_off') IS NOT NULL AND EXISTS (
       SELECT 1 FROM babalawo_time_off WHERE babalawo_id = p_babalawo AND p_date BETWEEN start_date AND end_date) THEN
    RAISE EXCEPTION 'Babalawo is on time off that day' USING ERRCODE = 'IF001';
  END IF;

  IF to_regclass('public.availability_exceptions') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM availability_exceptions e WHERE e.babalawo_id = p_babalawo AND e.exception_date = p_date
                 AND e.kind = 'blocked'
                 AND (e.start_time IS NULL OR e.end_time IS NULL OR (v_t < e.end_time AND v_end > e.start_time))) THEN
      RAISE EXCEPTION 'That time is blocked' USING ERRCODE = 'IF001';
    END IF;
    v_ok := EXISTS (SELECT 1 FROM availability_exceptions e WHERE e.babalawo_id = p_babalawo AND e.exception_date = p_date
                      AND e.kind = 'extra' AND v_t >= e.start_time AND v_end <= e.end_time);
  END IF;
  IF NOT v_ok THEN
    v_ok := EXISTS (SELECT 1 FROM availability a WHERE a.babalawo_id = p_babalawo AND COALESCE(a.is_available, true)
                      AND a.day_of_week = extract(dow FROM p_date)::int AND v_t >= a.start_time AND v_end <= a.end_time);
  END IF;
  IF NOT v_ok THEN RAISE EXCEPTION 'That time is outside the babalawo''s working hours' USING ERRCODE = 'IF001'; END IF;

  IF EXISTS (SELECT 1 FROM sessions s WHERE s.babalawo_id = p_babalawo AND s.session_date = p_date
               AND s.status IN ('pending','confirmed','in_progress') AND NOT COALESCE(s.is_instant, false)
               AND v_t < s.start_time + make_interval(mins => v_step + v_buffer)
               AND v_end + make_interval(mins => v_buffer) > s.start_time) THEN
    RAISE EXCEPTION 'That slot is already booked' USING ERRCODE = 'IF001';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._create_paid_session(
  p_user uuid, p_babalawo uuid, p_date date, p_start text, p_is_instant boolean,
  p_amount numeric, p_method text, p_reference text, p_gateway_tx text DEFAULT NULL, p_verified boolean DEFAULT false)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plat numeric; v_baba numeric; v_commission numeric; v_session bigint;
BEGIN
  SELECT COALESCE(commission_platform_percent, 20), COALESCE(commission_babalawo_percent, 80)
    INTO v_plat, v_baba FROM babalawos WHERE user_id = p_babalawo;
  v_plat := COALESCE(v_plat, 20); v_baba := COALESCE(v_baba, 80);
  IF v_plat + v_baba <> 100 THEN v_plat := 20; v_baba := 80; END IF;
  v_commission := round(p_amount * v_plat / 100, 2);

  INSERT INTO sessions(user_id, babalawo_id, session_date, start_time, end_time, status, payment_status, amount,
                       payment_reference, is_instant, notes)
  VALUES (p_user, p_babalawo, p_date, p_start::time, p_start::time,
          (CASE WHEN p_is_instant THEN 'in_progress' ELSE 'confirmed' END)::session_status_enum,
          'paid', p_amount, p_reference, p_is_instant, CASE WHEN p_is_instant THEN 'Instant consultation' END)
  RETURNING id INTO v_session;

  INSERT INTO payments(user_id, session_id, amount, commission_amount, babalawo_amount, payment_gateway,
                       payment_reference, status, webhook_verified, gateway_transaction_id, commission_platform_percent)
  VALUES (p_user, v_session, p_amount, v_commission, p_amount - v_commission, p_method, p_reference,
          'completed', p_verified OR p_method = 'wallet', p_gateway_tx, v_plat);

  PERFORM _babalawo_escrow_credit(p_babalawo, v_session, p_amount - v_commission);
  PERFORM create_notification(p_babalawo, CASE WHEN p_is_instant THEN 'instant_session_request' ELSE 'session_booked' END,
          CASE WHEN p_is_instant THEN 'New Instant Session' ELSE 'New booking' END,
          'A client has paid for a consultation.', jsonb_build_object('session_id', v_session),
          CASE WHEN p_is_instant THEN 'urgent' ELSE 'high' END);
  RETURN v_session;
END $$;

-- ----------------------------------------------- client: pay from wallet
CREATE OR REPLACE FUNCTION public.book_session_with_wallet(
  p_babalawo_user_id uuid, p_session_date date, p_start_time text, p_is_instant boolean DEFAULT false,
  p_idempotency_key text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_price numeric; v_existing bigint; v_ref text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF public.is_suspended(v_user) THEN RAISE EXCEPTION 'Your account is suspended'; END IF;
  IF v_user = p_babalawo_user_id THEN RAISE EXCEPTION 'You cannot book yourself'; END IF;
  IF NOT EXISTS (SELECT 1 FROM babalawos WHERE user_id = p_babalawo_user_id AND COALESCE(is_active, true)) THEN
    RAISE EXCEPTION 'Babalawo not available';
  END IF;
  PERFORM _assert_bookable(p_babalawo_user_id, p_session_date, p_start_time, COALESCE(p_is_instant, false));
  IF p_idempotency_key IS NOT NULL THEN
    SELECT s.id INTO v_existing FROM sessions s WHERE s.idempotency_key = p_idempotency_key AND s.user_id = v_user;
    IF FOUND THEN RETURN v_existing; END IF;
  END IF;
  v_price := get_session_price(p_babalawo_user_id, p_is_instant);
  v_ref := 'WAL-' || replace(gen_random_uuid()::text, '-', '');
  PERFORM _wallet_apply(v_user, v_price, 'debit', 'session_payment', NULL, v_ref, 'Consultation session payment');
  v_existing := _create_paid_session(v_user, p_babalawo_user_id, p_session_date, p_start_time, p_is_instant, v_price, 'wallet', v_ref);
  UPDATE sessions SET idempotency_key = p_idempotency_key WHERE id = v_existing AND p_idempotency_key IS NOT NULL;
  RETURN v_existing;   -- any failure above aborts the whole transaction, so the debit rolls back with it
END $$;

-- ------------------------------------------- gateway: create + settle intent
CREATE OR REPLACE FUNCTION public.create_payment_intent(
  p_user uuid, p_kind text, p_gateway text, p_amount numeric DEFAULT NULL,
  p_babalawo_user_id uuid DEFAULT NULL, p_session_date date DEFAULT NULL, p_start_time text DEFAULT NULL,
  p_is_instant boolean DEFAULT false)
RETURNS TABLE(reference text, amount numeric) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_amt numeric; v_ref text;
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
  ELSE RAISE EXCEPTION 'Bad kind'; END IF;
  v_ref := 'IFANG-' || upper(left(p_gateway, 3)) || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));
  INSERT INTO payment_intents(user_id, kind, gateway, reference, amount, babalawo_user_id, session_date, start_time, is_instant)
  VALUES (p_user, p_kind, p_gateway, v_ref, v_amt, p_babalawo_user_id, p_session_date, p_start_time, COALESCE(p_is_instant, false));
  RETURN QUERY SELECT v_ref, v_amt;
END $$;

-- Called ONLY by edge functions after the provider confirmed the charge.
CREATE OR REPLACE FUNCTION public.settle_payment_intent(
  p_reference text, p_paid_amount numeric, p_currency text, p_gateway_tx text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i payment_intents%ROWTYPE; v_session bigint;
BEGIN
  SELECT * INTO i FROM payment_intents WHERE reference = p_reference FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'unknown_reference'); END IF;
  IF i.status = 'succeeded' THEN
    RETURN jsonb_build_object('status', 'already_settled', 'kind', i.kind, 'session_id', i.session_id, 'user_id', i.user_id);
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
    BEGIN
      PERFORM _assert_bookable(i.babalawo_user_id, i.session_date, i.start_time, i.is_instant);
      v_session := _create_paid_session(i.user_id, i.babalawo_user_id, i.session_date, i.start_time, i.is_instant,
                                        i.amount, i.gateway, i.reference, p_gateway_tx, true);
    EXCEPTION WHEN unique_violation OR SQLSTATE 'IF001' THEN
      -- slot was taken or is no longer bookable while the client was paying: the money goes to their wallet instead
      PERFORM _wallet_apply(i.user_id, i.amount, 'credit', 'payment_gateway', i.gateway, i.reference,
                            'Slot unavailable - payment held in wallet', 'topup-' || i.reference, true);
      UPDATE payment_intents SET status = 'succeeded', settled_at = now(), gateway_transaction_id = p_gateway_tx,
             failure_reason = 'slot_taken_credited_to_wallet' WHERE id = i.id;
      RETURN jsonb_build_object('status', 'slot_taken_credited_to_wallet', 'kind', i.kind, 'user_id', i.user_id);
    END;
  END IF;
  UPDATE payment_intents SET status = 'succeeded', settled_at = now(), gateway_transaction_id = p_gateway_tx, session_id = v_session
   WHERE id = i.id;
  PERFORM log_payment_audit(NULL, 'intent_settled', jsonb_build_object('reference', p_reference, 'kind', i.kind));
  RETURN jsonb_build_object('status', 'settled', 'kind', i.kind, 'session_id', v_session, 'user_id', i.user_id);
END $$;

CREATE OR REPLACE FUNCTION public.fail_payment_intent(p_reference text, p_reason text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE payment_intents SET status = 'failed', failure_reason = p_reason WHERE reference = p_reference AND status = 'pending';
$$;

-- ------------------------------------- escrow release on session completion
CREATE OR REPLACE FUNCTION public.credit_babalawo_on_session_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_amt numeric;
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' AND NEW.payment_status = 'paid' THEN
    SELECT amount INTO v_amt FROM babalawo_ledger WHERE session_id = NEW.id AND entry_type = 'earning';
    IF v_amt IS NULL THEN RETURN NEW; END IF;
    INSERT INTO babalawo_ledger(babalawo_id, entry_type, amount, session_id, note)
      VALUES (NEW.babalawo_id, 'release', v_amt, NEW.id, 'Session completed') ON CONFLICT DO NOTHING;
    IF FOUND THEN
      UPDATE babalawo_wallets SET pending_balance = pending_balance - v_amt,
             available_balance = available_balance + v_amt, updated_at = now() WHERE babalawo_id = NEW.babalawo_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trigger_credit_babalawo_on_completion ON public.sessions;
CREATE TRIGGER trigger_credit_babalawo_on_completion AFTER UPDATE OF status ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.credit_babalawo_on_session_completion();

-- ---------------------------------------------------- cancel + refund
-- Refund goes to the client's wallet (instant, no gateway fees). Babalawo earnings are reversed.
CREATE OR REPLACE FUNCTION public._refund_session(p_session_id bigint, p_reason text, p_by uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s sessions%ROWTYPE; p payments%ROWTYPE; v_earn numeric; v_refund numeric;
BEGIN
  SELECT * INTO s FROM sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
  SELECT * INTO p FROM payments WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND OR s.payment_status <> 'paid' THEN RAISE EXCEPTION 'Session has no refundable payment'; END IF;
  v_refund := p.amount - p.refunded_amount;
  IF v_refund <= 0 THEN RETURN 0; END IF;

  SELECT amount INTO v_earn FROM babalawo_ledger WHERE session_id = p_session_id AND entry_type = 'earning';
  IF v_earn IS NOT NULL THEN
    INSERT INTO babalawo_ledger(babalawo_id, entry_type, amount, session_id, note)
      VALUES (s.babalawo_id, 'refund_reversal', v_earn, p_session_id, p_reason) ON CONFLICT DO NOTHING;
    IF FOUND THEN
      IF EXISTS (SELECT 1 FROM babalawo_ledger WHERE session_id = p_session_id AND entry_type = 'release') THEN
        UPDATE babalawo_wallets SET available_balance = available_balance - v_earn WHERE babalawo_id = s.babalawo_id;
      ELSE
        UPDATE babalawo_wallets SET pending_balance = pending_balance - v_earn WHERE babalawo_id = s.babalawo_id;
      END IF;
      UPDATE babalawo_wallets SET lifetime_earned = lifetime_earned - v_earn, updated_at = now() WHERE babalawo_id = s.babalawo_id;
    END IF;
  END IF;

  PERFORM _wallet_apply(s.user_id, v_refund, 'credit', 'refund', NULL, p.payment_reference,
                        'Refund: ' || COALESCE(p_reason, 'session cancelled'), 'refund-' || p_session_id);
  UPDATE payments SET refunded_amount = amount, status = 'refunded', updated_at = now() WHERE id = p.id;
  UPDATE sessions SET payment_status = 'refunded', status = 'cancelled' WHERE id = p_session_id;
  INSERT INTO refunds(payment_id, amount, reason, status, processed_by)
    VALUES (p.id, v_refund, p_reason, 'completed', p_by);
  RETURN v_refund;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_session(p_session_id bigint, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s sessions%ROWTYPE; v_uid uuid := auth.uid(); v_hours numeric; v_start timestamptz; v_refund numeric := 0;
BEGIN
  SELECT * INTO s FROM sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
  IF v_uid IS NULL OR (v_uid <> s.user_id AND v_uid <> s.babalawo_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF s.status IN ('cancelled','completed') THEN RAISE EXCEPTION 'Session already %', s.status; END IF;
  v_start := (s.session_date + s.start_time) AT TIME ZONE COALESCE(NULLIF(s.user_timezone, ''), 'UTC');
  v_hours := extract(epoch FROM (v_start - now())) / 3600;
  IF s.payment_status = 'paid' THEN
    -- babalawo / admin cancellations are always refunded; a client only with enough notice
    IF v_uid = s.user_id AND NOT public.is_admin() AND v_hours < get_setting_numeric('cancellation_full_refund_hours', 24) THEN
      UPDATE sessions SET status = 'cancelled' WHERE id = s.id;
      RETURN jsonb_build_object('cancelled', true, 'refunded', 0, 'reason', 'late_cancellation');
    END IF;
    v_refund := _refund_session(s.id, COALESCE(p_reason, 'Session cancelled'), v_uid);
  ELSE
    UPDATE sessions SET status = 'cancelled' WHERE id = s.id;
  END IF;
  RETURN jsonb_build_object('cancelled', true, 'refunded', v_refund);
END $$;

CREATE OR REPLACE FUNCTION public.admin_refund_session(p_session_id bigint, p_reason text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  RETURN _refund_session(p_session_id, p_reason, auth.uid());
END $$;

-- ------------------------------------------------------------ withdrawals
ALTER TABLE public.withdrawal_requests ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE public.withdrawal_requests ADD COLUMN IF NOT EXISTS admin_note text;
ALTER TABLE public.withdrawal_requests ADD COLUMN IF NOT EXISTS payout_reference text;
ALTER TABLE public.withdrawal_requests ADD COLUMN IF NOT EXISTS processed_by uuid;
ALTER TABLE public.withdrawal_requests ADD COLUMN IF NOT EXISTS processed_at timestamptz;
ALTER TABLE public.withdrawal_requests ADD COLUMN IF NOT EXISTS bank_snapshot jsonb;
DROP POLICY IF EXISTS "Admins can view withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Admins can view withdrawal requests" ON public.withdrawal_requests FOR SELECT USING (public.is_admin());
REVOKE INSERT, UPDATE, DELETE ON public.withdrawal_requests, public.payouts FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.request_withdrawal(p_amount numeric, p_reason text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid; v_bank jsonb; v_min numeric := get_setting_numeric('min_withdrawal_amount', 5000);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF public.is_suspended(v_uid) THEN RAISE EXCEPTION 'Your account is suspended'; END IF;
  IF NOT EXISTS (SELECT 1 FROM babalawos WHERE user_id = v_uid) THEN RAISE EXCEPTION 'Only babalawos can withdraw'; END IF;
  IF p_amount IS NULL OR p_amount < v_min THEN RAISE EXCEPTION 'Minimum withdrawal is %', v_min; END IF;
  SELECT to_jsonb(b) - 'id' - 'babalawo_id' INTO v_bank FROM babalawo_bank_details b
    WHERE b.babalawo_id = v_uid ORDER BY b.updated_at DESC NULLS LAST LIMIT 1;
  IF v_bank IS NULL THEN RAISE EXCEPTION 'Add your bank details first'; END IF;
  UPDATE babalawo_wallets SET available_balance = available_balance - p_amount, held_balance = held_balance + p_amount,
         updated_at = now() WHERE babalawo_id = v_uid AND available_balance >= p_amount;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient available balance'; END IF;
  INSERT INTO withdrawal_requests(babalawo_id, amount, status, reason, bank_snapshot)
    VALUES (v_uid, p_amount, 'pending', COALESCE(p_reason, 'Regular withdrawal'), v_bank) RETURNING id INTO v_id;
  INSERT INTO babalawo_ledger(babalawo_id, entry_type, amount, withdrawal_id, note) VALUES (v_uid, 'withdrawal_hold', p_amount, v_id, 'Withdrawal requested');
  PERFORM create_notification(v_uid, 'withdrawal_requested', 'Withdrawal requested', 'We will process it shortly.', jsonb_build_object('withdrawal_id', v_id), 'normal');
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_process_withdrawal(p_id uuid, p_action text, p_reference text DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w withdrawal_requests%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO w FROM withdrawal_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF p_action = 'approve' THEN
    IF w.status <> 'pending' THEN RAISE EXCEPTION 'Only pending requests can be approved'; END IF;
    UPDATE withdrawal_requests SET status = 'approved', processed_by = auth.uid(), processed_at = now(), admin_note = p_note WHERE id = p_id;
  ELSIF p_action = 'reject' THEN
    IF w.status NOT IN ('pending','approved') THEN RAISE EXCEPTION 'Cannot reject a % request', w.status; END IF;
    UPDATE babalawo_wallets SET held_balance = held_balance - w.amount, available_balance = available_balance + w.amount,
           updated_at = now() WHERE babalawo_id = w.babalawo_id;
    INSERT INTO babalawo_ledger(babalawo_id, entry_type, amount, withdrawal_id, note) VALUES (w.babalawo_id, 'withdrawal_reject', w.amount, p_id, p_note);
    UPDATE withdrawal_requests SET status = 'rejected', processed_by = auth.uid(), processed_at = now(), admin_note = p_note WHERE id = p_id;
  ELSIF p_action = 'mark_paid' THEN
    IF w.status NOT IN ('pending','approved') THEN RAISE EXCEPTION 'Cannot pay a % request', w.status; END IF;
    UPDATE babalawo_wallets SET held_balance = held_balance - w.amount, lifetime_paid_out = lifetime_paid_out + w.amount,
           updated_at = now() WHERE babalawo_id = w.babalawo_id;
    INSERT INTO babalawo_ledger(babalawo_id, entry_type, amount, withdrawal_id, note) VALUES (w.babalawo_id, 'withdrawal_paid', w.amount, p_id, p_reference);
    INSERT INTO payouts(babalawo_id, amount, method, reference, status) VALUES (w.babalawo_id, w.amount, 'bank_transfer', p_reference, 'paid');
    UPDATE withdrawal_requests SET status = 'completed', payout_reference = p_reference, processed_by = auth.uid(),
           processed_at = now(), admin_note = p_note WHERE id = p_id;
  ELSE RAISE EXCEPTION 'Unknown action %', p_action; END IF;
  PERFORM create_notification(w.babalawo_id, 'withdrawal_' || p_action, 'Withdrawal update', 'Your withdrawal request was updated: ' || p_action || '.', jsonb_build_object('withdrawal_id', p_id), 'normal');
END $$;

-- ------------------------------------------------------------ admin tools
CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(p_user_id uuid, p_amount numeric, p_type text, p_description text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tx uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF p_description IS NULL OR length(btrim(p_description)) < 3 THEN RAISE EXCEPTION 'A reason is required'; END IF;
  v_tx := _wallet_apply(p_user_id, p_amount, p_type, 'admin_adjustment', NULL, NULL, p_description);
  PERFORM log_payment_audit(NULL, 'admin_wallet_adjustment',
          jsonb_build_object('admin', auth.uid(), 'user', p_user_id, 'amount', p_amount, 'type', p_type, 'reason', p_description));
  RETURN v_tx;
END $$;

CREATE OR REPLACE FUNCTION public.admin_transactions(
  p_kind text DEFAULT NULL, p_status text DEFAULT NULL, p_search text DEFAULT NULL, p_limit int DEFAULT 50, p_offset int DEFAULT 0)
RETURNS TABLE(kind text, id text, created_at timestamptz, user_id uuid, amount numeric, status text, reference text, detail text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  RETURN QUERY
  SELECT t.kind, t.id, t.created_at, t.user_id, t.amount, t.status, t.reference, t.detail FROM (
    SELECT 'payment'::text AS kind, p.id::text AS id, p.created_at, p.user_id, p.amount::numeric AS amount, p.status::text AS status,
           p.payment_reference::text AS reference, ('session ' || p.session_id || ' via ' || COALESCE(p.payment_gateway,'?'))::text AS detail FROM payments p
    UNION ALL
    SELECT 'wallet', w.id::text, w.created_at, w.user_id, w.amount::numeric, (w.transaction_type || '/' || w.transaction_source)::text,
           w.payment_reference::text, w.description::text FROM wallet_transactions w
    UNION ALL
    SELECT 'withdrawal', r.id::text, r.created_at, r.babalawo_id, r.amount::numeric, r.status::text, r.payout_reference::text, r.reason::text FROM withdrawal_requests r
    UNION ALL
    SELECT 'refund', f.id::text, f.created_at, NULL::uuid, f.amount::numeric, f.status::text, f.payment_id::text, f.reason::text FROM refunds f
    UNION ALL
    SELECT 'intent', i.id::text, i.created_at, i.user_id, i.amount::numeric, i.status::text, i.reference::text, COALESCE(i.failure_reason, i.kind)::text FROM payment_intents i
  ) t
  WHERE (p_kind IS NULL OR t.kind = p_kind)
    AND (p_status IS NULL OR t.status ILIKE p_status || '%')
    AND (p_search IS NULL OR t.reference ILIKE '%' || p_search || '%' OR t.user_id::text = p_search OR t.detail ILIKE '%' || p_search || '%')
  ORDER BY t.created_at DESC LIMIT LEAST(p_limit, 200) OFFSET p_offset;
END $$;

CREATE OR REPLACE FUNCTION public.admin_finance_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT jsonb_build_object(
    'gross_paid',        COALESCE((SELECT sum(amount) FROM payments WHERE status IN ('completed','refunded')), 0),
    'refunded',          COALESCE((SELECT sum(refunded_amount) FROM payments), 0),
    'platform_commission', COALESCE((SELECT sum(commission_amount) FROM payments WHERE status = 'completed'), 0),
    'wallet_liability',  COALESCE((SELECT sum(balance) FROM wallets), 0),
    'babalawo_pending',  COALESCE((SELECT sum(pending_balance) FROM babalawo_wallets), 0),
    'babalawo_available',COALESCE((SELECT sum(available_balance) FROM babalawo_wallets), 0),
    'withdrawals_pending', COALESCE((SELECT sum(amount) FROM withdrawal_requests WHERE status IN ('pending','approved')), 0),
    'paid_out',          COALESCE((SELECT sum(amount) FROM payouts WHERE status = 'paid'), 0),
    'intents_needing_review', (SELECT count(*) FROM payment_intents WHERE status = 'needs_review')
  ) INTO r;
  RETURN r;
END $$;

-- ===================== lock down every money / internal function =========
DO $$
DECLARE f record;
BEGIN
  -- the old, client-callable wallet functions are removed outright
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname IN ('update_wallet_balance','rollback_wallet_transaction','update_babalawo_balance_after_withdrawal')
  LOOP
    EXECUTE format('DROP FUNCTION %s', f.sig);
  END LOOP;
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname IN
              ('create_notification','log_payment_audit','_wallet_apply','_babalawo_escrow_credit','_create_paid_session',
               '_assert_bookable','_refund_session','create_payment_intent','settle_payment_intent','fail_payment_intent',
               'check_duplicate_session','check_babalawo_concurrent_sessions','credit_babalawo_on_session_completion')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
  -- client-facing RPCs: signed-in users only (each re-checks identity / admin inside)
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname IN
              ('book_session_with_wallet','cancel_session','set_my_session_price','request_withdrawal','admin_refund_session',
               'admin_process_withdrawal','admin_adjust_wallet','admin_transactions','admin_finance_summary')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.sig);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.get_session_price(uuid, boolean) TO anon, authenticated;
