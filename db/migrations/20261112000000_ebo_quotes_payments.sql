-- =====================================================================
-- Ebo / Etutu: itemised quotes, in-app payment, money held until proof.
--
-- The Babalawo proposes a ritual date and time with the quote. Paying accepts it,
-- and the client chooses to join live ('present': a linked ritual session with a
-- Meet link and reminders) or to be absent ('absent': the Babalawo must upload a
-- video, with audio, showing the items and the prayers naming the client).
--
-- Flow (performed_by = 'babalawo'):
--   draft -> sent -> paid -> in_progress -> performed -> completed
--   sent -> declined | expired | cancelled
--   paid -> refunded                         (Babalawo cancels before starting)
--   paid | in_progress | performed -> disputed -> completed | refunded
-- Flow (performed_by = 'client', guidance only, no money):
--   draft -> sent -> in_progress -> completed (client marks progress)
--
-- Money: the Ebo total is items + Owó Ifá, all of it the Babalawo's. The platform
-- fee (ebo_platform_fee_percent, set by admins, locked into the quote when it is
-- sent) is added on top, so the client pays amount_due = total + platform_fee.
-- The Babalawo's share is held as pending.
-- The items part is released when the Babalawo marks the Ebo started (so they
-- can buy the items); the remainder when the client confirms the proof, or
-- automatically ebo_confirm_hours after proof if nobody disputes.
--
-- Every write goes through the functions below. Clients and Babalawos can only
-- read rows directly. This also closes the hole where a Babalawo could insert
-- an Ebo with any client_id.
-- =====================================================================

-- ---------------------------------------------------------------- settings
INSERT INTO public.admin_settings (setting_key, setting_value, description) VALUES
  ('ebo_platform_fee_percent', '10', 'Platform fee (%) added on top of each Ebo total'),
  ('ebo_quote_expiry_days', '7', 'Days a client has to pay an Ebo quote'),
  ('ebo_confirm_hours', '72', 'Hours a client has to confirm or dispute after proof, before money is released automatically'),
  ('ebo_max_total', '5000000', 'Largest Ebo quote (NGN)')
ON CONFLICT (setting_key) DO NOTHING;

-- ---------------------------------------------------------------- catalogue
CREATE TABLE IF NOT EXISTS public.ebo_catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  english_name text CHECK (english_name IS NULL OR char_length(english_name) <= 120),
  unit text CHECK (unit IS NULL OR char_length(unit) <= 30),
  min_price numeric(12,2) CHECK (min_price IS NULL OR min_price >= 0),
  max_price numeric(12,2) CHECK (max_price IS NULL OR max_price >= 0),
  active boolean NOT NULL DEFAULT true,
  position int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (min_price IS NULL OR max_price IS NULL OR max_price >= min_price)
);
-- Common items, no prices: admins set the suggested ranges.
INSERT INTO public.ebo_catalog_items (name, english_name, unit, position) VALUES
  ('Obì àbàtà', 'Kola nut', 'piece', 10),
  ('Orógbó', 'Bitter kola', 'piece', 20),
  ('Atare', 'Alligator pepper', 'pod', 30),
  ('Epo pupa', 'Palm oil', 'bottle', 40),
  ('Oyin', 'Honey', 'bottle', 50),
  ('Ẹ̀kọ', 'Corn pap wrap', 'wrap', 60),
  ('Ẹyẹlé', 'Pigeon', 'bird', 70),
  ('Àkùkọ adìyẹ', 'Cockerel', 'bird', 80),
  ('Adìyẹ', 'Hen', 'bird', 90),
  ('Ìgbín', 'Snail', 'piece', 100),
  ('Ẹja àrọ̀', 'Catfish', 'piece', 110),
  ('Eku', 'Bush rat', 'piece', 120),
  ('Ewúrẹ́', 'She-goat', 'animal', 130),
  ('Òbúkọ', 'He-goat', 'animal', 140),
  ('Àgùtàn', 'Sheep', 'animal', 150),
  ('Aṣọ funfun', 'White cloth', 'yard', 160),
  ('Ẹfun', 'White chalk', 'piece', 170),
  ('Osùn', 'Camwood', 'piece', 180),
  ('Ọtí', 'Gin / schnapps', 'bottle', 190),
  ('Owó ẹyọ', 'Cowries', 'set', 200)
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------- prescriptions
ALTER TABLE public.ebo_prescriptions
  ADD COLUMN IF NOT EXISTS performed_by text NOT NULL DEFAULT 'babalawo',
  ADD COLUMN IF NOT EXISTS owo_ifa numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS items_total numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fee_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS babalawo_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS items_released numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ai_suggested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS performed_at timestamptz,
  ADD COLUMN IF NOT EXISTS performance_note text,
  ADD COLUMN IF NOT EXISTS confirm_by timestamptz,
  ADD COLUMN IF NOT EXISTS declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS decline_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS dispute_id uuid,
  ADD COLUMN IF NOT EXISTS ritual_at timestamptz,
  ADD COLUMN IF NOT EXISTS ritual_minutes int NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS attendance text,
  ADD COLUMN IF NOT EXISTS ritual_session_id bigint REFERENCES public.sessions(id) ON DELETE SET NULL;
ALTER TABLE public.ebo_prescriptions DROP CONSTRAINT IF EXISTS ebo_prescriptions_ritual_check;
ALTER TABLE public.ebo_prescriptions ADD CONSTRAINT ebo_prescriptions_ritual_check CHECK (
  ritual_minutes BETWEEN 15 AND 480 AND (attendance IS NULL OR attendance IN ('present','absent')));

-- A ritual the client joins live is a session of its own (Meet link, reminders, Join button).
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS session_type text NOT NULL DEFAULT 'consultation';
ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_session_type_check;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_session_type_check CHECK (session_type IN ('consultation','ebo_ritual'));
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS ebo_id uuid;
ALTER TABLE public.ebo_prescriptions ADD COLUMN IF NOT EXISTS total numeric(12,2)
  GENERATED ALWAYS AS (items_total + owo_ifa) STORED;
ALTER TABLE public.ebo_prescriptions ADD COLUMN IF NOT EXISTS platform_fee numeric(12,2)
  GENERATED ALWAYS AS (round((items_total + owo_ifa) * platform_fee_percent / 100, 2)) STORED;
ALTER TABLE public.ebo_prescriptions ADD COLUMN IF NOT EXISTS amount_due numeric(12,2)
  GENERATED ALWAYS AS (items_total + owo_ifa + round((items_total + owo_ifa) * platform_fee_percent / 100, 2)) STORED;

-- Rows from the old to-do list become client-performed guidance.
ALTER TABLE public.ebo_prescriptions DROP CONSTRAINT IF EXISTS ebo_prescriptions_status_check;
UPDATE public.ebo_prescriptions SET status = 'sent', performed_by = 'client', sent_at = created_at WHERE status = 'prescribed';
ALTER TABLE public.ebo_prescriptions ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE public.ebo_prescriptions ADD CONSTRAINT ebo_prescriptions_status_check CHECK (status IN
  ('draft','sent','paid','in_progress','performed','completed','declined','expired','cancelled','refunded','disputed'));
ALTER TABLE public.ebo_prescriptions DROP CONSTRAINT IF EXISTS ebo_prescriptions_performed_by_check;
ALTER TABLE public.ebo_prescriptions ADD CONSTRAINT ebo_prescriptions_performed_by_check CHECK (performed_by IN ('babalawo','client'));
ALTER TABLE public.ebo_prescriptions DROP CONSTRAINT IF EXISTS ebo_prescriptions_money_check;
ALTER TABLE public.ebo_prescriptions ADD CONSTRAINT ebo_prescriptions_money_check CHECK (
  owo_ifa >= 0 AND items_total >= 0 AND items_released >= 0 AND refunded_amount >= 0);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ebo_payment_reference ON public.ebo_prescriptions(payment_reference) WHERE payment_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS ebo_prescriptions_status ON public.ebo_prescriptions (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS ebo_prescriptions_babalawo ON public.ebo_prescriptions (babalawo_id, status);

CREATE TABLE IF NOT EXISTS public.ebo_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES public.ebo_prescriptions(id) ON DELETE CASCADE,
  catalog_item_id uuid REFERENCES public.ebo_catalog_items(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  unit text CHECK (unit IS NULL OR char_length(unit) <= 30),
  quantity numeric(10,2) NOT NULL CHECK (quantity > 0 AND quantity <= 1000),
  unit_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  line_total numeric(12,2) GENERATED ALWAYS AS (round(quantity * unit_price, 2)) STORED,
  position int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ebo_items_prescription ON public.ebo_items (prescription_id, position);

CREATE TABLE IF NOT EXISTS public.ebo_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES public.ebo_prescriptions(id) ON DELETE CASCADE,
  actor uuid,
  event text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ebo_events_prescription ON public.ebo_events (prescription_id, created_at);

CREATE TABLE IF NOT EXISTS public.ebo_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES public.ebo_prescriptions(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'video' CHECK (kind IN ('video','photo')),
  -- videos arrive 'processing'; the worker compresses them for storage and playback, then 'ready'
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('processing','ready','failed')),
  storage_path text NOT NULL,
  content_type text NOT NULL,
  size_bytes bigint NOT NULL,
  original_size_bytes bigint,
  duration_seconds int,
  -- what the worker heard: {name_heard, items_heard[], items_missing[], transcript_excerpt}
  check_result jsonb,
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  uploaded_by uuid NOT NULL,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ebo_proofs_processing ON public.ebo_proofs (created_at) WHERE status = 'processing';
CREATE INDEX IF NOT EXISTS ebo_proofs_prescription ON public.ebo_proofs (prescription_id, created_at);

-- ---------------------------------------------------------------- link to money tables
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS ebo_id uuid REFERENCES public.ebo_prescriptions(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_ebo ON public.payments(ebo_id) WHERE ebo_id IS NOT NULL;

ALTER TABLE public.payment_intents ADD COLUMN IF NOT EXISTS ebo_id uuid REFERENCES public.ebo_prescriptions(id) ON DELETE SET NULL;
ALTER TABLE public.payment_intents ADD COLUMN IF NOT EXISTS ebo_attendance text CHECK (ebo_attendance IS NULL OR ebo_attendance IN ('present','absent'));
ALTER TABLE public.payment_intents DROP CONSTRAINT IF EXISTS payment_intents_kind_check;
ALTER TABLE public.payment_intents ADD CONSTRAINT payment_intents_kind_check CHECK (kind IN ('session','wallet_topup','ebo'));

ALTER TABLE public.babalawo_ledger ADD COLUMN IF NOT EXISTS ebo_id uuid REFERENCES public.ebo_prescriptions(id) ON DELETE SET NULL;
ALTER TABLE public.babalawo_ledger DROP CONSTRAINT IF EXISTS babalawo_ledger_entry_type_check;
ALTER TABLE public.babalawo_ledger ADD CONSTRAINT babalawo_ledger_entry_type_check CHECK (entry_type IN
  ('earning','release','refund_reversal','withdrawal_hold','withdrawal_reject','withdrawal_paid','adjustment',
   'ebo_earning','ebo_items_release','ebo_final_release','ebo_reversal'));
-- one of each per Ebo => replays can never double pay
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_ebo_entry ON public.babalawo_ledger(ebo_id, entry_type) WHERE ebo_id IS NOT NULL;

ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_transaction_source_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_transaction_source_check
  CHECK (transaction_source IN ('payment_gateway','session_payment','ebo_payment','refund','admin_adjustment','rollback'));

ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS ebo_id uuid REFERENCES public.ebo_prescriptions(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_disputes_ebo ON public.disputes(ebo_id) WHERE ebo_id IS NOT NULL;

ALTER TABLE public.notification_outbox ADD COLUMN IF NOT EXISTS ebo_id uuid REFERENCES public.ebo_prescriptions(id) ON DELETE CASCADE;
ALTER TABLE public.notification_outbox DROP CONSTRAINT IF EXISTS notification_outbox_kind_check;
ALTER TABLE public.notification_outbox ADD CONSTRAINT notification_outbox_kind_check CHECK (kind IN
  ('meet_link','reminder_24h','reminder_1h','rescheduled','completed','notes_ready','fallback_video',
   'ebo_sent','ebo_paid','ebo_performed'));

-- ---------------------------------------------------------------- read access
DROP POLICY IF EXISTS ebo_babalawo_all ON public.ebo_prescriptions;
DROP POLICY IF EXISTS ebo_client_read ON public.ebo_prescriptions;
DROP POLICY IF EXISTS ebo_admin_read ON public.ebo_prescriptions;
DROP POLICY IF EXISTS ebo_babalawo_read ON public.ebo_prescriptions;
CREATE POLICY ebo_babalawo_read ON public.ebo_prescriptions FOR SELECT TO authenticated USING (babalawo_id = auth.uid());
CREATE POLICY ebo_client_read ON public.ebo_prescriptions FOR SELECT TO authenticated USING (client_id = auth.uid() AND status <> 'draft');
CREATE POLICY ebo_admin_read ON public.ebo_prescriptions FOR SELECT TO authenticated USING (public.is_admin());
REVOKE INSERT, UPDATE, DELETE ON public.ebo_prescriptions FROM anon, authenticated;

ALTER TABLE public.ebo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ebo_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ebo_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ebo_catalog_items ENABLE ROW LEVEL SECURITY;
-- Children are visible exactly when the parent is (the parent's policies apply inside EXISTS).
DROP POLICY IF EXISTS ebo_items_read ON public.ebo_items;
CREATE POLICY ebo_items_read ON public.ebo_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ebo_prescriptions e WHERE e.id = prescription_id));
DROP POLICY IF EXISTS ebo_events_read ON public.ebo_events;
CREATE POLICY ebo_events_read ON public.ebo_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ebo_prescriptions e WHERE e.id = prescription_id));
DROP POLICY IF EXISTS ebo_proofs_read ON public.ebo_proofs;
CREATE POLICY ebo_proofs_read ON public.ebo_proofs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ebo_prescriptions e WHERE e.id = prescription_id));
DROP POLICY IF EXISTS ebo_catalog_read ON public.ebo_catalog_items;
CREATE POLICY ebo_catalog_read ON public.ebo_catalog_items FOR SELECT TO authenticated USING (active OR public.is_admin());
DROP POLICY IF EXISTS ebo_catalog_admin ON public.ebo_catalog_items;
CREATE POLICY ebo_catalog_admin ON public.ebo_catalog_items FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
REVOKE ALL ON public.ebo_items, public.ebo_events, public.ebo_proofs FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.ebo_items, public.ebo_events, public.ebo_proofs FROM authenticated;
REVOKE ALL ON public.ebo_catalog_items FROM anon;
GRANT SELECT ON public.ebo_items, public.ebo_events, public.ebo_proofs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ebo_catalog_items TO authenticated;

-- Admin oversight: overdue and price-outlier flags per Ebo. Rows follow the caller's own access.
CREATE OR REPLACE VIEW public.ebo_flags WITH (security_invoker = true) AS
SELECT e.id,
       (e.status IN ('paid','in_progress') AND e.due_date IS NOT NULL AND e.due_date < (now() AT TIME ZONE 'Africa/Lagos')::date) AS overdue,
       (SELECT count(*) FROM public.ebo_items i JOIN public.ebo_catalog_items c ON c.id = i.catalog_item_id
         WHERE i.prescription_id = e.id
           AND ((c.max_price IS NOT NULL AND i.unit_price > c.max_price)
             OR (c.min_price IS NOT NULL AND i.unit_price > 0 AND i.unit_price < c.min_price)))::int AS price_outliers
  FROM public.ebo_prescriptions e;
GRANT SELECT ON public.ebo_flags TO authenticated;

-- ===================================================================== helpers
CREATE OR REPLACE FUNCTION public._ebo_log(p_id uuid, p_event text, p_data jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO ebo_events(prescription_id, actor, event, data) VALUES (p_id, auth.uid(), p_event, COALESCE(p_data, '{}'::jsonb));
$$;

CREATE OR REPLACE FUNCTION public._ebo_items_snapshot(p_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'quantity', quantity, 'unit', unit, 'unit_price', unit_price)
                            ORDER BY position), '[]'::jsonb)
    FROM ebo_items WHERE prescription_id = p_id;
$$;

-- Replace an Ebo's item lines from JSON: [{name, quantity, unit, unit_price, catalog_item_id}]
CREATE OR REPLACE FUNCTION public._ebo_replace_items(p_id uuid, p_items jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it jsonb; n int := 0; v_name text; v_qty numeric; v_price numeric; v_cat uuid;
BEGIN
  IF p_items IS NULL THEN p_items := '[]'::jsonb; END IF;
  IF jsonb_typeof(p_items) <> 'array' THEN RAISE EXCEPTION 'Items must be a list'; END IF;
  IF jsonb_array_length(p_items) > 40 THEN RAISE EXCEPTION 'An Ebo can have at most 40 items'; END IF;
  DELETE FROM ebo_items WHERE prescription_id = p_id;
  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_name := btrim(COALESCE(it->>'name', ''));
    IF v_name = '' THEN RAISE EXCEPTION 'Every item needs a name'; END IF;
    BEGIN
      v_qty := COALESCE(NULLIF(it->>'quantity', '')::numeric, 1);
      v_price := COALESCE(NULLIF(it->>'unit_price', '')::numeric, 0);
      v_cat := NULLIF(it->>'catalog_item_id', '')::uuid;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'Check the quantity and price for %', v_name;
    END;
    IF v_qty <= 0 OR v_qty > 1000 THEN RAISE EXCEPTION 'Quantity for % must be between 1 and 1000', v_name; END IF;
    IF v_price < 0 OR v_price > 10000000 THEN RAISE EXCEPTION 'Price for % is out of range', v_name; END IF;
    IF v_cat IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ebo_catalog_items WHERE id = v_cat) THEN v_cat := NULL; END IF;
    INSERT INTO ebo_items(prescription_id, catalog_item_id, name, unit, quantity, unit_price, position)
    VALUES (p_id, v_cat, left(v_name, 120), NULLIF(left(btrim(COALESCE(it->>'unit', '')), 30), ''), round(v_qty, 2), round(v_price, 2), n);
    n := n + 1;
  END LOOP;
  UPDATE ebo_prescriptions
     SET items_total = COALESCE((SELECT sum(line_total) FROM ebo_items WHERE prescription_id = p_id), 0),
         updated_at = now()
   WHERE id = p_id;
END $$;

CREATE OR REPLACE FUNCTION public._ebo_notify_admins(p_title text, p_message text, p_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a uuid;
BEGIN
  FOR a IN SELECT DISTINCT user_id FROM user_roles WHERE role::text IN ('admin','super_admin') LOOP
    PERFORM create_notification(a, 'ebo_admin', p_title, p_message, p_data, 'high');
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public._ebo_outbox(p_id uuid, p_kind text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO notification_outbox(session_id, kind, dedupe_key, ebo_id)
  SELECT e.session_id, p_kind, e.id::text || ':' || e.version, e.id FROM ebo_prescriptions e WHERE e.id = p_id
  ON CONFLICT DO NOTHING;
$$;

CREATE OR REPLACE FUNCTION public._ebo_fee_percent() RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT LEAST(GREATEST(get_setting_numeric('ebo_platform_fee_percent', 10), 0), 100);
$$;

CREATE OR REPLACE FUNCTION public._ebo_money(p numeric) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '₦' || to_char(p, 'FM999,999,999,990');
$$;

-- ===================================================================== Babalawo
-- Create or update a draft. Only the session's Babalawo, only on a paid session.
CREATE OR REPLACE FUNCTION public.ebo_save_draft(
  p_id uuid, p_session_id bigint, p_kind text, p_title text, p_description text,
  p_performed_by text, p_due_date date, p_owo_ifa numeric, p_items jsonb,
  p_ritual_at timestamptz DEFAULT NULL, p_ritual_minutes int DEFAULT 60)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); s sessions%ROWTYPE; e ebo_prescriptions%ROWTYPE; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_id IS NULL THEN
    SELECT * INTO s FROM sessions WHERE id = p_session_id;
    IF NOT FOUND OR s.babalawo_id IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'Session not found'; END IF;
    IF s.payment_status IS DISTINCT FROM 'paid' OR s.status::text NOT IN ('confirmed','in_progress','completed') THEN
      RAISE EXCEPTION 'Ebo can only be prescribed for a paid consultation';
    END IF;
  ELSE
    SELECT * INTO e FROM ebo_prescriptions WHERE id = p_id FOR UPDATE;
    IF NOT FOUND OR e.babalawo_id IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'Ebo not found'; END IF;
    IF e.status <> 'draft' THEN RAISE EXCEPTION 'Only a draft can be edited. Use revise for a sent quote.'; END IF;
  END IF;
  IF p_kind NOT IN ('ebo','etutu','other') THEN RAISE EXCEPTION 'Choose Ebo, Etutu or Other'; END IF;
  IF char_length(btrim(COALESCE(p_title, ''))) NOT BETWEEN 1 AND 160 THEN RAISE EXCEPTION 'Give the Ebo a title'; END IF;
  IF COALESCE(p_performed_by, 'babalawo') NOT IN ('babalawo','client') THEN RAISE EXCEPTION 'Bad performed_by'; END IF;
  IF COALESCE(p_owo_ifa, 0) < 0 OR COALESCE(p_owo_ifa, 0) > 10000000 THEN RAISE EXCEPTION 'Owó Ifá is out of range'; END IF;
  IF COALESCE(p_ritual_minutes, 60) NOT BETWEEN 15 AND 480 THEN RAISE EXCEPTION 'The ritual must last between 15 minutes and 8 hours'; END IF;

  IF p_id IS NULL THEN
    INSERT INTO ebo_prescriptions(session_id, babalawo_id, client_id, kind, title, description, performed_by, due_date, owo_ifa, status,
                                  ritual_at, ritual_minutes)
    VALUES (s.id, v_uid, s.user_id, p_kind, btrim(p_title), NULLIF(btrim(COALESCE(p_description, '')), ''),
            COALESCE(p_performed_by, 'babalawo'), p_due_date,
            CASE WHEN COALESCE(p_performed_by, 'babalawo') = 'client' THEN 0 ELSE round(COALESCE(p_owo_ifa, 0), 2) END, 'draft',
            p_ritual_at, COALESCE(p_ritual_minutes, 60))
    RETURNING id INTO v_id;
    PERFORM _ebo_log(v_id, 'created');
  ELSE
    v_id := p_id;
    UPDATE ebo_prescriptions SET kind = p_kind, title = btrim(p_title), description = NULLIF(btrim(COALESCE(p_description, '')), ''),
           performed_by = COALESCE(p_performed_by, 'babalawo'), due_date = p_due_date,
           owo_ifa = CASE WHEN COALESCE(p_performed_by, 'babalawo') = 'client' THEN 0 ELSE round(COALESCE(p_owo_ifa, 0), 2) END,
           ritual_at = p_ritual_at, ritual_minutes = COALESCE(p_ritual_minutes, 60), updated_at = now()
     WHERE id = v_id;
  END IF;
  UPDATE ebo_prescriptions SET platform_fee_percent = CASE WHEN performed_by = 'babalawo' THEN _ebo_fee_percent() ELSE 0 END WHERE id = v_id;
  PERFORM _ebo_replace_items(v_id, p_items);
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.ebo_delete_draft(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM ebo_prescriptions WHERE id = p_id AND babalawo_id = auth.uid() AND status = 'draft';
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft not found'; END IF;
END $$;

-- Send to the client. Prices are locked from here on.
CREATE OR REPLACE FUNCTION public.ebo_send(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e ebo_prescriptions%ROWTYPE;
BEGIN
  SELECT * INTO e FROM ebo_prescriptions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR e.babalawo_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Ebo not found'; END IF;
  IF e.status <> 'draft' THEN RAISE EXCEPTION 'This Ebo was already sent'; END IF;
  IF e.performed_by = 'babalawo' THEN
    IF e.total <= 0 THEN RAISE EXCEPTION 'Add item prices or Owó Ifá before sending'; END IF;
    IF EXISTS (SELECT 1 FROM ebo_items WHERE prescription_id = p_id AND unit_price <= 0) THEN
      RAISE EXCEPTION 'Every item needs a price before sending';
    END IF;
    IF e.total > get_setting_numeric('ebo_max_total', 5000000) THEN RAISE EXCEPTION 'This Ebo is above the largest amount allowed'; END IF;
    IF e.ritual_at IS NULL OR e.ritual_at < now() + interval '1 hour' THEN
      RAISE EXCEPTION 'Propose a ritual date and time at least an hour from now';
    END IF;
  END IF;
  UPDATE ebo_prescriptions SET status = 'sent', sent_at = now(), updated_at = now(),
         platform_fee_percent = CASE WHEN e.performed_by = 'babalawo' THEN _ebo_fee_percent() ELSE 0 END,
         expires_at = CASE WHEN e.performed_by = 'babalawo'
                           THEN now() + make_interval(days => get_setting_numeric('ebo_quote_expiry_days', 7)::int) END
   WHERE id = p_id;
  SELECT * INTO e FROM ebo_prescriptions WHERE id = p_id;
  PERFORM _ebo_log(p_id, 'sent', jsonb_build_object('total', e.total, 'items', _ebo_items_snapshot(p_id), 'owo_ifa', e.owo_ifa,
          'platform_fee', e.platform_fee, 'amount_due', e.amount_due));
  PERFORM create_notification(e.client_id, 'ebo_sent',
          CASE WHEN e.performed_by = 'babalawo' THEN 'Ebo prescribed: ' || _ebo_money(e.amount_due) ELSE 'Ebo prescribed' END,
          e.title, jsonb_build_object('ebo_id', p_id, 'action_url', '/dashboard?tab=records'), 'high');
  PERFORM _ebo_outbox(p_id, 'ebo_sent');
END $$;

-- Change a sent (unpaid) quote. A reason is required and kept with the old prices.
CREATE OR REPLACE FUNCTION public.ebo_revise(p_id uuid, p_owo_ifa numeric, p_items jsonb, p_due_date date, p_reason text,
  p_ritual_at timestamptz DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e ebo_prescriptions%ROWTYPE; v_old jsonb; v_new numeric;
BEGIN
  SELECT * INTO e FROM ebo_prescriptions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR e.babalawo_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Ebo not found'; END IF;
  IF e.status NOT IN ('sent','expired') THEN RAISE EXCEPTION 'Only an unpaid quote can be changed'; END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 5 THEN RAISE EXCEPTION 'Say why the quote changed'; END IF;
  IF COALESCE(p_owo_ifa, 0) < 0 OR COALESCE(p_owo_ifa, 0) > 10000000 THEN RAISE EXCEPTION 'Owó Ifá is out of range'; END IF;
  v_old := jsonb_build_object('total', e.total, 'owo_ifa', e.owo_ifa, 'items', _ebo_items_snapshot(p_id), 'version', e.version,
                              'ritual_at', e.ritual_at);
  UPDATE ebo_prescriptions SET owo_ifa = CASE WHEN e.performed_by = 'client' THEN 0 ELSE round(COALESCE(p_owo_ifa, 0), 2) END,
         due_date = p_due_date, ritual_at = COALESCE(p_ritual_at, ritual_at) WHERE id = p_id;
  PERFORM _ebo_replace_items(p_id, p_items);
  SELECT total INTO v_new FROM ebo_prescriptions WHERE id = p_id;
  IF e.performed_by = 'babalawo' THEN
    IF v_new <= 0 THEN RAISE EXCEPTION 'Add item prices or Owó Ifá'; END IF;
    IF EXISTS (SELECT 1 FROM ebo_items WHERE prescription_id = p_id AND unit_price <= 0) THEN
      RAISE EXCEPTION 'Every item needs a price';
    END IF;
    IF v_new > get_setting_numeric('ebo_max_total', 5000000) THEN RAISE EXCEPTION 'This Ebo is above the largest amount allowed'; END IF;
    IF (SELECT ritual_at FROM ebo_prescriptions WHERE id = p_id) < now() + interval '1 hour' THEN
      RAISE EXCEPTION 'Propose a ritual date and time at least an hour from now';
    END IF;
  END IF;
  UPDATE ebo_prescriptions SET status = 'sent', version = version + 1, updated_at = now(),
         platform_fee_percent = CASE WHEN e.performed_by = 'babalawo' THEN _ebo_fee_percent() ELSE 0 END,
         expires_at = CASE WHEN e.performed_by = 'babalawo'
                           THEN now() + make_interval(days => get_setting_numeric('ebo_quote_expiry_days', 7)::int) END
   WHERE id = p_id;
  PERFORM _ebo_log(p_id, 'revised', jsonb_build_object('reason', btrim(p_reason), 'before', v_old, 'total', v_new));
  PERFORM create_notification(e.client_id, 'ebo_revised', 'Ebo quote updated: ' || _ebo_money((SELECT amount_due FROM ebo_prescriptions WHERE id = p_id)),
          e.title || ' · ' || btrim(p_reason), jsonb_build_object('ebo_id', p_id, 'action_url', '/dashboard?tab=records'), 'high');
  PERFORM _ebo_outbox(p_id, 'ebo_sent');
END $$;

-- ===================================================================== ritual session
-- Creates (or moves) the live ritual session for a client who joins. Returns its id, or NULL when the
-- Babalawo already has something at that time (they are asked to pick another time).
CREATE OR REPLACE FUNCTION public._ebo_ritual_session(p_id uuid)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e ebo_prescriptions%ROWTYPE; v_tz text; v_local timestamp; v_sid bigint;
BEGIN
  SELECT * INTO e FROM ebo_prescriptions WHERE id = p_id;
  IF e.attendance IS DISTINCT FROM 'present' OR e.ritual_at IS NULL THEN RETURN NULL; END IF;
  SELECT COALESCE(NULLIF(user_timezone, ''), 'Africa/Lagos') INTO v_tz FROM sessions WHERE id = e.session_id;
  v_tz := COALESCE(v_tz, 'Africa/Lagos');
  v_local := e.ritual_at AT TIME ZONE v_tz;
  BEGIN
    IF e.ritual_session_id IS NOT NULL THEN
      UPDATE sessions SET session_date = v_local::date, start_time = v_local::time,
             end_time = (v_local + make_interval(mins => e.ritual_minutes))::time, status = 'confirmed'
       WHERE id = e.ritual_session_id RETURNING id INTO v_sid;
    END IF;
    IF v_sid IS NULL THEN
      INSERT INTO sessions(user_id, babalawo_id, session_date, start_time, end_time, status, payment_status, amount,
                           payment_reference, is_instant, notes, user_timezone, session_type, ebo_id)
      VALUES (e.client_id, e.babalawo_id, v_local::date, v_local::time, (v_local + make_interval(mins => e.ritual_minutes))::time,
              'confirmed', 'paid', 0, NULL, false, 'Ebo ritual: ' || e.title, v_tz, 'ebo_ritual', p_id)
      RETURNING id INTO v_sid;
    END IF;
  EXCEPTION WHEN unique_violation THEN
    PERFORM create_notification(e.babalawo_id, 'ebo_time_clash', 'Pick another time for the Ebo ritual',
            e.title || ': you already have a session at that time.', jsonb_build_object('ebo_id', p_id, 'action_url', '/dashboard'), 'high');
    PERFORM _ebo_log(p_id, 'ritual_time_clash');
    RETURN NULL;
  END;
  UPDATE ebo_prescriptions SET ritual_session_id = v_sid WHERE id = p_id;
  RETURN v_sid;
END $$;

CREATE OR REPLACE FUNCTION public._ebo_drop_ritual_session(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE sessions SET status = 'cancelled'
   WHERE id = (SELECT ritual_session_id FROM ebo_prescriptions WHERE id = p_id) AND status::text <> 'completed';
  UPDATE ebo_prescriptions SET ritual_session_id = NULL WHERE id = p_id;
END $$;

-- ===================================================================== money core
-- Marks a sent quote as paid. Raises IF002 when it is no longer payable (cancelled, already paid...).
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

-- Release held money to the Babalawo's available balance (once per kind).
CREATE OR REPLACE FUNCTION public._ebo_release(p_id uuid, p_kind text, p_amount numeric, p_note text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e ebo_prescriptions%ROWTYPE;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN 0; END IF;
  SELECT * INTO e FROM ebo_prescriptions WHERE id = p_id;
  INSERT INTO babalawo_ledger(babalawo_id, entry_type, amount, ebo_id, note)
    VALUES (e.babalawo_id, p_kind, p_amount, p_id, p_note) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN 0; END IF;
  UPDATE babalawo_wallets SET pending_balance = pending_balance - p_amount, available_balance = available_balance + p_amount,
         updated_at = now() WHERE babalawo_id = e.babalawo_id;
  RETURN p_amount;
END $$;

CREATE OR REPLACE FUNCTION public._ebo_start(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e ebo_prescriptions%ROWTYPE; v_rel numeric;
BEGIN
  SELECT * INTO e FROM ebo_prescriptions WHERE id = p_id FOR UPDATE;
  v_rel := LEAST(e.items_total, COALESCE(e.babalawo_amount, 0));
  v_rel := _ebo_release(p_id, 'ebo_items_release', v_rel, 'Ebo started: item money released');
  UPDATE ebo_prescriptions SET status = 'in_progress', started_at = now(), items_released = items_released + v_rel, updated_at = now()
   WHERE id = p_id;
  PERFORM _ebo_log(p_id, 'started', jsonb_build_object('items_released', v_rel));
  PERFORM create_notification(e.client_id, 'ebo_started', 'Your Ebo has started', e.title,
          jsonb_build_object('ebo_id', p_id, 'action_url', '/dashboard?tab=records'), 'normal');
END $$;

CREATE OR REPLACE FUNCTION public._ebo_complete(p_id uuid, p_how text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e ebo_prescriptions%ROWTYPE; v_rel numeric;
BEGIN
  SELECT * INTO e FROM ebo_prescriptions WHERE id = p_id FOR UPDATE;
  v_rel := COALESCE(e.babalawo_amount, 0) - e.items_released - e.refunded_amount;
  v_rel := _ebo_release(p_id, 'ebo_final_release', v_rel, 'Ebo completed (' || p_how || ')');
  UPDATE ebo_prescriptions SET status = 'completed', completed_at = now(), updated_at = now() WHERE id = p_id;
  PERFORM _ebo_log(p_id, 'completed', jsonb_build_object('how', p_how, 'released', v_rel));
  IF e.performed_by = 'babalawo' THEN
    PERFORM create_notification(e.babalawo_id, 'ebo_completed', 'Ebo completed', e.title || '. ' || _ebo_money(v_rel) || ' is now available to withdraw.',
            jsonb_build_object('ebo_id', p_id, 'action_url', '/dashboard'), 'normal');
  END IF;
END $$;

-- Refund to the client's wallet.
--   p_mode 'full': everything the client paid; released item money is taken back from the Babalawo.
--   p_mode 'held': only what is still held for the Babalawo; released item money and the platform fee stay.
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
    UPDATE babalawo_wallets SET pending_balance = pending_balance - v_held,
           lifetime_earned = lifetime_earned - (v_held + v_take_back), updated_at = now() WHERE babalawo_id = e.babalawo_id;
    IF v_take_back > 0 THEN
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

-- ===================================================================== Babalawo actions after payment
CREATE OR REPLACE FUNCTION public.ebo_mark_started(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e ebo_prescriptions%ROWTYPE;
BEGIN
  SELECT * INTO e FROM ebo_prescriptions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR e.babalawo_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Ebo not found'; END IF;
  IF e.status <> 'paid' THEN RAISE EXCEPTION 'Only a paid Ebo can be started'; END IF;
  PERFORM _ebo_start(p_id);
END $$;

CREATE OR REPLACE FUNCTION public.ebo_mark_performed(p_id uuid, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e ebo_prescriptions%ROWTYPE;
BEGIN
  SELECT * INTO e FROM ebo_prescriptions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR e.babalawo_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Ebo not found'; END IF;
  IF e.status NOT IN ('paid','in_progress') THEN RAISE EXCEPTION 'This Ebo is not waiting to be performed'; END IF;
  IF e.attendance = 'present' THEN
    IF e.ritual_at IS NOT NULL AND now() < e.ritual_at THEN RAISE EXCEPTION 'The ritual has not started yet'; END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM ebo_proofs WHERE prescription_id = p_id AND kind = 'video' AND status <> 'failed') THEN
    RAISE EXCEPTION 'Upload the video of the ritual first: show the items and say the prayers with the client''s name';
  END IF;
  IF e.status = 'paid' THEN PERFORM _ebo_start(p_id); END IF;
  UPDATE ebo_prescriptions SET status = 'performed', performed_at = now(),
         performance_note = NULLIF(left(btrim(COALESCE(p_note, '')), 2000), ''),
         confirm_by = now() + make_interval(hours => get_setting_numeric('ebo_confirm_hours', 72)::int), updated_at = now()
   WHERE id = p_id;
  PERFORM _ebo_log(p_id, 'performed', jsonb_build_object('note', p_note));
  PERFORM create_notification(e.client_id, 'ebo_performed', 'Your Ebo has been performed',
          e.title || CASE WHEN e.attendance = 'present' THEN '. Please confirm, or report a problem.' ELSE '. Watch the video and confirm, or report a problem.' END,
          jsonb_build_object('ebo_id', p_id, 'action_url', '/dashboard?tab=records'), 'high');
  PERFORM _ebo_outbox(p_id, 'ebo_performed');
END $$;

-- Babalawo cancels. Before payment: just cancelled. Paid but not started: full refund.
CREATE OR REPLACE FUNCTION public.ebo_cancel(p_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e ebo_prescriptions%ROWTYPE; v_ref numeric := 0;
BEGIN
  SELECT * INTO e FROM ebo_prescriptions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR (e.babalawo_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin()) THEN RAISE EXCEPTION 'Ebo not found'; END IF;
  IF e.status IN ('draft','sent','expired') THEN
    UPDATE ebo_prescriptions SET status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason, updated_at = now() WHERE id = p_id;
    PERFORM _ebo_log(p_id, 'cancelled', jsonb_build_object('reason', p_reason));
    IF e.status <> 'draft' THEN
      PERFORM create_notification(e.client_id, 'ebo_cancelled', 'Ebo withdrawn', e.title,
              jsonb_build_object('ebo_id', p_id, 'action_url', '/dashboard?tab=records'), 'normal');
    END IF;
  ELSIF e.status = 'paid' THEN
    v_ref := _ebo_refund(p_id, 'full', COALESCE(NULLIF(btrim(p_reason), ''), 'Cancelled by the Babalawo'));
  ELSE
    RAISE EXCEPTION 'Once an Ebo has started, only an admin can cancel it';
  END IF;
  RETURN jsonb_build_object('cancelled', true, 'refunded', v_ref);
END $$;

-- ===================================================================== client
CREATE OR REPLACE FUNCTION public.pay_ebo_with_wallet(p_id uuid, p_attendance text DEFAULT 'absent')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); e ebo_prescriptions%ROWTYPE; v_ref text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF public.is_suspended(v_uid) THEN RAISE EXCEPTION 'Your account is suspended'; END IF;
  SELECT * INTO e FROM ebo_prescriptions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR e.client_id IS DISTINCT FROM v_uid OR e.status = 'draft' THEN RAISE EXCEPTION 'Ebo not found'; END IF;
  IF e.status <> 'sent' OR e.performed_by <> 'babalawo' THEN RAISE EXCEPTION 'This Ebo is not waiting for payment'; END IF;
  IF e.expires_at IS NOT NULL AND e.expires_at < now() THEN RAISE EXCEPTION 'This quote has expired. Ask your Babalawo to renew it.'; END IF;
  v_ref := 'EBO-WAL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));
  PERFORM _wallet_apply(v_uid, e.amount_due, 'debit', 'ebo_payment', NULL, v_ref, 'Ebo: ' || e.title, 'ebo-pay-' || p_id);
  IF p_attendance NOT IN ('present','absent') THEN RAISE EXCEPTION 'Choose whether you will join the ritual'; END IF;
  PERFORM _ebo_mark_paid(p_id, 'wallet', v_ref, NULL, true, p_attendance);
END $$;

CREATE OR REPLACE FUNCTION public.ebo_decline(p_id uuid, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e ebo_prescriptions%ROWTYPE;
BEGIN
  SELECT * INTO e FROM ebo_prescriptions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR e.client_id IS DISTINCT FROM auth.uid() OR e.status = 'draft' THEN RAISE EXCEPTION 'Ebo not found'; END IF;
  IF e.status NOT IN ('sent','expired') THEN RAISE EXCEPTION 'This Ebo can no longer be declined'; END IF;
  UPDATE ebo_prescriptions SET status = 'declined', declined_at = now(),
         decline_reason = NULLIF(left(btrim(COALESCE(p_reason, '')), 1000), ''), updated_at = now() WHERE id = p_id;
  PERFORM _ebo_log(p_id, 'declined', jsonb_build_object('reason', p_reason));
  PERFORM create_notification(e.babalawo_id, 'ebo_declined', 'Ebo declined', e.title || COALESCE(': ' || NULLIF(btrim(p_reason), ''), ''),
          jsonb_build_object('ebo_id', p_id, 'action_url', '/dashboard'), 'normal');
END $$;

CREATE OR REPLACE FUNCTION public.ebo_confirm(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e ebo_prescriptions%ROWTYPE;
BEGIN
  SELECT * INTO e FROM ebo_prescriptions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR e.client_id IS DISTINCT FROM auth.uid() OR e.status = 'draft' THEN RAISE EXCEPTION 'Ebo not found'; END IF;
  IF e.status <> 'performed' THEN RAISE EXCEPTION 'This Ebo is not waiting for your confirmation'; END IF;
  PERFORM _ebo_complete(p_id, 'client_confirmed');
END $$;

CREATE OR REPLACE FUNCTION public.ebo_dispute(p_id uuid, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); e ebo_prescriptions%ROWTYPE; v_d uuid;
BEGIN
  SELECT * INTO e FROM ebo_prescriptions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR e.client_id IS DISTINCT FROM v_uid OR e.status = 'draft' THEN RAISE EXCEPTION 'Ebo not found'; END IF;
  IF e.status NOT IN ('paid','in_progress','performed') THEN RAISE EXCEPTION 'This Ebo cannot be disputed now'; END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 10 THEN RAISE EXCEPTION 'Tell us what went wrong (at least 10 characters)'; END IF;
  INSERT INTO disputes(session_id, raised_by, reason, refund_requested, ebo_id)
    VALUES (e.session_id, v_uid, left(btrim(p_reason), 4000), true, p_id) RETURNING id INTO v_d;
  UPDATE ebo_prescriptions SET status = 'disputed', dispute_id = v_d, updated_at = now() WHERE id = p_id;
  PERFORM _ebo_log(p_id, 'disputed', jsonb_build_object('reason', p_reason, 'from', e.status));
  PERFORM create_notification(e.babalawo_id, 'ebo_disputed', 'A client reported a problem with an Ebo',
          e.title || '. The money stays held while IFA reviews it.', jsonb_build_object('ebo_id', p_id, 'action_url', '/dashboard'), 'high');
  PERFORM _ebo_notify_admins('Ebo dispute', e.title || ' · ' || _ebo_money(e.amount_due), jsonb_build_object('ebo_id', p_id, 'action_url', '/admin?section=ebo'));
  RETURN v_d;
END $$;

-- Client-performed Ebo (guidance only, no money): the client tracks their own progress.
CREATE OR REPLACE FUNCTION public.set_ebo_status(p_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e ebo_prescriptions%ROWTYPE;
BEGIN
  IF p_status NOT IN ('in_progress','completed') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  SELECT * INTO e FROM ebo_prescriptions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR e.client_id IS DISTINCT FROM auth.uid() OR e.performed_by <> 'client'
     OR e.status NOT IN ('sent','in_progress') THEN
    RAISE EXCEPTION 'Prescription not found';
  END IF;
  UPDATE ebo_prescriptions SET status = p_status,
         started_at = COALESCE(started_at, now()),
         completed_at = CASE WHEN p_status = 'completed' THEN now() END, updated_at = now()
   WHERE id = p_id;
  PERFORM _ebo_log(p_id, 'client_' || p_status);
END $$;

-- ===================================================================== ritual time and attendance
-- Babalawo moves the ritual after payment (the client is told; a live session moves with it).
CREATE OR REPLACE FUNCTION public.ebo_reschedule(p_id uuid, p_ritual_at timestamptz, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e ebo_prescriptions%ROWTYPE;
BEGIN
  SELECT * INTO e FROM ebo_prescriptions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR e.babalawo_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Ebo not found'; END IF;
  IF e.status NOT IN ('paid','in_progress') THEN RAISE EXCEPTION 'Only a paid Ebo can be rescheduled'; END IF;
  IF p_ritual_at IS NULL OR p_ritual_at < now() + interval '1 hour' THEN RAISE EXCEPTION 'Choose a time at least an hour from now'; END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 3 THEN RAISE EXCEPTION 'Say why the time changed'; END IF;
  UPDATE ebo_prescriptions SET ritual_at = p_ritual_at, updated_at = now() WHERE id = p_id;
  PERFORM _ebo_ritual_session(p_id);
  PERFORM _ebo_log(p_id, 'rescheduled', jsonb_build_object('from', e.ritual_at, 'to', p_ritual_at, 'reason', p_reason));
  PERFORM create_notification(e.client_id, 'ebo_rescheduled', 'Ebo ritual moved', e.title || ' · ' || btrim(p_reason),
          jsonb_build_object('ebo_id', p_id, 'action_url', '/dashboard?tab=records'), 'high');
END $$;

-- Client asks for another ritual time before paying. The Babalawo answers by revising the quote.
CREATE OR REPLACE FUNCTION public.ebo_request_time(p_id uuid, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e ebo_prescriptions%ROWTYPE;
BEGIN
  SELECT * INTO e FROM ebo_prescriptions WHERE id = p_id;
  IF NOT FOUND OR e.client_id IS DISTINCT FROM auth.uid() OR e.status = 'draft' THEN RAISE EXCEPTION 'Ebo not found'; END IF;
  IF e.status NOT IN ('sent','expired') THEN RAISE EXCEPTION 'The time can only be changed before payment'; END IF;
  IF char_length(btrim(COALESCE(p_note, ''))) < 3 THEN RAISE EXCEPTION 'Say which times suit you'; END IF;
  PERFORM _ebo_log(p_id, 'time_requested', jsonb_build_object('note', left(btrim(p_note), 500)));
  PERFORM create_notification(e.babalawo_id, 'ebo_time_requested', 'Client asked for another ritual time',
          e.title || ': ' || left(btrim(p_note), 300), jsonb_build_object('ebo_id', p_id, 'action_url', '/dashboard'), 'high');
END $$;

-- Client changes their mind about joining, up to an hour before the ritual.
CREATE OR REPLACE FUNCTION public.ebo_set_attendance(p_id uuid, p_attendance text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e ebo_prescriptions%ROWTYPE;
BEGIN
  IF p_attendance NOT IN ('present','absent') THEN RAISE EXCEPTION 'Choose present or absent'; END IF;
  SELECT * INTO e FROM ebo_prescriptions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR e.client_id IS DISTINCT FROM auth.uid() OR e.status = 'draft' THEN RAISE EXCEPTION 'Ebo not found'; END IF;
  IF e.status NOT IN ('paid','in_progress') THEN RAISE EXCEPTION 'Attendance can no longer be changed'; END IF;
  IF e.ritual_at IS NOT NULL AND e.ritual_at < now() + interval '1 hour' THEN RAISE EXCEPTION 'The ritual is less than an hour away'; END IF;
  IF e.attendance IS NOT DISTINCT FROM p_attendance THEN RETURN; END IF;
  UPDATE ebo_prescriptions SET attendance = p_attendance, updated_at = now() WHERE id = p_id;
  IF p_attendance = 'present' THEN PERFORM _ebo_ritual_session(p_id); ELSE PERFORM _ebo_drop_ritual_session(p_id); END IF;
  PERFORM _ebo_log(p_id, 'attendance', jsonb_build_object('attendance', p_attendance));
  PERFORM create_notification(e.babalawo_id, 'ebo_attendance',
          CASE WHEN p_attendance = 'present' THEN 'Client will join the Ebo ritual' ELSE 'Client will not attend the Ebo ritual' END,
          e.title || CASE WHEN p_attendance = 'absent' THEN '. Record a video naming them, with the items and prayers.' ELSE '' END,
          jsonb_build_object('ebo_id', p_id, 'action_url', '/dashboard'), 'normal');
END $$;

-- The ritual session is not a consultation: no "notes will appear" message when it ends.
CREATE OR REPLACE FUNCTION public.enqueue_session_notifications()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.session_date IS DISTINCT FROM OLD.session_date
        OR NEW.start_time IS DISTINCT FROM OLD.start_time)
       AND NEW.status::text NOT IN ('cancelled','completed') THEN
      INSERT INTO public.notification_outbox (session_id, kind, dedupe_key)
      VALUES (NEW.id, 'rescheduled', NEW.session_date::text || 'T' || NEW.start_time::text)
      ON CONFLICT DO NOTHING;
    END IF;
    IF NEW.status::text = 'completed' AND OLD.status::text IS DISTINCT FROM 'completed'
       AND COALESCE(NEW.session_type, 'consultation') = 'consultation' THEN
      INSERT INTO public.notification_outbox (session_id, kind) VALUES (NEW.id, 'completed')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- ===================================================================== admin
CREATE OR REPLACE FUNCTION public.admin_resolve_ebo(p_id uuid, p_action text, p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e ebo_prescriptions%ROWTYPE; v_ref numeric := 0;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF char_length(btrim(COALESCE(p_note, ''))) < 3 THEN RAISE EXCEPTION 'A note is required'; END IF;
  SELECT * INTO e FROM ebo_prescriptions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ebo not found'; END IF;
  IF e.status NOT IN ('paid','in_progress','performed','disputed') THEN RAISE EXCEPTION 'Nothing to resolve on a % Ebo', e.status; END IF;
  IF p_action = 'release' THEN
    IF e.items_released = 0 AND COALESCE(e.babalawo_amount, 0) > 0 THEN
      PERFORM _ebo_release(p_id, 'ebo_items_release', LEAST(e.items_total, e.babalawo_amount), 'Released by admin');
      UPDATE ebo_prescriptions SET items_released = LEAST(e.items_total, e.babalawo_amount) WHERE id = p_id;
    END IF;
    PERFORM _ebo_complete(p_id, 'admin');
    UPDATE disputes SET status = 'resolved_dismissed', resolution_note = p_note, resolved_by = auth.uid(), resolved_at = now(), updated_at = now()
     WHERE ebo_id = p_id AND status IN ('open','investigating');
  ELSIF p_action IN ('refund_full','refund_held') THEN
    v_ref := _ebo_refund(p_id, CASE p_action WHEN 'refund_full' THEN 'full' ELSE 'held' END, p_note);
    UPDATE disputes SET status = 'resolved_refund', resolution_note = p_note, resolved_by = auth.uid(), resolved_at = now(), updated_at = now()
     WHERE ebo_id = p_id AND status IN ('open','investigating');
  ELSE RAISE EXCEPTION 'Unknown action %', p_action; END IF;
  PERFORM _ebo_log(p_id, 'admin_' || p_action, jsonb_build_object('note', p_note, 'refunded', v_ref));
  PERFORM log_payment_audit(NULL, 'admin_ebo_' || p_action, jsonb_build_object('admin', auth.uid(), 'ebo', p_id, 'refunded', v_ref, 'note', p_note));
  RETURN jsonb_build_object('ok', true, 'refunded', v_ref);
END $$;

CREATE OR REPLACE FUNCTION public.admin_ebo_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT jsonb_build_object(
    'awaiting_payment', (SELECT count(*) FROM ebo_prescriptions WHERE status = 'sent' AND performed_by = 'babalawo'),
    'awaiting_payment_value', COALESCE((SELECT sum(amount_due) FROM ebo_prescriptions WHERE status = 'sent' AND performed_by = 'babalawo'), 0),
    'in_flight', (SELECT count(*) FROM ebo_prescriptions WHERE status IN ('paid','in_progress','performed')),
    'held_for_babalawos', COALESCE((SELECT sum(COALESCE(babalawo_amount,0) - items_released - refunded_amount)
                                     FROM ebo_prescriptions WHERE status IN ('paid','in_progress','performed','disputed')), 0),
    'disputed', (SELECT count(*) FROM ebo_prescriptions WHERE status = 'disputed'),
    'overdue', (SELECT count(*) FROM ebo_flags WHERE overdue),
    'price_outliers', (SELECT count(*) FROM ebo_flags f JOIN ebo_prescriptions e ON e.id = f.id
                        WHERE f.price_outliers > 0 AND e.status NOT IN ('draft','cancelled','declined','expired')),
    'paid_total', COALESCE((SELECT sum(amount_due) FROM ebo_prescriptions WHERE paid_at IS NOT NULL), 0),
    'platform_fee_total', COALESCE((SELECT sum(platform_fee) FROM ebo_prescriptions WHERE paid_at IS NOT NULL AND status <> 'refunded'), 0)
  ) INTO r;
  RETURN r;
END $$;

-- ===================================================================== background job + AI drafts
-- Expire unpaid quotes; release money when the client neither confirms nor disputes in time.
CREATE OR REPLACE FUNCTION public.ebo_tick()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_exp int := 0; v_done int := 0; r record;
BEGIN
  FOR r IN SELECT id, client_id, babalawo_id, title FROM ebo_prescriptions
            WHERE status = 'sent' AND expires_at IS NOT NULL AND expires_at < now() FOR UPDATE SKIP LOCKED LOOP
    UPDATE ebo_prescriptions SET status = 'expired', updated_at = now() WHERE id = r.id;
    PERFORM _ebo_log(r.id, 'expired');
    PERFORM create_notification(r.babalawo_id, 'ebo_expired', 'Ebo quote expired unpaid', r.title || '. You can renew it with new prices.',
            jsonb_build_object('ebo_id', r.id, 'action_url', '/dashboard'), 'normal');
    v_exp := v_exp + 1;
  END LOOP;
  FOR r IN SELECT id FROM ebo_prescriptions
            WHERE status = 'performed' AND confirm_by IS NOT NULL AND confirm_by < now() FOR UPDATE SKIP LOCKED LOOP
    PERFORM _ebo_complete(r.id, 'auto_confirmed');
    v_done := v_done + 1;
  END LOOP;
  RETURN jsonb_build_object('expired', v_exp, 'auto_completed', v_done);
END $$;

-- The notes worker turns Ebo it heard in the session into drafts for the Babalawo to price and send.
-- p_ebo: [{title, kind, items: [{name, quantity, unit, unit_price}], due_date}]
CREATE OR REPLACE FUNCTION public.ebo_ai_draft(p_session_id bigint, p_ebo jsonb)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s sessions%ROWTYPE; x jsonb; v_id uuid; n int := 0; v_kind text; v_due date;
BEGIN
  IF p_ebo IS NULL OR jsonb_typeof(p_ebo) <> 'array' OR jsonb_array_length(p_ebo) = 0 THEN RETURN 0; END IF;
  SELECT * INTO s FROM sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  -- Never add to a session where the Babalawo already started their own Ebo list.
  IF EXISTS (SELECT 1 FROM ebo_prescriptions WHERE session_id = p_session_id AND NOT ai_suggested) THEN RETURN 0; END IF;
  DELETE FROM ebo_prescriptions WHERE session_id = p_session_id AND ai_suggested AND status = 'draft';
  FOR x IN SELECT * FROM jsonb_array_elements(p_ebo) LIMIT 10 LOOP
    CONTINUE WHEN char_length(btrim(COALESCE(x->>'title', ''))) = 0;
    v_kind := CASE WHEN x->>'kind' IN ('ebo','etutu','other') THEN x->>'kind' ELSE 'ebo' END;
    BEGIN v_due := NULLIF(x->>'due_date', '')::date; EXCEPTION WHEN others THEN v_due := NULL; END;
    INSERT INTO ebo_prescriptions(session_id, babalawo_id, client_id, kind, title, description, due_date, status, ai_suggested)
    VALUES (s.id, s.babalawo_id, s.user_id, v_kind, left(btrim(x->>'title'), 160), NULLIF(left(btrim(COALESCE(x->>'instructions', '')), 2000), ''),
            v_due, 'draft', true)
    RETURNING id INTO v_id;
    BEGIN
      PERFORM _ebo_replace_items(v_id, COALESCE(x->'items', '[]'::jsonb));
    EXCEPTION WHEN others THEN
      PERFORM _ebo_replace_items(v_id, '[]'::jsonb);
    END;
    PERFORM _ebo_log(v_id, 'ai_drafted');
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- ===================================================================== gateway payments for Ebo
DROP FUNCTION IF EXISTS public.create_payment_intent(uuid, text, text, numeric, uuid, date, text, boolean);
CREATE OR REPLACE FUNCTION public.create_payment_intent(
  p_user uuid, p_kind text, p_gateway text, p_amount numeric DEFAULT NULL,
  p_babalawo_user_id uuid DEFAULT NULL, p_session_date date DEFAULT NULL, p_start_time text DEFAULT NULL,
  p_is_instant boolean DEFAULT false, p_ebo_id uuid DEFAULT NULL, p_ebo_attendance text DEFAULT NULL)
RETURNS TABLE(reference text, amount numeric) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_amt numeric; v_ref text; e ebo_prescriptions%ROWTYPE;
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
  v_ref := 'IFANG-' || upper(left(p_gateway, 3)) || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));
  INSERT INTO payment_intents(user_id, kind, gateway, reference, amount, babalawo_user_id, session_date, start_time, is_instant, ebo_id, ebo_attendance)
  VALUES (p_user, p_kind, p_gateway, v_ref, v_amt,
          CASE WHEN p_kind = 'ebo' THEN e.babalawo_id ELSE p_babalawo_user_id END,
          p_session_date, p_start_time, COALESCE(p_is_instant, false), CASE WHEN p_kind = 'ebo' THEN p_ebo_id END,
          CASE WHEN p_kind = 'ebo' THEN p_ebo_attendance END);
  RETURN QUERY SELECT v_ref, v_amt;
END $$;

-- Called ONLY by the API after the provider confirmed the charge.
CREATE OR REPLACE FUNCTION public.settle_payment_intent(
  p_reference text, p_paid_amount numeric, p_currency text, p_gateway_tx text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i payment_intents%ROWTYPE; v_session bigint;
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
  ELSIF i.kind = 'ebo' THEN
    BEGIN
      PERFORM _ebo_mark_paid(i.ebo_id, i.gateway, i.reference, p_gateway_tx, true, COALESCE(i.ebo_attendance, 'absent'));
    EXCEPTION WHEN SQLSTATE 'IF002' THEN
      -- cancelled or already paid while the client was paying: the money goes to their wallet instead
      PERFORM _wallet_apply(i.user_id, i.amount, 'credit', 'payment_gateway', i.gateway, i.reference,
                            'Ebo no longer payable - payment held in wallet', 'topup-' || i.reference, true);
      UPDATE payment_intents SET status = 'succeeded', settled_at = now(), gateway_transaction_id = p_gateway_tx,
             failure_reason = 'ebo_unavailable_credited_to_wallet' WHERE id = i.id;
      RETURN jsonb_build_object('status', 'ebo_unavailable_credited_to_wallet', 'kind', i.kind, 'user_id', i.user_id);
    END;
  ELSE
    BEGIN
      PERFORM _assert_bookable(i.babalawo_user_id, i.session_date, i.start_time, i.is_instant);
      v_session := _create_paid_session(i.user_id, i.babalawo_user_id, i.session_date, i.start_time, i.is_instant,
                                        i.amount, i.gateway, i.reference, p_gateway_tx, true);
    EXCEPTION WHEN unique_violation OR SQLSTATE 'IF001' THEN
      PERFORM _wallet_apply(i.user_id, i.amount, 'credit', 'payment_gateway', i.gateway, i.reference,
                            'Slot unavailable - payment held in wallet', 'topup-' || i.reference, true);
      UPDATE payment_intents SET status = 'succeeded', settled_at = now(), gateway_transaction_id = p_gateway_tx,
             failure_reason = 'slot_taken_credited_to_wallet' WHERE id = i.id;
      RETURN jsonb_build_object('status', 'slot_taken_credited_to_wallet', 'kind', i.kind, 'user_id', i.user_id);
    END;
  END IF;
  UPDATE payment_intents SET status = 'succeeded', settled_at = now(), gateway_transaction_id = p_gateway_tx,
         session_id = CASE WHEN i.kind = 'session' THEN v_session END
   WHERE id = i.id;
  PERFORM log_payment_audit(NULL, 'intent_settled', jsonb_build_object('reference', p_reference, 'kind', i.kind));
  IF i.kind = 'ebo' THEN SELECT ritual_session_id INTO v_session FROM ebo_prescriptions WHERE id = i.ebo_id; END IF;
  RETURN jsonb_build_object('status', 'settled', 'kind', i.kind, 'session_id', v_session, 'ebo_id', i.ebo_id, 'user_id', i.user_id);
END $$;

-- ===================================================================== lock down
DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname IN
              ('_ebo_log','_ebo_items_snapshot','_ebo_replace_items','_ebo_notify_admins','_ebo_outbox',
               '_ebo_mark_paid','_ebo_release','_ebo_start','_ebo_complete','_ebo_refund',
               '_ebo_ritual_session','_ebo_fee_percent','_ebo_drop_ritual_session','enqueue_session_notifications',
               'ebo_tick','ebo_ai_draft','create_payment_intent','settle_payment_intent')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname IN
              ('ebo_save_draft','ebo_delete_draft','ebo_send','ebo_revise','ebo_mark_started','ebo_mark_performed','ebo_cancel',
               'pay_ebo_with_wallet','ebo_decline','ebo_confirm','ebo_dispute','set_ebo_status',
               'ebo_reschedule','ebo_request_time','ebo_set_attendance',
               'admin_resolve_ebo','admin_ebo_summary')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.sig);
  END LOOP;
END $$;
