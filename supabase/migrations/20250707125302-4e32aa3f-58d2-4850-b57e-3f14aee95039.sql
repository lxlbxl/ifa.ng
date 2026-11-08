-- Fix missing RLS policies for security issues

-- Add RLS policies for notifications table
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id::uuid);

CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id::uuid);

-- Add RLS policies for babalawo_bank_details table
ALTER TABLE public.babalawo_bank_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Babalawos can manage their own bank details"
ON public.babalawo_bank_details
FOR ALL
USING (auth.uid() = babalawo_id);

-- Add RLS policies for babalawo_wallets table
ALTER TABLE public.babalawo_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Babalawos can view their own wallet"
ON public.babalawo_wallets
FOR SELECT
USING (auth.uid() = babalawo_id);

CREATE POLICY "Babalawos can update their own wallet"
ON public.babalawo_wallets
FOR UPDATE
USING (auth.uid() = babalawo_id);

-- Add RLS policies for withdrawal_requests table
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Babalawos can manage their own withdrawal requests"
ON public.withdrawal_requests
FOR ALL
USING (auth.uid() = babalawo_id);

CREATE POLICY "Admins can view all withdrawal requests"
ON public.withdrawal_requests
FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can update withdrawal requests"
ON public.withdrawal_requests
FOR UPDATE
USING (is_admin());

-- Add RLS policies for user_notification_preferences table
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own notification preferences"
ON public.user_notification_preferences
FOR ALL
USING (auth.uid() = user_id);

-- Add additional admin policies for profiles table
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (is_admin());