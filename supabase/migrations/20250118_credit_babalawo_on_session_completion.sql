-- Create function to credit babalawo wallet when session is completed
CREATE OR REPLACE FUNCTION credit_babalawo_on_session_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_babalawo_amount DECIMAL;
    v_babalawo_user_id UUID;
BEGIN
    -- Only process when status changes to 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN

        -- Get the babalawo user_id from the session
        SELECT user_id INTO v_babalawo_user_id
        FROM babalawos
        WHERE id = NEW.babalawo_id;

        -- Get the babalawo_amount from the payment record
        SELECT babalawo_amount INTO v_babalawo_amount
        FROM payments
        WHERE session_id = NEW.id
        LIMIT 1;

        -- Only credit if we have a valid amount
        IF v_babalawo_amount IS NOT NULL AND v_babalawo_amount > 0 THEN

            -- Ensure babalawo wallet exists
            INSERT INTO babalawo_wallets (babalawo_id, available_balance)
            VALUES (v_babalawo_user_id, 0)
            ON CONFLICT (babalawo_id) DO NOTHING;

            -- Credit the babalawo wallet
            UPDATE babalawo_wallets
            SET
                available_balance = available_balance + v_babalawo_amount,
                updated_at = NOW()
            WHERE babalawo_id = v_babalawo_user_id;

            RAISE NOTICE 'Credited ₦% to babalawo % wallet', v_babalawo_amount, v_babalawo_user_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Create trigger on sessions table
DROP TRIGGER IF EXISTS trigger_credit_babalawo_on_completion ON sessions;

CREATE TRIGGER trigger_credit_babalawo_on_completion
    AFTER UPDATE OF status ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION credit_babalawo_on_session_completion();

-- Add comment
COMMENT ON FUNCTION credit_babalawo_on_session_completion() IS 'Automatically credits babalawo wallet with their commission when a session is marked as completed';
