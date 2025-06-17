
-- Add Paystack settings to admin_settings (Flutterwave settings should already exist)
INSERT INTO admin_settings (setting_key, setting_value, description) VALUES
('paystack_public_key', '', 'Your Paystack public key'),
('paystack_secret_key', '', 'Your Paystack secret key'),
('paystack_environment', 'test', 'Paystack environment (test or live)')
ON CONFLICT (setting_key) DO NOTHING;

-- Create wallet table for user balances
CREATE TABLE public.wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  balance NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies for wallets
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own wallet" 
  ON public.wallets 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallet" 
  ON public.wallets 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wallet" 
  ON public.wallets 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create wallet_transactions table to track all wallet activities
CREATE TABLE public.wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('credit', 'debit')),
  transaction_source TEXT NOT NULL CHECK (transaction_source IN ('payment_gateway', 'session_payment', 'refund', 'admin_adjustment')),
  payment_gateway TEXT CHECK (payment_gateway IN ('flutterwave', 'paystack')),
  payment_reference TEXT,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies for wallet_transactions
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own wallet transactions" 
  ON public.wallet_transactions 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Update payments table to include payment method selection
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS selected_payment_method TEXT CHECK (selected_payment_method IN ('wallet', 'flutterwave', 'paystack'));
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS paystack_reference TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS paystack_transaction_id TEXT;

-- Function to create wallet for new users
CREATE OR REPLACE FUNCTION public.create_user_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.wallets (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create wallet when user profile is created
CREATE TRIGGER create_wallet_on_profile_creation
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_wallet();

-- Function to update wallet balance
CREATE OR REPLACE FUNCTION public.update_wallet_balance(
  p_user_id UUID,
  p_amount NUMERIC,
  p_transaction_type TEXT,
  p_transaction_source TEXT,
  p_payment_gateway TEXT DEFAULT NULL,
  p_payment_reference TEXT DEFAULT NULL,
  p_session_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
  v_new_balance NUMERIC;
BEGIN
  -- Get or create wallet
  SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = p_user_id;
  
  IF v_wallet_id IS NULL THEN
    INSERT INTO public.wallets (user_id) VALUES (p_user_id) RETURNING id INTO v_wallet_id;
  END IF;
  
  -- Calculate new balance
  IF p_transaction_type = 'credit' THEN
    UPDATE public.wallets 
    SET balance = balance + p_amount, updated_at = now()
    WHERE id = v_wallet_id
    RETURNING balance INTO v_new_balance;
  ELSE
    UPDATE public.wallets 
    SET balance = balance - p_amount, updated_at = now()
    WHERE id = v_wallet_id AND balance >= p_amount
    RETURNING balance INTO v_new_balance;
    
    IF v_new_balance IS NULL THEN
      RAISE EXCEPTION 'Insufficient wallet balance';
    END IF;
  END IF;
  
  -- Record transaction
  INSERT INTO public.wallet_transactions (
    user_id, wallet_id, amount, transaction_type, transaction_source,
    payment_gateway, payment_reference, session_id, description
  ) VALUES (
    p_user_id, v_wallet_id, p_amount, p_transaction_type, p_transaction_source,
    p_payment_gateway, p_payment_reference, p_session_id, p_description
  ) RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
