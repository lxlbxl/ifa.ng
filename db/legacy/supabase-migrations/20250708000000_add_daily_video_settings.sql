-- Migration to add Daily.co video settings

-- Add video_provider setting
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.admin_settings WHERE setting_key = 'video_provider') THEN
        INSERT INTO public.admin_settings (setting_key, setting_value, description) 
        VALUES ('video_provider', 'agora', 'Active video provider (agora or daily)');
    END IF;
END $$;

-- Add Daily.co API key setting
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.admin_settings WHERE setting_key = 'daily_api_key') THEN
        INSERT INTO public.admin_settings (setting_key, setting_value, description) 
        VALUES ('daily_api_key', '', 'Daily.co API Key');
    END IF;
END $$;

-- Add Daily.co room expiry setting
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.admin_settings WHERE setting_key = 'daily_room_expiry') THEN
        INSERT INTO public.admin_settings (setting_key, setting_value, description) 
        VALUES ('daily_room_expiry', '3600', 'Daily.co room expiry in seconds');
    END IF;
END $$;

-- Add room_url column to sessions table
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS room_url TEXT;