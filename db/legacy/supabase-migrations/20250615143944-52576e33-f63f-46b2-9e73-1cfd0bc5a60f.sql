
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE user_role AS ENUM ('user', 'babalawo', 'admin');
CREATE TYPE session_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected');

-- Create profiles table (extends auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    phone TEXT,
    role user_role DEFAULT 'user',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create babalawos table for spiritual guides
CREATE TABLE public.babalawos (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    specialties TEXT[],
    experience_years INTEGER DEFAULT 0,
    hourly_rate DECIMAL(10,2) DEFAULT 0,
    bio TEXT,
    verification_status verification_status DEFAULT 'pending',
    rating DECIMAL(3,2) DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    languages TEXT[] DEFAULT ARRAY['English'],
    timezone TEXT DEFAULT 'UTC',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create availability table for babalawo schedules
CREATE TABLE public.availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    babalawo_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create sessions table for bookings
CREATE TABLE public.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    babalawo_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status session_status DEFAULT 'pending',
    payment_status payment_status DEFAULT 'pending',
    amount DECIMAL(10,2) NOT NULL,
    notes TEXT,
    jitsi_room_name TEXT,
    payment_reference TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create reviews table
CREATE TABLE public.reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    babalawo_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create admin_settings table for API credentials
CREATE TABLE public.admin_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT,
    is_encrypted BOOLEAN DEFAULT false,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default admin settings
INSERT INTO public.admin_settings (setting_key, setting_value, description) VALUES
('flutterwave_public_key', '', 'Flutterwave Public Key'),
('flutterwave_secret_key', '', 'Flutterwave Secret Key'),
('flutterwave_test_mode', 'true', 'Flutterwave Test Mode (true/false)'),
('jitsi_domain', 'meet.jit.si', 'Jitsi Meet Domain'),
('jitsi_app_id', '', 'Jitsi App ID (if using custom domain)'),
('email_service_key', '', 'Email Service API Key'),
('sms_service_key', '', 'SMS Service API Key');

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.babalawos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for babalawos
CREATE POLICY "Anyone can view approved babalawos" ON public.babalawos
    FOR SELECT USING (verification_status = 'approved' OR auth.uid() = id);

CREATE POLICY "Babalawos can update their own profile" ON public.babalawos
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Babalawos can insert their own profile" ON public.babalawos
    FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for availability
CREATE POLICY "Anyone can view babalawo availability" ON public.availability
    FOR SELECT USING (true);

CREATE POLICY "Babalawos can manage their availability" ON public.availability
    FOR ALL USING (auth.uid() = babalawo_id);

-- RLS Policies for sessions
CREATE POLICY "Users can view their own sessions" ON public.sessions
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() = babalawo_id);

CREATE POLICY "Users can create sessions" ON public.sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Participants can update sessions" ON public.sessions
    FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = babalawo_id);

-- RLS Policies for reviews
CREATE POLICY "Anyone can view reviews" ON public.reviews
    FOR SELECT USING (true);

CREATE POLICY "Users can create reviews for their sessions" ON public.reviews
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for admin_settings (admin only)
CREATE POLICY "Only admins can access settings" ON public.admin_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'user')
    );
    
    -- If user is signing up as babalawo, create babalawo profile
    IF COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'user') = 'babalawo' THEN
        INSERT INTO public.babalawos (id)
        VALUES (NEW.id);
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update babalawo rating
CREATE OR REPLACE FUNCTION public.update_babalawo_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    UPDATE public.babalawos
    SET 
        rating = (
            SELECT ROUND(AVG(rating)::numeric, 2)
            FROM public.reviews
            WHERE babalawo_id = NEW.babalawo_id
        ),
        total_sessions = (
            SELECT COUNT(*)
            FROM public.sessions
            WHERE babalawo_id = NEW.babalawo_id AND status = 'completed'
        )
    WHERE id = NEW.babalawo_id;
    
    RETURN NEW;
END;
$$;

-- Create trigger to update babalawo rating after review
CREATE TRIGGER update_babalawo_rating_trigger
    AFTER INSERT ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION public.update_babalawo_rating();

-- Create indexes for better performance
CREATE INDEX idx_babalawos_verification_status ON public.babalawos(verification_status);
CREATE INDEX idx_babalawos_rating ON public.babalawos(rating DESC);
CREATE INDEX idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX idx_sessions_babalawo_id ON public.sessions(babalawo_id);
CREATE INDEX idx_sessions_date ON public.sessions(session_date);
CREATE INDEX idx_availability_babalawo_id ON public.availability(babalawo_id);
CREATE INDEX idx_reviews_babalawo_id ON public.reviews(babalawo_id);
