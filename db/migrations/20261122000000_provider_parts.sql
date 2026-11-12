-- Which provider holds every naira.
--
-- Money is collected by Paystack or Flutterwave and stays in that provider's balance. Alex's rule
-- (12 Nov 2026): a Babalawo is paid out through the same provider that received the client's money,
-- and the platform's commission stays behind in that balance. So every balance that holds money is
-- split into a Paystack part and a Flutterwave part, and every movement says which part it touches:
--
--   * client wallets: wallet_parts. A top-up lands in its gateway's part; spending takes the larger
--     part first; a refund goes back to the parts the payment came from.
--   * payments: provider_parts = the card part (its gateway) plus the wallet parts it used.
--   * Babalawo balances: babalawo_balance_parts (pending, available, held, paid_out). A trigger on
--     babalawo_wallets splits every change by the split the calling function declared with
--     _bparts_use(); a change without a declared split is refused.
--   * At commit, deferred constraint triggers check that the parts add up to the totals exactly.
--
-- Also records the processing fee each provider reports (fees are passed to the customer by the
-- providers' own "pass fees to customer" settings, so the fee is on top of our price).

-- ------------------------------------------------------------------ tables
CREATE TABLE IF NOT EXISTS public.wallet_parts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('paystack', 'flutterwave')),
  balance numeric(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, provider)
);
ALTER TABLE public.wallet_parts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own wallet parts" ON public.wallet_parts;
CREATE POLICY "Users read own wallet parts" ON public.wallet_parts FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
REVOKE INSERT, UPDATE, DELETE ON public.wallet_parts FROM anon, authenticated;
GRANT SELECT ON public.wallet_parts TO authenticated;

CREATE TABLE IF NOT EXISTS public.babalawo_balance_parts (
  babalawo_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('paystack', 'flutterwave')),
  pending numeric(12,2) NOT NULL DEFAULT 0 CHECK (pending >= 0),
  available numeric(12,2) NOT NULL DEFAULT 0 CHECK (available >= 0),
  held numeric(12,2) NOT NULL DEFAULT 0 CHECK (held >= 0),
  paid_out numeric(12,2) NOT NULL DEFAULT 0 CHECK (paid_out >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (babalawo_id, provider)
);
ALTER TABLE public.babalawo_balance_parts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Babalawos read own balance parts" ON public.babalawo_balance_parts;
CREATE POLICY "Babalawos read own balance parts" ON public.babalawo_balance_parts
  FOR SELECT USING (auth.uid() = babalawo_id OR public.is_admin());
REVOKE INSERT, UPDATE, DELETE ON public.babalawo_balance_parts FROM anon, authenticated;
GRANT SELECT ON public.babalawo_balance_parts TO authenticated;

-- Every change to a Babalawo's provider parts, for reconciliation.
CREATE TABLE IF NOT EXISTS public.babalawo_parts_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  babalawo_id uuid NOT NULL,
  provider text NOT NULL,
  d_pending numeric(12,2) NOT NULL DEFAULT 0,
  d_available numeric(12,2) NOT NULL DEFAULT 0,
  d_held numeric(12,2) NOT NULL DEFAULT 0,
  d_paid_out numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_babalawo_parts_log ON public.babalawo_parts_log(babalawo_id, created_at DESC);
ALTER TABLE public.babalawo_parts_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read parts log" ON public.babalawo_parts_log;
CREATE POLICY "Admins read parts log" ON public.babalawo_parts_log FOR SELECT USING (public.is_admin());
REVOKE INSERT, UPDATE, DELETE ON public.babalawo_parts_log FROM anon, authenticated;

ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS provider_parts jsonb;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS provider_parts jsonb;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS provider_fee numeric(12,2);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS charged_amount numeric(12,2);
ALTER TABLE public.payment_intents ADD COLUMN IF NOT EXISTS provider_fee numeric(12,2);
ALTER TABLE public.payment_intents ADD COLUMN IF NOT EXISTS charged_amount numeric(12,2);
ALTER TABLE public.withdrawal_requests ADD COLUMN IF NOT EXISTS provider_parts jsonb;
COMMENT ON COLUMN public.payments.provider_parts IS
  'How much of this payment each provider holds, e.g. {"paystack": 6000, "flutterwave": 4000}.';
COMMENT ON COLUMN public.payments.provider_fee IS 'Processing fee the provider reported for the card part (paid by the client on top).';
COMMENT ON COLUMN public.withdrawal_requests.provider_parts IS 'How the withdrawal is split across provider balances; one payout transfer per provider.';

-- ----------------------------------------------------------------- helpers
-- Split an amount across providers in proportion to p_weights, to the kobo. Deterministic:
-- providers in a fixed order, the last one takes the rounding remainder.
CREATE OR REPLACE FUNCTION public._split(p_amount numeric, p_weights jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v_total numeric := 0; v_left numeric := p_amount; v_out jsonb := '{}'::jsonb;
        v_provs text[]; v_w numeric; i int;
BEGIN
  IF p_weights IS NULL OR jsonb_typeof(p_weights) <> 'object' THEN RAISE EXCEPTION 'No provider split given'; END IF;
  SELECT array_agg(k ORDER BY array_position(ARRAY['paystack','flutterwave'], k)), sum((p_weights->>k)::numeric)
    INTO v_provs, v_total
    FROM jsonb_object_keys(p_weights) k WHERE (p_weights->>k)::numeric > 0;
  IF v_provs IS NULL OR v_total IS NULL OR v_total <= 0 THEN RAISE EXCEPTION 'Provider split is empty'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_provs) k WHERE k NOT IN ('paystack','flutterwave')) THEN
    RAISE EXCEPTION 'Unknown provider in split %', p_weights;
  END IF;
  FOR i IN 1 .. array_length(v_provs, 1) LOOP
    IF i = array_length(v_provs, 1) THEN
      v_out := v_out || jsonb_build_object(v_provs[i], v_left);
    ELSE
      v_w := round(p_amount * (p_weights->>v_provs[i])::numeric / v_total, 2);
      v_out := v_out || jsonb_build_object(v_provs[i], v_w);
      v_left := v_left - v_w;
    END IF;
  END LOOP;
  RETURN v_out;
END $$;

-- Add two splits key by key.
CREATE OR REPLACE FUNCTION public._parts_add(a jsonb, b jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(jsonb_object_agg(k, v) FILTER (WHERE v <> 0), '{}'::jsonb) FROM (
    SELECT k, sum(v) v FROM (
      SELECT key k, value::numeric v FROM jsonb_each_text(COALESCE(a, '{}'::jsonb))
      UNION ALL SELECT key, value::numeric FROM jsonb_each_text(COALESCE(b, '{}'::jsonb))) x GROUP BY k) y
$$;

CREATE OR REPLACE FUNCTION public._parts_total(a jsonb)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(sum(value::numeric), 0) FROM jsonb_each_text(COALESCE(a, '{}'::jsonb))
$$;

-- Declare the provider split for the next change to a Babalawo's balances (used once).
CREATE OR REPLACE FUNCTION public._bparts_use(p_weights jsonb)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_weights IS NULL OR public._parts_total(p_weights) <= 0 THEN
    RAISE EXCEPTION 'No provider split for this Babalawo balance change';
  END IF;
  PERFORM set_config('ifa.bparts', p_weights::text, true);
END $$;

-- ----------------------------------------------------------- client wallet
DROP FUNCTION IF EXISTS public._wallet_apply(uuid, numeric, text, text, text, text, text, text, boolean);
CREATE OR REPLACE FUNCTION public._wallet_apply(
  p_user_id uuid, p_amount numeric, p_type text, p_source text,
  p_gateway text DEFAULT NULL, p_reference text DEFAULT NULL,
  p_description text DEFAULT NULL, p_idempotency_key text DEFAULT NULL, p_verified boolean DEFAULT false,
  p_parts jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_wallet uuid; v_tx uuid; v_bal numeric; v_parts jsonb := '{}'::jsonb; v_left numeric; v_take numeric; r record;
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
    -- Which provider holds this money: given, the gateway that collected it, or (refunds) the
    -- providers the original payment came from.
    v_parts := COALESCE(p_parts,
      CASE WHEN p_gateway IN ('paystack','flutterwave') THEN jsonb_build_object(p_gateway, p_amount) END,
      (SELECT provider_parts FROM payments WHERE payment_reference = p_reference AND provider_parts IS NOT NULL
        ORDER BY created_at LIMIT 1));
    IF v_parts IS NULL THEN RAISE EXCEPTION 'Wallet credit needs a provider (Paystack or Flutterwave)'; END IF;
    v_parts := _split(p_amount, v_parts);
    INSERT INTO wallet_parts(user_id, provider, balance)
      SELECT p_user_id, key, value::numeric FROM jsonb_each_text(v_parts) WHERE value::numeric <> 0
      ON CONFLICT (user_id, provider) DO UPDATE SET balance = wallet_parts.balance + EXCLUDED.balance, updated_at = now();
    UPDATE wallets SET balance = balance + p_amount, updated_at = now() WHERE id = v_wallet RETURNING balance INTO v_bal;
  ELSE
    UPDATE wallets SET balance = balance - p_amount, updated_at = now()
      WHERE id = v_wallet AND balance >= p_amount RETURNING balance INTO v_bal;
    IF v_bal IS NULL THEN RAISE EXCEPTION 'Insufficient wallet balance'; END IF;
    -- Spend the larger part first, so a wallet drifts back towards one provider.
    v_left := p_amount;
    FOR r IN SELECT provider, balance FROM wallet_parts WHERE user_id = p_user_id AND balance > 0
              ORDER BY balance DESC, provider FOR UPDATE LOOP
      EXIT WHEN v_left <= 0;
      v_take := LEAST(v_left, r.balance);
      UPDATE wallet_parts SET balance = balance - v_take, updated_at = now() WHERE user_id = p_user_id AND provider = r.provider;
      v_parts := v_parts || jsonb_build_object(r.provider, v_take);
      v_left := v_left - v_take;
    END LOOP;
    IF v_left > 0 THEN RAISE EXCEPTION 'Wallet parts do not cover the balance (short by %)', v_left; END IF;
  END IF;
  INSERT INTO wallet_transactions(user_id, wallet_id, amount, transaction_type, transaction_source, payment_gateway,
      payment_reference, description, balance_after, idempotency_key, status, webhook_verified, provider_parts)
  VALUES (p_user_id, v_wallet, p_amount, p_type, p_source, p_gateway, p_reference, p_description,
      v_bal, p_idempotency_key, 'completed', p_verified, v_parts)
  RETURNING id INTO v_tx;
  RETURN v_tx;
END $$;

-- Admin wallet adjustments must say which provider's money a credit is.
DROP FUNCTION IF EXISTS public.admin_adjust_wallet(uuid, numeric, text, text);
CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(p_user_id uuid, p_amount numeric, p_type text, p_description text,
  p_provider text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tx uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF p_description IS NULL OR length(btrim(p_description)) < 3 THEN RAISE EXCEPTION 'A reason is required'; END IF;
  IF p_type = 'credit' AND COALESCE(p_provider, '') NOT IN ('paystack', 'flutterwave') THEN
    RAISE EXCEPTION 'Choose which provider balance (Paystack or Flutterwave) holds this credit';
  END IF;
  v_tx := _wallet_apply(p_user_id, p_amount, p_type, 'admin_adjustment', NULL, NULL, p_description, NULL, false,
                        CASE WHEN p_type = 'credit' THEN jsonb_build_object(p_provider, p_amount) END);
  PERFORM log_payment_audit(NULL, 'admin_wallet_adjustment',
          jsonb_build_object('admin', auth.uid(), 'user', p_user_id, 'amount', p_amount, 'type', p_type,
                             'provider', p_provider, 'reason', p_description));
  RETURN v_tx;
END $$;

-- -------------------------------------------------------------- payments
-- A payment's provider split: the wallet parts its reference spent, plus the card part in its gateway.
CREATE OR REPLACE FUNCTION public.set_payment_provider_parts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_wallet jsonb := '{}'::jsonb; v_card numeric; r record;
BEGIN
  IF NEW.provider_parts IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.payment_reference IS NOT NULL THEN
    FOR r IN SELECT provider_parts FROM wallet_transactions
              WHERE payment_reference = NEW.payment_reference AND transaction_type = 'debit' AND provider_parts IS NOT NULL LOOP
      v_wallet := _parts_add(v_wallet, r.provider_parts);
    END LOOP;
  END IF;
  v_card := COALESCE(NEW.amount, 0) - _parts_total(v_wallet);
  IF v_card > 0 THEN
    IF NEW.payment_gateway NOT IN ('paystack', 'flutterwave') THEN
      RAISE EXCEPTION 'Payment % has % not covered by the wallet and no card provider', NEW.payment_reference, v_card;
    END IF;
    v_wallet := _parts_add(v_wallet, jsonb_build_object(NEW.payment_gateway, v_card));
  END IF;
  NEW.provider_parts := NULLIF(v_wallet, '{}'::jsonb);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_payment_provider_parts ON public.payments;
CREATE TRIGGER trg_payment_provider_parts BEFORE INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_payment_provider_parts();

-- Record the processing fee the provider reported (server only, after verification).
CREATE OR REPLACE FUNCTION public.record_provider_fee(p_reference text, p_fee numeric, p_charged numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE payment_intents SET provider_fee = p_fee, charged_amount = p_charged WHERE reference = p_reference;
  UPDATE payments SET provider_fee = p_fee, charged_amount = p_charged WHERE payment_reference = p_reference;
END $$;

-- -------------------------------------------------------- Babalawo parts
CREATE OR REPLACE FUNCTION public.babalawo_wallet_parts_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d_p numeric := NEW.pending_balance - CASE WHEN TG_OP = 'UPDATE' THEN OLD.pending_balance ELSE 0 END;
  d_a numeric := COALESCE(NEW.available_balance, 0) - CASE WHEN TG_OP = 'UPDATE' THEN COALESCE(OLD.available_balance, 0) ELSE 0 END;
  d_h numeric := NEW.held_balance - CASE WHEN TG_OP = 'UPDATE' THEN OLD.held_balance ELSE 0 END;
  d_o numeric := NEW.lifetime_paid_out - CASE WHEN TG_OP = 'UPDATE' THEN OLD.lifetime_paid_out ELSE 0 END;
  v_w jsonb; sp jsonb; sa jsonb; sh jsonb; so jsonb; k text;
BEGIN
  IF d_p = 0 AND d_a = 0 AND d_h = 0 AND d_o = 0 THEN RETURN NEW; END IF;
  v_w := NULLIF(current_setting('ifa.bparts', true), '')::jsonb;
  IF v_w IS NULL THEN
    RAISE EXCEPTION 'Babalawo balance changed without a provider split' USING ERRCODE = 'IF010';
  END IF;
  PERFORM set_config('ifa.bparts', '', true);
  sp := CASE WHEN d_p <> 0 THEN _split(d_p, v_w) ELSE '{}' END;
  sa := CASE WHEN d_a <> 0 THEN _split(d_a, v_w) ELSE '{}' END;
  sh := CASE WHEN d_h <> 0 THEN _split(d_h, v_w) ELSE '{}' END;
  so := CASE WHEN d_o <> 0 THEN _split(d_o, v_w) ELSE '{}' END;
  FOR k IN SELECT jsonb_object_keys(sp || sa || sh || so) LOOP
    -- Update first: a decrease must never be proposed as a new (negative) row.
    UPDATE babalawo_balance_parts SET
        pending = pending + COALESCE((sp->>k)::numeric, 0),
        available = available + COALESCE((sa->>k)::numeric, 0),
        held = held + COALESCE((sh->>k)::numeric, 0),
        paid_out = paid_out + COALESCE((so->>k)::numeric, 0),
        updated_at = now()
     WHERE babalawo_id = NEW.babalawo_id AND provider = k;
    IF NOT FOUND THEN
      INSERT INTO babalawo_balance_parts(babalawo_id, provider, pending, available, held, paid_out)
        VALUES (NEW.babalawo_id, k, COALESCE((sp->>k)::numeric, 0), COALESCE((sa->>k)::numeric, 0),
                COALESCE((sh->>k)::numeric, 0), COALESCE((so->>k)::numeric, 0));
    END IF;
    INSERT INTO babalawo_parts_log(babalawo_id, provider, d_pending, d_available, d_held, d_paid_out)
      VALUES (NEW.babalawo_id, k, COALESCE((sp->>k)::numeric, 0), COALESCE((sa->>k)::numeric, 0),
              COALESCE((sh->>k)::numeric, 0), COALESCE((so->>k)::numeric, 0));
  END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_babalawo_wallet_parts ON public.babalawo_wallets;
CREATE TRIGGER trg_babalawo_wallet_parts AFTER INSERT OR UPDATE ON public.babalawo_wallets
  FOR EACH ROW EXECUTE FUNCTION public.babalawo_wallet_parts_sync();

-- How a withdrawal of p_amount is split: the larger available part first.
CREATE OR REPLACE FUNCTION public._babalawo_withdrawal_split(p_babalawo uuid, p_amount numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_left numeric := p_amount; v_take numeric; v_out jsonb := '{}'::jsonb; r record;
BEGIN
  FOR r IN SELECT provider, available FROM babalawo_balance_parts
            WHERE babalawo_id = p_babalawo AND available > 0 ORDER BY available DESC, provider LOOP
    EXIT WHEN v_left <= 0;
    v_take := LEAST(v_left, r.available);
    v_out := v_out || jsonb_build_object(r.provider, v_take);
    v_left := v_left - v_take;
  END LOOP;
  IF v_left > 0 THEN RAISE EXCEPTION 'Insufficient available balance'; END IF;
  RETURN v_out;
END $$;

-- --------------------------------------------- parts must add up, at commit
CREATE OR REPLACE FUNCTION public.check_wallet_parts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END; v_bal numeric; v_parts numeric;
BEGIN
  SELECT balance INTO v_bal FROM wallets WHERE user_id = v_user;
  SELECT COALESCE(sum(balance), 0) INTO v_parts FROM wallet_parts WHERE user_id = v_user;
  IF COALESCE(v_bal, 0) <> v_parts THEN
    RAISE EXCEPTION 'Wallet % is % but its provider parts add up to %', v_user, v_bal, v_parts USING ERRCODE = 'IF011';
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_check_wallet_parts ON public.wallets;
CREATE CONSTRAINT TRIGGER trg_check_wallet_parts AFTER INSERT OR UPDATE ON public.wallets
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_wallet_parts();
DROP TRIGGER IF EXISTS trg_check_wallet_parts ON public.wallet_parts;
CREATE CONSTRAINT TRIGGER trg_check_wallet_parts AFTER INSERT OR UPDATE OR DELETE ON public.wallet_parts
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_wallet_parts();

CREATE OR REPLACE FUNCTION public.check_babalawo_parts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.babalawo_id ELSE NEW.babalawo_id END; w record; p record;
BEGIN
  SELECT COALESCE(pending_balance, 0) pe, COALESCE(available_balance, 0) av, COALESCE(held_balance, 0) he
    INTO w FROM babalawo_wallets WHERE babalawo_id = v_id;
  SELECT COALESCE(sum(pending), 0) pe, COALESCE(sum(available), 0) av, COALESCE(sum(held), 0) he
    INTO p FROM babalawo_balance_parts WHERE babalawo_id = v_id;
  IF COALESCE(w.pe, 0) <> p.pe OR COALESCE(w.av, 0) <> p.av OR COALESCE(w.he, 0) <> p.he THEN
    RAISE EXCEPTION 'Babalawo % balances (%/%/%) do not match their provider parts (%/%/%)',
      v_id, w.pe, w.av, w.he, p.pe, p.av, p.he USING ERRCODE = 'IF011';
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_check_babalawo_parts ON public.babalawo_wallets;
CREATE CONSTRAINT TRIGGER trg_check_babalawo_parts AFTER INSERT OR UPDATE ON public.babalawo_wallets
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_babalawo_parts();
DROP TRIGGER IF EXISTS trg_check_babalawo_parts ON public.babalawo_balance_parts;
CREATE CONSTRAINT TRIGGER trg_check_babalawo_parts AFTER INSERT OR UPDATE OR DELETE ON public.babalawo_balance_parts
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_babalawo_parts();

-- ------------------------------------------------- balances already there
-- The production database starts empty; on any older database, existing money is put in the
-- Paystack part so the books balance. An admin can move it with an adjustment if that is wrong.
INSERT INTO public.wallet_parts(user_id, provider, balance)
  SELECT user_id, 'paystack', balance FROM public.wallets WHERE balance > 0
  ON CONFLICT (user_id, provider) DO NOTHING;
INSERT INTO public.babalawo_balance_parts(babalawo_id, provider, pending, available, held, paid_out)
  SELECT babalawo_id, 'paystack', COALESCE(pending_balance, 0), COALESCE(available_balance, 0),
         COALESCE(held_balance, 0), COALESCE(lifetime_paid_out, 0)
    FROM public.babalawo_wallets
   WHERE COALESCE(pending_balance, 0) + COALESCE(available_balance, 0) + COALESCE(held_balance, 0) + COALESCE(lifetime_paid_out, 0) > 0
  ON CONFLICT (babalawo_id, provider) DO NOTHING;
UPDATE public.withdrawal_requests SET provider_parts = jsonb_build_object('paystack', amount)
 WHERE provider_parts IS NULL AND status IN ('pending', 'approved');
UPDATE public.payments SET provider_parts = jsonb_build_object(
         CASE WHEN payment_gateway = 'flutterwave' THEN 'flutterwave' ELSE 'paystack' END, amount)
 WHERE provider_parts IS NULL AND amount > 0;


CREATE OR REPLACE FUNCTION public._babalawo_escrow_credit(p_babalawo uuid, p_session_id bigint, p_amount numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO babalawo_ledger(babalawo_id, entry_type, amount, session_id, note)
    VALUES (p_babalawo, 'earning', p_amount, p_session_id, 'Session paid, held until completion')
    ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN; END IF;
  INSERT INTO babalawo_wallets(babalawo_id) VALUES (p_babalawo) ON CONFLICT (babalawo_id) DO NOTHING;
  PERFORM _bparts_use((SELECT provider_parts FROM payments WHERE session_id = p_session_id));
  UPDATE babalawo_wallets SET pending_balance = pending_balance + p_amount,
         lifetime_earned = lifetime_earned + p_amount, updated_at = now() WHERE babalawo_id = p_babalawo;
END $$;

CREATE OR REPLACE FUNCTION public.release_held_earnings()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_amt numeric; n int := 0;
BEGIN
  FOR r IN SELECT s.id, s.babalawo_id FROM sessions s
            WHERE s.status = 'completed' AND s.payment_status = 'paid'
              AND COALESCE(s.earnings_release_at, s.updated_at) <= now()
              AND NOT EXISTS (SELECT 1 FROM babalawo_ledger l WHERE l.session_id = s.id AND l.entry_type = 'release')
              AND NOT EXISTS (SELECT 1 FROM disputes d WHERE d.session_id = s.id AND d.status IN ('open', 'investigating'))
            FOR UPDATE OF s SKIP LOCKED LOOP
    SELECT amount INTO v_amt FROM babalawo_ledger WHERE session_id = r.id AND entry_type = 'earning';
    CONTINUE WHEN v_amt IS NULL;
    INSERT INTO babalawo_ledger(babalawo_id, entry_type, amount, session_id, note)
      VALUES (r.babalawo_id, 'release', v_amt, r.id, 'Session completed') ON CONFLICT DO NOTHING;
    IF FOUND THEN
      PERFORM _bparts_use((SELECT provider_parts FROM payments WHERE session_id = r.id));
      UPDATE babalawo_wallets SET pending_balance = pending_balance - v_amt,
             available_balance = available_balance + v_amt, updated_at = now() WHERE babalawo_id = r.babalawo_id;
      n := n + 1;
    END IF;
  END LOOP;
  RETURN n;
END $$;

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
      PERFORM _bparts_use(p.provider_parts);
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

CREATE OR REPLACE FUNCTION public._ebo_mark_paid(p_id uuid, p_method text, p_reference text, p_gateway_tx text, p_verified boolean,
  p_attendance text DEFAULT 'absent')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e ebo_prescriptions%ROWTYPE; v_baba numeric;
BEGIN
  SELECT * INTO e FROM ebo_prescriptions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR e.status NOT IN ('sent','expired') OR e.performed_by <> 'babalawo' OR e.total <= 0 THEN
    RAISE EXCEPTION 'This Ebo can no longer be paid' USING ERRCODE = 'IF002';
  END IF;
  v_baba := e.total;  -- the platform fee was added on top; the whole Ebo total is the Babalawo's
  UPDATE ebo_prescriptions SET status = 'paid', paid_at = now(), payment_method = p_method, payment_reference = p_reference,
         babalawo_amount = v_baba, updated_at = now(),
         attendance = CASE WHEN p_attendance = 'present' THEN 'present' ELSE 'absent' END
   WHERE id = p_id;
  PERFORM _ebo_ritual_session(p_id);
  INSERT INTO payments(user_id, session_id, ebo_id, amount, commission_amount, babalawo_amount, payment_gateway,
                       payment_reference, status, webhook_verified, gateway_transaction_id, commission_platform_percent)
  VALUES (e.client_id, NULL, p_id, e.amount_due, e.platform_fee, v_baba, p_method, p_reference, 'completed',
          p_verified OR p_method = 'wallet', p_gateway_tx, e.platform_fee_percent);
  IF v_baba > 0 THEN
    INSERT INTO babalawo_ledger(babalawo_id, entry_type, amount, ebo_id, session_id, note)
      VALUES (e.babalawo_id, 'ebo_earning', v_baba, p_id, NULL, 'Ebo paid, held until proof');
    INSERT INTO babalawo_wallets(babalawo_id) VALUES (e.babalawo_id) ON CONFLICT (babalawo_id) DO NOTHING;
    PERFORM _bparts_use((SELECT provider_parts FROM payments WHERE ebo_id = p_id));
    UPDATE babalawo_wallets SET pending_balance = pending_balance + v_baba, lifetime_earned = lifetime_earned + v_baba,
           updated_at = now() WHERE babalawo_id = e.babalawo_id;
  END IF;
  PERFORM _ebo_log(p_id, 'paid', jsonb_build_object('method', p_method, 'reference', p_reference, 'total', e.total, 'attendance', p_attendance,
          'platform_fee', e.platform_fee, 'amount_due', e.amount_due, 'babalawo_amount', v_baba));
  PERFORM create_notification(e.babalawo_id, 'ebo_paid', 'Ebo paid: ' || _ebo_money(e.total),
          e.title || CASE WHEN p_attendance = 'present' THEN '. The client will join live.' ELSE '. The client will not attend: record a video naming them, with the items and prayers.' END
          || ' Mark it started when you buy the items; the item money is released to you then.',
          jsonb_build_object('ebo_id', p_id, 'action_url', '/dashboard'), 'high');
  PERFORM _ebo_outbox(p_id, 'ebo_paid');
END $$;

CREATE OR REPLACE FUNCTION public._ebo_release(p_id uuid, p_kind text, p_amount numeric, p_note text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e ebo_prescriptions%ROWTYPE;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN 0; END IF;
  SELECT * INTO e FROM ebo_prescriptions WHERE id = p_id;
  INSERT INTO babalawo_ledger(babalawo_id, entry_type, amount, ebo_id, note)
    VALUES (e.babalawo_id, p_kind, p_amount, p_id, p_note) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN 0; END IF;
  PERFORM _bparts_use((SELECT provider_parts FROM payments WHERE ebo_id = p_id));
  UPDATE babalawo_wallets SET pending_balance = pending_balance - p_amount, available_balance = available_balance + p_amount,
         updated_at = now() WHERE babalawo_id = e.babalawo_id;
  RETURN p_amount;
END $$;

CREATE OR REPLACE FUNCTION public._ebo_refund(p_id uuid, p_mode text, p_reason text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e ebo_prescriptions%ROWTYPE; v_held numeric; v_refund numeric; v_take_back numeric := 0;
BEGIN
  SELECT * INTO e FROM ebo_prescriptions WHERE id = p_id FOR UPDATE;
  IF e.paid_at IS NULL OR e.status NOT IN ('paid','in_progress','performed','disputed') THEN
    RAISE EXCEPTION 'This Ebo has no refundable payment';
  END IF;
  v_held := COALESCE(e.babalawo_amount, 0) - e.items_released;
  IF p_mode = 'full' THEN
    v_refund := e.amount_due - e.refunded_amount;
    v_take_back := e.items_released;
  ELSIF p_mode = 'held' THEN
    v_refund := v_held;
  ELSE RAISE EXCEPTION 'Unknown refund mode'; END IF;

  IF v_held + v_take_back > 0 THEN
    INSERT INTO babalawo_ledger(babalawo_id, entry_type, amount, ebo_id, note)
      VALUES (e.babalawo_id, 'ebo_reversal', v_held + v_take_back, p_id, p_reason);
    PERFORM _bparts_use((SELECT provider_parts FROM payments WHERE ebo_id = p_id));
    UPDATE babalawo_wallets SET pending_balance = pending_balance - v_held,
           lifetime_earned = lifetime_earned - (v_held + v_take_back), updated_at = now() WHERE babalawo_id = e.babalawo_id;
    IF v_take_back > 0 THEN
      PERFORM _bparts_use((SELECT provider_parts FROM payments WHERE ebo_id = p_id));
      UPDATE babalawo_wallets SET available_balance = available_balance - v_take_back
       WHERE babalawo_id = e.babalawo_id AND available_balance >= v_take_back;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'The Babalawo has already withdrawn the item money. Refund what is still held instead, or adjust manually.';
      END IF;
    END IF;
  END IF;
  IF v_refund > 0 THEN
    PERFORM _wallet_apply(e.client_id, v_refund, 'credit', 'refund', NULL, e.payment_reference,
                          'Ebo refund: ' || COALESCE(p_reason, e.title), 'ebo-refund-' || p_id);
  END IF;
  UPDATE payments SET refunded_amount = refunded_amount + v_refund,
         status = CASE WHEN p_mode = 'full' THEN 'refunded' ELSE status END, updated_at = now()
   WHERE ebo_id = p_id;
  PERFORM _ebo_drop_ritual_session(p_id);
  UPDATE ebo_prescriptions SET status = 'refunded', refunded_amount = refunded_amount + v_refund,
         items_released = items_released - v_take_back, cancelled_at = now(), cancel_reason = p_reason, updated_at = now()
   WHERE id = p_id;
  IF v_refund > 0 THEN
    INSERT INTO refunds(payment_id, amount, reason, status, processed_by)
      SELECT id, v_refund, p_reason, 'completed', auth.uid() FROM payments WHERE ebo_id = p_id;
  END IF;
  PERFORM _ebo_log(p_id, 'refunded', jsonb_build_object('mode', p_mode, 'amount', v_refund, 'reason', p_reason));
  PERFORM create_notification(e.client_id, 'ebo_refunded', 'Ebo refunded: ' || _ebo_money(v_refund),
          e.title || '. The money is in your IFA wallet.', jsonb_build_object('ebo_id', p_id, 'action_url', '/dashboard?tab=records'), 'high');
  PERFORM create_notification(e.babalawo_id, 'ebo_refunded', 'Ebo refunded to the client', e.title || ': ' || COALESCE(p_reason, ''),
          jsonb_build_object('ebo_id', p_id, 'action_url', '/dashboard'), 'normal');
  RETURN v_refund;
END $$;

CREATE OR REPLACE FUNCTION public.request_withdrawal(p_amount numeric, p_reason text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid; v_bank jsonb; v_parts jsonb; v_min numeric := get_setting_numeric('min_withdrawal_amount', 5000);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF public.is_suspended(v_uid) THEN RAISE EXCEPTION 'Your account is suspended'; END IF;
  IF NOT EXISTS (SELECT 1 FROM babalawos WHERE user_id = v_uid) THEN RAISE EXCEPTION 'Only babalawos can withdraw'; END IF;
  IF p_amount IS NULL OR p_amount < v_min THEN RAISE EXCEPTION 'Minimum withdrawal is %', v_min; END IF;
  SELECT to_jsonb(b) - 'id' - 'babalawo_id' INTO v_bank FROM babalawo_bank_details b
    WHERE b.babalawo_id = v_uid ORDER BY b.updated_at DESC NULLS LAST LIMIT 1;
  IF v_bank IS NULL THEN RAISE EXCEPTION 'Add your bank details first'; END IF;
  v_parts := _babalawo_withdrawal_split(v_uid, p_amount);
  PERFORM _bparts_use(v_parts);
  UPDATE babalawo_wallets SET available_balance = available_balance - p_amount, held_balance = held_balance + p_amount,
         updated_at = now() WHERE babalawo_id = v_uid AND available_balance >= p_amount;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient available balance'; END IF;
  INSERT INTO withdrawal_requests(babalawo_id, amount, status, reason, bank_snapshot, provider_parts)
    VALUES (v_uid, p_amount, 'pending', COALESCE(p_reason, 'Regular withdrawal'), v_bank, v_parts) RETURNING id INTO v_id;
  INSERT INTO babalawo_ledger(babalawo_id, entry_type, amount, withdrawal_id, note) VALUES (v_uid, 'withdrawal_hold', p_amount, v_id, 'Withdrawal requested');
  PERFORM create_notification(v_uid, 'withdrawal_requested', 'Withdrawal requested', 'We will process it shortly.', jsonb_build_object('withdrawal_id', v_id), 'normal');
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_process_withdrawal(
  p_id uuid,
  p_action text,
  p_reference text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.withdrawal_requests%ROWTYPE;
  v_reference text := NULLIF(btrim(p_reference), '');
  v_notification_action text := p_action;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;

  SELECT * INTO w FROM public.withdrawal_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;

  IF p_action = 'approve' THEN
    IF w.status <> 'pending' THEN RAISE EXCEPTION 'Only pending requests can be approved'; END IF;
    UPDATE public.withdrawal_requests
       SET status = 'approved', processed_by = auth.uid(), processed_at = now(), admin_note = p_note
     WHERE id = p_id;
  ELSIF p_action = 'reject' THEN
    IF w.status NOT IN ('pending', 'approved') THEN RAISE EXCEPTION 'Cannot reject a % request', w.status; END IF;
    IF p_note IS NULL OR length(btrim(p_note)) < 3 THEN RAISE EXCEPTION 'A rejection reason is required'; END IF;
    PERFORM public._bparts_use(w.provider_parts);
    UPDATE public.babalawo_wallets
       SET held_balance = held_balance - w.amount, available_balance = available_balance + w.amount,
           updated_at = now()
     WHERE babalawo_id = w.babalawo_id;
    INSERT INTO public.babalawo_ledger(babalawo_id, entry_type, amount, withdrawal_id, note)
      VALUES (w.babalawo_id, 'withdrawal_reject', w.amount, p_id, btrim(p_note));
    UPDATE public.withdrawal_requests
       SET status = 'rejected', processed_by = auth.uid(), processed_at = now(), admin_note = btrim(p_note)
     WHERE id = p_id;
  ELSIF p_action = 'mark_paid' THEN
    IF w.status <> 'approved' THEN RAISE EXCEPTION 'Only approved requests can be paid'; END IF;
    IF v_reference IS NULL THEN RAISE EXCEPTION 'A bank transfer reference is required'; END IF;
    PERFORM public._bparts_use(w.provider_parts);
    UPDATE public.babalawo_wallets
       SET held_balance = held_balance - w.amount, lifetime_paid_out = lifetime_paid_out + w.amount,
           updated_at = now()
     WHERE babalawo_id = w.babalawo_id;
    INSERT INTO public.babalawo_ledger(babalawo_id, entry_type, amount, withdrawal_id, note)
      VALUES (w.babalawo_id, 'withdrawal_paid', w.amount, p_id, v_reference);
    INSERT INTO public.payouts(babalawo_id, amount, method, reference, status)
      VALUES (w.babalawo_id, w.amount, 'bank_transfer', v_reference, 'paid');
    UPDATE public.withdrawal_requests
       SET status = 'completed', payout_reference = v_reference, processed_by = auth.uid(), processed_at = now(), admin_note = p_note
     WHERE id = p_id;
    v_notification_action := 'paid';
  ELSE
    RAISE EXCEPTION 'Unknown action %', p_action;
  END IF;

  PERFORM public.create_notification(
    w.babalawo_id,
    'withdrawal_' || v_notification_action,
    'Withdrawal update',
    'Your withdrawal request was updated: ' || v_notification_action || '.',
    jsonb_build_object('withdrawal_id', p_id),
    'normal'
  );
END;
$$;

-- What the platform owes, per provider: client wallets, Babalawo money not yet paid out, and
-- withdrawals waiting. The provider balance minus this is the platform's own money.
CREATE OR REPLACE FUNCTION public.admin_provider_liabilities()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501'; END IF;
  RETURN (
    SELECT jsonb_object_agg(p.provider, jsonb_build_object(
      'client_wallets', COALESCE((SELECT sum(balance) FROM wallet_parts w WHERE w.provider = p.provider), 0),
      'babalawo_pending', COALESCE((SELECT sum(pending) FROM babalawo_balance_parts b WHERE b.provider = p.provider), 0),
      'babalawo_available', COALESCE((SELECT sum(available) FROM babalawo_balance_parts b WHERE b.provider = p.provider), 0),
      'babalawo_held', COALESCE((SELECT sum(held) FROM babalawo_balance_parts b WHERE b.provider = p.provider), 0),
      'paid_out', COALESCE((SELECT sum(paid_out) FROM babalawo_balance_parts b WHERE b.provider = p.provider), 0),
      'collected', COALESCE((SELECT sum((pay.provider_parts->>p.provider)::numeric) FROM payments pay
                               WHERE pay.status IN ('completed', 'refunded')), 0),
      'fees_paid_by_clients', COALESCE((SELECT sum(i.provider_fee) FROM payment_intents i
                               WHERE i.gateway = p.provider AND i.status = 'succeeded'), 0)))
      FROM (VALUES ('paystack'), ('flutterwave')) p(provider));
END $$;

DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname IN (
              '_split', '_parts_add', '_parts_total', '_bparts_use', '_wallet_apply', 'set_payment_provider_parts',
              'record_provider_fee', 'babalawo_wallet_parts_sync', '_babalawo_withdrawal_split',
              'check_wallet_parts', 'check_babalawo_parts', '_babalawo_escrow_credit', 'release_held_earnings',
              '_refund_session', '_ebo_mark_paid', '_ebo_release', '_ebo_refund')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.admin_adjust_wallet(uuid, numeric, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_wallet(uuid, numeric, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_provider_liabilities() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_provider_liabilities() TO authenticated;
