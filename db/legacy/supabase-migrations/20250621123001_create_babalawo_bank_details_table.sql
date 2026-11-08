-- Create babalawo_bank_details table to store bank account information
CREATE TABLE IF NOT EXISTS public.babalawo_bank_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    babalawo_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      account_name TEXT NOT NULL,
        account_number TEXT NOT NULL,
          bank_name TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
              updated_at TIMESTAMPTZ DEFAULT NOW()
              );
              