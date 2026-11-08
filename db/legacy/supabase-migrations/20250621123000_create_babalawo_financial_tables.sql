-- Create babalawo_wallets table to track wallet balances
CREATE TABLE IF NOT EXISTS public.babalawo_wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  babalawo_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  available_balance DECIMAL(12, 2) DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create withdrawal_requests table to track withdrawal requests
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  babalawo_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- e.g. pending, approved, rejected, completed
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create payouts table to track payout transactions
CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  babalawo_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  method TEXT NOT NULL, -- e.g. Bank Transfer, Flutterwave
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- e.g. pending, paid, failed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add commission rate columns to babalawos table
ALTER TABLE public.babalawos
ADD COLUMN IF NOT EXISTS commission_platform_percent INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS commission_babalawo_percent INTEGER DEFAULT 80;
