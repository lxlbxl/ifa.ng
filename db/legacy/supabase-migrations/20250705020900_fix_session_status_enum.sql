-- Migration to ensure session_status_enum is properly managed
-- and to add data migration for existing records if needed

-- First, create a transaction to ensure all operations succeed or fail together
BEGIN;

-- Check if the enum type exists and create it if it doesn't
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_status_enum') THEN
        -- Create the enum with all needed values from the start
        CREATE TYPE session_status_enum AS ENUM (
            'pending', 
            'confirmed', 
            'completed', 
            'cancelled', 
            'in_progress'
        );
        
        -- Add a comment describing the enum
        COMMENT ON TYPE session_status_enum IS 'Status values for session lifecycle';
        
        -- If the sessions table exists but doesn't have the status column with the enum type,
        -- add it with a default value
        IF EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_name = 'sessions' AND table_schema = 'public'
        ) AND NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'sessions' 
              AND column_name = 'status' 
              AND table_schema = 'public'
              AND udt_name = 'session_status_enum'
        ) THEN
            -- Add temporary status column with the enum type
            ALTER TABLE sessions ADD COLUMN temp_status session_status_enum DEFAULT 'pending';
            
            -- Try to convert existing status string values to the enum
            UPDATE sessions 
            SET temp_status = 
                CASE 
                    WHEN status = 'pending' THEN 'pending'::session_status_enum
                    WHEN status = 'confirmed' THEN 'confirmed'::session_status_enum
                    WHEN status = 'completed' THEN 'completed'::session_status_enum
                    WHEN status = 'cancelled' THEN 'cancelled'::session_status_enum
                    WHEN status = 'in_progress' THEN 'in_progress'::session_status_enum
                    ELSE 'pending'::session_status_enum -- Default fallback
                END
            WHERE status IS NOT NULL;
            
            -- Drop the old status column and rename the new one
            ALTER TABLE sessions DROP COLUMN status;
            ALTER TABLE sessions RENAME COLUMN temp_status TO status;
            
            -- Add not null constraint if appropriate
            ALTER TABLE sessions ALTER COLUMN status SET NOT NULL;
        END IF;
    ELSE
        -- If the enum already exists, check if it has the 'in_progress' value
        -- and add it if it doesn't
        IF NOT EXISTS (
            SELECT 1
            FROM pg_enum
            WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'session_status_enum')
            AND enumlabel = 'in_progress'
        ) THEN
            -- Add the missing enum value
            ALTER TYPE session_status_enum ADD VALUE 'in_progress';
        END IF;
    END IF;
END$$;

-- Ensure the sessions table has the is_instant column
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_instant BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN sessions.is_instant IS 'Flag to indicate if this is an instant consultation session';

-- Add an index to improve query performance on status and is_instant columns
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_is_instant ON sessions(is_instant);

-- If needed, migrate any existing in-progress sessions that might be miscategorized
UPDATE sessions 
SET status = 'in_progress'::session_status_enum
WHERE status = 'confirmed'::session_status_enum
  AND session_started_at IS NOT NULL
  AND session_ended_at IS NULL;

-- Commit the transaction
COMMIT;
