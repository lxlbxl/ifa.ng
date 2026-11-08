CREATE TABLE public.babalawo_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    babalawo_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    available_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    pending_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.babalawo_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Babalawos can view their own wallet" ON public.babalawo_wallets
    FOR SELECT USING (auth.uid() = babalawo_id);

CREATE POLICY "Babalawos can update their own wallet" ON public.babalawo_wallets
    FOR UPDATE USING (auth.uid() = babalawo_id);
