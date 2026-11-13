-- Verified Babalawo bank accounts, ready for automated payouts by Paystack and Flutterwave.
--
-- A Babalawo picks a bank from the providers' own list and types the account number. The server
-- asks the provider whose name is on the account (never trusting the browser), compares it with the
-- Babalawo's name, and saves the account only after the Babalawo confirms their PIN. A close name
-- match is verified at once; anything else waits for an admin. Replacing an account that was
-- already verified starts a cool-down (default 24 hours) before money can be sent to it, and the
-- Babalawo is told, so a stolen session cannot quietly redirect earnings.
--
-- Babalawos can still read their own row but no longer write it directly: every change goes
-- through the API (service role), which does the checks above.

INSERT INTO public.admin_settings(setting_key, setting_value, description, is_public) VALUES
  ('payout_account_cooldown_hours', '24', 'Hours before a changed bank account can receive withdrawals', false),
  ('payout_name_match_min', '0.6', 'Share of name words that must match the bank account name to verify it without an admin (0-1)', false),
  ('payout_resolves_per_hour', '10', 'Bank account lookups a Babalawo may make per hour', false)
ON CONFLICT (setting_key) DO NOTHING;

-- ------------------------------------------------------------------ banks
-- One row per bank, with each provider's own code for it. Refreshed from both providers' bank lists.
CREATE TABLE IF NOT EXISTS public.payout_banks (
  id                serial PRIMARY KEY,
  name              text NOT NULL,
  slug              text NOT NULL UNIQUE,
  paystack_code     text,
  flutterwave_code  text,
  active            boolean NOT NULL DEFAULT true,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (paystack_code IS NOT NULL OR flutterwave_code IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS payout_banks_paystack_code ON public.payout_banks(paystack_code) WHERE paystack_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payout_banks_flutterwave_code ON public.payout_banks(flutterwave_code) WHERE flutterwave_code IS NOT NULL;
ALTER TABLE public.payout_banks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Bank list is public" ON public.payout_banks;
CREATE POLICY "Bank list is public" ON public.payout_banks FOR SELECT USING (active);
GRANT SELECT ON public.payout_banks TO anon, authenticated;
GRANT ALL ON public.payout_banks TO service_role;
GRANT USAGE ON SEQUENCE public.payout_banks_id_seq TO service_role;

-- The big commercial banks, so the list works before the first refresh. Both providers use the
-- CBN codes for these.
INSERT INTO public.payout_banks(name, slug, paystack_code, flutterwave_code) VALUES
  ('Access Bank', 'access-bank', '044', '044'),
  ('Citibank Nigeria', 'citibank-nigeria', '023', '023'),
  ('Ecobank Nigeria', 'ecobank-nigeria', '050', '050'),
  ('Fidelity Bank', 'fidelity-bank', '070', '070'),
  ('First Bank of Nigeria', 'first-bank-of-nigeria', '011', '011'),
  ('First City Monument Bank', 'first-city-monument-bank', '214', '214'),
  ('Guaranty Trust Bank', 'guaranty-trust-bank', '058', '058'),
  ('Keystone Bank', 'keystone-bank', '082', '082'),
  ('Polaris Bank', 'polaris-bank', '076', '076'),
  ('Providus Bank', 'providus-bank', '101', '101'),
  ('Stanbic IBTC Bank', 'stanbic-ibtc-bank', '221', '221'),
  ('Standard Chartered Bank', 'standard-chartered-bank', '068', '068'),
  ('Sterling Bank', 'sterling-bank', '232', '232'),
  ('Union Bank of Nigeria', 'union-bank-of-nigeria', '032', '032'),
  ('United Bank For Africa', 'united-bank-for-africa', '033', '033'),
  ('Unity Bank', 'unity-bank', '215', '215'),
  ('Wema Bank', 'wema-bank', '035', '035'),
  ('Zenith Bank', 'zenith-bank', '057', '057')
ON CONFLICT (slug) DO NOTHING;

-- ------------------------------------------------------------------ accounts
ALTER TABLE public.babalawo_bank_details
  ADD COLUMN IF NOT EXISTS bank_id integer REFERENCES public.payout_banks(id),
  ADD COLUMN IF NOT EXISTS paystack_bank_code text,
  ADD COLUMN IF NOT EXISTS flutterwave_bank_code text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'unverified'
    CHECK (status IN ('unverified', 'verified', 'pending_review', 'rejected')),
  ADD COLUMN IF NOT EXISTS resolved_by text CHECK (resolved_by IN ('paystack', 'flutterwave')),
  ADD COLUMN IF NOT EXISTS name_match numeric(4,3),
  ADD COLUMN IF NOT EXISTS paystack_recipient_code text,
  ADD COLUMN IF NOT EXISTS usable_from timestamptz,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
COMMENT ON COLUMN public.babalawo_bank_details.account_name IS 'The name the provider reports for the account (not typed by the Babalawo)';
COMMENT ON COLUMN public.babalawo_bank_details.usable_from IS 'Withdrawals to this account are allowed from this time (cool-down after a change)';

-- Babalawos read their own account; only the API writes it.
DROP POLICY IF EXISTS "Babalawos manage own bank details" ON public.babalawo_bank_details;
DROP POLICY IF EXISTS "Babalawos read own bank details" ON public.babalawo_bank_details;
CREATE POLICY "Babalawos read own bank details" ON public.babalawo_bank_details
  FOR SELECT USING (babalawo_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON public.babalawo_bank_details FROM anon, authenticated;

-- Every change and lookup, for support and fraud review.
CREATE TABLE IF NOT EXISTS public.bank_account_events (
  id           bigserial PRIMARY KEY,
  babalawo_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event        text NOT NULL CHECK (event IN ('lookup', 'saved', 'approved', 'rejected', 'removed')),
  bank_name    text,
  account_last4 text,
  account_name text,
  name_match   numeric(4,3),
  provider     text,
  actor        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bank_account_events_baba ON public.bank_account_events(babalawo_id, created_at DESC);
ALTER TABLE public.bank_account_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read bank account events" ON public.bank_account_events;
CREATE POLICY "Admins read bank account events" ON public.bank_account_events FOR SELECT USING (public.is_admin());
REVOKE ALL ON public.bank_account_events FROM anon, authenticated;
GRANT SELECT ON public.bank_account_events TO authenticated;
GRANT ALL ON public.bank_account_events TO service_role;
GRANT USAGE ON SEQUENCE public.bank_account_events_id_seq TO service_role;

-- PIN confirmed moments ago, for a sensitive change (one use, a few minutes).
CREATE TABLE IF NOT EXISTS auth.step_ups (
  token_hash  text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose     text NOT NULL,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON auth.step_ups FROM PUBLIC, anon, authenticated;
GRANT ALL ON auth.step_ups TO service_role;

-- ------------------------------------------------------------------ name match
-- Share of the words in the Babalawo's name found in the bank's account name (order and case
-- ignored, initials match a word that starts with them). Banks often add or reorder names.
CREATE OR REPLACE FUNCTION public._name_match(p_ours text, p_bank text)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE ours text[]; theirs text[]; w text; hits int := 0;
BEGIN
  ours := ARRAY(SELECT x FROM unnest(regexp_split_to_array(lower(unaccent_basic(coalesce(p_ours, ''))), '[^a-z]+')) x WHERE length(x) > 0);
  theirs := ARRAY(SELECT x FROM unnest(regexp_split_to_array(lower(unaccent_basic(coalesce(p_bank, ''))), '[^a-z]+')) x WHERE length(x) > 0);
  IF cardinality(ours) = 0 OR cardinality(theirs) = 0 THEN RETURN 0; END IF;
  FOREACH w IN ARRAY ours LOOP
    IF w = ANY(theirs)
       OR (length(w) = 1 AND EXISTS (SELECT 1 FROM unnest(theirs) t WHERE left(t, 1) = w))
       OR (length(w) > 1 AND EXISTS (SELECT 1 FROM unnest(theirs) t WHERE length(t) = 1 AND t = left(w, 1))) THEN
      hits := hits + 1;
    END IF;
  END LOOP;
  RETURN round(hits::numeric / cardinality(ours), 3);
END $$;

-- Yorùbá names carry tone marks; bank names usually don't.
CREATE OR REPLACE FUNCTION public.unaccent_basic(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT translate(normalize(coalesce(p, ''), NFD), U&'\0300\0301\0302\0303\0304\0306\0307\0308\0323\0327', '')
$$;

-- ------------------------------------------------------------------ save (API only)
-- Called by the API after it has resolved the account with a provider and checked the PIN.
CREATE OR REPLACE FUNCTION public._save_bank_account(
  p_babalawo uuid, p_bank_id integer, p_account_number text, p_account_name text,
  p_resolved_by text, p_recipient_code text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bk payout_banks%ROWTYPE; v_old babalawo_bank_details%ROWTYPE; v_name text; v_match numeric;
        v_status text; v_usable timestamptz; v_same boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM babalawos WHERE user_id = p_babalawo) THEN RAISE EXCEPTION 'Only Babalawos add payout accounts'; END IF;
  IF public.is_suspended(p_babalawo) THEN RAISE EXCEPTION 'Your account is suspended'; END IF;
  IF p_account_number !~ '^\d{10}$' THEN RAISE EXCEPTION 'Account numbers have 10 digits'; END IF;
  SELECT * INTO bk FROM payout_banks WHERE id = p_bank_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Choose your bank from the list'; END IF;
  IF EXISTS (SELECT 1 FROM withdrawal_requests WHERE babalawo_id = p_babalawo AND status IN ('pending', 'approved')) THEN
    RAISE EXCEPTION 'You have a withdrawal in progress. Change your account once it is paid.';
  END IF;

  SELECT * INTO v_old FROM babalawo_bank_details WHERE babalawo_id = p_babalawo;
  v_same := FOUND AND v_old.account_number = p_account_number AND v_old.bank_id IS NOT DISTINCT FROM p_bank_id;
  SELECT full_name INTO v_name FROM profiles WHERE id = p_babalawo;
  v_match := _name_match(v_name, p_account_name);
  v_status := CASE WHEN v_match >= get_setting_numeric('payout_name_match_min', 0.6) THEN 'verified' ELSE 'pending_review' END;
  -- A first account can be paid at once. Moving money to a different account waits.
  v_usable := CASE
    WHEN v_same AND v_old.usable_from IS NOT NULL THEN v_old.usable_from
    WHEN v_old.babalawo_id IS NULL OR v_old.status NOT IN ('verified') THEN now()
    ELSE now() + make_interval(hours => get_setting_numeric('payout_account_cooldown_hours', 24)::int) END;

  INSERT INTO babalawo_bank_details(babalawo_id, bank_name, account_number, account_name, bank_id,
         paystack_bank_code, flutterwave_bank_code, status, resolved_by, name_match, paystack_recipient_code,
         usable_from, verified_at, review_note, reviewed_by, reviewed_at)
  VALUES (p_babalawo, bk.name, p_account_number, p_account_name, bk.id, bk.paystack_code, bk.flutterwave_code,
          v_status, p_resolved_by, v_match, p_recipient_code, v_usable,
          CASE WHEN v_status = 'verified' THEN now() END, NULL, NULL, NULL)
  ON CONFLICT (babalawo_id) DO UPDATE SET
    bank_name = excluded.bank_name, account_number = excluded.account_number, account_name = excluded.account_name,
    bank_id = excluded.bank_id, paystack_bank_code = excluded.paystack_bank_code,
    flutterwave_bank_code = excluded.flutterwave_bank_code, status = excluded.status,
    resolved_by = excluded.resolved_by, name_match = excluded.name_match,
    paystack_recipient_code = excluded.paystack_recipient_code, usable_from = excluded.usable_from,
    verified_at = excluded.verified_at, review_note = NULL, reviewed_by = NULL, reviewed_at = NULL;

  INSERT INTO bank_account_events(babalawo_id, event, bank_name, account_last4, account_name, name_match, provider, actor)
    VALUES (p_babalawo, 'saved', bk.name, right(p_account_number, 4), p_account_name, v_match, p_resolved_by, p_babalawo);

  IF v_old.babalawo_id IS NOT NULL AND NOT v_same THEN
    PERFORM create_notification(p_babalawo, 'bank_account_changed', 'Your payout account was changed',
      format('Withdrawals now go to %s ••%s (%s). If this wasn''t you, contact IFA.ng support straight away.',
             bk.name, right(p_account_number, 4), p_account_name),
      jsonb_build_object('usable_from', v_usable), 'high');
  END IF;
  RETURN jsonb_build_object('status', v_status, 'account_name', p_account_name, 'bank_name', bk.name,
                            'name_match', v_match, 'usable_from', v_usable);
END $$;

-- A lookup, for the hourly limit and the record. Returns false when over the limit.
CREATE OR REPLACE FUNCTION public._bank_lookup_allowed(p_babalawo uuid, p_bank_name text, p_account text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM bank_account_events WHERE babalawo_id = p_babalawo AND event = 'lookup'
        AND created_at > now() - interval '1 hour') >= get_setting_numeric('payout_resolves_per_hour', 10) THEN
    RETURN false;
  END IF;
  INSERT INTO bank_account_events(babalawo_id, event, bank_name, account_last4, actor)
    VALUES (p_babalawo, 'lookup', p_bank_name, right(p_account, 4), p_babalawo);
  RETURN true;
END $$;

-- ------------------------------------------------------------------ admin review
CREATE OR REPLACE FUNCTION public.admin_review_bank_account(p_babalawo uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d babalawo_bank_details%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO d FROM babalawo_bank_details WHERE babalawo_id = p_babalawo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No bank account on file'; END IF;
  IF NOT p_approve AND NULLIF(btrim(p_note), '') IS NULL THEN RAISE EXCEPTION 'Say why, so the Babalawo can fix it'; END IF;
  UPDATE babalawo_bank_details SET status = CASE WHEN p_approve THEN 'verified' ELSE 'rejected' END,
         verified_at = CASE WHEN p_approve THEN now() END, review_note = NULLIF(btrim(p_note), ''),
         reviewed_by = auth.uid(), reviewed_at = now()
   WHERE babalawo_id = p_babalawo;
  INSERT INTO bank_account_events(babalawo_id, event, bank_name, account_last4, account_name, actor, note)
    VALUES (p_babalawo, CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, d.bank_name, right(d.account_number, 4),
            d.account_name, auth.uid(), p_note);
  INSERT INTO admin_audit_log(admin_id, action, target_type, target_id, details)
    VALUES (auth.uid(), CASE WHEN p_approve THEN 'approve_bank_account' ELSE 'reject_bank_account' END, 'babalawo',
            p_babalawo::text, jsonb_build_object('note', p_note, 'account_last4', right(d.account_number, 4)));
  PERFORM create_notification(p_babalawo,
    CASE WHEN p_approve THEN 'bank_account_verified' ELSE 'bank_account_rejected' END,
    CASE WHEN p_approve THEN 'Your payout account is verified' ELSE 'Your payout account needs attention' END,
    CASE WHEN p_approve THEN format('Withdrawals will go to %s ••%s.', d.bank_name, right(d.account_number, 4))
         ELSE format('We could not verify %s ••%s: %s', d.bank_name, right(d.account_number, 4), p_note) END,
    '{}'::jsonb, 'high');
END $$;

-- Accounts waiting for an admin, with the names to compare.
CREATE OR REPLACE FUNCTION public.admin_bank_accounts_to_review()
RETURNS TABLE(babalawo_id uuid, full_name text, bank_name text, account_last4 text, account_name text,
              name_match numeric, updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  RETURN QUERY SELECT d.babalawo_id, p.full_name, d.bank_name, right(d.account_number, 4), d.account_name,
                      d.name_match, d.updated_at
                 FROM babalawo_bank_details d JOIN profiles p ON p.id = d.babalawo_id
                WHERE d.status = 'pending_review' ORDER BY d.updated_at;
END $$;

-- ------------------------------------------------------------------ withdrawals
-- Money only goes to a verified account, and not during the cool-down after a change.
CREATE OR REPLACE FUNCTION public.check_withdrawal_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d babalawo_bank_details%ROWTYPE;
BEGIN
  SELECT * INTO d FROM babalawo_bank_details WHERE babalawo_id = NEW.babalawo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Add your bank account first'; END IF;
  IF d.status = 'pending_review' THEN
    RAISE EXCEPTION 'Your bank account is waiting for IFA.ng to check the name on it. You can withdraw once it is verified.';
  END IF;
  IF d.status <> 'verified' THEN RAISE EXCEPTION 'Please add and verify your bank account before withdrawing'; END IF;
  IF d.usable_from IS NOT NULL AND d.usable_from > now() THEN
    RAISE EXCEPTION 'Your new bank account can receive withdrawals from %',
      to_char(d.usable_from AT TIME ZONE 'Africa/Lagos', 'FMDD Mon, HH24:MI "(Lagos time)"');
  END IF;
  NEW.bank_snapshot := jsonb_build_object('bank_name', d.bank_name, 'account_number', d.account_number,
    'account_name', d.account_name, 'bank_id', d.bank_id, 'paystack_bank_code', d.paystack_bank_code,
    'flutterwave_bank_code', d.flutterwave_bank_code, 'paystack_recipient_code', d.paystack_recipient_code);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_check_withdrawal_account ON public.withdrawal_requests;
CREATE TRIGGER trg_check_withdrawal_account BEFORE INSERT ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.check_withdrawal_account();

-- Erasure and account deletion remove the bank account; the history keeps only what money records need.
CREATE OR REPLACE FUNCTION public.forget_bank_account_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE bank_account_events SET account_name = NULL, note = NULL WHERE babalawo_id = OLD.babalawo_id;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS trg_forget_bank_account_events ON public.babalawo_bank_details;
CREATE TRIGGER trg_forget_bank_account_events AFTER DELETE ON public.babalawo_bank_details
  FOR EACH ROW EXECUTE FUNCTION public.forget_bank_account_events();

-- ------------------------------------------------------------------ grants
REVOKE ALL ON FUNCTION public._save_bank_account(uuid, integer, text, text, text, text),
              public._bank_lookup_allowed(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._save_bank_account(uuid, integer, text, text, text, text),
              public._bank_lookup_allowed(uuid, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.admin_review_bank_account(uuid, boolean, text), public.admin_bank_accounts_to_review()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_bank_account(uuid, boolean, text), public.admin_bank_accounts_to_review()
  TO authenticated;
