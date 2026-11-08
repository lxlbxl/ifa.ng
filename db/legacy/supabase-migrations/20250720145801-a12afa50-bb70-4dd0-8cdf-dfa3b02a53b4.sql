-- Fix database schema issues

-- 1. Fix babalawos table column naming for consistency
ALTER TABLE public.babalawos RENAME COLUMN years_of_experience TO experience_years;

-- 2. Add missing columns to reviews table
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS babalawo_id uuid;

-- 3. Create payments table that code is referencing
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  session_id bigint REFERENCES public.sessions(id),
  amount numeric NOT NULL,
  commission_amount numeric DEFAULT 0,
  babalawo_amount numeric DEFAULT 0,
  payment_gateway text,
  payment_reference text,
  status text DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 4. Enable RLS on payments table
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for payments
CREATE POLICY "Users can view their own payments" 
ON public.payments 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all payments" 
ON public.payments 
FOR ALL 
USING (is_admin());

-- 6. Add missing commission columns to babalawos table
ALTER TABLE public.babalawos ADD COLUMN IF NOT EXISTS commission_platform_percent numeric DEFAULT 20;
ALTER TABLE public.babalawos ADD COLUMN IF NOT EXISTS commission_babalawo_percent numeric DEFAULT 80;

-- 7. Create payouts table referenced in earnings function
CREATE TABLE IF NOT EXISTS public.payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  babalawo_id uuid NOT NULL,
  amount numeric NOT NULL,
  method text,
  reference text,
  status text DEFAULT 'completed',
  created_at timestamp with time zone DEFAULT now()
);

-- 8. Enable RLS on payouts table
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- 9. Create RLS policies for payouts
CREATE POLICY "Babalawos can view their own payouts" 
ON public.payouts 
FOR SELECT 
USING (auth.uid() = babalawo_id);

CREATE POLICY "Admins can view all payouts" 
ON public.payouts 
FOR ALL 
USING (is_admin());