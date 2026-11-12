-- Honest screens: reviews that really save, and a way to delete your account.

-- ------------------------------------------------------------------ reviews
-- Reviews used to need an admin to approve them, and there was no screen to do it, so none ever
-- showed. They now publish straight away unless an admin turns approval on; admins can hide any.
INSERT INTO public.admin_settings (setting_key, setting_value, description, is_public) VALUES
  ('reviews_need_approval', 'false', 'Hold new client reviews until an admin approves them', false)
ON CONFLICT (setting_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public._reviews_need_approval()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT lower(setting_value) FROM admin_settings WHERE setting_key = 'reviews_need_approval'), 'false') = 'true'
$$;

-- Not security definer: needs the caller's role. Clients can't choose who they review or approve themselves.
CREATE OR REPLACE FUNCTION public.prepare_client_review()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN RETURN NEW; END IF;
  NEW.babalawo_id := (SELECT babalawo_id FROM sessions WHERE id = NEW.session_id);
  NEW.is_approved := NOT public._reviews_need_approval();
  NEW.created_at := now();
  NEW.comment := NULLIF(left(trim(COALESCE(NEW.comment, '')), 2000), '');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_prepare_client_review ON public.reviews;
CREATE TRIGGER trg_prepare_client_review BEFORE INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.prepare_client_review();

DROP POLICY IF EXISTS "Clients review their completed sessions" ON public.reviews;
CREATE POLICY "Clients review their completed sessions" ON public.reviews
  FOR INSERT WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.user_id = auth.uid()
      AND s.status = 'completed' AND s.babalawo_id IS NOT DISTINCT FROM reviews.babalawo_id));

REVOKE ALL ON FUNCTION public._reviews_need_approval() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._reviews_need_approval() TO authenticated;

-- ------------------------------------------------------------------ account deletion
-- Payments, sessions and ledgers are kept (money records and the other person's history), but
-- everything that identifies the person is removed and they can no longer sign in. The phone
-- number is freed, so it can be used for a new account.
CREATE OR REPLACE FUNCTION public.delete_my_account(p_confirm text, p_forfeit_wallet boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_wallet numeric := 0; v_bab numeric := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501'; END IF;
  IF p_confirm IS DISTINCT FROM 'DELETE' THEN RAISE EXCEPTION 'Type DELETE to confirm' USING ERRCODE = 'IF003'; END IF;
  IF public.is_admin() THEN RAISE EXCEPTION 'Admin accounts are removed by another admin' USING ERRCODE = 'IF003'; END IF;

  IF EXISTS (SELECT 1 FROM sessions s WHERE (s.user_id = v_uid OR s.babalawo_id = v_uid)
               AND s.status IN ('pending', 'confirmed', 'in_progress') AND s.payment_status = 'paid') THEN
    RAISE EXCEPTION 'You have upcoming consultations. Cancel them first (paid ones are refunded by the usual rules).' USING ERRCODE = 'IF003';
  END IF;
  IF EXISTS (SELECT 1 FROM disputes d WHERE d.status IN ('open', 'investigating')
               AND (d.raised_by = v_uid OR d.session_id IN (SELECT id FROM sessions WHERE user_id = v_uid OR babalawo_id = v_uid))) THEN
    RAISE EXCEPTION 'A dispute is still open. We will finish it first.' USING ERRCODE = 'IF003';
  END IF;
  IF EXISTS (SELECT 1 FROM ebo_prescriptions e WHERE (e.client_id = v_uid OR e.babalawo_id = v_uid)
               AND e.status IN ('sent', 'paid', 'in_progress', 'performed', 'disputed')) THEN
    RAISE EXCEPTION 'An Ebo or Etutu is still in progress. Finish or cancel it first.' USING ERRCODE = 'IF003';
  END IF;
  SELECT COALESCE(available_balance, 0) + COALESCE(pending_balance, 0) INTO v_bab FROM babalawo_wallets WHERE babalawo_id = v_uid;
  IF COALESCE(v_bab, 0) > 0 OR EXISTS (SELECT 1 FROM withdrawal_requests WHERE babalawo_id = v_uid AND status IN ('pending', 'approved')) THEN
    RAISE EXCEPTION 'You still have earnings with us. Withdraw them first.' USING ERRCODE = 'IF003';
  END IF;
  SELECT COALESCE(balance, 0) INTO v_wallet FROM wallets WHERE user_id = v_uid;
  IF COALESCE(v_wallet, 0) > 0 AND NOT p_forfeit_wallet THEN
    RAISE EXCEPTION 'Your wallet still has ₦%. Use it first, or confirm you give it up.', to_char(v_wallet, 'FM999G999G999') USING ERRCODE = 'IF004';
  END IF;

  -- Who they were.
  UPDATE profiles SET full_name = 'Deleted user', email = 'deleted-' || v_uid || '@deleted.ifa.invalid', phone = NULL, avatar_url = NULL, timezone = NULL,
         whatsapp_opt_in = false, sms_opt_in = false WHERE id = v_uid;
  UPDATE babalawos SET is_active = false, current_status = 'offline', bio = NULL, specialties = NULL, languages = NULL,
         city = NULL, region = NULL, country = NULL, profile_picture_url = NULL, google_email = NULL WHERE user_id = v_uid;
  DELETE FROM babalawo_bank_details WHERE babalawo_id = v_uid;
  DELETE FROM availability WHERE babalawo_id = v_uid;
  DELETE FROM push_subscriptions WHERE user_id = v_uid;
  DELETE FROM user_notification_preferences WHERE user_id = v_uid;
  DELETE FROM slot_locks WHERE locked_by_user_id = v_uid;
  UPDATE reviews SET comment = NULL WHERE user_id = v_uid;

  -- How they signed in.
  DELETE FROM auth.sessions WHERE user_id = v_uid;
  DELETE FROM auth.accounts WHERE user_id = v_uid;
  DELETE FROM auth.phone_pins WHERE user_id = v_uid;
  DELETE FROM auth.pin_tickets WHERE user_id = v_uid;
  UPDATE auth.users SET email = 'deleted-' || v_uid || '@deleted.ifa.invalid', phone = NULL, name = 'Deleted user', image = NULL,
         encrypted_password = NULL, raw_user_meta_data = '{}'::jsonb, deleted_at = now(), banned_until = 'infinity'
   WHERE id = v_uid;

  IF v_wallet > 0 THEN
    INSERT INTO admin_audit_log(action, target_type, target_id, details) VALUES ('account_deleted_wallet_forfeit', 'user', v_uid::text,
      jsonb_build_object('amount', v_wallet));
  END IF;
  RETURN jsonb_build_object('deleted', true);
END $$;

REVOKE ALL ON FUNCTION public.delete_my_account(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account(text, boolean) TO authenticated;
