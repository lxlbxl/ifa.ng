-- Data protection: Nigeria Data Protection Act 2023 (NDPA) and the NDPC's GAID 2025, and the EU and UK GDPR.
--
-- What this adds:
--   1. Privacy settings: who the controller is, the DPO contact, the notice version, retention periods.
--   2. privacy_consents: an append-only log of every consent given or withdrawn (age, terms, privacy
--      notice, special-category data, marketing, WhatsApp, SMS, optional error reports).
--   3. data_subject_requests: access, export, correction, erasure, restriction, objection... with a due
--      date (30 days), extensions, a history, and an admin queue. Visitors without an account can file one.
--   4. export_my_data(): everything we hold about the caller, as JSON (access + portability).
--   5. Erasure: delete_my_account() now also removes consultation content (special-category data),
--      transcripts, recordings, Ebo proof videos and notifications, and queues stored files for deletion.
--      Admins can erase on request (admin_erase_user) with the same safety checks.
--   6. Withdrawing recording / AI consent after a consultation deletes the recording and transcript.
--   7. run_retention(): the retention schedule, run hourly by the API, logged in retention_runs.
--   8. data_breaches: the breach register, with the 72-hour regulator clock.
--
-- Everything that changes someone's data on request is written to admin_audit_log.

------------------------------------------------------------------------------
-- 1. Settings
------------------------------------------------------------------------------
INSERT INTO public.admin_settings (setting_key, setting_value, description, is_public) VALUES
  ('privacy_notice_version', '2026-11-17', 'Version of the privacy notice and terms. Changing it asks everyone to agree again.', true),
  ('privacy_controller_name', 'IFA.ng', 'Legal name of the company that runs IFA.ng (the data controller)', true),
  ('privacy_controller_address', '', 'Registered address of the data controller', true),
  ('privacy_controller_rc_number', '', 'CAC registration (RC) number', true),
  ('privacy_dpo_name', '', 'Name of the Data Protection Officer', true),
  ('privacy_dpo_email', 'privacy@ifa.ng', 'Email for privacy requests and the Data Protection Officer', true),
  ('privacy_eu_representative', '', 'EU representative under GDPR Article 27 (name and address), if appointed', true),
  ('privacy_uk_representative', '', 'UK representative under UK GDPR Article 27 (name and address), if appointed', true),
  ('privacy_ndpc_registration', '', 'NDPC registration number as a data controller of major importance', true),
  ('privacy_min_age', '18', 'Minimum age to use IFA.ng', true),
  ('dsar_response_days', '30', 'Days to answer a privacy request', true),
  ('dsar_max_extension_days', '60', 'Extra days allowed for a complex privacy request (the person is told why)', false),
  ('retention_notifications_days', '365', 'Delete in-app notifications after this many days', true),
  ('retention_message_log_days', '90', 'Delete WhatsApp/SMS delivery logs after this many days', true),
  ('retention_security_log_days', '90', 'Delete sign-in codes, expired sign-ins and rate-limit records after this many days', true),
  ('retention_session_log_days', '730', 'Delete session join/leave logs after this many days', true),
  ('retention_ebo_proof_days', '365', 'Delete Ebo proof videos this many days after the Ebo is closed', true),
  ('retention_applications_days', '365', 'Delete declined Babalawo applications after this many days', true),
  ('retention_financial_years', '6', 'Keep payment, wallet and payout records this many years (tax and company law)', true),
  ('retention_audit_years', '6', 'Keep the admin and payment audit logs this many years', true),
  ('retention_privacy_requests_years', '3', 'Keep closed privacy requests and breach records this many years', true)
ON CONFLICT (setting_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public._setting_int(p_key text, p_default integer)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT CASE WHEN setting_value ~ '^\d+$' THEN setting_value::integer END
                     FROM admin_settings WHERE setting_key = p_key), p_default)
$$;
CREATE OR REPLACE FUNCTION public.privacy_notice_version()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT NULLIF(setting_value, '') FROM admin_settings WHERE setting_key = 'privacy_notice_version'), '2026-11-17')
$$;
REVOKE ALL ON FUNCTION public._setting_int(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.privacy_notice_version() TO anon, authenticated;

------------------------------------------------------------------------------
-- 2. Consent log
------------------------------------------------------------------------------
-- purposes:
--   age_confirmed     the person says they are 18 or older (children are not served)
--   terms             agreed to the terms of use (contract)
--   privacy_notice    was shown and acknowledged the privacy notice
--   special_category  explicit consent to process what they share in consultations, which can reveal
--                     religious or philosophical beliefs and health (NDPA s.30, GDPR Art. 9(2)(a))
--   marketing         news and offers (optional, off by default)
--   whatsapp, sms     booking messages by these channels (mirrors profiles.*_opt_in)
--   error_reports     optional crash reports from this browser (no cookies)
CREATE TABLE IF NOT EXISTS public.privacy_consents (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('age_confirmed', 'terms', 'privacy_notice', 'special_category',
                                            'marketing', 'whatsapp', 'sms', 'error_reports')),
  granted boolean NOT NULL,
  notice_version text NOT NULL,
  source text NOT NULL DEFAULT 'app' CHECK (source IN ('signup', 'app', 'settings', 'banner', 'admin', 'import')),
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_privacy_consents_user ON public.privacy_consents (user_id, purpose, created_at DESC);
ALTER TABLE public.privacy_consents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own consents and admins" ON public.privacy_consents;
CREATE POLICY "Own consents and admins" ON public.privacy_consents
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
-- No write policies: the log is append-only, through record_consents().
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.privacy_consents FROM anon, authenticated;

-- Latest decision per purpose.
CREATE OR REPLACE FUNCTION public._current_consents(p_uid uuid)
RETURNS TABLE (purpose text, granted boolean, notice_version text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (c.purpose) c.purpose, c.granted, c.notice_version, c.created_at
    FROM privacy_consents c WHERE c.user_id = p_uid
   ORDER BY c.purpose, c.created_at DESC, c.id DESC
$$;
REVOKE ALL ON FUNCTION public._current_consents(uuid) FROM PUBLIC, anon, authenticated;

-- What still needs agreeing before the person can use the service. Terms and the privacy notice
-- must match the current version; age and special-category consent must simply be in force.
CREATE OR REPLACE FUNCTION public._missing_consents(p_uid uuid)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(r.p ORDER BY r.ord), '{}') FROM (VALUES
      ('age_confirmed', 1, false), ('terms', 2, true), ('privacy_notice', 3, true), ('special_category', 4, false)) AS r(p, ord, versioned)
   WHERE NOT EXISTS (SELECT 1 FROM public._current_consents(p_uid) c
                      WHERE c.purpose = r.p AND c.granted
                        AND (NOT r.versioned OR c.notice_version = public.privacy_notice_version()))
$$;
REVOKE ALL ON FUNCTION public._missing_consents(uuid) FROM PUBLIC, anon, authenticated;

-- p_items: {"terms": true, "marketing": false, ...}
CREATE OR REPLACE FUNCTION public.record_consents(p_items jsonb, p_source text DEFAULT 'app', p_user_agent text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  k text; v jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Nothing to record' USING ERRCODE = '22023'; END IF;
  IF p_source NOT IN ('signup', 'app', 'settings', 'banner') THEN p_source := 'app'; END IF;
  FOR k, v IN SELECT * FROM jsonb_each(p_items) LOOP
    IF k NOT IN ('age_confirmed', 'terms', 'privacy_notice', 'special_category', 'marketing', 'whatsapp', 'sms', 'error_reports') THEN
      RAISE EXCEPTION 'Unknown consent: %', k USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(v) <> 'boolean' THEN RAISE EXCEPTION 'Consent % must be true or false', k USING ERRCODE = '22023'; END IF;
    -- Only log changes, so the history stays readable.
    IF NOT EXISTS (SELECT 1 FROM public._current_consents(v_uid) c
                    WHERE c.purpose = k AND c.granted = (v::text)::boolean
                      AND c.notice_version = public.privacy_notice_version()) THEN
      INSERT INTO privacy_consents (user_id, purpose, granted, notice_version, source, user_agent)
      VALUES (v_uid, k, (v::text)::boolean, public.privacy_notice_version(), p_source, left(p_user_agent, 300));
    END IF;
    IF k = 'whatsapp' THEN UPDATE profiles SET whatsapp_opt_in = (v::text)::boolean WHERE id = v_uid; END IF;
    IF k = 'sms' THEN UPDATE profiles SET sms_opt_in = (v::text)::boolean WHERE id = v_uid; END IF;
  END LOOP;
  RETURN public.my_privacy_status();
END $$;

-- One call for the app: current choices, what is missing, and the person's privacy requests.
CREATE OR REPLACE FUNCTION public.my_privacy_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'notice_version', public.privacy_notice_version(),
    'missing', to_jsonb(public._missing_consents(v_uid)),
    'consents', COALESCE((SELECT jsonb_object_agg(c.purpose, jsonb_build_object('granted', c.granted, 'at', c.created_at, 'version', c.notice_version))
                            FROM public._current_consents(v_uid) c), '{}'::jsonb),
    'recording_consents', (SELECT count(*) FROM session_consents sc WHERE sc.user_id = v_uid AND sc.withdrawn_at IS NULL AND sc.recording_consent),
    'requests', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'type', r.request_type, 'status', r.status,
                            'received_at', r.received_at, 'due_at', r.due_at, 'completed_at', r.completed_at, 'response', r.response)
                            ORDER BY r.received_at DESC)
                            FROM data_subject_requests r WHERE r.user_id = v_uid), '[]'::jsonb));
END $$;

------------------------------------------------------------------------------
-- 3. Privacy requests (data subject requests)
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.data_subject_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  request_type text NOT NULL CHECK (request_type IN ('access', 'portability', 'rectification', 'erasure', 'restriction',
                                                     'objection', 'withdraw_consent', 'automated_decision', 'complaint', 'other')),
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'verifying', 'in_progress', 'extended', 'completed', 'rejected')),
  source text NOT NULL DEFAULT 'app' CHECK (source IN ('app', 'self_service', 'public_form', 'email', 'admin')),
  requester_name text,
  requester_email text,
  requester_phone text,
  details text,
  received_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz NOT NULL,
  extended_reason text,
  identity_verified_at timestamptz,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  response text,
  completed_at timestamptz,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dsr_open ON public.data_subject_requests (due_at) WHERE status NOT IN ('completed', 'rejected');
CREATE INDEX IF NOT EXISTS idx_dsr_user ON public.data_subject_requests (user_id);
ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own requests and admins" ON public.data_subject_requests;
CREATE POLICY "Own requests and admins" ON public.data_subject_requests
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.data_subject_requests FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public._dsr_label(p_type text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_type WHEN 'access' THEN 'a copy of your data' WHEN 'portability' THEN 'your data to take elsewhere'
    WHEN 'rectification' THEN 'a correction' WHEN 'erasure' THEN 'deletion' WHEN 'restriction' THEN 'a pause on using your data'
    WHEN 'objection' THEN 'an objection' WHEN 'withdraw_consent' THEN 'withdrawing consent'
    WHEN 'automated_decision' THEN 'a human review' WHEN 'complaint' THEN 'a complaint' ELSE 'a privacy request' END
$$;

CREATE OR REPLACE FUNCTION public._notify_admins_of_request(p_id bigint, p_type text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a uuid;
BEGIN
  FOR a IN SELECT DISTINCT user_id FROM user_roles WHERE role::text = 'admin' LOOP
    PERFORM public.create_notification(a, 'privacy_request', 'New privacy request',
      'Someone asked for ' || public._dsr_label(p_type) || '. Answer within ' || public._setting_int('dsar_response_days', 30) || ' days.',
      jsonb_build_object('request_id', p_id, 'action_url', '/admin?section=privacy'), 'high');
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public._notify_admins_of_request(bigint, text) FROM PUBLIC, anon, authenticated;

-- Signed-in people.
CREATE OR REPLACE FUNCTION public.submit_data_request(p_type text, p_details text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_id bigint; v_phone text; v_name text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501'; END IF;
  IF p_type NOT IN ('access', 'portability', 'rectification', 'erasure', 'restriction', 'objection',
                    'withdraw_consent', 'automated_decision', 'complaint', 'other') THEN
    RAISE EXCEPTION 'Choose what you are asking for' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM data_subject_requests WHERE user_id = v_uid AND received_at > now() - interval '1 day') >= 5 THEN
    RAISE EXCEPTION 'You have sent several requests today. We will answer those first.' USING ERRCODE = 'IF003';
  END IF;
  SELECT phone, full_name INTO v_phone, v_name FROM profiles WHERE id = v_uid;
  INSERT INTO data_subject_requests (user_id, request_type, source, requester_name, requester_phone, details, due_at,
                                     identity_verified_at, history)
  VALUES (v_uid, p_type, 'app', v_name, v_phone, NULLIF(left(trim(COALESCE(p_details, '')), 4000), ''),
          now() + make_interval(days => public._setting_int('dsar_response_days', 30)),
          now(), -- signed in with phone + PIN: identity is verified
          jsonb_build_array(jsonb_build_object('at', now(), 'status', 'received', 'note', 'Sent from the app')))
  RETURNING id INTO v_id;
  PERFORM public._notify_admins_of_request(v_id, p_type);
  RETURN jsonb_build_object('id', v_id, 'due_at', (SELECT due_at FROM data_subject_requests WHERE id = v_id));
END $$;

-- People without an account (or who can't sign in). Identity is checked by an admin before anything is released.
CREATE OR REPLACE FUNCTION public.submit_public_data_request(p_type text, p_name text, p_email text, p_phone text, p_details text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id bigint; v_email text := NULLIF(lower(trim(COALESCE(p_email, ''))), ''); v_phone text := NULLIF(regexp_replace(COALESCE(p_phone, ''), '[^\d+]', '', 'g'), '');
BEGIN
  IF p_type NOT IN ('access', 'portability', 'rectification', 'erasure', 'restriction', 'objection',
                    'withdraw_consent', 'automated_decision', 'complaint', 'other') THEN
    RAISE EXCEPTION 'Choose what you are asking for' USING ERRCODE = '22023';
  END IF;
  IF length(trim(COALESCE(p_name, ''))) < 2 THEN RAISE EXCEPTION 'Please give your name' USING ERRCODE = '22023'; END IF;
  IF v_email IS NULL AND v_phone IS NULL THEN RAISE EXCEPTION 'Give an email or phone number so we can reply' USING ERRCODE = '22023'; END IF;
  IF v_email IS NOT NULL AND v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'That email doesn''t look right' USING ERRCODE = '22023'; END IF;
  IF (SELECT count(*) FROM data_subject_requests WHERE source = 'public_form' AND received_at > now() - interval '1 day'
        AND (requester_email = v_email OR requester_phone = v_phone)) >= 3
     OR (SELECT count(*) FROM data_subject_requests WHERE source = 'public_form' AND received_at > now() - interval '1 hour') >= 30 THEN
    RAISE EXCEPTION 'We have received several requests. Please email us instead.' USING ERRCODE = 'IF003';
  END IF;
  INSERT INTO data_subject_requests (request_type, source, status, requester_name, requester_email, requester_phone, details, due_at, history)
  VALUES (p_type, 'public_form', 'verifying', left(trim(p_name), 120), left(v_email, 200), left(v_phone, 20),
          NULLIF(left(trim(COALESCE(p_details, '')), 4000), ''),
          now() + make_interval(days => public._setting_int('dsar_response_days', 30)),
          jsonb_build_array(jsonb_build_object('at', now(), 'status', 'verifying', 'note', 'Sent from the website form')))
  RETURNING id INTO v_id;
  PERFORM public._notify_admins_of_request(v_id, p_type);
  RETURN jsonb_build_object('id', v_id);
END $$;
GRANT EXECUTE ON FUNCTION public.submit_public_data_request(text, text, text, text, text) TO anon, authenticated;

-- Admin: move a request along. Extensions are capped and need a reason the person is told.
CREATE OR REPLACE FUNCTION public.admin_update_data_request(p_id bigint, p_status text, p_note text DEFAULT NULL,
  p_response text DEFAULT NULL, p_extend_days integer DEFAULT NULL, p_identity_verified boolean DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r data_subject_requests%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM data_subject_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found' USING ERRCODE = 'P0002'; END IF;
  IF p_status NOT IN ('received', 'verifying', 'in_progress', 'extended', 'completed', 'rejected') THEN
    RAISE EXCEPTION 'Unknown status' USING ERRCODE = '22023';
  END IF;
  IF p_status IN ('completed', 'rejected') AND NULLIF(trim(COALESCE(p_response, r.response, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Write the answer the person will see' USING ERRCODE = '22023';
  END IF;
  IF p_status = 'completed' AND r.request_type IN ('access', 'portability', 'erasure') AND r.identity_verified_at IS NULL
     AND NOT COALESCE(p_identity_verified, false) THEN
    RAISE EXCEPTION 'Check who is asking before you release or delete data' USING ERRCODE = 'IF003';
  END IF;
  IF p_extend_days IS NOT NULL THEN
    IF p_extend_days < 1 OR r.due_at + make_interval(days => p_extend_days)
         > r.received_at + make_interval(days => public._setting_int('dsar_response_days', 30) + public._setting_int('dsar_max_extension_days', 60)) THEN
      RAISE EXCEPTION 'That is longer than the law allows' USING ERRCODE = 'IF003';
    END IF;
    IF NULLIF(trim(COALESCE(p_note, '')), '') IS NULL THEN RAISE EXCEPTION 'Say why you need more time' USING ERRCODE = '22023'; END IF;
  END IF;

  UPDATE data_subject_requests SET
    status = CASE WHEN p_extend_days IS NOT NULL AND p_status NOT IN ('completed', 'rejected') THEN 'extended' ELSE p_status END,
    due_at = CASE WHEN p_extend_days IS NOT NULL THEN due_at + make_interval(days => p_extend_days) ELSE due_at END,
    extended_reason = CASE WHEN p_extend_days IS NOT NULL THEN p_note ELSE extended_reason END,
    identity_verified_at = CASE WHEN p_identity_verified THEN COALESCE(identity_verified_at, now()) ELSE identity_verified_at END,
    response = COALESCE(NULLIF(trim(COALESCE(p_response, '')), ''), response),
    completed_at = CASE WHEN p_status IN ('completed', 'rejected') THEN now() ELSE NULL END,
    assigned_to = COALESCE(assigned_to, auth.uid()),
    history = history || jsonb_build_array(jsonb_build_object('at', now(), 'by', auth.uid(), 'status', p_status,
                'note', NULLIF(trim(COALESCE(p_note, '')), ''), 'extended_days', p_extend_days)),
    updated_at = now()
  WHERE id = p_id RETURNING * INTO r;

  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'privacy_request_' || r.status, 'data_subject_request', p_id::text,
          jsonb_build_object('type', r.request_type, 'extended_days', p_extend_days));
  IF r.user_id IS NOT NULL AND (r.status IN ('completed', 'rejected', 'extended')) THEN
    PERFORM public.create_notification(r.user_id, 'privacy_request',
      CASE r.status WHEN 'completed' THEN 'Your privacy request is done' WHEN 'rejected' THEN 'About your privacy request'
                    ELSE 'We need a little more time' END,
      COALESCE(r.response, r.extended_reason, ''), jsonb_build_object('request_id', p_id, 'action_url', '/dashboard?tab=settings'), 'normal');
  END IF;
  RETURN to_jsonb(r);
END $$;

------------------------------------------------------------------------------
-- 4. Export (right of access and data portability)
------------------------------------------------------------------------------
-- Every public table with a column pointing at the person, found from the foreign keys, so new
-- tables are included without anyone remembering to. Staff columns (who reviewed or approved
-- something) are not the subject's data and are skipped, as are credentials.
CREATE OR REPLACE FUNCTION public._export_user_data(p_uid uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  out jsonb := '{}'::jsonb;
  r record; rows jsonb;
  hidden text[] := ARRAY['token', 'code_hash', 'pin_hash', 'encrypted_password', 'password', 'secret', 'access_token',
                         'refresh_token', 'id_token', 'p256dh', 'auth', 'idempotency_key', 'meet_space_name'];
  sessions_ids bigint[];
BEGIN
  out := out || jsonb_build_object('account', (SELECT jsonb_build_object('id', u.id, 'phone', u.phone,
           'email', CASE WHEN u.email LIKE '%@phone.ifa.invalid' OR u.email LIKE '%@deleted.ifa.invalid' THEN NULL ELSE u.email END,
           'name', u.name, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at, 'phone_confirmed_at', u.phone_confirmed_at)
           FROM auth.users u WHERE u.id = p_uid));
  out := out || jsonb_build_object('sign_ins', COALESCE((SELECT jsonb_agg(jsonb_build_object('created_at', s.created_at, 'expires_at', s.expires_at,
           'ip_address', s.ip_address, 'device', s.user_agent) ORDER BY s.created_at DESC) FROM auth.sessions s WHERE s.user_id = p_uid), '[]'::jsonb));

  FOR r IN
    SELECT DISTINCT cl.relname AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = cl.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f' AND c.confrelid = 'auth.users'::regclass AND array_length(c.conkey, 1) = 1
       AND n.nspname = 'public'
       AND a.attname NOT IN ('reviewed_by', 'resolved_by', 'granted_by', 'approved_by', 'admin_id', 'updated_by',
                             'assigned_to', 'reported_by', 'uploaded_by', 'performed_by')
     ORDER BY 1, 2
  LOOP
    EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(t) - $2), ''[]''::jsonb) FROM public.%I t WHERE t.%I = $1', r.tbl, r.col)
      INTO rows USING p_uid, hidden;
    IF jsonb_array_length(rows) > 0 THEN
      out := jsonb_set(out, ARRAY[r.tbl], COALESCE(out -> r.tbl, '[]'::jsonb) || rows);
    END IF;
  END LOOP;

  -- Consultation content lives on the session, not the person.
  SELECT array_agg(id) INTO sessions_ids FROM sessions WHERE user_id = p_uid OR babalawo_id = p_uid;
  out := out || jsonb_build_object(
    'consultation_notes', COALESCE((SELECT jsonb_agg(to_jsonb(n) ORDER BY n.created_at) FROM consultation_notes n WHERE n.session_id = ANY (sessions_ids)), '[]'::jsonb),
    'session_transcripts', COALESCE((SELECT jsonb_agg(jsonb_build_object('session_id', t.session_id, 'language', t.language, 'text', t.text,
                             'created_at', t.created_at) ORDER BY t.created_at) FROM session_transcripts t WHERE t.session_id = ANY (sessions_ids)), '[]'::jsonb),
    'session_recordings', COALESCE((SELECT jsonb_agg(jsonb_build_object('session_id', x.session_id, 'source', x.source, 'status', x.status,
                             'duration_seconds', x.duration_seconds, 'stored', x.storage_path IS NOT NULL, 'delete_after', x.retention_until))
                             FROM session_recordings x WHERE x.session_id = ANY (sessions_ids)), '[]'::jsonb),
    'ebo_items', COALESCE((SELECT jsonb_agg(to_jsonb(i)) FROM ebo_items i JOIN ebo_prescriptions e ON e.id = i.prescription_id
                             WHERE e.client_id = p_uid OR e.babalawo_id = p_uid), '[]'::jsonb),
    'ebo_proofs', COALESCE((SELECT jsonb_agg(jsonb_build_object('ebo_id', p.prescription_id, 'kind', p.kind, 'status', p.status,
                             'created_at', p.created_at, 'stored', p.storage_path IS NOT NULL)) FROM ebo_proofs p JOIN ebo_prescriptions e ON e.id = p.prescription_id
                             WHERE e.client_id = p_uid OR e.babalawo_id = p_uid), '[]'::jsonb));
  RETURN jsonb_build_object(
    'format', 'ifa.ng personal data export v1',
    'generated_at', now(),
    'controller', (SELECT setting_value FROM admin_settings WHERE setting_key = 'privacy_controller_name'),
    'contact', (SELECT setting_value FROM admin_settings WHERE setting_key = 'privacy_dpo_email'),
    'note', 'Files (recordings, photos, Ebo videos) are listed but not included. Ask us for a copy if you want them.',
    'data', out);
END $$;
REVOKE ALL ON FUNCTION public._export_user_data(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.export_my_data()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501'; END IF;
  IF (SELECT count(*) FROM data_subject_requests WHERE user_id = v_uid AND source = 'self_service'
        AND received_at > now() - interval '1 hour') >= 5 THEN
    RAISE EXCEPTION 'You have downloaded your data several times in the last hour. Try again later.' USING ERRCODE = 'IF003';
  END IF;
  -- Logged as a completed request, for the record of how access requests were answered.
  INSERT INTO data_subject_requests (user_id, request_type, status, source, due_at, completed_at, identity_verified_at, response, history)
  VALUES (v_uid, 'portability', 'completed', 'self_service', now(), now(), now(), 'Downloaded from Settings',
          jsonb_build_array(jsonb_build_object('at', now(), 'status', 'completed', 'note', 'Self-service download')));
  RETURN public._export_user_data(v_uid);
END $$;

CREATE OR REPLACE FUNCTION public.admin_export_user_data(p_user_id uuid, p_request_id bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'privacy_export', 'user', p_user_id::text, jsonb_build_object('request_id', p_request_id));
  RETURN public._export_user_data(p_user_id);
END $$;

------------------------------------------------------------------------------
-- 5. Files waiting to be deleted from storage (the API empties this queue)
------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE IF NOT EXISTS private.storage_deletions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  object_key text NOT NULL,
  reason text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  done_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_storage_deletions_due ON private.storage_deletions (requested_at) WHERE done_at IS NULL;
REVOKE ALL ON private.storage_deletions FROM PUBLIC, anon, authenticated;
GRANT ALL ON private.storage_deletions TO service_role;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'storage_deletions_id_seq') THEN
    EXECUTE 'GRANT USAGE ON SEQUENCE private.storage_deletions_id_seq TO service_role';
  END IF;
  GRANT USAGE ON SCHEMA private TO service_role;
END $$;

CREATE OR REPLACE FUNCTION public._queue_file_deletion(p_key text, p_reason text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO private.storage_deletions (object_key, reason) SELECT p_key, p_reason WHERE NULLIF(p_key, '') IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public._queue_file_deletion(text, text) FROM PUBLIC, anon, authenticated;

-- Removes a session's recording files and transcripts (consent withdrawn, erasure, or retention).
CREATE OR REPLACE FUNCTION public._purge_session_media(p_session_id bigint, p_reason text, p_drop_ai_drafts boolean DEFAULT true)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer := 0; rec record;
BEGIN
  FOR rec IN SELECT id, storage_path FROM session_recordings WHERE session_id = p_session_id AND storage_path IS NOT NULL LOOP
    PERFORM public._queue_file_deletion('session-recordings/' || rec.storage_path, p_reason);
    n := n + 1;
  END LOOP;
  UPDATE session_recordings SET storage_path = NULL, retention_until = LEAST(COALESCE(retention_until, now()), now()),
         status = CASE WHEN status IN ('pending', 'ready', 'processing') THEN 'failed' ELSE status END
   WHERE session_id = p_session_id;
  DELETE FROM session_transcripts WHERE session_id = p_session_id;
  IF p_drop_ai_drafts THEN
    DELETE FROM consultation_notes WHERE session_id = p_session_id AND source = 'ai' AND status = 'draft';
  END IF;
  UPDATE sessions SET recording_status = 'none', recording_last_error = NULL WHERE id = p_session_id
     AND recording_status IN ('awaiting_consent', 'scheduled', 'processing', 'transcribed', 'notes_drafted', 'failed');
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public._purge_session_media(bigint, text, boolean) FROM PUBLIC, anon, authenticated;

------------------------------------------------------------------------------
-- 6. Withdrawing recording / AI consent after the consultation
------------------------------------------------------------------------------
-- Before a session, record_session_consent() changes the choice. Afterwards, either person can
-- still withdraw: the recording and transcript are deleted and AI drafts not yet approved go too.
-- Notes the Babalawo already approved stay as the record of the consultation (delete the account,
-- or send an erasure request, to remove those).
CREATE OR REPLACE FUNCTION public.withdraw_recording_consent(p_session_id bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); s record; v_sessions integer := 0; v_files integer := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501'; END IF;
  FOR s IN SELECT id FROM sessions WHERE (user_id = v_uid OR babalawo_id = v_uid)
            AND (p_session_id IS NULL OR id = p_session_id) LOOP
    UPDATE session_consents SET recording_consent = false, ai_processing_consent = false, withdrawn_at = now()
     WHERE session_id = s.id AND user_id = v_uid AND (recording_consent OR ai_processing_consent);
    IF FOUND OR EXISTS (SELECT 1 FROM session_recordings WHERE session_id = s.id AND storage_path IS NOT NULL) THEN
      v_files := v_files + public._purge_session_media(s.id, 'consent withdrawn');
      v_sessions := v_sessions + 1;
    END IF;
  END LOOP;
  IF p_session_id IS NOT NULL AND v_sessions = 0 AND NOT EXISTS (SELECT 1 FROM sessions WHERE id = p_session_id AND (user_id = v_uid OR babalawo_id = v_uid)) THEN
    RAISE EXCEPTION 'not a participant' USING ERRCODE = '42501';
  END IF;
  INSERT INTO data_subject_requests (user_id, request_type, status, source, due_at, completed_at, identity_verified_at, response, history)
  VALUES (v_uid, 'withdraw_consent', 'completed', 'self_service', now(), now(), now(),
          format('Recording and AI consent withdrawn for %s consultation(s); %s file(s) queued for deletion', v_sessions, v_files),
          jsonb_build_array(jsonb_build_object('at', now(), 'status', 'completed', 'note', 'Self-service withdrawal')));
  RETURN jsonb_build_object('sessions', v_sessions, 'files', v_files);
END $$;

-- Belt and braces: no transcript is ever saved once consent is gone, even if a job was already running.
CREATE OR REPLACE FUNCTION public.guard_transcript_consent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.session_has_full_consent(NEW.session_id) THEN
    RAISE EXCEPTION 'Recording consent was withdrawn for session %', NEW.session_id USING ERRCODE = 'IF005';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_transcript_consent ON public.session_transcripts;
CREATE TRIGGER trg_guard_transcript_consent BEFORE INSERT ON public.session_transcripts
  FOR EACH ROW EXECUTE FUNCTION public.guard_transcript_consent();

------------------------------------------------------------------------------
-- 7. Erasure
------------------------------------------------------------------------------
-- The same checks as before (nothing in flight, no money owed either way), then everything that
-- identifies the person or describes their spiritual life is removed. Kept, without identity:
-- payments, wallet and ledger entries, payouts (tax and company law), sessions' dates and amounts
-- (the other person's history), consent records (proof of what was agreed), and audit logs.
CREATE OR REPLACE FUNCTION public._erase_user(p_uid uuid, p_forfeit_wallet boolean, p_source text, p_actor uuid, p_request_id bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_wallet numeric := 0; v_bab numeric := 0; v_phone text; v_files integer := 0; sess record; pr record; ext text;
BEGIN
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = p_uid AND role::text = 'admin') THEN
    RAISE EXCEPTION 'Admin accounts are removed by another admin' USING ERRCODE = 'IF003';
  END IF;
  IF EXISTS (SELECT 1 FROM sessions s WHERE (s.user_id = p_uid OR s.babalawo_id = p_uid)
               AND s.status IN ('pending', 'confirmed', 'in_progress') AND s.payment_status = 'paid') THEN
    RAISE EXCEPTION 'You have upcoming consultations. Cancel them first (paid ones are refunded by the usual rules).' USING ERRCODE = 'IF003';
  END IF;
  IF EXISTS (SELECT 1 FROM disputes d WHERE d.status IN ('open', 'investigating')
               AND (d.raised_by = p_uid OR d.session_id IN (SELECT id FROM sessions WHERE user_id = p_uid OR babalawo_id = p_uid))) THEN
    RAISE EXCEPTION 'A dispute is still open. We will finish it first.' USING ERRCODE = 'IF003';
  END IF;
  IF EXISTS (SELECT 1 FROM ebo_prescriptions e WHERE (e.client_id = p_uid OR e.babalawo_id = p_uid)
               AND e.status IN ('sent', 'paid', 'in_progress', 'performed', 'disputed')) THEN
    RAISE EXCEPTION 'An Ebo or Etutu is still in progress. Finish or cancel it first.' USING ERRCODE = 'IF003';
  END IF;
  SELECT COALESCE(available_balance, 0) + COALESCE(pending_balance, 0) INTO v_bab FROM babalawo_wallets WHERE babalawo_id = p_uid;
  IF COALESCE(v_bab, 0) > 0 OR EXISTS (SELECT 1 FROM withdrawal_requests WHERE babalawo_id = p_uid AND status IN ('pending', 'approved')) THEN
    RAISE EXCEPTION 'You still have earnings with us. Withdraw them first.' USING ERRCODE = 'IF003';
  END IF;
  SELECT COALESCE(balance, 0) INTO v_wallet FROM wallets WHERE user_id = p_uid;
  IF COALESCE(v_wallet, 0) > 0 AND NOT p_forfeit_wallet THEN
    RAISE EXCEPTION 'Your wallet still has ₦%. Use it first, or confirm you give it up.', to_char(v_wallet, 'FM999G999G999') USING ERRCODE = 'IF004';
  END IF;

  SELECT phone INTO v_phone FROM auth.users WHERE id = p_uid;

  -- Consultation content where they were the client: notes, transcripts, recordings, what they wrote.
  FOR sess IN SELECT id FROM sessions WHERE user_id = p_uid LOOP
    v_files := v_files + public._purge_session_media(sess.id, 'account erased');
    DELETE FROM consultation_notes WHERE session_id = sess.id;
  END LOOP;
  UPDATE sessions SET consultation_topic = NULL, notes = NULL, primary_odu = NULL, other_odus = NULL, ritual_recommendations = NULL,
         items_needed = NULL, warning = NULL, deadline = NULL, next_appointment = NULL, room_url = NULL, meet_uri = NULL, meet_code = NULL
   WHERE user_id = p_uid;
  -- Where they were the Babalawo, recordings go (their voice), but the client keeps approved notes.
  FOR sess IN SELECT id FROM sessions WHERE babalawo_id = p_uid LOOP
    v_files := v_files + public._purge_session_media(sess.id, 'account erased', false);
  END LOOP;
  -- Ebo: amounts stay for the books; descriptions, notes and proof videos go.
  FOR pr IN SELECT x.id, x.storage_path FROM ebo_proofs x JOIN ebo_prescriptions e ON e.id = x.prescription_id
            WHERE (e.client_id = p_uid OR e.babalawo_id = p_uid) AND x.storage_path IS NOT NULL LOOP
    PERFORM public._queue_file_deletion(pr.storage_path, 'account erased');
    v_files := v_files + 1;
  END LOOP;
  UPDATE ebo_proofs SET storage_path = NULL, check_result = NULL
   WHERE prescription_id IN (SELECT id FROM ebo_prescriptions WHERE client_id = p_uid OR babalawo_id = p_uid);
  UPDATE ebo_prescriptions SET description = NULL, performance_note = NULL, decline_reason = NULL, cancel_reason = NULL
   WHERE client_id = p_uid;
  UPDATE disputes SET reason = '[removed at the person''s request]' WHERE raised_by = p_uid;

  -- Who they were.
  UPDATE profiles SET full_name = 'Deleted user', email = 'deleted-' || p_uid || '@deleted.ifa.invalid', phone = NULL, avatar_url = NULL, timezone = NULL,
         whatsapp_opt_in = false, sms_opt_in = false WHERE id = p_uid;
  UPDATE babalawos SET is_active = false, current_status = 'offline', bio = NULL, specialties = NULL, languages = NULL,
         city = NULL, region = NULL, country = NULL, profile_picture_url = NULL, google_email = NULL WHERE user_id = p_uid;
  UPDATE babalawo_applications SET full_name = 'Deleted user', phone = NULL, email = NULL, city = NULL, ile_name = NULL, bio = NULL,
         referral = NULL, review_notes = NULL WHERE user_id = p_uid;
  FOREACH ext IN ARRAY ARRAY['png', 'jpg', 'webp'] LOOP
    PERFORM public._queue_file_deletion('avatars/' || p_uid || '.' || ext, 'account erased');
  END LOOP;
  DELETE FROM babalawo_bank_details WHERE babalawo_id = p_uid;
  DELETE FROM availability WHERE babalawo_id = p_uid;
  DELETE FROM availability_exceptions WHERE babalawo_id = p_uid;
  DELETE FROM babalawo_time_off WHERE babalawo_id = p_uid;
  DELETE FROM push_subscriptions WHERE user_id = p_uid;
  DELETE FROM user_notification_preferences WHERE user_id = p_uid;
  DELETE FROM notifications WHERE user_id = p_uid;
  DELETE FROM reminders WHERE user_id = p_uid;
  DELETE FROM ritual_reminders WHERE user_id = p_uid;
  DELETE FROM slot_locks WHERE locked_by_user_id = p_uid;
  UPDATE reviews SET comment = NULL WHERE user_id = p_uid;
  UPDATE session_logs SET metadata = '{}'::jsonb WHERE user_id = p_uid;

  -- How they signed in.
  DELETE FROM auth.sessions WHERE user_id = p_uid;
  DELETE FROM auth.accounts WHERE user_id = p_uid;
  DELETE FROM auth.phone_pins WHERE user_id = p_uid;
  DELETE FROM auth.pin_tickets WHERE user_id = p_uid;
  IF v_phone IS NOT NULL THEN
    DELETE FROM auth.phone_otps WHERE phone = v_phone;
    DELETE FROM auth.rate_events WHERE key = v_phone;
  END IF;
  UPDATE auth.users SET email = 'deleted-' || p_uid || '@deleted.ifa.invalid', phone = NULL, name = 'Deleted user', image = NULL,
         encrypted_password = NULL, raw_user_meta_data = '{}'::jsonb, deleted_at = now(), banned_until = 'infinity'
   WHERE id = p_uid;

  IF v_wallet > 0 THEN
    INSERT INTO admin_audit_log(admin_id, action, target_type, target_id, details) VALUES (p_actor, 'account_deleted_wallet_forfeit', 'user', p_uid::text,
      jsonb_build_object('amount', v_wallet));
  END IF;
  INSERT INTO admin_audit_log(admin_id, action, target_type, target_id, details) VALUES (p_actor, 'account_erased', 'user', p_uid::text,
    jsonb_build_object('source', p_source, 'request_id', p_request_id, 'files_queued', v_files));
  IF p_request_id IS NULL THEN
    INSERT INTO data_subject_requests (user_id, request_type, status, source, due_at, completed_at, identity_verified_at, response, history)
    VALUES (p_uid, 'erasure', 'completed', CASE WHEN p_source = 'admin' THEN 'admin' ELSE 'self_service' END, now(), now(), now(),
            'Account deleted. Payment records are kept without your details for the legal retention period.',
            jsonb_build_array(jsonb_build_object('at', now(), 'status', 'completed', 'by', p_actor)));
  END IF;
  RETURN jsonb_build_object('deleted', true, 'files_queued', v_files);
END $$;
REVOKE ALL ON FUNCTION public._erase_user(uuid, boolean, text, uuid, bigint) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.delete_my_account(p_confirm text, p_forfeit_wallet boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501'; END IF;
  IF p_confirm IS DISTINCT FROM 'DELETE' THEN RAISE EXCEPTION 'Type DELETE to confirm' USING ERRCODE = 'IF003'; END IF;
  IF public.is_admin() THEN RAISE EXCEPTION 'Admin accounts are removed by another admin' USING ERRCODE = 'IF003'; END IF;
  PERFORM public._erase_user(v_uid, p_forfeit_wallet, 'self_service', v_uid);
  RETURN jsonb_build_object('deleted', true);
END $$;
REVOKE ALL ON FUNCTION public.delete_my_account(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account(text, boolean) TO authenticated;

-- An admin carries out an erasure request (for example someone who lost their phone).
CREATE OR REPLACE FUNCTION public.admin_erase_user(p_user_id uuid, p_request_id bigint, p_forfeit_wallet boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r data_subject_requests%ROWTYPE; v jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM data_subject_requests WHERE id = p_request_id;
  IF NOT FOUND OR r.request_type <> 'erasure' THEN RAISE EXCEPTION 'Link this to the person''s erasure request' USING ERRCODE = 'IF003'; END IF;
  IF r.identity_verified_at IS NULL THEN RAISE EXCEPTION 'Check who is asking before you delete anything' USING ERRCODE = 'IF003'; END IF;
  IF r.user_id IS NOT NULL AND r.user_id <> p_user_id THEN RAISE EXCEPTION 'That request is for a different account' USING ERRCODE = 'IF003'; END IF;
  v := public._erase_user(p_user_id, p_forfeit_wallet, 'admin', auth.uid(), p_request_id);
  UPDATE data_subject_requests SET user_id = p_user_id, status = 'completed', completed_at = now(),
         response = COALESCE(response, 'Your account and personal data have been deleted. Payment records are kept without your details for the legal retention period.'),
         history = history || jsonb_build_array(jsonb_build_object('at', now(), 'by', auth.uid(), 'status', 'completed', 'note', 'Account erased')),
         updated_at = now()
   WHERE id = p_request_id;
  RETURN v;
END $$;

------------------------------------------------------------------------------
-- 8. Retention schedule
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.retention_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ran_at timestamptz NOT NULL DEFAULT now(),
  removed jsonb NOT NULL
);
ALTER TABLE public.retention_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read retention runs" ON public.retention_runs;
CREATE POLICY "Admins read retention runs" ON public.retention_runs FOR SELECT USING (public.is_admin());
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.retention_runs FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.run_retention()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  out jsonb := '{}'::jsonb; n integer; r record;
  d_notif integer := public._setting_int('retention_notifications_days', 365);
  d_msg integer := public._setting_int('retention_message_log_days', 90);
  d_sec integer := public._setting_int('retention_security_log_days', 90);
  d_slog integer := public._setting_int('retention_session_log_days', 730);
  d_rec integer := public._setting_int('recording_retention_days', 90);
  d_ebo integer := public._setting_int('retention_ebo_proof_days', 365);
  d_app integer := public._setting_int('retention_applications_days', 365);
  y_audit integer := public._setting_int('retention_audit_years', 6);
  y_dsr integer := public._setting_int('retention_privacy_requests_years', 3);
BEGIN
  DELETE FROM notifications WHERE created_at < now() - make_interval(days => d_notif);
  GET DIAGNOSTICS n = ROW_COUNT; out := out || jsonb_build_object('notifications', n);

  DELETE FROM notification_outbox WHERE status IN ('sent', 'failed', 'skipped') AND created_at < now() - make_interval(days => d_msg);
  GET DIAGNOSTICS n = ROW_COUNT; out := out || jsonb_build_object('message_log', n);

  DELETE FROM auth.phone_otps WHERE created_at < now() - make_interval(days => LEAST(d_sec, 30));
  GET DIAGNOSTICS n = ROW_COUNT; out := out || jsonb_build_object('sign_in_codes', n);
  DELETE FROM auth.rate_events WHERE at < now() - interval '7 days';
  GET DIAGNOSTICS n = ROW_COUNT; out := out || jsonb_build_object('rate_limit_records', n);
  DELETE FROM auth.sessions WHERE expires_at < now() - make_interval(days => d_sec);
  GET DIAGNOSTICS n = ROW_COUNT; out := out || jsonb_build_object('expired_sign_ins', n);
  DELETE FROM auth.verifications WHERE expires_at < now() - interval '1 day';
  DELETE FROM auth.pin_tickets WHERE expires_at < now() - interval '1 day';
  DELETE FROM payment_audit_log WHERE created_at < now() - make_interval(years => y_audit);
  UPDATE payment_audit_log SET ip_address = NULL, user_agent = NULL
   WHERE created_at < now() - make_interval(days => d_sec) AND (ip_address IS NOT NULL OR user_agent IS NOT NULL);

  DELETE FROM session_logs WHERE "timestamp" < now() - make_interval(days => d_slog);
  GET DIAGNOSTICS n = ROW_COUNT; out := out || jsonb_build_object('session_logs', n);

  -- Recordings past their date (the worker also does this) and raw transcripts of the same age.
  n := 0;
  FOR r IN SELECT id, storage_path FROM session_recordings WHERE retention_until < now() AND storage_path IS NOT NULL LOOP
    PERFORM public._queue_file_deletion('session-recordings/' || r.storage_path, 'retention');
    UPDATE session_recordings SET storage_path = NULL WHERE id = r.id;
    n := n + 1;
  END LOOP;
  out := out || jsonb_build_object('recordings', n);
  DELETE FROM session_transcripts WHERE created_at < now() - make_interval(days => d_rec);
  GET DIAGNOSTICS n = ROW_COUNT; out := out || jsonb_build_object('transcripts', n);

  -- Ebo proof videos once the Ebo has been closed for a while.
  n := 0;
  FOR r IN SELECT p.id, p.storage_path FROM ebo_proofs p JOIN ebo_prescriptions e ON e.id = p.prescription_id
            WHERE p.storage_path IS NOT NULL AND e.status IN ('completed', 'cancelled', 'refunded', 'declined', 'expired')
              AND COALESCE(e.completed_at, e.cancelled_at, e.declined_at, e.updated_at) < now() - make_interval(days => d_ebo) LOOP
    PERFORM public._queue_file_deletion(r.storage_path, 'retention');
    UPDATE ebo_proofs SET storage_path = NULL WHERE id = r.id;
    n := n + 1;
  END LOOP;
  out := out || jsonb_build_object('ebo_proofs', n);

  DELETE FROM babalawo_applications WHERE status = 'rejected'
     AND COALESCE(reviewed_at, updated_at, created_at) < now() - make_interval(days => d_app);
  GET DIAGNOSTICS n = ROW_COUNT; out := out || jsonb_build_object('declined_applications', n);

  DELETE FROM push_subscriptions WHERE COALESCE(last_success_at, updated_at, created_at) < now() - interval '270 days';
  GET DIAGNOSTICS n = ROW_COUNT; out := out || jsonb_build_object('stale_push_devices', n);

  DELETE FROM admin_audit_log WHERE created_at < now() - make_interval(years => y_audit);
  DELETE FROM data_subject_requests WHERE status IN ('completed', 'rejected') AND completed_at < now() - make_interval(years => y_dsr);
  GET DIAGNOSTICS n = ROW_COUNT; out := out || jsonb_build_object('closed_privacy_requests', n);
  DELETE FROM data_breaches WHERE status = 'closed' AND closed_at < now() - make_interval(years => GREATEST(y_dsr, 5));
  DELETE FROM private.storage_deletions WHERE done_at < now() - interval '90 days';
  DELETE FROM retention_runs WHERE ran_at < now() - interval '400 days';

  INSERT INTO retention_runs (removed) VALUES (out);
  RETURN out;
END $$;

------------------------------------------------------------------------------
-- 9. Breach register
------------------------------------------------------------------------------
-- NDPA s.40 / GDPR Art. 33: tell the NDPC (and the ICO / EU authority when UK or EU people are
-- affected) within 72 hours of becoming aware, unless the breach is unlikely to put people at
-- risk; tell the people affected without undue delay when the risk is high. Every breach is
-- recorded here, including those not reported, with the reason.
CREATE TABLE IF NOT EXISTS public.data_breaches (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL,
  description text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  occurred_from timestamptz,
  occurred_to timestamptz,
  data_categories text[] NOT NULL DEFAULT '{}',
  special_category boolean NOT NULL DEFAULT false,
  people_affected integer,
  countries text[] NOT NULL DEFAULT '{}',
  risk text NOT NULL DEFAULT 'unknown' CHECK (risk IN ('unknown', 'low', 'medium', 'high')),
  containment text,
  ndpc_notified_at timestamptz,
  ico_notified_at timestamptz,
  eu_authority_notified_at timestamptz,
  people_notified_at timestamptz,
  not_reported_reason text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'contained', 'closed')),
  closed_at timestamptz,
  reported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.data_breaches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage breaches" ON public.data_breaches;
CREATE POLICY "Admins manage breaches" ON public.data_breaches FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.audit_data_breach()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN NEW.reported_by := COALESCE(NEW.reported_by, auth.uid()); END IF;
  NEW.updated_at := now();
  IF NEW.status = 'closed' AND NEW.closed_at IS NULL THEN NEW.closed_at := now(); END IF;
  IF NEW.status = 'closed' AND NEW.ndpc_notified_at IS NULL AND NULLIF(trim(COALESCE(NEW.not_reported_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Record when the NDPC was told, or why it was not' USING ERRCODE = 'IF003';
  END IF;
  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'breach_' || lower(TG_OP), 'data_breach', COALESCE(NEW.id::text, 'new'),
          jsonb_build_object('status', NEW.status, 'risk', NEW.risk));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_audit_data_breach ON public.data_breaches;
CREATE TRIGGER trg_audit_data_breach BEFORE INSERT OR UPDATE ON public.data_breaches
  FOR EACH ROW EXECUTE FUNCTION public.audit_data_breach();

------------------------------------------------------------------------------
-- 10. Admin overview
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_privacy_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'open_requests', (SELECT count(*) FROM data_subject_requests WHERE status NOT IN ('completed', 'rejected')),
    'overdue_requests', (SELECT count(*) FROM data_subject_requests WHERE status NOT IN ('completed', 'rejected') AND due_at < now()),
    'open_breaches', (SELECT count(*) FROM data_breaches WHERE status <> 'closed'),
    'last_retention_run', (SELECT jsonb_build_object('at', ran_at, 'removed', removed) FROM retention_runs ORDER BY ran_at DESC LIMIT 1),
    'files_waiting', (SELECT count(*) FROM private.storage_deletions WHERE done_at IS NULL),
    'files_failing', (SELECT count(*) FROM private.storage_deletions WHERE done_at IS NULL AND attempts >= 5),
    'consents', COALESCE((SELECT jsonb_object_agg(purpose, jsonb_build_object('granted', g, 'withdrawn', w)) FROM (
        SELECT c.purpose, count(*) FILTER (WHERE c.granted) g, count(*) FILTER (WHERE NOT c.granted) w
          FROM (SELECT DISTINCT ON (user_id, purpose) user_id, purpose, granted FROM privacy_consents
                 ORDER BY user_id, purpose, created_at DESC, id DESC) c GROUP BY c.purpose) x), '{}'::jsonb),
    'notice_version', public.privacy_notice_version());
END $$;

------------------------------------------------------------------------------
-- Grants: internal helpers are closed; the app-facing ones are for signed-in people.
------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.record_consents(jsonb, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_privacy_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_data_request(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.export_my_data() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.withdraw_recording_consent(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_data_request(bigint, text, text, text, integer, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_export_user_data(uuid, bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_erase_user(uuid, bigint, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_privacy_overview() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.run_retention() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_transcript_consent() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_data_breach() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_consents(jsonb, text, text), public.my_privacy_status(), public.submit_data_request(text, text),
  public.export_my_data(), public.withdraw_recording_consent(bigint), public.admin_update_data_request(bigint, text, text, text, integer, boolean),
  public.admin_export_user_data(uuid, bigint), public.admin_erase_user(uuid, bigint, boolean), public.admin_privacy_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_retention() TO service_role;
