-- Create a function to handle NULL values in numeric operations
CREATE OR REPLACE FUNCTION coalesce_zero(val numeric)
RETURNS numeric AS $$
BEGIN
  RETURN COALESCE(val, 0);
END;
$$ LANGUAGE plpgsql;

-- Create a function to update babalawo balance after withdrawal request
CREATE OR REPLACE FUNCTION update_babalawo_balance_after_withdrawal(
  p_babalawo_id UUID,
  p_amount numeric
)
RETURNS void AS $$
BEGIN
  -- Update the babalawo's earnings record
  UPDATE babalawo_earnings
  SET 
    available_balance = COALESCE(available_balance, 0) - p_amount,
    pending_withdrawals = COALESCE(pending_withdrawals, 0) + p_amount,
    updated_at = NOW()
  WHERE babalawo_id = p_babalawo_id;
  
  -- If no record exists, create one
  IF NOT FOUND THEN
    INSERT INTO babalawo_earnings (
      babalawo_id, 
      available_balance, 
      pending_withdrawals,
      total_earnings,
      created_at,
      updated_at
    )
    VALUES (
      p_babalawo_id, 
      0, 
      p_amount,
      0,
      NOW(),
      NOW()
    );
  END IF;
END;
$$ LANGUAGE plpgsql;