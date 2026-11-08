ALTER TABLE sessions
ADD COLUMN primary_odu VARCHAR(255) NULL,
ADD COLUMN other_odus TEXT[] NULL,
ADD COLUMN ritual_recommendations TEXT NULL,
ADD COLUMN items_needed JSONB NULL,
ADD COLUMN notes TEXT NULL;
