-- Add is_instant column to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_instant BOOLEAN DEFAULT FALSE;

-- Add comment to the column
COMMENT ON COLUMN sessions.is_instant IS 'Flag to indicate if this is an instant consultation session';

-- Update the status enum to include in_progress
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_status_enum') THEN
        CREATE TYPE session_status_enum AS ENUM ('pending', 'confirmed', 'completed', 'cancelled', 'in_progress');
        
        -- If the enum doesn't exist, we need to create the column with the new type
        ALTER TABLE sessions ADD COLUMN temp_status session_status_enum;
        UPDATE sessions SET temp_status = status::session_status_enum;
        ALTER TABLE sessions DROP COLUMN status;
        ALTER TABLE sessions RENAME COLUMN temp_status TO status;
    ELSE
        -- If the enum exists, we need to add the new value if it doesn't already exist
        BEGIN
            ALTER TYPE session_status_enum ADD VALUE 'in_progress' IF NOT EXISTS;
        EXCEPTION
            WHEN duplicate_object THEN
                -- Value already exists, do nothing
        END;
    END IF;
END
$$;