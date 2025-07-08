CREATE OR REPLACE FUNCTION get_babalawo_dashboard_stats(p_babalawo_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stats JSONB;
    v_today DATE := CURRENT_DATE;
    v_this_month_start DATE := date_trunc('month', v_today);
    v_last_month_start DATE := date_trunc('month', v_today - interval '1 month');
    v_last_month_end DATE := date_trunc('month', v_today) - interval '1 day';
BEGIN
    SELECT jsonb_build_object(
        'totalEarnings', (
            SELECT COALESCE(SUM(amount), 0)
            FROM sessions
            WHERE babalawo_id = p_babalawo_id AND status = 'completed' AND session_date >= v_this_month_start
        ),
        'totalConsultations', (
            SELECT COUNT(*)
            FROM sessions
            WHERE babalawo_id = p_babalawo_id AND session_date >= v_this_month_start
        ),
        'averageRating', (
            SELECT COALESCE(AVG(rating), 0)
            FROM reviews
            WHERE babalawo_id = p_babalawo_id
        ),
        'totalReviews', (
            SELECT COUNT(*)
            FROM reviews
            WHERE babalawo_id = p_babalawo_id
        ),
        'completionRate', (
            SELECT CASE
                WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE status = 'completed')) * 100.0 / COUNT(*))
                ELSE 0
            END
            FROM sessions
            WHERE babalawo_id = p_babalawo_id
        ),
        'earningsChange', (
            SELECT CASE
                WHEN (SELECT SUM(amount) FROM sessions WHERE babalawo_id = p_babalawo_id AND status = 'completed' AND session_date BETWEEN v_last_month_start AND v_last_month_end) > 0
                THEN ROUND(
                    (
                        (
                            (SELECT SUM(amount) FROM sessions WHERE babalawo_id = p_babalawo_id AND status = 'completed' AND session_date >= v_this_month_start) -
                            (SELECT SUM(amount) FROM sessions WHERE babalawo_id = p_babalawo_id AND status = 'completed' AND session_date BETWEEN v_last_month_start AND v_last_month_end)
                        ) /
                        (SELECT SUM(amount) FROM sessions WHERE babalawo_id = p_babalawo_id AND status = 'completed' AND session_date BETWEEN v_last_month_start AND v_last_month_end)
                    ) * 100
                )
                ELSE 100
            END
        ),
        'consultationsChange', (
            SELECT CASE
                WHEN (SELECT COUNT(*) FROM sessions WHERE babalawo_id = p_babalawo_id AND session_date BETWEEN v_last_month_start AND v_last_month_end) > 0
                THEN ROUND(
                    (
                        (
                            (SELECT COUNT(*) FROM sessions WHERE babalawo_id = p_babalawo_id AND session_date >= v_this_month_start) -
                            (SELECT COUNT(*) FROM sessions WHERE babalawo_id = p_babalawo_id AND session_date BETWEEN v_last_month_start AND v_last_month_end)
                        ) * 100.0 /
                        (SELECT COUNT(*) FROM sessions WHERE babalawo_id = p_babalawo_id AND session_date BETWEEN v_last_month_start AND v_last_month_end)
                    )
                )
                ELSE 100
            END
        ),
        'todaysSessions', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', s.id,
                    'session_date', s.session_date,
                    'start_time', s.start_time,
                    'end_time', s.end_time,
                    'user_id', s.user_id,
                    'status', s.status
                )
            ), '[]'::jsonb)
            FROM sessions s
            WHERE s.babalawo_id = p_babalawo_id
              AND s.session_date = v_today
              AND s.status IN ('pending', 'confirmed')
        ),
        'nextSession', (
            SELECT jsonb_build_object(
                'id', s.id,
                'session_date', s.session_date,
                'start_time', s.start_time,
                'end_time', s.end_time,
                'status', s.status,
                'user_id', s.user_id
            )
            FROM sessions s
            WHERE s.babalawo_id = p_babalawo_id
              AND s.status IN ('pending', 'confirmed')
              AND s.session_date >= v_today
            ORDER BY s.session_date, s.start_time
            LIMIT 1
        ),
        'upcomingBookings', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', s.id,
                    'session_date', s.session_date,
                    'start_time', s.start_time,
                    'end_time', s.end_time,
                    'status', s.status,
                    'user_id', s.user_id
                )
            ), '[]'::jsonb)
            FROM sessions s
            WHERE s.babalawo_id = p_babalawo_id
              AND s.status IN ('pending', 'confirmed')
              AND s.session_date >= v_today
            ORDER BY s.session_date, s.start_time
            LIMIT 5
        ),
        'notifications', (
            SELECT COALESCE(jsonb_agg(n.*), '[]'::jsonb)
            FROM notifications n
            WHERE n.recipient_id = p_babalawo_id
            ORDER BY n.created_at DESC
            LIMIT 5
        ),
        'isActive', (
            SELECT b.is_active
            FROM babalawos b
            WHERE b.id = p_babalawo_id
        )
    )
    INTO v_stats;

    RETURN v_stats;
END;
$$;
