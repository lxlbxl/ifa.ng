-- Add is_featured column to babalawos table for featured babalawo functionality
ALTER TABLE babalawos ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

-- Add current_status column to track real-time online/offline status
ALTER TABLE babalawos ADD COLUMN IF NOT EXISTS current_status TEXT DEFAULT 'offline' CHECK (current_status IN ('online', 'offline', 'busy'));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_babalawos_is_featured ON babalawos(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_babalawos_current_status ON babalawos(current_status);