
-- Add Agora-related columns to the sessions table
ALTER TABLE public.sessions 
ADD COLUMN agora_channel_name TEXT,
ADD COLUMN agora_token_user TEXT,
ADD COLUMN agora_token_babalawo TEXT,
ADD COLUMN session_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN session_ended_at TIMESTAMP WITH TIME ZONE;

-- Update admin_settings to include Agora credentials
INSERT INTO public.admin_settings (setting_key, setting_value, description) VALUES
('agora_app_id', '', 'Agora App ID for video calling'),
('agora_app_certificate', '', 'Agora App Certificate for token generation'),
('agora_token_expiry', '3600', 'Token expiry duration in seconds'),
('agora_mode', 'test', 'Agora mode: test or live')
ON CONFLICT (setting_key) DO UPDATE SET
setting_value = EXCLUDED.setting_value,
description = EXCLUDED.description;

-- Create session_logs table for tracking session activities
CREATE TABLE IF NOT EXISTS public.session_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id),
  user_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'joined', 'left', 'forced_end'
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

-- Enable RLS on session_logs
ALTER TABLE public.session_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for session_logs
CREATE POLICY "Users can view their own session logs" 
  ON public.session_logs 
  FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own session logs" 
  ON public.session_logs 
  FOR INSERT 
  WITH CHECK (user_id = auth.uid());

-- Admin can view all session logs
CREATE POLICY "Admins can view all session logs" 
  ON public.session_logs 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
