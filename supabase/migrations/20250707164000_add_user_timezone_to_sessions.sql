ALTER TABLE public.sessions
ADD COLUMN user_timezone TEXT NOT NULL DEFAULT 'UTC';
