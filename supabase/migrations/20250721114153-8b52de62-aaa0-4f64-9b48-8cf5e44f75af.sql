-- Create session_status_enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE session_status_enum AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update sessions table to use the enum type for status column
ALTER TABLE sessions 
ALTER COLUMN status TYPE session_status_enum USING status::session_status_enum;