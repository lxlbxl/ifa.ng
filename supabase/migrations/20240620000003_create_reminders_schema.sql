-- Create reminders table
CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('session', 'ritual', 'warning', 'system')),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  reminder_time TIMESTAMP WITH TIME ZONE NOT NULL,
  related_id UUID,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on reminder_time and status for efficient querying
CREATE INDEX IF NOT EXISTS idx_reminders_time_status ON reminders(reminder_time, status);

-- Create ritual_reminders table for babalawo-created reminders
CREATE TABLE IF NOT EXISTS ritual_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  babalawo_id UUID NOT NULL REFERENCES babalawos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  ritual_type VARCHAR(50) NOT NULL CHECK (ritual_type IN ('ebo', 'etutu', 'warning', 'other')),
  due_date DATE NOT NULL,
  reminder_days INTEGER[] DEFAULT '{1, 3, 7}',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create function to generate reminders from ritual_reminders
CREATE OR REPLACE FUNCTION generate_ritual_reminders()
RETURNS TRIGGER AS $$
DECLARE
  reminder_day INTEGER;
  user_name TEXT;
  babalawo_name TEXT;
BEGIN
  -- Get user and babalawo names
  SELECT p.full_name INTO user_name
  FROM profiles p
  WHERE p.user_id = NEW.user_id;
  
  SELECT p.full_name INTO babalawo_name
  FROM babalawos b
  JOIN profiles p ON p.user_id = b.user_id
  WHERE b.id = NEW.babalawo_id;
  
  -- Create reminders for each reminder day
  FOREACH reminder_day IN ARRAY NEW.reminder_days
  LOOP
    INSERT INTO reminders (
      user_id,
      type,
      title,
      message,
      reminder_time,
      related_id,
      status
    ) VALUES (
      NEW.user_id,
      CASE 
        WHEN NEW.ritual_type = 'warning' THEN 'warning'
        ELSE 'ritual'
      END,
      CASE 
        WHEN reminder_day = 0 THEN 'Today: ' || NEW.title
        WHEN reminder_day = 1 THEN 'Tomorrow: ' || NEW.title
        ELSE reminder_day || ' Days: ' || NEW.title
      END,
      CASE
        WHEN NEW.ritual_type = 'warning' THEN 
          'IMPORTANT WARNING from ' || COALESCE(babalawo_name, 'your babalawo') || ': ' || NEW.description
        ELSE
          'Reminder for ' || NEW.ritual_type || ' ritual: ' || NEW.description || 
          ' (Due in ' || reminder_day || ' days)'
      END,
      (NEW.due_date - reminder_day * INTERVAL '1 day')::TIMESTAMP WITH TIME ZONE,
      NEW.id,
      'pending'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for ritual_reminders
DROP TRIGGER IF EXISTS after_insert_ritual_reminder ON ritual_reminders;
CREATE TRIGGER after_insert_ritual_reminder
  AFTER INSERT ON ritual_reminders
  FOR EACH ROW
  EXECUTE FUNCTION generate_ritual_reminders();

-- Create notification_preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  session_reminders BOOLEAN NOT NULL DEFAULT TRUE,
  payment_updates BOOLEAN NOT NULL DEFAULT TRUE,
  system_announcements BOOLEAN NOT NULL DEFAULT TRUE,
  new_babalawos BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create review_flags table
CREATE TABLE IF NOT EXISTS review_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reporter_type VARCHAR(20) NOT NULL CHECK (reporter_type IN ('user', 'babalawo', 'admin')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add flagged column to reviews table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'reviews' AND column_name = 'flagged'
  ) THEN
    ALTER TABLE reviews ADD COLUMN flagged BOOLEAN DEFAULT FALSE;
  END IF;
END $$;