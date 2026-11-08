-- Add missing user_timezone column to sessions table
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS user_timezone TEXT DEFAULT 'Africa/Lagos';