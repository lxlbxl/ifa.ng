-- Insight cards for the admin pages.
--
-- One admin-only RPC, public.admin_insights(section, days), returns every number the
-- insight cards on an admin page need, in one round trip. Each metric is either:
--   * a period metric: {"value": <this period>, "prev": <the period before>, "spark": [12 buckets]}
--   * a snapshot:      {"value": <right now>}
-- The web app (src/components/dashboard/admin/insights) decides labels, formats and colours.
-- Admin → Users has its own insights (admin_user_insights), so 'users' is not a section here.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

-- Aggregates rows (at timestamptz, v numeric) from p_sql over the last p_days, the p_days
-- before that, and 12 equal buckets of the current period (the sparkline).
-- p_agg: sum | count | avg | median | rate (rate = share of rows with v = 1, in percent).
-- p_sql is only ever a constant written in this file; callers never pass user text.
CREATE OR REPLACE FUNCTION private.insight_metric(p_sql text, p_days integer, p_agg text DEFAULT 'sum')
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  v_now   timestamptz := now();
  v_span  interval := make_interval(days => p_days);
  v_agg   text;
  v_value numeric;
  v_prev  numeric;
  v_spark numeric[];
BEGIN
  v_agg := CASE p_agg
    WHEN 'sum'    THEN 'COALESCE(sum(v), 0)'
    WHEN 'count'  THEN 'count(*)::numeric'
    WHEN 'avg'    THEN 'avg(v)'
    WHEN 'median' THEN 'percentile_cont(0.5) WITHIN GROUP (ORDER BY v)::numeric'
    WHEN 'rate'   THEN 'avg(CASE WHEN v = 1 THEN 100.0 ELSE 0 END)'
    ELSE NULL END;
  IF v_agg IS NULL THEN RAISE EXCEPTION 'Unknown aggregate %', p_agg; END IF;

  EXECUTE format(
    'SELECT (SELECT %1$s FROM (%2$s) s WHERE s.at >= $1 - $2 AND s.at < $1),
            (SELECT %1$s FROM (%2$s) s WHERE s.at >= $1 - $2 * 2 AND s.at < $1 - $2),
            (SELECT array_agg(COALESCE(b.val, 0) ORDER BY g.i)
               FROM generate_series(0, 11) g(i)
               LEFT JOIN (SELECT least(11, floor(extract(epoch FROM s.at - ($1 - $2)) / (extract(epoch FROM $2) / 12)))::int AS i,
                                 %1$s AS val
                            FROM (%2$s) s WHERE s.at >= $1 - $2 AND s.at < $1 GROUP BY 1) b ON b.i = g.i)',
    v_agg, p_sql)
  INTO v_value, v_prev, v_spark
  USING v_now, v_span;

  RETURN jsonb_build_object('value', round(v_value, 2), 'prev', round(v_prev, 2), 'spark', to_jsonb(v_spark));
END $$;

REVOKE ALL ON FUNCTION private.insight_metric(text, integer, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.insight_now(p_value numeric)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$ SELECT jsonb_build_object('value', round(COALESCE(p_value, 0), 2)) $$;

REVOKE ALL ON FUNCTION private.insight_now(numeric) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.admin_insights(p_section text, p_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d integer := least(greatest(COALESCE(p_days, 30), 1), 366);
  m jsonb := '{}'::jsonb;
  -- Money that actually arrived: settled payments, net of refunds.
  paid CONSTANT text := $q$SELECT created_at AS at, amount - COALESCE(refunded_amount, 0) AS v FROM payments
                         WHERE status IN ('completed', 'refunded', 'paid', 'successful')$q$;
  fees CONSTANT text := $q$SELECT created_at AS at, COALESCE(commission_amount, 0) AS v FROM payments
                         WHERE status IN ('completed', 'paid', 'successful')$q$;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501';
  END IF;

  CASE p_section
  WHEN 'overview' THEN
    m := jsonb_build_object(
      'gmv',               private.insight_metric(paid, d),
      'platform_revenue',  private.insight_metric(fees, d),
      'sessions_completed',private.insight_metric($q$SELECT completed_at AS at, 1 AS v FROM sessions WHERE status = 'completed' AND completed_at IS NOT NULL$q$, d, 'count'),
      'new_users',         private.insight_metric($q$SELECT created_at AS at, 1 AS v FROM profiles$q$, d, 'count'),
      'babalawos_live',    private.insight_now((SELECT count(*) FROM babalawos WHERE is_active AND review_status = 'approved')),
      'online_now',        private.insight_now((SELECT count(*) FROM babalawos WHERE current_status = 'online')),
      'open_disputes',     private.insight_now((SELECT count(*) FROM disputes WHERE status IN ('open', 'investigating'))),
      'pending_withdrawals', private.insight_now((SELECT sum(amount) FROM withdrawal_requests WHERE status IN ('pending', 'approved'))),
      'applications_waiting', private.insight_now((SELECT count(*) FROM babalawo_applications WHERE status = 'waitlisted'))
    );

  WHEN 'bookings' THEN
    m := jsonb_build_object(
      'bookings',        private.insight_metric($q$SELECT created_at AS at, 1 AS v FROM sessions$q$, d, 'count'),
      'completion_rate', private.insight_metric($q$SELECT COALESCE(starts_at, created_at) AS at, CASE WHEN status = 'completed' THEN 1 ELSE 0 END AS v
                                                   FROM sessions WHERE status IN ('completed', 'cancelled') AND COALESCE(starts_at, created_at) < now()$q$, d, 'rate'),
      'avg_value',       private.insight_metric($q$SELECT created_at AS at, amount AS v FROM sessions WHERE amount > 0 AND status <> 'cancelled'$q$, d, 'avg'),
      'instant_share',   private.insight_metric($q$SELECT created_at AS at, CASE WHEN is_instant THEN 1 ELSE 0 END AS v FROM sessions$q$, d, 'rate'),
      'accept_minutes',  private.insight_metric($q$SELECT created_at AS at, extract(epoch FROM accepted_at - created_at) / 60 AS v
                                                   FROM sessions WHERE is_instant AND accepted_at IS NOT NULL$q$, d, 'median'),
      'no_shows',        private.insight_metric($q$SELECT COALESCE(starts_at, created_at) AS at, 1 AS v FROM sessions WHERE no_show = 'babalawo'$q$, d, 'count'),
      'upcoming',        private.insight_now((SELECT count(*) FROM sessions WHERE status IN ('pending', 'confirmed') AND COALESCE(starts_at, session_date::timestamptz) >= now())),
      'today',           private.insight_now((SELECT count(*) FROM sessions WHERE status <> 'cancelled' AND COALESCE(starts_at, session_date::timestamptz) >= date_trunc('day', now())
                                                                     AND COALESCE(starts_at, session_date::timestamptz) < date_trunc('day', now()) + interval '1 day'))
    );

  WHEN 'disputes' THEN
    m := jsonb_build_object(
      'opened',          private.insight_metric($q$SELECT created_at AS at, 1 AS v FROM disputes$q$, d, 'count'),
      'open_now',        private.insight_now((SELECT count(*) FROM disputes WHERE status IN ('open', 'investigating'))),
      'oldest_open_days',private.insight_now((SELECT extract(epoch FROM now() - min(created_at)) / 86400 FROM disputes WHERE status IN ('open', 'investigating'))),
      'resolve_hours',   private.insight_metric($q$SELECT resolved_at AS at, extract(epoch FROM resolved_at - created_at) / 3600 AS v FROM disputes WHERE resolved_at IS NOT NULL$q$, d, 'median'),
      'refund_rate',     private.insight_metric($q$SELECT resolved_at AS at, CASE WHEN status = 'resolved_refund' THEN 1 ELSE 0 END AS v
                                                   FROM disputes WHERE resolved_at IS NOT NULL$q$, d, 'rate'),
      'dispute_rate',    jsonb_build_object(
                           'value', round(100.0 * (SELECT count(*) FROM disputes WHERE created_at >= now() - make_interval(days => d))
                                    / NULLIF((SELECT count(*) FROM sessions WHERE status = 'completed' AND completed_at >= now() - make_interval(days => d)), 0), 2),
                           'prev',  round(100.0 * (SELECT count(*) FROM disputes WHERE created_at >= now() - make_interval(days => d * 2) AND created_at < now() - make_interval(days => d))
                                    / NULLIF((SELECT count(*) FROM sessions WHERE status = 'completed' AND completed_at >= now() - make_interval(days => d * 2) AND completed_at < now() - make_interval(days => d)), 0), 2))
    );

  WHEN 'ebo' THEN
    m := jsonb_build_object(
      'sent',            private.insight_metric($q$SELECT sent_at AS at, 1 AS v FROM ebo_prescriptions WHERE sent_at IS NOT NULL$q$, d, 'count'),
      'paid_rate',       private.insight_metric($q$SELECT sent_at AS at, CASE WHEN paid_at IS NOT NULL THEN 1 ELSE 0 END AS v FROM ebo_prescriptions WHERE sent_at IS NOT NULL$q$, d, 'rate'),
      'value',           private.insight_metric($q$SELECT paid_at AS at, COALESCE(total, 0) - COALESCE(refunded_amount, 0) AS v FROM ebo_prescriptions WHERE paid_at IS NOT NULL$q$, d),
      'platform_fees',   private.insight_metric($q$SELECT paid_at AS at, COALESCE(platform_fee, 0) AS v FROM ebo_prescriptions WHERE paid_at IS NOT NULL AND status NOT IN ('refunded')$q$, d),
      'awaiting',        private.insight_now((SELECT count(*) FROM ebo_prescriptions WHERE status IN ('paid', 'in_progress'))),
      'awaiting_confirm',private.insight_now((SELECT count(*) FROM ebo_prescriptions WHERE status = 'performed')),
      'days_to_perform', private.insight_metric($q$SELECT performed_at AS at, extract(epoch FROM performed_at - paid_at) / 86400 AS v
                                                   FROM ebo_prescriptions WHERE performed_at IS NOT NULL AND paid_at IS NOT NULL$q$, d, 'median')
    );

  WHEN 'reviews' THEN
    m := jsonb_build_object(
      'reviews',         private.insight_metric($q$SELECT created_at AS at, 1 AS v FROM reviews$q$, d, 'count'),
      'avg_rating',      private.insight_metric($q$SELECT created_at AS at, rating AS v FROM reviews$q$, d, 'avg'),
      'five_star',       private.insight_metric($q$SELECT created_at AS at, CASE WHEN rating = 5 THEN 1 ELSE 0 END AS v FROM reviews$q$, d, 'rate'),
      'review_rate',     jsonb_build_object(
                           'value', round(100.0 * (SELECT count(*) FROM reviews WHERE created_at >= now() - make_interval(days => d))
                                    / NULLIF((SELECT count(*) FROM sessions WHERE status = 'completed' AND completed_at >= now() - make_interval(days => d)), 0), 2)),
      'flagged',         private.insight_now((SELECT count(*) FROM reviews WHERE flagged)),
      'hidden',          private.insight_now((SELECT count(*) FROM reviews WHERE NOT is_approved))
    );

  WHEN 'babalawos' THEN
    m := jsonb_build_object(
      'live',            private.insight_now((SELECT count(*) FROM babalawos WHERE is_active AND review_status = 'approved')),
      'online_now',      private.insight_now((SELECT count(*) FROM babalawos WHERE current_status = 'online')),
      'pending_review',  private.insight_now((SELECT count(*) FROM babalawos WHERE review_status = 'pending')),
      'joined',          private.insight_metric($q$SELECT created_at AS at, 1 AS v FROM babalawos$q$, d, 'count'),
      'utilisation',     jsonb_build_object(
                           'value', round(100.0 * (SELECT count(DISTINCT babalawo_id) FROM sessions WHERE status = 'completed' AND completed_at >= now() - make_interval(days => d))
                                    / NULLIF((SELECT count(*) FROM babalawos WHERE is_active AND review_status = 'approved'), 0), 2)),
      'avg_rating',      private.insight_now((SELECT avg(rating)::numeric FROM babalawos WHERE is_active AND review_status = 'approved' AND rating > 0)),
      'earnings',        private.insight_metric($q$SELECT created_at AS at, amount AS v FROM babalawo_ledger WHERE entry_type IN ('earning', 'ebo_earning')$q$, d)
    );

  WHEN 'applications' THEN
    m := jsonb_build_object(
      'received',        private.insight_metric($q$SELECT created_at AS at, 1 AS v FROM babalawo_applications$q$, d, 'count'),
      'waiting',         private.insight_now((SELECT count(*) FROM babalawo_applications WHERE status = 'waitlisted')),
      'oldest_days',     private.insight_now((SELECT extract(epoch FROM now() - min(created_at)) / 86400 FROM babalawo_applications WHERE status = 'waitlisted')),
      'approval_rate',   private.insight_metric($q$SELECT reviewed_at AS at, CASE WHEN status = 'approved' THEN 1 ELSE 0 END AS v
                                                   FROM babalawo_applications WHERE status IN ('approved', 'rejected') AND reviewed_at IS NOT NULL$q$, d, 'rate'),
      'review_days',     private.insight_metric($q$SELECT reviewed_at AS at, extract(epoch FROM reviewed_at - created_at) / 86400 AS v
                                                   FROM babalawo_applications WHERE reviewed_at IS NOT NULL$q$, d, 'median')
    );

  WHEN 'finance' THEN
    m := jsonb_build_object(
      'gmv',             private.insight_metric(paid, d),
      'platform_revenue',private.insight_metric(fees, d),
      'take_rate',       jsonb_build_object(
                           'value', round(100.0 * ((private.insight_metric(fees, d)->>'value')::numeric) / NULLIF((private.insight_metric(paid, d)->>'value')::numeric, 0), 2),
                           'prev',  round(100.0 * ((private.insight_metric(fees, d)->>'prev')::numeric) / NULLIF((private.insight_metric(paid, d)->>'prev')::numeric, 0), 2)),
      'refunds',         private.insight_metric($q$SELECT created_at AS at, amount AS v FROM refunds$q$, d),
      'paid_out',        private.insight_metric($q$SELECT COALESCE(processed_at, updated_at) AS at, amount AS v FROM withdrawal_requests WHERE status = 'completed'$q$, d),
      'owed_babalawos',  private.insight_now((SELECT sum(COALESCE(available_balance, 0) + COALESCE(pending_balance, 0) + COALESCE(held_balance, 0)) FROM babalawo_wallets)),
      'wallet_liability',private.insight_now((SELECT sum(balance) FROM wallets))
    );

  WHEN 'transactions' THEN
    m := jsonb_build_object(
      'payments',        private.insight_metric($q$SELECT created_at AS at, 1 AS v FROM payments WHERE status IN ('completed', 'refunded', 'paid', 'successful')$q$, d, 'count'),
      'success_rate',    private.insight_metric($q$SELECT created_at AS at, CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END AS v
                                                   FROM payment_intents WHERE status IN ('succeeded', 'failed', 'expired')$q$, d, 'rate'),
      'failed',          private.insight_metric($q$SELECT created_at AS at, 1 AS v FROM payment_intents WHERE status IN ('failed', 'expired')$q$, d, 'count'),
      'avg_ticket',      private.insight_metric(paid, d, 'avg'),
      'needs_review',    private.insight_now((SELECT count(*) FROM payment_intents WHERE status = 'needs_review'))
    );

  WHEN 'wallet-management' THEN
    m := jsonb_build_object(
      'liability',       private.insight_now((SELECT sum(balance) FROM wallets)),
      'funded_wallets',  private.insight_now((SELECT count(*) FROM wallets WHERE balance > 0)),
      'top_ups',         private.insight_metric($q$SELECT created_at AS at, amount AS v FROM wallet_transactions
                                                   WHERE transaction_type = 'credit' AND COALESCE(status, 'completed') = 'completed'$q$, d),
      'spent',           private.insight_metric($q$SELECT created_at AS at, abs(amount) AS v FROM wallet_transactions
                                                   WHERE transaction_type = 'debit' AND COALESCE(status, 'completed') = 'completed'$q$, d),
      'avg_balance',     private.insight_now((SELECT avg(balance) FROM wallets WHERE balance > 0))
    );

  WHEN 'withdrawal-management' THEN
    m := jsonb_build_object(
      'pending_amount',  private.insight_now((SELECT sum(amount) FROM withdrawal_requests WHERE status IN ('pending', 'approved'))),
      'pending_count',   private.insight_now((SELECT count(*) FROM withdrawal_requests WHERE status IN ('pending', 'approved'))),
      'oldest_hours',    private.insight_now((SELECT extract(epoch FROM now() - min(created_at)) / 3600 FROM withdrawal_requests WHERE status IN ('pending', 'approved'))),
      'paid_out',        private.insight_metric($q$SELECT COALESCE(processed_at, updated_at) AS at, amount AS v FROM withdrawal_requests WHERE status = 'completed'$q$, d),
      'payout_hours',    private.insight_metric($q$SELECT processed_at AS at, extract(epoch FROM processed_at - created_at) / 3600 AS v
                                                   FROM withdrawal_requests WHERE status = 'completed' AND processed_at IS NOT NULL$q$, d, 'median'),
      'rejected',        private.insight_metric($q$SELECT COALESCE(processed_at, updated_at) AS at, 1 AS v FROM withdrawal_requests WHERE status = 'rejected'$q$, d, 'count'),
      'available',       private.insight_now((SELECT sum(available_balance) FROM babalawo_wallets))
    );

  WHEN 'privacy' THEN
    m := jsonb_build_object(
      'open',            private.insight_now((SELECT count(*) FROM data_subject_requests WHERE status NOT IN ('completed', 'rejected'))),
      'overdue',         private.insight_now((SELECT count(*) FROM data_subject_requests WHERE status NOT IN ('completed', 'rejected') AND due_at < now())),
      'due_week',        private.insight_now((SELECT count(*) FROM data_subject_requests WHERE status NOT IN ('completed', 'rejected') AND due_at >= now() AND due_at < now() + interval '7 days')),
      'received',        private.insight_metric($q$SELECT received_at AS at, 1 AS v FROM data_subject_requests$q$, d, 'count'),
      'days_to_close',   private.insight_metric($q$SELECT completed_at AS at, extract(epoch FROM completed_at - received_at) / 86400 AS v
                                                   FROM data_subject_requests WHERE completed_at IS NOT NULL$q$, d, 'median'),
      'on_time',         private.insight_metric($q$SELECT completed_at AS at, CASE WHEN completed_at <= due_at THEN 1 ELSE 0 END AS v
                                                   FROM data_subject_requests WHERE completed_at IS NOT NULL AND due_at IS NOT NULL$q$, d, 'rate'),
      'open_breaches',   private.insight_now((SELECT count(*) FROM data_breaches WHERE status <> 'closed')),
      'consent_opt_ins', private.insight_metric($q$SELECT created_at AS at, CASE WHEN granted THEN 1 ELSE 0 END AS v FROM privacy_consents$q$, d, 'rate')
    );

  WHEN 'activity' THEN
    m := jsonb_build_object(
      'actions',         private.insight_metric($q$SELECT created_at AS at, 1 AS v FROM admin_audit_log$q$, d, 'count'),
      'active_admins',   private.insight_now((SELECT count(DISTINCT admin_id) FROM admin_audit_log WHERE created_at >= now() - make_interval(days => d))),
      'admins',          private.insight_now((SELECT count(*) FROM user_roles WHERE role = 'admin')),
      'top_action',      jsonb_build_object('value', (SELECT action FROM admin_audit_log WHERE created_at >= now() - make_interval(days => d)
                                                       GROUP BY action ORDER BY count(*) DESC, action LIMIT 1))
    );

  ELSE
    RAISE EXCEPTION 'Unknown insights section %', p_section USING ERRCODE = '22023';
  END CASE;

  RETURN jsonb_build_object('section', p_section, 'days', d, 'generated_at', now(), 'metrics', m);
END $$;

REVOKE ALL ON FUNCTION public.admin_insights(text, integer) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.admin_insights(text, integer) FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.admin_insights(text, integer) TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.admin_insights(text, integer) TO service_role';
  END IF;
END $$;
