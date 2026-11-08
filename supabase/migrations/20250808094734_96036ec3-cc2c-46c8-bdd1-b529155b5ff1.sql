-- Enable RLS on all public tables that don't have it
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritual_reminders ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for sessions table
CREATE POLICY IF NOT EXISTS "Users can view their own sessions" ON sessions
FOR SELECT USING (auth.uid() = user_id OR auth.uid() = babalawo_id);

CREATE POLICY IF NOT EXISTS "Users can create their own sessions" ON sessions
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Babalawos can update their sessions" ON sessions
FOR UPDATE USING (auth.uid() = babalawo_id OR auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Admins can view all sessions" ON sessions
FOR ALL USING (is_admin());

-- Create RLS policies for reviews table
CREATE POLICY IF NOT EXISTS "Anyone can view approved reviews" ON reviews
FOR SELECT USING (is_approved = true);

CREATE POLICY IF NOT EXISTS "Users can create reviews for their sessions" ON reviews
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Admins can manage all reviews" ON reviews
FOR ALL USING (is_admin());

-- Add some test data
-- First, let's create some test profiles and babalawos
INSERT INTO profiles (id, email, full_name, role) VALUES 
('11111111-1111-1111-1111-111111111111', 'babalawo1@test.com', 'Chief Adebayo Ifayemi', 'babalawo'),
('22222222-2222-2222-2222-222222222222', 'babalawo2@test.com', 'Iya Funmi Ogundimu', 'babalawo'),
('33333333-3333-3333-3333-333333333333', 'babalawo3@test.com', 'Baba Wale Akinola', 'babalawo'),
('44444444-4444-4444-4444-444444444444', 'user1@test.com', 'Adunni Oluwaseun', 'user')
ON CONFLICT (id) DO NOTHING;

-- Create babalawo records
INSERT INTO babalawos (
  user_id, bio, experience_years, hourly_rate, is_active, languages, rating, 
  specialties, timezone, total_sessions, is_verified, is_featured, current_status
) VALUES 
(
  '11111111-1111-1111-1111-111111111111',
  'Experienced spiritual guide specializing in Ifa divination and traditional healing',
  15,
  25000,
  true,
  ARRAY['English', 'Yoruba'],
  4.8,
  ARRAY['Ifa Divination', 'Spiritual Healing', 'Love & Relationship'],
  'Africa/Lagos',
  150,
  true,
  true,
  'online'
),
(
  '22222222-2222-2222-2222-222222222222',
  'Traditional healer and Ifa priestess with deep knowledge of herbal medicine',
  12,
  20000,
  true,
  ARRAY['English', 'Yoruba'],
  4.9,
  ARRAY['Herbal Medicine', 'Fertility', 'Protection Rituals'],
  'Africa/Lagos',
  120,
  true,
  true,
  'online'
),
(
  '33333333-3333-3333-3333-333333333333',
  'Master of Ifa tradition with expertise in business and financial consultations',
  20,
  30000,
  true,
  ARRAY['English', 'Yoruba'],
  4.7,
  ARRAY['Business Success', 'Financial Guidance', 'Career Development'],
  'Africa/Lagos',
  200,
  true,
  false,
  'busy'
)
ON CONFLICT (user_id) DO NOTHING;