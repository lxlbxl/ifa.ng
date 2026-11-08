-- Add consultation outcome columns to sessions table
ALTER TABLE public.sessions
ADD COLUMN primary_odu TEXT,
ADD COLUMN other_odus TEXT[],
ADD COLUMN ritual_recommendations TEXT,
ADD COLUMN items_needed JSONB,
ADD COLUMN deadline DATE,
ADD COLUMN next_appointment DATE;
