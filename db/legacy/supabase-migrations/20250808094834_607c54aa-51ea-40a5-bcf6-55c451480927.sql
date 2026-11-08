-- Enable RLS on all public tables that don't have it
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritual_reminders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own sessions" ON sessions;
DROP POLICY IF EXISTS "Users can create their own sessions" ON sessions;
DROP POLICY IF EXISTS "Babalawos can update their sessions" ON sessions;
DROP POLICY IF EXISTS "Admins can view all sessions" ON sessions;

-- Create RLS policies for sessions table
CREATE POLICY "Users can view their own sessions" ON sessions
FOR SELECT USING (auth.uid() = user_id OR auth.uid() = babalawo_id);

CREATE POLICY "Users can create their own sessions" ON sessions
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Babalawos can update their sessions" ON sessions
FOR UPDATE USING (auth.uid() = babalawo_id OR auth.uid() = user_id);

CREATE POLICY "Admins can view all sessions" ON sessions
FOR ALL USING (is_admin());

-- Drop and create review policies
DROP POLICY IF EXISTS "Anyone can view approved reviews" ON reviews;
DROP POLICY IF EXISTS "Users can create reviews for their sessions" ON reviews;
DROP POLICY IF EXISTS "Admins can manage all reviews" ON reviews;

CREATE POLICY "Anyone can view approved reviews" ON reviews
FOR SELECT USING (is_approved = true);

CREATE POLICY "Users can create reviews for their sessions" ON reviews
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all reviews" ON reviews
FOR ALL USING (is_admin());