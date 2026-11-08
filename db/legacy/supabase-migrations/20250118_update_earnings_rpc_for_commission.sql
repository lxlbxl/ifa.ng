-- Update the earnings RPC function to calculate actual babalawo earnings after commission
CREATE OR REPLACE FUNCTION get_babalawo_earnings_stats(p_babalawo_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_all_time_earnings DECIMAL;
    v_available_balance DECIMAL;
    v_pending_payouts DECIMAL;
    v_withdrawal_requests JSONB;
    v_payout_history JSONB;
    v_commission_rates JSONB;
    v_babalawo_numeric_id BIGINT;
BEGIN
    -- Convert UUID to numeric babalawo ID
    SELECT id INTO v_babalawo_numeric_id
    FROM babalawos
    WHERE user_id = p_babalawo_id;

    -- 1. Calculate All-Time Earnings from completed sessions using babalawo_amount from payments
    -- This represents actual earnings after platform commission
    SELECT COALESCE(SUM(p.babalawo_amount), 0)
    INTO v_all_time_earnings
    FROM payments p
    JOIN sessions s ON s.id = p.session_id
    WHERE s.babalawo_id = v_babalawo_numeric_id
      AND s.status = 'completed'
      AND p.babalawo_amount IS NOT NULL;

    -- If no payment records with babalawo_amount, fallback to session amounts (for backward compatibility)
    IF v_all_time_earnings = 0 THEN
        SELECT COALESCE(SUM(amount), 0)
        INTO v_all_time_earnings
        FROM sessions
        WHERE babalawo_id = v_babalawo_numeric_id AND status = 'completed';
    END IF;

    -- 2. Get Available Balance from the wallet
    SELECT COALESCE(available_balance, 0)
    INTO v_available_balance
    FROM babalawo_wallets
    WHERE babalawo_id = p_babalawo_id;

    -- 3. Calculate Pending Payouts from withdrawal requests
    SELECT COALESCE(SUM(amount), 0)
    INTO v_pending_payouts
    FROM withdrawal_requests
    WHERE babalawo_id = p_babalawo_id AND status IN ('pending', 'approved');

    -- 4. Get Withdrawal Requests history
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', id,
            'amount', amount,
            'status', status,
            'created_at', created_at
        )
    ), '[]'::jsonb)
    INTO v_withdrawal_requests
    FROM withdrawal_requests
    WHERE babalawo_id = p_babalawo_id
    ORDER BY created_at DESC;

    -- 5. Get Payout History
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', id,
            'amount', amount,
            'method', method,
            'reference', reference,
            'created_at', created_at,
            'status', status
        )
    ), '[]'::jsonb)
    INTO v_payout_history
    FROM payouts
    WHERE babalawo_id = p_babalawo_id
    ORDER BY created_at DESC;

    -- 6. Get Commission Rates
    SELECT COALESCE(jsonb_build_object(
        'platformPercent', b.commission_platform_percent,
        'babalawoPercent', b.commission_babalawo_percent
    ), jsonb_build_object('platformPercent', 20, 'babalawoPercent', 80))
    INTO v_commission_rates
    FROM babalawos b
    WHERE b.user_id = p_babalawo_id;

    -- 7. Return all stats as a single JSONB object
    RETURN jsonb_build_object(
        'allTimeEarnings', v_all_time_earnings,
        'availableBalance', v_available_balance,
        'pendingPayouts', v_pending_payouts,
        'withdrawalRequests', v_withdrawal_requests,
        'payoutHistory', v_payout_history,
        'commissionRates', v_commission_rates
    );
END;
$$;

COMMENT ON FUNCTION get_babalawo_earnings_stats(UUID) IS 'Returns earnings statistics for a babalawo, calculating actual earnings after platform commission from payment records';
