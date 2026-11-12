-- Admin → Users: a record per person, and insights.
--
-- What this adds:
--   1. Insight thresholds in admin_settings (high value, frequent, lapsed, new), so the labels can be tuned.
--   2. admin_user_stats: one row per person with spend, bookings, frequency, last active and labels.
--      Internal; read through admin_user_directory() and admin_user_detail().
--   3. admin_user_directory(): the searchable, sortable, filterable, paged list.
--   4. admin_user_insights(): the numbers at the top (payers, repeat rate, top spenders, frequency buckets).
--   5. admin_user_detail(): everything about one person on one page. Opening it is personal-data access,
--      so it is written to admin_audit_log ('view_user_record'), at most once per admin per person per 15 minutes.
--      Consultation content (Odù, notes, transcripts) is special-category data and is NOT shown here.
--   6. Admin notes about a person (admin_user_notes), removed when the account is erased, and included
--      in that person's data export (it is data about them).
--   7. Babalawos get the same record plus their practice: completion, no-shows, Consult Now answers,
--      repeat clients, ratings, earnings, the application they sent, and an Online history
--      (babalawo_presence_log, written by a trigger when current_status changes, kept 400 days).
--      admin_set_babalawo_listing() features/unfeatures them or takes them offline, audited.
--   8. admin_message_user(): send an in-app notification. admin_sign_out_user(): end every sign-in.
--      Suspending someone now also signs them out everywhere. All audited.

------------------------------------------------------------------------------
-- 1. Settings
------------------------------------------------------------------------------
INSERT INTO public.admin_settings (setting_key, setting_value, description, is_public) VALUES
  ('insights_high_value_naira', '100000', 'Admin → Users: lifetime spend (₦, after refunds) that marks someone as high value. The top 10% of payers are also marked once there are 10 or more.', false),
  ('insights_frequent_bookings_90d', '3', 'Admin → Users: bookings in the last 90 days that mark someone as a frequent client', false),
  ('insights_lapsed_days', '60', 'Admin → Users: days since the last booking after which a repeat client is marked lapsed', false),
  ('insights_new_days', '30', 'Admin → Users: people who joined within this many days are marked new', false)
ON CONFLICT (setting_key) DO NOTHING;

------------------------------------------------------------------------------
-- 2. Per-person stats
------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_payments_user_status ON public.payments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_user_created ON public.sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_babalawo_created ON public.sessions(babalawo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON public.admin_audit_log(target_type, target_id, created_at DESC);

CREATE OR REPLACE FUNCTION public._admin_user_stats()
RETURNS TABLE (
  id uuid, full_name text, email text, phone text, avatar_url text, created_at timestamptz,
  roles text[], is_suspended boolean, suspended_reason text, suspended_at timestamptz, is_deleted boolean,
  last_sign_in_at timestamptz, last_active_at timestamptz,
  bookings_total integer, bookings_completed integer, bookings_cancelled integer, bookings_90d integer,
  first_booking_at timestamptz, last_booking_at timestamptz, avg_days_between numeric,
  lifetime_spend numeric, spend_90d numeric, session_spend numeric, ebo_spend numeric, refunded numeric,
  wallet_balance numeric, open_disputes integer,
  babalawo_sessions integer, babalawo_lifetime_earned numeric, babalawo_review_status text,
  spend_rank numeric, tags text[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  WITH cfg AS (
    SELECT public._setting_int('insights_high_value_naira', 100000) AS hv,
           public._setting_int('insights_frequent_bookings_90d', 3) AS freq,
           public._setting_int('insights_lapsed_days', 60) AS lapsed,
           public._setting_int('insights_new_days', 30) AS newd
  ),
  bk AS (  -- bookings as a client: paid or refunded sessions, not abandoned checkouts
    SELECT s.user_id,
           count(*)::int AS total,
           count(*) FILTER (WHERE s.status = 'completed')::int AS completed,
           count(*) FILTER (WHERE s.status = 'cancelled')::int AS cancelled,
           count(*) FILTER (WHERE s.created_at > now() - interval '90 days' AND s.status <> 'cancelled')::int AS d90,
           min(s.created_at) AS first_at, max(s.created_at) AS last_at
      FROM sessions s
     WHERE s.payment_status IN ('paid', 'refunded', 'partially_refunded') OR s.status = 'completed'
     GROUP BY s.user_id
  ),
  bb AS (
    SELECT s.babalawo_id, count(*) FILTER (WHERE s.status = 'completed')::int AS done, max(s.created_at) AS last_at
      FROM sessions s GROUP BY s.babalawo_id
  ),
  pay AS (
    SELECT p.user_id,
           sum(p.amount - COALESCE(p.refunded_amount, 0)) AS spend,
           sum(p.amount - COALESCE(p.refunded_amount, 0)) FILTER (WHERE p.created_at > now() - interval '90 days') AS spend90,
           sum(p.amount - COALESCE(p.refunded_amount, 0)) FILTER (WHERE p.ebo_id IS NULL) AS sess,
           sum(p.amount - COALESCE(p.refunded_amount, 0)) FILTER (WHERE p.ebo_id IS NOT NULL) AS ebo,
           sum(COALESCE(p.refunded_amount, 0)) AS refunded
      FROM payments p WHERE p.status IN ('completed', 'refunded') AND p.user_id IS NOT NULL
     GROUP BY p.user_id
  ),
  ranked AS (
    SELECT pay.*, percent_rank() OVER (ORDER BY pay.spend) AS pr, count(*) OVER () AS payers FROM pay WHERE pay.spend > 0
  ),
  rl AS (SELECT r.user_id, array_agg(r.role::text ORDER BY r.role::text) AS roles FROM user_roles r GROUP BY r.user_id),
  si AS (SELECT a.user_id, max(GREATEST(a.created_at, a.updated_at)) AS at FROM auth.sessions a GROUP BY a.user_id),
  dsp AS (
    SELECT x.uid, count(DISTINCT x.id)::int AS n FROM (
      SELECT d.id, d.raised_by AS uid FROM disputes d WHERE d.status IN ('open', 'investigating')
      UNION ALL
      SELECT d.id, s.user_id FROM disputes d JOIN sessions s ON s.id = d.session_id WHERE d.status IN ('open', 'investigating')
      UNION ALL
      SELECT d.id, s.babalawo_id FROM disputes d JOIN sessions s ON s.id = d.session_id WHERE d.status IN ('open', 'investigating')
    ) x GROUP BY x.uid
  ),
  base AS (
    SELECT p.id, p.full_name,
           CASE WHEN p.email LIKE '%@phone.ifa.invalid' OR p.email LIKE '%@deleted.ifa.invalid' THEN NULL ELSE p.email END AS email,
           p.phone, p.avatar_url, COALESCE(p.created_at, u.created_at) AS created_at,
           COALESCE(rl.roles, ARRAY['user']) AS roles,
           COALESCE(p.is_suspended, false) AS is_suspended, p.suspended_reason, p.suspended_at,
           (u.deleted_at IS NOT NULL) AS is_deleted,
           u.last_sign_in_at,
           NULLIF(GREATEST(COALESCE(u.last_sign_in_at, '-infinity'), COALESCE(si.at, '-infinity'), COALESCE(b.last_seen_at, '-infinity'),
                           COALESCE(bk.last_at, '-infinity'), COALESCE(bb.last_at, '-infinity')), '-infinity'::timestamptz) AS last_active_at,
           COALESCE(bk.total, 0) AS bookings_total, COALESCE(bk.completed, 0) AS bookings_completed,
           COALESCE(bk.cancelled, 0) AS bookings_cancelled, COALESCE(bk.d90, 0) AS bookings_90d,
           bk.first_at AS first_booking_at, bk.last_at AS last_booking_at,
           CASE WHEN COALESCE(bk.total, 0) >= 2
                THEN round((EXTRACT(epoch FROM bk.last_at - bk.first_at) / 86400.0 / (bk.total - 1))::numeric, 1) END AS avg_days_between,
           COALESCE(pay.spend, 0) AS lifetime_spend, COALESCE(pay.spend90, 0) AS spend_90d,
           COALESCE(pay.sess, 0) AS session_spend, COALESCE(pay.ebo, 0) AS ebo_spend, COALESCE(pay.refunded, 0) AS refunded,
           COALESCE(w.balance, 0) AS wallet_balance, COALESCE(dsp.n, 0) AS open_disputes,
           COALESCE(bb.done, 0) AS babalawo_sessions, COALESCE(bw.lifetime_earned, 0) AS babalawo_lifetime_earned,
           b.review_status AS babalawo_review_status,
           ranked.pr AS spend_rank, ranked.payers
      FROM profiles p
      LEFT JOIN auth.users u ON u.id = p.id
      LEFT JOIN rl ON rl.user_id = p.id
      LEFT JOIN si ON si.user_id = p.id
      LEFT JOIN babalawos b ON b.user_id = p.id
      LEFT JOIN babalawo_wallets bw ON bw.babalawo_id = p.id
      LEFT JOIN bk ON bk.user_id = p.id
      LEFT JOIN bb ON bb.babalawo_id = p.id
      LEFT JOIN pay ON pay.user_id = p.id
      LEFT JOIN ranked ON ranked.user_id = p.id
      LEFT JOIN wallets w ON w.user_id = p.id
      LEFT JOIN dsp ON dsp.uid = p.id
  )
  SELECT b.id, b.full_name, b.email, b.phone, b.avatar_url, b.created_at, b.roles, b.is_suspended, b.suspended_reason, b.suspended_at,
         b.is_deleted, b.last_sign_in_at, b.last_active_at, b.bookings_total, b.bookings_completed, b.bookings_cancelled, b.bookings_90d,
         b.first_booking_at, b.last_booking_at, b.avg_days_between, b.lifetime_spend, b.spend_90d, b.session_spend, b.ebo_spend,
         b.refunded, b.wallet_balance, b.open_disputes, b.babalawo_sessions, b.babalawo_lifetime_earned, b.babalawo_review_status,
         round(COALESCE(b.spend_rank, 0)::numeric, 3),
         array_remove(ARRAY[
           CASE WHEN b.lifetime_spend > 0 AND (b.lifetime_spend >= cfg.hv OR (b.payers >= 10 AND b.spend_rank >= 0.9)) THEN 'high_value' END,
           CASE WHEN b.bookings_90d >= cfg.freq THEN 'frequent' END,
           CASE WHEN b.bookings_total >= 2 AND b.last_booking_at < now() - make_interval(days => cfg.lapsed) THEN 'lapsed' END,
           CASE WHEN b.bookings_total = 1 THEN 'one_time' END,
           CASE WHEN b.bookings_total = 0 AND NOT ('babalawo' = ANY (b.roles)) AND NOT ('admin' = ANY (b.roles)) THEN 'never_booked' END,
           CASE WHEN b.created_at > now() - make_interval(days => cfg.newd) THEN 'new' END,
           CASE WHEN b.open_disputes > 0 THEN 'disputes' END
         ]::text[], NULL)
    FROM base b CROSS JOIN cfg
$$;
REVOKE ALL ON FUNCTION public._admin_user_stats() FROM PUBLIC, anon, authenticated;

------------------------------------------------------------------------------
-- 3. The list
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_user_directory(
  p_search text DEFAULT NULL, p_filter text DEFAULT NULL, p_sort text DEFAULT 'joined',
  p_desc boolean DEFAULT true, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS TABLE (
  id uuid, full_name text, email text, phone text, avatar_url text, created_at timestamptz, roles text[],
  is_suspended boolean, suspended_reason text, is_deleted boolean, last_active_at timestamptz,
  bookings_total integer, bookings_90d integer, last_booking_at timestamptz, avg_days_between numeric,
  lifetime_spend numeric, spend_90d numeric, wallet_balance numeric, open_disputes integer,
  babalawo_sessions integer, babalawo_lifetime_earned numeric, tags text[], total_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE q text := NULLIF(btrim(COALESCE(p_search, '')), '');
BEGIN
  PERFORM public._require_admin();
  IF p_sort NOT IN ('joined', 'name', 'spend', 'spend_90d', 'bookings', 'bookings_90d', 'last_active', 'last_booking', 'frequency', 'wallet') THEN
    RAISE EXCEPTION 'Unknown sort %', p_sort;
  END IF;
  RETURN QUERY
  SELECT s.id, s.full_name, s.email, s.phone, s.avatar_url, s.created_at, s.roles, s.is_suspended, s.suspended_reason, s.is_deleted,
         s.last_active_at, s.bookings_total, s.bookings_90d, s.last_booking_at, s.avg_days_between, s.lifetime_spend, s.spend_90d,
         s.wallet_balance, s.open_disputes, s.babalawo_sessions, s.babalawo_lifetime_earned, s.tags, count(*) OVER ()
    FROM public._admin_user_stats() s
   WHERE (q IS NULL OR s.full_name ILIKE '%' || q || '%' OR s.email ILIKE '%' || q || '%'
          OR regexp_replace(COALESCE(s.phone, ''), '\D', '', 'g') LIKE '%' || NULLIF(regexp_replace(q, '\D', '', 'g'), '') || '%'
          OR s.id::text = q)
     AND (p_filter IS NULL OR p_filter = 'all'
          OR (p_filter = 'clients' AND NOT ('babalawo' = ANY (s.roles)) AND NOT ('admin' = ANY (s.roles)))
          OR (p_filter = 'babalawos' AND 'babalawo' = ANY (s.roles))
          OR (p_filter = 'admins' AND 'admin' = ANY (s.roles))
          OR (p_filter = 'suspended' AND s.is_suspended)
          OR (p_filter = 'deleted' AND s.is_deleted)
          OR p_filter = ANY (s.tags))
     AND (s.is_deleted IS FALSE OR p_filter = 'deleted' OR q IS NOT NULL)
   ORDER BY
     CASE WHEN p_desc THEN CASE p_sort
       WHEN 'spend' THEN s.lifetime_spend WHEN 'spend_90d' THEN s.spend_90d WHEN 'bookings' THEN s.bookings_total
       WHEN 'bookings_90d' THEN s.bookings_90d WHEN 'wallet' THEN s.wallet_balance
       WHEN 'frequency' THEN -COALESCE(s.avg_days_between, 1e9) END END DESC NULLS LAST,
     CASE WHEN NOT p_desc THEN CASE p_sort
       WHEN 'spend' THEN s.lifetime_spend WHEN 'spend_90d' THEN s.spend_90d WHEN 'bookings' THEN s.bookings_total
       WHEN 'bookings_90d' THEN s.bookings_90d WHEN 'wallet' THEN s.wallet_balance
       WHEN 'frequency' THEN -COALESCE(s.avg_days_between, 1e9) END END ASC NULLS LAST,
     CASE WHEN p_desc THEN CASE p_sort WHEN 'joined' THEN s.created_at WHEN 'last_active' THEN s.last_active_at
       WHEN 'last_booking' THEN s.last_booking_at END END DESC NULLS LAST,
     CASE WHEN NOT p_desc THEN CASE p_sort WHEN 'joined' THEN s.created_at WHEN 'last_active' THEN s.last_active_at
       WHEN 'last_booking' THEN s.last_booking_at END END ASC NULLS LAST,
     CASE WHEN p_sort = 'name' AND p_desc THEN lower(s.full_name) END DESC NULLS LAST,
     CASE WHEN p_sort = 'name' AND NOT p_desc THEN lower(s.full_name) END ASC NULLS LAST,
     s.created_at DESC, s.id
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200) OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END $$;

------------------------------------------------------------------------------
-- 4. Insights
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_user_insights()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  PERFORM public._require_admin();
  WITH s AS (SELECT * FROM public._admin_user_stats() WHERE NOT is_deleted)
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM s),
    'clients', (SELECT count(*) FROM s WHERE NOT ('babalawo' = ANY (roles)) AND NOT ('admin' = ANY (roles))),
    'babalawos', (SELECT count(*) FROM s WHERE 'babalawo' = ANY (roles)),
    'admins', (SELECT count(*) FROM s WHERE 'admin' = ANY (roles)),
    'suspended', (SELECT count(*) FROM s WHERE is_suspended),
    'new_30d', (SELECT count(*) FROM s WHERE created_at > now() - interval '30 days'),
    'active_30d', (SELECT count(*) FROM s WHERE last_active_at > now() - interval '30 days'),
    'payers', (SELECT count(*) FROM s WHERE lifetime_spend > 0),
    'lifetime_spend', (SELECT COALESCE(sum(lifetime_spend), 0) FROM s),
    'spend_90d', (SELECT COALESCE(sum(spend_90d), 0) FROM s),
    'avg_spend_per_payer', (SELECT COALESCE(round(avg(lifetime_spend)), 0) FROM s WHERE lifetime_spend > 0),
    'repeat_rate', (SELECT CASE WHEN count(*) FILTER (WHERE bookings_total >= 1) = 0 THEN 0
                     ELSE round(100.0 * count(*) FILTER (WHERE bookings_total >= 2) / count(*) FILTER (WHERE bookings_total >= 1)) END FROM s),
    'median_days_between', (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY avg_days_between) FROM s WHERE avg_days_between IS NOT NULL),
    'top_spend_share', (SELECT CASE WHEN COALESCE(sum(lifetime_spend), 0) = 0 THEN 0 ELSE round(100.0 * sum(lifetime_spend) FILTER (WHERE 'high_value' = ANY (tags)) / sum(lifetime_spend)) END FROM s),
    'tags', (SELECT COALESCE(jsonb_object_agg(t, n), '{}'::jsonb) FROM (SELECT unnest(tags) t, count(*) n FROM s GROUP BY 1) x),
    'frequency', jsonb_build_object(
       'none', (SELECT count(*) FROM s WHERE bookings_total = 0 AND NOT ('babalawo' = ANY (roles)) AND NOT ('admin' = ANY (roles))),
       'once', (SELECT count(*) FROM s WHERE bookings_total = 1),
       'two_to_three', (SELECT count(*) FROM s WHERE bookings_total BETWEEN 2 AND 3),
       'four_to_nine', (SELECT count(*) FROM s WHERE bookings_total BETWEEN 4 AND 9),
       'ten_plus', (SELECT count(*) FROM s WHERE bookings_total >= 10)),
    'top_spenders', (SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (
       SELECT id, full_name, avatar_url, lifetime_spend, bookings_total, last_booking_at FROM s WHERE lifetime_spend > 0
        ORDER BY lifetime_spend DESC LIMIT 5) x),
    'most_frequent', (SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (
       SELECT id, full_name, avatar_url, bookings_90d, bookings_total, avg_days_between FROM s WHERE bookings_90d > 0
        ORDER BY bookings_90d DESC, bookings_total DESC LIMIT 5) x),
    'signups_by_month', (SELECT COALESCE(jsonb_agg(jsonb_build_object('month', m, 'n', n) ORDER BY m), '[]'::jsonb) FROM (
       SELECT to_char(date_trunc('month', g), 'YYYY-MM') m,
              (SELECT count(*) FROM s WHERE date_trunc('month', s.created_at) = date_trunc('month', g)) n
         FROM generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') g) x),
    'thresholds', jsonb_build_object(
       'high_value_naira', public._setting_int('insights_high_value_naira', 100000),
       'frequent_bookings_90d', public._setting_int('insights_frequent_bookings_90d', 3),
       'lapsed_days', public._setting_int('insights_lapsed_days', 60),
       'new_days', public._setting_int('insights_new_days', 30))
  ) INTO r;
  RETURN r;
END $$;

------------------------------------------------------------------------------
-- 5. Admin notes
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_user_notes (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id  uuid,  -- deliberately no FK: the note belongs to the person it is about, not the admin
  body       text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  pinned     boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_user_notes_user ON public.admin_user_notes(user_id, created_at DESC);
ALTER TABLE public.admin_user_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_user_notes_read ON public.admin_user_notes;
CREATE POLICY admin_user_notes_read ON public.admin_user_notes FOR SELECT TO authenticated USING (public.is_admin());
REVOKE INSERT, UPDATE, DELETE ON public.admin_user_notes FROM anon, authenticated;
GRANT SELECT ON public.admin_user_notes TO authenticated;

-- Erasure anonymises auth.users rather than deleting it, so notes go when deleted_at is set.
CREATE OR REPLACE FUNCTION public._drop_notes_on_erasure()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    DELETE FROM public.admin_user_notes WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._drop_notes_on_erasure() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_drop_admin_notes_on_erasure ON auth.users;
CREATE TRIGGER trg_drop_admin_notes_on_erasure AFTER UPDATE OF deleted_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public._drop_notes_on_erasure();

CREATE OR REPLACE FUNCTION public.admin_add_user_note(p_user_id uuid, p_body text, p_pinned boolean DEFAULT false)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id bigint;
BEGIN
  PERFORM public._require_admin();
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'User not found'; END IF;
  IF COALESCE(btrim(p_body), '') = '' THEN RAISE EXCEPTION 'Write the note first'; END IF;
  INSERT INTO admin_user_notes (user_id, author_id, body, pinned) VALUES (p_user_id, auth.uid(), btrim(p_body), COALESCE(p_pinned, false))
  RETURNING id INTO v_id;
  PERFORM public._admin_log('add_user_note', 'user', p_user_id::text, jsonb_build_object('note_id', v_id));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_update_user_note(p_note_id bigint, p_pinned boolean DEFAULT NULL, p_delete boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n admin_user_notes%ROWTYPE;
BEGIN
  PERFORM public._require_admin();
  SELECT * INTO n FROM admin_user_notes WHERE id = p_note_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Note not found'; END IF;
  IF p_delete THEN
    DELETE FROM admin_user_notes WHERE id = p_note_id;
    PERFORM public._admin_log('delete_user_note', 'user', n.user_id::text, jsonb_build_object('note_id', p_note_id, 'author', n.author_id));
  ELSIF p_pinned IS NOT NULL THEN
    UPDATE admin_user_notes SET pinned = p_pinned WHERE id = p_note_id;
    PERFORM public._admin_log(CASE WHEN p_pinned THEN 'pin_user_note' ELSE 'unpin_user_note' END, 'user', n.user_id::text,
                              jsonb_build_object('note_id', p_note_id));
  END IF;
END $$;

------------------------------------------------------------------------------
-- 6. Message, sign out, suspend
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_message_user(p_user_id uuid, p_title text, p_message text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_admin();
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'User not found'; END IF;
  IF COALESCE(btrim(p_title), '') = '' OR COALESCE(btrim(p_message), '') = '' THEN RAISE EXCEPTION 'A title and a message are required'; END IF;
  IF char_length(p_title) > 120 OR char_length(p_message) > 1000 THEN RAISE EXCEPTION 'The message is too long'; END IF;
  INSERT INTO notifications (user_id, type, title, message, priority)
  VALUES (p_user_id, 'admin_message', btrim(p_title), btrim(p_message), 'high');
  PERFORM public._admin_log('message_user', 'user', p_user_id::text, jsonb_build_object('title', btrim(p_title)));
END $$;

CREATE OR REPLACE FUNCTION public.admin_sign_out_user(p_user_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE n integer;
BEGIN
  PERFORM public._require_admin();
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'Sign yourself out from your own menu'; END IF;
  DELETE FROM auth.sessions WHERE user_id = p_user_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM public._admin_log('sign_out_user', 'user', p_user_id::text, jsonb_build_object('sessions_ended', n));
  RETURN n;
END $$;

-- Same as before, plus: suspending ends every sign-in, so a suspended person is out straight away.
CREATE OR REPLACE FUNCTION public.admin_set_user_suspended(_user_id uuid, _suspended boolean, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE n integer := 0;
BEGIN
  PERFORM public._require_admin();
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot suspend yourself';
  END IF;
  UPDATE public.profiles
     SET is_suspended = _suspended,
         suspended_reason = CASE WHEN _suspended THEN _reason ELSE NULL END,
         suspended_at = CASE WHEN _suspended THEN now() ELSE NULL END
   WHERE id = _user_id;
  IF _suspended THEN
    UPDATE public.babalawos SET is_active = false WHERE user_id = _user_id;
    DELETE FROM auth.sessions WHERE user_id = _user_id;
    GET DIAGNOSTICS n = ROW_COUNT;
  END IF;
  PERFORM public._admin_log(CASE WHEN _suspended THEN 'suspend_user' ELSE 'unsuspend_user' END,
                            'user', _user_id::text, jsonb_build_object('reason', _reason, 'sessions_ended', n));
END;
$$;

------------------------------------------------------------------------------
-- 6b. Babalawo Online history and listing controls
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.babalawo_presence_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  babalawo_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status      text NOT NULL,
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz
);
CREATE INDEX IF NOT EXISTS idx_presence_log_baba ON public.babalawo_presence_log(babalawo_id, started_at DESC);
ALTER TABLE public.babalawo_presence_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS presence_log_admin_read ON public.babalawo_presence_log;
CREATE POLICY presence_log_admin_read ON public.babalawo_presence_log FOR SELECT TO authenticated USING (public.is_admin());
REVOKE INSERT, UPDATE, DELETE ON public.babalawo_presence_log FROM anon, authenticated;
GRANT SELECT ON public.babalawo_presence_log TO authenticated;

CREATE OR REPLACE FUNCTION public._log_babalawo_presence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new text := COALESCE(NEW.current_status, 'offline');
BEGIN
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.current_status, 'offline') = v_new THEN RETURN NEW; END IF;
  UPDATE babalawo_presence_log SET ended_at = now() WHERE babalawo_id = NEW.user_id AND ended_at IS NULL;
  IF v_new <> 'offline' THEN
    INSERT INTO babalawo_presence_log (babalawo_id, status) VALUES (NEW.user_id, v_new);
  END IF;
  DELETE FROM babalawo_presence_log WHERE babalawo_id = NEW.user_id AND started_at < now() - interval '400 days';
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._log_babalawo_presence() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_log_babalawo_presence ON public.babalawos;
CREATE TRIGGER trg_log_babalawo_presence AFTER INSERT OR UPDATE OF current_status ON public.babalawos
  FOR EACH ROW EXECUTE FUNCTION public._log_babalawo_presence();
-- Anyone online right now gets an open entry so the history starts today.
INSERT INTO public.babalawo_presence_log (babalawo_id, status, started_at)
SELECT b.user_id, b.current_status, COALESCE(b.status_changed_at, now()) FROM public.babalawos b
 WHERE b.current_status IN ('online', 'busy')
   AND NOT EXISTS (SELECT 1 FROM public.babalawo_presence_log l WHERE l.babalawo_id = b.user_id AND l.ended_at IS NULL);

CREATE OR REPLACE FUNCTION public.admin_set_babalawo_listing(p_user_id uuid, p_featured boolean DEFAULT NULL, p_take_offline boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_admin();
  IF NOT EXISTS (SELECT 1 FROM babalawos WHERE user_id = p_user_id) THEN RAISE EXCEPTION 'Babalawo not found'; END IF;
  IF p_featured IS NOT NULL THEN
    UPDATE babalawos SET is_featured = p_featured WHERE user_id = p_user_id;
    PERFORM public._admin_log(CASE WHEN p_featured THEN 'feature_babalawo' ELSE 'unfeature_babalawo' END, 'babalawo', p_user_id::text, '{}'::jsonb);
  END IF;
  IF p_take_offline THEN
    UPDATE babalawos SET current_status = 'offline', status_changed_at = now() WHERE user_id = p_user_id AND current_status <> 'offline';
    PERFORM public._admin_log('set_babalawo_offline', 'babalawo', p_user_id::text, '{}'::jsonb);
  END IF;
END $$;

------------------------------------------------------------------------------
-- 7. One person's record
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_user_detail(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  r jsonb;
  v_session_ids bigint[];
BEGIN
  PERFORM public._require_admin();
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN RAISE EXCEPTION 'User not found'; END IF;

  -- Personal-data access log (NDPA s.39 / GDPR art. 5(2) accountability). Throttled so a refresh is not a new entry.
  IF NOT EXISTS (SELECT 1 FROM admin_audit_log WHERE admin_id = auth.uid() AND action = 'view_user_record'
                   AND target_type = 'user' AND target_id = p_user_id::text AND created_at > now() - interval '15 minutes') THEN
    PERFORM public._admin_log('view_user_record', 'user', p_user_id::text, '{}'::jsonb);
  END IF;

  SELECT array_agg(id) INTO v_session_ids FROM sessions WHERE user_id = p_user_id OR babalawo_id = p_user_id;

  SELECT jsonb_build_object(
    'stats', (SELECT to_jsonb(s) FROM public._admin_user_stats() s WHERE s.id = p_user_id),
    'account', (SELECT jsonb_build_object('created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
                  'phone_confirmed_at', u.phone_confirmed_at, 'deleted_at', u.deleted_at, 'signup_role', u.signup_role,
                  'timezone', p.timezone, 'whatsapp_opt_in', p.whatsapp_opt_in, 'sms_opt_in', p.sms_opt_in)
                  FROM auth.users u JOIN profiles p ON p.id = u.id WHERE u.id = p_user_id),
    'roles', (SELECT COALESCE(jsonb_agg(jsonb_build_object('role', r.role, 'granted_at', r.created_at,
                 'granted_by', (SELECT full_name FROM profiles WHERE id = r.granted_by)) ORDER BY r.role), '[]'::jsonb)
                FROM user_roles r WHERE r.user_id = p_user_id),
    'babalawo', (SELECT jsonb_build_object('review_status', b.review_status, 'review_notes', b.review_notes, 'reviewed_at', b.reviewed_at,
                   'is_active', b.is_active, 'is_verified', b.is_verified, 'current_status', b.current_status, 'last_seen_at', b.last_seen_at,
                   'rating', b.rating, 'city', b.city, 'country', b.country, 'session_price', b.session_price, 'instant_price', b.instant_price,
                   'commission_babalawo_percent', b.commission_babalawo_percent,
                   'wallet', (SELECT jsonb_build_object('available', w.available_balance, 'pending', w.pending_balance, 'held', w.held_balance,
                                'lifetime_earned', w.lifetime_earned, 'lifetime_paid_out', w.lifetime_paid_out)
                                FROM babalawo_wallets w WHERE w.babalawo_id = p_user_id),
                   'withdrawals', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', x.id, 'amount', x.amount, 'status', x.status,
                                     'created_at', x.created_at) ORDER BY x.created_at DESC), '[]'::jsonb)
                                     FROM (SELECT * FROM withdrawal_requests WHERE babalawo_id = p_user_id ORDER BY created_at DESC LIMIT 50) x))
                   FROM babalawos b WHERE b.user_id = p_user_id),
    'practice', (SELECT jsonb_build_object(
                   'sessions_total', count(*) FILTER (WHERE s.payment_status IN ('paid', 'refunded') OR s.status = 'completed'),
                   'completed', count(*) FILTER (WHERE s.status = 'completed'),
                   'cancelled', count(*) FILTER (WHERE s.status = 'cancelled'),
                   'upcoming', count(*) FILTER (WHERE s.status IN ('pending', 'confirmed', 'in_progress') AND s.payment_status = 'paid'),
                   'no_shows', count(*) FILTER (WHERE s.no_show = 'babalawo'),
                   'sessions_90d', count(*) FILTER (WHERE s.status = 'completed' AND s.created_at > now() - interval '90 days'),
                   'instant_offered', count(*) FILTER (WHERE s.is_instant AND s.payment_status IN ('paid', 'refunded')),
                   'instant_accepted', count(*) FILTER (WHERE s.is_instant AND s.accepted_at IS NOT NULL),
                   'unique_clients', count(DISTINCT s.user_id) FILTER (WHERE s.status = 'completed'),
                   'repeat_clients', (SELECT count(*) FROM (SELECT user_id FROM sessions WHERE babalawo_id = p_user_id AND status = 'completed'
                                        GROUP BY user_id HAVING count(*) >= 2) rc),
                   'gross_90d', COALESCE((SELECT sum(p.babalawo_amount) FROM payments p WHERE p.babalawo_id = p_user_id AND p.status = 'completed'
                                            AND p.created_at > now() - interval '90 days'), 0),
                   'reviews_count', (SELECT count(*) FROM reviews WHERE babalawo_id = p_user_id),
                   'rating_avg', (SELECT round(avg(rating)::numeric, 2) FROM reviews WHERE babalawo_id = p_user_id),
                   'online_hours_30d', (SELECT round(COALESCE(sum(EXTRACT(epoch FROM LEAST(COALESCE(l.ended_at, now()), now())
                                          - GREATEST(l.started_at, now() - interval '30 days'))), 0)::numeric / 3600, 1)
                                          FROM babalawo_presence_log l WHERE l.babalawo_id = p_user_id AND COALESCE(l.ended_at, now()) > now() - interval '30 days'),
                   'online_days_30d', (SELECT count(DISTINCT d::date) FROM babalawo_presence_log l,
                                          generate_series(date_trunc('day', GREATEST(l.started_at, now() - interval '30 days')), COALESCE(l.ended_at, now()), interval '1 day') d
                                          WHERE l.babalawo_id = p_user_id AND COALESCE(l.ended_at, now()) > now() - interval '30 days'),
                   'presence', (SELECT COALESCE(jsonb_agg(x ORDER BY x.started_at DESC), '[]'::jsonb) FROM (
                                  SELECT l.status, l.started_at, l.ended_at FROM babalawo_presence_log l WHERE l.babalawo_id = p_user_id
                                   ORDER BY l.started_at DESC LIMIT 60) x),
                   'profile', (SELECT jsonb_build_object('bio', b.bio, 'specialties', b.specialties, 'languages', b.languages,
                                  'experience_years', b.experience_years, 'is_featured', b.is_featured,
                                  'reviewed_by', (SELECT full_name FROM profiles WHERE id = b.reviewed_by), 'google_email', b.google_email)
                                  FROM babalawos b WHERE b.user_id = p_user_id),
                   'application', (SELECT to_jsonb(a) - 'reviewed_by' || jsonb_build_object('reviewed_by_name', (SELECT full_name FROM profiles WHERE id = a.reviewed_by))
                                  FROM babalawo_applications a WHERE a.user_id = p_user_id ORDER BY a.created_at DESC LIMIT 1))
                   FROM sessions s WHERE s.babalawo_id = p_user_id),
    'sessions', (SELECT COALESCE(jsonb_agg(x ORDER BY x.created_at DESC), '[]'::jsonb) FROM (
                   SELECT s.id, s.created_at, s.starts_at, s.session_date, s.start_time, s.status, s.payment_status, s.amount, s.is_instant,
                          s.session_type, s.video_provider, s.no_show,
                          CASE WHEN s.user_id = p_user_id THEN 'client' ELSE 'babalawo' END AS as_role,
                          CASE WHEN s.user_id = p_user_id THEN s.babalawo_id ELSE s.user_id END AS other_id,
                          (SELECT full_name FROM profiles WHERE id = CASE WHEN s.user_id = p_user_id THEN s.babalawo_id ELSE s.user_id END) AS other_name
                     FROM sessions s WHERE s.user_id = p_user_id OR s.babalawo_id = p_user_id
                    ORDER BY s.created_at DESC LIMIT 200) x),
    'payments', (SELECT COALESCE(jsonb_agg(x ORDER BY x.created_at DESC), '[]'::jsonb) FROM (
                   SELECT p.id, p.created_at, p.amount, p.refunded_amount, p.status, p.payment_gateway, p.payment_reference, p.session_id, p.ebo_id,
                          p.commission_amount
                     FROM payments p WHERE p.user_id = p_user_id ORDER BY p.created_at DESC LIMIT 200) x),
    'wallet', jsonb_build_object(
                   'balance', COALESCE((SELECT balance FROM wallets WHERE user_id = p_user_id), 0),
                   'transactions', (SELECT COALESCE(jsonb_agg(x ORDER BY x.created_at DESC), '[]'::jsonb) FROM (
                      SELECT t.id, t.created_at, t.amount, t.transaction_type, t.transaction_source, t.description, t.status, t.balance_after,
                             t.payment_reference
                        FROM wallet_transactions t WHERE t.user_id = p_user_id ORDER BY t.created_at DESC LIMIT 100) x)),
    'ebo', (SELECT COALESCE(jsonb_agg(x ORDER BY x.created_at DESC), '[]'::jsonb) FROM (
                   SELECT e.id, e.created_at, e.kind, e.title, e.status, e.amount_due, e.total, e.paid_at, e.session_id,
                          CASE WHEN e.client_id = p_user_id THEN 'client' ELSE 'babalawo' END AS as_role,
                          (SELECT full_name FROM profiles WHERE id = CASE WHEN e.client_id = p_user_id THEN e.babalawo_id ELSE e.client_id END) AS other_name
                     FROM ebo_prescriptions e WHERE e.client_id = p_user_id OR e.babalawo_id = p_user_id
                    ORDER BY e.created_at DESC LIMIT 100) x),
    'disputes', (SELECT COALESCE(jsonb_agg(x ORDER BY x.created_at DESC), '[]'::jsonb) FROM (
                   SELECT d.id, d.created_at, d.session_id, d.ebo_id, d.status, d.reason, d.resolution_note, d.resolved_at,
                          (d.raised_by = p_user_id) AS raised_by_them
                     FROM disputes d WHERE d.raised_by = p_user_id OR d.session_id = ANY (COALESCE(v_session_ids, '{}'))
                    ORDER BY d.created_at DESC LIMIT 100) x),
    'reviews', (SELECT COALESCE(jsonb_agg(x ORDER BY x.created_at DESC), '[]'::jsonb) FROM (
                   SELECT v.id, v.created_at, v.rating, v.comment, v.flagged, v.is_approved, v.session_id,
                          CASE WHEN v.user_id = p_user_id THEN 'wrote' ELSE 'received' END AS direction,
                          (SELECT full_name FROM profiles WHERE id = CASE WHEN v.user_id = p_user_id THEN v.babalawo_id ELSE v.user_id END) AS other_name
                     FROM reviews v WHERE v.user_id = p_user_id OR v.babalawo_id = p_user_id ORDER BY v.created_at DESC LIMIT 100) x),
    'consents', (SELECT COALESCE(jsonb_agg(x ORDER BY x.purpose), '[]'::jsonb) FROM (
                   SELECT DISTINCT ON (c.purpose) c.purpose, c.granted, c.notice_version, c.source, c.created_at
                     FROM privacy_consents c WHERE c.user_id = p_user_id ORDER BY c.purpose, c.created_at DESC, c.id DESC) x),
    'privacy_requests', (SELECT COALESCE(jsonb_agg(x ORDER BY x.received_at DESC), '[]'::jsonb) FROM (
                   SELECT d.id, d.request_type, d.status, d.source, d.received_at, d.due_at, d.completed_at
                     FROM data_subject_requests d WHERE d.user_id = p_user_id ORDER BY d.received_at DESC LIMIT 50) x),
    'sign_ins', (SELECT COALESCE(jsonb_agg(x ORDER BY x.created_at DESC), '[]'::jsonb) FROM (
                   SELECT a.created_at, a.updated_at, a.expires_at, a.ip_address, a.user_agent
                     FROM auth.sessions a WHERE a.user_id = p_user_id ORDER BY a.created_at DESC LIMIT 20) x),
    'notes', (SELECT COALESCE(jsonb_agg(x ORDER BY x.pinned DESC, x.created_at DESC), '[]'::jsonb) FROM (
                   SELECT n.id, n.body, n.pinned, n.created_at, n.author_id, (SELECT full_name FROM profiles WHERE id = n.author_id) AS author_name
                     FROM admin_user_notes n WHERE n.user_id = p_user_id) x),
    'audit', (SELECT COALESCE(jsonb_agg(x ORDER BY x.created_at DESC), '[]'::jsonb) FROM (
                   SELECT l.id, l.created_at, l.action, l.target_type, l.details, (SELECT full_name FROM profiles WHERE id = l.admin_id) AS admin_name
                     FROM admin_audit_log l
                    WHERE (l.target_type IN ('user', 'babalawo') AND l.target_id = p_user_id::text)
                       OR (l.target_type = 'session' AND l.target_id = ANY (SELECT unnest(v_session_ids)::text))
                    ORDER BY l.created_at DESC LIMIT 150) x)
  ) INTO r;
  RETURN r;
END $$;

------------------------------------------------------------------------------
-- Grants
------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.admin_user_directory(text, text, text, boolean, integer, integer),
                       public.admin_user_insights(),
                       public.admin_user_detail(uuid),
                       public.admin_add_user_note(uuid, text, boolean),
                       public.admin_update_user_note(bigint, boolean, boolean),
                       public.admin_message_user(uuid, text, text),
                       public.admin_sign_out_user(uuid),
                       public.admin_set_babalawo_listing(uuid, boolean, boolean),
                       public.admin_set_user_suspended(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_directory(text, text, text, boolean, integer, integer),
                          public.admin_user_insights(),
                          public.admin_user_detail(uuid),
                          public.admin_add_user_note(uuid, text, boolean),
                          public.admin_update_user_note(bigint, boolean, boolean),
                          public.admin_message_user(uuid, text, text),
                          public.admin_sign_out_user(uuid),
                          public.admin_set_babalawo_listing(uuid, boolean, boolean),
                          public.admin_set_user_suspended(uuid, boolean, text) TO authenticated;
