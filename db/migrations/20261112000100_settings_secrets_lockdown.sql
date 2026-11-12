-- Settings hold platform rules only. Provider keys live in the server's environment.
--
-- Before this, Admin -> Settings saved gateway secrets, SMTP passwords, Termii/Agora/Daily keys
-- into admin_settings with is_encrypted = false, and the read policy let anonymous visitors read
-- every such row through /rest/v1/admin_settings. Those rows are removed, secret-looking keys can
-- no longer be stored, and only rows marked is_public are readable by non-admins.

ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- 1) Drop anything that looks like a credential (and the old provider config the server never reads).
DELETE FROM public.admin_settings
 WHERE setting_key ~* '(secret|api_key|_key$|certificate|password|passwd|token|dsn|smtp_|sendgrid|resend|termii|flutterwave_|paystack_|agora_|daily_|webhook)'
   AND setting_key !~* '_fee_';

-- 2) Refuse them from now on, whoever writes.
CREATE OR REPLACE FUNCTION public.guard_admin_settings_no_secrets()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.setting_key ~* '(secret|api_key|_key$|certificate|password|passwd|token|dsn)' THEN
    RAISE EXCEPTION 'Keys and passwords are set in the server environment, not in settings (%)', NEW.setting_key
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_admin_settings_no_secrets ON public.admin_settings;
CREATE TRIGGER trg_admin_settings_no_secrets BEFORE INSERT OR UPDATE ON public.admin_settings
  FOR EACH ROW EXECUTE FUNCTION public.guard_admin_settings_no_secrets();

-- 3) Rules the app needs to show before sign-in (prices, fees, refund window) are public; the rest admin-only.
UPDATE public.admin_settings SET is_public = true
 WHERE setting_key IN (
   'currency', 'min_session_price', 'max_session_price', 'default_session_minutes', 'min_wallet_topup',
   'min_withdrawal_amount', 'cancellation_full_refund_hours', 'video_provider', 'video_fallback_provider',
   'recording_retention_days', 'platform_commission_percent', 'babalawo_commission_percent',
   'ebo_platform_fee_percent', 'ebo_quote_expiry_days', 'ebo_confirm_hours', 'ebo_max_total',
   'flutterwave_fee_percent', 'flutterwave_fee_cap', 'paystack_fee_percent', 'paystack_fee_cap', 'show_payment_fees');

DROP POLICY IF EXISTS "Non-secret settings are readable" ON public.admin_settings;
CREATE POLICY "Public settings are readable" ON public.admin_settings
  FOR SELECT USING (is_public OR public.is_admin());

-- Admins sign in with a fresh code every time (no PIN-only sign-in): a third code purpose.
ALTER TABLE auth.phone_otps DROP CONSTRAINT IF EXISTS phone_otps_purpose_check;
ALTER TABLE auth.phone_otps ADD CONSTRAINT phone_otps_purpose_check CHECK (purpose IN ('login', 'reset_pin', 'admin_login'));
