-- Create sample verified babalawos for testing
-- First, insert sample profiles for babalawos
INSERT INTO public.profiles (id, email, full_name, role, avatar_url, created_at, updated_at) VALUES
('11111111-1111-1111-1111-111111111111', 'babalawo1@example.com', 'Oluwo Adebayo Ogundimu', 'babalawo', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face', now(), now()),
('22222222-2222-2222-2222-222222222222', 'babalawo2@example.com', 'Yeye Folake Adunni', 'babalawo', 'https://images.unsplash.com/photo-1494790108755-2616b612b798?w=150&h=150&fit=crop&crop=face', now(), now()),
('33333333-3333-3333-3333-333333333333', 'babalawo3@example.com', 'Agba Korede Olatunji', 'babalawo', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face', now(), now()),
('44444444-4444-4444-4444-444444444444', 'babalawo4@example.com', 'Iya Funmi Olabode', 'babalawo', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face', now(), now()),
('55555555-5555-5555-5555-555555555555', 'babalawo5@example.com', 'Baba Tunde Akinola', 'babalawo', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face', now(), now()),
('66666666-6666-6666-6666-666666666666', 'babalawo6@example.com', 'Iya Kemi Ogunseye', 'babalawo', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Insert corresponding babalawo records
INSERT INTO public.babalawos (user_id, specialties, years_of_experience, hourly_rate, bio, is_verified, rating, total_sessions, languages, timezone, is_active, created_at, updated_at) VALUES
('11111111-1111-1111-1111-111111111111', 
 ARRAY['Ifa Divination', 'Love & Relationships', 'Career Guidance'], 
 15, 25000, 
 'Experienced Ifa priest with over 15 years of practice. Specializes in traditional divination and spiritual guidance for modern life challenges.',
 true, 4.8, 234, ARRAY['English', 'Yoruba'], 'Africa/Lagos', true, now(), now()),
 
('22222222-2222-2222-2222-222222222222', 
 ARRAY['Healing Rituals', 'Protection Spells', 'Family Harmony'], 
 12, 20000, 
 'Traditional healer and spiritual counselor. Expert in ancestral communication and family blessing rituals.',
 true, 4.9, 189, ARRAY['English', 'Yoruba', 'Igbo'], 'Africa/Lagos', true, now(), now()),
 
('33333333-3333-3333-3333-333333333333', 
 ARRAY['Business Success', 'Financial Prosperity', 'Career Advancement'], 
 20, 30000, 
 'Senior Babalawo specializing in business and financial prosperity. Helps entrepreneurs and professionals achieve success.',
 true, 4.7, 312, ARRAY['English', 'Yoruba'], 'Africa/Lagos', true, now(), now()),
 
('44444444-4444-4444-4444-444444444444', 
 ARRAY['Love & Marriage', 'Fertility Blessings', 'Women Health'], 
 18, 22000, 
 'Respected Iya specializing in matters of the heart, marriage, and women\'s spiritual health. Known for compassionate guidance.',
 true, 4.6, 267, ARRAY['English', 'Yoruba'], 'Africa/Lagos', true, now(), now()),
 
('55555555-5555-5555-5555-555555555555', 
 ARRAY['Spiritual Cleansing', 'Curse Removal', 'Protection'], 
 25, 35000, 
 'Highly experienced spiritual cleanser and protector. Specializes in removing negative energies and spiritual obstacles.',
 true, 4.9, 456, ARRAY['English', 'Yoruba', 'Hausa'], 'Africa/Lagos', true, now(), now()),
 
('66666666-6666-6666-6666-666666666666', 
 ARRAY['Health & Healing', 'Herbal Medicine', 'Wellness'], 
 14, 18000, 
 'Traditional medicine practitioner combining spiritual healing with herbal remedies for holistic wellness.',
 true, 4.5, 198, ARRAY['English', 'Yoruba'], 'Africa/Lagos', true, now(), now())
ON CONFLICT (user_id) DO NOTHING;