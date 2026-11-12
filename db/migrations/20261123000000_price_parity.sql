-- Price parity: Nigerians pay in naira, the diaspora pays an admin-set price in US dollars.
--
-- Alex (12 Nov 2026): clients in Nigeria (by IP or phone number) see naira; everyone abroad sees a
-- USD price set in Admin, because reaching overseas clients costs more. Dollar payments are taken
-- by Flutterwave only (it can pay naira transfers from its USD balance; Paystack settles USD to a
-- dollar bank account). The Babalawo earns the same naira share as from a Nigerian client; the
-- dollar premium stays with the platform.
--
-- Who pays in which currency (_client_currency):
--   * an admin override on the profile wins;
--   * a wallet holding money keeps its currency (no mixing currencies in one wallet);
--   * otherwise USD when the request comes from outside Nigeria (by IP), or the phone number is
--     not +234; NGN when both point to Nigeria (or are unknown).
--
-- Books stay in naira: payments.amount and sessions.amount are the naira value (dollars x the
-- admin rate at the time); payments.paid_amount / currency say what the client actually paid.
-- A quote (payment_quotes) records the agreed price in the client's currency for each payment
-- reference; triggers on payments and sessions apply it, so the booking functions are unchanged.

INSERT INTO public.admin_settings(setting_key, setting_value, description, is_public) VALUES
  ('usd_pricing_enabled', 'true', 'Charge clients outside Nigeria in US dollars', true),
  ('usd_ngn_rate', '1600', 'Naira per US dollar used for diaspora prices and the books', true),
  ('usd_price_multiplier', '1.5', 'Diaspora consultation price = naira price / rate x this, unless set per Babalawo', true),
  ('usd_price_round_to', '5', 'Round diaspora consultation prices up to a multiple of this many dollars', true),
  ('ebo_usd_multiplier', '1', 'Diaspora Ebo price = naira amount due / rate x this', true),
  ('min_wallet_topup_usd', '5', 'Smallest wallet top-up in US dollars', true),
  ('min_card_payment_usd', '1', 'Smallest card part (USD) when the wallet pays the rest', true),
  -- For the fee estimate shown at checkout only: the provider adds its real fee on its own page.
  ('paystack_fee_flat', '100', 'Paystack flat fee (naira) added to the percentage, estimate only', true),
  ('paystack_fee_flat_waived_below', '2500', 'Paystack waives its flat fee below this amount (naira), estimate only', true),
  ('flutterwave_usd_fee_percent', '4.8', 'Flutterwave fee on dollar card payments (%), estimate only', true)
ON CONFLICT (setting_key) DO NOTHING;

-- ------------------------------------------------------------------ columns
ALTER TABLE public.babalawos ADD COLUMN IF NOT EXISTS usd_session_price numeric(10,2) CHECK (usd_session_price IS NULL OR usd_session_price > 0);
ALTER TABLE public.babalawos ADD COLUMN IF NOT EXISTS usd_instant_price numeric(10,2) CHECK (usd_instant_price IS NULL OR usd_instant_price > 0);
COMMENT ON COLUMN public.babalawos.usd_session_price IS 'Admin-set diaspora price (USD). Empty: derived from the naira price.';

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pricing_currency text CHECK (pricing_currency IN ('NGN', 'USD'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pricing_currency_override text CHECK (pricing_currency_override IN ('NGN', 'USD'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_ip_country text;
COMMENT ON COLUMN public.profiles.pricing_currency IS 'Currency of the last price this person was charged in.';

ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'NGN' CHECK (currency IN ('NGN', 'USD'));
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS currency text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS paid_amount numeric(12,2);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS fx_rate numeric(12,4);
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'NGN';
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS paid_amount numeric(12,2);
ALTER TABLE public.ebo_prescriptions ADD COLUMN IF NOT EXISTS paid_currency text;
ALTER TABLE public.ebo_prescriptions ADD COLUMN IF NOT EXISTS paid_amount numeric(12,2);
COMMENT ON COLUMN public.payments.amount IS 'Naira value of the payment (for USD: paid_amount x fx_rate).';
COMMENT ON COLUMN public.payments.paid_amount IS 'What the client paid, in payments.currency.';

-- The price agreed for one payment reference, in the client's currency.
CREATE TABLE IF NOT EXISTS public.payment_quotes (
  reference text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency text NOT NULL CHECK (currency IN ('NGN', 'USD')),
  paid_amount numeric(12,2) NOT NULL CHECK (paid_amount > 0),
  fx_rate numeric(12,4) NOT NULL DEFAULT 1,
  ngn_amount numeric(12,2) NOT NULL,
  babalawo_ngn numeric(12,2),     -- the Babalawo's naira share when it is not the usual split
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read own quotes" ON public.payment_quotes;
CREATE POLICY "Read own quotes" ON public.payment_quotes FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
REVOKE INSERT, UPDATE, DELETE ON public.payment_quotes FROM anon, authenticated;

-- Babalawos cannot set their own diaspora price.
CREATE OR REPLACE FUNCTION public.guard_babalawo_usd_price()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin()
     AND (NEW.usd_session_price IS DISTINCT FROM OLD.usd_session_price OR NEW.usd_instant_price IS DISTINCT FROM OLD.usd_instant_price) THEN
    RAISE EXCEPTION 'Diaspora prices are set by the admin';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_babalawo_usd_price ON public.babalawos;
CREATE TRIGGER trg_guard_babalawo_usd_price BEFORE UPDATE ON public.babalawos
  FOR EACH ROW EXECUTE FUNCTION public.guard_babalawo_usd_price();

-- Profiles: only an admin changes the currency override.
CREATE OR REPLACE FUNCTION public.guard_profile_pricing()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin()
     AND (NEW.pricing_currency_override IS DISTINCT FROM OLD.pricing_currency_override
          OR NEW.pricing_currency IS DISTINCT FROM OLD.pricing_currency
          OR NEW.last_ip_country IS DISTINCT FROM OLD.last_ip_country) THEN
    RAISE EXCEPTION 'Pricing currency is decided by IFA.ng';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_profile_pricing ON public.profiles;
CREATE TRIGGER trg_guard_profile_pricing BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_pricing();

-- ------------------------------------------------------------------ prices
CREATE OR REPLACE FUNCTION public.usd_rate() RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT GREATEST(public.get_setting_numeric('usd_ngn_rate', 1600), 1)
$$;

-- Diaspora consultation price for a Babalawo: the admin's price, or the naira price converted,
-- multiplied and rounded up.
CREATE OR REPLACE FUNCTION public.get_session_price_usd(p_babalawo_user_id uuid, p_is_instant boolean DEFAULT false)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_set numeric; v_round numeric := GREATEST(get_setting_numeric('usd_price_round_to', 5), 0.01);
BEGIN
  SELECT COALESCE(CASE WHEN p_is_instant THEN b.usd_instant_price END, b.usd_session_price)
    INTO v_set FROM babalawos b WHERE b.user_id = p_babalawo_user_id;
  IF v_set IS NOT NULL THEN RETURN v_set; END IF;
  RETURN ceil(get_session_price(p_babalawo_user_id, p_is_instant) / usd_rate()
              * get_setting_numeric('usd_price_multiplier', 1.5) / v_round) * v_round;
END $$;

CREATE OR REPLACE FUNCTION public.ebo_amount_usd(p_amount_due numeric)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ceil(p_amount_due / public.usd_rate() * public.get_setting_numeric('ebo_usd_multiplier', 1) * 100) / 100
$$;

-- Which currency this person pays in. p_ip_country: ISO code of the request, if known.
CREATE OR REPLACE FUNCTION public._client_currency(p_user uuid, p_ip_country text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_override text; v_last text; v_wallet record; v_phone text; v_ip text := upper(NULLIF(btrim(p_ip_country), ''));
BEGIN
  IF p_user IS NOT NULL THEN
    SELECT pricing_currency_override, last_ip_country INTO v_override, v_last FROM profiles WHERE id = p_user;
    v_ip := COALESCE(v_ip, v_last);
    IF v_override IS NOT NULL THEN RETURN v_override; END IF;
    SELECT currency, balance INTO v_wallet FROM wallets WHERE user_id = p_user;
    IF COALESCE(v_wallet.balance, 0) > 0 THEN RETURN v_wallet.currency; END IF;
    SELECT NULLIF(btrim(phone), '') INTO v_phone FROM auth.users WHERE id = p_user;
  END IF;
  IF COALESCE((SELECT setting_value FROM admin_settings WHERE setting_key = 'usd_pricing_enabled'), 'true') <> 'true' THEN
    RETURN 'NGN';
  END IF;
  IF v_ip IS NOT NULL AND v_ip NOT IN ('NG', 'XX', 'T1') THEN RETURN 'USD'; END IF;
  IF v_phone IS NOT NULL AND regexp_replace(v_phone, '[^0-9+]', '', 'g') !~ '^(\+?234|0[789])' THEN RETURN 'USD'; END IF;
  RETURN 'NGN';
END $$;

-- What the app shows: the currency, and the numbers needed to show diaspora prices.
CREATE OR REPLACE FUNCTION public.pricing_for(p_user uuid, p_ip_country text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN jsonb_build_object(
    'currency', _client_currency(p_user, p_ip_country),
    'usd_ngn_rate', usd_rate(),
    'ebo_usd_multiplier', get_setting_numeric('ebo_usd_multiplier', 1),
    'min_wallet_topup', CASE WHEN _client_currency(p_user, p_ip_country) = 'USD'
                             THEN get_setting_numeric('min_wallet_topup_usd', 5) ELSE get_setting_numeric('min_wallet_topup', 100) END,
    'wallet_currency', (SELECT currency FROM wallets WHERE user_id = p_user));
END $$;

-- Remember where a signed-in person last paid from, and in which currency.
CREATE OR REPLACE FUNCTION public._remember_pricing(p_user uuid, p_ip_country text, p_currency text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE profiles SET pricing_currency = p_currency,
         last_ip_country = COALESCE(upper(NULLIF(btrim(p_ip_country), '')), last_ip_country)
   WHERE id = p_user;
  -- An empty wallet follows the person's currency; a wallet with money keeps its own.
  INSERT INTO wallets(user_id, currency) VALUES (p_user, p_currency) ON CONFLICT (user_id) DO NOTHING;
  UPDATE wallets SET currency = p_currency WHERE user_id = p_user AND balance = 0 AND currency <> p_currency;
END $$;

-- Record the agreed price for a payment reference.
CREATE OR REPLACE FUNCTION public._quote(p_reference text, p_user uuid, p_currency text, p_paid numeric, p_babalawo_ngn numeric DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rate numeric := CASE WHEN p_currency = 'USD' THEN usd_rate() ELSE 1 END;
BEGIN
  INSERT INTO payment_quotes(reference, user_id, currency, paid_amount, fx_rate, ngn_amount, babalawo_ngn)
  VALUES (p_reference, p_user, p_currency, p_paid, v_rate, round(p_paid * v_rate, 2), p_babalawo_ngn)
  ON CONFLICT (reference) DO NOTHING;
END $$;

-- The Babalawo's naira share of a consultation, the same whoever the client is.
CREATE OR REPLACE FUNCTION public._babalawo_session_share(p_babalawo uuid, p_is_instant boolean)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plat numeric; v_baba numeric;
BEGIN
  SELECT COALESCE(commission_platform_percent, 20), COALESCE(commission_babalawo_percent, 80)
    INTO v_plat, v_baba FROM babalawos WHERE user_id = p_babalawo;
  v_plat := COALESCE(v_plat, 20); v_baba := COALESCE(v_baba, 80);
  IF v_plat + v_baba <> 100 THEN v_baba := 80; END IF;
  RETURN get_session_price(p_babalawo, p_is_instant) - round(get_session_price(p_babalawo, p_is_instant) * (100 - v_baba) / 100, 2);
END $$;

-- ---------------------------------------------------- quotes become money
CREATE OR REPLACE FUNCTION public.apply_payment_quote()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q payment_quotes%ROWTYPE;
BEGIN
  SELECT * INTO q FROM payment_quotes WHERE reference = NEW.payment_reference;
  IF NOT FOUND OR q.currency = 'NGN' THEN
    NEW.paid_amount := COALESCE(NEW.paid_amount, NEW.amount);
    NEW.currency := COALESCE(NEW.currency, 'NGN');
    RETURN NEW;
  END IF;
  NEW.currency := q.currency;
  NEW.paid_amount := q.paid_amount;
  NEW.fx_rate := q.fx_rate;
  NEW.amount := q.ngn_amount;
  NEW.babalawo_amount := COALESCE(q.babalawo_ngn, NEW.babalawo_amount);
  NEW.commission_amount := NEW.amount - COALESCE(NEW.babalawo_amount, 0);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_payment_currency ON public.payments;
CREATE TRIGGER trg_payment_currency BEFORE INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.apply_payment_quote();

CREATE OR REPLACE FUNCTION public.apply_session_quote()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q payment_quotes%ROWTYPE;
BEGIN
  SELECT * INTO q FROM payment_quotes WHERE reference = NEW.payment_reference;
  IF FOUND AND q.currency <> 'NGN' THEN
    NEW.currency := q.currency;
    NEW.paid_amount := q.paid_amount;
    NEW.amount := q.ngn_amount;
  ELSE
    NEW.paid_amount := COALESCE(NEW.paid_amount, NEW.amount);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_session_currency ON public.sessions;
CREATE TRIGGER trg_session_currency BEFORE INSERT ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.apply_session_quote();

-- Provider parts weigh the card part against wallet spending in the currency actually paid.
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
  v_card := COALESCE(NEW.paid_amount, NEW.amount, 0) - _parts_total(v_wallet);
  IF v_card > 0 THEN
    IF NEW.payment_gateway NOT IN ('paystack', 'flutterwave') THEN
      RAISE EXCEPTION 'Payment % has % not covered by the wallet and no card provider', NEW.payment_reference, v_card;
    END IF;
    v_wallet := _parts_add(v_wallet, jsonb_build_object(NEW.payment_gateway, v_card));
  END IF;
  NEW.provider_parts := NULLIF(v_wallet, '{}'::jsonb);
  RETURN NEW;
END $$;

-- Wallet rows record their currency.
CREATE OR REPLACE FUNCTION public.stamp_wallet_tx_currency()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.currency := COALESCE(NEW.currency, (SELECT currency FROM wallets WHERE id = NEW.wallet_id), 'NGN');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_wallet_tx_currency ON public.wallet_transactions;
CREATE TRIGGER trg_wallet_tx_currency BEFORE INSERT ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.stamp_wallet_tx_currency();

-- The naira part of a payment expressed in what the client paid (for refunds to the wallet).
CREATE OR REPLACE FUNCTION public._in_paid_currency(p_payment_reference text, p_ngn numeric)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT CASE WHEN p.currency = 'NGN' OR p.amount = 0 THEN p_ngn
                               ELSE round(p_ngn * p.paid_amount / p.amount, 2) END
                     FROM payments p WHERE p.payment_reference = p_payment_reference LIMIT 1), p_ngn)
$$;

-- --------------------------------------------- wallet share by currency
CREATE OR REPLACE FUNCTION public._wallet_share(p_user uuid, p_total numeric)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_bal numeric; v_cur text; v_min numeric;
BEGIN
  SELECT balance, currency INTO v_bal, v_cur FROM wallets WHERE user_id = p_user;
  v_min := CASE WHEN v_cur = 'USD' THEN get_setting_numeric('min_card_payment_usd', 1) ELSE get_setting_numeric('min_card_payment', 100) END;
  v_bal := COALESCE(v_bal, 0);
  IF v_bal >= p_total THEN
    RAISE EXCEPTION 'Your wallet already covers this. Choose Pay from wallet.';
  END IF;
  RETURN GREATEST(0, LEAST(v_bal, p_total - v_min));
END $$;

-- ------------------------------------------------- creating a card payment
DROP FUNCTION IF EXISTS public.create_payment_intent(uuid, text, text, numeric, uuid, date, text, boolean, uuid, text, boolean);
CREATE OR REPLACE FUNCTION public.create_payment_intent(
  p_user uuid, p_kind text, p_gateway text, p_amount numeric DEFAULT NULL,
  p_babalawo_user_id uuid DEFAULT NULL, p_session_date date DEFAULT NULL, p_start_time text DEFAULT NULL,
  p_is_instant boolean DEFAULT false, p_ebo_id uuid DEFAULT NULL, p_ebo_attendance text DEFAULT NULL,
  p_use_wallet boolean DEFAULT false, p_ip_country text DEFAULT NULL)
RETURNS TABLE(reference text, amount numeric, wallet_amount numeric, total numeric, currency text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_amt numeric; v_wal numeric := 0; v_ref text; e ebo_prescriptions%ROWTYPE; v_cur text; v_baba_ngn numeric;
        v_wallet_cur text; v_wallet_bal numeric;
BEGIN
  IF public.is_suspended(p_user) THEN RAISE EXCEPTION 'Your account is suspended'; END IF;
  v_cur := _client_currency(p_user, p_ip_country);
  SELECT w.currency, w.balance INTO v_wallet_cur, v_wallet_bal FROM wallets w WHERE w.user_id = p_user;
  IF COALESCE(v_wallet_bal, 0) > 0 AND v_wallet_cur <> v_cur THEN
    RAISE EXCEPTION 'Your wallet holds % but this payment is in %. Please contact support.', v_wallet_cur, v_cur;
  END IF;
  IF v_cur = 'USD' AND p_gateway <> 'flutterwave' THEN
    RAISE EXCEPTION 'Payments in US dollars go through Flutterwave';
  END IF;

  IF p_kind = 'wallet_topup' THEN
    v_amt := p_amount;
    IF v_cur = 'USD' THEN
      IF v_amt IS NULL OR v_amt < get_setting_numeric('min_wallet_topup_usd', 5) OR v_amt > 5000 THEN
        RAISE EXCEPTION 'Invalid top-up amount';
      END IF;
    ELSIF v_amt IS NULL OR v_amt < get_setting_numeric('min_wallet_topup', 100) OR v_amt > 5000000 THEN
      RAISE EXCEPTION 'Invalid top-up amount';
    END IF;
  ELSIF p_kind = 'session' THEN
    IF p_user = p_babalawo_user_id THEN RAISE EXCEPTION 'You cannot book yourself'; END IF;
    IF NOT EXISTS (SELECT 1 FROM babalawos WHERE user_id = p_babalawo_user_id AND COALESCE(is_active, true)) THEN
      RAISE EXCEPTION 'Babalawo not available';
    END IF;
    IF p_session_date IS NULL OR p_start_time IS NULL THEN RAISE EXCEPTION 'Date and time required'; END IF;
    PERFORM _assert_bookable(p_babalawo_user_id, p_session_date, p_start_time, COALESCE(p_is_instant, false));
    IF v_cur = 'USD' THEN
      v_amt := get_session_price_usd(p_babalawo_user_id, p_is_instant);
      v_baba_ngn := _babalawo_session_share(p_babalawo_user_id, COALESCE(p_is_instant, false));
    ELSE
      v_amt := get_session_price(p_babalawo_user_id, p_is_instant);
    END IF;
  ELSIF p_kind = 'ebo' THEN
    SELECT * INTO e FROM ebo_prescriptions WHERE id = p_ebo_id;
    IF NOT FOUND OR e.client_id IS DISTINCT FROM p_user OR e.status = 'draft' THEN RAISE EXCEPTION 'Ebo not found'; END IF;
    IF e.status <> 'sent' OR e.performed_by <> 'babalawo' THEN RAISE EXCEPTION 'This Ebo is not waiting for payment'; END IF;
    IF e.expires_at IS NOT NULL AND e.expires_at < now() THEN RAISE EXCEPTION 'This quote has expired. Ask your Babalawo to renew it.'; END IF;
    IF COALESCE(p_ebo_attendance, '') NOT IN ('present','absent') THEN RAISE EXCEPTION 'Choose whether you will join the ritual'; END IF;
    v_amt := CASE WHEN v_cur = 'USD' THEN ebo_amount_usd(e.amount_due) ELSE e.amount_due END;
  ELSE RAISE EXCEPTION 'Bad kind'; END IF;

  PERFORM _remember_pricing(p_user, p_ip_country, v_cur);
  IF COALESCE(p_use_wallet, false) AND p_kind IN ('session', 'ebo') THEN
    v_wal := _wallet_share(p_user, v_amt);
  END IF;

  v_ref := 'IFANG-' || upper(left(p_gateway, 3)) || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));
  INSERT INTO payment_intents(user_id, kind, gateway, reference, amount, wallet_amount, currency, babalawo_user_id, session_date,
                              start_time, is_instant, ebo_id, ebo_attendance)
  VALUES (p_user, p_kind, p_gateway, v_ref, v_amt - v_wal, v_wal, v_cur,
          CASE WHEN p_kind = 'ebo' THEN e.babalawo_id ELSE p_babalawo_user_id END,
          p_session_date, p_start_time, COALESCE(p_is_instant, false), CASE WHEN p_kind = 'ebo' THEN p_ebo_id END,
          CASE WHEN p_kind = 'ebo' THEN p_ebo_attendance END);
  IF p_kind <> 'wallet_topup' THEN
    PERFORM _quote(v_ref, p_user, v_cur, v_amt, v_baba_ngn);
  END IF;
  RETURN QUERY SELECT v_ref, v_amt - v_wal, v_wal, v_amt, v_cur;
END $$;

-- ------------------------------------------------------- paying by wallet
CREATE OR REPLACE FUNCTION public.book_session_with_wallet(
  p_babalawo_user_id uuid, p_session_date date, p_start_time text, p_is_instant boolean DEFAULT false,
  p_idempotency_key text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_price numeric; v_existing bigint; v_ref text; v_cur text;
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
  -- The wallet pays in its own currency.
  SELECT currency INTO v_cur FROM wallets WHERE user_id = v_user;
  v_cur := COALESCE(v_cur, 'NGN');
  v_ref := 'WAL-' || replace(gen_random_uuid()::text, '-', '');
  IF v_cur = 'USD' THEN
    v_price := get_session_price_usd(p_babalawo_user_id, p_is_instant);
    PERFORM _quote(v_ref, v_user, 'USD', v_price, _babalawo_session_share(p_babalawo_user_id, COALESCE(p_is_instant, false)));
  ELSE
    v_price := get_session_price(p_babalawo_user_id, p_is_instant);
  END IF;
  PERFORM _wallet_apply(v_user, v_price, 'debit', 'session_payment', NULL, v_ref, 'Consultation session payment');
  v_existing := _create_paid_session(v_user, p_babalawo_user_id, p_session_date, p_start_time, p_is_instant, v_price, 'wallet', v_ref);
  UPDATE sessions SET idempotency_key = p_idempotency_key WHERE id = v_existing AND p_idempotency_key IS NOT NULL;
  RETURN v_existing;   -- any failure above aborts the whole transaction, so the debit rolls back with it
END $$;

CREATE OR REPLACE FUNCTION public.pay_ebo_with_wallet(p_id uuid, p_attendance text DEFAULT 'absent')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); e ebo_prescriptions%ROWTYPE; v_ref text; v_cur text; v_amt numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF public.is_suspended(v_uid) THEN RAISE EXCEPTION 'Your account is suspended'; END IF;
  SELECT * INTO e FROM ebo_prescriptions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR e.client_id IS DISTINCT FROM v_uid OR e.status = 'draft' THEN RAISE EXCEPTION 'Ebo not found'; END IF;
  IF e.status <> 'sent' OR e.performed_by <> 'babalawo' THEN RAISE EXCEPTION 'This Ebo is not waiting for payment'; END IF;
  IF e.expires_at IS NOT NULL AND e.expires_at < now() THEN RAISE EXCEPTION 'This quote has expired. Ask your Babalawo to renew it.'; END IF;
  IF p_attendance NOT IN ('present','absent') THEN RAISE EXCEPTION 'Choose whether you will join the ritual'; END IF;
  SELECT currency INTO v_cur FROM wallets WHERE user_id = v_uid;
  v_cur := COALESCE(v_cur, 'NGN');
  v_ref := 'EBO-WAL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));
  v_amt := CASE WHEN v_cur = 'USD' THEN ebo_amount_usd(e.amount_due) ELSE e.amount_due END;
  IF v_cur = 'USD' THEN PERFORM _quote(v_ref, v_uid, 'USD', v_amt); END IF;
  PERFORM _wallet_apply(v_uid, v_amt, 'debit', 'ebo_payment', NULL, v_ref, 'Ebo: ' || e.title, 'ebo-pay-' || p_id);
  PERFORM _ebo_mark_paid(p_id, 'wallet', v_ref, NULL, true, p_attendance);
END $$;

-- ---------------------------------------------------------------- listing
DROP FUNCTION IF EXISTS public.get_public_babalawos();
CREATE OR REPLACE FUNCTION public.get_public_babalawos()
RETURNS TABLE(id uuid, full_name text, avatar_url text, specialties text[], experience_years integer,
              hourly_rate numeric, bio text, verification_status text, rating real, total_sessions integer,
              languages text[], timezone text, is_active boolean, is_featured boolean, current_status text,
              session_price numeric, instant_price numeric, usd_price numeric, usd_instant_price numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.user_id, p.full_name, COALESCE(NULLIF(b.profile_picture_url, ''), p.avatar_url), b.specialties,
         b.experience_years, b.hourly_rate, b.bio,
         CASE WHEN b.is_verified THEN 'approved' ELSE 'pending' END,
         b.rating, b.total_sessions, b.languages, b.timezone, b.is_active,
         COALESCE(b.is_featured, false), COALESCE(b.current_status, 'offline'),
         public.get_session_price(b.user_id, false), public.get_session_price(b.user_id, true),
         public.get_session_price_usd(b.user_id, false), public.get_session_price_usd(b.user_id, true)
  FROM public.babalawos b
  JOIN public.profiles p ON p.id = b.user_id
  WHERE b.is_verified AND COALESCE(b.is_active, true) AND public._babalawo_listed(b.user_id)
$$;
GRANT EXECUTE ON FUNCTION public.get_public_babalawos() TO anon, authenticated;

-- ------------------------------------------------------------------ admin
CREATE OR REPLACE FUNCTION public.admin_set_usd_prices(p_babalawo uuid, p_session numeric, p_instant numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF (p_session IS NOT NULL AND p_session <= 0) OR (p_instant IS NOT NULL AND p_instant <= 0) THEN
    RAISE EXCEPTION 'Prices must be above zero (leave empty to use the automatic price)';
  END IF;
  UPDATE babalawos SET usd_session_price = p_session, usd_instant_price = p_instant WHERE user_id = p_babalawo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Babalawo not found'; END IF;
  INSERT INTO admin_audit_log(admin_id, action, target_type, target_id, details)
    VALUES (auth.uid(), 'set_usd_prices', 'babalawo', p_babalawo::text,
            jsonb_build_object('session', p_session, 'instant', p_instant));
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_pricing_currency(p_user uuid, p_currency text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_bal numeric; v_cur text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF p_currency IS NOT NULL AND p_currency NOT IN ('NGN', 'USD') THEN RAISE EXCEPTION 'Currency must be NGN or USD'; END IF;
  SELECT balance, currency INTO v_bal, v_cur FROM wallets WHERE user_id = p_user;
  IF COALESCE(v_bal, 0) > 0 AND p_currency IS NOT NULL AND v_cur <> p_currency THEN
    RAISE EXCEPTION 'Their wallet holds % %. Empty it before changing their currency.', v_bal, v_cur;
  END IF;
  UPDATE profiles SET pricing_currency_override = p_currency WHERE id = p_user;
  INSERT INTO admin_audit_log(admin_id, action, target_type, target_id, details)
    VALUES (auth.uid(), 'set_pricing_currency', 'user', p_user::text, jsonb_build_object('currency', p_currency));
END $$;

-- Admin → person: which currency they pay in and why, and (for a Babalawo) their dollar prices.
CREATE OR REPLACE FUNCTION public.admin_pricing_info(p_user uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE pr profiles%ROWTYPE; b babalawos%ROWTYPE; w wallets%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO pr FROM profiles WHERE id = p_user;
  SELECT * INTO w FROM wallets WHERE user_id = p_user;
  SELECT * INTO b FROM babalawos WHERE user_id = p_user;
  RETURN jsonb_build_object(
    'currency', _client_currency(p_user, pr.last_ip_country),
    'override', pr.pricing_currency_override,
    'last_paid_currency', pr.pricing_currency,
    'last_ip_country', pr.last_ip_country,
    'wallet_currency', w.currency,
    'wallet_balance', COALESCE(w.balance, 0),
    'usd_ngn_rate', usd_rate(),
    'babalawo', CASE WHEN b.user_id IS NULL THEN NULL ELSE jsonb_build_object(
      'session_price', get_session_price(p_user, false),
      'instant_price', get_session_price(p_user, true),
      'usd_session_price', b.usd_session_price,
      'usd_instant_price', b.usd_instant_price,
      'usd_price', get_session_price_usd(p_user, false),
      'usd_instant_price_effective', get_session_price_usd(p_user, true)) END);
END $$;
REVOKE ALL ON FUNCTION public.admin_pricing_info(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_pricing_info(uuid) TO authenticated;

DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname IN (
              '_client_currency', '_remember_pricing', '_quote', '_babalawo_session_share', 'apply_payment_quote',
              'apply_session_quote', 'set_payment_provider_parts', 'stamp_wallet_tx_currency', '_in_paid_currency',
              '_wallet_share', 'create_payment_intent', 'pricing_for')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.usd_rate(), public.get_session_price_usd(uuid, boolean), public.ebo_amount_usd(numeric) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_set_usd_prices(uuid, numeric, numeric), public.admin_set_pricing_currency(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_usd_prices(uuid, numeric, numeric), public.admin_set_pricing_currency(uuid, text) TO authenticated;

-- ---------------------------------------- existing functions, currency-aware

-- Dollar payments: the payments trigger turns the price into naira and sets the Babalawo's share.
CREATE OR REPLACE FUNCTION public._create_paid_session(
  p_user uuid, p_babalawo uuid, p_date date, p_start text, p_is_instant boolean,
  p_amount numeric, p_method text, p_reference text, p_gateway_tx text DEFAULT NULL, p_verified boolean DEFAULT false)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plat numeric; v_baba numeric; v_commission numeric; v_session bigint; v_mins int; v_n uuid;
BEGIN
  SELECT COALESCE(commission_platform_percent, 20), COALESCE(commission_babalawo_percent, 80)
    INTO v_plat, v_baba FROM babalawos WHERE user_id = p_babalawo;
  v_plat := COALESCE(v_plat, 20); v_baba := COALESCE(v_baba, 80);
  IF v_plat + v_baba <> 100 THEN v_plat := 20; v_baba := 80; END IF;
  v_commission := round(p_amount * v_plat / 100, 2);
  v_mins := public._session_minutes(p_babalawo);

  INSERT INTO sessions(user_id, babalawo_id, session_date, start_time, end_time, status, payment_status, amount,
                       payment_reference, is_instant, notes, accept_deadline)
  VALUES (p_user, p_babalawo, p_date, p_start::time, p_start::time + make_interval(mins => v_mins),
          (CASE WHEN p_is_instant THEN 'pending' ELSE 'confirmed' END)::session_status_enum,
          'paid', p_amount, p_reference, p_is_instant, CASE WHEN p_is_instant THEN 'Instant consultation' END,
          CASE WHEN p_is_instant THEN now() + make_interval(mins => public.get_setting_numeric('instant_accept_minutes', 3)::int) END)
  RETURNING id INTO v_session;

  INSERT INTO payments(user_id, session_id, amount, commission_amount, babalawo_amount, payment_gateway,
                       payment_reference, status, webhook_verified, gateway_transaction_id, commission_platform_percent)
  VALUES (p_user, v_session, p_amount, v_commission, p_amount - v_commission, p_method, p_reference,
          'completed', p_verified OR p_method = 'wallet', p_gateway_tx, v_plat);

  -- The Babalawo's naira share, as recorded on the payment (a diaspora price does not change it).
  PERFORM _babalawo_escrow_credit(p_babalawo, v_session, (SELECT babalawo_amount FROM payments WHERE session_id = v_session));
  v_n := create_notification(p_babalawo, CASE WHEN p_is_instant THEN 'instant_session_request' ELSE 'session_booked' END,
          CASE WHEN p_is_instant THEN 'New Instant Session' ELSE 'New booking' END,
          CASE WHEN p_is_instant THEN 'A client has paid to consult you now. Accept within '
                 || public.get_setting_numeric('instant_accept_minutes', 3)::int || ' minutes or they are refunded.'
               ELSE 'A client has paid for a consultation.' END,
          jsonb_build_object('session_id', v_session),
          CASE WHEN p_is_instant THEN 'urgent' ELSE 'high' END);
  IF p_is_instant AND v_n IS NOT NULL THEN
    UPDATE notifications SET action_url = '/session/' || v_session WHERE id = v_n;
  END IF;
  RETURN v_session;
END $$;

-- Refunds go back to the wallet in the currency the client paid.
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

  PERFORM _wallet_apply(s.user_id, _in_paid_currency(p.payment_reference, v_refund), 'credit', 'refund', NULL, p.payment_reference,
                        'Refund: ' || COALESCE(p_reason, 'session cancelled'), 'refund-' || p_session_id);
  UPDATE payments SET refunded_amount = amount, status = 'refunded', updated_at = now() WHERE id = p.id;
  UPDATE sessions SET payment_status = 'refunded', status = 'cancelled' WHERE id = p_session_id;
  INSERT INTO refunds(payment_id, amount, reason, status, processed_by)
    VALUES (p.id, v_refund, p_reason, 'completed', p_by);
  RETURN v_refund;
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
    PERFORM _wallet_apply(e.client_id, _in_paid_currency(e.payment_reference, v_refund), 'credit', 'refund', NULL, e.payment_reference,
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
  UPDATE ebo_prescriptions SET paid_currency = COALESCE(q.currency, 'NGN'), paid_amount = COALESCE(q.paid_amount, e.amount_due)
    FROM (SELECT NULL::text currency, NULL::numeric paid_amount) d
    LEFT JOIN payment_quotes q ON q.reference = p_reference
   WHERE ebo_prescriptions.id = p_id;
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


-- Liabilities per provider, with client wallets per currency.
CREATE OR REPLACE FUNCTION public.admin_provider_liabilities()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501'; END IF;
  RETURN (
    SELECT jsonb_object_agg(p.provider, jsonb_build_object(
      'client_wallets_ngn', COALESCE((SELECT sum(wp.balance) FROM wallet_parts wp JOIN wallets w ON w.user_id = wp.user_id
                                        WHERE wp.provider = p.provider AND w.currency = 'NGN'), 0),
      'client_wallets_usd', COALESCE((SELECT sum(wp.balance) FROM wallet_parts wp JOIN wallets w ON w.user_id = wp.user_id
                                        WHERE wp.provider = p.provider AND w.currency = 'USD'), 0),
      'babalawo_pending', COALESCE((SELECT sum(pending) FROM babalawo_balance_parts b WHERE b.provider = p.provider), 0),
      'babalawo_available', COALESCE((SELECT sum(available) FROM babalawo_balance_parts b WHERE b.provider = p.provider), 0),
      'babalawo_held', COALESCE((SELECT sum(held) FROM babalawo_balance_parts b WHERE b.provider = p.provider), 0),
      'paid_out', COALESCE((SELECT sum(paid_out) FROM babalawo_balance_parts b WHERE b.provider = p.provider), 0),
      'collected_ngn', COALESCE((SELECT sum(pay.amount * (pay.provider_parts->>p.provider)::numeric / NULLIF(_parts_total(pay.provider_parts), 0))
                                   FROM payments pay WHERE pay.status IN ('completed', 'refunded') AND pay.provider_parts ? p.provider), 0),
      'fees_paid_by_clients', COALESCE((SELECT sum(i.provider_fee) FROM payment_intents i
                               WHERE i.gateway = p.provider AND i.status = 'succeeded'), 0)))
      FROM (VALUES ('paystack'), ('flutterwave')) p(provider));
END $$;

